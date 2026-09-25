import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { DownloadSimple, UploadSimple, Warning } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Banner, Field, Section } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { syncNow } from "../../lib/sync";
import { queryClient } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ActivityImport, CalendarFeed } from "./ActivityImport";
import { plural } from "../../lib/units";

export function Data() {
  const { signOut } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmSheet, ask] = useConfirm();
  // Arriving from the monthly backup reminder. A banner with a button rather
  // than an automatic download: browsers block downloads nobody tapped for.
  const [params, setParams] = useSearchParams();
  const fromReminder = params.get("backup") === "1";

  const download = async (format: "json" | "csv" | "ics") => {
    setBusy(format);
    try {
      const res = await api<Response>(`/me/export?format=${format}`, { raw: true });
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `pacestreak.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (fromReminder) setParams({}, { replace: true });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (file: File) => {
    setBusy("import");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<{ imported: number; skipped: number }>("/me/import", { method: "POST", form });
      await syncNow();
      void queryClient.invalidateQueries();
      toast.success(`Imported ${plural(res.imported, "session")}`, { body: res.skipped ? `${res.skipped} were already here or unreadable.` : undefined });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    if (!(await ask({ title: "Delete your account?", body: "Everything is deleted after 30 days. Sign in before then to cancel.", confirm: "Delete my account", danger: true }))) return;
    try {
      await api("/me/delete", { body: { password } });
      toast("Scheduled for deletion");
      await signOut();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div>
      <p className="text-muted">It's your training history. Take all of it, whenever you like.</p>
      {fromReminder && (
        <Banner
          tone="accent"
          icon={<DownloadSimple size={18} />}
          action={
            <button type="button" className="btn btn-sm btn-primary" disabled={busy !== null} onClick={() => void download("json")}>
              {busy === "json" ? "Preparing…" : "Download"}
            </button>
          }
        >
          Your monthly backup: everything, in one file you can import again later.
        </Banner>
      )}
      <Section title="Export">
        <div className="card divide-y divide-line">
          {(
            [
              ["json", "Everything (JSON)", "Every session, set, record, badge and setting. Re-importable."],
              ["csv", "Spreadsheet (CSV)", "Sessions, sets and body log as CSV files in a zip."],
              ["ics", "Calendar (ICS)", "Your sessions as calendar events."],
            ] as const
          ).map(([f, title, body]) => (
            <button key={f} type="button" disabled={busy !== null} onClick={() => void download(f)} className="press flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/60 disabled:opacity-60">
              <DownloadSimple size={20} className="text-dim" />
              <span className="flex-1">
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-dim">{body}</span>
              </span>
              {busy === f && <span className="text-sm text-dim">Preparing…</span>}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Import">
        <button type="button" className="btn btn-secondary w-full" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
          <UploadSimple size={18} /> {busy === "import" ? "Importing…" : "Import a PaceStreak export"}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
        <p className="field-hint">Safe to run twice: sessions already here are skipped. Imported history counts for your streak but not for challenges.</p>
      </Section>
      <ActivityImport />
      <CalendarFeed />
      <Section title="Delete account">
        <button type="button" className="btn btn-danger w-full" onClick={() => setDeleting(true)}>
          <Warning size={18} /> Delete my account
        </button>
      </Section>
      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete your account">
        <div className="space-y-4">
          <p className="text-muted">Export first if you want a copy. Deletion happens after a 30-day grace period and signs you out everywhere now.</p>
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="btn btn-danger w-full" disabled={!password} onClick={deleteAccount}>Continue</button>
        </div>
      </Sheet>
      {confirmSheet}
    </div>
  );
}
