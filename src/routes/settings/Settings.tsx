import { useConfirm } from "../../components/Confirm";
import { unsentCount } from "../../lib/db";
import { Link, useParams } from "react-router";
import {
  Bell,
  Buildings,
  DeviceMobile,
  Export,
  Info,
  Lock,
  Palette,
  ShieldCheck,
  SignOut,
  Sneaker,
  Target,
  UserCircle,
} from "../../components/phosphor";
import { List, PageHeader, RowLink } from "../../components/ui";
import { useSession } from "../../lib/session";
import { About, AppSection, Appearance } from "./AppSettings";
import { Data } from "./Data";
import { GearSettings } from "./GearSettings";
import { GymSettings } from "./GymSettings";
import { NotificationSettings } from "./NotificationSettings";
import { Privacy } from "./Privacy";
import { ProfileSettings } from "./ProfileSettings";
import { Security } from "./Security";
import { Training } from "./Training";

const SECTIONS = {
  profile: { title: "Profile", icon: UserCircle, Component: ProfileSettings },
  training: { title: "Training", icon: Target, Component: Training },
  gear: { title: "Gear", icon: Sneaker, Component: GearSettings },
  gyms: { title: "Gyms", icon: Buildings, Component: GymSettings },
  privacy: { title: "Privacy", icon: Lock, Component: Privacy },
  notifications: { title: "Notifications", icon: Bell, Component: NotificationSettings },
  security: { title: "Security", icon: ShieldCheck, Component: Security },
  data: { title: "Your data", icon: Export, Component: Data },
  appearance: { title: "Appearance and feel", icon: Palette, Component: Appearance },
  app: { title: "App", icon: DeviceMobile, Component: AppSection },
  about: { title: "About", icon: Info, Component: About },
} as const;

export default function Settings() {
  const { section } = useParams();
  const { signOut, me } = useSession();
  const [confirmSheet, ask] = useConfirm();
  const current = section ? SECTIONS[section as keyof typeof SECTIONS] : null;
  if (current) {
    return (
      <div>
        <PageHeader title={current.title} back="/settings" />
        <current.Component />
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Settings" back="/you" subtitle={me?.user.email} />
      <List>
        {Object.entries(SECTIONS).map(([id, s]) => (
          <RowLink key={id} to={`/settings/${id}`} icon={<s.icon size={20} />} title={s.title} />
        ))}
      </List>
      <button
        type="button"
        className="btn btn-secondary mt-6 w-full"
        onClick={async () => {
          const unsent = await unsentCount();
          if (
            unsent &&
            !(await ask({
              title: "Some changes haven't synced",
              body: `${unsent} change${unsent === 1 ? "" : "s"} will stay on this device and upload the next time you sign in here. Sign in on another device first and they won't be there yet.`,
              confirm: "Sign out",
            }))
          )
            return;
          await signOut();
        }}
      >
        <SignOut size={18} /> Sign out
      </button>
      <p className="mt-6 text-center text-xs text-dim">
        <Link to="/settings/about" className="underline">PaceStreak</Link> · open source, AGPL-3.0
      </p>
      {confirmSheet}
    </div>
  );
}
