import { useState } from "react";
import { Link } from "react-router";
import { api, errorText } from "../lib/api";
import { timeAgo } from "../lib/dates";
import { haptic } from "../lib/prefs";
import { queryClient } from "../lib/queries";
import { useMe } from "../lib/session";
import type { FeedEvent, Person, Reaction } from "../lib/types";
import { compact, distance, duration, weight, plural } from "../lib/units";
import { DisciplineIcon } from "./icons";
import { ChatCircle, Fire, HandsClapping, Medal, SealCheck, Smiley, Sparkle, Trophy } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";
import { Avatar } from "./ui";

export function personName(p: Pick<Person, "display_name" | "handle">) {
  return p.display_name || `@${p.handle}`;
}

/** The brand's own account. An icon with a text label, never colour alone,
    and granted only by an admin - so it can't be imitated with a name. */
export function OfficialMark({ official }: { official?: boolean }) {
  if (!official) return null;
  return (
    <SealCheck size={16} weight="fill" className="ml-1 inline-block shrink-0 align-[-2px] text-accent" aria-label="Official PaceStreak account" role="img" />
  );
}

export function PersonRow({ p, right, sub }: { p: Person; right?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link to={`/u/${p.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={personName(p)} hue={p.avatar_hue} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {personName(p)}
            <OfficialMark official={p.official} />
          </span>
          <span className="block truncate text-sm text-dim">
            {sub ?? (
              <>
                @{p.handle}
                {p.current_streak ? ` · ${p.current_streak} wk streak` : ""}
              </>
            )}
          </span>
        </span>
      </Link>
      {right}
    </div>
  );
}

type Rel = { following: "pending" | "accepted" | null; follows_you: "pending" | "accepted" | null; blocked: boolean };

export function FollowButton({ handle, rel, onChange }: { handle: string; rel: Rel; onChange?: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (method: "POST" | "DELETE") => {
    setBusy(true);
    try {
      await api(`/people/${handle}/follow`, { method });
      haptic(8);
      await queryClient.invalidateQueries({ queryKey: ["person", handle] });
      onChange?.();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  if (rel.blocked) return null;
  if (rel.following === "accepted")
    return (
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void act("DELETE")}>
        Following
      </button>
    );
  if (rel.following === "pending")
    return (
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void act("DELETE")}>
        Requested
      </button>
    );
  return (
    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act("POST")}>
      {rel.follows_you === "accepted" ? "Follow back" : "Follow"}
    </button>
  );
}

/** One line describing what happened, built from structured data only. */
export function eventHeadline(e: FeedEvent, units: { weight: "kg" | "lb"; distance: "km" | "mi" }): { title: string; detail: string } {
  const d = e.data as Record<string, unknown>;
  switch (e.kind) {
    case "workout": {
      const bits: string[] = [];
      if (d.distance_m) bits.push(distance(d.distance_m as number, units.distance));
      if (d.duration_sec) bits.push(duration(d.duration_sec as number));
      if (d.set_count) bits.push(plural(Number(d.set_count), "set"));
      const ex = (d.exercises as string[] | undefined) ?? [];
      return {
        title: (d.title as string) || `${d.verb as string}`,
        detail: [bits.join(" · "), ex.slice(0, 3).join(", ")].filter(Boolean).join(" · "),
      };
    }
    case "pr": {
      const key = String(d.key ?? "");
      const value = key.startsWith("e1rm") ? weight(d.value as number, units.weight) : key.startsWith("distance") ? distance(d.value as number, units.distance) : "";
      return { title: `New best: ${d.label as string}`, detail: [value, d.gain_pct ? `+${(d.gain_pct as number).toFixed(1)}%` : ""].filter(Boolean).join(" · ") };
    }
    case "streak":
      return { title: `${d.weeks as number}-week streak`, detail: `Kept every week on '${d.chain as string}'` };
    case "achievement":
      return { title: (d.tier_name as string) || (d.title as string), detail: d.tier ? `${d.title as string} · ${d.tier as string}` : "Achievement unlocked" };
    case "level":
      return { title: `Reached level ${d.level as number}`, detail: d.title as string };
    case "challenge":
      return { title: `Finished ${d.title as string}`, detail: `Placed #${d.rank as number} with ${compact(d.score as number)}` };
  }
}

function EventIcon({ e }: { e: FeedEvent }) {
  if (e.kind === "workout") return <DisciplineIcon id={(e.data.discipline as string) ?? "other"} size={20} />;
  if (e.kind === "pr") return <Trophy size={20} weight="fill" />;
  if (e.kind === "streak") return <Fire size={20} weight="fill" />;
  if (e.kind === "achievement") return <Medal size={20} weight="fill" />;
  return <Sparkle size={20} weight="fill" />;
}

/** The preset reactions, in the order they're offered. Emoji are text, so
 * nothing loads from anywhere. */
export const REACTIONS: { id: Reaction; emoji: string; label: string }[] = [
  { id: "kudos", emoji: "👏", label: "Kudos" },
  { id: "fire", emoji: "🔥", label: "On fire" },
  { id: "strong", emoji: "💪", label: "Strong" },
  { id: "star", emoji: "⭐", label: "Star" },
  { id: "heart", emoji: "❤️", label: "Love it" },
];

interface KudosState {
  count: number;
  mine: Reaction | null;
  reactions: Partial<Record<Reaction, number>>;
}

export function FeedCard({ e, link = true }: { e: FeedEvent; link?: boolean }) {
  const me = useMe();
  const [kudos, setKudos] = useState<KudosState>({
    count: e.kudos,
    mine: e.my_reaction ?? (e.kudoed ? "kudos" : null),
    reactions: e.reactions ?? (e.kudos ? { kudos: e.kudos } : {}),
  });
  const [picking, setPicking] = useState(false);
  const units = { weight: me.profile.weight_unit, distance: me.profile.distance_unit };
  const { title, detail } = eventHeadline(e, units);
  /** null removes the reaction; anything else gives (or switches to) it. */
  const react = async (reaction: Reaction | null) => {
    const before = kudos;
    setPicking(false);
    if (reaction) haptic(10);
    try {
      const res = await api<{ kudos: number; reactions?: KudosState["reactions"]; my_reaction?: Reaction | null }>(`/events/${e.id}/kudos`, reaction ? { body: { reaction } } : { method: "DELETE" });
      setKudos({ count: res.kudos, mine: res.my_reaction ?? null, reactions: res.reactions ?? {} });
    } catch (err) {
      setKudos(before);
      toast.error(errorText(err));
    }
  };
  const mine = REACTIONS.find((x) => x.id === kudos.mine);
  const shown = REACTIONS.filter((x) => (kudos.reactions[x.id] ?? 0) > 0);
  const body = (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={personName(e.author)} hue={e.author.avatar_hue} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.95rem]">
            <span className="font-semibold">
              {personName(e.author)}
              <OfficialMark official={e.author.official} />
            </span>
          </p>
          <p className="text-sm text-dim">{timeAgo(e.created_at)}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-md ${e.kind === "workout" ? "bg-surface-2" : "bg-accent-soft text-accent-text"}`}>
          <EventIcon e={e} />
        </span>
      </div>
      <p className="mt-3 text-[1.1rem] font-semibold tracking-tight">{title}</p>
      {detail && <p className="num mt-0.5 text-[0.95rem] text-muted">{detail}</p>}
    </>
  );
  return (
    <article className="card p-4">
      {link ? (
        <Link to={`/feed/${e.id}`} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
      <div className="mt-3 flex items-center gap-1 border-t border-line pt-2">
        <button
          type="button"
          className={`btn btn-ghost btn-sm ${kudos.mine ? "text-accent-text" : "text-muted"}`}
          aria-pressed={!!kudos.mine}
          aria-label={kudos.mine ? `Remove your ${mine?.label.toLowerCase() ?? "kudos"}` : "Give kudos"}
          onClick={() => void react(kudos.mine ? null : "kudos")}
        >
          {mine && mine.id !== "kudos" ? <span aria-hidden className="text-base leading-none">{mine.emoji}</span> : <HandsClapping size={18} weight={kudos.mine ? "fill" : "regular"} />}
          <span className="num">{kudos.count || ""}</span>
        </button>
        <button type="button" className="btn btn-ghost btn-sm text-muted" aria-expanded={picking} aria-label="Choose a reaction" onClick={() => setPicking(!picking)}>
          <Smiley size={18} />
        </button>
        {shown.length > 0 && (
          <span className="ml-1 text-sm" aria-label={shown.map((x) => `${kudos.reactions[x.id]} ${x.label}`).join(", ")}>
            {shown.map((x) => (
              <span key={x.id} aria-hidden className="mr-1.5">
                {x.emoji}
                <span className="num text-xs text-dim">{(kudos.reactions[x.id] ?? 0) > 1 ? kudos.reactions[x.id] : ""}</span>
              </span>
            ))}
          </span>
        )}
        {link && (
          <Link to={`/feed/${e.id}`} className="btn btn-ghost btn-sm ml-auto text-muted">
            <ChatCircle size={18} /> <span className="num">{e.comments || ""}</span>
            <span className="sr-only">comments</span>
          </Link>
        )}
      </div>
      {picking && (
        <div className="mt-2 flex gap-1.5" role="group" aria-label="Reactions">
          {REACTIONS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={kudos.mine === x.id}
              aria-label={x.label}
              title={x.label}
              className={`chip h-10 flex-1 justify-center px-0 text-lg ${kudos.mine === x.id ? "chip-accent" : ""}`}
              onClick={() => void react(x.id)}
            >
              {x.emoji}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

const REASONS = [
  ["harassment", "Harassment or bullying"],
  ["inappropriate", "Inappropriate content"],
  ["spam", "Spam"],
  ["impersonation", "Pretending to be someone"],
  ["self_harm", "Someone may be at risk"],
  ["other", "Something else"],
] as const;

export function ReportSheet({ open, onClose, target }: { open: boolean; onClose: () => void; target: { type: string; id: string; label: string } | null }) {
  const [reason, setReason] = useState<string>("harassment");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api("/reports", { body: { target_type: target.type, target_id: target.id, reason, detail: detail.trim() || null } });
      toast.success("Report sent", { body: "A moderator will look at it. They won't tell anyone it was you." });
      setDetail("");
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Report ${target?.label ?? ""}`}
      footer={
        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={send}>
          Send report
        </button>
      }
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">Reason</legend>
        {REASONS.map(([v, l]) => (
          <label key={v} className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 ${reason === v ? "border-accent-text bg-accent-soft" : "border-line"}`}>
            <input type="radio" name="reason" className="size-4 accent-[var(--accent)]" checked={reason === v} onChange={() => setReason(v)} />
            {l}
          </label>
        ))}
      </fieldset>
      {reason === "self_harm" && (
        <p className="mt-3 text-sm text-muted">If someone is in immediate danger, contact local emergency services first.</p>
      )}
      <textarea className="input mt-4" placeholder="Anything that helps (optional)" maxLength={500} value={detail} onChange={(e) => setDetail(e.target.value)} aria-label="Details" />
    </Sheet>
  );
}
