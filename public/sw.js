self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Permite que las peticiones pasen directo a la red (Supabase, mapas y rutas en vivo)
});
