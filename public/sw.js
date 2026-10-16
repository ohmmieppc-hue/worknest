// WorkNest service worker.
// Pages hold private business data, so they are never cached: page loads go to
// the network and fall back to an offline notice. Only the offline page, icons
// and hashed build assets (/_next/static, immutable) are cached.

const CACHE = "worknest-v1";
const PRECACHE = ["/offline.html", "/icons/icon-192.png"];

// Local dev: build files are not content-hashed, so remove any worker and cache
// left from an earlier visit and reload open tabs onto fresh code.
const DEV = ["localhost", "127.0.0.1"].includes(self.location.hostname);
if (DEV) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: "window" }))
        .then((tabs) => tabs.forEach((tab) => tab.navigate(tab.url))),
    );
  });
}

self.addEventListener("install", (event) => {
  if (DEV) return;
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  if (DEV) return;
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (DEV) return;
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
