import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { Trophy } from "../../components/phosphor";
import { PersonRow } from "../../components/social";
import { toast } from "../../components/toast";
import { Banner, Empty, ErrorState, Loading, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { useMe, useSession } from "../../lib/session";
import type { Group, Person } from "../../lib/types";
import { SocialGate, SocialHeader } from "./SocialNav";

type Board = "consistency" | "streak" | "season_xp" | "season_prs";
type Row = Person & { value: number; rank: number; me: boolean };

const BOARDS: Record<Board, { label: string; unit: (v: number) => string; about: string }> = {
  consistency: { label: "Consistency", unit: (v) => `${v}%`, about: "How closely people hit their own weekly target over the last four weeks. Capped at 100%: training more than your plan can't raise it." },
  streak: { label: "Streak", unit: (v) => `${v} wk`, about: "Current run of kept weeks." },
  season_xp: { label: "Season XP", unit: (v) => `${v}`, about: "XP this quarter. XP pays for showing up, never for weight or volume." },
  season_prs: { label: "Records", unit: (v) => `${v}`, about: "Personal records this quarter. Each one beats that person's own best, so size and strength don't matter." },
};

export default function Leaderboards() {
  const me = useMe();
  const { reloadMe } = useSession();
  const [board, setBoard] = useState<Board>("consistency");
  const [scope, setScope] = useState<string>("following");
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<Group[]>("/groups") });
  const groupId = scope.startsWith("group:") ? scope.slice(6) : null;
  const q = useQuery({
    queryKey: ["leaderboard", board, scope],
    queryFn: () => api<{ rows: Row[]; me: Row | null; participants: number; opted_in: boolean }>(`/leaderboards/${board}?scope=${groupId ? "group" : scope}${groupId ? `&group_id=${groupId}` : ""}`),
    enabled: me.social_allowed,
  });

  const optIn = async () => {
    try {
      await api("/me/profile", { method: "PATCH", body: { leaderboard_opt_in: true } });
      await reloadMe();
      await q.refetch();
      toast.success("You're on the global boards", { body: "Leave any time in Settings, Privacy." });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const meta = BOARDS[board];
  return (
    <div>
      <SocialHeader title="Leaderboards" />
      <SocialGate>
        {!me.profile.gamification_enabled ? (
          <Empty icon={<Trophy size={26} />} title="Game features are off" body="You switched off XP, badges and boards. Turn them back on in Settings if you want them." action={<Link to="/settings/privacy" className="btn btn-secondary">Settings</Link>} />
        ) : (
          <>
            <Segmented label="Board" value={board} onChange={setBoard} options={(Object.keys(BOARDS) as Board[]).map((b) => ({ value: b, label: BOARDS[b].label }))} />
            <div className="mt-3 flex items-center gap-2">
              <select className="input h-10 min-h-0 flex-1 rounded-full py-0 text-sm" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Who">
                <option value="following">People I follow</option>
                <option value="global">Everyone who opted in</option>
                {(groups.data ?? []).map((g) => (
                  <option key={g.id} value={`group:${g.id}`}>{g.name}</option>
                ))}
              </select>
            </div>
            <p className="mt-3 text-sm text-dim">{meta.about}</p>

            {scope === "global" && q.data && !q.data.opted_in && (
              <div className="mt-4">
                <Banner tone="accent" action={<button type="button" className="btn btn-primary btn-sm" onClick={optIn}>Join</button>}>
                  You're not on the global boards. Joining shows your handle and these numbers to other opted-in people.
                </Banner>
              </div>
            )}

            <div className="mt-5">
              {q.isError ? (
                <ErrorState error={q.error} onRetry={() => void q.refetch()} />
              ) : !q.data ? (
                <Loading />
              ) : q.data.rows.length === 0 ? (
                <Empty icon={<Trophy size={26} />} title="Nobody here yet" body={scope === "global" ? "Be the first to opt in." : "Follow a few people and this fills up."} />
              ) : (
                <>
                  <ol className="card divide-y divide-line overflow-hidden">
                    {q.data.rows.map((r) => (
                      <li key={r.id} className={r.me ? "bg-accent-soft" : ""}>
                        <PersonRow
                          p={r}
                          right={
                            <span className="num flex items-center gap-3">
                              <span className="font-semibold">{meta.unit(r.value)}</span>
                              <span className={`w-8 text-right text-sm ${r.rank <= 3 ? "text-accent-text font-semibold" : "text-dim"}`}>#{r.rank}</span>
                            </span>
                          }
                        />
                      </li>
                    ))}
                  </ol>
                  {q.data.me && !q.data.rows.some((r) => r.me) && (
                    <div className="card mt-3 bg-accent-soft">
                      <PersonRow p={q.data.me} right={<span className="num font-semibold">{meta.unit(q.data.me.value)} · #{q.data.me.rank}</span>} />
                    </div>
                  )}
                  <p className="mt-3 text-center text-xs text-dim">{q.data.participants} people on this board</p>
                </>
              )}
            </div>
          </>
        )}
      </SocialGate>
    </div>
  );
}
