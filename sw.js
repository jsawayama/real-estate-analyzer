const CACHE_NAME = "real-estate-analyzer-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./src/styles.css?v=help-pwa-1",
  "./src/app.mjs",
  "./src/data.mjs",
  "./src/calculations.mjs",
  "./assets/app-icon.svg",
  "./assets/tokyo-analytics-header.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
