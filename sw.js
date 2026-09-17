// Rastro Bunker - service worker minimo.
// Existe para que Chrome pueda INSTALAR el sitio como app (WebAPK) y el icono
// salga sin el badge del navegador. A proposito NO cachea el catalogo:
// si lo cacheara, al publicar un lote nuevo el celular seguiria viendo el viejo.
const VERSION = 'rb-v4';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // No interceptar peticiones cross-origin (p.ej. la API en execute-api.amazonaws.com):
  // dejarlas pasar tal cual, sin cache de respaldo, para no romper CORS.
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
