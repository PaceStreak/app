import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "../lib/api";
import { HandsClapping } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";

/**
 * Send one of a few fixed, kind messages. Never free text: nothing to
 * moderate and nothing to harass with. The API allows one a day per pair.
 */
export function EncourageButton({ handle, className = "btn btn-secondary btn-sm" }: { handle: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const presets = useQuery({
    queryKey: ["encouragement-presets"],
    queryFn: () => api<{ id: string; text: string }[]>("/encouragement/presets"),
    enabled: open,
    staleTime: Infinity,
  });
  const send = async (preset: string) => {
    try {
      const res = await api<{ sent: boolean }>(`/people/${handle}/encourage`, { body: { preset } });
      if (res.sent) toast.success(`Sent to @${handle}`);
      else toast(`You've already encouraged @${handle} today`);
      setOpen(false);
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <HandsClapping size={16} aria-hidden /> Encourage
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Encourage @${handle}`}>
        <ul className="space-y-2">
          {(presets.data ?? []).map((p) => (
            <li key={p.id}>
              <button type="button" className="press w-full rounded-md border border-line px-4 py-3.5 text-left font-medium hover:bg-surface-2" onClick={() => void send(p.id)}>
                {p.text}
              </button>
            </li>
          ))}
        </ul>
        <p className="field-hint">One a day to each person. They see who sent it.</p>
      </Sheet>
    </>
  );
}
