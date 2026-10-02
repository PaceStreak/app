import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Barbell,
  BookOpenText,
  Lightbulb,
  MagnifyingGlass,
  Trash,
  ForkKnife,
  CalendarBlank,
  ChartLineUp,
  Gear,
  ListBullets,
  Medal,
  Scales,
  ShieldCheck,
  Sparkle,
  Trophy,
  UsersThree,
  Wrench,
  CalendarCheck,
} from "../components/phosphor";
import { personName } from "../components/social";
import { Avatar, List, RowLink, Section } from "../components/ui";
import { useStats } from "../lib/queries";
import { api } from "../lib/api";
import { useMe } from "../lib/session";

export default function You() {
  const me = useMe();
  const stats = useStats().data;
  // Only coaches see the Coaching row; for everyone else this is an empty list.
  const coaching = useQuery({ queryKey: ["coaching"], queryFn: () => api<{ groups: unknown[] }>("/coaching"), staleTime: 300_000 });
  const main = stats?.chains[0];
  const staff = me.user.role !== "user";
  const name = me.profile.display_name || me.profile.handle || "You";
  return (
    <div className="pt-6">
      <Link to={me.profile.handle ? `/u/${me.profile.handle}` : "/settings/profile"} className="press flex items-center gap-4">
        <Avatar name={personName({ display_name: me.profile.display_name, handle: me.profile.handle ?? "" })} hue={me.profile.avatar_hue} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="text-muted">@{me.profile.handle} · your public profile</p>
        </div>
      </Link>

      {stats && (
        <div className="mt-6 grid grid-cols-3 gap-2">
          <div className="card p-4">
            <p className="text-sm text-dim">Streak</p>
            <p className="num mt-1 text-2xl font-semibold">{main?.current ?? 0}<span className="text-sm text-dim"> wk</span></p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-dim">Best</p>
            <p className="num mt-1 text-2xl font-semibold">{main?.longest ?? 0}<span className="text-sm text-dim"> wk</span></p>
          </div>
          {stats.gamification_enabled ? (
            <Link to="/progress/xp" className="card press p-4">
              <p className="text-sm text-dim">Level</p>
              <p className="num mt-1 text-2xl font-semibold">{stats.level.level}</p>
            </Link>
          ) : (
            <div className="card p-4">
              <p className="text-sm text-dim">Days</p>
              <p className="num mt-1 text-2xl font-semibold">{stats.totals.active_days}</p>
            </div>
          )}
        </div>
      )}

      {/* Two independent columns on a wide screen, not grid rows: a row is as
          tall as its tallest section, which left a hole under Training. */}
      <div className="lg:flex lg:items-start lg:gap-6">
      <div className="min-w-0 lg:flex-1">
      <Section title="Training">
        <List>
          <RowLink to="/habits" icon={<Sparkle size={20} />} title="Habits" detail={stats?.habits?.count ? `${stats.habits.count} tracked` : "Reading, water, a skill…"} />
          <RowLink to="/history" icon={<CalendarBlank size={20} />} title="Sessions" detail={stats ? `${stats.totals.sessions} logged` : undefined} />
          <RowLink to="/plans" icon={<CalendarCheck size={20} />} title="Training plans" />
          <RowLink to="/routines" icon={<ListBullets size={20} />} title="Routines" />
          <RowLink to="/exercises" icon={<Barbell size={20} />} title="Exercises" />
          <RowLink to="/tools" icon={<Wrench size={20} />} title="Tools" detail="Rest and interval timers, plates, 1RM, pace" />
        </List>
      </Section>
      <Section title="Together">
        <List>
          <RowLink to="/feed" icon={<UsersThree size={20} />} title="Feed" detail="Sessions and milestones from people you follow" />
          <RowLink to="/people" icon={<UsersThree size={20} />} title="Find people" />
          <RowLink to="/groups" icon={<UsersThree size={20} />} title="Groups" />
          {coaching.data && coaching.data.groups.length > 0 && <RowLink to="/coaching" icon={<UsersThree size={20} />} title="Coaching" detail="Everyone sharing their training with you" />}
          <RowLink to="/challenges" icon={<Trophy size={20} />} title="Challenges" />
          <RowLink to="/leaderboards" icon={<Medal size={20} />} title="Leaderboards" />
        </List>
      </Section>
      </div>
      <div className="min-w-0 lg:flex-1">
      <Section title="Progress">
        <List>
          <RowLink to="/progress" icon={<ChartLineUp size={20} />} title="Progress and streaks" />
          <RowLink to="/records" icon={<Trophy size={20} />} title="Personal records" />
          <RowLink to="/achievements" icon={<Medal size={20} />} title="Achievements" />
          {stats?.gamification_enabled && <RowLink to="/progress/xp" icon={<Sparkle size={20} />} title="Level and XP" />}
          <RowLink to="/body" icon={<Scales size={20} />} title="Body" detail="Private" />
          <RowLink to="/search" icon={<MagnifyingGlass size={20} />} title="Search" detail="Habits, notes, sessions, journal, food" />
          <RowLink to="/insights" icon={<Lightbulb size={20} />} title="Insights" detail="Patterns in your own data" />
          <RowLink to="/journal" icon={<BookOpenText size={20} />} title="Journal" detail="Mood and notes · private" />
          <RowLink to="/food" icon={<ForkKnife size={20} />} title="Food" detail="Calories and macros · private" />
        </List>
      </Section>
      <Section title="Account">
        <List>
          <RowLink to="/settings" icon={<Gear size={20} />} title="Settings" />
          <RowLink to="/trash" icon={<Trash size={20} />} title="Trash" detail="Restore anything deleted in the last 30 days" />
          {staff && <RowLink to="/admin" icon={<ShieldCheck size={20} />} title="Moderation" />}
        </List>
      </Section>
      </div>
      </div>
    </div>
  );
}
