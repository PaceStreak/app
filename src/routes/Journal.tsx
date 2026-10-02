import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { MOODS, MoodPicker, saveJournal, useJournal } from "../components/Mood";
import { Lock } from "../components/phosphor";
import { toast } from "../components/toast";
import { ErrorState, Field, Loading, PageHeader, Section } from "../components/ui";
import { api, errorText } from "../lib/api";
import { addDays, fmtMonthDay, localToday } from "../lib/dates";
import { useMe } from "../lib/session";
import type { JournalDay } from "../lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Journal() {
  const me = useMe();
  const today = localToday(me.profile.timezone);
  const q = useJournal();
  const [day, setDay] = useState(today);
  const entry = q.data?.find((j) => j.date === day);
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const found = useQuery({
    queryKey: ["journal", "search", search],
    queryFn: () => api<JournalDay[]>(`/journal?days=1100&q=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
  });

  useEffect(() => {
    setMood(entry?.mood ?? null);
    setNote(entry?.note ?? "");
  }, [entry?.mood, entry?.note, day]);

  const save = async (nextMood = mood) => {
    setBusy(true);
    try {
      const result = await saveJournal(day, nextMood, note.trim() || null);
      toast.success(result === "queued" ? "Saved on this phone. It syncs when you're back online." : "Saved");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const byDate = new Map((q.data ?? []).map((j) => [j.date, j]));
  const year = Number(today.slice(0, 4));
  const earliest = addDays(today, -60);

  return (
    <div>
      <PageHeader
        title="Journal"
        back="/you"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Lock size={14} aria-hidden /> Only you see this
          </span>
        }
      />

      <Section
        title={day === today ? "Today" : fmtMonthDay(day)}
        action={
          <Link to={`/day/${day}`} className="text-sm font-semibold text-accent-text">
            Everything that day
          </Link>
        }
      >
        <div className="card space-y-4 p-4">
          <MoodPicker
            day={day}
            value={mood}
            onPick={(m) => {
              const next = m === mood ? null : m;
              setMood(next);
              void save(next);
            }}
          />
          <div>
            <label className="field-label" htmlFor="journal-note">
              A line or two about the day
            </label>
            <textarea id="journal-note" className="input min-h-24" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary w-full" disabled={busy || (note.trim() || null) === (entry?.note ?? null)} onClick={() => void save()}>
            Save note
          </button>
        </div>
      </Section>

      <Section title={`${year} in pixels`}>
        {!q.data ? (
          <Loading />
        ) : (
          <div className="card overflow-x-auto p-4">
            <table className="w-full border-separate border-spacing-[3px]">
              <caption className="sr-only">Mood for each day this year. Tap a day in the last 60 days to edit it.</caption>
              <tbody>
                {MONTHS.map((name, m) => {
                  const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
                  return (
                    <tr key={name}>
                      <th scope="row" className="pr-2 text-left text-xs font-normal text-dim">
                        {name}
                      </th>
                      {Array.from({ length: 31 }, (_, i) => {
                        if (i >= days) return <td key={i} />;
                        const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                        const j = byDate.get(date);
                        const tone = MOODS.find((x) => x.value === j?.mood);
                        const editable = date <= today && date >= earliest;
                        const label = `${fmtMonthDay(date)}: ${tone ? tone.label : j?.note ? "note only" : "nothing logged"}`;
                        return (
                          <td key={i} className="p-0">
                            <button
                              type="button"
                              title={label}
                              aria-label={label}
                              disabled={!editable}
                              onClick={() => setDay(date)}
                              className={`block aspect-square w-full min-w-2 rounded-[3px] ${tone ? tone.cell : date <= today ? "bg-surface-2" : "bg-surface-2/40"} ${date === day ? "ring-2 ring-ink" : ""}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 flex flex-wrap gap-3 text-xs text-dim">
              {MOODS.map((m) => (
                <span key={m.value} className="inline-flex items-center gap-1">
                  <span className={`inline-block size-3 rounded-[3px] ${m.cell}`} aria-hidden /> {m.label}
                </span>
              ))}
            </p>
          </div>
        )}
      </Section>

      <Section title="Search">
        <Field label="Find a day by what you wrote" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search.trim().length >= 2 && (
          <ul className="card mt-3 divide-y divide-line">
            {(found.data ?? []).slice().reverse().map((j) => (
              <li key={j.date} className="px-4 py-3">
                <p className="text-sm text-dim">
                  {fmtMonthDay(j.date)} {MOODS.find((m) => m.value === j.mood)?.emoji ?? ""}
                </p>
                <p className="whitespace-pre-line">{j.note}</p>
              </li>
            ))}
            {found.data?.length === 0 && <li className="px-4 py-3 text-sm text-dim">Nothing matches.</li>}
          </ul>
        )}
      </Section>

      <p className="mt-8 text-center text-sm text-dim">
        Mood feeds your <Link to="/insights" className="underline">insights</Link>.
      </p>
    </div>
  );
}
