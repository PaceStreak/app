import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { CaretRight, Plus, UsersThree } from "../../components/phosphor";
import { Sheet } from "../../components/Sheet";
import { toast } from "../../components/toast";
import { Avatar, Empty, ErrorState, Loading, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { queryClient } from "../../lib/queries";
import type { Group } from "../../lib/types";
import { SocialGate, SocialHeader } from "./SocialNav";

export default function Groups() {
  const q = useQuery({ queryKey: ["groups"], queryFn: () => api<Group[]>("/groups") });
  const [sheet, setSheet] = useState<"create" | "join" | null>(null);
  return (
    <div>
      <SocialHeader
        title="Groups"
        action={
          <button type="button" className="btn btn-ghost btn-icon" aria-label="New or join a group" onClick={() => setSheet("create")}>
            <Plus size={22} />
          </button>
        }
      />
      <SocialGate>
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.data ? (
          <Loading />
        ) : q.data.length === 0 ? (
          <Empty
            icon={<UsersThree size={26} />}
            title="Train with your people"
            body="A crew sees each other's weekly progress and streaks. A coaching group lets a coach follow the members who opt in."
            action={
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setSheet("join")}>Join with a code</button>
                <button type="button" className="btn btn-primary" onClick={() => setSheet("create")}>Start a group</button>
              </div>
            }
          />
        ) : (
          <>
            <div className="card divide-y divide-line overflow-hidden">
              {q.data.map((g) => (
                <Link key={g.id} to={`/groups/${g.id}`} className="press flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2/60">
                  <Avatar name={g.name} hue={g.avatar_hue} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{g.name}</span>
                    <span className="block text-sm text-dim">
                      {g.member_count} {g.member_count === 1 ? "member" : "members"} · {g.kind === "coaching" ? "Coaching" : "Crew"}
                    </span>
                  </span>
                  <CaretRight size={16} className="text-dim" />
                </Link>
              ))}
            </div>
            <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => setSheet("join")}>
              Join with a code
            </button>
          </>
        )}
      </SocialGate>
      <GroupSheet mode={sheet} onClose={() => setSheet(null)} onMode={setSheet} />
    </div>
  );
}

function GroupSheet({ mode, onClose, onMode }: { mode: "create" | "join" | null; onClose: () => void; onMode: (m: "create" | "join") => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"crew" | "coaching">("crew");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const res =
        mode === "create"
          ? await api<Group>("/groups", { body: { name, description: description || null, kind } })
          : await api<{ id: string }>("/groups/join", { body: { code } });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      onClose();
      navigate(`/groups/${res.id}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={mode !== null}
      onClose={onClose}
      title={mode === "join" ? "Join a group" : "New group"}
      footer={
        <button type="button" className="btn btn-primary w-full" disabled={busy || (mode === "create" ? name.trim().length < 2 : code.trim().length < 4)} onClick={submit}>
          {mode === "join" ? "Join" : "Create group"}
        </button>
      }
    >
      <Segmented label="Create or join" value={mode ?? "create"} onChange={onMode} options={[{ value: "create", label: "Create" }, { value: "join", label: "Join" }]} />
      {mode === "join" ? (
        <div className="mt-5">
          <label className="field-label" htmlFor="g-code">Invite code</label>
          <input id="g-code" className="input num tracking-[0.2em] lowercase" value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} maxLength={16} autoCapitalize="none" placeholder="e.g. k3mdq8wt" />
          <p className="field-hint">Ask whoever runs the group. There's no public directory, by design.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <label className="field-label" htmlFor="g-name">Name</label>
            <input id="g-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Tuesday run club" />
          </div>
          <div>
            <label className="field-label" htmlFor="g-desc">Description (optional)</label>
            <textarea id="g-desc" className="input" value={description} maxLength={280} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <p className="field-label">Kind</p>
            <Segmented label="Kind" value={kind} onChange={setKind} options={[{ value: "crew", label: "Crew" }, { value: "coaching", label: "Coaching" }]} />
            <p className="field-hint">
              {kind === "crew" ? "Everyone sees each other's weekly progress and streaks." : "You can see the training of members who choose to share it with you. Nobody else can."}
            </p>
          </div>
        </div>
      )}
    </Sheet>
  );
}
