import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { Pause as PauseIcon, Play } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Section, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { addDays, fmtMonthDay, localToday } from "../../lib/dates";
import { queryClient } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Pause, PauseReason, PauseState } from "../../lib/types";

const REASONS: { value: PauseReason; label: string }[] = [
  { value: "injury", label: "Injury" },
  { value: "illness", label: "Illness" },
  { value: "life", label: "Life" },
  { value: "other", label: "Other" },
];

// Mirrors app/training/pauses.py. The API is the authority; these only keep
// the date pickers from offering days it would refuse.
const BACKDATE_DAYS = 14;
const LEAD_DAYS = 30;
const MAX_DAYS = 84;

async function refreshAll() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pauses"] }),
    queryClient.invalidateQueries({ queryKey: ["stats"] }),
    queryClient.invalidateQueries({ queryKey: ["chains"] }),
  ]);
}

function describe(p: Pause) {
  const from = fmtMonthDay(p.starts_on);
  if (p.upcoming) return `Planned from ${from}${p.ends_on ? ` to ${fmtMonthDay(p.ends_on)}` : ""}`;
  if (p.active) return `Since ${from}${p.ends_on ? `, until ${fmtMonthDay(p.ends_on)}` : ", until you're back"}`;
  return `${from} to ${fmtMonthDay(p.effective_end)}`;
}

export function PauseSection() {
  const me = useMe();
  const today = localToday(me.profile.timezone);
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const state = useQuery({ queryKey: ["pauses"], queryFn: () => api<PauseState>("/pauses") });
  const [open, setOpen] = useState(false);
  const [confirmSheet, ask] = useConfirm();

  useEffect(() => {
    if (location.hash === "#pause") ref.current?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  const pauses = state.data?.pauses ?? [];
  const current = pauses.find((p) => p.active || p.upcoming);
  const past = pauses.filter((p) => !p.active && !p.upcoming).slice(-3).reverse();

  const end = async (p: Pause) => {
    const starting = p.upcoming;
    if (!(await ask({ title: starting ? "Cancel this pause?" : "End the pause?", body: starting ? "It hasn't started, so it is simply removed." : "Today counts again from now. Weeks it already covered stay covered.", confirm: starting ? "Cancel pause" : "I'm back" }))) return;
    try {
      await api(`/pauses/${p.id}/end`, { method: "POST" });
      await refreshAll();
      toast.success(starting ? "Pause cancelled" : "Welcome back", { body: starting ? undefined : "Start with something easy." });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Section title="Pause">
      <div ref={ref} id="pause" className="scroll-mt-24">
        <p className="mb-3 text-sm text-dim">
          Injured, ill, or life got in the way? A pause shelters any week it covers for four days or more: it won't break your streak, and reminders stop. Paused weeks don't add to the streak or earn XP.
        </p>
        {current ? (
          <div className="card flex items-center gap-3 p-4">
            <PauseIcon size={22} className="shrink-0 text-dim" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{current.upcoming ? "Pause planned" : "Streak paused"}</p>
              <p className="text-sm text-dim">
                {REASONS.find((r) => r.value === current.reason)?.label} · {describe(current)}
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void end(current)}>
              <Play size={16} /> {current.upcoming ? "Cancel" : "I'm back"}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary w-full" onClick={() => setOpen(true)}>
            <PauseIcon size={18} /> Pause my streak
          </button>
        )}
        {state.data && (
          <p className="field-hint">
            {state.data.budget.days_used} of {state.data.budget.days_allowed} pause days used in the last year.
          </p>
        )}
        {past.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-dim">
            {past.map((p) => (
              <li key={p.id}>
                {REASONS.find((r) => r.value === p.reason)?.label}: {describe(p)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <PauseSheet open={open} today={today} onClose={() => setOpen(false)} />
      {confirmSheet}
    </Section>
  );
}

function PauseSheet({ open, today, onClose }: { open: boolean; today: string; onClose: () => void }) {
  const [reason, setReason] = useState<PauseReason>("injury");
  const [start, setStart] = useState(today);
  const [openEnded, setOpenEnded] = useState(true);
  const [end, setEnd] = useState(addDays(today, 13));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api("/pauses", {
        body: { starts_on: start, ends_on: openEnded ? null : end, reason, note: note.trim() || null },
      });
      await refreshAll();
      toast.success("Streak paused", { body: "Rest up. Log anything you do; it still counts." });
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Pause your streak"
      footer={
        <button type="button" className="btn btn-primary flex-1" disabled={saving} onClick={() => void submit()}>
          {saving ? "Pausing…" : "Pause"}
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="field-label">Why</p>
          <Segmented label="Reason" value={reason} onChange={setReason} options={REASONS} />
        </div>
        <label className="block">
          <span className="field-label">From</span>
          <input className="input" type="date" value={start} min={addDays(today, -BACKDATE_DAYS)} max={addDays(today, LEAD_DAYS)} onChange={(e) => setStart(e.target.value)} />
        </label>
        <div>
          <p className="field-label">Until</p>
          <Segmented
            label="Until"
            value={openEnded ? "open" : "date"}
            onChange={(v) => setOpenEnded(v === "open")}
            options={[
              { value: "open", label: "I'm back" },
              { value: "date", label: "A date" },
            ]}
          />
          {!openEnded && (
            <input className="input mt-3" type="date" aria-label="Last day of the pause" value={end} min={start} max={addDays(start, MAX_DAYS - 1)} onChange={(e) => setEnd(e.target.value)} />
          )}
          <p className="field-hint">
            {openEnded ? `Runs until you end it, for at most ${MAX_DAYS / 7} weeks.` : "The last day of the pause. You can end it early."}
          </p>
        </div>
        <label className="block">
          <span className="field-label">Note (only you see this)</span>
          <input className="input" maxLength={280} value={note} placeholder="e.g. Sprained ankle" onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
    </Sheet>
  );
}
