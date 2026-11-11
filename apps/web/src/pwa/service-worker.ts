/// <reference lib="webworker" />
export {};
const worker = globalThis as unknown as ServiceWorkerGlobalScope;
// Replaced by the production Vite plugin, never evaluated dynamically.
const ASSETS: string[] = __NEURON_PRECACHE__;
const CACHE = "neuron-shell-__NEURON_REVISION__";
declare const __NEURON_PRECACHE__: string[];
worker.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await cache.addAll(
          ASSETS.map((path) => new Request(path, { cache: "reload" })),
        );
      } catch (e) {
        await caches.delete(CACHE);
        throw e;
      }
      // Do not skipWaiting: an existing tab must explicitly authorize the update.
    })(),
  );
});
worker.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      // Keep prior shell caches. Existing tabs may still reference old lazy chunks.
      // Their explicit cleanup is a later feature, not a destructive automatic action.
      await worker.clients.claim();
    })(),
  ),
);
worker.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE")
    event.waitUntil(worker.skipWaiting());
});
worker.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (url.pathname.startsWith("/api/shares")) return;
  if (request.method !== "GET" || url.origin !== worker.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (
          (await cache.match("/index.html")) ??
          (await cache.match("/offline.html")) ??
          new Response("Offline app unavailable.", { status: 503 })
        );
      })(),
    );
    return;
  }
  if (
    ASSETS.includes(url.pathname) ||
    /^\/assets\/[^/]+\.(js|css)$/.test(url.pathname)
  )
    event.respondWith(
      (async () => {
        const current = await caches.open(CACHE);
        const hit = await current.match(url.pathname);
        if (hit) return hit;
        // A previous tab can still reference a previous content-hashed lazy chunk.
        for (const name of await caches.keys()) {
          if (name === CACHE || !name.startsWith("neuron-shell-")) continue;
          const cached = await (await caches.open(name)).match(url.pathname);
          if (cached) return cached;
        }
        return fetch(request);
      })(),
    );
});