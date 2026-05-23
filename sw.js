const VERSION = 'v1.14.2';
const CACHE = `othello-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
];

// ── install ───────────────────────────────────────────────────────────────────
// キャッシュを全部書き終えてから待機状態に入る。
// skipWaiting は呼ばない → ページが SKIP_WAITING を送るまで waiting のまま。
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
  );
});

// ── message ───────────────────────────────────────────────────────────────────
// ページから { type: 'SKIP_WAITING' } を受け取ったら即座に active 化。
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── activate ──────────────────────────────────────────────────────────────────
// 1. 旧キャッシュ削除
// 2. 既存タブの制御を奪取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
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
