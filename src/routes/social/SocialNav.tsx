import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { Lock, UserPlus } from "../../components/phosphor";
import { Empty } from "../../components/ui";
import { useMe } from "../../lib/session";

const LINKS = [
  { to: "/feed", label: "Feed" },
  { to: "/buddies", label: "Buddies" },
  { to: "/groups", label: "Groups" },
  { to: "/challenges", label: "Challenges" },
  { to: "/leaderboards", label: "Boards" },
];

export function SocialHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.02em]">{title}</h1>
        <div className="flex items-center gap-1">
          {action}
          <Link to="/people" className="btn btn-ghost btn-icon" aria-label="Find people">
            <UserPlus size={22} />
          </Link>
        </div>
      </div>
      <nav className="-mx-4 mt-3 mb-5 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6" aria-label="Social">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `chip h-9 px-4 ${isActive ? "chip-accent" : ""}`}>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Why social is unavailable, said plainly, with the way out if there is one. */
export function SocialGate({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.social_allowed && me.profile.visibility !== "private") return <>{children}</>;
  const age = me.profile.birth_year ? new Date().getFullYear() - me.profile.birth_year : null;
  const [title, body, action] =
    me.profile.social_suspended
      ? ["Social features are paused", "A moderator paused sharing on this account. Your training log, streaks and export all still work.", null]
      : age !== null && age < me.social_min_age
        ? ["Sharing opens at 16", "Until then your account stays private. Everything about your own training works the same.", null]
        : me.profile.visibility === "private"
          ? ["Your account is private", "Switch who can see you in Settings to follow people, join groups and take part in challenges.", <Link key="s" to="/settings/privacy" className="btn btn-primary">Privacy settings</Link>]
          : ["Not available yet", "Finish setting up your account to use social features.", null];
  return <Empty icon={<Lock size={26} />} title={title as string} body={body as string} action={action} />;
}
