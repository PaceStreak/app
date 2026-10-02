/**
 * Body writes that work with no signal. A weigh-in in a basement gym, or a
 * measure logged on a plane, is kept on the device and sent when the
 * connection is back. Only idempotent writes go through here - a PUT to an
 * id the client chose, or a DELETE - so resending is always safe.
 */

import { ApiError, NetworkError, api } from "./api";
import { db, type QueuedRequest } from "./db";

type Listener = (pending: QueuedRequest[]) => void;
const listeners = new Set<Listener>();

async function notify() {
  const pending = await queued();
  listeners.forEach((fn) => fn(pending));
}

export function onQueueChange(fn: Listener) {
  listeners.add(fn);
  void queued().then(fn);
  return () => void listeners.delete(fn);
}

export async function queued(): Promise<QueuedRequest[]> {
  try {
    const rows = await (await db()).getAll("requests");
    return rows.sort((a, b) => (a.queued_at < b.queued_at ? -1 : 1));
  } catch {
    return [];
  }
}

/**
 * Send now if possible. With no connection, queue and resolve "queued" -
 * the caller shows the entry as waiting. A refusal from the server (a 4xx)
 * is not queued: retrying a bad request would only fail again.
 */
export async function sendOrQueue(path: string, method: "PUT" | "DELETE", body?: unknown): Promise<"sent" | "queued"> {
  return (await sendOrQueueWithResult(path, method, body)).status;
}

/** As sendOrQueue, with the server's response when it was sent. */
export async function sendOrQueueWithResult<T = unknown>(
  path: string,
  method: "PUT" | "DELETE",
  body?: unknown,
): Promise<{ status: "sent"; data: T } | { status: "queued"; data: null }> {
  try {
    return { status: "sent", data: await api<T>(path, { method, body }) };
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    await (await db()).put("requests", { path, method, body, queued_at: new Date().toISOString() });
    await notify();
    return { status: "queued", data: null };
  }
}

let flushing = false;

/** Send everything queued, oldest first. Stops at the first network failure. */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const r of await queued()) {
      try {
        await api(r.path, { method: r.method, body: r.body });
      } catch (err) {
        if (err instanceof NetworkError) break;
        // Refused for good (validation, or the entry is gone): drop it
        // rather than retry forever.
        if (!(err instanceof ApiError)) break;
      }
      await (await db()).delete("requests", r.path);
      sent++;
    }
  } finally {
    flushing = false;
  }
  if (sent) {
    await notify();
    window.dispatchEvent(new Event("ps:body-synced"));
  }
  return sent;
}
