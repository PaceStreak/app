/* PaceStreak service worker. Built by vite.config.ts, which injects the
   precache list and version below.

   - The app shell (index.html + every hashed asset of this build) is cached
     at install, so the app opens in a basement with no signal.
   - Navigations are network-first with the cached shell as fallback: a new
     deploy is picked up immediately when online.
   - Hashed assets are cache-first: their URL changes when their bytes do.
   - The API is cross-origin and is never intercepted. Offline writes are the
     app's job (its IndexedDB outbox), not this worker's, and a cached API
     response here would be somebody's personal data in a shared cache.
   - Push and notification clicks are handled here. */

const VERSION = "__VERSION__";
const SHELL = `pacestreak-shell-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// The page asks for this when the user taps "Update" on the new-version toast.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/")) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL).then((c) => c.put(request, copy)).catch(() => undefined);
            }
            return response;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "PaceStreak", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "PaceStreak", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag || undefined,
        data: { url: data.url || "/" },
      });
      // Tell open tabs so the bell count updates without a refresh.
      const windows = await self.clients.matchAll({ type: "window" });
      windows.forEach((w) => w.postMessage({ type: "push", id: data.id }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if ("focus" in w) {
          await w.focus();
          if ("navigate" in w) return w.navigate(target);
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
