import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { PersonRow } from "../../components/social";
import { ErrorState, Loading, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import type { Person } from "../../lib/types";

export default function FollowList() {
  const { handle = "", list = "followers" } = useParams();
  const kind = list === "following" ? "following" : "followers";
  const q = useQuery({ queryKey: ["follow-list", handle, kind], queryFn: () => api<Person[]>(`/people/${handle}/${kind}`) });
  return (
    <div>
      <PageHeader title={kind === "following" ? "Following" : "Followers"} subtitle={`@${handle}`} back={`/u/${handle}`} />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <Loading />
      ) : q.data.length === 0 ? (
        <p className="text-muted">Nobody yet.</p>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {q.data.map((p) => (
            <PersonRow key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
