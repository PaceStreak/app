import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { DownloadSimple, Trash, UploadSimple, Warning } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Banner, Field, Section, Segmented, Switch } from "../../components/ui";
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
      <BackupEmail />
      <Section title="Import">
        <button type="button" className="btn btn-secondary w-full" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
          <UploadSimple size={18} /> {busy === "import" ? "Importing…" : "Import a PaceStreak export"}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
        <p className="field-hint">Safe to run twice: sessions already here are skipped. Imported history counts for your streak but not for challenges.</p>
      </Section>
      <ActivityImport />
      <CalendarFeed />
      <Section title="Trash">
        <Link to="/trash" className="btn btn-secondary w-full">
          <Trash size={18} /> Open the trash
        </Link>
        <p className="field-hint">Deleted habits, sessions, meals, recipes and journal entries wait here for 30 days and can be restored with their history.</p>
      </Section>
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

interface BackupPrefs {
  backup_attachment: boolean;
  backup_frequency?: "monthly" | "weekly";
  categories: { id: string; push: boolean; email: boolean }[];
}

/** The monthly backup by email, with the export attached. Off by default
 * and confirmed with a plain warning: it puts everything in an inbox. */
function BackupEmail() {
  const q = useQuery({ queryKey: ["notification-prefs"], queryFn: () => api<BackupPrefs>("/notifications/preferences") });
  const [confirmSheet, ask] = useConfirm();
  const on = !!q.data?.backup_attachment && !!q.data.categories.find((c) => c.id === "backup")?.email;

  const set = async (next: boolean) => {
    if (
      next &&
      !(await ask({
        title: `Email your data every ${weekly ? "week" : "month"}?`,
        body: "A zip of everything you've logged is emailed to you: habits (including any you're breaking), body measurements, food and your journal. Anyone who can read that inbox can read it, and it stays in your email until you delete it. You can turn this off at any time.",
        confirm: "Email it to me",
      }))
    )
      return;
    try {
      await api("/notifications/preferences", {
        method: "PUT",
        body: { backup_attachment: next, channels: next ? { backup: { email: true, push: false } } : undefined },
      });
      await q.refetch();
      toast.success(next ? "Monthly backup email on" : "Monthly backup email off");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const weekly = q.data?.backup_frequency === "weekly";
  const setFrequency = async (frequency: "monthly" | "weekly") => {
    try {
      await api("/notifications/preferences", { method: "PUT", body: { backup_frequency: frequency } });
      await q.refetch();
      toast.success(frequency === "weekly" ? "Weekly, on the first day of your week" : "Monthly, on the 1st");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (!q.data) return null;
  return (
    <Section title="Backup by email">
      <div className="card">
        <Switch
          checked={on}
          onChange={(v) => void set(v)}
          label={`Email me my data every ${weekly ? "week" : "month"}`}
          description={on ? `A zip of your export arrives ${weekly ? "on the first day of your week" : "on the 1st"}. It imports straight back here.` : "Off. You can still download an export any time, above."}
        />
      </div>
      {on && (
        <div className="mt-3 max-w-xs">
          <Segmented
            label="How often"
            value={weekly ? "weekly" : "monthly"}
            onChange={(v) => void setFrequency(v)}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
        </div>
      )}
      {confirmSheet}
    </Section>
  );
}
