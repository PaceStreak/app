import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useConfirm } from "../../components/Confirm";
import { CalendarBlank, Copy, FileArrowUp, Trash } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Section } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { queryClient, useLibrary } from "../../lib/queries";
import { useMe } from "../../lib/session";
import { syncNow } from "../../lib/sync";
import type { FileImportResult } from "../../lib/types";

const LIFTING_APPS: Record<string, string> = { strong: "Strong", hevy: "Hevy", fitnotes: "FitNotes" };

/** GPX, FIT and CSV files from a watch or another app, and set-by-set
    exports from Strong, Hevy and FitNotes. Nothing here talks to a third
    party: people export a file from wherever it lives and upload it. */
export function ActivityImport() {
  const lib = useLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const me = useMe();
  const [discipline, setDiscipline] = useState("");
  // Strong's export doesn't say which unit its weights are in.
  const [unit, setUnit] = useState<"kg" | "lb">(me?.profile.weight_unit === "lb" ? "lb" : "kg");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FileImportResult | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (discipline) form.append("discipline", discipline);
      form.append("unit", unit);
      const res = await api<FileImportResult>("/workouts/import", { method: "POST", form });
      await syncNow();
      void queryClient.invalidateQueries();
      setResult(res);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Section title="Import from a watch or another app">
      <label className="block">
        <span className="field-label">Count sessions as</span>
        <select className="input" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          <option value="">Detect from the file</option>
          {lib?.lib.disciplines.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="field-label">Weights in a Strong export are in</span>
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as "kg" | "lb")}>
          <option value="kg">Kilograms</option>
          <option value="lb">Pounds</option>
        </select>
      </label>
      <button type="button" className="btn btn-secondary mt-3 w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
        <FileArrowUp size={18} /> {busy ? "Importing…" : "Choose a GPX, FIT or CSV file"}
      </button>
      <input ref={fileRef} type="file" accept=".gpx,.fit,.csv,application/gpx+xml,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      <p className="field-hint">
        Up to 15 MB. Uploading the same file twice is safe, and a session already logged here is skipped. <strong>From Strong, Hevy or FitNotes:</strong> export your workouts as CSV in that app and upload the file as it is; every set comes across, and exercises we don't have become your own custom exercises. Any other CSV needs a <code>date</code> column; <code>type</code>, <code>duration</code>, <code>distance</code> (km) and <code>title</code> are read if present. Imported sessions count for your streak but not for challenges or records.
      </p>
      <Sheet open={result !== null} onClose={() => setResult(null)} title="Import finished">
        {result && (
          <div className="space-y-3">
            <p className="text-lg">
              {result.imported} of {result.found} session{result.found === 1 ? "" : "s"} imported.
            </p>
            {LIFTING_APPS[result.format] && (
              <p className="text-dim">
                From {LIFTING_APPS[result.format]}: {result.sets ?? 0} set{result.sets === 1 ? "" : "s"}.
              </p>
            )}
            {result.duplicates > 0 && <p className="text-dim">{result.duplicates} were already here.</p>}
            {(result.new_exercises?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm">Added as your own exercises (edit them under Exercises to set muscles and cues):</p>
                <p className="mt-1 text-sm text-dim">{result.new_exercises!.join(", ")}</p>
              </div>
            )}
            {result.problems.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-dim">
                {result.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {result.more_problems > 0 && <li>…and {result.more_problems} more.</li>}
              </ul>
            )}
          </div>
        )}
      </Sheet>
    </Section>
  );
}

export function CalendarFeed() {
  const status = useQuery({ queryKey: ["calendar"], queryFn: () => api<{ enabled: boolean; created_at: string | null }>("/me/calendar") });
  const [url, setUrl] = useState<string | null>(null);
  const [confirmSheet, ask] = useConfirm();
  const enabled = status.data?.enabled ?? false;

  const create = async () => {
    if (enabled && !(await ask({ title: "Make a new link?", body: "The current link stops working straight away. Calendars using it need the new one.", confirm: "New link" }))) return;
    try {
      const res = await api<{ url: string }>("/me/calendar", { method: "POST" });
      setUrl(res.url);
      void status.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const revoke = async () => {
    if (!(await ask({ title: "Turn off the calendar link?", body: "Any calendar subscribed to it stops updating.", confirm: "Turn off", danger: true }))) return;
    try {
      await api("/me/calendar", { method: "DELETE" });
      setUrl(null);
      void status.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy; select the link instead.");
    }
  };

  return (
    <Section title="Calendar subscription">
      <p className="mb-3 text-sm text-dim">
        A private link your calendar app can subscribe to: your sessions, pauses and planned training days, kept up to date. It shows discipline, time and distance only, never notes. Anyone with the link can read it, so keep it to yourself.
      </p>
      {url ? (
        <div className="card p-4">
          <p className="field-label">Your link, shown once</p>
          <input className="input font-mono text-xs" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Calendar link" />
          <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => void copy()}>
            <Copy size={16} /> Copy
          </button>
        </div>
      ) : enabled ? (
        <p className="text-sm">A link is active. For security it isn't shown again; make a new one if you've lost it.</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-secondary flex-1" onClick={() => void create()}>
          <CalendarBlank size={18} /> {enabled ? "Make a new link" : "Create a calendar link"}
        </button>
        {enabled && (
          <button type="button" className="btn btn-danger btn-icon" aria-label="Turn off calendar link" onClick={() => void revoke()}>
            <Trash size={18} />
          </button>
        )}
      </div>
      {confirmSheet}
    </Section>
  );
}
