import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CloudCheck, Fingerprint, PencilSimple, Trash } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Field, Section } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { ago } from "../../lib/dates";
import { addPasskey, passkeysSupported, wasCancelled, type Passkey } from "../../lib/passkeys";

type Dialog = { kind: "add"; password: string; name: string } | { kind: "rename"; key: Passkey; name: string } | { kind: "remove"; key: Passkey; password: string };

export function PasskeySection() {
  const keys = useQuery({ queryKey: ["passkeys"], queryFn: () => api<Passkey[]>("/auth/passkeys") });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = passkeysSupported();

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      setDialog(null);
      void keys.refetch();
    } catch (err) {
      if (!wasCancelled(err)) toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const list = keys.data ?? [];

  return (
    <Section title="Passkeys">
      <div className="card">
        {list.length > 0 && (
          <ul className="divide-y divide-line">
            {list.map((k) => (
              <li key={k.id} className="flex items-center gap-3 px-4 py-3">
                <Fingerprint size={22} className="shrink-0 text-accent-text" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{k.name}</span>
                  <span className="flex items-center gap-1 text-sm text-dim">
                    {k.backed_up && (
                      <>
                        <CloudCheck size={14} aria-hidden /> Synced ·{" "}
                      </>
                    )}
                    {k.last_used_at ? `Used ${ago(k.last_used_at)}` : `Added ${ago(k.created_at)}`}
                  </span>
                </span>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Rename ${k.name}`} onClick={() => setDialog({ kind: "rename", key: k, name: k.name })}>
                  <PencilSimple size={16} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${k.name}`} onClick={() => setDialog({ kind: "remove", key: k, password: "" })}>
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={list.length ? "border-t border-line p-4" : "p-4"}>
          {list.length === 0 && (
            <p className="mb-3 text-sm text-muted">
              Sign in with your fingerprint, face or device PIN instead of typing a password. Nothing to phish, and it counts as two-factor on its own.
            </p>
          )}
          {supported ? (
            <button type="button" className="btn btn-secondary w-full" onClick={() => setDialog({ kind: "add", password: "", name: "" })}>
              <Fingerprint size={18} aria-hidden /> Add a passkey
            </button>
          ) : (
            <p className="text-sm text-dim">This browser doesn't support passkeys. Try a current version of Safari, Chrome, Edge or Firefox.</p>
          )}
        </div>
      </div>

      <Sheet open={dialog?.kind === "add"} onClose={() => setDialog(null)} title="Add a passkey">
        {dialog?.kind === "add" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => addPasskey(dialog.password, dialog.name.trim()), "Passkey added");
            }}
          >
            <p className="text-muted">Your browser or password manager will ask you to confirm with your fingerprint, face or PIN.</p>
            <Field label="Name (optional)" value={dialog.name} maxLength={60} placeholder="e.g. My phone" onChange={(e) => setDialog({ ...dialog, name: e.target.value })} />
            <Field label="Your password" type="password" autoComplete="current-password" required value={dialog.password} onChange={(e) => setDialog({ ...dialog, password: e.target.value })} hint="Asked so a stolen session can't add its own way in." />
            <button className="btn btn-primary w-full" disabled={busy || !dialog.password}>
              {busy ? "Waiting for your device…" : "Continue"}
            </button>
          </form>
        )}
      </Sheet>

      <Sheet open={dialog?.kind === "rename"} onClose={() => setDialog(null)} title="Rename passkey">
        {dialog?.kind === "rename" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api(`/auth/passkeys/${dialog.key.id}`, { method: "PATCH", body: { name: dialog.name.trim() } }), "Renamed");
            }}
          >
            <Field label="Name" required maxLength={60} value={dialog.name} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} />
            <button className="btn btn-primary w-full" disabled={busy || !dialog.name.trim()}>
              Save
            </button>
          </form>
        )}
      </Sheet>

      <Sheet open={dialog?.kind === "remove"} onClose={() => setDialog(null)} title="Remove passkey?">
        {dialog?.kind === "remove" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api(`/auth/passkeys/${dialog.key.id}/remove`, { body: { password: dialog.password } }), "Passkey removed");
            }}
          >
            <p className="text-muted">
              “{dialog.key.name}” will stop working for PaceStreak. You may also want to delete it from your password manager.
            </p>
            <Field label="Your password" type="password" autoComplete="current-password" required value={dialog.password} onChange={(e) => setDialog({ ...dialog, password: e.target.value })} />
            <button className="btn btn-danger w-full" disabled={busy || !dialog.password}>
              Remove
            </button>
          </form>
        )}
      </Sheet>
    </Section>
  );
}
