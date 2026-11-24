/* Rastro Búnker · SUV 3D para elegir la categoría (2026-11-24)
   El cliente toca una pieza (faro, defensa, puerta…) y se abre esa categoría del catálogo.
   La carrocería es una sola superficie con curvas; cada pieza se recorta de ella, así quedan
   las líneas entre piezas como en un carro real. Sin logos ni diseño de ninguna marca.
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
    'Retrovisor': 'Retrovisores', 'Vidrio': 'Vidrios', 'Flare': 'Flares', 'Cubrepolvo': 'Cubrepolvos',
    'Copa': 'Copas de rin', 'Lámpara Trasera': 'Lámparas traseras (stops)', 'Defensa Trasera': 'Defensas traseras',
    'Defensa Trasera Inferior': 'Defensas traseras inferiores', 'Tapa de Baúl': 'Tapas de baúl'
  };
  function cuenta(cat) {
    try { return productos.filter(function (p) { return !p.vendido && p.categoria === cat; }).length; } catch (e) { return 0; }
  }

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
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    stage.insertBefore(renderer.domElement, stage.firstChild);
    if (cargando) cargando.remove();

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(30, 1, 0.1, 100);
    scene.add(new T.HemisphereLight(0xffffff, 0x6b5240, 0.35));
    var sol = new T.DirectionalLight(0xffffff, 0.9); sol.position.set(4, 7, 5); scene.add(sol);
    var rel = new T.DirectionalLight(0xcfe0ff, 0.35); rel.position.set(-5, 3, -4); scene.add(rel);

    // ---------- reflejos de estudio (luces grandes arriba y a los lados) ----------
    (function () {
      var env = new T.Scene();
      var cielo = new T.SphereGeometry(20, 32, 16), pos = cielo.attributes.position, cols = [];
      for (var i = 0; i < pos.count; i++) {
        var y = pos.getY(i) / 20, c = y > 0 ? 0.28 + 0.45 * y : 0.28 - 0.24 * Math.min(1, -y * 1.5);
        cols.push(c, c, c * 1.03);
      }
      cielo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
      env.add(new T.Mesh(cielo, new T.MeshBasicMaterial({ side: T.BackSide, vertexColors: true })));
      function panel(w, h, x, y, z, k) {
        var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(k, k, k), side: T.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
      }
      panel(16, 5, 0, 13, 0, 3.2); panel(12, 2.5, 11, 5, 7, 2.2); panel(12, 2.5, -11, 5, -7, 1.6); panel(8, 2, 0, 3, -13, 1.3); panel(8, 2, 2, 3, 13, 1.1);
      var pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(env, 0.035).texture;
      pm.dispose();
    })();

    var mundo = new T.Group(); scene.add(mundo);   // gira con el dedo
    var G = new T.Group(); mundo.add(G);
    var partes = [];

    // ---------- materiales ----------
    function lin(m) { m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); return m; }
    function std(o) { return lin(new T.MeshStandardMaterial(o)); }
    function fis(o) { return lin(new T.MeshPhysicalMaterial(o)); }
    var M = {
      pintura: function () { return fis({ color: 0xf2f3f5, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, side: T.DoubleSide }); },
      negro: function () { return fis({ color: 0x0f1113, roughness: 0.2, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, side: T.DoubleSide }); },
      plastico: function () { return std({ color: 0x1a1b1e, roughness: 0.62, metalness: 0, side: T.DoubleSide }); },
      hueco: function () { return std({ color: 0x060606, roughness: 1, side: T.DoubleSide }); },
      vidrio: function () { return fis({ color: 0x1b2632, roughness: 0.04, metalness: 0.1, clearcoat: 1, side: T.DoubleSide }); },
      faro: function () { return fis({ color: 0xe9eff6, emissive: 0xbcd4ff, emissiveIntensity: 0.55, roughness: 0.06, clearcoat: 1, side: T.DoubleSide }); },
      stop: function () { return fis({ color: 0x6e000f, emissive: 0xff1030, emissiveIntensity: 0.85, roughness: 0.1, clearcoat: 1, side: T.DoubleSide }); },
      llanta: function () { return std({ color: 0x121315, roughness: 0.86 }); },
      rinCara: function () { return std({ color: 0xc9cdd2, metalness: 0.9, roughness: 0.22 }); },
      rinFondo: function () { return std({ color: 0x2a2d32, metalness: 0.7, roughness: 0.35, side: T.DoubleSide }); },
      disco: function () { return std({ color: 0x8c9096, metalness: 0.9, roughness: 0.42 }); },
      caliper: function () { return std({ color: 0xc8141f, metalness: 0.2, roughness: 0.4 }); },
      cromo: function () { return std({ color: 0xdfe3e8, metalness: 1, roughness: 0.15 }); }
    };

    // cada pieza: id interno -> [categoría (o null si no se vende), material]
    var PIEZA = {
      capo: ['Capó', 'pintura'], defD: ['Defensa Delantera', 'pintura'], defDinf: ['Defensa Delantera Inferior', 'plastico'],
      parrilla: ['Parrilla', 'negro'], toma: ['Cover de Alógena', 'plastico'], halo: ['Halógenas / Faros antiniebla', 'faro'],
      faro: ['Lámpara Delantera', 'faro'], guardaD: ['Guardafango', 'pintura'], puertaD: ['Puerta', 'pintura'], puertaT: ['Puerta', 'pintura'],
      moldD: ['Moldura de Puerta', 'negro'], moldT: ['Moldura de Puerta', 'negro'], guardaT: ['Guardafango Trasero', 'pintura'],
      tapa: ['Tapa de Baúl', 'pintura'], stop: ['Lámpara Trasera', 'stop'], defT: ['Defensa Trasera', 'pintura'], defTinf: ['Defensa Trasera Inferior', 'plastico'],
      cubre: ['Cubrepolvo', 'plastico'], vF: ['Vidrio', 'vidrio'], vTe: ['Vidrio', 'vidrio'], vT: ['Vidrio', 'vidrio'],
      v1: ['Vidrio', 'vidrio'], v2: ['Vidrio', 'vidrio'], v3: ['Vidrio', 'vidrio'],
      pilar: [null, 'negro'], cuerpo: [null, 'pintura'], bajo: [null, 'plastico'], gap: [null, 'hueco']
    };

    function pieza(geo, material, cat) {
      var m = new T.Mesh(geo, material);
      if (cat) { m.userData.cat = cat; partes.push(m); }
      G.add(m); return m;
    }

    // ---------- curvas del perfil ----------
    function curva(pts) {
      var n = pts.length;
      return function (x) {
        if (x <= pts[0][0]) return pts[0][1];
        if (x >= pts[n - 1][0]) return pts[n - 1][1];
        var i = 0; while (x > pts[i + 1][0]) i++;
        var p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n - 1)];
        var dx = p2[0] - p1[0], t = (x - p1[0]) / dx;
        var m1 = p0 === p1 ? p2[1] - p1[1] : (p2[1] - p0[1]) / (p2[0] - p0[0]) * dx;
        var m2 = p3 === p2 ? p2[1] - p1[1] : (p3[1] - p1[1]) / (p3[0] - p1[0]) * dx;
        var t2 = t * t, t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
      };
    }
    function suave(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

    // medidas (metros aprox.): x a lo largo (adelante +), y alto, z ancho
    var W = 0.95, LF = 2.36, LR = 2.34, R = 0.38, RA = 0.45, RUEDAS = [1.42, -1.4], CINT = 0.99;
    var techoC = curva([[-2.34, 0.92], [-2.2, 1.02], [-1.95, 1.04], [-1.6, 1.02], [-1.0, 1.0], [0, 1.0], [1.0, 0.99], [1.5, 0.95], [2.0, 0.9], [2.25, 0.84], [2.36, 0.72]]);
    var pisoC = curva([[-2.34, 0.45], [-2.1, 0.33], [-1.8, 0.3], [1.8, 0.3], [2.1, 0.32], [2.36, 0.42]]);
    var techoV = curva([[-2.02, 0.99], [-2.0, 1.02], [-1.95, 1.1], [-1.78, 1.2], [-1.4, 1.36], [-0.8, 1.5], [-0.25, 1.535], [0.12, 1.51], [0.3, 1.45], [0.95, 1.04], [1.02, 0.99]]);
    function anchoC(x) {
      var x0 = 1.85, e = x > 0 ? LF : LR, d = Math.abs(x);
      if (d <= x0) return W;
      var t = Math.min(1, (d - x0) / (e - x0));
      return Math.max(0.004, W * Math.pow(1 - Math.pow(t, 2.2), 1 / 2.2));
    }

    // ---------- superficie: estaciones a lo largo + anillo de sección ----------
    // seccion(x0) -> mitad del anillo [[z, y, tramo], ...]; ajustar(v) -> posición final; clasificar(v) -> id de pieza
    function superficie(estaciones, seccion, cerrada, ajustar, clasificar) {
      var filas = [], nv = 0, nu = estaciones.length;
      for (var i = 0; i < nu; i++) {
        var x0 = estaciones[i], media = seccion(x0), anillo = [];
        media.forEach(function (p) { anillo.push(p.slice()); });
        if (cerrada) { for (var k = media.length - 2; k >= 1; k--) anillo.push([-media[k][0], media[k][1], media[k][2], media[k][3], media[k][4]]); }
        else { for (var k2 = media.length - 2; k2 >= 0; k2--) anillo.push([-media[k2][0], media[k2][1], media[k2][2], media[k2][3], media[k2][4]]); }
        nv = anillo.length;
        filas.push(anillo.map(function (p) { var v = { x0: x0, x: x0, y: p[1], z: p[0], tramo: p[2], fr: p[3], hr: p[4] }; ajustar(v); return v; }));
      }
      var posArr = new Float32Array(nu * nv * 3), ids = new Array(nu * nv);
      for (var a = 0; a < nu; a++) for (var b = 0; b < nv; b++) {
        var v = filas[a][b], k3 = (a * nv + b) * 3;
        posArr[k3] = v.x; posArr[k3 + 1] = v.y; posArr[k3 + 2] = v.z;
        ids[a * nv + b] = clasificar(v);
      }
      var base = new T.BufferGeometry();
      base.setAttribute('position', new T.BufferAttribute(posArr, 3));
      var todos = [], grupos = {}, bordes = [];
      function tri(p, q, r) {
        todos.push(p, q, r);
        var A = ids[p], B = ids[q], Cc = ids[r], id = A;
        if (!(A === B && B === Cc)) {
          id = (A === B || A === Cc) ? A : (B === Cc ? B : A);
          bordes.push([p, q, r]);
        }
        (grupos[id] = grupos[id] || []).push(p, q, r);
      }
      var jmax = cerrada ? nv : nv - 1;
      for (var i2 = 0; i2 < nu - 1; i2++) for (var j = 0; j < jmax; j++) {
        var p00 = i2 * nv + j, p01 = i2 * nv + (j + 1) % nv, p10 = (i2 + 1) * nv + j, p11 = (i2 + 1) * nv + (j + 1) % nv;
        tri(p00, p10, p01); tri(p01, p10, p11);
      }
      base.setIndex(todos); base.computeVertexNormals();
      var nor = base.getAttribute('normal'), pa = base.getAttribute('position');
      // junta entre piezas: línea por el medio de los triángulos que cruzan de una pieza a otra
      var lin = [];
      function medio(p, q) {
        var o = [];
        for (var c = 0; c < 3; c++) o.push((pa.array[p * 3 + c] + pa.array[q * 3 + c]) / 2 + (nor.array[p * 3 + c] + nor.array[q * 3 + c]) / 2 * 0.0025);
        return o;
      }
      bordes.forEach(function (t) {
        var pts = [], e = [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]];
        if (ids[t[0]] === 'cubre' || ids[t[1]] === 'cubre' || ids[t[2]] === 'cubre') return;
        e.forEach(function (ed) { if (ids[ed[0]] !== ids[ed[1]]) pts.push(medio(ed[0], ed[1])); });
        if (pts.length === 2) lin.push.apply(lin, pts[0].concat(pts[1]));
        else if (pts.length === 3) {
          var cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3, cz = (pts[0][2] + pts[1][2] + pts[2][2]) / 3;
          pts.forEach(function (q) { lin.push(q[0], q[1], q[2], cx, cy, cz); });
        }
      });
      if (lin.length) {
        var gl = new T.BufferGeometry(); gl.setAttribute('position', new T.Float32BufferAttribute(lin, 3));
        G.add(new T.LineSegments(gl, new T.LineBasicMaterial({ color: 0x1a1c1f })));
      }
      Object.keys(grupos).forEach(function (id) {
        var g = new T.BufferGeometry();
        g.setAttribute('position', pa); g.setAttribute('normal', nor); g.setIndex(grupos[id]);
        g.computeBoundingSphere();
        var def = PIEZA[id];
        pieza(g, M[def[1]](), def[0]);
      });
    }

    function estacionesPorCurva(n) {
      var xs = [], acum = [0], N = 4000, px = -LR, pa = anchoC(-LR);
      for (var i = 0; i <= N; i++) {
        var x = -LR + (LF + LR) * i / N, a = anchoC(x);
        if (i) acum.push(acum[i - 1] + Math.hypot(x - px, (a - pa) * 1.15));
        xs.push(x); px = x; pa = a;
      }
      var tot = acum[N], out = [], j = 0;
      for (var k = 0; k < n; k++) {
        var s = tot * k / (n - 1);
        while (j < N && acum[j + 1] < s) j++;
        var t = j < N ? (s - acum[j]) / Math.max(1e-9, acum[j + 1] - acum[j]) : 0;
        out.push(xs[j] + (xs[Math.min(N, j + 1)] - xs[j]) * Math.min(1, t));
      }
      out[0] = -LR; out[n - 1] = LF; return out;
    }
    function estacionesParejas(n, x0, x1) {
      var out = [];
      for (var i = 0; i < n; i++) { var t = i / (n - 1); out.push(x0 + (x1 - x0) * (0.75 * t + 0.25 * (0.5 - 0.5 * Math.cos(PI * t)))); }
      return out;
    }

    // ---------- carrocería baja ----------
    superficie(estacionesPorCurva(300), function (x) {
      var yb = pisoC(x), yt = techoC(x), a = anchoC(x), h = yt - yb;
      var rbY = Math.min(0.1, h * 0.3), rbZ = Math.min(0.1, a * 0.45), rtY = Math.min(0.2, h * 0.45), rtZ = Math.min(0.2, a * 0.8), out = [], k;
      for (k = 0; k < 8; k++) out.push([(a - rbZ) * k / 7, yb, 'abajo', k / 7]);
      for (k = 1; k <= 5; k++) { var an = -PI / 2 + PI / 2 * k / 5; out.push([a - rbZ + rbZ * Math.cos(an), yb + rbY + rbY * Math.sin(an), 'arcoBajo', k / 5]); }
      for (k = 1; k <= 30; k++) out.push([a, yb + rbY + (h - rbY - rtY) * k / 30, 'lado', k / 30]);
      for (k = 1; k <= 10; k++) { var at = PI / 2 * k / 10; out.push([a - rtZ + rtZ * Math.cos(at), yt - rtY + rtY * Math.sin(at), 'arcoArriba', k / 10]); }
      for (k = 1; k <= 10; k++) out.push([(a - rtZ) * (1 - k / 10), yt, 'arriba', k / 10]);
      // costados un poco abombados; hr = altura relativa (0 abajo, 1 arriba) para recortar las piezas siguiendo la malla
      var ym = (yb + yt) / 2;
      out.forEach(function (p) { var q = Math.max(-1, Math.min(1, (p[1] - ym) / (h / 2))); p[0] *= 1 - 0.035 * q * q; p[4] = (p[1] - yb) / h; });
      return out;
    }, true, function (v) {
      var s = v.hr;
      if (v.x0 > 1.7) v.x -= 0.2 * s * s * suave(1.7, LF, v.x0);          // frente inclinado
      if (v.x0 < -1.8) v.x += 0.05 * s * suave(-1.8, -LR, v.x0);
      v.f = 0;
      if (v.tramo !== 'arriba') RUEDAS.forEach(function (wx) {        // hueco de las ruedas
        var d = Math.hypot(v.x - wx, v.y - R);
        if (d < RA) { var f = suave(RA, RA - 0.06, d); if (f > v.f) v.f = f; }
      });
      if (v.f > 0) { var sg = v.z < 0 ? -1 : 1; v.z = sg * Math.max(0.02, Math.abs(v.z) - 0.3 * v.f); }
    }, function (v) {
      // tramo: abajo / arcoBajo / lado / arcoArriba / arriba;  fr: posición dentro del tramo (0 a 1)
      var x0 = v.x0, a = anchoC(x0), tr = v.tramo, fr = v.fr;
      if (v.f > 0.5) return 'cubre';
      if (tr === 'abajo' || tr === 'arcoBajo') return x0 > 1.95 ? 'defDinf' : (x0 < -1.95 ? 'defTinf' : 'bajo');
      if (x0 > 1.95) {                                   // frente
        if (tr === 'arcoArriba' && fr >= 0.25 && fr <= 0.7 && a > 0.3) return 'faro';
        if (tr === 'arriba' || tr === 'arcoArriba') return (x0 <= 2.15 && (tr === 'arriba' || fr > 0.7)) ? 'capo' : 'defD';
        if (x0 > 2.06) {
          if (fr >= 0.6 && fr <= 0.8 && a > 0.58 && a < 0.74) return 'halo';
          if (fr >= 0.07 && fr <= 0.93 && a > 0.52 && a < 0.82) return 'toma';
          if (fr <= 0.47 && a < 0.46) return 'parrilla';
        }
        return 'defD';
      }
      if (x0 < -1.95) {                                  // atrás
        if (tr === 'arcoArriba' && fr >= 0.4 && fr <= 0.7 && x0 < -2.03) return 'stop';
        if (tr === 'arriba' || tr === 'arcoArriba' || fr >= 0.73) return a < 0.8 ? 'tapa' : 'guardaT';
        return 'defT';
      }
      if (tr === 'arriba') return x0 > 0.96 ? 'capo' : 'cuerpo';
      if (x0 > 0.96) return 'guardaD';
      if (tr === 'lado' && fr < 0.2 && x0 > -0.93 && x0 < 0.94) return x0 > -0.02 ? 'moldD' : 'moldT';
      if (x0 > -0.02) return x0 < 0.94 ? 'puertaD' : 'guardaD';
      if (x0 > -0.93) return 'puertaT';
      return 'guardaT';
    });

    // ---------- cabina: pilares, techo y vidrios ----------
    superficie(estacionesParejas(220, -2.02, 1.02), function (x) {
      var yt = techoV(x), y0 = CINT - 0.03, ab = anchoC(x) - 0.12;
      var at = ab - 0.16 * Math.max(0, Math.min(1, (yt - CINT) / 0.55)), h = Math.max(0.002, yt - y0);
      var rt = Math.max(0.001, Math.min(0.09, h * 0.45, at * 0.5)), out = [], k;
      for (k = 0; k <= 22; k++) { var u = k / 22; out.push([ab + (at - ab) * u, y0 + (h - rt) * u, 'lado', u]); }
      for (k = 1; k <= 8; k++) { var an = PI / 2 * k / 8; out.push([at - rt + rt * Math.cos(an), yt - rt + rt * Math.sin(an), 'arcoArriba', k / 8]); }
      for (k = 1; k <= 14; k++) out.push([(at - rt) * (1 - k / 14), yt, 'arriba', k / 14]);
      return out;
    }, false, function () {}, function (v) {
      var x = v.x, tr = v.tramo;
      if (tr === 'arriba') {
        if (x > 0.3) return 'vF';
        if (x < 0.08 && x > -0.86 && v.fr > 0.2) return 'vTe';
        if (x < -1.4 && x > -1.82) return 'vT';
        return 'pilar';
      }
      if (tr === 'arcoArriba' || v.fr < 0.16 || v.fr > 0.86) return 'pilar';
      if (x > 0 && x < 0.92) return 'v1';
      if (x < -0.07 && x > -0.89) return 'v2';
      if (x < -0.97 && x > -1.62) return 'v3';
      return 'pilar';
    });

    // ---------- detalles ----------
    function ambos(fn) { fn(1); fn(-1); }
    function caja(w, h, d) { return new T.BoxGeometry(w, h, d); }
    ambos(function (s) {
      // retrovisor redondeado (color carrocería) con base negra
      var r = pieza(new T.SphereGeometry(1, 28, 18), M.pintura(), 'Retrovisor');
      r.scale.set(0.12, 0.068, 0.1); r.position.set(0.82, 1.075, s * 1.04);
      var rb = pieza(caja(0.12, 0.035, 0.12), M.negro(), 'Retrovisor'); rb.position.set(0.86, 1.03, s * 0.97);
      var luz = pieza(caja(0.06, 0.012, 0.09), M.faro(), 'Retrovisor'); luz.position.set(0.86, 1.045, s * 1.07);
      // manijas al ras
      [0.2, -0.72].forEach(function (x) { var m = pieza(caja(0.17, 0.026, 0.012), M.cromo(), 'Puerta'); m.position.set(x, 0.88, s * 0.938); });
    });
    // alerón negro al final del techo
    var al = pieza(caja(0.2, 0.025, 1.22), M.negro(), 'Tapa de Baúl'); al.position.set(-1.83, 1.215, 0); al.rotation.z = 0.2;

    // ruedas: llanta de perfil bajo, rin de 10 rayos con huecos, disco y caliper, arco negro
    function formaRin(n) {
      var s = new T.Shape(); s.absarc(0, 0, 0.275, 0, 2 * PI, false);
      for (var k = 0; k < n; k++) {
        var a0 = k * 2 * PI / n + 0.09, a1 = (k + 1) * 2 * PI / n - 0.09, hp = new T.Path();
        hp.moveTo(0.085 * Math.cos(a0 + 0.08), 0.085 * Math.sin(a0 + 0.08));
        hp.lineTo(0.245 * Math.cos(a0), 0.245 * Math.sin(a0));
        hp.absarc(0, 0, 0.245, a0, a1, false);
        hp.lineTo(0.085 * Math.cos(a1 - 0.08), 0.085 * Math.sin(a1 - 0.08));
        hp.absarc(0, 0, 0.085, a1 - 0.08, a0 + 0.08, true);
        s.holes.push(hp);
      }
      return s;
    }
    var gRin = new T.ExtrudeGeometry(formaRin(10), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 28 });
    var gLlanta = new T.TorusGeometry(0.3, 0.08, 20, 64);
    var gFondo = new T.CylinderGeometry(0.275, 0.275, 0.2, 40, 1, true);
    var gDisco = new T.CylinderGeometry(0.22, 0.22, 0.025, 36);
    var gFlare = new T.TorusGeometry(RA - 0.025, 0.036, 12, 48, PI + 0.42);
    RUEDAS.forEach(function (wx) {
      ambos(function (s) {
        var zc = s * 0.8;
        var ll = pieza(gLlanta, M.llanta(), 'Copa'); ll.position.set(wx, R, zc); ll.scale.z = 1.5;
        var fo = pieza(gFondo, M.rinFondo(), 'Copa'); fo.position.set(wx, R, zc); fo.rotation.x = PI / 2;
        var rin = pieza(gRin, M.rinCara(), 'Copa'); rin.position.set(wx, R, zc + s * 0.06);
        if (s < 0) rin.rotation.y = PI;
        var tapa = pieza(new T.CylinderGeometry(0.055, 0.055, 0.02, 24), M.rinFondo(), 'Copa'); tapa.rotation.x = PI / 2; tapa.position.set(wx, R, zc + s * 0.1);
        var di = new T.Mesh(gDisco, M.disco()); di.rotation.x = PI / 2; di.position.set(wx, R, zc - s * 0.02); G.add(di);
        var ca = new T.Mesh(caja(0.1, 0.16, 0.07), M.caliper()); ca.position.set(wx - 0.11, R + 0.14, zc); ca.rotation.z = 0.6; G.add(ca);
        var fl = pieza(gFlare, M.negro(), 'Flare'); fl.position.set(wx, R, s * 0.925); fl.rotation.z = -0.21;
      });
    });

    // plataforma iluminada (no gira) y sombras
    function radial(paradas) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 256;
      var g = cv.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      paradas.forEach(function (p) { gr.addColorStop(p[0], p[1]); });
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      var t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; return t;
    }
    var plat = new T.Mesh(new T.CircleGeometry(2.95, 64), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false,
      map: radial([[0, 'rgba(236,208,178,0.95)'], [0.55, 'rgba(196,152,114,0.75)'], [0.86, 'rgba(146,104,74,0.35)'], [0.95, 'rgba(255,226,196,0.55)'], [1, 'rgba(255,226,196,0)']]) }));
    plat.rotation.x = -PI / 2; plat.position.y = 0.001; scene.add(plat);
    [[5.4, 2.5, 'rgba(40,24,14,0.55)'], [4.6, 1.9, 'rgba(20,12,8,0.6)']].forEach(function (o, k) {
      var sm = new T.Mesh(new T.PlaneGeometry(o[0], o[1]), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false,
        map: radial([[0, o[2]], [0.6, k ? 'rgba(20,12,8,0.25)' : 'rgba(40,24,14,0.22)'], [1, 'rgba(0,0,0,0)']]) }));
      sm.rotation.x = -PI / 2; sm.position.y = 0.002 + k * 0.001; G.add(sm);
    });

    partes.forEach(function (m) {
      m.userData.em = m.material.emissive.getHex(); m.userData.ei = m.material.emissiveIntensity; m.userData.col = m.material.color.clone();
    });

    // ---------- cámara, giro y resaltado ----------
    var info = { ty: 0.62, rx: 3.0, ry: 1.9 };
    var VISTAS = { frente: -PI / 2 + 0.25, lado: 0, atras: PI / 2 - 0.25, inicio: -0.62 };
    var yaw = VISTAS.inicio, yawMeta = null, pitch = 0.3, auto = true, dist = 8, marcada = null;
    var rc = new T.Raycaster(), pv = new T.Vector2();

    function ajustar() {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
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
      // la primera superficie que toca el dedo decide (las que no se venden tapan lo de atrás)
      var hit = rc.intersectObjects(G.children, false).filter(function (h) { return h.object.isMesh && h.object.geometry.type !== 'PlaneGeometry'; })[0];
      return hit ? (hit.object.userData.cat || null) : null;
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
    ajustar();
    window.rbCarro3D = {
      vista: function (v) { irAVista(v, null); },
      partes: function () { return partes; },
      catEn: catEn
    };
  }
})();
