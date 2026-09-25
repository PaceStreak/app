import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { CaretRight, Plus, Trophy } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Empty, ErrorState, Loading, Section, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { addDays, daysBetween, fmtMonthDay, localToday } from "../../lib/dates";
import { queryClient, useLibrary } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Challenge, PlanSummary, PlanTemplate } from "../../lib/types";
import { SocialGate, SocialHeader } from "./SocialNav";

export function ChallengeCard({ c }: { c: Challenge }) {
  const me = useMe();
  const today = localToday(me.profile.timezone);
  const total = daysBetween(c.starts_on, c.ends_on) + 1;
  const elapsed = Math.max(0, Math.min(total, daysBetween(c.starts_on, today) + 1));
  return (
    <Link to={`/challenges/${c.id}`} className="press card block p-4 hover:border-line-lit">
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${c.status === "live" ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}>
          <Trophy size={22} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c.title}</p>
          <p className="text-sm text-dim">
            {c.status === "upcoming" ? `Starts ${fmtMonthDay(c.starts_on)}` : c.status === "live" ? `${total - elapsed + 1} days left` : `Ended ${fmtMonthDay(c.ends_on)}`}
            {c.participants ? ` · ${c.participants} in` : ""}
            {c.joined ? "" : " · not joined"}
          </p>
        </div>
        <CaretRight size={16} className="mt-1 text-dim" />
      </div>
      {c.status === "live" && (
        <div className="mt-3 h-1.5 rounded-full bg-surface-3" aria-hidden>
          <div className="h-full rounded-full bg-[var(--chart)]" style={{ width: `${(elapsed / total) * 100}%` }} />
        </div>
      )}
    </Link>
  );
}

export default function Challenges() {
  const q = useQuery({ queryKey: ["challenges"], queryFn: () => api<Challenge[]>("/challenges") });
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const live = (q.data ?? []).filter((c) => c.status !== "finished");
  const done = (q.data ?? []).filter((c) => c.status === "finished");
  return (
    <div>
      <SocialHeader
        title="Challenges"
        action={
          <button type="button" className="btn btn-ghost btn-icon" aria-label="New challenge" onClick={() => setCreating(true)}>
            <Plus size={22} />
          </button>
        }
      />
      <SocialGate>
        <p className="mb-5 text-[0.95rem] text-muted">Scored on distinct days you trained, one per day at most. Nobody wins by training twice a day or skipping rest.</p>
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.data ? (
          <Loading />
        ) : q.data.length === 0 ? (
          <Empty
            icon={<Trophy size={26} />}
            title="No challenges yet"
            body="Start one with friends, or join with a code someone sent you."
            action={
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setJoining(true)}>Join with code</button>
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>New challenge</button>
              </div>
            }
          />
        ) : (
          <>
            <div className="space-y-3">
              {live.map((c) => (
                <ChallengeCard key={c.id} c={c} />
              ))}
            </div>
            <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setJoining(true)}>
              Join with a code
            </button>
            {done.length > 0 && (
              <Section title="Finished">
                <div className="space-y-3">
                  {done.map((c) => (
                    <ChallengeCard key={c.id} c={c} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </SocialGate>
      <NewChallengeSheet open={creating} onClose={() => setCreating(false)} />
      <JoinSheet open={joining} onClose={() => setJoining(false)} />
    </div>
  );
}

function JoinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const join = async () => {
    try {
      const res = await api<{ id: string }>("/challenges/join", { body: { code } });
      await queryClient.invalidateQueries({ queryKey: ["challenges"] });
      onClose();
      navigate(`/challenges/${res.id}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Join a challenge" footer={<button type="button" className="btn btn-primary w-full" disabled={code.length < 4} onClick={join}>Join</button>}>
      <input className="input num tracking-[0.2em] lowercase" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} aria-label="Challenge code" autoCapitalize="none" />
    </Sheet>
  );
}

export function NewChallengeSheet({ open, onClose, groupId }: { open: boolean; onClose: () => void; groupId?: string }) {
  const me = useMe();
  const lib = useLibrary();
  const navigate = useNavigate();
  const today = localToday(me.profile.timezone);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"active_days" | "weekly_target" | "plan_sessions">("active_days");
  const [planChoice, setPlanChoice] = useState("tpl:plan-two-a-week");
  const templates = useQuery({ queryKey: ["plan-templates"], queryFn: () => api<PlanTemplate[]>("/plans/templates"), enabled: open && kind === "plan_sessions", staleTime: Infinity });
  const myPlans = useQuery({ queryKey: ["plans"], queryFn: () => api<PlanSummary[]>("/plans"), enabled: open && kind === "plan_sessions" });
  const [length, setLength] = useState(14);
  const [target, setTarget] = useState("10");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const plan = kind === "plan_sessions" ? (planChoice.startsWith("tpl:") ? { plan_template_id: planChoice.slice(4) } : { plan_id: planChoice.slice(5) }) : {};
      const planName =
        kind === "plan_sessions"
          ? planChoice.startsWith("tpl:")
            ? templates.data?.find((t) => `tpl:${t.id}` === planChoice)?.name
            : myPlans.data?.find((p) => `mine:${p.id}` === planChoice)?.name
          : null;
      const c = await api<Challenge>("/challenges", {
        body: {
          title: title || (kind === "active_days" ? `${target || length} days in ${length}` : kind === "plan_sessions" ? `${planName ?? "One plan"}, together` : `Keep every week`),
          kind,
          target: kind === "plan_sessions" ? null : target ? Number(target) : null,
          disciplines: kind === "plan_sessions" ? [] : disciplines,
          starts_on: today,
          ends_on: addDays(today, length - 1),
          group_id: groupId ?? null,
          ...plan,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["challenges"] });
      onClose();
      navigate(`/challenges/${c.id}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={groupId ? "New group challenge" : "New challenge"} footer={<button type="button" className="btn btn-primary w-full" disabled={busy} onClick={create}>Start challenge</button>}>
      <div className="space-y-5">
        <input className="input" placeholder="Name (optional)" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Challenge name" />
        <div>
          <p className="field-label">What counts</p>
          <Segmented label="Scoring" value={kind} onChange={setKind} options={[{ value: "active_days", label: "Active days" }, { value: "weekly_target", label: "Kept weeks" }, { value: "plan_sessions", label: "One plan" }]} />
          <p className="field-hint">
            {kind === "active_days"
              ? "Most distinct training days wins. One per day, however many sessions."
              : kind === "weekly_target"
                ? "Weeks where each person hits their own target. Fair between a 3-day and a 6-day plan."
                : "Everyone follows the same plan; each person gets their own copy, and every planned session done counts. It runs as long as the plan."}
          </p>
        </div>
        {kind === "plan_sessions" && (
          <div>
            <label className="field-label" htmlFor="c-plan">The plan</label>
            <select id="c-plan" className="input" value={planChoice} onChange={(e) => setPlanChoice(e.target.value)}>
              <optgroup label="Templates">
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={`tpl:${t.id}`}>{t.name} ({t.weeks_count} weeks)</option>
                ))}
              </optgroup>
              {(myPlans.data ?? []).length > 0 && (
                <optgroup label="Your plans">
                  {(myPlans.data ?? []).map((p) => (
                    <option key={p.id} value={`mine:${p.id}`}>{p.name} ({p.weeks_count} weeks)</option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="field-hint">Joining switches each person's running plan to their copy of this one. Up to 13 weeks.</p>
          </div>
        )}
        {kind !== "plan_sessions" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="c-len">Length</label>
            <select id="c-len" className="input" value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[7, 14, 21, 28, 30, 42, 60, 90].map((d) => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="c-target">Finish line (optional)</label>
            <input id="c-target" className="input num" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        )}
        {kind !== "plan_sessions" && (
        <div>
          <p className="field-label">Only these activities (optional)</p>
          <div className="flex flex-wrap gap-2">
            {lib?.lib.disciplines.map((d) => {
              const on = disciplines.includes(d.id);
              return (
                <button key={d.id} type="button" aria-pressed={on} className={`chip h-8 ${on ? "chip-accent" : ""}`} onClick={() => setDisciplines(on ? disciplines.filter((x) => x !== d.id) : [...disciplines, d.id])}>
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
        )}
        <p className="text-sm text-dim">Starts today. Sessions only count if they're logged within three days of happening, so nobody can backfill their way to the top.</p>
      </div>
    </Sheet>
  );
}
