import { useQuery } from "@tanstack/react-query";
import { BarChart } from "../../components/BarChart";
import { ErrorState, Loading, PageHeader, Section } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtMonthDay, relativeDay } from "../../lib/dates";
import type { LevelInfo } from "../../lib/types";

interface XpData {
  level: LevelInfo;
  by_source: Record<string, number>;
  season_xp: number;
  recent: { source: string; amount: number; date: string }[];
  weekly: [string, number][];
}

const SOURCES: Record<string, { label: string; why: string }> = {
  training_day: { label: "Training days", why: "Each day you train, up to your target plus one each week." },
  kept_week: { label: "Kept weeks", why: "Hitting your weekly target." },
  milestone: { label: "Streak milestones", why: "4, 8, 12, 26, 52 weeks in a row." },
  detail: { label: "Logging detail", why: "A flat bonus for a complete log, never for bigger numbers." },
  second_session: { label: "Second sessions", why: "A small bonus for a second session in a day. More pays nothing." },
  pr: { label: "Personal records", why: "Beating your own best, within a believable margin." },
  achievement: { label: "Achievements", why: "One-off badges." },
};

export default function Xp() {
  const q = useQuery({ queryKey: ["xp"], queryFn: () => api<XpData>("/me/xp") });
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const total = d ? Object.values(d.by_source).reduce((a, b) => a + b, 0) || 1 : 1;
  return (
    <div>
      <PageHeader title="Level and XP" back="/progress" />
      {!d ? (
        <Loading />
      ) : (
        <>
          <div className="card-raised p-5">
            <p className="text-sm text-dim">Level {d.level.level}</p>
            <p className="text-3xl font-semibold tracking-tight">{d.level.title}</p>
            <div className="mt-4 h-2.5 rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={d.level.level_span} aria-valuenow={d.level.into_level} aria-label="Progress to next level">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(d.level.into_level / d.level.level_span) * 100}%` }} />
            </div>
            <p className="num mt-2 text-sm text-muted">
              {d.level.to_next} XP to level {d.level.level + 1} · {d.level.total_xp} total · {d.season_xp} this season
            </p>
          </div>

          <Section title="Where it came from">
            <p className="mb-4 text-[0.95rem] text-muted">XP pays for showing up and logging honestly. Lifting heavier, training longer or training every day earns nothing extra.</p>
            <ul className="card divide-y divide-line">
              {Object.entries(SOURCES)
                .filter(([k]) => d.by_source[k])
                .sort((a, b) => (d.by_source[b[0]] ?? 0) - (d.by_source[a[0]] ?? 0))
                .map(([k, meta]) => (
                  <li key={k} className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{meta.label}</span>
                      <span className="num text-sm text-muted">{d.by_source[k]} XP</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-[var(--chart)]" style={{ width: `${((d.by_source[k] ?? 0) / total) * 100}%` }} />
                    </div>
                    <p className="mt-1.5 text-sm text-dim">{meta.why}</p>
                  </li>
                ))}
            </ul>
          </Section>

          {d.weekly.length > 1 && (
            <Section title="Weekly XP">
              <div className="card p-4">
                <BarChart title="XP per week" bars={d.weekly.map(([w, v]) => ({ key: w, label: fmtMonthDay(w), value: v, display: `${v} XP` }))} />
              </div>
            </Section>
          )}

          <Section title="Recent">
            <ul className="card divide-y divide-line">
              {d.recent.slice(0, 15).map((r, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{SOURCES[r.source]?.label ?? r.source}</span>
                  <span className="num text-dim">
                    +{r.amount} · {relativeDay(r.date, new Date().toISOString().slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
