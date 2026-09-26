import { useState } from "react";
import { fmtMonthDay } from "../lib/dates";
import { drawGrid, drawWeek, shareCanvas } from "../lib/shareImage";
import type { HeatDay, Recap } from "../lib/types";
import { ShareNetwork } from "./phosphor";
import { toast } from "./toast";

function useShare() {
  const [busy, setBusy] = useState(false);
  const run = async (make: () => HTMLCanvasElement, name: string, title: string) => {
    setBusy(true);
    try {
      const result = await shareCanvas(make(), name, title);
      if (result === "saved") toast.success("Image saved", { body: "Share it from your photos or downloads." });
    } catch {
      toast.error("Couldn't make the image on this device.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** A picture of one week, made on the phone. Days, target and streak only. */
export function ShareWeekButton({ recap }: { recap: Recap }) {
  const { busy, run } = useShare();
  if (recap.days === 0) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost mt-3 w-full"
      disabled={busy}
      onClick={() =>
        void run(
          () =>
            drawWeek({
              weekStart: recap.week_start,
              trained: recap.trained_on,
              days: recap.days,
              target: recap.target,
              kept: recap.status === "kept",
              streak: recap.streak,
              label: `Week of ${fmtMonthDay(recap.week_start)}`,
            }),
          `pacestreak-week-${recap.week_start}`,
          "My week on PaceStreak",
        )
      }
    >
      <ShareNetwork size={18} /> Share this week as an image
    </button>
  );
}

/** The last six months of the grid, as a picture. */
export function ShareGridButton({ days, today, weekStartsOn, activeDays, longest }: { days: HeatDay[]; today: string; weekStartsOn: number; activeDays: number; longest: number }) {
  const { busy, run } = useShare();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={busy}
      onClick={() => void run(() => drawGrid({ days, today, weekStartsOn, activeDays, longest }), `pacestreak-grid-${today}`, "My training grid on PaceStreak")}
    >
      <ShareNetwork size={16} /> Share
    </button>
  );
}
