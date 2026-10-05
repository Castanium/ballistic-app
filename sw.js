/* Service worker : cache de l'application pour fonctionnement hors ligne.
   Strategie : cache d'abord (demarrage instantane, hors ligne), mise a jour en arriere-plan.
   Une nouvelle version publiee est donc visible au lancement suivant.
   Incrementer VERSION a chaque livraison pour purger l'ancien cache. */
const VERSION = 'ballistic-v1.0.0';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/logo.png', './icons/icon-192.png',
  './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(key, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Hors ligne : ressource non disponible.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
