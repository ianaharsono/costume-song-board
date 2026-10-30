// Keeps costume photos (and fonts) on the device after the first load.
// Photo file names change whenever a photo is replaced, so a saved copy never goes stale.
const CACHE = "csb-photos-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
function cacheable(url) {
  return url.pathname.includes("/photos/") || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com";
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!cacheable(url)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok || res.type === "opaque") cache.put(req, res.clone()).catch(() => {});
    return res;
  })());
});
