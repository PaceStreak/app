import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmtMonthDay } from "../lib/dates";
import { queryClient } from "../lib/queries";
import { sendOrQueue } from "../lib/requests";
import type { Reflection } from "../lib/types";
import { MagnifyingGlass, NotePencil } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";

export function useReflections() {
  return useQuery({ queryKey: ["reflections"], queryFn: () => api<Reflection[]>("/reflections") });
}

/**
 * Two optional lines about a week: what went well, and what to change. Kept
 * private, and searchable from the list of past weeks. Reflecting on a week,
 * rather than just logging it, is what turns a streak into learning.
 */
export function ReflectionBox({ week }: { week: string }) {
  const all = useReflections();
  const saved = all.data?.find((r) => r.week_start === week);
  const [wentWell, setWentWell] = useState("");
  const [change, setChange] = useState("");
  const [listOpen, setListOpen] = useState(false);
  useEffect(() => {
    setWentWell(saved?.went_well ?? "");
    setChange(saved?.change ?? "");
  }, [saved?.went_well, saved?.change, week]);
  const dirty = wentWell !== (saved?.went_well ?? "") || change !== (saved?.change ?? "");

  const save = async () => {
    const result = await sendOrQueue(`/reflections/${week}`, "PUT", { went_well: wentWell, change });
    queryClient.setQueryData<Reflection[]>(["reflections"], (old) => {
      const rest = (old ?? []).filter((r) => r.week_start !== week);
      return wentWell.trim() || change.trim() ? [{ week_start: week, went_well: wentWell.trim() || null, change: change.trim() || null }, ...rest].sort((a, b) => (a.week_start < b.week_start ? 1 : -1)) : rest;
    });
    toast.success(result === "queued" ? "Saved on this phone; it syncs when you're online." : "Saved");
  };

  return (
    <section className="card mt-6 p-4" aria-labelledby="reflect-title">
      <h2 id="reflect-title" className="flex items-center gap-2 font-semibold">
        <NotePencil size={18} className="text-dim" aria-hidden /> Looking back
      </h2>
      <p className="mt-0.5 text-sm text-dim">Optional and private. A line is plenty.</p>
      <label className="field-label mt-3" htmlFor="went-well">What went well?</label>
      <textarea id="went-well" className="input" rows={2} maxLength={500} value={wentWell} onChange={(e) => setWentWell(e.target.value)} placeholder="Three early starts. The new routine felt good." />
      <label className="field-label mt-3" htmlFor="change">What would you change?</label>
      <textarea id="change" className="input" rows={2} maxLength={500} value={change} onChange={(e) => setChange(e.target.value)} placeholder="Pack the bag the night before." />
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-secondary flex-1" disabled={!dirty} onClick={() => void save()}>
          Save
        </button>
        {(all.data?.length ?? 0) > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setListOpen(true)}>
            Past weeks ({all.data!.length})
          </button>
        )}
      </div>
      <ReflectionList open={listOpen} onClose={() => setListOpen(false)} items={all.data ?? []} />
    </section>
  );
}

function ReflectionList({ open, onClose, items }: { open: boolean; onClose: () => void; items: Reflection[] }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter((r) => {
    const text = `${r.went_well ?? ""} ${r.change ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
  return (
    <Sheet open={open} onClose={onClose} title="Past weeks" size="full">
      <div className="relative mb-3">
        <MagnifyingGlass size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dim" aria-hidden />
        <input className="input pl-11" placeholder="Search your reflections" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search reflections" />
      </div>
      <ul className="divide-y divide-line">
        {shown.map((r) => (
          <li key={r.week_start} className="py-3 text-sm">
            <p className="font-semibold">Week of {fmtMonthDay(r.week_start)}</p>
            {r.went_well && <p className="mt-1 text-muted">Went well: {r.went_well}</p>}
            {r.change && <p className="mt-1 text-muted">Change: {r.change}</p>}
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="py-8 text-center text-muted">Nothing matches "{q}".</p>}
    </Sheet>
  );
}
