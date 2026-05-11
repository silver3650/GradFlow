// public/sw.js

// 서비스 워커 설치 시
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 설치 완료');
  self.skipWaiting(); // 즉시 활성화되도록 설정
});

// 서비스 워커 활성화 시
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 활성화 완료');
  return self.clients.claim();
});

// 네트워크 요청 가로채기 (PWA 설치 조건 충족을 위한 필수 항목)
self.addEventListener('fetch', (event) => {
  // 현재는 모든 요청을 그대로 통과시킵니다. (추후 오프라인 캐싱 고도화 가능)
  event.respondWith(fetch(event.request).catch(() => {
    console.log('[Service Worker] 네트워크 요청 실패');
  }));
});