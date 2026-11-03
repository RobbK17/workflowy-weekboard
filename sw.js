/* Phone-page service worker. Android Chrome still requires a fetch handler before it
   will offer Install. Navigations try the network, then the saved phone page. Other
   requests (the WorkFlowy API included) are left to the browser. */
const CACHE = "weekboard-shell-v1";
const SHELL = ["/m", "/manifest.webmanifest", "/icon-180.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok && !res.redirected) await cache.put(url, res);
      } catch (e) { /* install still succeeds; the fetch handler is what Chrome checks */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function offlinePage() {
  return new Response("<!doctype html><meta charset=utf-8><title>Week Board</title><p>Week Board is offline. Reconnect, then open it again.</p>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request);
      if (res.ok && !res.redirected) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
      }
      return res;
    } catch (e) {
      return (await caches.match(event.request)) || (await caches.match("/m")) || offlinePage();
    }
  })());
});
