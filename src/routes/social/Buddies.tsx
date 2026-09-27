import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { WeekStrip } from "../../components/WeekStrip";
import { EncourageButton } from "../../components/Encourage";
import { Fire, Handshake, Pause } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { OfficialMark, personName } from "../../components/social";
import { toast } from "../../components/toast";
import { Avatar, Empty, ErrorState, Field, Loading, Section } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { queryClient } from "../../lib/queries";
import type { Person } from "../../lib/types";
import { SocialGate, SocialHeader } from "./SocialNav";

export interface BuddyView {
  id: string;
  status: "pending" | "active";
  incoming: boolean;
  buddy: Person;
  started_at: string | null;
  current?: number;
  longest?: number;
  weeks?: ("kept" | "missed" | "paused" | "open")[];
  me?: { days: number; target: number };
  them?: { days: number; target: number; paused: boolean };
}


export default function Buddies() {
  const q = useQuery({ queryKey: ["buddies"], queryFn: () => api<BuddyView[]>("/buddies") });
  const [inviting, setInviting] = useState<string | null>(null);
  const [confirmSheet, ask] = useConfirm();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["buddies"] });
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast.success(done);
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const end = async (b: BuddyView) => {
    const title = b.status === "active" ? `Stop being buddies with @${b.buddy.handle}?` : b.incoming ? "Decline this invite?" : "Withdraw this invite?";
    if (!(await ask({ title, body: b.status === "active" ? "Your shared streak ends. Nobody is notified, and your own streaks are untouched." : undefined, confirm: b.status === "active" ? "End it" : "Yes", danger: b.status === "active" }))) return;
    await run(() => api(`/buddies/${b.id}/end`, { method: "POST" }));
  };

  const active = (q.data ?? []).filter((b) => b.status === "active");
  const pending = (q.data ?? []).filter((b) => b.status === "pending");

  return (
    <div>
      <SocialHeader
        title="Buddies"
        action={
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Invite a buddy" onClick={() => setInviting("")}>
            <Handshake size={22} />
          </button>
        }
      />
      <SocialGate>
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.data ? (
          <Loading />
        ) : q.data.length === 0 ? (
          <Empty
            icon={<Handshake size={26} />}
            title="Keep a streak with someone"
            body="A buddy week counts when you both keep your own. Pauses and freezes work just like yours. Invite someone you follow, or who follows you."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setInviting("")}>
                Invite a buddy
              </button>
            }
          />
        ) : (
          <>
            {pending.length > 0 && (
              <Section title="Invites">
                <ul className="card divide-y divide-line">
                  {pending.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={personName(b.buddy)} hue={b.buddy.avatar_hue} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{personName(b.buddy)}</span>
                        <span className="block text-sm text-dim">{b.incoming ? "Wants to be your streak buddy" : "Invite sent"}</span>
                      </span>
                      {b.incoming && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => void run(() => api(`/buddies/${b.id}/accept`, { method: "POST" }), "You're buddies now")}>
                          Accept
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void end(b)}>
                        {b.incoming ? "Decline" : "Withdraw"}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="field-hint">Accepting shares your weekly progress with each other: days against your target, and whether you're paused. Never your sessions, notes, or why.</p>
              </Section>
            )}
            {active.length > 0 && (
              <Section title="Keeping it going">
                <ul className="space-y-3">
                  {active.map((b) => (
                    <BuddyCard key={b.id} b={b} onEnd={() => void end(b)} />
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </SocialGate>
      <InviteSheet handle={inviting} setHandle={setInviting} onSent={refresh} />
      {confirmSheet}
    </div>
  );
}

function BuddyCard({ b, onEnd }: { b: BuddyView; onEnd: () => void }) {
  const me = b.me!;
  const them = b.them!;
  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={personName(b.buddy)} hue={b.buddy.avatar_hue} size={40} />
        <Link to={`/u/${b.buddy.handle}`} className="min-w-0 flex-1 hover:underline">
          <span className="block truncate font-semibold">
            {personName(b.buddy)}
            <OfficialMark official={Boolean(b.buddy.official)} />
          </span>
          <span className="block text-sm text-dim">@{b.buddy.handle}</span>
        </Link>
        <p className="num flex items-center gap-1 text-2xl font-semibold tracking-tight" aria-label={`${b.current} week shared streak`}>
          <Fire size={20} weight="fill" className="text-flame" aria-hidden />
          {b.current}
        </p>
      </div>
      <div className="mt-3">
        <WeekStrip weeks={b.weeks ?? []} label="The last 12 weeks together" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Progress label="You" days={me.days} target={me.target} />
        {them.paused ? (
          <p className="flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-2 text-muted">
            <Pause size={14} aria-hidden /> @{b.buddy.handle} is paused
          </p>
        ) : (
          <Progress label={`@${b.buddy.handle}`} days={them.days} target={them.target} />
        )}
      </div>
      <p className="mt-2 text-xs text-dim">Best together: {b.longest} week{b.longest === 1 ? "" : "s"}. A week counts when you both keep yours.</p>
      <div className="mt-3 flex gap-2">
        {b.buddy.handle && <EncourageButton handle={b.buddy.handle} className="btn btn-secondary btn-sm flex-1" />}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEnd}>
          End
        </button>
      </div>
    </li>
  );
}

function Progress({ label, days, target }: { label: string; days: number; target: number }) {
  const done = days >= target;
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <p className="truncate text-dim">{label}</p>
      <p className="num font-semibold">
        {days} of {target}
        {done && <span className="ml-1 text-accent-text">· kept</span>}
      </p>
    </div>
  );
}

function InviteSheet({ handle, setHandle, onSent }: { handle: string | null; setHandle: (h: string | null) => void; onSent: () => void }) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!handle) return;
    setBusy(true);
    try {
      await api("/buddies", { body: { handle: handle.replace(/^@/, "").trim() } });
      toast.success("Invite sent");
      setHandle(null);
      onSent();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={handle !== null} onClose={() => setHandle(null)} title="Invite a buddy">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Field label="Their handle" placeholder="@handle" autoCapitalize="none" value={handle ?? ""} onChange={(e) => setHandle(e.target.value)} hint="Someone you follow, or who follows you. Up to five buddies at a time." />
        <button className="btn btn-primary w-full" disabled={busy || !handle?.trim()}>
          Send invite
        </button>
      </form>
    </Sheet>
  );
}
