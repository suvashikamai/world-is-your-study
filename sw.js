/* World Is Your Study — service worker: app shell offline, libraries cached after first load. */
const VERSION = 'wiys-v1'; // change this (v2, v3…) whenever you upload new files
const SHELL = ['./', 'index.html', 'core.js', 'ui.js', 'world.js', 'app.js', 'demo.js', 'firebase-config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache Firebase API traffic (auth, Firestore, Functions)
  if (/googleapis\.com|cloudfunctions\.net|run\.app|firebaseio|identitytoolkit|securetoken/.test(url.host) || url.pathname.startsWith('/__/')) return;
  const isLib = /cdn\.jsdelivr\.net|www\.gstatic\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (url.origin === location.origin) {
    // network first so updates show up; fall back to cache offline
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req.mode === 'navigate' ? 'index.html' : req, copy)); return res; })
      .catch(() => caches.match(req.mode === 'navigate' ? 'index.html' : req).then((r) => r || caches.match('index.html'))));
  } else if (isLib) {
    e.respondWith(caches.open(VERSION + '-lib').then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))));
  }
});
self.addEventListener('notificationclick', (e) => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => cs.length ? cs[0].focus() : self.clients.openWindow('./'))); });
