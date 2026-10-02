import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Warning, UsersThree } from "../../components/phosphor";
import { Avatar, Empty, ErrorState, Loading, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";

interface CoachedPerson {
  handle: string | null;
  display_name: string | null;
  avatar_hue: number;
  groups: { id: string; name: string }[];
  current_streak: number;
  this_week_days: number;
  this_week_target: number;
  at_risk: boolean;
  last_session: string | null;
  attention: boolean;
  plan: { name: string; week: number; weeks: number } | null;
}

/**
 * Everyone who shares their training with you, across every coaching group
 * you run, the ones who may need a word first. Only people who switched on
 * sharing appear; turning it off removes them at once.
 */
export default function Coaching() {
  const q = useQuery({ queryKey: ["coaching"], queryFn: () => api<{ groups: { id: string; name: string }[]; people: CoachedPerson[] }>("/coaching") });
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <Loading />;
  const { groups, people } = q.data;
  const flagged = people.filter((p) => p.attention).length;
  return (
    <div>
      <PageHeader
        title="Coaching"
        back="/you"
        subtitle={groups.length ? `${people.length} sharing with you across ${groups.length} ${groups.length === 1 ? "group" : "groups"}` : undefined}
      />
      {groups.length === 0 ? (
        <Empty icon={<UsersThree size={26} />} title="No coaching groups" body="Create a coaching group under Groups and invite the people you coach. They choose whether you see their training." />
      ) : people.length === 0 ? (
        <Empty icon={<UsersThree size={26} />} title="Nobody is sharing yet" body="Members appear here once they switch on sharing with their coach in the group." />
      ) : (
        <>
          {flagged > 0 && (
            <p className="mb-3 flex items-center gap-2 text-sm text-flame-text">
              <Warning size={16} aria-hidden /> {flagged} may need a check-in: a week at risk, or nothing logged for 7 days.
            </p>
          )}
          <ul className="card divide-y divide-line">
            {people.map((p) => (
              <li key={p.handle ?? p.display_name}>
                <Link to={`/groups/${p.groups[0].id}?tab=coach`} className="press flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                  <Avatar name={p.display_name || `@${p.handle}`} hue={p.avatar_hue} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="truncate">{p.display_name || `@${p.handle}`}</span>
                      {p.attention && <Warning size={14} weight="fill" className="shrink-0 text-flame-text" aria-label="May need a check-in" />}
                    </span>
                    <span className="block text-sm text-dim">
                      {p.this_week_days}/{p.this_week_target} this week · {p.current_streak} wk streak ·{" "}
                      {p.last_session ? `last ${fmtMonthDay(p.last_session)}` : "nothing logged yet"}
                    </span>
                    <span className="block truncate text-xs text-dim">
                      {p.groups.map((g) => g.name).join(", ")}
                      {p.plan ? ` · ${p.plan.name}, week ${p.plan.week} of ${p.plan.weeks}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
