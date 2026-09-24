import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { DisciplineIcon } from "../components/icons";
import { Check, Globe, Lock, UsersThree } from "../components/phosphor";
import { Field, Segmented } from "../components/ui";
import { api, errorText } from "../lib/api";
import { browserTimezone } from "../lib/dates";
import { useLibrary } from "../lib/queries";
import { setFavouriteDisciplines } from "../lib/prefs";
import { useSession } from "../lib/session";
import type { Me, Visibility } from "../lib/types";

const STEPS = ["name", "age", "train", "privacy"] as const;
const year = new Date().getFullYear();

function guessUnits(): { weight: "kg" | "lb"; distance: "km" | "mi" } {
  const region = (navigator.language.split("-")[1] ?? "").toUpperCase();
  return ["US", "LR", "MM"].includes(region) ? { weight: "lb", distance: "mi" } : { weight: "kg", distance: "km" };
}

export default function Welcome() {
  const { me, setMe, signOut } = useSession();
  const library = useLibrary();
  const navigate = useNavigate();
  const units = guessUnits();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleState, setHandleState] = useState<{ ok: boolean; reason?: string | null } | null>(null);
  const [birthYear, setBirthYear] = useState("");
  const [terms, setTerms] = useState(false);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [separate, setSeparate] = useState(false);
  const [target, setTarget] = useState(3);
  const [weekStart, setWeekStart] = useState(new Intl.Locale(navigator.language).maximize().region === "US" ? 6 : 0);
  const [weightUnit, setWeightUnit] = useState(units.weight);
  const [distanceUnit, setDistanceUnit] = useState(units.distance);
  const [visibility, setVisibility] = useState<Visibility>("followers");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const age = birthYear.length === 4 ? year - Number(birthYear) : null;
  const tooYoung = age !== null && me && age < me.min_age;
  const teen = age !== null && me && age < me.social_min_age && !tooYoung;

  // Suggest a handle from the name, and check availability as they type.
  useEffect(() => {
    if (!handle && name) setHandle(name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  useEffect(() => {
    if (handle.length < 3) {
      setHandleState(null);
      return;
    }
    const t = setTimeout(() => {
      api<{ available: boolean; reason: string | null }>(`/handles/${encodeURIComponent(handle)}`)
        .then((r) => setHandleState({ ok: r.available, reason: r.reason }))
        .catch(() => setHandleState(null));
    }, 350);
    return () => clearTimeout(t);
  }, [handle]);

  const canNext = [
    handle.length >= 3 && handleState?.ok !== false,
    Boolean(age && !tooYoung && terms),
    true,
    true,
  ][step];

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/me/onboarding", {
        body: {
          handle,
          display_name: name || null,
          birth_year: Number(birthYear),
          accept_terms: terms,
          timezone: browserTimezone(),
          week_starts_on: weekStart,
          weight_unit: weightUnit,
          distance_unit: distanceUnit,
          weekly_target: target,
          visibility: teen ? "private" : visibility,
        },
      });
      setFavouriteDisciplines(disciplines);
      if (separate) {
        for (const d of disciplines.slice(0, 5)) {
          const disc = library?.discipline(d);
          await api("/chains", { body: { name: disc?.name ?? d, disciplines: [d], target: Math.max(1, Math.min(target, 3)) } }).catch(() => undefined);
        }
      }
      setMe(await api<Me>("/me"));
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <main className="safe-top mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col px-5 pb-8">
      <div className="mt-6 flex items-center gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-surface-3"}`} />
        ))}
      </div>

      <div key={step} className="page-enter mt-10 flex-1">
        {step === 0 && (
          <>
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em]">What should we call you?</h1>
            <p className="mt-3 text-muted">Your handle is how friends find you. You can change both later.</p>
            <div className="mt-8 space-y-5">
              <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={50} autoFocus />
              <Field
                label="Handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30))}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                trailing={handleState?.ok ? <Check size={18} className="text-accent-text" /> : undefined}
                error={handleState && !handleState.ok ? (handleState.reason ?? "Taken") : null}
                hint="Lowercase letters, numbers and underscores."
              />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em]">What year were you born?</h1>
            <p className="mt-3 text-muted">Just the year. It decides what's safe to share, nothing else.</p>
            <div className="mt-8 space-y-5">
              <Field
                label="Birth year"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder={String(year - 30)}
                autoFocus
                error={tooYoung ? `PaceStreak is for people aged ${me?.min_age} and over.` : null}
                hint={teen ? `Under ${me?.social_min_age}, your account stays private: the log and streaks work fully, sharing and leaderboards don't.` : undefined}
              />
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 size-5 accent-[var(--accent)]" />
                <span className="text-[0.95rem] text-muted">
                  I agree to the{" "}
                  <a className="text-ink underline" href="https://www.pacestreak.com/terms" target="_blank" rel="noopener">terms</a> and{" "}
                  <a className="text-ink underline" href="https://www.pacestreak.com/privacy" target="_blank" rel="noopener">privacy policy</a>. PaceStreak is not medical advice.
                </span>
              </label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em]">How do you train?</h1>
            <p className="mt-3 text-muted">Pick what you do. Your weekly target counts days, not sessions.</p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {library?.lib.disciplines.map((d) => {
                const on = disciplines.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDisciplines(on ? disciplines.filter((x) => x !== d.id) : [...disciplines, d.id])}
                    className={`press flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-sm font-medium ${on ? "border-transparent bg-accent text-accent-ink" : "border-line bg-surface text-muted"}`}
                  >
                    <DisciplineIcon id={d.id} size={24} weight={on ? "fill" : "regular"} />
                    {d.name}
                  </button>
                );
              }) ?? <div className="skeleton col-span-3 h-40" />}
            </div>

            <div className="card mt-6 p-5">
              <p className="field-label">Days a week</p>
              <div className="flex items-center justify-between gap-4">
                <p className="num text-5xl font-semibold tracking-tight">{target}</p>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary btn-icon" aria-label="Fewer days" onClick={() => setTarget(Math.max(1, target - 1))}>−</button>
                  <button type="button" className="btn btn-secondary btn-icon" aria-label="More days" onClick={() => setTarget(Math.min(7, target + 1))}>+</button>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">
                {target === 7 ? "Every day. You can, but rest is where training turns into progress." : `${7 - target} rest ${7 - target === 1 ? "day" : "days"} a week that cost nothing.`}
              </p>
              <div className="mt-5">
                <p className="field-label">Weeks start on</p>
                <Segmented label="Week starts on" value={weekStart} onChange={setWeekStart} options={[{ value: 0, label: "Monday" }, { value: 6, label: "Sunday" }]} />
              </div>
            </div>

            {disciplines.length > 1 && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4">
                <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} className="mt-1 size-5 accent-[var(--accent)]" />
                <span className="text-[0.95rem] text-muted">
                  Also keep a separate streak for each of these. Your main streak still counts everything.
                </span>
              </label>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em]">Last thing.</h1>
            <p className="mt-3 text-muted">Units, and who gets to cheer you on.</p>
            <div className="mt-8 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="field-label">Weight</p>
                  <Segmented label="Weight unit" value={weightUnit} onChange={setWeightUnit} options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} />
                </div>
                <div>
                  <p className="field-label">Distance</p>
                  <Segmented label="Distance unit" value={distanceUnit} onChange={setDistanceUnit} options={[{ value: "km", label: "km" }, { value: "mi", label: "mi" }]} />
                </div>
              </div>
              {teen ? (
                <p className="rounded-2xl bg-surface p-4 text-[0.95rem] text-muted">Your account is private. Everything else works the same.</p>
              ) : (
                <fieldset>
                  <legend className="field-label">Who can see your activity</legend>
                  <div className="space-y-2">
                    {[
                      { v: "followers" as const, icon: UsersThree, title: "People you approve", body: "Follow requests need your OK. Recommended." },
                      { v: "public" as const, icon: Globe, title: "Anyone on PaceStreak", body: "Anyone signed in can follow and see your sessions." },
                      { v: "private" as const, icon: Lock, title: "Only me", body: "A private log. No feed, no leaderboards." },
                    ].map((o) => (
                      <label key={o.v} className={`press flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${visibility === o.v ? "border-accent-text bg-accent-soft" : "border-line bg-surface"}`}>
                        <input type="radio" name="visibility" className="sr-only" checked={visibility === o.v} onChange={() => setVisibility(o.v)} />
                        <o.icon size={22} className="mt-0.5 shrink-0" />
                        <span>
                          <span className="block font-semibold">{o.title}</span>
                          <span className="block text-sm text-muted">{o.body}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="field-hint">Private notes and body measurements are never shown to anyone, whatever you pick.</p>
                </fieldset>
              )}
              {error && <p className="field-error" role="alert">{error}</p>}
            </div>
          </>
        )}
      </div>

      <div className="mt-10 flex gap-3">
        {step > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
            Back
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary flex-1"
          disabled={!canNext || busy}
          onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : void finish())}
        >
          {step < STEPS.length - 1 ? "Continue" : busy ? "Setting up…" : "Start"}
        </button>
      </div>
    </main>
  );
}
