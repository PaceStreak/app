import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { MagnifyingGlass } from "../../components/phosphor";
import { FollowButton, PersonRow } from "../../components/social";
import { toast } from "../../components/toast";
import { PageHeader, Section, Segmented } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { useSession } from "../../lib/session";
import type { Person } from "../../lib/types";
import { SocialGate } from "./SocialNav";

type Tab = "find" | "requests";

export default function People() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "find";
  const { reloadMe } = useSession();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const search = useQuery({ queryKey: ["people-search", term], queryFn: () => api<Person[]>(`/people/search?q=${encodeURIComponent(term)}`), enabled: term.length > 0 });
  const suggested = useQuery({ queryKey: ["people-suggested"], queryFn: () => api<Person[]>("/people/suggested") });
  const requests = useQuery({ queryKey: ["follow-requests"], queryFn: () => api<(Person & { request_id: string })[]>("/me/follow-requests") });

  const answer = async (id: string, decision: "accept" | "decline") => {
    try {
      await api(`/me/follow-requests/${id}/${decision}`, { method: "POST" });
      await requests.refetch();
      void reloadMe();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const list = (people: Person[] | undefined) => (
    <div className="card divide-y divide-line overflow-hidden">
      {(people ?? []).map((p) => (
        <PersonRow key={p.id} p={p} right={<FollowButton handle={p.handle} rel={{ following: null, follows_you: null, blocked: false }} onChange={() => void search.refetch()} />} />
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader title="People" back="/feed" />
      <SocialGate>
        <Segmented
          label="View"
          value={tab}
          onChange={(t) => setParams(t === "find" ? {} : { tab: t })}
          options={[
            { value: "find", label: "Find" },
            { value: "requests", label: `Requests${requests.data?.length ? ` (${requests.data.length})` : ""}` },
          ]}
        />
        {tab === "find" ? (
          <>
            <div className="relative mt-4">
              <MagnifyingGlass size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-dim" />
              <input className="input pl-11" placeholder="Search by handle or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" autoCapitalize="none" />
            </div>
            {term ? (
              <Section title="Results">{search.data?.length === 0 ? <p className="text-muted">Nobody by that name, or their account is private.</p> : list(search.data)}</Section>
            ) : suggested.data && suggested.data.length > 0 ? (
              <Section title="People you might know">{list(suggested.data)}</Section>
            ) : (
              <p className="mt-6 text-[0.95rem] text-muted">Search for friends by their handle. Private accounts never show up in search.</p>
            )}
          </>
        ) : (
          <Section>
            {requests.data?.length === 0 ? (
              <p className="text-muted">No requests waiting.</p>
            ) : (
              <div className="card divide-y divide-line overflow-hidden">
                {(requests.data ?? []).map((p) => (
                  <PersonRow
                    key={p.request_id}
                    p={p}
                    right={
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void answer(p.request_id, "decline")}>
                          Decline
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => void answer(p.request_id, "accept")}>
                          Accept
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </Section>
        )}
      </SocialGate>
    </div>
  );
}
