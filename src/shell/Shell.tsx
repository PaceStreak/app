import { Logo } from "../components/Logo";
import { t } from "../lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  Barbell,
  Bell,
  CalendarBlank,
  CalendarCheck,
  ChartLineUp,
  CloudSlash,
  Gear,
  House,
  ListBullets,
  MagnifyingGlass,
  Plus,
  Sparkle,
  Trophy,
  UserCircle,
  UsersThree,
  Wrench,
  ShieldCheck,
} from "../components/phosphor";
import { Avatar } from "../components/ui";
import { CommandPalette } from "../components/CommandPalette";
import { PullToRefresh } from "../components/PullToRefresh";
import { TermsGate } from "../components/TermsGate";
import { InstallBanner } from "../components/InstallBanner";
import { toast } from "../components/toast";
import { api } from "../lib/api";
import { useHabits, useOnline, useStats, useSyncState } from "../lib/queries";
import { useSession } from "../lib/session";
import { onQueueChange } from "../lib/requests";
import { onOutcome } from "../lib/sync";
import { setBadge } from "../lib/pwa";
import { haptic, prefs } from "../lib/prefs";
import { weight as fmtWeight } from "../lib/units";
import { LogProvider, useLog } from "./LogContext";

/** Phone tab bar: the four places used daily. Everything else is one tap away
 * under "You", and all of it is in the desktop sidebar. */
const TABS = [
  { to: "/", label: t("nav.today"), icon: House, end: true },
  { to: "/habits", label: "Habits", icon: Sparkle },
  { to: "/progress", label: t("nav.progress"), icon: ChartLineUp },
  { to: "/you", label: t("nav.you"), icon: UserCircle },
];

type NavItem = { to: string; label: string; icon: typeof House; end?: boolean; badge?: number };

/** Desktop sidebar, grouped the way people think about the product. */
const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: "/", label: t("nav.today"), icon: House, end: true },
      { to: "/habits", label: "Habits", icon: Sparkle },
      { to: "/progress", label: t("nav.progress"), icon: ChartLineUp },
    ],
  },
  {
    label: "Training",
    items: [
      { to: "/history", label: "Sessions", icon: CalendarBlank },
      { to: "/plans", label: "Plans", icon: CalendarCheck },
      { to: "/routines", label: "Routines", icon: ListBullets },
      { to: "/exercises", label: "Exercises", icon: Barbell },
      { to: "/tools", label: t("nav.tools"), icon: Wrench },
    ],
  },
  {
    label: "Community",
    items: [
      { to: "/feed", label: "Feed", icon: UsersThree },
      { to: "/groups", label: "Groups", icon: UsersThree },
      { to: "/challenges", label: "Challenges", icon: Trophy },
      { to: "/leaderboards", label: t("nav.leaderboards"), icon: Trophy },
    ],
  },
];

/** Pages that use the full width on a big screen. Everything else keeps a
 * readable single column. */
const WIDE_ROUTES = new Set(["/", "/progress"]);

export function Shell() {
  return (
    <LogProvider>
      <ShellInner />
      <CommandPalette />
      <PullToRefresh />
      <TermsGate />
      <InstallBanner />
    </LogProvider>
  );
}

function useUnread() {
  const { me } = useSession();
  const q = useQuery({
    queryKey: ["unread"],
    queryFn: () => api<{ unread: number }>("/notifications/unread-count"),
    refetchInterval: 60_000,
    initialData: me ? { unread: me.unread_notifications } : undefined,
  });
  useEffect(() => {
    const onPush = () => void q.refetch();
    navigator.serviceWorker?.addEventListener("message", onPush);
    return () => navigator.serviceWorker?.removeEventListener("message", onPush);
  }, [q]);
  const unread = q.data?.unread ?? 0;
  return unread;
}

/** The number on the installed app's icon: unread notifications, sessions
 * still needed this week, or nothing - the person's choice in Settings.
 * "Needed" hides while a pause shelters the week: nobody on an injury break
 * should be looking at a number telling them to train. */
function useAppBadge(unread: number) {
  const stats = useStats();
  const habits = useHabits();
  const [mode, setMode] = useState(prefs.badge());
  useEffect(() => {
    const onChange = () => setMode(prefs.badge());
    window.addEventListener("ps:badge", onChange);
    return () => window.removeEventListener("ps:badge", onChange);
  }, []);
  const main = stats.data?.chains[0];
  const needed = main && !main.paused_now ? main.needed : 0;
  // Habits still open today, not counting ones being broken (nothing to
  // "do" there) and none while paused.
  const open = stats.data?.paused_today ? 0 : (habits.data ?? []).filter((h) => h.kind !== "quit" && !h.archived && !h.today.done).length;
  const count = mode === "unread" ? unread : mode === "needed" ? needed : mode === "habits" ? open : 0;
  useEffect(() => setBadge(count), [count]);
}

/** Everything saved on this device and not yet on the server: workouts in
 * the sync outbox plus queued edits (food, journal, habits, body). */
function usePending(workoutsPending: number): number {
  const [queued, setQueued] = useState(0);
  useEffect(() => onQueueChange((q) => setQueued(q.length)), []);
  return workoutsPending + queued;
}

function ShellInner() {
  const { me, offline } = useSession();
  const { openLog } = useLog();
  const online = useOnline();
  const sync = useSyncState();
  const pending = usePending(sync.pending);
  const unread = useUnread();
  useAppBadge(unread);
  const location = useLocation();
  const navigate = useNavigate();

  // Celebrate what the server says just happened. One toast per thing, in
  // order of how much it matters, and never more than three at once.
  useEffect(
    () =>
      onOutcome((o) => {
        const unit = me?.profile.weight_unit ?? "kg";
        let shown = 0;
        if (o.streak.milestone && shown++ < 3) {
          haptic([20, 40, 20]);
          toast.celebrate(`${o.streak.milestone}-week streak`, { body: "Weeks of showing up. That is the whole trick." });
        }
        for (const r of o.new_records) {
          if (shown++ >= 3) break;
          const value = r.key.startsWith("e1rm") ? fmtWeight(r.value, unit) : undefined;
          toast.celebrate(`New best: ${r.label}`, {
            body: value ? `${value}, up ${r.gain_pct.toFixed(1)}%` : `Up ${r.gain_pct.toFixed(1)}%`,
          });
        }
        for (const b of o.new_achievements) {
          if (shown++ >= 3) break;
          toast.celebrate(b.tier_name ?? b.title, {
            body: b.tier ? `${b.title} · ${b.tier}` : b.description,
            action: { label: "View", onClick: () => navigate("/achievements") },
          });
        }
        if (o.leveled_up_to && shown < 3) toast.celebrate(`Level ${o.leveled_up_to}`, { body: o.title });
      }),
    [me, navigate],
  );


  const hideTabs = location.pathname.startsWith("/workouts/live");
  const staff = me?.user.role === "admin" || me?.user.role === "moderator";

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn btn-primary">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sidebar sticky top-0 hidden h-[100dvh] flex-col px-3 py-5 lg:flex">
        <NavLink to="/" className="mb-5 flex items-center gap-2.5 px-3 text-[1.05rem] font-semibold tracking-tight">
          <Logo className="size-7" />
          PaceStreak
        </NavLink>
        <button type="button" className="btn btn-primary log-cap mx-1 mb-5 justify-between" onClick={() => openLog()}>
          <span className="flex items-center gap-2">
            <Plus size={18} weight="bold" /> Log a session
          </span>
          <kbd className="kbd" aria-hidden>N</kbd>
        </button>
        <button type="button" className="side-link press mx-0 mb-3 w-full justify-between text-dim" onClick={() => window.dispatchEvent(new Event("ps:palette"))}>
          <span className="flex items-center gap-3">
            <MagnifyingGlass size={19} /> Search
          </span>
          <kbd className="kbd" aria-hidden>⌘K</kbd>
        </button>
        <nav className="-mx-1 flex-1 overflow-y-auto px-1" aria-label="Main">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.label ?? i} className={i > 0 ? "mt-5" : ""}>
              {group.label && <p className="nav-label">{group.label}</p>}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <SideLink item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-3 border-t border-line pt-3">
          <ul className="flex flex-col gap-0.5">
            <li><SideLink item={{ to: "/notifications", label: t("nav.notifications"), icon: Bell, badge: unread }} /></li>
            <li><SideLink item={{ to: "/settings", label: t("nav.settings"), icon: Gear }} /></li>
            {staff && <li><SideLink item={{ to: "/admin", label: t("nav.moderation"), icon: ShieldCheck }} /></li>}
          </ul>
          <NavLink to="/you" className="press mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
            <Avatar name={me?.profile.display_name || me?.profile.handle} hue={me?.profile.avatar_hue ?? 0} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{me?.profile.display_name || me?.profile.handle || "You"}</span>
              <span className="block truncate text-xs text-dim">{online && !offline ? (pending ? `Syncing ${pending}` : "All synced") : pending ? `Offline · ${pending} waiting` : "Offline"}</span>
            </span>
          </NavLink>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Phone top bar: just the bell. The page owns its own title. */}
        <div className="safe-top sticky top-0 z-30 lg:hidden">
          <div className="flex h-12 items-center justify-between bg-bg/85 px-4 backdrop-blur-md">
            <NavLink to="/" aria-label={t("nav.home")} className="flex items-center gap-2 font-semibold tracking-tight">
              <Logo className="size-6" />
            </NavLink>
            <div className="flex items-center gap-1">
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Search and commands" onClick={() => window.dispatchEvent(new Event("ps:palette"))}>
                <MagnifyingGlass size={22} />
              </button>
              {(!online || offline || pending > 0) && <OfflinePill online={online && !offline} pending={pending} />}
              <NavLink to="/notifications" className="btn btn-ghost btn-icon relative" aria-label={`${t("nav.notifications")}${unread ? `, ${t("nav.unread", { count: unread })}` : ""}`}>
                <Bell size={22} />
                {unread > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-flame ring-2 ring-bg" />}
              </NavLink>
            </div>
          </div>
        </div>

        <main
          id="main"
          className={`mx-auto w-full px-4 sm:px-6 lg:px-10 ${WIDE_ROUTES.has(location.pathname) ? "max-w-[1240px] 2xl:max-w-[1400px]" : "max-w-[960px]"} ${hideTabs ? "pb-10" : "pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-16"}`}
        >
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Phone tab bar with the raised log button in the middle. */}
      {!hideTabs && (
        <nav className="tabbar fixed inset-x-0 bottom-0 z-40 lg:hidden" aria-label="Main">
          <div className="mx-auto grid h-16 max-w-[560px] grid-cols-5 items-center">
            {TABS.slice(0, 2).map((t) => (
              <Tab key={t.to} {...t} />
            ))}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  haptic(8);
                  openLog();
                }}
                aria-label={t("nav.log")}
                className="log-fab press grid size-14 -translate-y-3 place-items-center rounded-full bg-accent text-accent-ink"
              >
                <Plus size={26} weight="bold" />
              </button>
            </div>
            {TABS.slice(2).map((t) => (
              <Tab key={t.to} {...t} />
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} end={item.end ?? false} className={({ isActive }) => `side-link press ${isActive ? "is-active" : ""}`}>
      {({ isActive }) => (
        <>
          <item.icon size={19} weight={isActive ? "fill" : "regular"} />
          <span className="flex-1">{item.label}</span>
          {item.badge ? <span className="num chip chip-accent h-5 px-1.5 text-xs">{item.badge}</span> : null}
        </>
      )}
    </NavLink>
  );
}

function Tab({ to, label, icon: Icon, end }: (typeof TABS)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `press flex flex-col items-center gap-0.5 py-1.5 text-[0.7rem] font-semibold ${isActive ? "text-ink" : "text-dim"}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={24} weight={isActive ? "fill" : "regular"} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function OfflinePill({ online, pending }: { online: boolean; pending: number }) {
  return (
    <span className="chip" role="status">
      {!online && <CloudSlash size={14} />}
      {online ? `Syncing ${pending}` : pending ? `Offline · ${pending} waiting to sync` : "Offline"}
    </span>
  );
}
