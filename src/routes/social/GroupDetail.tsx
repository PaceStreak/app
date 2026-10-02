import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { WeekStrip } from "../../components/WeekStrip";
import { DisciplineIcon } from "../../components/icons";
import { ArrowsClockwise, Copy, DotsThreeVertical, Fire, Megaphone, PushPin, ShareNetwork, Trash, Trophy, WarningCircle } from "../../components/phosphor";
import { FeedCard, PersonRow, ReportSheet } from "../../components/social";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Avatar, ErrorState, Field, Loading, PageHeader, Segmented, Switch } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import { queryClient } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Challenge, FeedEvent, Group, Person, PlanSummary, PlanTemplate } from "../../lib/types";
import { distance, duration } from "../../lib/units";
import { ChallengeCard, NewChallengeSheet } from "./Challenges";

type Tab = "members" | "activity" | "challenges" | "coach";

interface CoachMember extends Person {
  this_week_days: number;
  this_week_target: number;
  at_risk: boolean;
  consistency: number;
  weeks: { week_start: string; days: number; target: number; status: string }[];
  plan: { name: string; week: number; weeks: number; done: number; due: number; from_this_coach: boolean } | null;
  recent: { id: string; date: string; discipline: string; title: string | null; duration_sec: number | null; distance_m: number | null; effort: number | null; feel: number | null; sets: number }[];
}

export default function GroupDetail() {
  const { id = "" } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  // ?tab=coach opens straight on a tab, e.g. from the coaching overview.
  const [tab, setTab] = useState<Tab>(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    return wanted === "coach" || wanted === "activity" || wanted === "challenges" ? wanted : "members";
  });
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [newChallenge, setNewChallenge] = useState(false);
  const [suggestFor, setSuggestFor] = useState<CoachMember | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmSheet, ask] = useConfirm();
  const g = useQuery({ queryKey: ["group", id], queryFn: () => api<Group>(`/groups/${id}`) });
  const feed = useInfiniteQuery({
    queryKey: ["group-feed", id],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api<{ events: FeedEvent[]; next: string | null }>(`/groups/${id}/feed${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (l) => l.next,
    enabled: tab === "activity",
  });
  const challenges = useQuery({ queryKey: ["challenges"], queryFn: () => api<Challenge[]>("/challenges"), enabled: tab === "challenges" });
  const coach = useQuery({ queryKey: ["coach", id], queryFn: () => api<{ members: CoachMember[] }>(`/groups/${id}/coach`), enabled: tab === "coach" });

  if (g.isError) return <ErrorState error={g.error} onRetry={() => void g.refetch()} />;
  const group = g.data;
  const manager = group?.my_role === "owner" || group?.my_role === "admin";
  const isCoach = group?.kind === "coaching" && (manager || group?.my_role === "coach");

  const share = async () => {
    if (!group?.invite_code) return;
    const text = `Join ${group.name} on PaceStreak with code ${group.invite_code}`;
    try {
      if (navigator.share) await navigator.share({ title: group.name, text });
      else {
        await navigator.clipboard.writeText(group.invite_code);
        toast.success("Code copied");
      }
    } catch {
      /* dismissed */
    }
  };

  const action = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast.success(done);
      await g.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const leave = async () => {
    setMenu(false);
    if (!(await ask({ title: `Leave ${group?.name}?`, confirm: "Leave", danger: true }))) return;
    await action(() => api(`/groups/${id}/leave`, { method: "POST" }));
    await queryClient.invalidateQueries({ queryKey: ["groups"] });
    navigate("/groups", { replace: true });
  };
  const remove = async () => {
    setMenu(false);
    if (!(await ask({ title: `Delete ${group?.name}?`, body: "Members, challenges and the invite code go with it. Nobody's training log is touched.", confirm: "Delete group", danger: true }))) return;
    await api(`/groups/${id}`, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["groups"] });
    navigate("/groups", { replace: true });
  };

  return (
    <div>
      <PageHeader
        title={group?.name ?? ""}
        back="/groups"
        subtitle={group ? `${group.member_count} ${group.member_count === 1 ? "member" : "members"} · ${group.kind === "coaching" ? "Coaching" : "Crew"}` : undefined}
        action={
          group && (
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Group options" onClick={() => setMenu(true)}>
              <DotsThreeVertical size={22} weight="bold" />
            </button>
          )
        }
      />
      {!group ? (
        <Loading />
      ) : (
        <>
          {group.description && <p className="-mt-2 mb-4 whitespace-pre-wrap text-muted">{group.description}</p>}
          {group.invite_code && (
            <div className="card mb-5 flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-dim">Invite code</p>
                <p className="num text-xl font-semibold tracking-[0.18em]">{group.invite_code}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="New code" onClick={() => void action(() => api(`/groups/${id}/invite/rotate`, { method: "POST" }), "Old code no longer works")}>
                <ArrowsClockwise size={20} />
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={share}>
                {"share" in navigator ? <ShareNetwork size={16} /> : <Copy size={16} />} Share
              </button>
            </div>
          )}
          {group.kind === "coaching" && group.my_role === "member" && (
            <div className="card mb-5">
              <Switch
                checked={group.shares_with_coach}
                onChange={(v) => void action(() => api(`/groups/${id}/me`, { method: "PATCH", body: { shares_with_coach: v } }), v ? "Your coach can now see your sessions" : "Your coach can no longer see your sessions")}
                label="Share my training with the coach"
                description="Sessions, effort and how they felt. Switch it off any time and access stops immediately."
              />
            </div>
          )}

          {group.my_role && (
            <div className="card mb-5">
              <Switch
                checked={Boolean(group.muted)}
                onChange={(v) => void action(() => api(`/groups/${id}/me`, { method: "PATCH", body: { muted: v } }), v ? "Group muted" : "Group unmuted")}
                label="Mute this group"
                description="No push or email about it. Everything still shows up in your inbox."
              />
            </div>
          )}

          <Announcements groupId={id} manager={group.my_role === "owner" || group.my_role === "admin"} />

          {group.streak && <GroupStreak group={group} onThreshold={(v) => void action(() => api(`/groups/${id}`, { method: "PATCH", body: { streak_threshold: v } }), "Updated")} />}

          <Segmented
            label="Section"
            value={tab}
            onChange={setTab}
            options={[
              { value: "members", label: "Members" },
              { value: "activity", label: "Activity" },
              { value: "challenges", label: "Challenges" },
              ...(isCoach ? [{ value: "coach" as const, label: "Coach" }] : []),
            ]}
          />

          <div className="mt-5">
            {tab === "members" && (
              <div className="card divide-y divide-line overflow-hidden">
                {(group.members ?? []).map((m) => (
                  <PersonRow
                    key={m.id}
                    p={m}
                    sub={
                      <>
                        <span className="num">{m.this_week_days}/{m.this_week_target ?? "?"} this week</span>
                        {m.role !== "member" ? ` · ${m.role}` : ""}
                      </>
                    }
                    right={
                      <span className="flex items-center gap-2">
                        <span className="num flex items-center gap-1 text-sm font-semibold">
                          <Fire size={16} weight="fill" className="text-flame" />
                          {m.current_streak ?? 0}
                        </span>
                        {manager && m.id !== me.user.id && m.role !== "owner" && <MemberMenu groupId={id} member={m} isOwner={group.my_role === "owner"} coaching={group.kind === "coaching"} onDone={() => void g.refetch()} />}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
            {tab === "activity" && (
              <div className="space-y-3">
                {(feed.data?.pages.flatMap((p) => p.events) ?? []).map((e) => (
                  <FeedCard key={e.id} e={e} />
                ))}
                {feed.data && feed.data.pages[0].events.length === 0 && <p className="text-muted">Nothing shared yet.</p>}
                {feed.hasNextPage && (
                  <button type="button" className="btn btn-secondary w-full" onClick={() => void feed.fetchNextPage()}>
                    Older
                  </button>
                )}
              </div>
            )}
            {tab === "challenges" && (
              <div className="space-y-3">
                <button type="button" className="btn btn-primary w-full" onClick={() => setNewChallenge(true)}>
                  <Trophy size={18} /> New group challenge
                </button>
                {(challenges.data ?? []).filter((c) => c.group_id === id).map((c) => (
                  <ChallengeCard key={c.id} c={c} />
                ))}
              </div>
            )}
            {tab === "coach" &&
              (coach.data?.members.length === 0 ? (
                <p className="text-muted">No member is sharing their training with you yet. Each member switches it on for themselves.</p>
              ) : (
                <div className="space-y-3">
                  {(coach.data?.members ?? []).map((m) => (
                    <div key={m.id} className="card p-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.display_name ?? m.handle} hue={m.avatar_hue} />
                        <div className="min-w-0 flex-1">
                          <Link to={`/u/${m.handle}`} className="font-semibold hover:underline">{m.display_name ?? `@${m.handle}`}</Link>
                          <p className="num text-sm text-dim">
                            {m.this_week_days}/{m.this_week_target} this week · {m.consistency}% last 4 weeks
                          </p>
                        </div>
                        {m.at_risk && (
                          <span className="chip chip-flame">
                            <WarningCircle size={14} /> at risk
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex gap-[3px]" aria-label="Last 8 weeks">
                        {m.weeks.map((w) => (
                          <span key={w.week_start} className={`week-mark is-${w.status} h-5 flex-1`} title={`${fmtMonthDay(w.week_start)}: ${w.days}/${w.target}`} />
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate">
                          {m.plan ? (
                            <>
                              <strong>{m.plan.name}</strong>: week {m.plan.week} of {m.plan.weeks}, {m.plan.done} of {m.plan.due} done
                              {m.plan.from_this_coach ? " · your suggestion" : ""}
                            </>
                          ) : (
                            <span className="text-dim">No plan running</span>
                          )}
                        </span>
                        <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => setSuggestFor(m)}>
                          Suggest a plan
                        </button>
                      </div>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {m.recent.slice(0, 5).map((r) => (
                          <li key={r.id} className="flex items-center gap-2 text-muted">
                            <DisciplineIcon id={r.discipline} size={16} />
                            <span className="w-14 text-dim">{fmtMonthDay(r.date)}</span>
                            <span className="num truncate">{[r.title, duration(r.duration_sec), distance(r.distance_m, me.profile.distance_unit), r.sets ? `${r.sets} sets` : "", r.feel ? `felt ${r.feel}/5` : ""].filter(Boolean).join(" · ")}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
          </div>

          <SuggestPlanSheet groupId={id} member={suggestFor} onClose={() => setSuggestFor(null)} />

          <Sheet open={menu} onClose={() => setMenu(false)} title={group.name}>
            <div className="-mx-2 flex flex-col">
              {manager && (
                <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => { setMenu(false); setEditing(true); }}>
                  Edit name and description
                </button>
              )}
              {group.my_role !== "owner" && (
                <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => void leave()}>
                  Leave group
                </button>
              )}
              {!manager && (
                <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => { setMenu(false); setReport(true); }}>
                  Report group
                </button>
              )}
              {group.my_role === "owner" && (
                <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium text-danger hover:bg-surface-2" onClick={() => void remove()}>
                  Delete group
                </button>
              )}
            </div>
          </Sheet>
          <EditGroup open={editing} group={group} onClose={() => setEditing(false)} onSaved={() => void g.refetch()} />
          <ReportSheet open={report} onClose={() => setReport(false)} target={{ type: "group", id, label: group.name }} />
          <NewChallengeSheet open={newChallenge} groupId={id} onClose={() => setNewChallenge(false)} />
        </>
      )}
      {confirmSheet}
    </div>
  );
}

function MemberMenu({ groupId, member, isOwner, coaching, onDone }: { groupId: string; member: Person & { role: string }; isOwner: boolean; coaching: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setOpen(false);
    try {
      await fn();
      onDone();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const roles = [...(isOwner ? ["admin"] : []), ...(coaching ? ["coach"] : []), "member"].filter((r) => r !== member.role);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-icon btn-sm text-dim" aria-label={`Manage ${member.handle}`} onClick={() => setOpen(true)}>
        <DotsThreeVertical size={18} weight="bold" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`@${member.handle}`}>
        <div className="-mx-2 flex flex-col">
          {roles.map((r) => (
            <button key={r} type="button" className="press rounded-md px-3 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => void run(() => api(`/groups/${groupId}/members/${member.id}`, { method: "PATCH", body: { role: r } }))}>
              Make {r}
            </button>
          ))}
          {isOwner && (
            <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => void run(() => api(`/groups/${groupId}/members/${member.id}`, { method: "PATCH", body: { role: "owner" } }))}>
              Hand over ownership
            </button>
          )}
          <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium text-danger hover:bg-surface-2" onClick={() => void run(() => api(`/groups/${groupId}/members/${member.id}`, { method: "DELETE" }))}>
            Remove from group
          </button>
        </div>
      </Sheet>
    </>
  );
}

function EditGroup({ open, group, onClose, onSaved }: { open: boolean; group: Group; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const save = async () => {
    try {
      await api(`/groups/${group.id}`, { method: "PATCH", body: { name, description: description || null } });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Edit group" footer={<button type="button" className="btn btn-primary w-full" onClick={save}>Save</button>}>
      <div className="space-y-4">
        <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        <textarea className="input" value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
      </div>
    </Sheet>
  );
}

/** The crew's shared streak. A week counts when enough members keep their
 * own; paused members sit it out. Same rules for everyone looking. */
function GroupStreak({ group, onThreshold }: { group: Group; onThreshold: (v: number) => void }) {
  const st = group.streak!;
  const manager = group.my_role === "owner" || group.my_role === "admin";
  const needed = st.this_week ? Math.ceil((st.threshold / 100) * st.this_week.counted) : 0;
  return (
    <section className="card mb-5 p-4" aria-labelledby="group-streak">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="group-streak" className="font-semibold">
            Group streak
          </h2>
          <p className="text-sm text-dim">
            A week counts when {st.threshold === 100 ? "everyone" : `${st.threshold}% of the group`} keeps theirs.
          </p>
        </div>
        <p className="num flex items-center gap-1 text-2xl font-semibold tracking-tight" aria-label={`${st.current} week group streak`}>
          <Fire size={20} weight="fill" className="text-flame" aria-hidden />
          {st.current}
        </p>
      </div>
      <div className="mt-3">
        <WeekStrip weeks={st.weeks} label="The group's last 12 weeks" />
      </div>
      {st.this_week && st.this_week.counted > 0 && (
        <p className="mt-3 text-sm text-muted">
          This week: {st.this_week.kept} of {st.this_week.counted} kept so far
          {st.this_week.kept < needed ? `, ${needed - st.this_week.kept} more to go` : ", week secured"}. Best: {st.longest}.
        </p>
      )}
      {manager && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <label htmlFor="grp-threshold" className="text-sm text-muted">
            Counts when
          </label>
          <select id="grp-threshold" className="input h-10 min-h-0 w-36" value={st.threshold} onChange={(e) => onThreshold(Number(e.target.value))}>
            {[50, 60, 75, 90, 100].map((v) => (
              <option key={v} value={v}>
                {v === 100 ? "everyone" : `${v}% keep it`}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
}

/** A coach suggests a plan; it lands in the member's plans, unstarted. */
function SuggestPlanSheet({ groupId, member, onClose }: { groupId: string; member: CoachMember | null; onClose: () => void }) {
  const templates = useQuery({ queryKey: ["plan-templates"], queryFn: () => api<PlanTemplate[]>("/plans/templates"), enabled: member !== null, staleTime: Infinity });
  const mine = useQuery({ queryKey: ["plans"], queryFn: () => api<PlanSummary[]>("/plans"), enabled: member !== null });
  const [choice, setChoice] = useState("tpl:plan-two-a-week");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!member) return;
    setBusy(true);
    try {
      const plan = choice.startsWith("tpl:") ? { plan_template_id: choice.slice(4) } : { plan_id: choice.slice(5) };
      await api(`/groups/${groupId}/members/${member.id}/plan`, { body: { ...plan, note: note.trim() || null } });
      toast.success(`Suggested to ${member.display_name ?? `@${member.handle}`}`, { body: "It's in their plans. Starting it is their call." });
      setNote("");
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={member !== null} onClose={onClose} title={member ? `A plan for ${member.display_name ?? `@${member.handle}`}` : ""}>
      {member && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div>
            <label className="field-label" htmlFor="sp-plan">Plan</label>
            <select id="sp-plan" className="input" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <optgroup label="Templates">
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={`tpl:${t.id}`}>{t.name} ({t.weeks_count} weeks)</option>
                ))}
              </optgroup>
              {(mine.data ?? []).length > 0 && (
                <optgroup label="Your plans">
                  {(mine.data ?? []).map((p) => (
                    <option key={p.id} value={`mine:${p.id}`}>{p.name} ({p.weeks_count} weeks)</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <Field label="Note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this one, and when to start" />
          <p className="text-sm text-dim">They get a copy with any routines it uses. They decide whether and when to start it, and can change or delete it.</p>
          <button className="btn btn-primary w-full" disabled={busy}>
            Send suggestion
          </button>
        </form>
      )}
    </Sheet>
  );
}

interface Announcement {
  id: string;
  body: string;
  pinned: boolean;
  created_at: string;
  author: Person | null;
}

/** Notes from the group's owner and admins. Members read; nobody replies,
 * so there is nothing between members to moderate. */
function Announcements({ groupId, manager }: { groupId: string; manager: boolean }) {
  const q = useQuery({ queryKey: ["announcements", groupId], queryFn: () => api<Announcement[]>(`/groups/${groupId}/announcements`) });
  const [draft, setDraft] = useState<{ body: string; pinned: boolean } | null>(null);
  const [all, setAll] = useState(false);
  const [confirmSheet, ask] = useConfirm();
  const items = q.data ?? [];
  if (!manager && items.length === 0) return null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["announcements", groupId] });
  const post = async () => {
    if (!draft) return;
    try {
      await api(`/groups/${groupId}/announcements`, { body: { body: draft.body.trim(), pinned: draft.pinned } });
      setDraft(null);
      toast.success("Posted", { body: "Members were notified." });
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const remove = async (a: Announcement) => {
    if (!(await ask({ title: "Remove this announcement?", confirm: "Remove", danger: true }))) return;
    try {
      await api(`/groups/${groupId}/announcements/${a.id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const shown = all ? items : items.slice(0, 2);
  return (
    <section className="card mb-5 p-4" aria-labelledby="announcements">
      <div className="flex items-center justify-between gap-3">
        <h2 id="announcements" className="flex items-center gap-2 font-semibold">
          <Megaphone size={18} aria-hidden /> Announcements
        </h2>
        {manager && !draft && (
          <button type="button" className="text-sm font-semibold text-accent-text" onClick={() => setDraft({ body: "", pinned: false })}>
            Post
          </button>
        )}
      </div>
      {draft && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
        >
          <textarea className="input" rows={3} maxLength={500} required value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label="Announcement" placeholder="Long run Sunday, 8am from the park gate." />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} /> Pin to the top
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn btn-primary flex-1" disabled={!draft.body.trim()}>Post to everyone</button>
          </div>
        </form>
      )}
      {items.length === 0 && !draft && <p className="mt-2 text-sm text-dim">Only owners and admins can post. Members get a notification.</p>}
      <ul className="mt-2 divide-y divide-line">
        {shown.map((a) => (
          <li key={a.id} className="py-2.5">
            <p className="whitespace-pre-wrap">{a.body}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-dim">
              {a.pinned && (
                <>
                  <PushPin size={12} weight="fill" aria-hidden /> Pinned ·{" "}
                </>
              )}
              {a.author ? `@${a.author.handle}` : "Former admin"} · {fmtMonthDay(a.created_at.slice(0, 10))}
              {manager && (
                <button type="button" className="ml-auto rounded p-1 hover:bg-surface-2" aria-label="Remove announcement" onClick={() => void remove(a)}>
                  <Trash size={14} />
                </button>
              )}
            </p>
          </li>
        ))}
      </ul>
      {items.length > 2 && (
        <button type="button" className="mt-1 text-sm font-semibold text-accent-text" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
      {confirmSheet}
    </section>
  );
}
