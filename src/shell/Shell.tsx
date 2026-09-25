import { t } from "../lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  Bell,
  ChartLineUp,
  CloudSlash,
  Gear,
  House,
  Plus,
  Trophy,
  UserCircle,
  UsersThree,
  Wrench,
  ShieldCheck,
} from "../components/phosphor";
import { TermsGate } from "../components/TermsGate";
import { toast } from "../components/toast";
import { api } from "../lib/api";
import { useOnline, useStats, useSyncState } from "../lib/queries";
import { useSession } from "../lib/session";
import { onOutcome } from "../lib/sync";
import { setBadge } from "../lib/pwa";
import { haptic, prefs } from "../lib/prefs";
import { weight as fmtWeight } from "../lib/units";
import { LogProvider, useLog } from "./LogContext";

const TABS = [
  { to: "/", label: t("nav.today"), icon: House, end: true },
  { to: "/progress", label: t("nav.progress"), icon: ChartLineUp },
  { to: "/feed", label: t("nav.social"), icon: UsersThree },
  { to: "/you", label: t("nav.you"), icon: UserCircle },
];

export function Shell() {
  return (
    <LogProvider>
      <ShellInner />
      <TermsGate />
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
  const [mode, setMode] = useState(prefs.badge());
  useEffect(() => {
    const onChange = () => setMode(prefs.badge());
    window.addEventListener("ps:badge", onChange);
    return () => window.removeEventListener("ps:badge", onChange);
  }, []);
  const main = stats.data?.chains[0];
  const needed = main && !main.paused_now ? main.needed : 0;
  const count = mode === "unread" ? unread : mode === "needed" ? needed : 0;
  useEffect(() => setBadge(count), [count]);
}

function ShellInner() {
  const { me, offline } = useSession();
  const { openLog } = useLog();
  const online = useOnline();
  const sync = useSyncState();
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

  // "n" logs from anywhere on a keyboard. No animation on keyboard actions.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(target.tagName) || target.isContentEditable) return;
      if (e.key === "n") {
        e.preventDefault();
        openLog();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openLog]);

  const hideTabs = location.pathname.startsWith("/workouts/live");
  const staff = me?.user.role === "admin" || me?.user.role === "moderator";

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn btn-primary">
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-[100dvh] flex-col border-r border-line px-4 py-6 lg:flex">
        <NavLink to="/" className="mb-8 flex items-center gap-2.5 px-2 text-[1.05rem] font-semibold tracking-tight">
          <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
            <path d="M37 10 14 36h14l-2 18 24-26H36l1-18Z" fill="var(--accent)" />
          </svg>
          PaceStreak
        </NavLink>
        <button type="button" className="btn btn-primary mb-6 w-full" onClick={() => openLog()}>
          <Plus size={18} weight="bold" /> Log a session
        </button>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {[
            ...TABS,
            { to: "/notifications", label: t("nav.notifications"), icon: Bell, badge: unread },
            { to: "/leaderboards", label: t("nav.leaderboards"), icon: Trophy },
            { to: "/tools", label: t("nav.tools"), icon: Wrench },
            { to: "/settings", label: t("nav.settings"), icon: Gear },
            ...(staff ? [{ to: "/admin", label: t("nav.moderation"), icon: ShieldCheck }] : []),
          ].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={"end" in t ? t.end : false}
              className={({ isActive }) =>
                `press flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium ${isActive ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"}`
              }
            >
              <t.icon size={20} />
              <span className="flex-1">{t.label}</span>
              {"badge" in t && t.badge ? <span className="num chip chip-accent h-5 px-1.5 text-xs">{t.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <SyncFooter online={online && !offline} pending={sync.pending} />
      </aside>

      <div className="min-w-0">
        {/* Phone top bar: just the bell. The page owns its own title. */}
        <div className="safe-top sticky top-0 z-30 lg:hidden">
          <div className="flex h-12 items-center justify-between bg-bg/85 px-4 backdrop-blur-md">
            <NavLink to="/" aria-label={t("nav.home")} className="flex items-center gap-2 font-semibold tracking-tight">
              <svg viewBox="0 0 64 64" className="size-6" aria-hidden>
                <path d="M37 10 14 36h14l-2 18 24-26H36l1-18Z" fill="var(--accent)" />
              </svg>
            </NavLink>
            <div className="flex items-center gap-1">
              {(!online || offline || sync.pending > 0) && <OfflinePill online={online && !offline} pending={sync.pending} />}
              <NavLink to="/notifications" className="btn btn-ghost btn-icon relative" aria-label={`${t("nav.notifications")}${unread ? `, ${t("nav.unread", { count: unread })}` : ""}`}>
                <Bell size={22} />
                {unread > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-flame ring-2 ring-bg" />}
              </NavLink>
            </div>
          </div>
        </div>

        <main id="main" className={`mx-auto w-full max-w-[720px] px-4 sm:px-6 ${hideTabs ? "pb-10" : "pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-16"}`}>
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
      {online ? `Syncing ${pending}` : pending ? `Offline · ${pending} saved here` : "Offline"}
    </span>
  );
}

function SyncFooter({ online, pending }: { online: boolean; pending: number }) {
  return (
    <p className="mt-auto flex items-center gap-2 px-3 text-sm text-dim" role="status">
      {!online ? (
        <>
          <CloudSlash size={16} /> Offline{pending ? ` · ${pending} saved on this device` : ""}
        </>
      ) : pending ? (
        <>Syncing {pending}…</>
      ) : (
        <>All synced</>
      )}
    </p>
  );
}
