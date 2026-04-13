const CACHE_NAME = 'circular-labs-v1';

// 설치 단계
self.addEventListener('install', event => {
  console.log('[ServiceWorker] 설치 완료!');
  self.skipWaiting();
});

// 활성화 단계
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] 활성화 완료!');
});

// 네트워크 요청 가로채기 (현재는 그대로 통과시킴)
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});