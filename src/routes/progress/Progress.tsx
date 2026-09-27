import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { BarChart } from "../../components/BarChart";
import { MonthlyGoalCard } from "../../components/MonthlyGoal";
import { LoadCard } from "../../components/LoadCard";
import { Recovery } from "../../components/Recovery";
import { ShareGridButton } from "../../components/Share";
import { Heatmap, HeatLegend } from "../../components/Heatmap";
import { TickBox } from "../../components/Marker";
import { ArrowCounterClockwise, Barbell, CalendarCheck, CalendarStar, CaretDown, Medal, Scales, Snowflake, Sparkle, Trophy } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { ErrorState, List, Loading, PageHeader, RowLink, Section, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import { queryClient, useLibrary, useRestDays, useStats } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Chain } from "../../lib/types";
import { compact, fromKg, fromMetres, plural } from "../../lib/units";

interface ProgressData {
  weeks: {
    week_start: string;
    sessions: number;
    active_days: number;
    minutes: number;
    distance_km: number;
    tonnage_kg: number;
    sets: number;
    feel: number | null;
    target: number | null;
    status: string | null;
  }[];
  muscles: { id: string; name: string; last_7_days: number; weekly_avg_4w: number }[];
}

type Metric = "days" | "minutes" | "distance" | "volume";

export default function Progress() {
  const me = useMe();
  const stats = useStats();
  const restDays = useRestDays();
  const [range, setRange] = useState(12);
  const [metric, setMetric] = useState<Metric>("days");
  const progress = useQuery({
    queryKey: ["progress", range],
    queryFn: () => api<ProgressData>(`/me/progress?weeks=${range}`),
  });

  if (!stats.data && stats.isError) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  const s = stats.data;
  const wu = me.profile.weight_unit;
  const du = me.profile.distance_unit;

  const weeks = progress.data?.weeks ?? [];
  const bars = weeks.map((w) => {
    const label = fmtMonthDay(w.week_start);
    const current = w.status === "open";
    switch (metric) {
      case "days":
        return { key: w.week_start, label, value: w.active_days, display: `${w.active_days} of ${w.target ?? "?"} days`, dim: current };
      case "minutes":
        return { key: w.week_start, label, value: w.minutes, display: `${Math.round(w.minutes / 6) / 10} h`, dim: current };
      case "distance": {
        const v = fromMetres(w.distance_km * 1000, du);
        return { key: w.week_start, label, value: v, display: `${v.toFixed(1)} ${du}`, dim: current };
      }
      case "volume": {
        const v = fromKg(w.tonnage_kg, wu);
        return { key: w.week_start, label, value: v, display: `${compact(v)} ${wu}`, dim: current };
      }
    }
  });
  const targetNow = s?.chains[0]?.target ?? null;

  return (
    <div>
      <PageHeader title="Progress" subtitle="The compounding part." />
      {!s ? (
        <Loading rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-3 divide-x divide-line border-y border-ink/80">
            {[
              ["Sessions", compact(s.totals.sessions)],
              ["Days", compact(s.totals.active_days)],
              ["Hours", compact(s.totals.hours)],
            ].map(([label, value]) => (
              <div key={label} className="px-3 py-3 first:pl-0">
                <p className="text-sm text-dim">{label}</p>
                <p className="num mt-0.5 text-[2rem] leading-none font-extrabold">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <MonthlyGoalCard />
          </div>

          <Section title="Streaks" className="scroll-mt-20" action={<Link to="/settings/training" className="text-sm font-semibold text-accent-text">Manage</Link>}>
            <div id="streaks" className="space-y-3">
              {s.chains.map((c) => (
                <ChainCard key={c.id} chain={c} repairAvailable={s.repair_available} />
              ))}
              <StreakRules />
            </div>
          </Section>

          <Section title="The grid" action={<ShareGridButton days={s.heatmap} today={s.today} weekStartsOn={s.week_starts_on} activeDays={s.totals.active_days} longest={s.chains[0]?.longest ?? 0} />}>
            <div className="ruled">
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="min-w-[640px]">
                  <Heatmap days={s.heatmap} weeks={s.chains[0]?.weeks} today={s.today} weekStartsOn={s.week_starts_on} span={53} plannedDays={s.training_days} pauses={s.pauses ?? []} restDays={restDays.data ?? []} />
                </div>
              </div>
              <div className="mt-3">
                <HeatLegend planned={Boolean(s.training_days)} paused={(s.pauses ?? []).length > 0} rested={(restDays.data ?? []).length > 0} />
              </div>
            </div>
          </Section>

          <Section
            title="Week by week"
            action={
              <select className="input h-9 min-h-0 w-auto py-0 text-sm" value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Range">
                <option value={12}>12 weeks</option>
                <option value={26}>6 months</option>
                <option value={52}>A year</option>
              </select>
            }
          >
            <div className="ruled">
              <Segmented
                label="Measure"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "days", label: "Days" },
                  { value: "minutes", label: "Time" },
                  { value: "distance", label: "Distance" },
                  { value: "volume", label: "Volume" },
                ]}
              />
              <div className="mt-5">
                {progress.isLoading ? (
                  <div className="skeleton h-36" />
                ) : progress.isError ? (
                  <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />
                ) : (
                  <BarChart
                    title={`Weekly ${metric}`}
                    bars={bars}
                    target={metric === "days" ? targetNow : null}
                    targetLabel={metric === "days" ? targetNow != null ? `Your target: ${plural(targetNow, "day")}` : undefined : undefined}
                  />
                )}
              </div>
              {metric === "volume" && <p className="mt-3 text-sm text-dim">Volume is shown for your own curiosity. It never earns XP or ranks you against anyone.</p>}
            </div>
          </Section>

          {weeks.some((w) => w.feel) && (
            <Section title="How it felt">
              <div className="ruled">
                <BarChart
                  title="Average feel per week"
                  bars={weeks.map((w) => ({ key: w.week_start, label: fmtMonthDay(w.week_start), value: w.feel ?? 0, display: w.feel ? `${w.feel} / 5` : "no rating" }))}
                />
                <p className="mt-3 text-sm text-dim">A falling line here often shows up before a stalled one. Worth a lighter week.</p>
              </div>
            </Section>
          )}

          {progress.data && progress.data.muscles.some((m) => m.weekly_avg_4w > 0) && <Muscles muscles={progress.data.muscles} />}
          {s && <Recovery today={s.today} />}
          {s && <LoadCard today={s.today} />}

          <Section title="More">
            <List>
              <RowLink to="/recap" icon={<CalendarCheck size={20} />} title="Weekly recap" detail="Last week, summed up" />
              <RowLink to="/recap/month" icon={<Barbell size={20} />} title="Monthly strength recap" detail="Your lifts against your own history" />
              <RowLink to="/review" icon={<CalendarStar size={20} />} title="Year in review" detail="The weeks you kept this year" />
              <RowLink to="/records" icon={<Trophy size={20} />} title="Personal records" detail={`${s.totals.records} so far`} />
              <RowLink to="/achievements" icon={<Medal size={20} />} title="Achievements" />
              {s.gamification_enabled && <RowLink to="/progress/xp" icon={<Sparkle size={20} />} title="Level and XP" detail={`Level ${s.level.level} · ${s.level.title}`} />}
              <RowLink to="/body" icon={<Scales size={20} />} title="Body" detail="Private measurements" />
              <RowLink to="/exercises" icon={<Barbell size={20} />} title="Exercises" />
            </List>
          </Section>
        </>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  kept: "kept",
  frozen: "covered by a freeze",
  repaired: "repaired",
  missed: "missed",
  open: "in progress",
};

function ChainCard({ chain, repairAvailable }: { chain: Chain; repairAvailable: boolean }) {
  const lib = useLibrary();
  const [busy, setBusy] = useState(false);
  const repair = async () => {
    if (!chain.repairable_week) return;
    setBusy(true);
    try {
      await api(`/chains/${chain.id}/repair`, { body: { week_start: chain.repairable_week } });
      toast.success("Week repaired");
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ruled">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{chain.name === "Everything" ? "Training chain" : chain.name}</p>
          <p className="text-sm text-dim">{plural(chain.target, "day")} a week</p>
        </div>
        <div className="text-right">
          <p className="num text-[2rem] leading-none font-extrabold text-accent-text">
            {chain.current}
            <span className="ml-1 text-sm font-semibold text-muted">wk</span>
          </p>
          <p className="text-xs text-dim">best {chain.longest}</p>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-[repeat(26,minmax(0,1fr))] gap-[3px]" aria-label="The last 26 weeks">
        {/* Always 26 wide: weeks before the history starts are faint
            placeholders, so a new streak isn't one stretched box. */}
        {Array.from({ length: Math.max(0, 26 - chain.weeks.length) }, (_, i) => (
          <li key={`pad${i}`} className="week-mark is-none" aria-hidden />
        ))}
        {chain.weeks.map((w) => (
          <li key={w.week_start} className={`week-mark is-${w.status}`} title={`Week of ${fmtMonthDay(w.week_start)}: ${STATUS_LABEL[w.status]} (${w.days}/${w.target})`}>
            <span className="sr-only">
              Week of {fmtMonthDay(w.week_start)}: {STATUS_LABEL[w.status]}, {w.days} of {w.target}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
        <span className="flex items-center gap-1.5">
          <Snowflake size={14} /> {chain.freezes_available} {chain.freezes_available === 1 ? "freeze" : "freezes"} saved
        </span>
      </div>
      {chain.requirements.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm" aria-label="This week's requirements">
          {chain.requirements.map((r, i) => {
            const met = r.done >= r.days;
            return (
              <li key={i} className="flex items-center gap-2">
                <TickBox done={met} size={16} />
                <span className={met ? "" : "text-muted"}>
                  {r.disciplines.map((d) => lib?.discipline(d)?.name ?? d).join(" or ")}: {r.done} of {r.days}
                  <span className="sr-only">{met ? ", done" : ", not yet"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <dl className="mt-3 grid grid-cols-3 divide-x divide-line border-y border-line text-center" aria-label="Consistency">
        {[
          ["4 weeks", chain.consistency],
          ["12 weeks", chain.consistency_12],
          ["52 weeks", chain.consistency_52],
        ].map(([label, value]) => (
          <div key={label} className="px-2 py-2">
            <dt className="text-xs text-dim">{label}</dt>
            <dd className="num text-lg font-semibold">{value}%</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-xs text-dim">Consistency: how much of each week's plan you did, on average. It survives a broken streak.</p>
      {chain.repairable_week && repairAvailable && (
        <button type="button" className="btn btn-secondary btn-sm mt-4" disabled={busy} onClick={repair}>
          <ArrowCounterClockwise size={16} /> Repair week of {fmtMonthDay(chain.repairable_week)}
        </button>
      )}
    </div>
  );
}

function StreakRules() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-y border-line py-3">
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold" aria-expanded={open} onClick={() => setOpen(!open)}>
        How streaks work here
        <CaretDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>A streak counts weeks, not days. Hit your target number of days and the week is kept, whatever you did with the rest.</li>
          <li>The current week can't break anything until it's over.</li>
          <li>Every four kept weeks earns a freeze (you can hold two). A missed week spends one automatically.</li>
          <li>Once a month you can repair a missed week from the last two, by hand.</li>
          <li>Raising your target only changes weeks from now on. Past weeks keep the target they were judged by.</li>
        </ul>
      )}
    </div>
  );
}

function Muscles({ muscles }: { muscles: ProgressData["muscles"] }) {
  const rows = [...muscles].sort((a, b) => b.weekly_avg_4w - a.weekly_avg_4w);
  const max = Math.max(22, ...rows.map((m) => m.weekly_avg_4w));
  return (
    <Section title="Sets per muscle">
      <div className="ruled">
        <p className="mb-4 text-sm text-dim">Weekly average over four weeks. The shaded band is a common general guideline of about 10 to 20 hard sets a week, not a prescription.</p>
        <ul className="space-y-2.5">
          {rows.filter((m) => m.weekly_avg_4w > 0).map((m) => (
            <li key={m.id} className="grid grid-cols-[96px_1fr_40px] items-center gap-3 text-sm">
              <span className="truncate text-muted">{m.name}</span>
              <span className="muscle-track">
                <span className="muscle-band" style={{ left: `${(10 / max) * 100}%`, width: `${(10 / max) * 100}%` }} />
                <span className="muscle-fill" style={{ width: `${(m.weekly_avg_4w / max) * 100}%` }} />
              </span>
              <span className="num text-right">{m.weekly_avg_4w}</span>
            </li>
          ))}
        </ul>
        {rows.some((m) => m.weekly_avg_4w === 0) && (
          <p className="mt-4 text-sm text-muted">
            Nothing in four weeks for {rows.filter((m) => m.weekly_avg_4w === 0).map((m) => m.name.toLowerCase()).join(", ")}. Fine if that's the plan; worth a look if it isn't.
          </p>
        )}
      </div>
    </Section>
  );
}
