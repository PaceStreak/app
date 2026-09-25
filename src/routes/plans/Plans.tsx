import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { DisciplineIcon } from "../../components/icons";
import { CalendarCheck, Plus, UploadSimple } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { Empty, ErrorState, Loading, PageHeader, Section } from "../../components/ui";
import { ApiError, api, errorText } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import { queryClient } from "../../lib/queries";
import type { Plan, PlanSummary, PlanTemplate } from "../../lib/types";
import { plural } from "../../lib/units";

export default function Plans() {
  const navigate = useNavigate();
  const mine = useQuery({
    queryKey: ["plans"],
    queryFn: () => api<PlanSummary[]>("/plans"),
  });
  const templates = useQuery({
    queryKey: ["plan-templates"],
    queryFn: () => api<PlanTemplate[]>("/plans/templates"),
    staleTime: Infinity,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";
    setBusy("import");
    try {
      if (file.size > 512_000) throw new Error("That file is too large to be a plan.");
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("That isn't a PaceStreak plan file.");
      }
      const plan = await api<Plan>("/plans/import", { body: data });
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success(`Imported ${plan.name}`);
      navigate(`/plans/${plan.id}`);
    } catch (err) {
      toast.error(err instanceof Error && !(err instanceof ApiError) ? err.message : errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const create = async (body: object, key: string) => {
    setBusy(key);
    try {
      const plan = await api<Plan>("/plans", { body });
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      navigate(`/plans/${plan.id}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />;

  return (
    <div>
      <PageHeader title="Training plans" back="/you" subtitle="A schedule of suggestions. The streak still counts whatever you actually do." />
      {!mine.data ? (
        <Loading />
      ) : mine.data.length === 0 ? (
        <Empty icon={<CalendarCheck size={26} />} title="No plan yet" body="Start from one below and make it yours, or build your own week by week." />
      ) : (
        <Section title="Yours">
          <ul className="card divide-y divide-line">
            {mine.data.map((p) => (
              <li key={p.id}>
                <Link to={`/plans/${p.id}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                  <CalendarCheck size={22} weight={p.active ? "fill" : "regular"} className={p.active ? "text-accent-text" : "text-dim"} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-sm text-dim">
                      {p.repeat ? (p.weeks_count === 1 ? "Every week" : `Repeats every ${p.weeks_count} weeks`) : plural(p.weeks_count, "week")} · {plural(p.sessions_count, "session")}
                      {p.active && p.started_on ? ` · running since ${fmtMonthDay(p.started_on)}` : p.finished_at ? " · finished" : ""}
                    </span>
                  </span>
                  {p.active && <span className="chip chip-accent h-6">Active</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Start from a template">
        <ul className="space-y-2">
          {(templates.data ?? []).map((t) => (
            <li key={t.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="flex shrink-0 gap-1 text-accent-text" aria-hidden>
                  {t.disciplines.slice(0, 2).map((d) => (
                    <DisciplineIcon key={d} id={d} size={20} />
                  ))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{t.summary}</p>
                  <p className="mt-1 text-xs text-dim">
                    {t.weeks_count} weeks · {t.per_week} a week
                  </p>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm mt-3 w-full" disabled={busy !== null} onClick={() => void create({ template_id: t.id }, t.id)}>
                {busy === t.id ? "Adding…" : "Use this plan"}
              </button>
            </li>
          ))}
        </ul>
        <p className="field-hint">Starting points for healthy adults, not coaching or medical advice. Easy means you could talk in sentences. Sore or hurt? Rest, or pause the streak.</p>
      </Section>

      <button type="button" className="btn btn-primary mt-6 w-full" disabled={busy !== null} onClick={() => void create({ plan: { name: "My week", weeks: [[]], repeat: true } }, "week")}>
        <CalendarCheck size={18} /> {busy === "week" ? "Creating…" : "Build a weekly schedule"}
      </button>
      <p className="field-hint">One week, repeated until you stop it: say, push on Monday, pull on Wednesday and legs on Friday.</p>
      <button
        type="button"
        className="btn btn-secondary mt-4 w-full"
        disabled={busy !== null}
        onClick={() =>
          void create(
            {
              plan: {
                name: "My plan",
                weeks: [
                  [
                    {
                      day: 0,
                      discipline: "run",
                      title: "Easy run",
                      minutes: 30,
                    },
                  ],
                ],
              },
            },
            "custom",
          )
        }
      >
        <Plus size={18} /> Build your own
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void importFile(e.target.files?.[0])} />
      <button type="button" className="btn btn-ghost mt-2 w-full" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
        <UploadSimple size={18} /> {busy === "import" ? "Importing…" : "Import a shared plan"}
      </button>
    </div>
  );
}
