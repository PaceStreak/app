import { WEEKDAYS_LONG, daysBetween, fmtMonthDay, weekday } from "./dates";
import type { Challenge, Me, Plan, Stats, Workout } from "./types";

export type CardTone = "flame" | "accent" | "neutral" | "danger";
export type CardAction =
  | { kind: "log"; label: string; discipline?: string }
  | { kind: "link"; label: string; to: string }
  | { kind: "repair"; label: string; chainId: string; week: string }
  | { kind: "install"; label: string }
  | { kind: "push"; label: string }
  | { kind: "resend"; label: string }
  | { kind: "cancel-deletion"; label: string }
  | { kind: "timezone"; label: string; timezone: string };

export interface CoachCard {
  id: string;
  tone: CardTone;
  icon: "flame" | "check" | "warning" | "repair" | "trophy" | "users" | "bell" | "download" | "play" | "sparkle" | "mail" | "sun" | "chart" | "globe" | "calendar";
  title: string;
  body: string;
  primary?: CardAction;
  secondary?: CardAction;
  dismissible?: boolean;
}

export interface CoachContext {
  me: Me;
  stats: Stats | undefined;
  workouts: Workout[];
  today: string;
  week: { count: number; trainedToday: boolean };
  challenges: Challenge[] | undefined;
  /** The running training plan, if any. */
  plan?: Plan | null;
  failed: number;
  activeWorkout: { startedAt: string; title: string } | null;
  canInstall: boolean;
  pushOffer: boolean;
  dismissed: (id: string) => boolean;
  /** The device's IANA timezone, when the browser will say. */
  deviceTimezone?: string | null;
}

/**
 * Whether two IANA zones keep the same clock. Browsers report legacy
 * aliases ("Asia/Calcutta" for "Asia/Kolkata", "Europe/Kiev" for
 * "Europe/Kyiv"), so comparing names would call a person who never moved a
 * traveller. Same wall-clock time now and in six months (either side of
 * any daylight-saving change) means same zone, for everything the app does.
 */
export function sameClock(a: string, b: string, now = new Date()): boolean {
  if (a === b) return true;
  try {
    const at = (tz: string, d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    const later = new Date(now.getTime() + 182 * 86_400_000);
    return at(a, now) === at(b, now) && at(a, later) === at(b, later);
  } catch {
    return false; // an unknown zone name: not provably the same
  }
}

/** "America/New_York" -> "New York". Good enough to recognise a place. */
export function placeName(tz: string): string {
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Everything worth saying right now, most important first. The home screen
 * shows the first card large and the next three small; the order encodes the
 * product's priorities: account safety, then unsaved work, then the streak,
 * then everything else. Nothing here nags - every at-risk card carries the
 * off-ramp, because a streak is not worth training hurt for.
 */
export function buildCards(ctx: CoachContext): CoachCard[] {
  const { me, stats, today, week } = ctx;
  const cards: CoachCard[] = [];
  const main = stats?.chains[0];
  const target = main?.this_week_target ?? 3;
  const weekDays = Math.max(week.count, main?.this_week_days ?? 0);
  const weekEnd = WEEKDAYS_LONG[(me.profile.week_starts_on + 6) % 7];

  if (me.profile.deletion_scheduled_at) {
    cards.push({
      id: "deletion",
      tone: "danger",
      icon: "warning",
      title: "Your account is set to be deleted",
      body: `Everything goes on ${fmtMonthDay(me.profile.deletion_scheduled_at.slice(0, 10))}. Changed your mind?`,
      primary: { kind: "cancel-deletion", label: "Keep my account" },
    });
  }

  if (ctx.activeWorkout) {
    cards.push({
      id: "active",
      tone: "accent",
      icon: "play",
      title: `${ctx.activeWorkout.title} is still going`,
      body: "Pick up where you left off. Nothing is lost.",
      primary: { kind: "link", label: "Resume", to: "/workouts/live" },
    });
  }

  if (ctx.failed > 0) {
    cards.push({
      id: "failed",
      tone: "danger",
      icon: "warning",
      title: `${plural(ctx.failed, "session")} couldn't be saved`,
      body: "The server refused it. Open it to fix the problem or discard it.",
      primary: { kind: "link", label: "Review", to: "/history?filter=unsaved" },
    });
  }

  // Travel: the phone moved timezone and the profile didn't. Switching keeps
  // "today", reminders and the week boundary where the person actually is;
  // days already logged keep the date they were logged on. Offered once per
  // destination, and never nagged.
  const tz = ctx.deviceTimezone;
  if (tz && !sameClock(tz, me.profile.timezone) && !ctx.dismissed(`tz:${tz}`)) {
    cards.push({
      id: `tz:${tz}`,
      tone: "neutral",
      icon: "globe",
      title: `Travelling? Your phone is on ${placeName(tz)} time`,
      body: `PaceStreak is still on ${placeName(me.profile.timezone)} time. Switch so today and your reminders line up where you are. Sessions you've already logged keep their dates.`,
      primary: { kind: "timezone", label: `Use ${placeName(tz)} time`, timezone: tz },
      secondary: { kind: "link", label: "Pause for the trip", to: "/settings/training#pause" },
      dismissible: true,
    });
  }

  // The plan's session for today, if one is still to do. Paused days get no
  // plan nudge either: the pause card says rest.
  const planned = ctx.plan?.today.find((p) => p.status === "today");
  if (ctx.plan && planned && !stats?.paused_today) {
    const extra = [planned.minutes ? `${planned.minutes} min` : null, planned.note].filter(Boolean).join(". ");
    cards.push({
      id: `plan:${ctx.plan.id}:${planned.date}:${planned.day}`,
      tone: "accent",
      icon: "calendar",
      title: planned.title,
      body: `${ctx.plan.repeat && ctx.plan.weeks_count === 1 ? `From ${ctx.plan.name}` : `${ctx.plan.name}, week ${(ctx.plan.current_week ?? 0) + 1} of ${ctx.plan.weeks_count}`}.${extra ? ` ${extra}` : ""}`,
      primary: planned.routine_id
        ? { kind: "link", label: "Start workout", to: `/workouts/live?routine=${planned.routine_id}` }
        : { kind: "log", label: "Log it", discipline: planned.discipline },
      // Not feeling it? Any strength session still completes a strength plan
      // day, so another routine is a swap, not a skip.
      secondary: planned.routine_id ? { kind: "link", label: "Another routine", to: "/routines" } : { kind: "link", label: "See the plan", to: `/plans/${ctx.plan.id}` },
      dismissible: true,
    });
  }

  // --- the streak --------------------------------------------------------
  const sessions = stats?.totals.sessions ?? ctx.workouts.length;
  const daysSince = stats?.last_active ? daysBetween(stats.last_active, today) : null;

  if (sessions === 0 && ctx.workouts.length === 0) {
    cards.push({
      id: "first",
      tone: "accent",
      icon: "sparkle",
      title: "Log your first session",
      body: "Anything counts: a run, a lift, a walk. It takes ten seconds, detail optional.",
      primary: { kind: "log", label: "Log a session" },
    });
  } else {
    const pause = stats?.paused_today ? (stats.pauses ?? []).find((p) => p.active) : undefined;
    if (pause) {
      cards.push({
        id: `paused:${pause.id}`,
        tone: "neutral",
        icon: "sun",
        title: "Streak paused",
        body: `${pause.ends_on ? `Until ${fmtMonthDay(pause.ends_on)}. ` : ""}Nothing breaks while you recover, and there are no reminders. Log anything you do; it still counts.`,
        primary: { kind: "link", label: "I'm back", to: "/settings/training#pause" },
      });
    }
    // Back from a long pause: suggest an easier first fortnight. Offered, never
    // applied - lowering the target is the person's call, and it only takes
    // effect from this week, so nothing in the past changes.
    if (!pause && main) {
      const back = (stats?.pauses ?? []).find(
        (p) => !p.active && !p.upcoming && daysBetween(p.starts_on, p.effective_end) >= 13 && daysBetween(p.effective_end, today) <= 14,
      );
      if (back && main.target > 1) {
        const easier = Math.max(1, main.target - 1);
        cards.push({
          id: `eased:${back.id}`,
          tone: "accent",
          icon: "sun",
          title: "Easing back in?",
          body: `After ${Math.round((daysBetween(back.starts_on, back.effective_end) + 1) / 7)} weeks off, ${easier} day${easier === 1 ? "" : "s"} a week for a fortnight is a kind start. Your current target is ${main.target}; it's your call.`,
          primary: { kind: "link", label: "Adjust target", to: "/settings/training" },
          dismissible: true,
        });
      }
    }
    // Just lost a streak worth having: start again gently, and never with a
    // guilt trip. Only when the week that broke it was a real miss, not a
    // pause, and only for the first fortnight after.
    if (!pause && main && main.current === 0 && main.longest >= 4 && main.target > 1) {
      const closed = main.weeks.slice(0, -1);
      const lastKept = closed.map((w) => w.status).lastIndexOf("kept");
      const broke = lastKept >= 0 && closed.length - 1 - lastKept <= 2 && closed[closed.length - 1]?.status === "missed";
      if (broke) {
        const easier = Math.max(1, main.target - 1);
        cards.push({
          id: `comeback:${closed[lastKept].week_start}`,
          tone: "neutral",
          icon: "sun",
          title: "Start again, gently",
          body: `Your ${main.longest}-week best isn't going anywhere. A week at ${easier} day${easier === 1 ? "" : "s"} is a fine first step back, and your consistency score barely noticed.`,
          primary: { kind: "log", label: "Log a session" },
          secondary: { kind: "link", label: "Adjust target", to: "/settings/training" },
          dismissible: true,
        });
      }
    }
    // A lighter week after a hard block: suggested when the last four weeks'
    // sessions were rated hard on average, or felt rough. Suggestion only.
    const deload = deloadSignal(ctx.workouts, today);
    if (!pause && deload) {
      cards.push({
        id: `deload:${deload.week}`,
        tone: "neutral",
        icon: "sun",
        title: "Time for a lighter week?",
        body: deload.reason === "effort"
          ? `Your last ${deload.sessions} sessions averaged effort ${deload.value.toFixed(1)} out of 10. A week at about half the load or volume usually brings the strength back sharper. Your streak only needs the days.`
          : `Your last ${deload.sessions} sessions mostly felt rough. An easier week, or a few rest days, is part of training, and your streak only needs the days.`,
        primary: { kind: "link", label: "How streaks work", to: "/progress#streaks" },
        dismissible: true,
      });
    }
    for (const chain of stats?.chains ?? []) {
      if (!chain.at_risk || (chain.current === 0 && chain.this_week_days === 0)) continue;
      const needed = Math.max(0, chain.this_week_target - (chain === main ? weekDays : chain.this_week_days));
      if (needed === 0) continue;
      const main_ = chain === main;
      cards.push({
        id: `risk:${chain.id}:${today}`,
        tone: "flame",
        icon: "flame",
        title: chain.will_freeze
          ? `A freeze has this week covered`
          : chain.current
            ? `${plural(needed, "more session")} keeps week ${chain.current + 1}`
            : `${plural(needed, "more session")} to keep ${main_ ? "this week" : chain.name}`,
        body: chain.will_freeze
          ? `You'd need ${needed} more by ${weekEnd}. If it's not happening, a freeze keeps your ${chain.current}-week streak. Rest if you need it.`
          : needed > chain.days_left
            ? `This week is out of reach. A repair can fix it later this month, so no need to train sore to save it.`
            : `By ${weekEnd}${main_ ? "" : ` on '${chain.name}'`}. ${
                chain.freezes_available > 0 && chain.current > 0
                  ? `If it slips, one of your ${plural(chain.freezes_available, "freeze")} covers the week automatically.`
                  : "Skip it if you're hurt or wiped: one missed week a month can be repaired."
              }`,
        primary: { kind: "log", label: "Log a session", discipline: chain.disciplines.length === 1 ? chain.disciplines[0] : undefined },
        secondary: { kind: "link", label: "How streaks work", to: "/progress#streaks" },
      });
    }

    if (stats?.repair_available) {
      for (const chain of stats.chains) {
        if (!chain.repairable_week) continue;
        cards.push({
          id: `repair:${chain.id}:${chain.repairable_week}`,
          tone: "neutral",
          icon: "repair",
          title: `Repair the week of ${fmtMonthDay(chain.repairable_week)}?`,
          body: `It fell short on '${chain.name}'. You get one repair a month; using it puts the week back in your streak.`,
          primary: { kind: "repair", label: "Repair it", chainId: chain.id, week: chain.repairable_week },
          dismissible: true,
        });
        break;
      }
    }

    if (daysSince !== null && daysSince >= 14 && !week.trainedToday) {
      cards.push({
        id: `welcome-back:${stats?.last_active}`,
        tone: "accent",
        icon: "sun",
        title: "Welcome back",
        body: "No catching up to do. This week is a fresh one; start with something easy.",
        primary: { kind: "log", label: "Log a session" },
      });
    } else if (week.trainedToday) {
      const kept = weekDays >= target;
      cards.push({
        id: `done:${today}:${weekDays}`,
        tone: "accent",
        icon: "check",
        title: kept ? "Week kept" : "Done for today",
        body: kept
          ? `${weekDays} of ${target} days. Anything more this week is a bonus, and rest counts too.`
          : `${weekDays} of ${target} this week, ${plural(target - weekDays, "day")} to go by ${weekEnd}.`,
        secondary: { kind: "log", label: "Log another" },
      });
    } else if (weekDays >= target) {
      cards.push({
        id: `kept:${today}`,
        tone: "accent",
        icon: "check",
        title: "This week is already kept",
        body: `${weekDays} of ${target} days done. Train if you want to; rest if you don't. Neither costs you anything.`,
        secondary: { kind: "log", label: "Log a session" },
      });
    } else if (!cards.some((c) => c.tone === "flame")) {
      const left = target - weekDays;
      const planned = me.profile.training_days != null && (me.profile.training_days & (1 << weekday(today))) !== 0;
      cards.push({
        id: `today:${today}`,
        tone: "neutral",
        icon: "flame",
        title: planned ? "Training day" : weekDays === 0 ? "New week, clean slate" : `${weekDays} of ${target} this week`,
        body:
          left === 1
            ? `One more day keeps the week${main?.current ? ` and makes it ${main.current + 1} in a row` : ""}.`
            : `${plural(left, "more day")} by ${weekEnd}. Plenty of room for rest.`,
        primary: { kind: "log", label: "Log a session" },
      });
    }
  }

  // --- everything else ---------------------------------------------------
  const live = (ctx.challenges ?? []).filter((c) => c.status === "live" && c.joined);
  for (const c of live.slice(0, 1)) {
    const daysLeft = daysBetween(today, c.ends_on);
    cards.push({
      id: `challenge:${c.id}`,
      tone: "neutral",
      icon: "trophy",
      title: c.title,
      body: daysLeft <= 0 ? "Last day. Every active day counts." : `${plural(daysLeft + 1, "day")} left, counting distinct active days.`,
      primary: { kind: "link", label: "See the board", to: `/challenges/${c.id}` },
    });
  }

  if (me.follow_requests > 0) {
    cards.push({
      id: `requests:${me.follow_requests}`,
      tone: "neutral",
      icon: "users",
      title: `${plural(me.follow_requests, "person wants", "people want")} to follow you`,
      body: "They'll see your sessions once you say yes.",
      primary: { kind: "link", label: "Review", to: "/people?tab=requests" },
      dismissible: true,
    });
  }

  if (!me.user.is_verified) {
    cards.push({
      id: "verify",
      tone: "neutral",
      icon: "mail",
      title: "Confirm your email",
      body: `We sent a link to ${me.user.email}. Following people and groups unlock once it's confirmed.`,
      primary: { kind: "resend", label: "Send it again" },
      dismissible: true,
    });
  }

  if (stats?.gamification_enabled && stats.level.to_next <= 60 && stats.level.to_next > 0) {
    cards.push({
      id: `level:${stats.level.level}`,
      tone: "neutral",
      icon: "chart",
      title: `${stats.level.to_next} XP to level ${stats.level.level + 1}`,
      body: "Showing up earns it. Weight lifted doesn't change a thing.",
      primary: { kind: "link", label: "Where XP comes from", to: "/progress/xp" },
      dismissible: true,
    });
  }

  if (ctx.pushOffer && sessions > 0) {
    cards.push({
      id: "push",
      tone: "neutral",
      icon: "bell",
      title: "Want a heads-up before a week slips?",
      body: "One nudge on the evening it matters. Never on rest days you've already earned.",
      primary: { kind: "push", label: "Turn on" },
      dismissible: true,
    });
  }

  if (ctx.canInstall && sessions > 0) {
    cards.push({
      id: "install",
      tone: "neutral",
      icon: "download",
      title: "Put PaceStreak on your home screen",
      body: "Opens instantly, works without signal, logs in two taps.",
      primary: { kind: "install", label: "Install" },
      dismissible: true,
    });
  }

  return cards.filter((c) => !(c.dismissible && ctx.dismissed(c.id)));
}

/**
 * Four weeks of sessions rated hard (average effort 8+ of 10), or feeling
 * rough (average feel 2 or under of 5), with at least eight rated sessions
 * so a single bad week can't trigger it. Keyed by week so it's offered at
 * most once a week.
 */
export function deloadSignal(workouts: Workout[], today: string): { reason: "effort" | "feel"; value: number; sessions: number; week: string } | null {
  const since = addDaysIso(today, -28);
  const recent = workouts.filter((w) => !w.deleted_at && w.local_date > since && w.local_date <= today);
  const efforts = recent.map((w) => w.effort).filter((e): e is number => e != null);
  const feels = recent.map((w) => w.feel).filter((f): f is number => f != null);
  const week = addDaysIso(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  if (efforts.length >= 8 && mean(efforts) >= 8) return { reason: "effort", value: mean(efforts), sessions: efforts.length, week };
  if (feels.length >= 8 && mean(feels) <= 2) return { reason: "feel", value: mean(feels), sessions: feels.length, week };
  return null;
}

function addDaysIso(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
