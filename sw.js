/* Discipline — Service Worker
   অ্যাপ (index.html), PDF লাইব্রেরি, Google Fonts ও Firebase SDK ক্যাশ করে রাখে,
   যাতে অফলাইনেও অ্যাপ খোলে ও কাজ করে। ক্লাউড সিঙ্ক (Firebase Auth/Firestore)
   ইন্টারনেট থাকলেই চলে; ডেটা সবসময় ডিভাইসেই (localStorage) থাকে। */

const CACHE_VERSION = 'v2';   // PDF লাইব্রেরি ফাইল বদলালে এই সংখ্যা বাড়িয়ে দিন
const CACHE_NAME = `discipline-${CACHE_VERSION}`;
const PAGE_URL = './index.html';
const PRECACHE_OPTIONAL = ['./html2canvas.min.js', './jspdf.umd.min.js'];

const RUNTIME_CACHE_HOSTS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net'
]);

// সফল বা opaque (no-cors স্ক্রিপ্ট/স্টাইলশিট) — দুটোই ক্যাশ করা যাবে
const cacheable = (res) => res && (res.ok || res.type === 'opaque');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['./', PAGE_URL]).then(() =>
        // PDF লাইব্রেরি ফাইল না থাকলেও ইনস্টল যেন ব্যর্থ না হয়
        Promise.all(PRECACHE_OPTIONAL.map((u) => cache.add(u).catch(() => {})))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // পেজ নেভিগেশন: নেট থাকলে আপডেট আনো ও ক্যাশ করো, না থাকলে ক্যাশ থেকে দাও
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(PAGE_URL, copy));
          }
          return res;
        })
        .catch(() => caches.match(PAGE_URL))
    );
    return;
  }

  // একই অরিজিনের অন্য ফাইল (PDF লাইব্রেরি ইত্যাদি): ক্যাশ-ফার্স্ট
  // ফন্ট ও Firebase SDK (jsdelivr): ক্যাশ-ফার্স্ট, প্রথমবার অনলাইনে থাকলে সেভ হয়ে যাবে
  if (url.origin === self.location.origin || RUNTIME_CACHE_HOSTS.has(url.hostname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (cacheable(res)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached))
    );
  }
});
