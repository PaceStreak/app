import { useQuery } from "@tanstack/react-query";
import { ArrowCounterClockwise, Trash as TrashIcon } from "../components/phosphor";
import { useConfirm } from "../components/Confirm";
import { toast } from "../components/toast";
import { Empty, ErrorState, Loading, PageHeader } from "../components/ui";
import { api, errorText } from "../lib/api";
import { fmtMonthDay } from "../lib/dates";
import { queryClient } from "../lib/queries";
import { restore } from "../lib/undo";

interface TrashItem {
  id: string;
  kind: "habit" | "meal" | "food" | "recipe" | "journal" | "habit_routine" | "workout";
  item_id: string;
  label: string;
  deleted_at: string;
  purge_after: string;
}

const KIND: Record<TrashItem["kind"], { label: string; refresh: string[] }> = {
  habit: { label: "Habit", refresh: ["habits", "habit", "stats"] },
  meal: { label: "Meal", refresh: ["nutrition", "nutrition-history", "nutrition-recent"] },
  food: { label: "Saved food", refresh: ["foods"] },
  recipe: { label: "Recipe", refresh: ["recipes"] },
  journal: { label: "Journal entry", refresh: ["journal"] },
  habit_routine: { label: "Routine", refresh: ["habit-routines"] },
  workout: { label: "Session", refresh: ["stats", "progress", "workouts"] },
};

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/** Everything deleted in the last 30 days, restorable with its history. */
export default function Trash() {
  const q = useQuery({ queryKey: ["trash"], queryFn: () => api<TrashItem[]>("/trash") });
  const [confirmSheet, ask] = useConfirm();

  const forget = async (item: TrashItem) => {
    if (!(await ask({ title: `Delete ${item.label} for good?`, body: "This can't be undone.", confirm: "Delete for good", danger: true }))) return;
    try {
      await api(`/trash/${item.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const empty = async () => {
    if (!(await ask({ title: "Empty the trash?", body: `${q.data?.length ?? 0} items will be deleted for good. This can't be undone.`, confirm: "Empty trash", danger: true }))) return;
    try {
      await api("/trash", { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["trash"] });
      toast.success("Trash emptied");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <div>
      <PageHeader
        title="Trash"
        back="/settings/data"
        subtitle="Deleted things stay here for 30 days, then go for good."
        action={
          q.data?.length ? (
            <button type="button" className="btn btn-ghost text-danger" onClick={() => void empty()}>
              Empty
            </button>
          ) : null
        }
      />
      {!q.data ? (
        <Loading />
      ) : q.data.length === 0 ? (
        <Empty icon={<TrashIcon size={26} />} title="The trash is empty" body="When you delete a habit, a meal, a session or a journal entry, it waits here for 30 days in case you change your mind." />
      ) : (
        <ul className="card mt-4 divide-y divide-line">
          {q.data.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.label}</p>
                <p className="text-sm text-dim">
                  {KIND[item.kind]?.label ?? item.kind} · deleted {fmtMonthDay(item.deleted_at.slice(0, 10))} · {daysLeft(item.purge_after)} days left
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label={`Delete ${item.label} for good`} onClick={() => void forget(item)}>
                <TrashIcon size={18} />
              </button>
              <button type="button" className="btn btn-sm" onClick={() => void restore(item.id, item.label, KIND[item.kind]?.refresh ?? [])}>
                <ArrowCounterClockwise size={16} /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirmSheet}
    </div>
  );
}
