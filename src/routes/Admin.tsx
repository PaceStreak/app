import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate } from "react-router";
import { CheckCircle, MagnifyingGlass, WarningCircle } from "../components/phosphor";
import { Sheet } from "../components/Sheet";
import { toast } from "../components/toast";
import { Empty, ErrorState, Loading, PageHeader, Segmented } from "../components/ui";
import { api, errorText } from "../lib/api";
import { timeAgo } from "../lib/dates";
import { useMe } from "../lib/session";

type Tab = "reports" | "users" | "audit" | "metrics" | "ops";

interface ReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  detail: string | null;
  snapshot: Record<string, unknown> | null;
  status: string;
  created_at: string;
  reporter: { handle: string | null } | null;
  reported: { handle: string | null; suspended: boolean } | null;
  prior_actioned: number;
}

export default function Admin() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>("reports");
  if (me.user.role === "user") return <Navigate to="/" replace />;
  return (
    <div>
      <PageHeader title="Moderation" subtitle="Every action here is recorded in the audit log." />
      <Segmented
        label="Section"
        value={tab}
        onChange={setTab}
        options={[
          { value: "reports", label: "Reports" },
          { value: "users", label: "People" },
          { value: "audit", label: "Audit" },
          { value: "metrics", label: "Metrics" },
          ...(me.user.role === "admin" ? [{ value: "ops" as const, label: "Ops" }] : []),
        ]}
      />
      <div className="mt-5">
        {tab === "reports" && <Reports />}
        {tab === "users" && <Users admin={me.user.role === "admin"} />}
        {tab === "audit" && <Audit />}
        {tab === "metrics" && <Metrics />}
        {tab === "ops" && <Ops />}
      </div>
    </div>
  );
}

function Reports() {
  const [status, setStatus] = useState("open");
  const q = useQuery({ queryKey: ["admin-reports", status], queryFn: () => api<ReportRow[]>(`/admin/reports?status=${status}`) });
  const resolve = async (id: string, action: string) => {
    try {
      const res = await api<{ grouped: number }>(`/admin/reports/${id}/resolve`, { body: { action } });
      toast.success("Resolved", { body: res.grouped ? `${res.grouped} duplicate report(s) closed with it.` : undefined });
      void q.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <>
      <Segmented label="Status" value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "actioned", label: "Actioned" }, { value: "dismissed", label: "Dismissed" }]} />
      <div className="mt-4 space-y-3">
        {q.isError ? (
          <ErrorState error={q.error} />
        ) : !q.data ? (
          <Loading />
        ) : q.data.length === 0 ? (
          <Empty title="Queue is clear" />
        ) : (
          q.data.map((r) => (
            <article key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="chip chip-flame">{r.reason.replace("_", " ")}</span>
                <span className="chip">{r.target_type}</span>
                <span className="text-dim">{timeAgo(r.created_at)} ago · by @{r.reporter?.handle ?? "?"}</span>
              </div>
              <p className="mt-2 text-sm">
                About <b>@{r.reported?.handle ?? "deleted"}</b>
                {r.prior_actioned ? <span className="text-flame-text"> · {r.prior_actioned} earlier actioned</span> : null}
                {r.reported?.suspended ? " · suspended" : ""}
              </p>
              {r.snapshot && <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-surface-2 p-3 text-xs whitespace-pre-wrap">{JSON.stringify(r.snapshot, null, 1)}</pre>}
              {r.detail && <p className="mt-2 text-sm text-muted">"{r.detail}"</p>}
              {r.status === "open" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void resolve(r.id, "dismiss")}>Dismiss</button>
                  {r.target_type !== "user" && <button type="button" className="btn btn-secondary btn-sm" onClick={() => void resolve(r.id, "hide_content")}>Hide content</button>}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void resolve(r.id, r.target_type === "user" ? "suspend_user" : "hide_and_suspend")}>
                    {r.target_type === "user" ? "Suspend social" : "Hide and suspend"}
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </>
  );
}

interface UserRow {
  id: string;
  email: string;
  handle: string | null;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  social_suspended: boolean;
  official: boolean;
  reports: number;
}

function Users({ admin }: { admin: boolean }) {
  const [q, setQ] = useState("");
  const users = useQuery({ queryKey: ["admin-users", q], queryFn: () => api<UserRow[]>(`/admin/users?q=${encodeURIComponent(q)}`) });
  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      await api(`/admin/users/${id}`, { method: "PATCH", body });
      void users.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const [officialFor, setOfficialFor] = useState<UserRow | null>(null);
  return (
    <>
      <div className="relative">
        <MagnifyingGlass size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dim" />
        <input className="input pl-11" placeholder="Email or handle" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
      </div>
      <ul className="card mt-4 divide-y divide-line">
        {(users.data ?? []).map((u) => (
          <li key={u.id} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">@{u.handle ?? "(no handle)"} <span className="text-sm text-dim">{u.email}</span></span>
                <span className="block text-sm text-dim">
                  {u.role} · {u.is_verified ? "verified" : "unverified"} · {u.reports} reports{u.official ? " · official" : ""}{u.social_suspended ? " · suspended" : ""}{!u.is_active ? " · deactivated" : ""}
                </span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void patch(u.id, { social_suspended: !u.social_suspended })}>
                {u.social_suspended ? "Lift suspension" : "Suspend social"}
              </button>
              {admin && (
                <>
                  <select className="input h-9 min-h-0 w-auto rounded-full py-0 text-sm" value={u.role} onChange={(e) => void patch(u.id, { role: e.target.value })} aria-label="Role">
                    <option value="user">user</option>
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                  </select>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOfficialFor(u)}>
                    {u.official ? "Remove official" : "Make official"}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void patch(u.id, { is_active: !u.is_active })}>
                    {u.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <OfficialSheet user={officialFor} onClose={() => setOfficialFor(null)} onDone={() => void users.refetch()} />
    </>
  );
}

function Audit() {
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => api<{ id: string; action: string; target_type: string; target_id: string; actor: string | null; created_at: string; detail: unknown }[]>("/admin/audit") });
  return (
    <ul className="card divide-y divide-line">
      {(q.data ?? []).map((a) => (
        <li key={a.id} className="px-4 py-3 text-sm">
          <span className="font-medium">{a.action}</span> <span className="text-dim">on {a.target_type} {a.target_id?.slice(0, 8)}</span>
          <span className="block text-dim">by @{a.actor ?? "?"} · {timeAgo(a.created_at)} ago</span>
        </li>
      ))}
      {q.data?.length === 0 && <li className="px-4 py-6 text-center text-muted">Nothing yet.</li>}
    </ul>
  );
}

interface WorkerState {
  status: "ok" | "stale" | "never_ran";
  last_tick_at: string | null;
  age_seconds?: number;
  duration_ms?: number;
  failing_ticks?: number;
  jobs?: Record<string, { result?: number; error?: string }>;
}

function Metrics() {
  const q = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => api<Record<string, number> & { worker: WorkerState }>("/admin/metrics"),
    refetchInterval: 60_000,
  });
  if (!q.data) return <Loading />;
  const tiles = ["users", "onboarded", "active_1d", "active_7d", "active_30d", "sessions_7d", "open_reports", "suspended"];
  return (
    <div className="space-y-4">
      <WorkerPanel worker={q.data.worker} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((k) => (
          <div key={k} className="card p-4">
            <p className="text-sm text-dim">{k.replace(/_/g, " ")}</p>
            <p className="num mt-1 text-2xl font-semibold">{q.data[k]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Whether reminders, digests, challenge results and account purges are
    actually running. Status is always a word plus an icon, never colour alone. */
function WorkerPanel({ worker }: { worker: WorkerState }) {
  const healthy = worker.status === "ok" && !worker.failing_ticks;
  const headline =
    worker.status === "never_ran"
      ? "The worker has never run"
      : worker.status === "stale"
        ? `No tick for ${Math.round((worker.age_seconds ?? 0) / 60)} minutes`
        : worker.failing_ticks
          ? `${worker.failing_ticks} tick${worker.failing_ticks === 1 ? "" : "s"} in a row with a failing job`
          : "Running normally";
  return (
    <section className="card p-4" aria-labelledby="worker-heading">
      <div className="flex items-center gap-3">
        {healthy ? <CheckCircle size={22} weight="fill" className="text-accent-text" aria-hidden /> : <WarningCircle size={22} weight="fill" className="text-danger" aria-hidden />}
        <div className="min-w-0 flex-1">
          <h2 id="worker-heading" className="font-semibold">
            Scheduler: {headline}
          </h2>
          {worker.last_tick_at && (
            <p className="text-sm text-dim">
              Last tick {timeAgo(worker.last_tick_at)} ago{worker.duration_ms != null ? `, took ${worker.duration_ms} ms` : ""}
            </p>
          )}
        </div>
      </div>
      {worker.jobs && (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Last tick, per job</caption>
          <thead>
            <tr className="text-left text-dim">
              <th scope="col" className="py-1 font-medium">Job</th>
              <th scope="col" className="py-1 text-right font-medium">Last result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {Object.entries(worker.jobs).map(([name, r]) => (
              <tr key={name}>
                <th scope="row" className="py-1.5 text-left font-normal">{name}</th>
                <td className={`num py-1.5 text-right ${r.error ? "font-semibold text-danger" : ""}`}>{r.error ? `Failed: ${r.error}` : r.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Grant or revoke official status. Granting may take a reserved handle such
    as "pacestreak" - the only place that is allowed. Revoking from a reserved
    handle needs an ordinary one to move to. The API enforces both and writes
    the audit log; this just asks the right question. */
function OfficialSheet({ user, onClose, onDone }: { user: UserRow | null; onClose: () => void; onDone: () => void }) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if ((user?.id ?? null) !== lastId) {
    setLastId(user?.id ?? null);
    setHandle(user && !user.official ? (user.handle ?? "") : "");
  }
  const granting = user ? !user.official : true;
  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await api(`/admin/users/${user.id}/official`, { body: { official: granting, handle: handle.trim() || null } });
      toast.success(granting ? "Marked official" : "Official status removed");
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={user !== null}
      onClose={onClose}
      title={granting ? "Make official" : "Remove official status"}
      footer={
        <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void submit()}>
          {busy ? "Saving…" : granting ? "Make official" : "Remove"}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-dim">
          {granting
            ? "This account gets the verified mark and may hold a reserved handle such as @pacestreak. Recorded in the audit log."
            : "The verified mark goes. If the account holds a reserved handle, give it an ordinary one."}
        </p>
        <label className="block">
          <span className="field-label">{granting ? "Handle" : "New handle (only if the current one is reserved)"}</span>
          <input className="input" value={handle} autoCapitalize="none" spellCheck={false} maxLength={30} placeholder={user?.handle ?? ""} onChange={(e) => setHandle(e.target.value)} />
        </label>
      </div>
    </Sheet>
  );
}

interface ClientErrorRow {
  id: string;
  message: string;
  stack: string | null;
  path: string | null;
  release: string | null;
  user_agent: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
}

interface AbuseView {
  failures: Record<string, number>;
  by_ip: { ip: string | null; failures: number; accounts: number }[];
  by_account: { account: string; failures: number; ips: number }[];
  signups_by_ip: { ip: string | null; signups: number }[];
}

/** Admin only: crashes reported by the app, and the last day's failed
    sign-ins and sign-ups. Nothing here is visible to moderators. */
function Ops() {
  const errors = useQuery({ queryKey: ["admin-client-errors"], queryFn: () => api<ClientErrorRow[]>("/admin/client-errors") });
  const abuse = useQuery({ queryKey: ["admin-abuse"], queryFn: () => api<AbuseView>("/admin/abuse"), refetchInterval: 60_000 });
  const [open, setOpen] = useState<string | null>(null);
  const resolve = async (e: ClientErrorRow) => {
    try {
      await api(`/admin/client-errors/${e.id}`, { method: "DELETE" });
      toast.success("Marked fixed", { body: "If it happens again it comes back, counting from one." });
      void errors.refetch();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const total = Object.values(abuse.data?.failures ?? {}).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      <section aria-labelledby="crashes">
        <h2 id="crashes" className="mb-2 font-semibold">App crashes</h2>
        {!errors.data ? (
          <Loading rows={2} />
        ) : errors.data.length === 0 ? (
          <p className="card px-4 py-6 text-center text-muted">No crashes reported in the last 30 days.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {errors.data.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <button type="button" className="w-full text-left" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <span className="block font-mono text-sm break-words">{e.message}</span>
                  <span className="mt-0.5 block text-sm text-dim">
                    {e.count}× · last {timeAgo(e.last_seen)} ago{e.path ? ` · ${e.path}` : ""}{e.release ? ` · ${e.release}` : ""}
                  </span>
                </button>
                {open === e.id && (
                  <div className="mt-2 space-y-2">
                    {e.stack && <pre className="max-h-60 overflow-auto rounded-xl bg-surface-2 p-3 text-xs">{e.stack}</pre>}
                    {e.user_agent && <p className="text-xs text-dim">{e.user_agent}</p>}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void resolve(e)}>Mark fixed</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="abuse">
        <h2 id="abuse" className="mb-2 font-semibold">Last 24 hours</h2>
        {!abuse.data ? (
          <Loading rows={2} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {total} failed attempt{total === 1 ? "" : "s"}
              {total > 0 && ` (${Object.entries(abuse.data.failures).map(([k, n]) => `${n} ${k}`).join(", ")})`}.
            </p>
            <OpsTable caption="Failed attempts by address" head={["IP", "Failures", "Accounts tried"]} rows={abuse.data.by_ip.map((r) => [r.ip ?? "unknown", r.failures, r.accounts])} />
            <OpsTable caption="Accounts being tried" head={["Account", "Failures", "From IPs"]} rows={abuse.data.by_account.map((r) => [r.account, r.failures, r.ips])} />
            <OpsTable caption="Sign-ups by address" head={["IP", "Sign-ups"]} rows={abuse.data.signups_by_ip.map((r) => [r.ip ?? "unknown", r.signups])} />
          </div>
        )}
      </section>
    </div>
  );
}

function OpsTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="card overflow-x-auto p-4">
      <table className="w-full text-sm">
        <caption className="mb-2 text-left font-medium">{caption}</caption>
        <thead>
          <tr className="text-left text-dim">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`py-1 font-medium ${i ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr><td colSpan={head.length} className="py-2 text-muted">Nothing.</td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={`num py-1.5 ${j ? "text-right" : "break-all"}`}>{c}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
