/* Rastro Búnker · vehículos 3D para elegir la categoría (2026-11-24)
   SUV, sedán, pickup y camión. El cliente toca una pieza (faro, defensa, puerta…) y se abre esa categoría.
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
    'Defensa Trasera Inferior': 'Defensas traseras inferiores', 'Tapa de Baúl': 'Tapas de baúl', 'Cover de Vagón': 'Covers de vagón (bedliner)'
  };
  function cuenta(cat) {
    try { return productos.filter(function (p) { return !p.vendido && p.categoria === cat; }).length; } catch (e) { return 0; }
  }
  function guardado() { try { return localStorage.getItem('rb3dTipo'); } catch (e) { return null; } }
  function guardar(t) { try { localStorage.setItem('rb3dTipo', t); } catch (e) {} }

  var visible = false, iniciado = false, pedirRender = null;
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
    var T = window.THREE, PI = Math.PI;
    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { box.remove(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    stage.insertBefore(renderer.domElement, stage.firstChild);
    if (cargando) cargando.remove();

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    scene.add(new T.HemisphereLight(0xeaf2ff, 0x6b5240, 0.85));
    var sol = new T.DirectionalLight(0xffffff, 1.1); sol.position.set(4, 7, 5); scene.add(sol);
    var rel = new T.DirectionalLight(0xbfd4ff, 0.6); rel.position.set(-5, 3, -4); scene.add(rel);
    var mundo = new T.Group(); scene.add(mundo);   // gira con el dedo; adentro va el vehículo

    // ---------- materiales (colores en sRGB) ----------
    function mat(o) { var m = new T.MeshStandardMaterial(o); m.color.convertSRGBToLinear(); m.emissive.convertSRGBToLinear(); return m; }
    var C = {
      carro: function () { return mat({ color: 0xeceef1, metalness: 0.22, roughness: 0.26 }); },
      negroBrillo: function () { return mat({ color: 0x111316, metalness: 0.35, roughness: 0.16 }); },
      rin: function () { return mat({ color: 0x3a3d42, metalness: 0.6, roughness: 0.3 }); },
      caja: function () { return mat({ color: 0xc9ced5, metalness: 0.1, roughness: 0.55 }); },
      plastico: function () { return mat({ color: 0x222326, roughness: 0.85 }); },
      vidrio: function () { return mat({ color: 0x27323e, metalness: 0.4, roughness: 0.06, transparent: true, opacity: 0.92 }); },
      faro: function () { return mat({ color: 0xeef3f8, emissive: 0x9fb4c8, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.15 }); },
      stop: function () { return mat({ color: 0xb0001c, emissive: 0x6a0010, emissiveIntensity: 0.55, roughness: 0.25 }); },
      cromo: function () { return mat({ color: 0xd3d7dc, metalness: 0.7, roughness: 0.25 }); },
      acero: function () { return mat({ color: 0x8d939a, metalness: 0.5, roughness: 0.4 }); },
      llanta: function () { return mat({ color: 0x18181a, roughness: 0.92 }); },
      interior: function () { return mat({ color: 0x141416, roughness: 1, side: T.BackSide }); },
      guarda: function () { return mat({ color: 0x2a2c30, roughness: 0.8, side: T.DoubleSide }); }
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
    function extruir(shape, grosor, bevel) {
      return new T.ExtrudeGeometry(shape, { depth: grosor, bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 2, curveSegments: 8 });
    }
    function poligono(pts) {
      var s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]);
      for (var k = 1; k < pts.length; k++) s.lineTo(pts[k][0], pts[k][1]);
      return s;
    }
    function radial(paradas) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 256;
      var g = cv.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      paradas.forEach(function (p) { gr.addColorStop(p[0], p[1]); });
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      var t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; return t;
    }

    // plataforma iluminada (como en la pantalla del carro): no gira
    var plat = new T.Mesh(new T.CircleGeometry(1, 64), new T.MeshBasicMaterial({ transparent: true, depthWrite: false,
      map: radial([[0, 'rgba(240,214,186,0.95)'], [0.55, 'rgba(201,158,120,0.75)'], [0.86, 'rgba(150,108,78,0.35)'], [0.95, 'rgba(255,226,196,0.55)'], [1, 'rgba(255,226,196,0)']]) }));
    plat.rotation.x = -PI / 2; plat.position.y = 0.001; scene.add(plat);
    var texSombra = radial([[0, 'rgba(40,24,14,0.6)'], [0.6, 'rgba(40,24,14,0.25)'], [1, 'rgba(40,24,14,0)']]);

    // ---------- kit de piezas para armar cada vehículo ----------
    // P: medidas del vehículo (W = mitad del ancho, piso = parte baja de la carrocería, cint = línea de cintura,
    //    R = radio de llanta, ra = radio del hueco de la rueda, wf / wr = posición de las ruedas)
    function kit(G, partes, P) {
      var K = {};
      K.pieza = function (geo, material, cat, x, y, z) {
        var m = new T.Mesh(geo, material);
        m.position.set(x || 0, y || 0, z || 0);
        if (cat) { m.userData.cat = cat; partes.push(m); }
        G.add(m); return m;
      };
      K.ambos = function (fn) { fn(1); fn(-1); };
      // perfil lateral con hueco para la rueda (si wx no es null)
      K.perfil = function (x0, x1, yi, yd, wx) {
        function yb(x) {
          if (wx != null && Math.abs(x - wx) < P.ra) return Math.max(P.piso, P.R + Math.sqrt(P.ra * P.ra - (x - wx) * (x - wx)));
          return P.piso;
        }
        var s = new T.Shape(); s.moveTo(x0, yi); s.lineTo(x1, yd);
        for (var x = x1; x > x0; x -= 0.015) s.lineTo(x, yb(x));
        s.lineTo(x0, yb(x0));
        return s;
      };
      K.lateral = function (shape, cat, matf, grosor) {
        grosor = grosor || 0.06;
        var g = extruir(shape, grosor, 0.012);
        K.ambos(function (s) { var m = K.pieza(g, matf(), cat); m.position.z = s > 0 ? P.W - grosor - 0.012 : -P.W + 0.012; });
      };
      // cuerpo que no se vende (relleno) y cabina
      K.relleno = function (x0, x1, y0, y1, ancho, matf) {
        K.pieza(caja(x1 - x0, y1 - y0, ancho, 0.08), (matf || C.carro)(), null, (x0 + x1) / 2, (y0 + y1) / 2, 0);
      };
      K.cabina = function (shape, ancho, matf) {
        var g = extruir(shape, ancho, 0.05); g.translate(0, 0, -ancho / 2);
        K.pieza(g, (matf || C.carro)(), null);
      };
      K.ventanas = function (lista, z) {
        lista.forEach(function (pts) {
          var g = extruir(poligono(pts), 0.012, 0);
          K.ambos(function (s) { K.pieza(g, C.vidrio(), 'Vidrio', 0, 0, s > 0 ? z : -z - 0.012); });
        });
      };
      // vidrio plano entre dos puntos del perfil (parabrisas, vidrio trasero), hacia afuera de la cabina
      K.vidrio = function (a, b, ancho, centro, salida) {
        salida = salida || 0.06;
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        var nx = -dy / L, ny = dx / L;
        if ((mx - centro[0]) * nx + (my - centro[1]) * ny < 0) { nx = -nx; ny = -ny; }
        var m = K.pieza(caja(L, 0.015, ancho, 0.06, 0.004), C.vidrio(), 'Vidrio', mx + nx * salida, my + ny * salida, 0);
        m.rotation.z = Math.atan2(dy, dx); return m;
      };
      // ruedas con copa, y opcionalmente flare, cubrepolvo y llanta doble (camión)
      K.ruedas = function (wx, z, o) {
        o = o || {};
        var R = P.R, tubo = R * (o.perfil || 0.27), rr = R - tubo, nr = o.rayos || 5;
        K.ambos(function (s) {
          var tz = s * z;
          K.pieza(new T.TorusGeometry(rr, tubo, 14, 36), C.llanta(), 'Copa', wx, R, tz);
          if (o.doble) K.pieza(new T.TorusGeometry(rr, tubo, 14, 36), C.llanta(), 'Copa', wx, R, tz - s * tubo * 2.1);
          var copa = K.pieza(new T.CylinderGeometry(rr * 0.92, rr * 0.92, 0.05, 30), (o.rin || (o.acero ? C.acero : C.cromo))(), 'Copa', wx, R, tz + s * tubo * 0.65);
          copa.rotation.x = PI / 2;
          for (var r = 0; r < nr; r++) {
            var ry = K.pieza(caja(rr * 0.85, nr > 5 ? 0.028 : 0.035, 0.02, 0.01), (o.rayo || C.plastico)(), 'Copa', wx, R, tz + s * (tubo * 0.65 + 0.03));
            ry.rotation.z = r * PI * 2 / nr; ry.translateX(rr * 0.45);
          }
          if (o.flare) {
            var fl = K.pieza(new T.TorusGeometry(P.ra + 0.01, o.flareGrueso || 0.04, 8, 30, PI + 0.34), C.plastico(), 'Flare', wx, R, s * (P.W + 0.005));
            fl.rotation.z = -0.17;
          }
          if (o.cubre !== false) {
            var cp = K.pieza(new T.CylinderGeometry(P.ra - 0.02, P.ra - 0.02, 0.22, 24, 1, true, PI / 2 - 0.2, PI + 0.4), C.interior(), 'Cubrepolvo', wx, R, s * (P.W - 0.16));
            cp.rotation.x = PI / 2;
          }
        });
      };
      K.sombra = function (largo, ancho) {
        var m = new T.Mesh(new T.PlaneGeometry(largo, ancho), new T.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }));
        m.rotation.x = -PI / 2; m.position.y = 0.003; G.add(m);
      };
      // frente de un carro: defensa, capó, parrilla, faros y halógenas
      K.frente = function (o) {
        var W = P.W, xf = o.xf;
        K.pieza(caja(0.16, o.narizAlto || 0.26, 2 * W - 0.3, 0.03), C.plastico(), null, xf - 0.24, o.faroY - 0.02, 0);
        K.pieza(caja(0.32, o.defAlto, 2 * W, 0.12), (o.defMat || C.carro)(), 'Defensa Delantera', xf - 0.16, P.piso + o.defAlto / 2, 0);
        K.pieza(caja(0.24, 0.07, 2 * W - 0.24, 0.03), C.plastico(), 'Defensa Delantera Inferior', xf - 0.1, P.piso - 0.03, 0);
        var L = (xf - 0.14) - o.capoX;
        var capo = K.pieza(caja(L, 0.05, 2 * W - 0.14, 0.03), C.carro(), 'Capó', o.capoX + L / 2, (o.capoY0 + o.capoY1) / 2, 0);
        capo.rotation.z = Math.atan2(o.capoY1 - o.capoY0, L);
        var parr = new T.Group(); parr.position.set(xf - 0.14, o.parrY, 0); G.add(parr);
        parr.add(new T.Mesh(caja(0.05, o.parrAlto, o.parrAncho, 0.05), C.plastico()));
        var n = Math.max(3, Math.round(o.parrAlto / 0.05));
        for (var i = 0; i < n; i++) {
          var barra = new T.Mesh(caja(0.03, 0.022, o.parrAncho - 0.06, 0.01), C.cromo());
          barra.position.set(0.025, -o.parrAlto / 2 + 0.035 + i * (o.parrAlto - 0.07) / (n - 1), 0); parr.add(barra);
        }
        parr.children.forEach(function (m) { m.userData.cat = 'Parrilla'; partes.push(m); });
        K.ambos(function (s) {
          var f = K.pieza(caja(0.14, o.faroAlto || 0.12, 0.36 * W / 0.9, 0.04), C.faro(), 'Lámpara Delantera', xf - 0.17, o.faroY, s * o.faroZ);
          f.rotation.y = s * 0.12;
          K.pieza(caja(0.04, 0.15, 0.27, 0.06), C.plastico(), 'Cover de Alógena', xf - 0.005, P.piso + 0.12, s * 0.6 * W / 0.9);
          var h = K.pieza(new T.CylinderGeometry(0.052, 0.052, 0.03, 20), C.faro(), 'Halógenas / Faros antiniebla', xf + 0.015, P.piso + 0.12, s * 0.6 * W / 0.9);
          h.rotation.z = PI / 2;
        });
      };
      // atrás: defensa, parte inferior y stops
      K.trasera = function (o) {
        var W = P.W, dl = o.defLargo || 0.32;
        K.pieza(caja(dl, o.defAlto, 2 * W, 0.12), (o.defMat || C.carro)(), 'Defensa Trasera', -(o.xr - dl / 2), P.piso + (o.defY || 0) + o.defAlto / 2, 0);
        if (o.labio !== false) K.pieza(caja(0.24, 0.07, 2 * W - 0.3, 0.03), C.plastico(), 'Defensa Trasera Inferior', -(o.xr - 0.12), P.piso - 0.03, 0);
        K.ambos(function (s) { K.pieza(caja(o.stop[0], o.stop[1], o.stop[2], 0.04), C.stop(), 'Lámpara Trasera', -o.stopX, o.stopY, s * o.stopZ); });
      };
      // costados de un carro: guardafangos, puertas, molduras, manijas, retrovisores y estribo
      K.costado = function (o) {
        var W = P.W;
        K.lateral(K.perfil(o.guarda0, o.xf - 0.29, P.cint, P.cint - (o.caida || 0.07), P.wf), 'Guardafango', C.carro);
        var puertas = [o.del].concat(o.tra ? [o.tra] : []);
        puertas.forEach(function (d) { K.lateral(K.perfil(d[0], d[1], P.cint, P.cint, null), 'Puerta', C.carro); });
        if (o.cuarto != null) K.lateral(K.perfil(-(o.xr - 0.29), o.cuarto, P.cint, P.cint, P.wr), 'Guardafango Trasero', C.carro);
        K.ambos(function (s) {
          K.pieza(caja(0.1, 0.05, 0.1, 0.02), C.plastico(), 'Retrovisor', o.retroX + 0.02, P.cint + 0.05, s * (W - 0.04));
          K.pieza(caja(0.2, 0.13, 0.15, 0.04), C.carro(), 'Retrovisor', o.retroX, P.cint + 0.09, s * (W + 0.07));
          puertas.forEach(function (d) {
            K.pieza(caja(d[1] - d[0] - 0.03, o.moldAlto || 0.045, 0.025, 0.02), C.plastico(), 'Moldura de Puerta', (d[0] + d[1]) / 2, P.piso + (o.moldY || 0.24), s * (W + 0.005));
            K.pieza(caja(0.14, 0.03, 0.03, 0.01), C.cromo(), 'Puerta', d[0] + 0.24, P.cint - 0.13, s * (W + 0.005));
          });
          if (o.estribo) {
            var e0 = puertas[puertas.length - 1][0], e1 = o.del[1];
            K.pieza(caja(e1 - e0 - 0.1, 0.05, 0.16, 0.02), C.plastico(), 'Estribo', (e0 + e1) / 2, P.piso - 0.01, s * (W + 0.05));
          }
        });
      };
      return K;
    }

    // ---------- los cuatro vehículos ----------
    // cada uno arma su grupo y devuelve cómo encuadrarlo: cx (centro en X), ty (altura a mirar), rx / ry (medidas para que quepa)
    var VEHICULOS = {
      suv: function (G, partes) {
        // SUV coupé: techo que cae hacia atrás, techo panorámico oscuro, faros delgados,
        // tomas de aire a los lados, parrilla abajo y barra de luz trasera de lado a lado
        var P = { W: 0.93, piso: 0.32, cint: 1.0, R: 0.38, ra: 0.47, wf: 1.42, wr: -1.4 }, K = kit(G, partes, P), W = P.W;
        K.relleno(-2.0, 2.0, 0.34, 0.99, 1.3);
        var cab = new T.Shape();
        cab.moveTo(1.0, 0.99); cab.lineTo(0.3, 1.45);
        cab.splineThru([new T.Vector2(0.12, 1.51), new T.Vector2(-0.25, 1.535), new T.Vector2(-0.8, 1.5), new T.Vector2(-1.4, 1.36), new T.Vector2(-1.78, 1.2)]);
        cab.lineTo(-1.96, 1.12); cab.lineTo(-2.0, 1.04); cab.lineTo(-2.0, 0.99);
        K.cabina(cab, 2 * (W - 0.17), C.negroBrillo);   // pilares y techo negro brillante
        var zv = W - 0.17 + 0.056;
        K.ventanas([[[0.9, 1.05], [0.36, 1.41], [0.12, 1.47], [-0.02, 1.48], [-0.02, 1.05]],
                    [[-0.08, 1.05], [-0.08, 1.48], [-0.9, 1.45], [-0.9, 1.05]],
                    [[-0.96, 1.05], [-0.96, 1.44], [-1.25, 1.36], [-1.55, 1.08]]], zv);
        K.vidrio([1.0, 0.99], [0.3, 1.45], 1.42, [-0.5, 1.1]);
        K.vidrio([0.12, 1.51], [-0.84, 1.5], 1.12, [-0.5, 1.1], 0.1);    // techo panorámico
        K.vidrio([-1.78, 1.2], [-1.4, 1.36], 1.22, [-0.5, 1.1]);         // vidrio trasero

        // costados: guardafangos, puertas con moldura negra abajo, retrovisores
        K.costado({ xf: 2.3, xr: 2.3, guarda0: 0.95, caida: 0.1, del: [-0.005, 0.94], tra: [-0.92, -0.02], cuarto: -0.93, retroX: 0.9, moldY: 0.08, moldAlto: 0.12 });

        // frente
        var capo = K.pieza(caja(1.18, 0.05, 2 * W - 0.16, 0.03), C.carro(), 'Capó', 1.56, 0.93, 0);
        capo.rotation.z = Math.atan2(-0.13, 1.18);
        K.pieza(caja(0.36, 0.52, 2 * W, 0.16), C.carro(), 'Defensa Delantera', 2.12, 0.58, 0);
        K.pieza(caja(0.22, 0.06, 2 * W - 0.26, 0.03), C.plastico(), 'Defensa Delantera Inferior', 2.2, 0.3, 0);
        var parr = new T.Group(); parr.position.set(2.29, 0.5, 0); G.add(parr);
        parr.add(new T.Mesh(caja(0.05, 0.2, 1.0, 0.06), C.plastico()));
        for (var i = 0; i < 3; i++) { var bp = new T.Mesh(caja(0.03, 0.018, 0.94, 0.008), C.rin()); bp.position.set(0.02, -0.06 + i * 0.06, 0); parr.add(bp); }
        parr.children.forEach(function (m) { m.userData.cat = 'Parrilla'; partes.push(m); });
        K.ambos(function (s) {
          var f = K.pieza(caja(0.14, 0.065, 0.42, 0.03), C.faro(), 'Lámpara Delantera', 2.16, 0.84, s * 0.6);
          f.rotation.y = s * 0.18;
          K.pieza(caja(0.05, 0.3, 0.26, 0.05), C.plastico(), 'Cover de Alógena', 2.285, 0.6, s * 0.67);
          K.pieza(caja(0.02, 0.1, 0.13, 0.02), C.faro(), 'Halógenas / Faros antiniebla', 2.315, 0.66, s * 0.67);
        });

        // atrás: compuerta con alerón, barra de luz completa, defensa y difusor
        K.pieza(caja(0.08, 0.34, 1.46, 0.04), C.carro(), 'Tapa de Baúl', -2.04, 0.98, 0);
        K.pieza(caja(0.12, 0.03, 1.3, 0.01), C.plastico(), 'Tapa de Baúl', -1.97, 1.14, 0);
        K.pieza(caja(0.05, 0.045, 1.46, 0.02), C.stop(), 'Lámpara Trasera', -2.085, 1.06, 0);
        K.ambos(function (s) { var st = K.pieza(caja(0.08, 0.07, 0.26, 0.03), C.stop(), 'Lámpara Trasera', -2.06, 1.06, s * 0.76); st.rotation.y = -s * 0.25; });
        K.pieza(caja(0.34, 0.48, 2 * W, 0.16), C.carro(), 'Defensa Trasera', -2.13, 0.56, 0);
        K.pieza(caja(0.24, 0.08, 1.5, 0.03), C.plastico(), 'Defensa Trasera Inferior', -2.18, 0.3, 0);

        // rines grandes de dos tonos, llanta de perfil bajo y arcos negros
        var ro = { flare: true, flareGrueso: 0.028, perfil: 0.19, rayos: 10, rin: C.rin, rayo: C.cromo };
        K.ruedas(P.wf, 0.8, ro); K.ruedas(P.wr, 0.8, ro);
        K.sombra(5.4, 2.5);
        return { cx: 0, ty: 0.62, rx: 3.0, ry: 1.9 };
      },
      sedan: function (G, partes) {
        var P = { W: 0.88, piso: 0.27, cint: 0.9, R: 0.32, ra: 0.41, wf: 1.4, wr: -1.42 }, K = kit(G, partes, P);
        K.relleno(-2.0, 2.0, 0.28, 0.89, 1.22);
        K.cabina(poligono([[0.8, 0.89], [0.02, 1.36], [-0.1, 1.4], [-0.22, 1.4], [-0.98, 1.4], [-1.12, 1.39], [-1.2, 1.33], [-1.56, 0.92], [-1.62, 0.89]]), 1.46);
        K.frente({ xf: 2.3, capoX: 0.8, capoY0: 0.91, capoY1: 0.83, defAlto: 0.4, parrY: 0.69, parrAlto: 0.13, parrAncho: 0.72, faroY: 0.75, faroZ: 0.6, faroAlto: 0.1, narizAlto: 0.2 });
        K.costado({ xf: 2.3, xr: 2.3, guarda0: 0.945, caida: 0.08, del: [-0.005, 0.935], tra: [-0.93, -0.02], cuarto: -0.945, retroX: 0.72 });
        K.ventanas([[[0.72, 0.93], [0.08, 1.33], [-0.02, 1.35], [-0.02, 0.93]],
                    [[-0.06, 0.93], [-0.06, 1.35], [-0.98, 1.35], [-0.98, 0.93]],
                    [[-1.03, 0.93], [-1.03, 1.33], [-1.13, 1.33], [-1.46, 0.93]]], 0.88 - 0.094);
        K.vidrio([0.8, 0.89], [0.04, 1.35], 1.32, [-0.4, 1.0]);
        K.vidrio([-1.56, 0.92], [-1.18, 1.35], 1.2, [-0.4, 1.0]);
        // tapa de baúl (horizontal, típica de sedán)
        var tb = K.pieza(caja(0.6, 0.05, 1.6, 0.03), C.carro(), 'Tapa de Baúl', -1.88, 0.915, 0);
        tb.rotation.z = 0.04;
        K.trasera({ xr: 2.3, defAlto: 0.4, stop: [0.07, 0.11, 0.42], stopX: 2.11, stopY: 0.79, stopZ: 0.6 });
        K.ruedas(P.wf, 0.75); K.ruedas(P.wr, 0.75);
        K.sombra(5.4, 2.4);
        return { cx: 0, ty: 0.55, rx: 3.0, ry: 1.75 };
      },
      pickup: function (G, partes) {
        var P = { W: 0.95, piso: 0.46, cint: 1.16, R: 0.42, ra: 0.52, wf: 1.78, wr: -1.72 }, K = kit(G, partes, P);
        K.relleno(-0.98, 2.32, 0.48, 1.15, 1.36);
        K.cabina(poligono([[1.0, 1.15], [0.38, 1.74], [0.26, 1.785], [0.12, 1.79], [-0.82, 1.79], [-0.93, 1.78], [-0.96, 1.72], [-0.98, 1.15]]), 1.6);
        K.frente({ xf: 2.62, capoX: 1.0, capoY0: 1.18, capoY1: 1.13, defAlto: 0.4, defMat: C.cromo, parrY: 0.98, parrAlto: 0.3, parrAncho: 1.0, faroY: 1.0, faroZ: 0.68, faroAlto: 0.14, narizAlto: 0.32 });
        K.costado({ xf: 2.62, xr: 2.62, guarda0: 1.01, caida: 0.04, del: [0.0, 1.0], tra: [-0.96, -0.03], retroX: 0.92, estribo: true });
        K.ventanas([[[0.93, 1.2], [0.44, 1.7], [0.03, 1.72], [0.03, 1.2]],
                    [[-0.04, 1.2], [-0.04, 1.72], [-0.86, 1.72], [-0.86, 1.2]]], 0.95 - 0.094);
        K.vidrio([1.0, 1.15], [0.4, 1.73], 1.42, [0, 1.4]);
        K.pieza(caja(0.015, 0.38, 1.1, 0.05, 0.004), C.vidrio(), 'Vidrio', -1.045, 1.47, 0);
        // vagón: costados (guardafango trasero), bedliner y compuerta
        K.lateral(K.perfil(-2.5, -1.02, P.cint, P.cint, P.wr), 'Guardafango Trasero', C.carro);
        K.pieza(caja(1.46, 0.05, 1.7, 0.02), C.plastico(), 'Cover de Vagón', -1.76, 0.86, 0);
        K.pieza(caja(0.05, 0.3, 1.7, 0.02), C.plastico(), 'Cover de Vagón', -1.05, 1.0, 0);
        K.ambos(function (s) { K.pieza(caja(1.46, 0.3, 0.03, 0.01), C.plastico(), 'Cover de Vagón', -1.76, 1.0, s * 0.84); });
        K.pieza(caja(0.07, 0.66, 1.56, 0.04), C.carro(), 'Tapa de Baúl', -2.55, 0.83, 0);
        K.pieza(caja(0.03, 0.04, 0.26, 0.01), C.cromo(), 'Tapa de Baúl', -2.59, 1.04, 0);
        K.trasera({ xr: 2.78, defLargo: 0.24, defAlto: 0.22, defY: 0.0, defMat: C.cromo, labio: false, stop: [0.08, 0.34, 0.12], stopX: 2.56, stopY: 0.95, stopZ: 0.86 });
        K.ruedas(P.wf, 0.81, { flare: true }); K.ruedas(P.wr, 0.81, { flare: true });
        K.sombra(6.0, 2.7);
        return { cx: -0.08, ty: 0.8, rx: 3.35, ry: 2.15 };
      },
      camion: function (G, partes) {
        var P = { W: 1.05, piso: 0.8, cint: 2.0, R: 0.46, ra: 0.58, wf: 2.05, wr: -1.55 }, K = kit(G, partes, P), W = P.W;
        // chasis y caja de carga (no se venden)
        K.ambos(function (s) { K.pieza(caja(5.7, 0.2, 0.14, 0.02), C.plastico(), null, -0.25, 0.78, s * 0.42); });
        K.pieza(caja(4.15, 2.0, 2 * W + 0.1, 0.05), C.caja(), null, -0.87, 2.0, 0);
        K.pieza(caja(0.1, 0.16, 2 * W, 0.02), C.plastico(), null, -2.95, 0.86, 0);
        // cabina
        K.pieza(caja(1.55, 1.75, 2 * W - 0.04, 0.12), C.carro(), null, 2.1, 1.875, 0);
        var pb = K.pieza(caja(0.03, 0.62, 1.8, 0.06, 0.006), C.vidrio(), 'Vidrio', 2.89, 2.3, 0); pb.rotation.z = 0.05;
        var parr = new T.Group(); parr.position.set(2.89, 1.55, 0); G.add(parr);
        parr.add(new T.Mesh(caja(0.04, 0.36, 1.2, 0.04), C.plastico()));
        for (var i = 0; i < 5; i++) { var b = new T.Mesh(caja(0.03, 0.03, 1.12, 0.01), C.cromo()); b.position.set(0.02, -0.13 + i * 0.065, 0); parr.add(b); }
        parr.children.forEach(function (m) { m.userData.cat = 'Parrilla'; partes.push(m); });
        K.pieza(caja(0.26, 0.34, 2 * W + 0.04, 0.08), C.plastico(), 'Defensa Delantera', 2.93, 0.92, 0);
        K.ambos(function (s) {
          K.pieza(caja(0.08, 0.16, 0.36, 0.04), C.faro(), 'Lámpara Delantera', 2.895, 1.18, s * 0.72);
          K.pieza(caja(0.03, 0.16, 0.28, 0.05), C.plastico(), 'Cover de Alógena', 3.06, 0.9, s * 0.78);
          var h = K.pieza(new T.CylinderGeometry(0.055, 0.055, 0.03, 20), C.faro(), 'Halógenas / Faros antiniebla', 3.08, 0.9, s * 0.78); h.rotation.z = PI / 2;
          // puerta con su vidrio
          var gp = extruir(poligono([[1.42, 1.08], [2.62, 1.08], [2.62, 2.62], [1.42, 2.62]]), 0.03, 0.008);
          K.pieza(gp, C.carro(), 'Puerta', 0, 0, s > 0 ? W - 0.02 : -W - 0.01);
          var gv = extruir(poligono([[1.5, 1.82], [2.55, 1.82], [2.55, 2.52], [1.5, 2.52]]), 0.01, 0);
          K.pieza(gv, C.vidrio(), 'Vidrio', 0, 0, s > 0 ? W + 0.02 : -W - 0.03);
          K.pieza(caja(0.16, 0.035, 0.03, 0.01), C.cromo(), 'Puerta', 1.62, 1.7, s * (W + 0.03));
          // guardafango sobre la rueda delantera
          var gf = K.pieza(new T.CylinderGeometry(0.6, 0.6, 0.34, 26, 1, true, PI / 2 - 0.12, PI + 0.24), C.guarda(), 'Guardafango', P.wf, P.R, s * (W - 0.2));
          gf.rotation.x = PI / 2;
          // estribos para subir
          K.pieza(caja(0.34, 0.05, 0.26, 0.02), C.acero(), 'Estribo', 1.25, 0.72, s * (W - 0.1));
          K.pieza(caja(0.34, 0.05, 0.26, 0.02), C.acero(), 'Estribo', 1.25, 0.46, s * (W - 0.1));
          // retrovisor grande con brazo
          K.pieza(caja(0.04, 0.04, 0.32, 0.01), C.plastico(), 'Retrovisor', 2.7, 2.28, s * (W + 0.14));
          K.pieza(caja(0.08, 0.42, 0.16, 0.04), C.plastico(), 'Retrovisor', 2.7, 2.06, s * (W + 0.3));
          // atrás: barra antiempotramiento y stops
          K.pieza(caja(0.06, 0.35, 0.06, 0.01), C.plastico(), 'Defensa Trasera', -2.98, 0.75, s * 0.6);
          K.pieza(caja(0.05, 0.12, 0.26, 0.03), C.stop(), 'Lámpara Trasera', -3.02, 0.86, s * 0.78);
        });
        K.pieza(caja(0.1, 0.1, 1.9, 0.02), C.plastico(), 'Defensa Trasera', -3.0, 0.55, 0);
        K.ruedas(P.wf, W - 0.2, { acero: true, cubre: false });
        K.ruedas(P.wr, W - 0.19, { acero: true, cubre: false, doble: true });
        K.sombra(6.8, 2.9);
        return { cx: 0.0, ty: 1.25, rx: 3.75, ry: 2.85 };
      }
    };

    // ---------- armar / cambiar de vehículo ----------
    var veh = null, partes = [], info = null, tipoActual = null, marcada = null;
    function liberar(obj) {
      obj.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
    }
    function cambiar(tipo) {
      if (!VEHICULOS[tipo]) tipo = 'suv';
      if (tipo === tipoActual) return;
      if (veh) { mundo.remove(veh); liberar(veh); }
      veh = new T.Group(); partes = []; marcada = null;
      info = VEHICULOS[tipo](veh, partes);
      veh.position.x = -info.cx;
      partes.forEach(function (m) {
        m.userData.em = m.material.emissive.getHex(); m.userData.ei = m.material.emissiveIntensity; m.userData.col = m.material.color.clone();
      });
      mundo.add(veh);
      plat.scale.setScalar(info.rx - 0.05);
      tipoActual = tipo; guardar(tipo);
      box.querySelectorAll('[data-tipo]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tipo') === tipo); });
      mostrarTip(null); ajustar();
    }

    // ---------- cámara, giro y resaltado ----------
    var VISTAS = { frente: -PI / 2 + 0.25, lado: 0, atras: PI / 2 - 0.25, inicio: -0.62 };
    var yaw = VISTAS.inicio, yawMeta = null, pitch = 0.36, auto = true, dist = 8;
    var rc = new T.Raycaster(), pv = new T.Vector2();

    function ajustar() {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || !info) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var vf = camera.fov * PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      dist = Math.max(info.rx / Math.sin(hf / 2), info.ry / Math.sin(vf / 2));
      camera.updateProjectionMatrix(); dibujar();
    }
    function colocarCamara() {
      camera.position.set(0, info.ty + 0.1 + dist * Math.sin(pitch), dist * Math.cos(pitch));
      camera.lookAt(0, info.ty, 0);
      mundo.rotation.y = yaw;
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
      colocarCamara(); mundo.updateMatrixWorld(true);
      rc.setFromCamera(pv, camera);
      var hit = rc.intersectObjects(partes, false)[0];
      return hit ? hit.object.userData.cat : null;
    }
    function mostrarTip(cat, x, y, texto) {
      if (!cat) { tip.classList.remove('on'); return; }
      var n = cuenta(cat);
      tip.innerHTML = texto || ('<b>' + (NOM[cat] || cat) + '</b><span>' + (n ? n + ' disponible' + (n !== 1 ? 's' : '') : 'Sin piezas ahora') + '</span>');
      var r = stage.getBoundingClientRect();
      var tx = Math.min(Math.max(x - r.left, 80), r.width - 80), ty = Math.max(y - r.top - 14, 44);
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
    function quitarVista() { box.querySelectorAll('[data-vista].on').forEach(function (o) { o.classList.remove('on'); }); }
    el.addEventListener('pointerdown', function (e) {
      abajo = { x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch, movio: false, id: e.pointerId };
      auto = false; yawMeta = null; quitarVista();
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

    function irAVista(v, boton) {
      auto = false;
      var meta = VISTAS[v];
      var d = ((meta - yaw) % (2 * PI) + 3 * PI) % (2 * PI) - PI;   // el giro más corto
      yawMeta = yaw + d; dibujar();
      box.querySelectorAll('[data-vista]').forEach(function (o) { o.classList.toggle('on', o === boton); });
    }
    box.querySelectorAll('[data-vista]').forEach(function (b) {
      b.addEventListener('click', function () { irAVista(b.getAttribute('data-vista'), b); });
    });
    box.querySelectorAll('[data-tipo]').forEach(function (b) {
      b.addEventListener('click', function () { cambiar(b.getAttribute('data-tipo')); });
    });

    // dibuja solo cuando hace falta (ahorra batería)
    var pendiente = false;
    function dibujar() { if (!pendiente) { pendiente = true; requestAnimationFrame(cuadro); } }
    function cuadro() {
      pendiente = false;
      if (!visible || box.hidden || !info) return;
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
    cambiar(guardado() || 'suv');
    window.rbCarro3D = {
      vista: function (v) { irAVista(v, null); },
      tipo: cambiar,
      partes: function () { return partes; },
      catEn: catEn
    };
  }
})();
