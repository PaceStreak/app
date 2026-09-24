import { useQuery } from "@tanstack/react-query";
import { Globe, Lock, UsersThree } from "../../components/phosphor";
import { PersonRow } from "../../components/social";
import { Banner, Section, Switch } from "../../components/ui";
import { api } from "../../lib/api";
import { useMe } from "../../lib/session";
import type { Person, Visibility } from "../../lib/types";
import { useProfilePatch } from "./useProfilePatch";

export function Privacy() {
  const me = useMe();
  const save = useProfilePatch();
  const blocks = useQuery({ queryKey: ["blocks"], queryFn: () => api<Person[]>("/me/blocks") });
  const p = me.profile;
  const options: { v: Visibility; icon: typeof Globe; title: string; body: string }[] = [
    { v: "followers", icon: UsersThree, title: "People you approve", body: "Follow requests need your OK." },
    { v: "public", icon: Globe, title: "Anyone on PaceStreak", body: "Follows are instant; you show up in search." },
    { v: "private", icon: Lock, title: "Only me", body: "No feed, groups, challenges or boards. Existing posts disappear from feeds." },
  ];
  return (
    <div>
      {!me.social_allowed && (
        <Banner icon={<Lock size={18} />}>
          {p.social_suspended ? "Social features are paused on this account by a moderator." : `Sharing is off for accounts under ${me.social_min_age}.`}
        </Banner>
      )}
      <Section title="Who can see your activity" className="mt-0">
        <div className="space-y-2">
          {options.map((o) => (
            <label key={o.v} className={`press flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${p.visibility === o.v ? "border-accent-text bg-accent-soft" : "border-line bg-surface"} ${!me.social_allowed && o.v !== "private" ? "pointer-events-none opacity-50" : ""}`}>
              <input type="radio" name="vis" className="sr-only" checked={p.visibility === o.v} onChange={() => void save({ visibility: o.v }, "Saved")} disabled={!me.social_allowed && o.v !== "private"} />
              <o.icon size={22} className="mt-0.5 shrink-0" />
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="block text-sm text-muted">{o.body}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="field-hint">Notes and body measurements are never shared, whatever you choose.</p>
      </Section>
      <Section>
        <div className="card divide-y divide-line">
          <Switch checked={p.sharing_paused} onChange={(v) => void save({ sharing_paused: v })} label="Pause sharing" description="New sessions stay off everyone's feed until you switch this off. Nothing else changes." disabled={!me.social_allowed} />
          <Switch checked={p.leaderboard_opt_in} onChange={(v) => void save({ leaderboard_opt_in: v })} label="Appear on global leaderboards" description="Your handle and board numbers, shown to other people who opted in." disabled={!me.social_allowed || !p.gamification_enabled} />
          <Switch
            checked={p.gamification_enabled}
            onChange={(v) => void save({ gamification_enabled: v }, v ? "Game features on" : "Game features off")}
            label="XP, levels and badges"
            description="Switch off to use PaceStreak as a plain log with a streak. Also takes you off leaderboards."
          />
        </div>
      </Section>
      <Section title="Blocked">
        {blocks.data?.length ? (
          <div className="card divide-y divide-line">
            {blocks.data.map((b) => (
              <PersonRow key={b.id} p={b} right={<button type="button" className="btn btn-secondary btn-sm" onClick={() => void api(`/people/${b.handle}/block`, { method: "DELETE" }).then(() => blocks.refetch())}>Unblock</button>} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-dim">Nobody blocked.</p>
        )}
      </Section>
    </div>
  );
}
