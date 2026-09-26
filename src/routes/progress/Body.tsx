import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BarChart } from "../../components/BarChart";
import { LineChart } from "../../components/LineChart";
import { ProgressPhotos } from "../../components/ProgressPhotos";
import { Lock, Trash } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { Banner, Empty, ErrorState, Loading, PageHeader, Section, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { addDays, fmtFullDay, fmtMonthDay, localDateOf, localToday, timeOfDay, toLocalInput, uuid } from "../../lib/dates";
import type { QueuedRequest } from "../../lib/db";
import { queryClient } from "../../lib/queries";
import { useMe } from "../../lib/session";
import { onQueueChange, sendOrQueue } from "../../lib/requests";
import type { BodyMetric, WeighIn, WeighInMoment, WeightGoal } from "../../lib/types";
import { fromKg, parseNumber, toKg } from "../../lib/units";
import { MOMENTS, changeOver, dailySeries, daySwing, goalView, guessMoment, momentLabel, signed } from "../../lib/weight";

type Field = "body_fat_pct" | "waist_cm" | "resting_hr" | "sleep_hours";
const EMPTY: Record<Field, string> = { body_fat_pct: "", waist_cm: "", resting_hr: "", sleep_hours: "" };

export default function Body() {
  const me = useMe();
  const wu = me.profile.weight_unit;
  const today = localToday(me.profile.timezone);
  const weighs = useQuery({ queryKey: ["weigh-ins"], queryFn: () => api<WeighIn[]>("/weigh-ins?days=730") });
  const q = useQuery({ queryKey: ["body"], queryFn: () => api<BodyMetric[]>("/body-metrics?days=365") });
  const todays = q.data?.find((m) => m.date === today);
  const goalQ = useQuery({ queryKey: ["weight-goal"], queryFn: () => api<WeightGoal | null>("/weight-goal") });
  // Writes made with no signal, shown straight away and sent later.
  const [queue, setQueue] = useState<QueuedRequest[]>([]);
  useEffect(() => onQueueChange(setQueue), []);

  const [kg, setKg] = useState("");
  const [moment, setMoment] = useState<WeighInMoment>(() => guessMoment(new Date().getHours()));
  const [when, setWhen] = useState<string | null>(null);
  const [filter, setFilter] = useState<WeighInMoment | "all">("all");
  const [range, setRange] = useState<30 | 90 | 365>(90);
  const [form, setForm] = useState(EMPTY);
  const [chart, setChart] = useState<Field>("sleep_hours");
  const [busy, setBusy] = useState(false);

  const kgText = (v: number, digits = 1) => `${fromKg(v, wu).toFixed(digits)} ${wu}`;

  const weighIn = async () => {
    const value = parseNumber(kg);
    if (value == null || value <= 0) return;
    setBusy(true);
    try {
      const result = await sendOrQueue(`/weigh-ins/${uuid()}`, "PUT", {
        weighed_at: when ? new Date(when).toISOString() : new Date().toISOString(),
        moment,
        weight_kg: toKg(value, wu),
      });
      setKg("");
      setWhen(null);
      await queryClient.invalidateQueries({ queryKey: ["weigh-ins"] });
      toast.success(result === "queued" ? "Saved on this phone. It syncs when you're back online." : `Saved · ${momentLabel(moment).toLowerCase()}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const removeWeighIn = async (id: string) => {
    await sendOrQueue(`/weigh-ins/${id}`, "DELETE");
    await queryClient.invalidateQueries({ queryKey: ["weigh-ins"] });
  };

  const save = async () => {
    setBusy(true);
    try {
      const result = await sendOrQueue(`/body-metrics/${today}`, "PUT", {
        body_fat_pct: parseNumber(form.body_fat_pct) ?? todays?.body_fat_pct ?? null,
        waist_cm: parseNumber(form.waist_cm) ?? todays?.waist_cm ?? null,
        resting_hr: parseNumber(form.resting_hr) ?? todays?.resting_hr ?? null,
        sleep_hours: parseNumber(form.sleep_hours) ?? todays?.sleep_hours ?? null,
      });
      setForm(EMPTY);
      await queryClient.invalidateQueries({ queryKey: ["body"] });
      toast.success(result === "queued" ? "Saved on this phone. It syncs when you're back online." : "Saved for today");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (date: string) => {
    await sendOrQueue(`/body-metrics/${date}`, "DELETE");
    await queryClient.invalidateQueries({ queryKey: ["body"] });
  };

  const tz = me.profile.timezone;
  const all = useMemo(() => {
    const deleted = new Set(queue.filter((r) => r.method === "DELETE" && r.path.startsWith("/weigh-ins/")).map((r) => r.path.slice(11)));
    const pending: WeighIn[] = queue
      .filter((r) => r.method === "PUT" && r.path.startsWith("/weigh-ins/"))
      .map((r) => {
        const b = r.body as { weighed_at: string; moment: WeighInMoment; weight_kg: number };
        return { id: r.path.slice(11), weighed_at: b.weighed_at, date: localDateOf(new Date(b.weighed_at), tz), moment: b.moment, weight_kg: b.weight_kg, note: null, pending: true };
      });
    const known = new Set(pending.map((w) => w.id));
    return [...(weighs.data ?? []).filter((w) => !deleted.has(w.id) && !known.has(w.id)), ...pending].sort((x, y) => (x.weighed_at < y.weighed_at ? -1 : 1));
  }, [weighs.data, queue, tz]);
  const series = useMemo(() => dailySeries(all, filter), [all, filter]);
  // Goals are measured on every reading, the same basis the server starts them from.
  const allSeries = useMemo(() => dailySeries(all), [all]);
  const shown = series.filter((p) => p.date > addDays(today, -range));
  const todaysWeighs = all.filter((w) => w.date === today);
  const swing = daySwing(all, today);
  const changes = ([7, 30, 90] as const).map((d) => ({ days: d, c: changeOver(series, d) }));
  const usedMoments = new Set(all.map((w) => w.moment));

  const metricSeries = (q.data ?? []).filter((m) => m[chart] != null).slice(-30);
  const fmt = (m: BodyMetric, f: Field) => {
    const v = m[f];
    if (v == null) return "";
    if (f === "body_fat_pct") return `${v}% fat`;
    if (f === "waist_cm") return `${v} cm`;
    if (f === "resting_hr") return `${v} bpm`;
    return `${v} h`;
  };

  const input = (f: Field, label: string, suffix: string) => (
    <div>
      <label className="field-label" htmlFor={`b-${f}`}>{label}</label>
      <div className="relative">
        <input id={`b-${f}`} className="input num pr-12" inputMode="decimal" placeholder={todays?.[f] != null ? String(todays[f]) : ""} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
        <span className="absolute inset-y-0 right-4 flex items-center text-sm text-dim">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Body" back="/progress" />
      <Banner icon={<Lock size={18} />}>
        Only you ever see this. It never feeds XP, badges, leaderboards or anything another person can see, by design.
      </Banner>

      <Section title="Weigh in">
        <div className="card space-y-4 p-4">
          <div>
            <label className="field-label" htmlFor="w-kg">Weight</label>
            <div className="relative">
              <input id="w-kg" className="input num pr-12 text-lg" inputMode="decimal" autoComplete="off" value={kg} onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void weighIn()} />
              <span className="absolute inset-y-0 right-4 flex items-center text-sm text-dim">{wu}</span>
            </div>
          </div>
          <div>
            <p className="field-label">When in your day</p>
            <Segmented label="When in your day" value={moment} onChange={setMoment} options={MOMENTS.map((m) => ({ value: m.value, label: m.short }))} />
          </div>
          {when == null ? (
            <button type="button" className="text-sm text-dim underline underline-offset-2" onClick={() => setWhen(toLocalInput(new Date().toISOString()))}>
              Weighed earlier?
            </button>
          ) : (
            <div>
              <label className="field-label" htmlFor="w-when">Time</label>
              <input id="w-when" type="datetime-local" className="input" value={when} min={toLocalInput(new Date(Date.now() - 30 * 86_400_000).toISOString())} max={toLocalInput(new Date().toISOString())} onChange={(e) => setWhen(e.target.value)} />
            </div>
          )}
          <button type="button" className="btn btn-primary w-full" disabled={busy || !parseNumber(kg)} onClick={() => void weighIn()}>
            Save weigh-in
          </button>
          {todaysWeighs.length > 0 && (
            <div className="border-t border-line pt-3">
              <ul className="space-y-1.5 text-sm">
                {todaysWeighs.map((w) => (
                  <li key={w.id} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-dim">{timeOfDay(w.weighed_at)}</span>
                    <span className="flex-1 truncate text-muted">{momentLabel(w.moment)}</span>
                    <span className="num">{kgText(w.weight_kg)}</span>
                    {w.pending && <span className="chip h-5 px-1.5 text-[0.7rem]" title="Saved on this phone, waiting for signal">Waiting</span>}
                    <button type="button" className="btn btn-ghost btn-icon btn-sm text-dim" aria-label={`Delete the ${timeOfDay(w.weighed_at)} weigh-in`} onClick={() => void removeWeighIn(w.id)}>
                      <Trash size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              {swing != null && (
                <p className="mt-2 text-xs text-dim">
                  {kgText(swing)} between your lightest and heaviest reading today. Water and food move it; it isn't fat.
                </p>
              )}
            </div>
          )}
        </div>
      </Section>

      {weighs.isError ? (
        <ErrorState error={weighs.error} onRetry={() => void weighs.refetch()} />
      ) : !weighs.data ? (
        <Loading />
      ) : all.length > 0 ? (
        <Section title="Weight trend">
          <div className="card space-y-4 p-4">
            <Segmented
              label="Which readings"
              value={filter}
              onChange={setFilter}
              options={[{ value: "all" as const, label: "All" }, ...MOMENTS.filter((m) => m.value !== "other" && usedMoments.has(m.value)).map((m) => ({ value: m.value, label: m.short }))]}
            />
            {series.length === 0 ? (
              <p className="py-8 text-center text-sm text-dim">No readings at this time of day yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <div>
                    <p className="text-sm text-dim">7-day average</p>
                    <p className="num mt-0.5 text-2xl font-semibold tracking-tight">{kgText(series[series.length - 1].avg)}</p>
                  </div>
                  {changes.map(({ days, c }) => (
                    <div key={days}>
                      <p className="text-sm text-dim">{days} days</p>
                      {c ? (
                        <>
                          <p className="num mt-0.5 text-lg font-semibold">{signed(fromKg(c.kg, wu))} {wu}</p>
                          <p className="num text-sm text-muted">{signed(c.pct, 2)}%</p>
                        </>
                      ) : (
                        <p className="mt-0.5 text-sm text-dim">Not enough history</p>
                      )}
                    </div>
                  ))}
                </div>
                <Segmented label="Range" value={range} onChange={setRange} options={[{ value: 30 as const, label: "30 days" }, { value: 90 as const, label: "90 days" }, { value: 365 as const, label: "Year" }]} />
                {shown.length ? (
                  <LineChart
                    title="Weight by day, with the 7-day average"
                    unit={wu}
                    points={shown.map((p) => ({ key: p.date, label: fmtMonthDay(p.date), value: fromKg(p.kg, wu), trend: fromKg(p.avg, wu), display: kgText(p.kg), trendDisplay: kgText(p.avg) }))}
                  />
                ) : (
                  <p className="py-8 text-center text-sm text-dim">Nothing in this range.</p>
                )}
                <p className="text-xs text-dim">
                  The line is a 7-day average, and changes compare averages, so one salty dinner doesn't show up as a trend. For the steadiest line, compare readings from the same time of day.
                </p>
              </>
            )}
          </div>
        </Section>
      ) : null}

      {all.length > 0 && (
        <Section title="Goal">
          <GoalCard goal={goalQ.data ?? null} loading={!goalQ.isFetched} series={allSeries} today={today} unit={wu} />
        </Section>
      )}

      <Section title="Progress photos">
        <ProgressPhotos today={today} />
      </Section>

      <Section title="Other measures">
        <div className="card space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            {input("sleep_hours", "Sleep", "h")}
            {input("resting_hr", "Resting HR", "bpm")}
            {input("waist_cm", "Waist", "cm")}
            {input("body_fat_pct", "Body fat", "%")}
          </div>
          <button type="button" className="btn btn-secondary w-full" disabled={busy || Object.values(form).every((v) => !v)} onClick={() => void save()}>
            Save for today
          </button>
        </div>
      </Section>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <Loading />
      ) : q.data.length === 0 && all.length === 0 ? (
        <Empty title="Nothing logged yet" body="Weight through the day, sleep and resting heart rate over time, if you want them." />
      ) : (
        <>
          {q.data.length > 0 && (
            <Section title="Measures trend">
              <div className="card p-4">
                <Segmented label="Measure" value={chart} onChange={setChart} options={[{ value: "sleep_hours", label: "Sleep" }, { value: "resting_hr", label: "HR" }, { value: "waist_cm", label: "Waist" }, { value: "body_fat_pct", label: "Fat" }]} />
                <div className="mt-5">
                  {metricSeries.length ? (
                    <BarChart title="Body trend" bars={metricSeries.map((m) => ({ key: m.date, label: fmtMonthDay(m.date), value: m[chart]!, display: fmt(m, chart) }))} />
                  ) : (
                    <p className="py-8 text-center text-sm text-dim">Nothing recorded for this yet.</p>
                  )}
                </div>
              </div>
            </Section>
          )}
          <Section title="History">
            <ul className="card divide-y divide-line">
              {historyDays(all, q.data).slice(0, 60).map((day) => {
                const dayWeighs = all.filter((w) => w.date === day);
                const m = q.data.find((x) => x.date === day);
                const parts = [
                  ...dayWeighs.map((w) => `${kgText(w.weight_kg)} ${MOMENTS.find((x) => x.value === w.moment)!.short.toLowerCase()}`),
                  ...(m ? (["sleep_hours", "resting_hr", "waist_cm", "body_fat_pct"] as Field[]).map((f) => fmt(m, f)) : []),
                ].filter(Boolean);
                return (
                  <li key={day} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="w-16 shrink-0 text-dim">{fmtMonthDay(day)}</span>
                    <span className="num flex-1 truncate">{parts.join(" · ")}</span>
                    {m && (
                      <button type="button" className="btn btn-ghost btn-icon btn-sm text-dim" aria-label={`Delete other measures for ${fmtMonthDay(day)}`} onClick={() => void remove(day)}>
                        <Trash size={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}

function historyDays(weighs: WeighIn[], metrics: BodyMetric[]): string[] {
  return [...new Set([...weighs.map((w) => w.date), ...metrics.map((m) => m.date)])].sort().reverse();
}

function GoalCard({ goal, loading, series, today, unit }: { goal: WeightGoal | null; loading: boolean; series: ReturnType<typeof dailySeries>; today: string; unit: "kg" | "lb" }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState("");
  const [step, setStep] = useState(unit === "kg" ? 2 : 5);
  const view = goal ? goalView(series, goal, today) : null;
  const fmt = (kg: number) => `${fromKg(kg, unit).toFixed(1)} ${unit}`;

  const save = async () => {
    const t = parseNumber(target);
    if (t == null) return;
    try {
      await api("/weight-goal", { method: "PUT", body: { target_kg: toKg(t, unit), milestone_kg: toKg(step, unit) } });
      setEditing(false);
      setTarget("");
      await queryClient.invalidateQueries({ queryKey: ["weight-goal"] });
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const clear = async () => {
    await api("/weight-goal", { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["weight-goal"] });
  };

  if (loading) return <Loading rows={1} />;
  if (!goal || editing) {
    return (
      <div className="card space-y-4 p-4">
        <p className="text-sm text-muted">
          Optional, and only ever seen by you. Progress is measured on the 7-day average, broken into small milestones. There are no rewards for it, on purpose.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="goal-target">Target</label>
            <div className="relative">
              <input id="goal-target" className="input num pr-12" inputMode="decimal" value={target} placeholder={goal ? fromKg(goal.target_kg, unit).toFixed(1) : ""} onChange={(e) => setTarget(e.target.value)} />
              <span className="absolute inset-y-0 right-4 flex items-center text-sm text-dim">{unit}</span>
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="goal-step">Milestones every</label>
            <select id="goal-step" className="input" value={step} onChange={(e) => setStep(Number(e.target.value))}>
              {(unit === "kg" ? [1, 2, 5] : [2, 5, 10]).map((v) => (
                <option key={v} value={v}>{v} {unit}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          {goal && (
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
          <button type="button" className="btn btn-secondary flex-1" disabled={parseNumber(target) == null} onClick={() => void save()}>
            {goal ? "Update goal" : "Set a goal"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">
          {fmt(goal.target_kg)} <span className="text-sm font-normal text-dim">from {fmt(goal.start_kg)} on {fmtMonthDay(goal.set_on)}</span>
        </p>
        <button type="button" className="text-sm text-dim underline underline-offset-2" onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
      {view && (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(view.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to goal">
            <div className="h-full rounded-full bg-accent" style={{ width: `${view.progress * 100}%` }} />
          </div>
          <p className="text-sm text-muted">
            {view.reached
              ? `You're there: the 7-day average is ${fmt(view.current)}. Keep logging if it's useful, or clear the goal.`
              : `Now ${fmt(view.current)} · milestone ${view.milestonesPassed} of ${view.milestonesTotal}, next at ${fmt(view.nextMilestone!)}.`}
          </p>
          {!view.reached && (
            <p className="text-sm text-dim">
              {view.eta
                ? `At the last four weeks' pace (${signed(fromKg(view.rate!, unit))} ${unit} a week), around ${fmtFullDay(view.eta)}.`
                : view.rate == null
                  ? "A few more weeks of weigh-ins and this will show a pace."
                  : "The trend isn't heading that way at the moment. That's information, not a verdict."}
            </p>
          )}
        </>
      )}
      <button type="button" className="text-xs text-dim underline underline-offset-2" onClick={() => void clear()}>
        Clear goal
      </button>
    </div>
  );
}
