import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { DisciplineIcon } from "../../components/icons";
import { BlockCard, RacePlanButton } from "../../components/RaceAndBlocks";
import { CalendarCheck, Plus, UploadSimple } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { Empty, ErrorState, Loading, PageHeader, Section } from "../../components/ui";
import { ApiError, api, errorText } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import { queryClient, useGyms, useLibrary } from "../../lib/queries";
import type { Plan, PlanSummary, PlanTemplate } from "../../lib/types";
import { plural } from "../../lib/units";
import { planMatches, type PlanFilter } from "../../lib/training";
import { usePersistentState } from "../../lib/persist";

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
  const gyms = useGyms();
  const lib = useLibrary();
  const gym = gyms.data?.find((g) => g.is_default) ?? gyms.data?.[0];
  const [filter, setFilter] = usePersistentState<PlanFilter>("plans.filter", "all", ["all", "strength", "endurance", "none", "gym"]);
  const shown = (templates.data ?? []).filter((t) => planMatches(t, filter, gym?.equipment ?? null));
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

      <RacePlanButton />
      <BlockCard />

      <Section title="Start from a template">
        <div className="-mx-1 mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter plans">
          {(
            [
              ["all", "All"],
              ["strength", "Strength"],
              ["endurance", "Endurance"],
              ["none", "No equipment"],
              ...(gym ? [["gym", `Fits ${gym.name}`]] : []),
            ] as [PlanFilter, string][]
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} className={`chip h-8 ${filter === value ? "chip-accent" : ""}`} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        {templates.data && shown.length === 0 && <p className="text-sm text-muted">No built-in plan fits that. Try another filter, or build your own below.</p>}
        <ul className="space-y-2">
          {shown.map((t) => (
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
                    {" · "}
                    {t.equipment?.length ? t.equipment.map((k) => lib?.lib.equipment[k] ?? k).join(", ") : "no equipment"}
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
