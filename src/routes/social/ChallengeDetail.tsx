import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { CheckCircle, Copy, DotsThreeVertical } from "../../components/phosphor";
import { PersonRow, ReportSheet } from "../../components/social";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { ErrorState, Loading, PageHeader } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { fmtMonthDay } from "../../lib/dates";
import { queryClient, useLibrary } from "../../lib/queries";
import { useMe } from "../../lib/session";
import type { Challenge } from "../../lib/types";

export default function ChallengeDetail() {
  const { id = "" } = useParams();
  const me = useMe();
  const lib = useLibrary();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [confirmSheet, ask] = useConfirm();
  const q = useQuery({ queryKey: ["challenge", id], queryFn: () => api<Challenge>(`/challenges/${id}`) });

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast.success(done);
      await q.refetch();
      await queryClient.invalidateQueries({ queryKey: ["challenges"] });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const c = q.data;
  const mine = c?.leaderboard?.find((r) => r.id === me.user.id);
  const unit = c?.kind === "weekly_target" ? "weeks" : c?.kind === "plan_sessions" ? "plan sessions" : "days";

  return (
    <div>
      <PageHeader
        title={c?.title ?? ""}
        back="/challenges"
        subtitle={c ? `${fmtMonthDay(c.starts_on)} to ${fmtMonthDay(c.ends_on)}` : undefined}
        action={
          c && (
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Options" onClick={() => setMenu(true)}>
              <DotsThreeVertical size={22} weight="bold" />
            </button>
          )
        }
      />
      {!c ? (
        <Loading />
      ) : (
        <>
          {c.description && <p className="-mt-2 mb-4 text-muted">{c.description}</p>}
          <div className="card-raised p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-dim">{c.status === "finished" ? "Final" : "You"}</p>
                <p className="num text-4xl font-semibold tracking-tight">
                  {mine?.score ?? 0}
                  {c.target ? <span className="text-xl text-dim"> / {c.target}</span> : null}
                </p>
                <p className="text-sm text-muted">{unit}{mine ? ` · #${mine.rank} of ${c.leaderboard?.length}` : ""}</p>
              </div>
              {mine?.completed && (
                <span className="chip chip-accent">
                  <CheckCircle size={14} weight="fill" /> Done
                </span>
              )}
            </div>
            {c.days_total && (
              <div className="mt-4">
                <div className="h-2 rounded-full bg-surface-3" role="progressbar" aria-valuenow={c.days_elapsed} aria-valuemax={c.days_total} aria-label="Time elapsed">
                  <div className="h-full rounded-full bg-[var(--chart)]" style={{ width: `${((c.days_elapsed ?? 0) / c.days_total) * 100}%` }} />
                </div>
                <p className="num mt-1.5 text-xs text-dim">
                  Day {c.days_elapsed} of {c.days_total}
                  {c.disciplines.length ? ` · ${c.disciplines.map((d) => lib?.discipline(d)?.name ?? d).join(", ")} only` : ""}
                </p>
                {c.kind === "plan_sessions" && c.plan_name && (
                  <p className="mt-2 text-sm text-muted">
                    Everyone follows <strong className="text-ink">{c.plan_name}</strong>.{" "}
                    {c.joined && (
                      <Link to="/plans" className="font-semibold text-accent-text">
                        Your copy
                      </Link>
                    )}
                  </p>
                )}
              </div>
            )}
            {!c.joined && c.status !== "finished" && (
              <>
                <button type="button" className="btn btn-primary mt-5 w-full" onClick={() => void act(() => api(`/challenges/${id}/join`, { method: "POST" }), c.kind === "plan_sessions" ? "You're in. Your copy of the plan is running." : "You're in")}>
                  Join
                </button>
                {c.kind === "plan_sessions" && <p className="field-hint">You get your own copy of the plan, and it becomes your running plan. Any other plan you're following is paused, not deleted.</p>}
              </>
            )}
          </div>

          {c.invite_code && (
            <button
              type="button"
              className="card press mt-4 flex w-full items-center gap-3 p-4 text-left"
              onClick={() => {
                void navigator.clipboard?.writeText(c.invite_code!);
                toast.success("Code copied");
              }}
            >
              <span className="flex-1">
                <span className="block text-sm text-dim">Invite code</span>
                <span className="num block text-lg font-semibold tracking-[0.18em]">{c.invite_code}</span>
              </span>
              <Copy size={20} className="text-dim" />
            </button>
          )}

          <h2 className="mt-8 mb-3 font-semibold">Board</h2>
          <ol className="card divide-y divide-line overflow-hidden">
            {(c.leaderboard ?? []).map((r) => (
              <li key={r.id} className={r.id === me.user.id ? "bg-accent-soft" : ""}>
                <PersonRow
                  p={r}
                  right={
                    <span className="num flex items-center gap-3">
                      <span className="text-lg font-semibold">{r.score}</span>
                      <span className="w-7 text-right text-sm text-dim">#{r.rank}</span>
                    </span>
                  }
                />
              </li>
            ))}
          </ol>

          <Sheet open={menu} onClose={() => setMenu(false)} title={c.title}>
            <div className="-mx-2 flex flex-col">
              {c.joined && !c.is_creator && (
                <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => { setMenu(false); void act(() => api(`/challenges/${id}/leave`, { method: "POST" }), "Left"); }}>
                  Leave challenge
                </button>
              )}
              {!c.is_creator && (
                <button type="button" className="press rounded-md px-3 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => { setMenu(false); setReport(true); }}>
                  Report
                </button>
              )}
              {c.is_creator && (
                <button
                  type="button"
                  className="press rounded-md px-3 py-3.5 text-left font-medium text-danger hover:bg-surface-2"
                  onClick={async () => {
                    setMenu(false);
                    if (!(await ask({ title: "Delete this challenge?", body: "For everyone in it.", confirm: "Delete", danger: true }))) return;
                    await api(`/challenges/${id}`, { method: "DELETE" });
                    await queryClient.invalidateQueries({ queryKey: ["challenges"] });
                    navigate("/challenges", { replace: true });
                  }}
                >
                  Delete challenge
                </button>
              )}
            </div>
          </Sheet>
          <ReportSheet open={report} onClose={() => setReport(false)} target={{ type: "challenge", id, label: "challenge" }} />
        </>
      )}
      {confirmSheet}
    </div>
  );
}
