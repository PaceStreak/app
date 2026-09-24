import { useNavigate } from "react-router";
import { Barbell, Play, Plus } from "../../components/phosphor";
import { toast } from "../../components/toast";
import { Empty, PageHeader, Section } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { queryClient, useLibrary, useRoutines } from "../../lib/queries";
import type { Routine } from "../../lib/types";

export default function Routines() {
  const lib = useLibrary();
  const routines = useRoutines();
  const navigate = useNavigate();

  const fromTemplate = async (id: string) => {
    try {
      const r = await api<Routine>(`/routines/from-template/${id}`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      navigate(`/routines/${r.id}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Routines"
        back="/you"
        action={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/routines/new")}>
            <Plus size={16} /> New
          </button>
        }
      />
      {routines.data && routines.data.length === 0 ? (
        <Empty icon={<Barbell size={26} />} title="No routines yet" body="Save a workout you repeat, then start it in one tap. Or start from one below." />
      ) : (
        <div className="space-y-3">
          {(routines.data ?? []).map((r) => (
            <div key={r.id} className="card flex items-center gap-3 p-4">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate(`/routines/${r.id}`)}>
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="block truncate text-sm text-dim">{r.items.map((i) => lib?.byId.get(i.exercise_id)?.name ?? "Exercise").join(", ")}</span>
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/workouts/live?routine=${r.id}`)} aria-label={`Start ${r.name}`}>
                <Play size={16} weight="fill" /> Start
              </button>
            </div>
          ))}
        </div>
      )}

      <Section title="Starting points">
        <p className="mb-3 text-sm text-dim">Generic plans for when you don't have one. Copy one and it becomes yours to change.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {lib?.lib.templates.map((t) => (
            <button key={t.id} type="button" onClick={() => void fromTemplate(t.id)} className="press card p-4 text-left hover:border-line-lit">
              <span className="block font-semibold">{t.name}</span>
              <span className="mt-1 block text-sm text-muted">{t.summary}</span>
              <span className="mt-2 block text-xs text-dim">{t.items.length} exercises</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
