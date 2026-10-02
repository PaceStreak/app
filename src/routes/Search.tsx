import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { Link } from "react-router";
import { MagnifyingGlass } from "../components/phosphor";
import { Empty, ErrorState, Loading, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { fmtMonthDay } from "../lib/dates";
import type { SearchResult } from "../lib/types";
import { useDebounced } from "../lib/useDebounced";

export const SEARCH_KIND: Record<SearchResult["kind"], string> = {
  habit: "Habit",
  habit_note: "Habit note",
  workout: "Session",
  journal: "Journal",
  food: "Food",
  recipe: "Recipe",
};

export function useSearch(q: string) {
  const term = useDebounced(q.trim(), 200);
  return useQuery({
    queryKey: ["search", term],
    queryFn: () => api<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

/** Search across habits, notes, sessions, the journal and food. The query
 * lives in the URL, so a search survives back navigation and can be linked. */
export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const search = useSearch(q);
  const results = search.data?.results ?? [];

  return (
    <div>
      <PageHeader title="Search" back />
      <div className="relative">
        <MagnifyingGlass size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-dim" aria-hidden />
        <input
          className="input pl-10"
          type="search"
          autoFocus
          aria-label="Search everything you've logged"
          placeholder="Habits, notes, sessions, journal, food"
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
        />
      </div>
      {q.trim().length < 2 ? (
        <p className="mt-4 text-sm text-dim">Type at least two letters.</p>
      ) : search.isError ? (
        <ErrorState error={search.error} onRetry={() => void search.refetch()} />
      ) : !search.data ? (
        <Loading />
      ) : results.length === 0 ? (
        <Empty icon={<MagnifyingGlass size={26} />} title="Nothing matches" body={`Nothing you've logged mentions "${q.trim()}".`} />
      ) : (
        <ul className="card mt-4 divide-y divide-line" aria-live="polite">
          {results.map((r) => (
            <li key={`${r.kind}:${r.id}`}>
              <Link to={r.url} className="press block px-4 py-3">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{r.title}</span>
                  <span className="shrink-0 text-xs text-dim">
                    {SEARCH_KIND[r.kind]}
                    {r.date ? ` · ${fmtMonthDay(r.date)}` : ""}
                  </span>
                </span>
                {r.detail && <span className="mt-0.5 block truncate text-sm text-muted">{r.detail}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
