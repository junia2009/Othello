const VERSION = 'v1.0.0';
const CACHE = `othello-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
];

// ── install ──────────────────────────────────────────────────────────────────
// キャッシュへの書き込みが完全に終わってから skipWaiting する。
// こうすることで「中途半端なキャッシュで即 active 化」を防ぐ。
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// ── activate ─────────────────────────────────────────────────────────────────
// 1. 旧キャッシュ（CACHE 名が異なるもの）をすべて削除
// 2. 既存タブの制御を即座に奪取（clients.claim）
// 3. 制御中の全タブへ SW_UPDATED を通知 → ページ側でバナー表示
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: VERSION }))
      )
  );
});

// ── fetch ─────────────────────────────────────────────────────────────────────
// Cache-First: キャッシュヒット → 返す。ミス → ネット取得してキャッシュに追加。
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});
