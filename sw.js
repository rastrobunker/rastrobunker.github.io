// Service worker minimo de Rastro Bunker.
// Solo existe para que Chrome considere el catalogo una app instalable.
// No cachea el catalogo: siempre pide la version fresca a la red.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
