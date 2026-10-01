import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, Medal } from "../../components/phosphor";
import { Empty, ErrorState, Loading, PageHeader, Segmented } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import type { Achievement } from "../../lib/types";
import { compact } from "../../lib/units";

const TIERS = ["bronze", "silver", "gold"] as const;
const CATEGORY: Record<string, string> = {
  milestone: "Milestones",
  consistency: "Consistency",
  collection: "Breadth",
  volume: "Lifetime",
  pr: "Records",
  social: "Together",
  hidden: "Hidden",
};

export default function Achievements() {
  const q = useQuery({ queryKey: ["achievements"], queryFn: () => api<{ achievements: Achievement[]; unlocked_count: number }>("/me/achievements") });
  const [filter, setFilter] = useState<"all" | "earned" | "next">("all");
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const list = q.data?.achievements ?? [];
  const shown = list.filter((a) => {
    const earned = Object.keys(a.unlocked).length > 0;
    if (filter === "earned") return earned;
    if (filter === "next") return !a.secret && a.progress?.next != null;
    return true;
  });
  const groups = Object.keys(CATEGORY).map((c) => [c, shown.filter((a) => a.category === c)] as const).filter(([, a]) => a.length);

  return (
    <div>
      <PageHeader title="Achievements" back="/progress" subtitle={q.data ? `${q.data.unlocked_count} earned` : undefined} />
      <Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "earned", label: "Earned" }, { value: "next", label: "In progress" }]} />
      {!q.data ? (
        <div className="mt-6">
          <Loading rows={4} />
        </div>
      ) : groups.length === 0 ? (
        <Empty
          icon={<Medal size={26} />}
          title={filter === "earned" ? "Nothing earned yet" : "Nothing here"}
          body={filter === "earned" ? "Badges reward showing up. Keep your first week and the first one lands." : "Switch the filter to see every badge."}
        />
      ) : (
        groups.map(([cat, items]) => (
          <section key={cat} className="mt-8">
            <h2 className="mb-3 font-semibold">{CATEGORY[cat]}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((a) => (
                <Badge key={a.id} a={a} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Badge({ a }: { a: Achievement }) {
  const earnedTiers = TIERS.filter((t) => a.unlocked[t]);
  const earned = a.tiered ? earnedTiers.length > 0 : Boolean(a.unlocked.single);
  const top = earnedTiers[earnedTiers.length - 1];
  const date = a.tiered ? (top ? a.unlocked[top] : null) : a.unlocked.single;
  const pct = a.progress?.next ? Math.min(100, (a.progress.value / a.progress.next) * 100) : earned ? 100 : 0;
  const tierName = top && a.tier_names.length ? a.tier_names[TIERS.indexOf(top)] : null;
  const rarity = a.tiered ? (top ? a.rarity[top] : a.rarity.bronze) : a.rarity.single;
  return (
    <article className={`card p-4 ${earned ? "" : "opacity-90"}`}>
      <div className="flex items-start gap-3">
        <span className="badge-icon grid size-12 shrink-0 place-items-center rounded-md" data-tier={top ?? (earned ? "single" : "none")}>
          {a.secret ? <Lock size={22} /> : <Medal size={24} weight={earned ? "fill" : "regular"} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{tierName ?? a.title}</p>
          <p className="mt-0.5 text-sm text-muted">{a.description}</p>
        </div>
      </div>
      {a.tiered && !a.secret && (
        <div className="mt-3 flex gap-1.5" aria-label={`Tiers earned: ${earnedTiers.join(", ") || "none"}`}>
          {TIERS.map((t, i) => (
            <span key={t} className={`chip h-6 px-2 text-xs ${a.unlocked[t] ? "chip-accent" : ""}`}>
              {t} · {compact(a.thresholds[i])}
            </span>
          ))}
        </div>
      )}
      {!a.secret && a.progress?.next != null && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={a.progress.next} aria-valuenow={a.progress.value} aria-label={`${a.title} progress`}>
            <div className="h-full rounded-full bg-[var(--chart)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="num mt-1.5 text-xs text-dim">
            {compact(a.progress.value)} of {compact(a.progress.next)} {a.unit}
          </p>
        </div>
      )}
      <p className="mt-3 text-xs text-dim">
        {date ? `Earned ${fmtMonthDay(date)} · ` : ""}
        {rarity != null ? `${rarity}% of people have this` : ""}
      </p>
    </article>
  );
}
