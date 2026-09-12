/* 武生高校 入試ドリル — オフラインでも開けるようにする */
const V = 'drill-20260912-2207';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ページ本体（HTML）は「まずネットワーク、3秒で諦めてキャッシュ」。
   キャッシュ優先のままだと、直したあと1回目の起動では必ず古い版が出てしまう。
   電波が無いときは今までどおりキャッシュから開く（オフラインでも解ける）。
   画像・manifest はキャッシュ優先のまま（変わらないので速さを優先）。 */
function networkFirst(req){
  return new Promise(resolve => {
    let done = false;
    const useCache = () => {
      if (done) return;
      done = true;
      caches.match('./index.html').then(hit => resolve(hit || fetch(req).catch(() => Response.error())));
    };
    const timer = setTimeout(useCache, 3000);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (done) return;
      done = true;
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(V).then(c => c.put('./index.html', copy)).catch(() => {});
      }
      resolve(res);
    }).catch(() => { clearTimeout(timer); useCache(); });
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isPage = e.request.mode === 'navigate' ||
    (sameOrigin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')));
  if (isPage) { e.respondWith(networkFirst(e.request)); return; }
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(V).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => sameOrigin ? caches.match('./index.html') : Response.error());
    })
  );
});
