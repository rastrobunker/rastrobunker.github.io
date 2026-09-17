// One-off script: replaces the localStorage/hardcoded-catalog logic in index.html
// with API-backed logic, without needing to touch the huge embedded base64 blobs
// (PRODUCTOS_INICIALES seed data and LOGOS), which are kept untouched via anchors.
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

// --- Block 1: remove PRODUCTOS_INICIALES + localStorage layers (kept between
// WHATSAPP_NUM const and the LOGOS comment) ---
const startMarker1 = 'const WHATSAPP_NUM = "50768483285";';
const endMarker1 = '// Logos de marca para que las tarjetas se vean mas profesionales.';

const start1 = html.indexOf(startMarker1);
const end1 = html.indexOf(endMarker1);
if (start1 === -1 || end1 === -1) throw new Error('Marcadores del bloque 1 no encontrados');

const newBlock1 = `const WHATSAPP_NUM = "50768483285";
  // Config: URL del backend (Nuxt + Prisma + MySQL). Definida en config.js a partir de .env (API_URL).
  const API_BASE = (window.API_URL || "http://localhost:3000").replace(/\\/$/, "");

  let adminCodeIngresado = ""; // codigo validado contra ADMIN_CODE del backend, nunca hardcodeado en el cliente

  async function apiFetch(pathname, options) {
    options = options || {};
    const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    if (adminMode && adminCodeIngresado) headers["x-admin-code"] = adminCodeIngresado;
    const res = await fetch(API_BASE + pathname, Object.assign({}, options, { headers }));
    if (!res.ok) {
      let msg = res.statusText;
      try { const body = await res.json(); msg = body.message || body.statusMessage || msg; } catch (e) {}
      throw new Error(msg || ("Error " + res.status));
    }
    return res.status === 204 ? null : res.json();
  }

  function buildQuery(params) {
    const qs = new URLSearchParams();
    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && v !== "") qs.set(k, v);
    });
    const s = qs.toString();
    return s ? "?" + s : "";
  }

  const SINPRECIOS = /(^|[?&])sinprecios(=|&|$)/.test(location.search);
  if (SINPRECIOS) document.documentElement.classList.add("sin-precios");

  let productos = [];        // piezas de la pagina actual (server-side pagination)
  let paginacion = { page: 1, pageSize: 30, total: 0, totalPages: 1 };
  let filtrosDisponibles = { categorias: [], marcas: [], modelos: [], anios: [], lados: [] };
  let statsCache = { total: 0, vendidas: 0, importadas: 0 };
  let adminMode = false;
  let editingId = null;
  const PAGINA_TAM = 30;
  let claveFiltroAnterior = "";

  async function cargarFiltros() {
    filtrosDisponibles = await apiFetch("/api/filtros");
  }

  `;

const replaced1 = html.slice(0, start1) + newBlock1 + html.slice(end1);

// --- Block 2: replace siguienteCodigo()..end-of-script with API-driven UI logic ---
const startMarker2 = 'function siguienteCodigo() {';
const scriptCloseTag = '</script>';

const start2 = replaced1.indexOf(startMarker2);
const scriptClose2 = replaced1.lastIndexOf(scriptCloseTag);
if (start2 === -1 || scriptClose2 === -1) throw new Error('Marcadores del bloque 2 no encontrados');

const newBlock2 = `function siguienteCodigo() {
    return String((statsCache.total || 0) + 1).padStart(3, "0");
  }

  function poblarSelectsFiltro() {
    const catSelect = document.getElementById("categoria");
    const valorActual = catSelect.value;
    catSelect.innerHTML = '<option value="">Todas las categorías</option>' +
      filtrosDisponibles.categorias.map(c => \`<option value="\${c}">\${c}</option>\`).join("") +
      '<option value="__RH__">Piezas Nuevas Importadas</option>';
    catSelect.value = valorActual;

    const hint = document.getElementById("brandsHint");
    if (hint) hint.textContent = "(" + filtrosDisponibles.marcas.length + ")";
    document.getElementById("brandButtons").innerHTML = filtrosDisponibles.marcas.map(m =>
      \`<button type="button" class="brand-btn" onclick="filtrarMarca(this, '\${m.replace(/'/g, "\\\\'")}')">\${m}</button>\`
    ).join("");
  }

  async function actualizarStatsFooter() {
    const [total, vendidas, importadas] = await Promise.all([
      apiFetch("/api/productos/buscar" + buildQuery({ pageSize: 1 })),
      apiFetch("/api/productos/buscar" + buildQuery({ pageSize: 1, vendido: true })),
      apiFetch("/api/productos/buscar" + buildQuery({ pageSize: 1, codigo: "RH-" })),
    ]);
    statsCache = { total: total.pagination.total, vendidas: vendidas.pagination.total, importadas: importadas.pagination.total };

    document.getElementById("statsFooter").innerHTML = \`
      <div class="stat-box"><div class="stat-num">\${statsCache.total}</div><div class="stat-label">TOTAL DE PIEZAS (CATÁLOGO)</div></div>
      <div class="stat-box"><div class="stat-num">\${statsCache.total - statsCache.importadas}</div><div class="stat-label">PIEZAS BÚNKER</div></div>
      <div class="stat-box"><div class="stat-num">\${statsCache.importadas}</div><div class="stat-label">PIEZAS IMPORT (RH-)</div></div>
      <div class="stat-box"><div class="stat-num">\${statsCache.vendidas}</div><div class="stat-label">VENDIDAS</div></div>
    \`;
  }

  function ajustarBarra() {
    const tb = document.querySelector(".top-bar");
    if (tb) document.documentElement.style.setProperty("--barra", Math.round(tb.getBoundingClientRect().height) + "px");
  }
  window.addEventListener("resize", ajustarBarra);

  function condTextoDe(p) { return p.condicion === "ORG" ? "Original" : (p.condicion === "NEW" ? "Nuevo" : "Genérico"); }

  function tarjeta(p) {
    const condTexto = condTextoDe(p);
    const msg = encodeURIComponent(\`Hola, me interesa la pieza: \${p.marca} \${p.modelo} \${p.anio || ""} (\${p.lado}) - Código #\${p.codigo}\${SINPRECIOS ? "" : " - $" + p.precio}\`);
    const waLink = \`https://wa.me/\${WHATSAPP_NUM}?text=\${msg}\`;
    const fitAttr = p.fit === "contain" ? \` class="fit-full" style="background:\${p.bgc || "#e9eaec"}"\` : "";
    const fotoHtml = p.tieneFoto
      ? \`<img\${fitAttr} loading="lazy" decoding="async" src="\${API_BASE}/api/productos/\${p.id}/foto" alt="\${p.marca} \${p.modelo}">\`
      : \`<div class="no-photo"><div class="no-photo-icon">📷</div>Sin foto</div>\`;
    const esImportada = /^RH-/i.test(String(p.codigo));

    return \`
      <div class="card \${p.vendido ? "vendido admin-mode-card" : ""} \${esImportada ? "importada" : ""}">
        <div class="delete-x" onclick="event.stopPropagation(); borrarProducto('\${p.id}')">✕</div>
        <div class="edit-btn" onclick="event.stopPropagation(); abrirEdicion('\${p.id}')">✎</div>
        <div onclick="abrirModal('\${p.id}')">
          <div class="card-img">
            \${fotoHtml}
            <div class="card-category">\${p.categoria || ""}</div>
            <div class="brand-stamp">\${p.marca || ""}</div>
            <div class="sold-stamp">VENDIDA</div>
          </div>
          <div class="card-info">
            <h3>\${p.marca || ""} \${p.modelo || ""}</h3>
            <p><strong>Año:</strong> \${p.anio || "—"}</p>
            <p><strong>Lado:</strong> \${p.lado || ""}</p>
            \${(p.posicion && p.posicion !== "N/A") ? \`<p><strong>Posición:</strong> \${p.posicion}</p>\` : ""}
            <p><strong>Estado:</strong> \${condTexto}</p>
            \${(p.cantidad && p.cantidad > 1) ? \`<p><strong>Disponibles:</strong> \${p.cantidad}</p>\` : ""}
            <p><strong>ID Item:</strong> <span class="card-id-item">#\${p.codigo}</span></p>
            <div class="price">\${SINPRECIOS ? "Consultar" : "$" + p.precio}</div>
          </div>
        </div>
        <div class="card-info" style="padding-top:0;">
          <a class="btn" href="\${waLink}" target="_blank" onclick="event.stopPropagation()">💬 WhatsApp</a>
        </div>
      </div>\`;
  }

  function queryActual(page) {
    const busqueda = document.getElementById("buscar").value.trim();
    const categoria = document.getElementById("categoria").value;
    const lado = document.getElementById("lado").value;
    const estadoV = adminMode ? ((document.getElementById("estadoVenta") || {}).value || "") : "";

    const params = { page: page || 1, pageSize: PAGINA_TAM };
    if (busqueda) params.q = busqueda;
    if (categoria === "__RH__") params.codigo = "RH-";
    else if (categoria) params.categoria = categoria;
    if (lado) params.lado = lado;
    if (!adminMode) params.vendido = false;
    else if (estadoV === "vendidas") params.vendido = true;
    else if (estadoV === "disponibles") params.vendido = false;
    return params;
  }

  function ordenarVisibles(lista) {
    const orden = document.getElementById("ordenar").value;
    if (!orden) return lista;
    const numItem = (p) => { const n = parseInt(String(p.codigo).replace(/[^0-9]/g, ""), 10); return isNaN(n) ? 0 : n; };
    const nombre = (p) => \`\${p.marca} \${p.modelo}\`.toLowerCase();
    const copia = lista.slice();
    copia.sort((a, b) => {
      switch (orden) {
        case "fecha_desc": return new Date(b.updatedAt) - new Date(a.updatedAt);
        case "fecha_asc": return new Date(a.updatedAt) - new Date(b.updatedAt);
        case "item_asc": return numItem(a) - numItem(b);
        case "item_desc": return numItem(b) - numItem(a);
        case "nombre_asc": return nombre(a).localeCompare(nombre(b));
        case "nombre_desc": return nombre(b).localeCompare(nombre(a));
        default: return 0;
      }
    });
    return copia;
  }

  async function mostrar() {
    ajustarBarra();
    const busqueda = document.getElementById("buscar").value.trim();
    const categoria = document.getElementById("categoria").value;
    const claveFiltro = queryActual(1);
    const claveStr = JSON.stringify(claveFiltro);
    const cambioFiltro = claveStr !== claveFiltroAnterior;
    claveFiltroAnterior = claveStr;

    const modoSelector = !busqueda && !categoria;
    const grid = document.getElementById("productos");
    const noResults = document.getElementById("noResults");
    const noResultsText = document.getElementById("noResultsText");
    const navCats = document.getElementById("navCats");

    if (modoSelector) {
      if (navCats) navCats.innerHTML = "";
      const conteos = await Promise.all(filtrosDisponibles.categorias.map(c =>
        apiFetch("/api/productos/buscar" + buildQuery(Object.assign(queryActual(1), { categoria: c, pageSize: 1 })))
      ));
      const tiles = filtrosDisponibles.categorias.map((c, i) => ({ nombre: c, valor: c, n: conteos[i].pagination.total })).filter(t => t.n > 0);
      const importadasResp = await apiFetch("/api/productos/buscar" + buildQuery(Object.assign(queryActual(1), { categoria: undefined, codigo: "RH-", pageSize: 1 })));
      if (importadasResp.pagination.total > 0) tiles.push({ nombre: "Piezas Nuevas Importadas", valor: "__RH__", n: importadasResp.pagination.total });

      grid.innerHTML = tiles.map(t =>
        \`<div class="cat-tile" onclick="elegirCategoria('\${String(t.valor).replace(/'/g, "\\\\'")}')">\` +
          \`<span class="cat-tile-name">\${t.nombre}</span>\` +
          \`<span class="cat-tile-count">\${t.n} pieza\${t.n !== 1 ? "s" : ""}</span>\` +
        \`</div>\`
      ).join("");
      noResults.style.display = "none";
      document.getElementById("total").textContent = "Elegí una categoría para ver las piezas";
      await actualizarStatsFooter();
      return;
    }

    const pagina = cambioFiltro ? 1 : paginacion.page;
    const resp = await apiFetch("/api/productos/buscar" + buildQuery(queryActual(pagina)));
    productos = cambioFiltro ? resp.data : productos.concat(resp.data);
    paginacion = resp.pagination;

    document.getElementById("total").textContent = \`Mostrando \${productos.length} de \${paginacion.total} producto\${paginacion.total !== 1 ? "s" : ""}\`;

    if (productos.length === 0) {
      grid.innerHTML = "";
      if (navCats) navCats.innerHTML = "";
      noResults.style.display = "block";
      noResultsText.innerHTML = paginacion.total === 0 && !busqueda && !categoria
        ? 'Todavía no hay piezas en el catálogo.<br>Abrí el panel de administrador y tocá "+" para agregar la primera.'
        : "No se encontraron piezas con esa búsqueda.";
      await actualizarStatsFooter();
      return;
    }
    noResults.style.display = "none";

    const visibles = ordenarVisibles(productos);
    let html = "";
    if (categoria) {
      html += \`<button type="button" class="volver-cats" onclick="volverCategorias()">← Todas las categorías</button>\`;
    }
    html += visibles.map(tarjeta).join("");
    if (paginacion.page < paginacion.totalPages) {
      html += \`<div class="ver-mas-wrap"><button type="button" class="ver-mas-btn" onclick="verMas()">Ver más (\${productos.length} de \${paginacion.total})</button></div>\`;
    }
    grid.innerHTML = html;
    if (navCats) navCats.innerHTML = "";

    await actualizarStatsFooter();
  }

  function verMas() {
    paginacion.page = (paginacion.page || 1) + 1;
    mostrar();
  }
  function volverCategorias() {
    document.getElementById("categoria").value = "";
    claveFiltroAnterior = "";
    mostrar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function elegirCategoria(valor) {
    document.getElementById("categoria").value = valor;
    claveFiltroAnterior = "";
    mostrar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function filtrarMarca(btn, marca) {
    document.querySelectorAll(".brand-btn").forEach(b => b.classList.remove("active"));
    const yaActivo = btn.classList.contains("active");
    document.getElementById("buscar").value = yaActivo ? "" : marca;
    if (!yaActivo) btn.classList.add("active");
    document.getElementById("searchDrawer").classList.toggle("open", !yaActivo);
    document.getElementById("searchToggle").classList.toggle("on", !yaActivo);
    cerrarMarcas();
    claveFiltroAnterior = "";
    mostrar();
  }

  /* ---------- Modal detalle ---------- */
  async function abrirModal(id) {
    const p = await apiFetch("/api/productos/" + id);
    if (!p) return;
    const photoEl = document.getElementById("modalPhoto");
    const noPhotoEl = document.getElementById("modalNoPhoto");
    const thumbsEl = document.getElementById("modalThumbs");
    photoEl.classList.toggle("fit-full", p.fit === "contain");
    photoEl.style.background = p.fit === "contain" ? (p.bgc || "#e9eaec") : "#0a0e27";
    if (p.foto) {
      photoEl.src = p.foto;
      photoEl.style.display = "block";
      noPhotoEl.style.display = "none";
    } else {
      photoEl.style.display = "none";
      noPhotoEl.style.display = "flex";
    }
    thumbsEl.innerHTML = "";
    thumbsEl.style.display = "none";

    const condTexto = condTextoDe(p);
    document.getElementById("modalCode").textContent = \`ID Item #\${p.codigo}\`;
    document.getElementById("modalTitle").textContent = \`\${p.marca} \${p.modelo}\`;
    const cantTxt = (p.cantidad && p.cantidad > 1) ? \` · Disponibles: \${p.cantidad}\` : "";
    const posTxt = (p.posicion && p.posicion !== "N/A") ? \` · \${p.posicion}\` : "";
    document.getElementById("modalSub").textContent = \`\${p.anio || "Año no especificado"} · Lado \${p.lado} · \${p.categoria} · \${condTexto}\${posTxt}\${cantTxt}\`;
    document.getElementById("modalPrice").textContent = SINPRECIOS ? "Consultar" : \`$\${p.precio}\`;
    const detalleEl = document.getElementById("modalDetalle");
    if (p.detalle && p.detalle.trim() !== "") {
      detalleEl.textContent = \`⚠️ Detalle: \${p.detalle}\`;
      detalleEl.style.display = "block";
    } else {
      detalleEl.textContent = "";
      detalleEl.style.display = "none";
    }
    const msg = encodeURIComponent(\`Hola, me interesa la pieza: \${p.marca} \${p.modelo} \${p.anio || ""} (\${p.lado}) - Código #\${p.codigo}\${SINPRECIOS ? "" : " - $" + p.precio}\`);
    document.getElementById("modalWaBtn").href = \`https://wa.me/\${WHATSAPP_NUM}?text=\${msg}\`;
    document.getElementById("modalOverlay").classList.add("show");
  }
  function closeModal() { document.getElementById("modalOverlay").classList.remove("show"); }

  /* ---------- Administrador ---------- */
  function openAdminPanel() {
    if (adminMode) return;
    document.getElementById("adminLoginPanel").classList.add("show");
  }
  function closeAdminLogin() {
    document.getElementById("adminLoginPanel").classList.remove("show");
    document.getElementById("adminCode").value = "";
  }
  function checkAdmin() {
    const code = document.getElementById("adminCode").value;
    const btn = document.getElementById("adminCodeSubmit");
    if (btn) btn.disabled = true;
    fetch(API_BASE + "/api/admin/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: code }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Código incorrecto");
        adminCodeIngresado = code;
        adminMode = true;
        document.body.classList.add("admin-mode");
        document.getElementById("adminStatus").classList.add("show");
        closeAdminLogin();
        claveFiltroAnterior = "";
        mostrar();
      })
      .catch(() => alert("Código incorrecto"))
      .finally(() => { if (btn) btn.disabled = false; });
  }

  /* ---------- Agregar / editar / borrar ---------- */
  function addNewProducto() {
    editingId = null;
    document.getElementById("editPanelTitle").textContent = "Agregar pieza";
    document.getElementById("fCodigo").value = siguienteCodigo();
    document.getElementById("fCategoria").value = "";
    document.getElementById("fMarca").value = "";
    document.getElementById("fModelo").value = "";
    document.getElementById("fAnio").value = "";
    document.getElementById("fLado").value = "LH";
    document.getElementById("fCondicion").value = "ORG";
    document.getElementById("fPrecio").value = "";
    document.getElementById("fVendido").checked = false;
    document.getElementById("fFoto").value = "";
    const preview = document.getElementById("fPreview");
    preview.style.display = "none";
    preview.dataset.foto = "";
    document.getElementById("editPanel").classList.add("show");
  }

  async function abrirEdicion(id) {
    const p = await apiFetch("/api/productos/" + id);
    if (!p) return;
    editingId = id;
    document.getElementById("editPanelTitle").textContent = "Editar pieza";
    document.getElementById("fCodigo").value = p.codigo || "";
    document.getElementById("fCategoria").value = p.categoria || "";
    document.getElementById("fMarca").value = p.marca || "";
    document.getElementById("fModelo").value = p.modelo || "";
    document.getElementById("fAnio").value = p.anio || "";
    document.getElementById("fLado").value = p.lado || "LH";
    document.getElementById("fCondicion").value = p.condicion || "ORG";
    document.getElementById("fPrecio").value = p.precio || "";
    document.getElementById("fVendido").checked = !!p.vendido;
    document.getElementById("fFoto").value = "";
    const preview = document.getElementById("fPreview");
    if (p.foto) { preview.src = p.foto; preview.style.display = "block"; preview.dataset.foto = p.foto; }
    else { preview.style.display = "none"; preview.dataset.foto = ""; }
    document.getElementById("editPanel").classList.add("show");
  }

  function closeEditPanel() {
    document.getElementById("editPanel").classList.remove("show");
    editingId = null;
  }

  document.getElementById("fFoto").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      document.getElementById("fPreview").src = ev.target.result;
      document.getElementById("fPreview").style.display = "block";
      document.getElementById("fPreview").dataset.foto = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  async function saveProducto(e) {
    e.preventDefault();
    const datos = {
      codigo: document.getElementById("fCodigo").value.trim(),
      categoria: document.getElementById("fCategoria").value.trim(),
      marca: document.getElementById("fMarca").value.trim(),
      modelo: document.getElementById("fModelo").value.trim(),
      anio: document.getElementById("fAnio").value.trim(),
      lado: document.getElementById("fLado").value,
      condicion: document.getElementById("fCondicion").value,
      precio: parseFloat(document.getElementById("fPrecio").value) || 0,
      vendido: document.getElementById("fVendido").checked,
    };
    const foto = document.getElementById("fPreview").dataset.foto || "";
    if (foto) datos.foto = foto;

    try {
      if (editingId !== null) {
        await apiFetch("/api/productos/" + editingId, { method: "PUT", body: JSON.stringify(datos) });
      } else {
        await apiFetch("/api/productos", { method: "POST", body: JSON.stringify(datos) });
      }
      closeEditPanel();
      await cargarFiltros();
      poblarSelectsFiltro();
      claveFiltroAnterior = "";
      mostrar();
    } catch (err) {
      alert("No se pudo guardar la pieza: " + err.message);
    }
  }

  async function borrarProducto(id) {
    const p = productos.find(x => x.id === id);
    if (!confirm(\`¿Eliminar \${p ? p.marca + " " + p.modelo : "esta pieza"} (Código #\${p ? p.codigo : ""})?\`)) return;
    try {
      await apiFetch("/api/productos/" + id, { method: "DELETE" });
      await cargarFiltros();
      poblarSelectsFiltro();
      claveFiltroAnterior = "";
      mostrar();
    } catch (err) {
      alert("No se pudo eliminar la pieza: " + err.message);
    }
  }

  /* ---------- Buscador desplegable ---------- */
  function toggleBuscador(forzar) {
    const d = document.getElementById("searchDrawer");
    const b = document.getElementById("searchToggle");
    const abrir = (forzar === undefined) ? !d.classList.contains("open") : forzar;
    d.classList.toggle("open", abrir);
    b.classList.toggle("on", abrir);
    if (abrir) { document.getElementById("buscar").focus(); }
    else { const i = document.getElementById("buscar"); if (i.value) { i.value = ""; mostrar(); } }
  }

  /* ---------- Ventana de marcas ---------- */
  function abrirMarcas() { document.getElementById("brandsOverlay").classList.add("show"); }
  function cerrarMarcas() { document.getElementById("brandsOverlay").classList.remove("show"); }
  function limpiarMarca() {
    document.querySelectorAll(".brand-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("buscar").value = "";
    toggleBuscador(false);
    cerrarMarcas();
    mostrar();
  }

  /* ---------- Eventos ---------- */
  let buscarDebounce = null;
  document.getElementById("buscar").addEventListener("input", () => {
    clearTimeout(buscarDebounce);
    buscarDebounce = setTimeout(mostrar, 300);
  });
  document.getElementById("categoria").addEventListener("change", mostrar);
  document.getElementById("lado").addEventListener("change", mostrar);
  document.getElementById("ordenar").addEventListener("change", mostrar);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("brandsOverlay").addEventListener("click", (e) => {
    if (e.target.id === "brandsOverlay") cerrarMarcas();
  });

  (async function init() {
    await cargarFiltros();
    poblarSelectsFiltro();
    await mostrar();
  })();

  function copiarSinPrecios() {
    const base = location.origin + location.pathname;
    const url = base + "?sinprecios=1";
    if (navigator.clipboard) { navigator.clipboard.writeText(url); }
    alert("Link sin precios copiado:\\n\\n" + url);
  }
  window.copiarSinPrecios = copiarSinPrecios;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
</`;

const replaced2 = replaced1.slice(0, start2) + newBlock2 + replaced1.slice(scriptClose2);

fs.writeFileSync(filePath, replaced2, 'utf8');
console.log('index.html actualizado: catalogo ahora se sirve desde la API en vez de datos embebidos.');
