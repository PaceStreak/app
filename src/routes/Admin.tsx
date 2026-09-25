import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate } from "react-router";
import { MagnifyingGlass } from "../components/phosphor";
import { Sheet } from "../components/Sheet";
import { toast } from "../components/toast";
import { Empty, ErrorState, Loading, PageHeader, Segmented } from "../components/ui";
import { api, errorText } from "../lib/api";
import { timeAgo } from "../lib/dates";
import { useMe } from "../lib/session";

type Tab = "reports" | "users" | "audit" | "metrics";

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
      <Segmented label="Section" value={tab} onChange={setTab} options={[{ value: "reports", label: "Reports" }, { value: "users", label: "People" }, { value: "audit", label: "Audit" }, { value: "metrics", label: "Metrics" }]} />
      <div className="mt-5">
        {tab === "reports" && <Reports />}
        {tab === "users" && <Users admin={me.user.role === "admin"} />}
        {tab === "audit" && <Audit />}
        {tab === "metrics" && <Metrics />}
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

function Metrics() {
  const q = useQuery({ queryKey: ["admin-metrics"], queryFn: () => api<Record<string, number | { week: string; count: number }[]>>("/admin/metrics") });
  if (!q.data) return <Loading />;
  const tiles = ["users", "onboarded", "active_1d", "active_7d", "active_30d", "sessions_7d", "open_reports", "suspended"];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((k) => (
        <div key={k} className="card p-4">
          <p className="text-sm text-dim">{k.replace(/_/g, " ")}</p>
          <p className="num mt-1 text-2xl font-semibold">{q.data[k] as number}</p>
        </div>
      ))}
    </div>
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
