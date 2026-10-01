import { useRef, useState } from "react";
import { DownloadSimple } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";
import { api, errorText } from "../lib/api";
import { fmtMonthDay } from "../lib/dates";
import { queryClient } from "../lib/queries";
import type { HabitImportResult } from "../lib/types";

/**
 * Bring history from another habit app. A preview first: which habits, how
 * many days, which merge into one already here. Nothing is written until
 * the person confirms, and days already logged here are never overwritten.
 */
export function HabitImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<HabitImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const send = (f: File, dryRun: boolean) => {
    const form = new FormData();
    form.append("file", f);
    form.append("dry_run", String(dryRun));
    return api<HabitImportResult>("/habits/import", { method: "POST", form });
  };

  const choose = async (f: File) => {
    setBusy(true);
    try {
      setPreview(await send(f, true));
      setFile(f);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirm = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const done = await send(file, false);
      for (const key of ["habits", "habit", "stats"]) void queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(`Imported ${done.imported_days} ${done.imported_days === 1 ? "day" : "days"}`);
      setPreview(null);
      setFile(null);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-ghost mt-2 w-full text-dim" disabled={busy} onClick={() => fileRef.current?.click()}>
        <DownloadSimple size={18} /> Import from another app
      </button>
      <input ref={fileRef} type="file" accept=".csv,.zip,text/csv,application/zip" className="hidden" onChange={(e) => e.target.files?.[0] && void choose(e.target.files[0])} />
      {preview && (
        <Sheet open onClose={() => setPreview(null)} title="Import habits">
          <div className="space-y-4">
            <ul className="card divide-y divide-line">
              {preview.habits.map((h) => (
                <li key={h.name} className="px-4 py-3">
                  <p className="font-medium">{h.name}</p>
                  <p className="text-sm text-dim">
                    {h.days} {h.days === 1 ? "day" : "days"}
                    {h.first && h.last ? `, ${fmtMonthDay(h.first)} to ${fmtMonthDay(h.last)}` : ""} · {h.merge ? "adds to the habit you have" : "new habit"}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">Days you've already logged here stay as they are. New habits start with a weekly target matching how often you really did them; change it any time.</p>
            <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void confirm()}>
              Import
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

/** Supported formats, said once where the button is. */
export const IMPORT_HINT = "Loop Habit Tracker's export, or any CSV with a Date column (year first) and either a Habit column or one column per habit.";
