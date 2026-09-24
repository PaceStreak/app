import { useEffect, useState } from "react";
import { Check } from "../../components/phosphor";
import { Avatar, Field } from "../../components/ui";
import { api } from "../../lib/api";
import { useMe } from "../../lib/session";
import { useProfilePatch } from "./useProfilePatch";

export function ProfileSettings() {
  const me = useMe();
  const save = useProfilePatch();
  const [name, setName] = useState(me.profile.display_name ?? "");
  const [handle, setHandle] = useState(me.profile.handle ?? "");
  const [bio, setBio] = useState(me.profile.bio ?? "");
  const [hue, setHue] = useState(me.profile.avatar_hue);
  const [handleOk, setHandleOk] = useState<{ ok: boolean; reason?: string | null } | null>(null);

  useEffect(() => {
    if (handle === me.profile.handle || handle.length < 3) return setHandleOk(null);
    const t = setTimeout(() => {
      void api<{ available: boolean; reason: string | null }>(`/handles/${encodeURIComponent(handle)}`).then((r) => setHandleOk({ ok: r.available, reason: r.reason }));
    }, 300);
    return () => clearTimeout(t);
  }, [handle, me.profile.handle]);

  const dirty = name !== (me.profile.display_name ?? "") || handle !== me.profile.handle || bio !== (me.profile.bio ?? "") || hue !== me.profile.avatar_hue;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={name || handle} hue={hue} size={64} />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar colour">
          {Array.from({ length: 12 }, (_, i) => i * 30).map((h) => (
            <button key={h} type="button" role="radio" aria-checked={Math.round(hue / 30) % 12 === h / 30} aria-label={`Colour ${h / 30 + 1}`} onClick={() => setHue(h)} className={`avatar hue-${h / 30} size-8! ${Math.round(hue / 30) % 12 === h / 30 ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""}`} />
          ))}
        </div>
      </div>
      <Field label="Name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
      <Field
        label="Handle"
        value={handle}
        onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30))}
        autoCapitalize="none"
        trailing={handleOk?.ok ? <Check size={18} className="text-accent-text" /> : undefined}
        error={handleOk && !handleOk.ok ? (handleOk.reason ?? "Taken") : null}
      />
      <div>
        <label className="field-label" htmlFor="bio">Bio</label>
        <textarea id="bio" className="input" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What you train, what you're working towards" />
        <p className="field-hint">{160 - bio.length} left. Plain text; visible to whoever can see your profile.</p>
      </div>
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={!dirty || handleOk?.ok === false}
        onClick={() => void save({ display_name: name, handle, bio, avatar_hue: hue }, "Profile saved")}
      >
        Save
      </button>
    </div>
  );
}
