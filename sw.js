/* SFS Apps – service worker
   Change VERSION whenever index.html changes: every installed app then shows "Update available". */
const VERSION = '3.1.0';
const CACHE = 'sfs-apps-' + VERSION;
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-32.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
  // no skipWaiting here: the page asks the user first ("Update" button)
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Own files: from this version's cache (fast + works offline).
   Everything else (the Google apps, the app list, fonts) goes straight to the network. */
const FONT_CACHE = 'sfs-fonts-v1';   // kept across versions

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* v3.1: Google Fonts from the device after the first time (refreshed quietly in the background). */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch (err) {
        return (await c.match('./index.html')) || Response.error();
      }
    })
  );
});
