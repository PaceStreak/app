import { WEEKDAYS_LONG, daysBetween, fmtMonthDay, weekday } from "./dates";
import type { Challenge, Me, Stats, Workout } from "./types";

export type CardTone = "flame" | "accent" | "neutral" | "danger";
export type CardAction =
  | { kind: "log"; label: string; discipline?: string }
  | { kind: "link"; label: string; to: string }
  | { kind: "repair"; label: string; chainId: string; week: string }
  | { kind: "install"; label: string }
  | { kind: "push"; label: string }
  | { kind: "resend"; label: string }
  | { kind: "cancel-deletion"; label: string };

export interface CoachCard {
  id: string;
  tone: CardTone;
  icon: "flame" | "check" | "warning" | "repair" | "trophy" | "users" | "bell" | "download" | "play" | "sparkle" | "mail" | "sun" | "chart";
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
  failed: number;
  activeWorkout: { startedAt: string; title: string } | null;
  canInstall: boolean;
  pushOffer: boolean;
  dismissed: (id: string) => boolean;
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
            : `By ${weekEnd}${main_ ? "" : ` on '${chain.name}'`}. Skip it if you're hurt or wiped: one missed week a month can be repaired.`,
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
