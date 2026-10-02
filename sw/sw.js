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

// Web Share Target: the phone's share sheet POSTs a photo or text here. The
// file stays on this device - kept in its own cache, never uploaded - and
// /share lets the person decide what it is (a barcode, a progress photo).
const SHARE_CACHE = "pacestreak-share";
async function receiveShare(request) {
  const form = await request.formData();
  const cache = await caches.open(SHARE_CACHE);
  await Promise.all((await cache.keys()).map((k) => cache.delete(k)));
  const file = form.get("image");
  if (file && typeof file !== "string") {
    await cache.put("/share-target/image", new Response(file, { headers: { "Content-Type": file.type || "image/jpeg" } }));
  }
  const text = [form.get("title"), form.get("text"), form.get("url")].filter((v) => typeof v === "string" && v.trim()).join("\n");
  if (text) await cache.put("/share-target/text", new Response(text.slice(0, 2000), { headers: { "Content-Type": "text/plain" } }));
  return Response.redirect("/share", 303);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const shareUrl = new URL(request.url);
  if (request.method === "POST" && shareUrl.origin === self.location.origin && shareUrl.pathname === "/share-target") {
    event.respondWith(receiveShare(request).catch(() => Response.redirect("/share?error=1", 303)));
    return;
  }
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
        // Buttons (a habit reminder's Done and Snooze), each with a signed
        // API URL: this worker has no session to call the API with.
        actions: (data.actions || []).slice(0, 2).map((a) => ({ action: a.action, title: a.title })),
        data: { url: data.url || "/", actions: data.actions || [] },
      });
      // Tell open tabs so the bell count updates without a refresh.
      const windows = await self.clients.matchAll({ type: "window" });
      windows.forEach((w) => w.postMessage({ type: "push", id: data.id }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const chosen = event.action && ((event.notification.data && event.notification.data.actions) || []).find((a) => a.action === event.action);
  if (chosen) {
    event.waitUntil(
      (async () => {
        let ok = false;
        try {
          ok = (await fetch(chosen.url, { method: "POST", mode: "cors", credentials: "omit" })).ok;
        } catch {
          ok = false;
        }
        const windows = await self.clients.matchAll({ type: "window" });
        windows.forEach((w) => w.postMessage({ type: "notification-action", action: chosen.action, ok }));
        if (!ok) {
          // An expired link or no signal: say so rather than fail silently.
          await self.registration.showNotification("Couldn't do that from the notification", {
            body: "Open PaceStreak to finish it.",
            icon: "/icons/icon-192.png",
            tag: "action-failed",
            data: { url: (event.notification.data && event.notification.data.url) || "/" },
          });
        }
      })(),
    );
    return;
  }
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
