import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { UsersThree } from "../../components/phosphor";
import { FeedCard } from "../../components/social";
import { Empty, ErrorState, Loading } from "../../components/ui";
import { api } from "../../lib/api";
import type { FeedEvent } from "../../lib/types";
import { SocialGate, SocialHeader } from "./SocialNav";

export default function Feed() {
  const q = useInfiniteQuery({
    queryKey: ["feed"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api<{ events: FeedEvent[]; next: string | null }>(`/feed${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (last) => last.next,
  });
  const events = q.data?.pages.flatMap((p) => p.events) ?? [];
  return (
    <div>
      <SocialHeader title="Social" />
      <SocialGate>
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isLoading ? (
          <Loading rows={3} />
        ) : events.filter((e) => !e.mine).length === 0 ? (
          <>
            <Empty
              icon={<UsersThree size={26} />}
              title="Training is better watched by friends"
              body="Follow people you train with and their sessions, records and streaks show up here. Kudos only; no one-upping."
              action={<Link to="/people" className="btn btn-primary">Find people</Link>}
            />
            <div className="space-y-3">
              {events.map((e) => (
                <FeedCard key={e.id} e={e} />
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <FeedCard key={e.id} e={e} />
            ))}
            {q.hasNextPage && (
              <button type="button" className="btn btn-secondary w-full" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                {q.isFetchingNextPage ? "Loading…" : "Older"}
              </button>
            )}
          </div>
        )}
      </SocialGate>
    </div>
  );
}
