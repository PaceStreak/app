import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Lightbulb, Lock } from "../components/phosphor";
import { Empty, ErrorState, Loading, PageHeader, Section } from "../components/ui";
import { api } from "../lib/api";
import type { Insights as InsightsData } from "../lib/types";

/** What to log for more patterns, and where. Only the ones still thin. */
const SOURCES: { key: string; label: string; to: string }[] = [
  { key: "mood", label: "Log your mood", to: "/journal" },
  { key: "sleep", label: "Do the morning check-in", to: "/" },
  { key: "sleep_hours", label: "Log sleep hours", to: "/body" },
  { key: "kcal", label: "Log food", to: "/food" },
  { key: "habits", label: "Track a habit", to: "/habits" },
  { key: "trained", label: "Log a session", to: "/log" },
];
const ENOUGH = 30;

export default function Insights() {
  const q = useQuery({ queryKey: ["insights"], queryFn: () => api<InsightsData>("/insights"), staleTime: 10 * 60_000 });
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const data = q.data;
  const thin = data ? SOURCES.filter((s) => (data.coverage[s.key] ?? 0) < ENOUGH) : [];

  return (
    <div>
      <PageHeader
        title="Insights"
        back="/you"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Lock size={14} aria-hidden /> Worked out from your own data, on our server, by plain arithmetic
          </span>
        }
      />
      {!data ? (
        <Loading />
      ) : data.insights.length === 0 ? (
        <Empty
          icon={<Lightbulb size={26} />}
          title="No clear patterns yet"
          body="Patterns show once a few weeks of days can be compared, and only when the difference is too big to be chance."
        />
      ) : (
        <Section title={`The last ${data.window_days} days`}>
          <ul className="space-y-3">
            {data.insights.map((i) => (
              <li key={`${i.driver}:${i.outcome}`} className="card p-4">
                <p className="text-[1.05rem] leading-snug">{i.text}</p>
                <p className="mt-2 text-sm text-dim">
                  Compared {i.days_high} days with {i.days_low}.
                </p>
              </li>
            ))}
          </ul>
          <p className="field-hint">These are patterns, not causes: a good night and a kept habit can both come from a calm week. Use them as hints worth testing.</p>
        </Section>
      )}
      {thin.length > 0 && (
        <Section title="Log more to see more">
          <ul className="card divide-y divide-line">
            {thin.map((s) => (
              <li key={s.key}>
                <Link to={s.to} className="press flex items-center justify-between px-4 py-3">
                  <span>{s.label}</span>
                  <span className="num text-sm text-dim">
                    {data?.coverage[s.key] ?? 0} of {ENOUGH} days
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
