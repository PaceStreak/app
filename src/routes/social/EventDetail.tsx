import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useConfirm } from "../../components/Confirm";
import { Flag, PaperPlaneRight, Trash } from "../../components/phosphor";
import { FeedCard, ReportSheet, personName } from "../../components/social";
import { toast } from "../../components/toast";
import { Avatar, ErrorState, Loading, PageHeader } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { timeAgo } from "../../lib/dates";
import type { FeedEvent, Person } from "../../lib/types";

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  author: Person;
  can_delete: boolean;
  mine: boolean;
}

export default function EventDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [confirmSheet, ask] = useConfirm();
  const [report, setReport] = useState<{ type: string; id: string; label: string } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const event = useQuery({ queryKey: ["event", id], queryFn: () => api<FeedEvent>(`/events/${id}`) });
  const comments = useQuery({ queryKey: ["comments", id], queryFn: () => api<CommentRow[]>(`/events/${id}/comments`) });

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api(`/events/${id}/comments`, { body: { body: text } });
      setText("");
      await comments.refetch();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (c: CommentRow) => {
    if (!(await ask({ title: "Delete this comment?", confirm: "Delete", danger: true }))) return;
    await api(`/comments/${c.id}`, { method: "DELETE" });
    await comments.refetch();
  };

  const removeEvent = async () => {
    if (!(await ask({ title: "Remove from feeds?", body: "The session itself stays in your log.", confirm: "Remove", danger: true }))) return;
    await api(`/events/${id}`, { method: "DELETE" });
    navigate("/feed", { replace: true });
  };

  if (event.isError) return <ErrorState error={event.error} onRetry={() => void event.refetch()} />;
  const e = event.data;
  return (
    <div>
      <PageHeader
        title="Activity"
        back
        action={
          e &&
          (e.mine ? (
            <button type="button" className="btn btn-ghost btn-icon text-dim" aria-label="Remove from feeds" onClick={removeEvent}>
              <Trash size={20} />
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-icon text-dim" aria-label="Report" onClick={() => setReport({ type: "event", id, label: "this post" })}>
              <Flag size={20} />
            </button>
          ))
        }
      />
      {!e ? (
        <Loading rows={2} />
      ) : (
        <>
          <FeedCard e={e} link={false} />
          {e.kudos_by && e.kudos_by.length > 0 && (
            <p className="mt-3 px-1 text-sm text-dim">
              Kudos from{" "}
              {e.kudos_by.slice(0, 3).map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ", "}
                  <Link to={`/u/${p.handle}`} className="text-muted hover:underline">
                    {personName(p)}
                  </Link>
                </span>
              ))}
              {e.kudos_by.length > 3 ? ` and ${e.kudos_by.length - 3} more` : ""}
            </p>
          )}
          <section className="mt-6">
            <h2 className="mb-3 font-semibold">Comments</h2>
            <ul className="space-y-3">
              {(comments.data ?? []).map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Link to={`/u/${c.author.handle}`} aria-label={`${personName(c.author)}'s profile`}>
                    <Avatar name={personName(c.author)} hue={c.author.avatar_hue} size={32} />
                  </Link>
                  <div className="min-w-0 flex-1 rounded-2xl bg-surface px-3.5 py-2.5">
                    <p className="text-sm">
                      <span className="font-semibold">{personName(c.author)}</span> <span className="text-dim">{timeAgo(c.created_at)}</span>
                    </p>
                    {/* Rendered as text. React escapes it; nothing user-written is ever parsed as markup. */}
                    <p className="mt-0.5 break-words whitespace-pre-wrap">{c.body}</p>
                  </div>
                  <div className="flex flex-col">
                    {c.can_delete && (
                      <button type="button" className="btn btn-ghost btn-icon btn-sm text-dim" aria-label="Delete comment" onClick={() => void removeComment(c)}>
                        <Trash size={16} />
                      </button>
                    )}
                    {!c.mine && (
                      <button type="button" className="btn btn-ghost btn-icon btn-sm text-dim" aria-label="Report comment" onClick={() => setReport({ type: "comment", id: c.id, label: "comment" })}>
                        <Flag size={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {comments.data?.length === 0 && <li className="text-sm text-dim">No comments yet.</li>}
            </ul>
            <form onSubmit={send} className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] mt-5 flex gap-2 lg:bottom-4">
              <input className="input" placeholder="Say something kind" maxLength={280} value={text} onChange={(ev) => setText(ev.target.value)} aria-label="Comment" />
              <button className="btn btn-primary btn-icon shrink-0" disabled={busy || !text.trim()} aria-label="Send">
                <PaperPlaneRight size={18} weight="fill" />
              </button>
            </form>
          </section>
        </>
      )}
      <ReportSheet open={report !== null} target={report} onClose={() => setReport(null)} />
      {confirmSheet}
    </div>
  );
}
