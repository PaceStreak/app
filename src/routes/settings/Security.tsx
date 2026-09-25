import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useMemo, useState } from "react";
import { useConfirm } from "../../components/Confirm";
import { DeviceMobile, EnvelopeSimple, ShieldCheck } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Banner, Field, Section } from "../../components/ui";
import { api, errorText, setTokens } from "../../lib/api";
import { timeAgo } from "../../lib/dates";
import { useMe, useSession } from "../../lib/session";
import { PasskeySection } from "./PasskeySection";

interface SessionRow {
  id: string;
  created_at: string;
  last_used_at: string | null;
  user_agent: string | null;
  ip_address: string | null;
  current: boolean;
}

function device(agent: string | null) {
  if (!agent) return "Unknown device";
  const b = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const o = /iPhone|iPad/.test(agent) ? "iOS" : /Android/.test(agent) ? "Android" : /Mac OS X/.test(agent) ? "macOS" : /Windows/.test(agent) ? "Windows" : /Linux/.test(agent) ? "Linux" : "";
  return o ? `${b} on ${o}` : b;
}

/** A QR code drawn as SVG rects: no data: URL, no canvas, nothing the CSP has to allow. */
function QR({ text }: { text: string }) {
  const { size, cells } = useMemo(() => {
    const code = QRCode.create(text, { errorCorrectionLevel: "M" });
    const n = code.modules.size;
    const out: [number, number][] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (code.modules.get(y, x)) out.push([x, y]);
    return { size: n, cells: out };
  }, [text]);
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} className="mx-auto size-52 rounded-xl bg-white p-1" role="img" aria-label="QR code for your authenticator app" shapeRendering="crispEdges">
      <path d={cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("")} fill="#111" />
    </svg>
  );
}

export function Security() {
  const me = useMe();
  const { reloadMe, signOut } = useSession();
  const [confirmSheet, ask] = useConfirm();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<SessionRow[]>("/auth/sessions") });
  const events = useQuery({ queryKey: ["security-events"], queryFn: () => api<{ id: string; label: string; user_agent: string | null; created_at: string }[]>("/me/security-events") });
  const twofa = useQuery({ queryKey: ["2fa"], queryFn: () => api<{ enabled: boolean; recovery_codes_remaining: number }>("/auth/2fa") });
  const [pw, setPw] = useState<{ current: string; next: string } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; uri: string; password: string; code: string; codes?: string[] } | null>(null);
  const [disable, setDisable] = useState<{ password: string; code: string } | null>(null);
  const [regen, setRegen] = useState<{ code: string; codes?: string[] } | null>(null);
  const [emailChange, setEmailChange] = useState<{ email: string; password: string } | null>(null);
  const startEmailChange = async () => {
    if (!emailChange) return;
    try {
      const res = await api<{ detail: string }>("/auth/change-email", { body: { new_email: emailChange.email.trim(), password: emailChange.password } });
      setEmailChange(null);
      toast.success("Check the new inbox", { body: res.detail });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const changePassword = async () => {
    if (!pw) return;
    try {
      const tokens = await api<{ access_token: string; expires_in: number; csrf_token?: string }>("/auth/change-password", { body: { current_password: pw.current, new_password: pw.next } });
      setTokens(tokens);
      setPw(null);
      toast.success("Password changed", { body: "Every other device was signed out." });
      void sessions.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const startSetup = async () => {
    try {
      const res = await api<{ secret: string; provisioning_uri: string }>("/auth/2fa/setup", { method: "POST" });
      setSetup({ secret: res.secret, uri: res.provisioning_uri, password: "", code: "" });
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const confirmSetup = async () => {
    if (!setup) return;
    try {
      const res = await api<{ recovery_codes: string[] }>("/auth/2fa/enable", { body: { password: setup.password, code: setup.code } });
      setSetup({ ...setup, codes: res.recovery_codes });
      void twofa.refetch();
      void reloadMe();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const turnOff = async () => {
    if (!disable) return;
    try {
      await api("/auth/2fa/disable", { body: disable });
      setDisable(null);
      toast("Two-factor is off");
      void twofa.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const regenerate = async () => {
    if (!regen) return;
    try {
      const res = await api<{ recovery_codes: string[] }>("/auth/2fa/recovery-codes", { body: { code: regen.code } });
      setRegen({ ...regen, codes: res.recovery_codes });
      void twofa.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const revoke = async (s: SessionRow) => {
    if (s.current) return void signOut();
    await api(`/auth/sessions/${s.id}`, { method: "DELETE" });
    void sessions.refetch();
  };

  const everywhere = async () => {
    if (!(await ask({ title: "Sign out everywhere?", body: "Every device, including this one.", confirm: "Sign out everywhere", danger: true }))) return;
    await signOut(true);
  };

  return (
    <div>
      {!me.user.is_verified && (
        <Banner
          icon={<EnvelopeSimple size={18} />}
          action={
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void api("/auth/resend-verification", { body: { email: me.user.email }, auth: false }).then(() => toast.success("Sent"))}>
              Resend
            </button>
          }
        >
          Confirm {me.user.email} to unlock social features.
        </Banner>
      )}

      <Section title="Email address" className="mt-4">
        {emailChange ? (
          <form
            className="card space-y-4 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void startEmailChange();
            }}
          >
            <Field label="New email address" type="email" autoComplete="email" required value={emailChange.email} onChange={(e) => setEmailChange({ ...emailChange, email: e.target.value })} />
            <Field label="Your password" type="password" autoComplete="current-password" required value={emailChange.password} onChange={(e) => setEmailChange({ ...emailChange, password: e.target.value })} hint="Nothing changes until you open the link we send to the new address. Your old address will be told." />
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setEmailChange(null)}>Cancel</button>
              <button className="btn btn-primary flex-1" disabled={!emailChange.email.includes("@") || !emailChange.password}>Send link</button>
            </div>
          </form>
        ) : (
          <div className="card flex items-center gap-3 p-4">
            <EnvelopeSimple size={22} className="text-dim" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{me.user.email}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEmailChange({ email: "", password: "" })}>Change</button>
          </div>
        )}
      </Section>

      <Section title="Password">
        {pw ? (
          <div className="card space-y-4 p-4">
            <Field label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <Field label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} hint="At least 16 characters." />
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setPw(null)}>Cancel</button>
              <button type="button" className="btn btn-primary flex-1" disabled={pw.next.length < 16 || !pw.current} onClick={changePassword}>Change</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary w-full" onClick={() => setPw({ current: "", next: "" })}>Change password</button>
        )}
      </Section>

      <Section title="Two-factor authentication">
        <div className="card flex items-center gap-3 p-4">
          <ShieldCheck size={24} weight={twofa.data?.enabled ? "fill" : "regular"} className={twofa.data?.enabled ? "text-accent-text" : "text-dim"} />
          <div className="flex-1">
            <p className="font-semibold">{twofa.data?.enabled ? "On" : "Off"}</p>
            <p className="text-sm text-dim">{twofa.data?.enabled ? `${twofa.data.recovery_codes_remaining} recovery codes left` : "A code from an authenticator app at every sign-in."}</p>
          </div>
          {twofa.data?.enabled ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDisable({ password: "", code: "" })}>Turn off</button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={startSetup}>Set up</button>
          )}
        </div>
        {twofa.data?.enabled && (
          <>
            {twofa.data.recovery_codes_remaining <= 3 && (
              <p className="field-hint text-flame-text" role="status">Running low on recovery codes. Make a new set before you need one.</p>
            )}
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setRegen({ code: "" })}>New recovery codes</button>
          </>
        )}
      </Section>

      <PasskeySection />

      <Section title="Where you're signed in" action={<button type="button" className="text-sm font-semibold text-danger" onClick={everywhere}>Sign out everywhere</button>}>
        <ul className="card divide-y divide-line">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <DeviceMobile size={20} className="text-dim" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {device(s.user_agent)} {s.current && <span className="chip chip-accent ml-1 h-5 px-1.5 text-[0.7rem]">This device</span>}
                </span>
                <span className="block text-sm text-dim">
                  {s.last_used_at ? `Active ${timeAgo(s.last_used_at)} ago` : `Signed in ${timeAgo(s.created_at)} ago`}
                  {s.ip_address ? ` · ${s.ip_address}` : ""}
                </span>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void revoke(s)}>Sign out</button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Recent security activity">
        <ul className="card divide-y divide-line">
          {(events.data ?? []).slice(0, 20).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="block font-medium">{e.label}</span>
                {e.user_agent && <span className="block text-dim">{device(e.user_agent)}</span>}
              </span>
              <span className="shrink-0 text-dim">{timeAgo(e.created_at)}</span>
            </li>
          ))}
        </ul>
        <p className="field-hint">Something here you didn't do? Change your password and sign out everywhere.</p>
      </Section>

      <Sheet open={setup !== null} onClose={() => setSetup(null)} title={setup?.codes ? "Save your recovery codes" : "Set up two-factor"}>
        {setup &&
          (setup.codes ? (
            <div>
              <p className="text-muted">Each works once if you lose your phone. This is the only time they're shown.</p>
              <ul className="num mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-4 font-mono text-sm">
                {setup.codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => void navigator.clipboard?.writeText(setup.codes!.join("\n")).then(() => toast.success("Copied"))}>Copy</button>
                <button type="button" className="btn btn-primary flex-1" onClick={() => setSetup(null)}>I've saved them</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted">Scan this with your authenticator app, then enter the code it shows.</p>
              <QR text={setup.uri} />
              <p className="num text-center font-mono text-sm break-all text-dim">{setup.secret}</p>
              <Field label="Code from the app" inputMode="numeric" autoComplete="one-time-code" value={setup.code} onChange={(e) => setSetup({ ...setup, code: e.target.value.replace(/\D/g, "") })} />
              <Field label="Your password" type="password" autoComplete="current-password" value={setup.password} onChange={(e) => setSetup({ ...setup, password: e.target.value })} hint="Asked so a stolen session can't lock you out of your own account." />
              <button type="button" className="btn btn-primary w-full" disabled={setup.code.length < 6 || !setup.password} onClick={confirmSetup}>Turn on</button>
            </div>
          ))}
      </Sheet>

      <Sheet open={disable !== null} onClose={() => setDisable(null)} title="Turn off two-factor">
        {disable && (
          <div className="space-y-4">
            <Field label="Password" type="password" autoComplete="current-password" value={disable.password} onChange={(e) => setDisable({ ...disable, password: e.target.value })} />
            <Field label="Current code" inputMode="numeric" value={disable.code} onChange={(e) => setDisable({ ...disable, code: e.target.value })} />
            <button type="button" className="btn btn-danger w-full" onClick={turnOff}>Turn off</button>
          </div>
        )}
      </Sheet>
      <Sheet open={regen !== null} onClose={() => setRegen(null)} title={regen?.codes ? "Your new recovery codes" : "New recovery codes"}>
        {regen &&
          (regen.codes ? (
            <div>
              <p className="text-muted">Your old codes no longer work. Each of these works once; this is the only time they're shown.</p>
              <ul className="num mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-4 font-mono text-sm">
                {regen.codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => void navigator.clipboard?.writeText(regen.codes!.join("\n")).then(() => toast.success("Copied"))}>Copy</button>
                <button type="button" className="btn btn-primary flex-1" onClick={() => setRegen(null)}>I've saved them</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted">Every current recovery code stops working and ten new ones replace them.</p>
              <Field label="Code from your authenticator app" inputMode="numeric" autoComplete="one-time-code" value={regen.code} onChange={(e) => setRegen({ ...regen, code: e.target.value.replace(/\D/g, "") })} />
              <button type="button" className="btn btn-primary w-full" disabled={regen.code.length < 6} onClick={regenerate}>Make new codes</button>
            </div>
          ))}
      </Sheet>
      {confirmSheet}
    </div>
  );
}
