import { toast } from "../components/toast";
import { ApiError, api, errorText } from "./api";
import { queryClient } from "./queries";
import { sendOrQueueWithResult } from "./requests";

/**
 * Delete something on the server and offer Undo. The server keeps a copy in
 * the trash for 30 days (GET /trash), so Undo is a restore, not a re-create:
 * same id, same history. Offline, the delete is queued and there's nothing
 * to restore yet, so the toast says so instead of offering a button that
 * can't work.
 */
export async function deleteWithUndo(opts: {
  path: string;
  label: string;
  /** Query keys to refresh after the delete and after an undo. */
  refresh: string[];
  /** Queue offline instead of failing (for idempotent deletes). */
  queue?: boolean;
  onUndone?: () => void;
}): Promise<boolean> {
  const refresh = () => Promise.all(opts.refresh.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  let trashId: string | null = null;
  try {
    if (opts.queue) {
      const sent = await sendOrQueueWithResult<{ trash_id: string | null }>(opts.path, "DELETE");
      if (sent.status === "queued") {
        await refresh();
        toast(`${opts.label} deleted`, { body: "Saved on this phone; it syncs when you're back online." });
        return true;
      }
      trashId = sent.data?.trash_id ?? null;
    } else {
      trashId = (await api<{ trash_id: string | null }>(opts.path, { method: "DELETE" })).trash_id;
    }
  } catch (err) {
    toast.error(errorText(err));
    return false;
  }
  await refresh();
  void queryClient.invalidateQueries({ queryKey: ["trash"] });
  toast(`${opts.label} deleted`, {
    duration: 7000,
    action: trashId
      ? {
          label: "Undo",
          onClick: () => void restore(trashId!, opts.label, opts.refresh).then((ok) => ok && opts.onUndone?.()),
        }
      : undefined,
  });
  return true;
}

export async function restore(trashId: string, label: string, keys: string[]): Promise<boolean> {
  try {
    await api(`/trash/${trashId}/restore`, { method: "POST" });
  } catch (err) {
    toast.error(err instanceof ApiError && err.status === 409 ? `Can't restore ${label}: something already exists in its place` : errorText(err));
    return false;
  }
  await Promise.all([...keys, "trash"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  toast.success(`${label} restored`);
  return true;
}
