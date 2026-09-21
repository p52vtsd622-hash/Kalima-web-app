// Keeps the app's own files available offline. It never touches calls to Google's Gemini API or the class server.
const CACHE = "kalima-v7";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./config.js", "./search.js", "./quran-data.json", "./nahj-data.json"];

self.addEventListener("install", (e) => {
  // "reload" skips the browser's HTTP cache, so a fresh deploy is never stored as an old copy.
  // Each file is added on its own, so one slow or missing file can't stop the update from installing.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(FILES.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // everything else goes straight to the network
  e.respondWith(
    // "no-cache" always asks the server whether the file changed, so updates show up on the next open.
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
