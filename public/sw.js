const CACHE_NAME = "babas-cyber-cafe-static-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("babas-cyber-cafe-") && key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache customer records, auth, Supabase calls, tracking, payments,
  // application submissions, grievance submissions or admin endpoints.
  if (
    url.pathname.startsWith("/functions/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/storage/") ||
    url.pathname.startsWith("/track") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/insurance/admin") ||
    url.pathname.startsWith("/apply") ||
    url.pathname.startsWith("/pay") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/investigation") ||
    url.pathname.startsWith("/grievance")
  ) return;

  // Always fetch the HTML shell and JavaScript/CSS bundles from the current
  // deployment. Caching versioned chunks can cause stale-chunk crashes after
  // a release, leaving users with a blank page.
  if (request.mode === "navigate" || ["script", "style"].includes(request.destination)) {
    if (request.mode === "navigate") {
      event.respondWith(
        fetch(request).catch(async () => {
          const cached = await caches.match(OFFLINE_URL);
          return cached || new Response("You are offline. Please reconnect and try again.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        })
      );
    }
    return;
  }

  // Cache only static visual assets; never cache executable application code.
  if (["image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
