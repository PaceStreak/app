import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { EncourageButton } from "../../components/Encourage";
import { Heatmap } from "../../components/Heatmap";
import { DotsThreeVertical, Fire, Handshake, Lock, Medal } from "../../components/phosphor";
import { FeedCard, FollowButton, OfficialMark, ReportSheet, personName } from "../../components/social";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Avatar, ErrorState, Loading, PageHeader, Section } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { localToday } from "../../lib/dates";
import { useMe } from "../../lib/session";
import type { FeedEvent, WeekCell } from "../../lib/types";

interface ProfileData {
  id: string;
  handle: string;
  display_name: string | null;
  official?: boolean;
  avatar_hue: number;
  current_streak?: number;
  bio: string | null;
  me: boolean;
  visible: boolean;
  relationship: { following: "pending" | "accepted" | null; follows_you: "pending" | "accepted" | null; blocked: boolean } | null;
  counts: { followers: number; following: number };
  streak?: { current: number; longest: number; this_week_days: number; this_week_target: number; weeks: WeekCell[] };
  heatmap?: { date: string; level: number }[];
  totals?: { sessions: number; active_days: number };
  achievements?: { id: string; title: string; tier: string | null; date: string }[];
  level?: { level: number; title: string } | null;
}

export default function Profile() {
  const { handle = "" } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [confirmSheet, ask] = useConfirm();
  const q = useQuery({ queryKey: ["person", handle], queryFn: () => api<ProfileData>(`/people/${handle}`) });
  const events = useInfiniteQuery({
    queryKey: ["person-events", handle],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api<{ events: FeedEvent[]; next: string | null }>(`/people/${handle}/events${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (last) => last.next,
    enabled: Boolean(q.data?.visible),
  });

  const block = async () => {
    setMenu(false);
    const p = q.data;
    if (!p) return;
    if (p.relationship?.blocked) {
      await api(`/people/${handle}/block`, { method: "DELETE" });
      toast("Unblocked");
      void q.refetch();
      return;
    }
    if (!(await ask({ title: `Block ${personName(p)}?`, body: "Neither of you will see the other anywhere: feed, search, groups, boards. They aren't told.", confirm: "Block", danger: true }))) return;
    try {
      await api(`/people/${handle}/block`, { method: "POST" });
      toast("Blocked");
      navigate("/feed", { replace: true });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const removeFollower = async () => {
    setMenu(false);
    await api(`/people/${handle}/follower`, { method: "DELETE" });
    toast("Removed from your followers");
    void q.refetch();
  };

  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const p = q.data;
  return (
    <div>
      <PageHeader
        title=""
        back
        action={
          p &&
          !p.me && (
            <button type="button" className="btn btn-ghost btn-icon" aria-label="More" onClick={() => setMenu(true)}>
              <DotsThreeVertical size={22} weight="bold" />
            </button>
          )
        }
      />
      {!p ? (
        <Loading rows={3} />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={personName(p)} hue={p.avatar_hue} size={76} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {personName(p)}
                <OfficialMark official={Boolean(p.official)} />
              </h1>
              <p className="text-muted">@{p.handle}</p>
              {p.level && <p className="mt-1 text-sm text-dim">Level {p.level.level} · {p.level.title}</p>}
            </div>
          </div>
          {p.bio && <p className="mt-4 whitespace-pre-wrap">{p.bio}</p>}
          <div className="mt-4 flex items-center gap-5 text-sm">
            <Link to={`/u/${p.handle}/followers`} className="hover:underline">
              <b className="num">{p.counts.followers}</b> <span className="text-muted">followers</span>
            </Link>
            <Link to={`/u/${p.handle}/following`} className="hover:underline">
              <b className="num">{p.counts.following}</b> <span className="text-muted">following</span>
            </Link>
            <span className="ml-auto">
              {p.me ? (
                <Link to="/settings/profile" className="btn btn-secondary btn-sm">Edit profile</Link>
              ) : (
                p.relationship && <FollowButton handle={p.handle} rel={p.relationship} onChange={() => void q.refetch()} />
              )}
            </span>
          </div>
          {p.relationship?.follows_you === "accepted" && <p className="mt-2 text-sm text-dim">Follows you</p>}
          {!p.me && p.handle && (p.relationship?.follows_you === "accepted" || p.relationship?.following === "accepted") && (
            <div className="mt-3 flex gap-2">
              {p.relationship?.follows_you === "accepted" && <EncourageButton handle={p.handle} />}
              <BuddyButton handle={p.handle} />
            </div>
          )}

          {!p.visible ? (
            <div className="card mt-8 flex flex-col items-center px-6 py-10 text-center">
              <Lock size={26} className="text-dim" />
              <p className="mt-3 font-semibold">Only approved followers see this account</p>
              <p className="mt-1 text-sm text-muted">Send a follow request and they can say yes.</p>
            </div>
          ) : (
            <>
              {p.streak && (
                <div className="card mt-6 p-4">
                  <div className="mb-4 flex items-center gap-6">
                    <div>
                      <p className="num flex items-center gap-1 text-2xl font-semibold"><Fire size={20} weight="fill" className="text-flame" />{p.streak.current}</p>
                      <p className="text-xs text-dim">week streak</p>
                    </div>
                    <div>
                      <p className="num text-2xl font-semibold">{p.totals?.active_days ?? 0}</p>
                      <p className="text-xs text-dim">days trained</p>
                    </div>
                    <div>
                      <p className="num text-2xl font-semibold">{p.streak.longest}</p>
                      <p className="text-xs text-dim">longest</p>
                    </div>
                  </div>
                  <Heatmap days={p.heatmap ?? []} weeks={p.streak.weeks} today={localToday(me.profile.timezone)} weekStartsOn={0} span={26} />
                </div>
              )}
              {p.achievements && p.achievements.length > 0 && (
                <Section title="Recent badges">
                  <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
                    {p.achievements.map((a) => (
                      <span key={`${a.id}${a.tier}`} className="chip h-9 shrink-0 px-3.5">
                        <Medal size={16} weight="fill" /> {a.title}
                        {a.tier ? ` · ${a.tier}` : ""}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
              <Section title="Activity">
                <div className="space-y-3">
                  {(events.data?.pages.flatMap((pg) => pg.events) ?? []).map((e) => (
                    <FeedCard key={e.id} e={e} />
                  ))}
                  {events.data && events.data.pages[0].events.length === 0 && <p className="text-muted">Nothing shared yet.</p>}
                  {events.hasNextPage && (
                    <button type="button" className="btn btn-secondary w-full" onClick={() => void events.fetchNextPage()}>
                      Older
                    </button>
                  )}
                </div>
              </Section>
            </>
          )}

          <Sheet open={menu} onClose={() => setMenu(false)} title={personName(p)}>
            <div className="-mx-2 flex flex-col">
              {p.relationship?.follows_you === "accepted" && (
                <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => void removeFollower()}>
                  Remove from my followers
                </button>
              )}
              <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => { setMenu(false); setReport(true); }}>
                Report
              </button>
              <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium text-danger hover:bg-surface-2" onClick={() => void block()}>
                {p.relationship?.blocked ? "Unblock" : "Block"}
              </button>
            </div>
          </Sheet>
          <ReportSheet open={report} onClose={() => setReport(false)} target={{ type: "user", id: p.handle, label: personName(p) }} />
        </>
      )}
      {confirmSheet}
    </div>
  );
}

/** Invite to a buddy streak - offered only where the API would allow it. */
function BuddyButton({ handle }: { handle: string }) {
  const [sent, setSent] = useState(false);
  const invite = async () => {
    try {
      await api("/buddies", { body: { handle } });
      setSent(true);
      toast.success("Buddy invite sent", { body: "A week counts when you both keep yours." });
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <button type="button" className="btn btn-secondary btn-sm" disabled={sent} onClick={() => void invite()}>
      <Handshake size={16} aria-hidden /> {sent ? "Invited" : "Buddy up"}
    </button>
  );
}
