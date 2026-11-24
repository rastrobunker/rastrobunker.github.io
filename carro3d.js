/* Rastro Búnker · carro 3D para elegir la categoría (2026-11-24)
   El cliente toca una pieza del carro (faro, defensa, puerta…) y se abre esa categoría del catálogo.
   Three.js se carga solo cuando el carro aparece en pantalla, para no hacer lento el catálogo. */
(function () {
  'use strict';
  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js';
  var box = document.getElementById('rb3d');
  if (!box) return;
  var stage = box.querySelector('.rb3d-stage'), tip = box.querySelector('.rb3d-tip'), cargando = box.querySelector('.rb3d-load');

  // Sin WebGL (teléfonos muy viejos) no se muestra: quedan las tarjetas de siempre
  try {
    var tc = document.createElement('canvas');
    if (!(window.WebGLRenderingContext && (tc.getContext('webgl') || tc.getContext('experimental-webgl')))) throw 0;
  } catch (e) { box.remove(); return; }

  // Nombre que ve el cliente (la clave es la categoría guardada en el catálogo)
  var NOM = {
    'Lámpara Delantera': 'Faros delanteros', 'Defensa Delantera': 'Defensas delanteras', 'Defensa Delantera Inferior': 'Defensas delanteras inferiores',
    'Parrilla': 'Parrillas', 'Capó': 'Capós', 'Halógenas / Faros antiniebla': 'Halógenas / faros antiniebla', 'Cover de Alógena': 'Covers de halógena',
    'Guardafango': 'Guardafangos delanteros', 'Guardafango Trasero': 'Guardafangos traseros', 'Puerta': 'Puertas', 'Moldura de Puerta': 'Molduras de puerta',
    'Retrovisor': 'Retrovisores', 'Vidrio': 'Vidrios', 'Estribo': 'Estribos (rolling board)', 'Flare': 'Flares', 'Cubrepolvo': 'Cubrepolvos',
    'Copa': 'Copas de rin', 'Lámpara Trasera': 'Lámparas traseras (stops)', 'Defensa Trasera': 'Defensas traseras',
    'Defensa Trasera Inferior': 'Defensas traseras inferiores', 'Tapa de Baúl': 'Tapas de baúl'
  };
  function cuenta(cat) {
    try { return productos.filter(function (p) { return !p.vendido && p.categoria === cat; }).length; } catch (e) { return 0; }
  }

  var visible = false, iniciado = false, listo = false, pedirRender = null;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      visible = e.isIntersecting;
      if (visible && !iniciado) { iniciado = true; cargar(); }
      if (visible && pedirRender) pedirRender();
    });
  }, { rootMargin: '250px' });
  io.observe(box);

  function cargar() {
    if (window.THREE) return iniciar();
    var s = document.createElement('script');
    s.src = CDN; s.async = true;
    s.onload = iniciar;
    s.onerror = function () { box.remove(); };
    document.head.appendChild(s);
  }

  function iniciar() {
    var T = window.THREE;
    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { box.remove(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    stage.appendChild(renderer.domElement);
    if (cargando) cargando.remove();

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    scene.add(new T.HemisphereLight(0xeaf2ff, 0x6b5240, 0.85));
    var sol = new T.DirectionalLight(0xffffff, 1.1); sol.position.set(4, 7, 5); scene.add(sol);
    var rel = new T.DirectionalLight(0xbfd4ff, 0.6); rel.position.set(-5, 3, -4); scene.add(rel);

    var car = new T.Group(); scene.add(car);
    var partes = [];

    // ---------- materiales ----------
    function mat(o) { var m = new T.MeshStandardMaterial(o); m.color.convertSRGBToLinear(); m.emissive.convertSRGBToLinear(); return m; }
    var C = {
      carro: function () { return mat({ color: 0xa9bccd, metalness: 0.3, roughness: 0.3 }); },
      plastico: function () { return mat({ color: 0x222326, roughness: 0.85 }); },
      vidrio: function () { return mat({ color: 0x27323e, metalness: 0.4, roughness: 0.06, transparent: true, opacity: 0.92 }); },
      faro: function () { return mat({ color: 0xeef3f8, emissive: 0x9fb4c8, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.15 }); },
      stop: function () { return mat({ color: 0xb0001c, emissive: 0x6a0010, emissiveIntensity: 0.55, roughness: 0.25 }); },
      cromo: function () { return mat({ color: 0xd3d7dc, metalness: 0.7, roughness: 0.25 }); },
      llanta: function () { return mat({ color: 0x18181a, roughness: 0.92 }); },
      interior: function () { return mat({ color: 0x141416, roughness: 1, side: T.BackSide }); }
    };

    // ---------- formas ----------
    function rect(w, h, r) {
      var s = new T.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }
    // caja redondeada: w en X, h en Y, d en Z
    function caja(w, h, d, r, b) {
      b = b == null ? Math.min(0.02, d / 4, w / 4, h / 4) : b;
      var g = new T.ExtrudeGeometry(rect(Math.max(w - 2 * b, 0.002), Math.max(h - 2 * b, 0.002), r || 0.02),
        { depth: Math.max(d - 2 * b, 0.001), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
      g.center(); return g;
    }
    // panel lateral (perfil en X/Y) con hueco para la rueda si wx no es null
    var PISO = 0.30, RA = 0.45, CY = 0.36;
    function perfil(x0, x1, yi, yd, wx) {
      var s = new T.Shape(); s.moveTo(x0, yi); s.lineTo(x1, yd);
      for (var x = x1; x >= x0 - 1e-6; x -= 0.015) {
        var y = PISO;
        if (wx != null && Math.abs(x - wx) < RA) y = Math.max(PISO, CY + Math.sqrt(RA * RA - (x - wx) * (x - wx)));
        s.lineTo(x, y);
      }
      return s;
    }
    function extruir(shape, grosor, bevel) {
      return new T.ExtrudeGeometry(shape, { depth: grosor, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 2, curveSegments: 8 });
    }
    var ANCHO = 0.90; // mitad del ancho del carro

    function pieza(geo, material, cat, x, y, z) {
      var m = new T.Mesh(geo, material);
      m.position.set(x || 0, y || 0, z || 0);
      if (cat) { m.userData.cat = cat; partes.push(m); }
      car.add(m); return m;
    }
    // la misma pieza a los dos lados del carro (z y -z)
    function ambosLados(fn) { fn(1); fn(-1); }
    function lateral(shape, cat, material, grosor) {
      grosor = grosor || 0.06;
      var g = extruir(shape, grosor, 0.012);
      ambosLados(function (s) {
        var m = pieza(g, material(), cat);
        m.position.z = s > 0 ? ANCHO - grosor - 0.012 : -ANCHO + 0.012;
      });
    }

    // ---------- estructura que no se vende (relleno) ----------
    pieza(caja(3.94, 0.66, 1.26, 0.08), C.carro(), null, 0, 0.64, 0);
    // cabina: techo y pilares
    var cab = new T.Shape();
    cab.moveTo(0.95, 0.97); cab.lineTo(0.30, 1.52); cab.quadraticCurveTo(0.18, 1.57, 0.05, 1.57);
    cab.lineTo(-1.62, 1.57); cab.quadraticCurveTo(-1.74, 1.57, -1.78, 1.5); cab.lineTo(-1.96, 1.10); cab.lineTo(-1.98, 0.97);
    var gcab = extruir(cab, 1.5, 0.05); gcab.translate(0, 0, -0.75);
    pieza(gcab, C.carro(), null);
    // frente detrás de la parrilla y los faros
    pieza(caja(0.16, 0.26, 1.5, 0.03), C.plastico(), null, 2.03, 0.8, 0);

    // ---------- FRENTE ----------
    pieza(caja(0.32, 0.44, 1.8, 0.12), C.carro(), 'Defensa Delantera', 2.11, 0.52, 0);
    pieza(caja(0.24, 0.07, 1.56, 0.03), C.plastico(), 'Defensa Delantera Inferior', 2.17, 0.27, 0);
    // capó: un poco inclinado hacia adelante
    var capo = pieza(caja(1.2, 0.05, 1.66, 0.03), C.carro(), 'Capó', 1.53, 0.955, 0);
    capo.rotation.z = -0.07;
    // parrilla con barras
    var parr = new T.Group(); parr.position.set(2.13, 0.79, 0); car.add(parr);
    var marco = new T.Mesh(caja(0.05, 0.2, 0.8, 0.05), C.plastico()); parr.add(marco);
    for (var i = 0; i < 4; i++) { var barra = new T.Mesh(caja(0.03, 0.022, 0.74, 0.01), C.cromo()); barra.position.set(0.025, -0.07 + i * 0.047, 0); parr.add(barra); }
    parr.children.forEach(function (m) { m.userData.cat = 'Parrilla'; partes.push(m); });
    ambosLados(function (s) {
      // faro delantero
      var f = pieza(caja(0.14, 0.12, 0.36, 0.04), C.faro(), 'Lámpara Delantera', 2.1, 0.82, s * 0.62);
      f.rotation.y = s * 0.12;
      // halógena dentro de su cover, en la defensa
      pieza(caja(0.04, 0.15, 0.27, 0.06), C.plastico(), 'Cover de Alógena', 2.265, 0.42, s * 0.6);
      var h = pieza(new T.CylinderGeometry(0.052, 0.052, 0.03, 20), C.faro(), 'Halógenas / Faros antiniebla', 2.285, 0.42, s * 0.6);
      h.rotation.z = Math.PI / 2;
    });

    // ---------- COSTADOS ----------
    var RUEDA_D = 1.38, RUEDA_T = -1.38;
    lateral(perfil(0.95, 1.98, 0.98, 0.91, RUEDA_D), 'Guardafango', C.carro);
    lateral(perfil(-0.005, 0.935, 0.98, 0.98, null), 'Puerta', C.carro);
    lateral(perfil(-0.93, -0.02, 0.98, 0.98, null), 'Puerta', C.carro);
    lateral(perfil(-1.98, -0.945, 0.98, 0.98, RUEDA_T), 'Guardafango Trasero', C.carro);
    // vidrios laterales
    function ventana(pts) { var s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (var k = 1; k < pts.length; k++) s.lineTo(pts[k][0], pts[k][1]); return s; }
    var gv = 0.012;
    [[[0.86, 1.02], [0.32, 1.49], [0.02, 1.5], [0.02, 1.02]],
     [[-0.05, 1.02], [-0.05, 1.5], [-0.98, 1.5], [-0.98, 1.02]],
     [[-1.04, 1.02], [-1.04, 1.5], [-1.6, 1.5], [-1.85, 1.06]]].forEach(function (pts) {
      var g = extruir(ventana(pts), gv, 0);
      ambosLados(function (s) { pieza(g, C.vidrio(), 'Vidrio', 0, 0, s > 0 ? 0.806 : -0.806 - gv); });
    });
    ambosLados(function (s) {
      // retrovisor
      pieza(caja(0.1, 0.05, 0.1, 0.02), C.plastico(), 'Retrovisor', 0.86, 1.03, s * 0.86);
      pieza(caja(0.2, 0.13, 0.15, 0.04), C.carro(), 'Retrovisor', 0.84, 1.07, s * 0.97);
      // molduras de puerta
      pieza(caja(0.86, 0.045, 0.025, 0.02), C.plastico(), 'Moldura de Puerta', 0.47, 0.54, s * 0.905);
      pieza(caja(0.86, 0.045, 0.025, 0.02), C.plastico(), 'Moldura de Puerta', -0.475, 0.54, s * 0.905);
      // manijas (son parte de la puerta)
      pieza(caja(0.14, 0.03, 0.03, 0.01), C.cromo(), 'Puerta', 0.25, 0.85, s * 0.905);
      pieza(caja(0.14, 0.03, 0.03, 0.01), C.cromo(), 'Puerta', -0.7, 0.85, s * 0.905);
      // estribo
      pieza(caja(1.78, 0.05, 0.16, 0.02), C.plastico(), 'Estribo', -0.01, 0.29, s * 0.95);
    });
    // ruedas, copas, flares y cubrepolvos
    [RUEDA_D, RUEDA_T].forEach(function (wx) {
      ambosLados(function (s) {
        var z = s * 0.77;
        var ll = pieza(new T.TorusGeometry(0.265, 0.095, 14, 36), C.llanta(), 'Copa', wx, CY, z);
        var copa = pieza(new T.CylinderGeometry(0.235, 0.235, 0.05, 30), C.cromo(), 'Copa', wx, CY, z + s * 0.06);
        copa.rotation.x = Math.PI / 2;
        for (var r = 0; r < 5; r++) {
          var ry = pieza(caja(0.2, 0.035, 0.02, 0.01), C.plastico(), 'Copa', wx, CY, z + s * 0.09);
          ry.rotation.z = r * Math.PI * 2 / 5; ry.translateX(0.11);
        }
        var fl = pieza(new T.TorusGeometry(RA + 0.01, 0.04, 8, 30, Math.PI + 0.34), C.plastico(), 'Flare', wx, CY, s * 0.905);
        fl.rotation.z = -0.17;
        var cp = pieza(new T.CylinderGeometry(RA - 0.02, RA - 0.02, 0.22, 24, 1, true, Math.PI / 2 - 0.2, Math.PI + 0.4), C.interior(), 'Cubrepolvo', wx, CY, s * 0.74);
        cp.rotation.x = Math.PI / 2;
      });
    });

    // ---------- ATRÁS ----------
    pieza(caja(0.32, 0.44, 1.8, 0.12), C.carro(), 'Defensa Trasera', -2.11, 0.52, 0);
    pieza(caja(0.24, 0.07, 1.5, 0.03), C.plastico(), 'Defensa Trasera Inferior', -2.15, 0.27, 0);
    pieza(caja(0.07, 0.34, 1.1, 0.04), C.carro(), 'Tapa de Baúl', -2.02, 0.9, 0);
    ambosLados(function (s) { pieza(caja(0.08, 0.17, 0.26, 0.04), C.stop(), 'Lámpara Trasera', -2.02, 0.88, s * 0.7); });
    // parabrisas y vidrio trasero
    var pb = pieza(caja(0.84, 0.015, 1.38, 0.06, 0.004), C.vidrio(), 'Vidrio', 0.666, 1.292, 0);
    pb.rotation.z = Math.atan2(-0.55, 0.65);
    var vt = pieza(caja(0.42, 0.015, 1.24, 0.06, 0.004), C.vidrio(), 'Vidrio', -1.927, 1.326, 0);
    vt.rotation.z = Math.atan2(0.40, 0.18);
    // barras del techo (decorativas)
    ambosLados(function (s) { pieza(caja(1.5, 0.045, 0.05, 0.02), C.plastico(), null, -0.72, 1.62, s * 0.6); });

    // sombra suave en el piso
    (function () {
      function radial(paradas) {
        var cv = document.createElement('canvas'); cv.width = cv.height = 256;
        var g = cv.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
        paradas.forEach(function (p) { gr.addColorStop(p[0], p[1]); });
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        var t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; return t;
      }
      // plataforma: fuera del grupo del carro para que no gire con él
      var plat = new T.Mesh(new T.CircleGeometry(2.95, 64), new T.MeshBasicMaterial({ transparent: true, depthWrite: false,
        map: radial([[0, 'rgba(240,214,186,0.95)'], [0.55, 'rgba(201,158,120,0.75)'], [0.86, 'rgba(150,108,78,0.35)'], [0.95, 'rgba(255,226,196,0.55)'], [1, 'rgba(255,226,196,0)']]) }));
      plat.rotation.x = -Math.PI / 2; plat.position.y = 0.001; scene.add(plat);
      var sombra = new T.Mesh(new T.PlaneGeometry(5.4, 2.5), new T.MeshBasicMaterial({ transparent: true, depthWrite: false,
        map: radial([[0, 'rgba(40,24,14,0.6)'], [0.6, 'rgba(40,24,14,0.25)'], [1, 'rgba(40,24,14,0)']]) }));
      sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.003; car.add(sombra);
    })();

    // cada pieza guarda su brillo original para poder resaltarla
    partes.forEach(function (m) {
      m.userData.em = m.material.emissive.getHex(); m.userData.ei = m.material.emissiveIntensity; m.userData.col = m.material.color.clone();
    });

    // ---------- cámara, giro y resaltado ----------
    var VISTAS = { frente: -Math.PI / 2 + 0.25, lado: 0, atras: Math.PI / 2 - 0.25, inicio: -0.62 };
    var yaw = VISTAS.inicio, yawMeta = null, pitch = 0.36, auto = true, dist = 8;
    var marcada = null, rc = new T.Raycaster(), pv = new T.Vector2();

    function ajustar() {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      dist = Math.max(3.0 / Math.sin(hf / 2), 1.9 / Math.sin(vf / 2));
      camera.updateProjectionMatrix(); dibujar();
    }
    function colocarCamara() {
      camera.position.set(0, 0.72 + dist * Math.sin(pitch), dist * Math.cos(pitch));
      camera.lookAt(0, 0.62, 0);
      car.rotation.y = yaw;
    }
    function resaltar(cat) {
      if (cat === marcada) return; marcada = cat;
      partes.forEach(function (m) {
        var on = cat && m.userData.cat === cat;
        // resaltado rojo de la marca (también en piezas blancas como los faros)
        if (on) m.material.color.setHex(0xff2d4a).convertSRGBToLinear(); else m.material.color.copy(m.userData.col);
        m.material.emissive.setHex(on ? 0x8a0018 : m.userData.em);
        m.material.emissiveIntensity = on ? 0.7 : m.userData.ei;
      });
      renderer.domElement.style.cursor = cat ? 'pointer' : 'grab';
      dibujar();
    }
    function catEn(x, y) {
      var r = renderer.domElement.getBoundingClientRect();
      pv.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(pv, camera);
      var hit = rc.intersectObjects(partes, false)[0];
      return hit ? hit.object.userData.cat : null;
    }
    function mostrarTip(cat, x, y, texto) {
      if (!cat) { tip.classList.remove('on'); return; }
      var n = cuenta(cat);
      tip.innerHTML = texto || ('<b>' + (NOM[cat] || cat) + '</b><span>' + (n ? n + ' disponible' + (n !== 1 ? 's' : '') : 'Sin piezas ahora') + '</span>');
      var r = stage.getBoundingClientRect();
      var tx = Math.min(Math.max(x - r.left, 70), r.width - 70), ty = Math.max(y - r.top - 14, 34);
      tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
      tip.classList.add('on');
    }
    function abrir(cat) {
      if (typeof elegirCategoria !== 'function') return;
      elegirCategoria(cat);
      setTimeout(function () {
        var g = document.getElementById('productos'); if (!g) return;
        var tope = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--barra'), 10) || 52;
        window.scrollTo({ top: g.getBoundingClientRect().top + window.scrollY - tope - 70, behavior: 'smooth' });
      }, 40);
    }

    // arrastrar para girar; tocar sin mover = abrir la categoría
    var el = renderer.domElement, abajo = null;
    el.style.touchAction = 'pan-y';
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', function (e) {
      abajo = { x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch, movio: false, id: e.pointerId };
      auto = false; yawMeta = null;
      box.querySelectorAll('[data-vista].on').forEach(function (o) { o.classList.remove('on'); });
    });
    el.addEventListener('pointermove', function (e) {
      if (abajo && abajo.id === e.pointerId) {
        var dx = e.clientX - abajo.x, dy = e.clientY - abajo.y;
        if (!abajo.movio && Math.hypot(dx, dy) > 6) { abajo.movio = true; try { el.setPointerCapture(e.pointerId); } catch (er) {} mostrarTip(null); }
        if (abajo.movio) {
          yaw = abajo.yaw + dx * 0.011;
          if (e.pointerType === 'mouse') pitch = Math.min(0.75, Math.max(0.06, abajo.pitch + dy * 0.004));
          dibujar();
        }
        return;
      }
      if (e.pointerType === 'mouse') { var c = catEn(e.clientX, e.clientY); resaltar(c); mostrarTip(c, e.clientX, e.clientY); }
    });
    function soltar(e) {
      if (!abajo || abajo.id !== e.pointerId) return;
      var fue = abajo; abajo = null;
      if (fue.movio || e.type === 'pointercancel') return;
      var c = catEn(e.clientX, e.clientY);
      if (!c) { resaltar(null); mostrarTip(null); return; }
      resaltar(c);
      if (!cuenta(c)) { mostrarTip(c, e.clientX, e.clientY); return; }
      mostrarTip(c, e.clientX, e.clientY, '<b>' + (NOM[c] || c) + '</b><span>Abriendo…</span>');
      setTimeout(function () { resaltar(null); mostrarTip(null); abrir(c); }, 320);
    }
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !abajo) { resaltar(null); mostrarTip(null); } });

    box.querySelectorAll('[data-vista]').forEach(function (b) {
      b.addEventListener('click', function () {
        auto = false;
        var meta = VISTAS[b.getAttribute('data-vista')];
        // el giro más corto hasta la vista pedida
        var d = ((meta - yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        yawMeta = yaw + d; dibujar();
        box.querySelectorAll('[data-vista]').forEach(function (o) { o.classList.toggle('on', o === b); });
      });
    });

    // dibuja solo cuando hace falta (ahorra batería)
    var pendiente = false;
    function dibujar() { if (!pendiente) { pendiente = true; requestAnimationFrame(cuadro); } }
    function cuadro() {
      pendiente = false;
      if (!visible || box.hidden) return;
      var sigue = false;
      if (auto) { yaw += 0.0035; sigue = true; }
      if (yawMeta != null) {
        yaw += (yawMeta - yaw) * 0.14;
        if (Math.abs(yawMeta - yaw) < 0.002) { yaw = yawMeta; yawMeta = null; } else sigue = true;
      }
      colocarCamara();
      renderer.render(scene, camera);
      if (sigue) dibujar();
    }
    pedirRender = function () { ajustar(); dibujar(); };
    if (window.ResizeObserver) new ResizeObserver(ajustar).observe(stage); else window.addEventListener('resize', ajustar);
    listo = true;
    ajustar();
    window.rbCarro3D = { vista: function (v) { auto = false; yawMeta = VISTAS[v]; dibujar(); }, partes: partes, catEn: catEn };
  }
})();
