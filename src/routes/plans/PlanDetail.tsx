import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { DisciplineIcon } from "../../components/icons";
import { CalendarCheck, CheckCircle, Circle, ShareNetwork, Copy, MinusCircle, PencilSimple, Plus, Trash, XCircle } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Empty, ErrorState, Field, Loading, PageHeader, Section, Switch } from "../../components/ui";
import { ApiError, api, errorText } from "../../lib/api";
import { WEEKDAYS_LONG, fmtMonthDay } from "../../lib/dates";
import { queryClient, useLibrary, useRoutines } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Plan, PlanSession } from "../../lib/types";
import { plural } from "../../lib/units";
import { useLog } from "../../shell/LogContext";

type Editing = { week: number; index: number | null; session: PlanSession };

const STATUS: Record<NonNullable<PlanSession["status"]>, { label: string; Icon: typeof CheckCircle; className: string }> = {
  done: { label: "Done", Icon: CheckCircle, className: "text-accent-text" },
  today: { label: "Today", Icon: Circle, className: "text-flame-text" },
  upcoming: { label: "Coming up", Icon: Circle, className: "text-dim" },
  skipped: { label: "Skipped", Icon: MinusCircle, className: "text-dim" },
};

/** Strip the server's per-session status before sending a plan back. */
function clean(weeks: PlanSession[][]): PlanSession[][] {
  return weeks.map((w) =>
    w.map(({ day, discipline, title, minutes, distance_km, routine_id, note }) => ({
      day,
      discipline,
      title,
      minutes: minutes ?? null,
      distance_km: distance_km ?? null,
      routine_id: routine_id ?? null,
      note: note ?? null,
    })),
  );
}

export default function PlanDetail() {
  const { id = "" } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const lib = useLibrary();
  const { openLog } = useLog();
  const [confirmSheet, ask] = useConfirm();
  const q = useQuery({
    queryKey: ["plan", id],
    queryFn: () => api<Plan>(`/plans/${id}`),
  });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [renaming, setRenaming] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const [shownWeek, setShownWeek] = useState<number | null>(null);

  const refresh = async (plan?: Plan) => {
    if (plan) queryClient.setQueryData(["plan", id], plan);
    await Promise.all(["plans", "plan-active"].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
  };
  const act = async (fn: () => Promise<Plan | null>, success?: string) => {
    try {
      const plan = await fn();
      await refresh(plan ?? undefined);
      if (success) toast.success(success);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (q.isError) {
    return q.error instanceof ApiError && q.error.status === 404 ? (
      <Empty
        icon={<CalendarCheck size={26} />}
        title="No such plan"
        body="It may have been deleted on another device."
        action={
          <Link to="/plans" className="btn btn-primary">
            All plans
          </Link>
        }
      />
    ) : (
      <ErrorState error={q.error} onRetry={() => void q.refetch()} />
    );
  }
  if (!q.data) return <Loading />;
  const plan = q.data;
  const week = shownWeek ?? plan.current_week ?? 0;
  const sessions = plan.weeks[week] ?? [];
  const dayName = (d: number) => WEEKDAYS_LONG[(me.profile.week_starts_on + d) % 7];

  const save = (weeks: PlanSession[][], repeat = plan.repeat, success?: string) =>
    act(
      () =>
        api<Plan>(`/plans/${id}`, {
          method: "PUT",
          body: {
            name: plan.name,
            description: plan.description,
            weeks: clean(weeks),
            repeat,
          },
        }),
      success,
    );
  const length = plan.weeks_count === 1 ? "week" : `${plan.weeks_count} weeks`;

  const saveSession = () => {
    if (!editing) return;
    const weeks = plan.weeks.map((w) => [...w]);
    if (editing.index === null) weeks[editing.week].push(editing.session);
    else weeks[editing.week][editing.index] = editing.session;
    weeks[editing.week].sort((a, b) => a.day - b.day);
    void save(weeks).then(() => setEditing(null));
  };
  const removeSession = (i: number) => void save(plan.weeks.map((w, wi) => (wi === week ? w.filter((_, si) => si !== i) : w)));
  const addWeek = (copy: boolean) => {
    const weeks = [...plan.weeks, copy ? plan.weeks[week].map((s) => ({ ...s })) : []];
    void save(weeks).then(() => setShownWeek(weeks.length - 1));
  };
  const removeWeek = async () => {
    if (plan.weeks.length <= 1) return;
    if (
      !(await ask({
        title: `Remove week ${week + 1}?`,
        body: "Its sessions go with it. Later weeks move up.",
        confirm: "Remove week",
        danger: true,
      }))
    )
      return;
    await save(plan.weeks.filter((_, i) => i !== week));
    setShownWeek(Math.max(0, week - 1));
  };
  /** Download the plan as a file anyone can import. Uses the share sheet
   * where the browser can share files, a plain download otherwise. */
  const share = async () => {
    try {
      const data = await api<object>(`/plans/${id}/export`);
      const name = `${plan.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "plan"}.pacestreak-plan.json`;
      const file = new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: plan.name }).catch(() => {});
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const remove = async () => {
    if (
      !(await ask({
        title: `Delete ${plan.name}?`,
        body: "Your logged sessions are untouched; only the plan goes.",
        confirm: "Delete plan",
        danger: true,
      }))
    )
      return;
    try {
      await api(`/plans/${id}`, { method: "DELETE" });
      await refresh();
      navigate("/plans", { replace: true });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div>
      <PageHeader
        title={plan.name}
        back="/plans"
        subtitle={
          plan.active && plan.started_on
            ? plan.repeat
              ? plan.weeks_count === 1
                ? `Every week · since ${fmtMonthDay(plan.started_on)}`
                : `Week ${(plan.current_week ?? 0) + 1} of ${plan.weeks_count}, round ${plan.cycle ?? 1} · since ${fmtMonthDay(plan.started_on)}`
              : `Week ${(plan.current_week ?? 0) + 1} of ${plan.weeks_count} · started ${fmtMonthDay(plan.started_on)}`
            : plan.finished_at
              ? "Finished"
              : `${plan.repeat ? `Repeats every ${length}` : plural(plan.weeks_count, "week")} · not started`
        }
        action={
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Rename plan"
            onClick={() =>
              setRenaming({
                name: plan.name,
                description: plan.description ?? "",
              })
            }
          >
            <PencilSimple size={20} />
          </button>
        }
      />
      {plan.description && <p className="text-muted">{plan.description}</p>}

      {plan.progress && (
        <div className="card mt-4 p-4">
          <p className="num text-3xl font-semibold tracking-tight">
            {plan.progress.done}
            <span className="text-base font-normal text-dim"> of {plan.progress.due} due so far</span>
          </p>
          <p className="mt-1 text-sm text-dim">
            {plural(plan.progress.total, "session")} {plan.repeat ? "each time round; the count starts again every round." : "in the whole plan."} Sessions moved to another day that week still count.
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {plan.active ? (
          <button type="button" className="btn btn-secondary flex-1" onClick={() => void act(() => api<Plan>(`/plans/${id}/stop`, { method: "POST" }), "Plan stopped")}>
            <XCircle size={18} /> Stop plan
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary flex-1" onClick={() => void act(() => api<Plan>(`/plans/${id}/start`, { body: { when: "this" } }), "Plan started")}>
              Start this week
            </button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => void act(() => api<Plan>(`/plans/${id}/start`, { body: { when: "next" } }), "Starts next week")}>
              Start next week
            </button>
          </>
        )}
      </div>

      <div className="card mt-4">
        <Switch
          checked={plan.repeat}
          onChange={(v) => void save(plan.weeks, v, v ? `Repeats every ${length}` : "Runs once")}
          label={`Repeat every ${length}`}
          description={plan.repeat ? "Keeps going until you stop it." : `Stops after week ${plan.weeks_count}.`}
        />
      </div>

      <Section title="Weeks">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6" role="tablist" aria-label="Plan weeks">
          {plan.weeks.map((w, i) => {
            const allDone = w.length > 0 && w.every((s) => s.status === "done");
            return (
              <button key={i} type="button" role="tab" aria-selected={i === week} className={`chip h-9 shrink-0 px-3.5 ${i === week ? "chip-accent" : ""}`} onClick={() => setShownWeek(i)}>
                {allDone && <CheckCircle size={14} weight="fill" aria-hidden />}
                Week {i + 1}
                {i === plan.current_week && <span className="sr-only"> (this week)</span>}
              </button>
            );
          })}
        </div>

        <ul className="card mt-3 divide-y divide-line" aria-label={`Week ${week + 1}`}>
          {sessions.length === 0 && <li className="px-4 py-6 text-center text-muted">No sessions this week. A rest week is a plan too.</li>}
          {sessions.map((s, i) => {
            const st = s.status ? STATUS[s.status] : null;
            return (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <DisciplineIcon id={s.discipline} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.title}</span>
                  <span className="block text-sm text-dim">
                    {dayName(s.day)}
                    {s.date ? `, ${fmtMonthDay(s.date)}` : ""}
                    {s.minutes ? ` · ${s.minutes} min` : ""}
                    {s.note ? ` · ${s.note}` : ""}
                  </span>
                  {st && (
                    <span className={`mt-0.5 flex items-center gap-1 text-sm ${st.className}`}>
                      <st.Icon size={14} weight={s.status === "done" ? "fill" : "regular"} aria-hidden />
                      {st.label}
                      {s.moved ? ", on another day" : ""}
                    </span>
                  )}
                </span>
                {s.status === "today" &&
                  (s.routine_id ? (
                    <Link to={`/workouts/live?routine=${s.routine_id}`} className="btn btn-primary btn-sm">
                      Start
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => openLog({ discipline: s.discipline })}>
                      Log
                    </button>
                  ))}
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Edit ${s.title}`} onClick={() => setEditing({ week, index: i, session: { ...s } })}>
                  <PencilSimple size={16} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${s.title}`} onClick={() => removeSession(i)}>
                  <Trash size={16} />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={sessions.length >= 14}
            onClick={() =>
              setEditing({
                week,
                index: null,
                session: {
                  day: 0,
                  discipline: sessions[0]?.discipline ?? "run",
                  title: "",
                  minutes: 30,
                },
              })
            }
          >
            <Plus size={14} /> Add session
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={plan.weeks.length >= 26} onClick={() => addWeek(true)}>
            <Copy size={14} /> Copy to a new week
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={plan.weeks.length >= 26} onClick={() => addWeek(false)}>
            <Plus size={14} /> Empty week
          </button>
          {plan.weeks.length > 1 && (
            <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void removeWeek()}>
              <Trash size={14} /> Remove week {week + 1}
            </button>
          )}
        </div>
      </Section>

      <button type="button" className="btn btn-secondary mt-8 w-full" onClick={() => void share()}>
        <ShareNetwork size={18} /> Share as a file
      </button>
      <p className="field-hint">Your routines go with it; your logged sessions and progress don't.</p>

      <button type="button" className="btn btn-ghost mt-4 w-full text-danger" onClick={() => void remove()}>
        Delete plan
      </button>

      <SessionSheet editing={editing} setEditing={setEditing} onSave={saveSession} dayName={dayName} disciplines={lib?.lib.disciplines ?? []} />

      <Sheet open={renaming !== null} onClose={() => setRenaming(null)} title="Plan details">
        {renaming && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void act(() =>
                api<Plan>(`/plans/${id}`, {
                  method: "PUT",
                  body: {
                    name: renaming.name.trim(),
                    description: renaming.description.trim() || null,
                    weeks: clean(plan.weeks),
                  },
                }),
              ).then(() => setRenaming(null));
            }}
          >
            <Field label="Name" required maxLength={60} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
            <div>
              <label className="field-label" htmlFor="plan-desc">
                Description
              </label>
              <textarea id="plan-desc" className="input" maxLength={500} value={renaming.description} onChange={(e) => setRenaming({ ...renaming, description: e.target.value })} />
            </div>
            <button className="btn btn-primary w-full" disabled={!renaming.name.trim()}>
              Save
            </button>
          </form>
        )}
      </Sheet>
      {confirmSheet}
    </div>
  );
}

function SessionSheet({
  editing,
  setEditing,
  onSave,
  dayName,
  disciplines,
}: {
  editing: Editing | null;
  setEditing: (e: Editing | null) => void;
  onSave: () => void;
  dayName: (d: number) => string;
  disciplines: { id: string; name: string }[];
}) {
  const routines = useRoutines();
  return (
    <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.index === null ? "Add a session" : "Edit session"}>
      {editing && <SessionForm editing={editing} setEditing={setEditing} onSave={onSave} dayName={dayName} disciplines={disciplines} routines={routines.data ?? []} />}
    </Sheet>
  );
}

function SessionForm({
  editing,
  setEditing,
  onSave,
  dayName,
  disciplines,
  routines,
}: {
  editing: Editing;
  setEditing: (e: Editing | null) => void;
  onSave: () => void;
  dayName: (d: number) => string;
  disciplines: { id: string; name: string }[];
  routines: { id: string; name: string }[];
}) {
  const s = editing.session;
  const set = (patch: Partial<PlanSession>) => setEditing({ ...editing, session: { ...s, ...patch } });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div>
        <label className="field-label" htmlFor="ps-day">
          Day
        </label>
        <select id="ps-day" className="input" value={s.day} onChange={(e) => set({ day: Number(e.target.value) })}>
          {Array.from({ length: 7 }, (_, d) => (
            <option key={d} value={d}>
              {dayName(d)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="ps-disc">
          Activity
        </label>
        <select
          id="ps-disc"
          className="input"
          value={s.discipline}
          onChange={(e) =>
            set({
              discipline: e.target.value,
              routine_id: e.target.value === "strength" ? s.routine_id : null,
            })
          }
        >
          {disciplines.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <Field label="What" required maxLength={80} placeholder="e.g. Easy run, 30 min" value={s.title} onChange={(e) => set({ title: e.target.value })} />
      <Field label="Minutes (optional)" inputMode="numeric" value={s.minutes ? String(s.minutes) : ""} onChange={(e) => set({ minutes: Number(e.target.value.replace(/\D/g, "")) || null })} />
      {s.discipline === "strength" && routines.length > 0 && (
        <div>
          <label className="field-label" htmlFor="ps-routine">
            Routine (optional)
          </label>
          <select id="ps-routine" className="input" value={s.routine_id ?? ""} onChange={(e) => set({ routine_id: e.target.value || null })}>
            <option value="">None</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <Field label="Note (optional)" maxLength={200} value={s.note ?? ""} onChange={(e) => set({ note: e.target.value || null })} />
      <button className="btn btn-primary w-full" disabled={!s.title.trim()}>
        Save
      </button>
    </form>
  );
}
