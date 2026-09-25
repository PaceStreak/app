import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { GettingStarted } from "../components/GettingStarted";
import { Heatmap } from "../components/Heatmap";
import {
  ArrowCounterClockwise,
  Bell,
  CalendarCheck,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  DownloadSimple,
  EnvelopeSimple,
  Fire,
  GlobeHemisphereWest,
  Play,
  Sparkle,
  Sun,
  Trophy,
  UsersThree,
  Warning,
  X,
} from "../components/phosphor";
import { toast } from "../components/toast";
import { WeekDots } from "../components/WeekDots";
import { WorkoutRow } from "../components/WorkoutRow";
import { Skeleton } from "../components/ui";
import { api, errorText } from "../lib/api";
import { buildCards, placeName, type CardAction, type CoachCard } from "../lib/coach";
import { fmtFullDay, localToday } from "../lib/dates";
import { kvGet } from "../lib/db";
import { haptic, prefs } from "../lib/prefs";
import { canInstall, currentPushSubscription, enablePush, install, onInstallChange, pushSupported } from "../lib/pwa";
import { queryClient, useLibrary, useStats, useSyncState, useWorkouts } from "../lib/queries";
import { useMe, useSession } from "../lib/session";
import { localWeek } from "../lib/training";
import type { Challenge, Plan } from "../lib/types";
import { useProfilePatch } from "./settings/useProfilePatch";
import { useLog } from "../shell/LogContext";

const ICONS: Record<CoachCard["icon"], ReactNode> = {
  flame: <Fire weight="fill" />,
  check: <CheckCircle weight="fill" />,
  warning: <Warning weight="fill" />,
  repair: <ArrowCounterClockwise weight="bold" />,
  trophy: <Trophy weight="fill" />,
  users: <UsersThree weight="fill" />,
  bell: <Bell weight="fill" />,
  download: <DownloadSimple weight="bold" />,
  play: <Play weight="fill" />,
  sparkle: <Sparkle weight="fill" />,
  mail: <EnvelopeSimple weight="fill" />,
  sun: <Sun weight="fill" />,
  chart: <ChartLineUp weight="bold" />,
  globe: <GlobeHemisphereWest weight="fill" />,
  calendar: <CalendarCheck weight="fill" />,
};

function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function Today() {
  const me = useMe();
  const { reloadMe } = useSession();
  const patchProfile = useProfilePatch();
  const stats = useStats();
  const workouts = useWorkouts();
  const lib = useLibrary();
  const sync = useSyncState();
  const { openLog } = useLog();
  const navigate = useNavigate();
  const today = stats.data?.today ?? localToday(me.profile.timezone);
  const main = stats.data?.chains[0] ?? null;
  const week = useMemo(
    () => localWeek(workouts ?? [], main, today, me.profile.week_starts_on),
    [workouts, main, today, me.profile.week_starts_on],
  );
  const challenges = useQuery({
    queryKey: ["challenges"],
    queryFn: () => api<Challenge[]>("/challenges"),
    enabled: me.social_allowed,
  });
  const plan = useQuery({ queryKey: ["plan-active"], queryFn: () => api<Plan | null>("/plans/active") });
  const [active, setActive] = useState<{ startedAt: string; title: string } | null>(null);
  const [installable, setInstallable] = useState(canInstall());
  const [pushOffer, setPushOffer] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    void kvGet<{ started_at: string; title: string | null }>("active-workout").then((w) =>
      setActive(w ? { startedAt: w.started_at, title: w.title || "Your workout" } : null),
    );
  }, []);
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);
  useEffect(() => {
    if (!me.push_public_key || !pushSupported() || Notification.permission === "denied") return;
    void currentPushSubscription().then((s) => setPushOffer(!s));
  }, [me.push_public_key]);

  const cards = useMemo(
    () =>
      buildCards({
        me,
        stats: stats.data,
        workouts: workouts ?? [],
        today,
        week,
        challenges: challenges.data,
        plan: plan.data,
        failed: sync.failed.length,
        activeWorkout: active,
        canInstall: installable && Date.now() - prefs.installDismissed() > 14 * 86_400_000,
        pushOffer,
        dismissed: prefs.dismissed,
        deviceTimezone: deviceTimezone(),
      }),
    // bump re-renders after a dismissal
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me, stats.data, workouts, today, week, challenges.data, plan.data, sync.failed.length, active, installable, pushOffer, bump],
  );

  const run = async (action: CardAction) => {
    haptic(8);
    try {
      switch (action.kind) {
        case "log":
          openLog({ discipline: action.discipline });
          break;
        case "link":
          navigate(action.to);
          break;
        case "repair":
          await api(`/chains/${action.chainId}/repair`, { body: { week_start: action.week } });
          toast.success("Week repaired", { body: "It's back in your streak. Next repair: next month." });
          await queryClient.invalidateQueries({ queryKey: ["stats"] });
          break;
        case "install": {
          const result = await install();
          if (result === "ios") toast("Tap Share, then Add to Home Screen", { duration: 8000 });
          setInstallable(canInstall());
          break;
        }
        case "push": {
          if (!me.push_public_key) break;
          const result = await enablePush(me.push_public_key);
          if (result === "granted") toast.success("Nudges are on", { body: "Change what you get in Settings." });
          else if (result === "denied") toast("Notifications are blocked in your browser settings");
          setPushOffer(false);
          break;
        }
        case "resend":
          await api("/auth/resend-verification", { body: { email: me.user.email }, auth: false });
          toast.success("Sent", { body: `Check ${me.user.email}.` });
          break;
        case "timezone":
          await patchProfile({ timezone: action.timezone }, `Now on ${placeName(action.timezone)} time`);
          await queryClient.invalidateQueries({ queryKey: ["stats"] });
          break;
        case "cancel-deletion":
          await api("/me/delete/cancel", { method: "POST" });
          await reloadMe();
          toast.success("Your account is staying");
          break;
      }
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const dismiss = (card: CoachCard) => {
    if (card.id === "install") prefs.dismissInstall();
    prefs.dismiss(card.id);
    bump((n) => n + 1);
  };

  const recent = (workouts ?? []).slice(0, 4);
  const gamified = stats.data?.gamification_enabled ?? me.profile.gamification_enabled;

  return (
    <div className="pt-3 lg:pt-8">
      {/* Status strip: streak, week, level. */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1.5">
          <Fire size={22} weight="fill" className="self-center text-flame" />
          <span className="num text-[1.6rem] leading-none font-semibold tracking-tight">{main?.current ?? 0}</span>
          <span className="text-sm text-muted">{main?.current === 1 ? "week" : "weeks"}</span>
        </div>
        <span className="h-5 w-px bg-line" aria-hidden />
        <div className="flex items-center gap-2">
          <WeekDots dots={week.dots} size="sm" />
          <span className="num text-sm text-muted">
            {Math.max(week.count, main?.this_week_days ?? 0)}/{main?.this_week_target ?? 3}
          </span>
        </div>
        {gamified && stats.data && (
          <Link to="/progress/xp" className="chip ml-auto">
            Lv {stats.data.level.level}
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-dim">{fmtFullDay(today)}</p>

      <div className="mt-5">
        {!stats.seeded || !workouts ? (
          <Skeleton className="h-64 rounded-[20px]" />
        ) : (
          <>
            <GettingStarted sessions={Math.max(stats.data?.totals.sessions ?? 0, workouts.length)} onLog={() => openLog()} />
            <CoachStack cards={cards} onAction={run} onDismiss={dismiss} />
          </>
        )}
      </div>

      {recent.length > 0 && (
        <section className="mt-9">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[1.05rem] font-semibold tracking-tight">Recent</h2>
            <Link to="/history" className="text-sm font-semibold text-accent-text">
              All sessions
            </Link>
          </div>
          <div className="card divide-y divide-line overflow-hidden">
            {recent.map((w) => (
              <WorkoutRow key={w.id} w={w} lib={lib} profile={me.profile} today={today} />
            ))}
          </div>
        </section>
      )}

      {stats.data && stats.data.totals.sessions > 0 && (
        <Link to="/progress" className="press card mt-6 block p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold tracking-tight">The grid</h2>
            <span className="num text-sm text-dim">
              {stats.data.totals.active_days} days · longest {main?.longest ?? 0} wk
            </span>
          </div>
          <Heatmap
            days={stats.data.heatmap}
            weeks={main?.weeks}
            today={today}
            weekStartsOn={me.profile.week_starts_on}
            span={26}
            plannedDays={stats.data.training_days ?? me.profile.training_days}
            pauses={stats.data.pauses ?? []}
          />
        </Link>
      )}
    </div>
  );
}

function CoachStack({
  cards,
  onAction,
  onDismiss,
}: {
  cards: CoachCard[];
  onAction: (a: CardAction) => void;
  onDismiss: (c: CoachCard) => void;
}) {
  const lead = cards[0];
  const rest = cards.slice(1, 4);
  const [leaving, setLeaving] = useState<CoachCard | null>(null);
  const previous = useRef<CoachCard | undefined>(lead);

  // The signature moment: when the lead card's situation resolves (you
  // logged, the week got kept, a repair landed), the old card blurs out as
  // a flame check draws, and the next one rises into its place.
  useEffect(() => {
    const prev = previous.current;
    previous.current = lead;
    if (prev && lead && prev.id !== lead.id && !cards.some((c) => c.id === prev.id)) {
      setLeaving(prev);
      const t = setTimeout(() => setLeaving(null), 520);
      return () => clearTimeout(t);
    }
  }, [lead, cards]);

  if (!lead) return null;
  return (
    <div className="space-y-3">
      <div className="coach-slot">
        {leaving && (
          <div className="coach-leaving" aria-hidden>
            <LeadCard card={leaving} onAction={() => undefined} onDismiss={() => undefined} />
            <svg className="coach-tick" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" />
              <path d="M21 33 29 41 44 24" />
            </svg>
          </div>
        )}
        <div key={lead.id} className={leaving ? "coach-entering" : ""}>
          <LeadCard card={lead} onAction={onAction} onDismiss={onDismiss} />
        </div>
      </div>
      {rest.length > 0 && (
        <div className="stagger space-y-2">
          {rest.map((c) => (
            <SmallCard key={c.id} card={c} onAction={onAction} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButton({ action, onAction, primary }: { action: CardAction; onAction: (a: CardAction) => void; primary?: boolean }) {
  return (
    <button type="button" className={`btn ${primary ? "btn-primary" : "btn-ghost"}`} onClick={() => onAction(action)}>
      {action.label}
    </button>
  );
}

function LeadCard({ card, onAction, onDismiss }: { card: CoachCard; onAction: (a: CardAction) => void; onDismiss: (c: CoachCard) => void }) {
  return (
    <article className="coach-lead card-raised relative flex flex-col p-5 sm:p-6" data-tone={card.tone}>
      <div className="flex items-start justify-between gap-3">
        <span className="coach-icon grid size-11 place-items-center rounded-2xl text-[22px]">{ICONS[card.icon]}</span>
        {card.dismissible && (
          <button type="button" aria-label="Dismiss" className="btn btn-ghost btn-icon -mt-2 -mr-2 text-dim" onClick={() => onDismiss(card)}>
            <X size={18} />
          </button>
        )}
      </div>
      <h1 className="mt-auto pt-10 text-[1.75rem] leading-[1.12] font-semibold tracking-[-0.025em] text-balance">{card.title}</h1>
      <p className="mt-2.5 max-w-[46ch] text-[1rem] text-muted">{card.body}</p>
      {(card.primary || card.secondary) && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {card.primary && <ActionButton action={card.primary} onAction={onAction} primary />}
          {card.secondary && <ActionButton action={card.secondary} onAction={onAction} />}
        </div>
      )}
    </article>
  );
}

function SmallCard({ card, onAction, onDismiss }: { card: CoachCard; onAction: (a: CardAction) => void; onDismiss: (c: CoachCard) => void }) {
  const action = card.primary ?? card.secondary;
  return (
    <article className="card coach-small flex items-center gap-3 p-3.5 pr-2" data-tone={card.tone}>
      <span className="coach-icon grid size-10 shrink-0 place-items-center rounded-xl text-[19px]">{ICONS[card.icon]}</span>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => action && onAction(action)}>
        <span className="block truncate font-semibold">{card.title}</span>
        <span className="line-clamp-1 text-sm text-dim">{card.body}</span>
      </button>
      {card.dismissible ? (
        <button type="button" aria-label="Dismiss" className="btn btn-ghost btn-icon btn-sm text-dim" onClick={() => onDismiss(card)}>
          <X size={16} />
        </button>
      ) : (
        <CaretRight size={16} className="mr-2 shrink-0 text-dim" />
      )}
    </article>
  );
}
