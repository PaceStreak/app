import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Bell, Checks, Gear } from "../components/phosphor";
import { Avatar, Empty, ErrorState, Loading, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { timeAgo } from "../lib/dates";
import { queryClient } from "../lib/queries";
import type { Notification } from "../lib/types";

export default function Notifications() {
  const navigate = useNavigate();
  const q = useInfiniteQuery({
    queryKey: ["notifications"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api<{ items: Notification[]; next: string | null }>(`/notifications${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (l) => l.next,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = items.filter((n) => !n.read).length;

  // Opening the inbox reads it; the bell and the app badge clear.
  useEffect(() => {
    if (!unread) return;
    const t = setTimeout(() => {
      void api("/notifications/read", { body: {} }).then(() => queryClient.invalidateQueries({ queryKey: ["unread"] }));
    }, 1200);
    return () => clearTimeout(t);
  }, [unread]);

  return (
    <div>
      <PageHeader
        title="Notifications"
        action={
          <div className="flex">
            {unread > 0 && (
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Mark all read" onClick={() => void api("/notifications/read", { body: {} }).then(() => q.refetch())}>
                <Checks size={20} />
              </button>
            )}
            <Link to="/settings/notifications" className="btn btn-ghost btn-icon" aria-label="Notification settings">
              <Gear size={20} />
            </Link>
          </div>
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty icon={<Bell size={26} />} title="Nothing yet" body="Follows, kudos, records and streak nudges land here." />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" className={`press flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-2/60 ${n.read ? "" : "bg-accent-soft/40"}`} onClick={() => n.url && navigate(n.url)}>
                {n.actor ? (
                  <Avatar name={n.actor.display_name ?? n.actor.handle} hue={n.actor.avatar_hue} size={36} />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                    <Bell size={18} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{n.title}</span>
                  {n.body && <span className="mt-0.5 line-clamp-2 block text-sm whitespace-pre-line text-muted">{n.body}</span>}
                </span>
                <span className="shrink-0 text-xs text-dim">{timeAgo(n.created_at)}</span>
                {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-flame" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage && (
        <button type="button" className="btn btn-secondary mt-4 w-full" onClick={() => void q.fetchNextPage()}>
          Older
        </button>
      )}
    </div>
  );
}
