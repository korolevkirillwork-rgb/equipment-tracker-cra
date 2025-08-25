// PWA SW (prod only). В dev мы его не регистрируем (см. index.tsx).
const VERSION = 'sw-v1.0.3';
const SHELL_CACHE = `shell-${VERSION}`;
const SHELL_ASSETS = [
  '/', '/index.html', '/manifest.json', '/favicon.ico',
  '/logo192.png', '/logo512.png', '/logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_ASSETS.map(u => new Request(u, { cache: 'reload' })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith('shell-') && k !== SHELL_CACHE) ? caches.delete(k) : null));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // SPA навигация: network-first, fallback index.html
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        const fallback = await cache.match('/index.html');
        return fallback || Response.error();
      }
    })());
    return;
  }

  // same-origin: кэшируем ТОЛЬКО shell-ассеты (не .js/.css)
  if (url.origin === self.location.origin && SHELL_ASSETS.includes(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok && req.method === 'GET') cache.put(req, res.clone());
        return res;
      } catch {
        return hit || Response.error();
      }
    })());
  }
});
