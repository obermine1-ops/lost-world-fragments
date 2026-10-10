// 서비스 워커: 홈 화면에 설치할 수 있게 하고, 한 번 받은 파일은 기기에 보관해 인터넷이 끊겨도 열리게 한다.
// 항상 인터넷에서 최신 파일을 먼저 받고(업데이트가 바로 반영되도록), 실패할 때만 보관본을 쓴다.
const CACHE = 'lost-world-fragments';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || Response.error())),
  );
});
