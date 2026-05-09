/**
 * sw.js - Service Worker
 * PWA 오프라인 지원: 앱 껍데기(HTML/CSS/JS)를 캐시해서
 * 인터넷이 없어도 앱이 실행되게 함
 * 실제 데이터 동기화는 Firebase SDK가 담당
 */

const CACHE_NAME = 'koditor-v1'

// 앱 실행에 필요한 정적 파일 캐시
const PRECACHE = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Firebase API, Google Auth 요청은 캐시하지 않음
  const url = event.request.url
  if (
    url.includes('firebaseio.com') ||
    url.includes('googleapis.com') ||
    url.includes('firebaseapp.com') ||
    event.request.method !== 'GET'
  ) {
    return
  }

  event.respondWith(
    // Network first → 실패 시 캐시
    fetch(event.request)
      .then(response => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
