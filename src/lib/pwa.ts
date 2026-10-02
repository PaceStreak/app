import { toast } from "../components/toast";
import { api } from "./api";

/** Service worker, install prompt, push subscription and the app badge. */

let waiting: ServiceWorker | null = null;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const offer = (worker: ServiceWorker) => {
        waiting = worker;
        toast("A new version is ready", {
          body: "Update now, or it loads next time you open the app.",
          duration: 12000,
          action: { label: "Update", onClick: applyUpdate },
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        next?.addEventListener("statechange", () => {
          if (next.state === "installed" && navigator.serviceWorker.controller) offer(next);
        });
      });
      // Deploys happen while people keep the app open all day.
      setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
    } catch {
      /* no offline shell this session; everything else still works */
    }
  });
  let reloaded = false;
  // Reload only when an update replaces a worker that was already in
  // charge. On a first visit the new worker claiming the page also fires
  // controllerchange, and reloading then wiped whatever the person (or their
  // password manager) had just typed into the sign-in form.
  const hadController = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}

export function applyUpdate() {
  waiting?.postMessage("SKIP_WAITING");
}

// --- install ---------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  installListeners.forEach((l) => l());
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  installListeners.forEach((l) => l());
});

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

export function canInstall() {
  return !isStandalone() && (deferred !== null || isIos());
}

export function onInstallChange(fn: () => void) {
  installListeners.add(fn);
  return () => void installListeners.delete(fn);
}

/** Returns "ios" when the person must use Share > Add to Home Screen. */
export async function install(): Promise<"accepted" | "dismissed" | "ios" | "unavailable"> {
  if (deferred) {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    return choice.outcome;
  }
  return isIos() ? "ios" : "unavailable";
}

// --- push --------------------------------------------------------------------

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(publicKey: string): Promise<"granted" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const json = sub.toJSON();
  await api("/notifications/push/subscribe", { method: "POST", body: { endpoint: json.endpoint, keys: json.keys } });
  return "granted";
}

export async function disablePush() {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await api("/notifications/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => undefined);
  await sub.unsubscribe();
}

/** A notification from the page itself, e.g. the rest timer finishing while
 * the tab is in the background. Needs no push service. */
export async function localNotify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) await reg.showNotification(title, { body, icon: "/icons/icon-192.png", tag: "local" });
  else new Notification(title, { body });
}

export function setBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) void nav.setAppBadge?.(count);
    else void nav.clearAppBadge?.();
  } catch {
    /* unsupported */
  }
}
