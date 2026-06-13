const VERSION = 'v1.16.0';
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
// 新バージョンのアセットを一括キャッシュ。
// skipWaiting は呼ばない → ページが SKIP_WAITING を送るまで waiting のまま
// （ゲーム中の不意なリロードを避けるため）。
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
// 1. 旧バージョンのキャッシュを削除
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
// ページ本体(navigate)   = Network-First
//   → オンラインなら常に最新の HTML を返す（再読み込み1回で即最新）。
//     ネットワーク失敗時のみキャッシュにフォールバック（オフライン動作を維持）。
// その他アセット(icon等) = Cache-First（高速・オフライン対応）。
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ページ遷移リクエスト → Network-First
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(response => {
          // 取得できたら最新をキャッシュへ反映（オフライン用）
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          // オフライン等 → キャッシュ済みページを返す
          caches.match(req).then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // 静的アセット → Cache-First
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        return response;
      });
    })
  );
});
