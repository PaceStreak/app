import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart } from "../../components/BarChart";
import { Lock, Trash } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { Banner, Empty, ErrorState, Loading, PageHeader, Section, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { fmtMonthDay, localToday } from "../../lib/dates";
import { queryClient } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { BodyMetric } from "../../lib/types";
import { fromKg, parseNumber, toKg } from "../../lib/units";

type Field = "weight_kg" | "body_fat_pct" | "waist_cm" | "resting_hr" | "sleep_hours";

export default function Body() {
  const me = useMe();
  const wu = me.profile.weight_unit;
  const today = localToday(me.profile.timezone);
  const q = useQuery({ queryKey: ["body"], queryFn: () => api<BodyMetric[]>("/body-metrics?days=365") });
  const todays = q.data?.find((m) => m.date === today);
  const [form, setForm] = useState<Record<Field, string>>({ weight_kg: "", body_fat_pct: "", waist_cm: "", resting_hr: "", sleep_hours: "" });
  const [chart, setChart] = useState<Field>("weight_kg");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const w = parseNumber(form.weight_kg);
      await api(`/body-metrics/${today}`, {
        method: "PUT",
        body: {
          weight_kg: w != null ? toKg(w, wu) : todays?.weight_kg ?? null,
          body_fat_pct: parseNumber(form.body_fat_pct) ?? todays?.body_fat_pct ?? null,
          waist_cm: parseNumber(form.waist_cm) ?? todays?.waist_cm ?? null,
          resting_hr: parseNumber(form.resting_hr) ?? todays?.resting_hr ?? null,
          sleep_hours: parseNumber(form.sleep_hours) ?? todays?.sleep_hours ?? null,
        },
      });
      setForm({ weight_kg: "", body_fat_pct: "", waist_cm: "", resting_hr: "", sleep_hours: "" });
      await queryClient.invalidateQueries({ queryKey: ["body"] });
      toast.success("Saved for today");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (date: string) => {
    await api(`/body-metrics/${date}`, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["body"] });
  };

  const series = (q.data ?? []).filter((m) => m[chart] != null).slice(-30);
  const fmt = (m: BodyMetric, f: Field) => {
    const v = m[f];
    if (v == null) return "";
    if (f === "weight_kg") return `${fromKg(v, wu).toFixed(1)} ${wu}`;
    if (f === "body_fat_pct") return `${v}%`;
    if (f === "waist_cm") return `${v} cm`;
    if (f === "resting_hr") return `${v} bpm`;
    return `${v} h`;
  };

  const input = (f: Field, label: string, suffix: string) => (
    <div>
      <label className="field-label" htmlFor={`b-${f}`}>{label}</label>
      <div className="relative">
        <input id={`b-${f}`} className="input num pr-12" inputMode="decimal" placeholder={todays?.[f] != null ? fmt(todays, f).split(" ")[0].replace("%", "") : ""} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
        <span className="absolute inset-y-0 right-4 flex items-center text-sm text-dim">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Body" back="/progress" />
      <Banner icon={<Lock size={18} />}>
        Only you ever see this. It never feeds XP, badges, leaderboards or anything another person can see, by design.
      </Banner>

      <Section title="Today">
        <div className="card space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            {input("weight_kg", "Weight", wu)}
            {input("sleep_hours", "Sleep", "h")}
            {input("resting_hr", "Resting HR", "bpm")}
            {input("waist_cm", "Waist", "cm")}
          </div>
          <button type="button" className="btn btn-primary w-full" disabled={busy || Object.values(form).every((v) => !v)} onClick={save}>
            Save
          </button>
        </div>
      </Section>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <Loading />
      ) : q.data.length === 0 ? (
        <Empty title="Nothing logged yet" body="Weight, sleep and resting heart rate over time, if you want them." />
      ) : (
        <>
          <Section title="Trend">
            <div className="card p-4">
              <Segmented label="Measure" value={chart} onChange={setChart} options={[{ value: "weight_kg", label: "Weight" }, { value: "sleep_hours", label: "Sleep" }, { value: "resting_hr", label: "HR" }, { value: "waist_cm", label: "Waist" }]} />
              <div className="mt-5">
                {series.length ? (
                  <BarChart title="Body trend" bars={series.map((m) => ({ key: m.date, label: fmtMonthDay(m.date), value: chart === "weight_kg" ? fromKg(m[chart]!, wu) : m[chart]!, display: fmt(m, chart) }))} />
                ) : (
                  <p className="py-8 text-center text-sm text-dim">Nothing recorded for this yet.</p>
                )}
              </div>
            </div>
          </Section>
          <Section title="History">
            <ul className="card divide-y divide-line">
              {[...q.data].reverse().slice(0, 60).map((m) => (
                <li key={m.date} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-16 shrink-0 text-dim">{fmtMonthDay(m.date)}</span>
                  <span className="num flex-1 truncate">{(["weight_kg", "sleep_hours", "resting_hr", "waist_cm"] as Field[]).map((f) => fmt(m, f)).filter(Boolean).join(" · ")}</span>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm text-dim" aria-label={`Delete ${fmtMonthDay(m.date)}`} onClick={() => void remove(m.date)}>
                    <Trash size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
