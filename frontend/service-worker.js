// Minimal service worker: makes TRIBE installable (PWA) and keeps the app
// shell available offline. API calls always go to the network — we never
// want to serve stale profile/match/chat data from cache.
//
// v2 change: the "app shell" files (the actual app code) now use a
// network-first strategy instead of cache-first. With cache-first, a
// deployed code change (e.g. a bugfix) could sit in a returning visitor's
// cache indefinitely, since old cache entries are only cleared when CACHE
// itself changes name — which nobody remembers to bump on every deploy.
// Network-first fixes that at the root: every load tries the network first
// and only falls back to the cache if there's no connection, so redeploys
// show up immediately for everyone while offline support is unaffected.
const CACHE = "tribe-shell-v2";
const SHELL_FILES = ["/", "/index.html", "/style.css", "/app.js", "/manifest.json"];
// Anything else (icons, uploaded photos, fonts, …) rarely changes once
// published, so it's fine — and faster — to keep serving those cache-first.
const NETWORK_FIRST_PATHS = new Set(["/", "/index.html", "/style.css", "/app.js", "/manifest.json"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return; // never cache API responses

  if (NETWORK_FIRST_PATHS.has(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
