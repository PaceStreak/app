import { useEffect, useMemo, useRef, useState } from "react";
import { errorText } from "../lib/api";
import { fmtMonthDay } from "../lib/dates";
import type { Photo } from "../lib/db";
import { addPhoto, deletePhoto, listPhotos, stopPhotoBackup, syncPhotos } from "../lib/photos";
import { prefs } from "../lib/prefs";
import { useConfirm } from "./Confirm";
import { Camera, CloudCheck, Trash } from "./phosphor";
import { Sheet } from "./Sheet";
import { toast } from "./toast";
import { Segmented, Switch } from "./ui";

const POSES: { value: Photo["pose"]; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "side", label: "Side" },
  { value: "back", label: "Back" },
];

/** Object URLs for photo blobs, revoked when the list changes or on unmount. */
function useUrls(photos: Photo[]) {
  const urls = useMemo(() => new Map(photos.map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

/**
 * Progress photos. Taken or picked here, stored in this browser's own storage
 * and compared side by side with a slider. Backup to the account is opt-in:
 * with it on they follow you to another phone and survive clearing the
 * browser; with it off they never leave this one. Both are said plainly.
 */
export function ProgressPhotos({ today }: { today: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [pose, setPose] = useState<Photo["pose"]>("front");
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const [split, setSplit] = useState(50);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const urls = useUrls(photos ?? []);
  const [backup, setBackup] = useState(prefs.photoBackup);
  const [syncing, setSyncing] = useState(false);
  const [confirmSheet, ask] = useConfirm();

  const reload = () => void listPhotos().then(setPhotos);
  const sync = async (quiet = true) => {
    setSyncing(true);
    try {
      await syncPhotos();
    } catch (err) {
      if (!quiet) toast.error(errorText(err));
    } finally {
      setSyncing(false);
      reload();
    }
  };
  useEffect(() => {
    reload();
    void sync();
  }, []);

  const toggleBackup = async (on: boolean) => {
    if (on) {
      prefs.setPhotoBackup(true);
      setBackup(true);
      await sync(false);
      toast.success("Photos backed up to your account");
      return;
    }
    if (!(await ask({ title: "Turn off photo backup?", body: "Every copy on our server is deleted. The photos on this phone stay here.", confirm: "Turn off", danger: true }))) return;
    try {
      await stopPhotoBackup();
      setBackup(false);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const forPose = (photos ?? []).filter((p) => p.pose === pose);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await addPhoto(file, today, pose);
      reload();
    } catch {
      toast.error("That image couldn't be read. Try a JPEG or PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (id: string) => {
    await deletePhoto(id);
    setCompare(null);
    reload();
  };

  const [a, b] = compare ? compare.map((id) => (photos ?? []).find((p) => p.id === id)) : [undefined, undefined];

  return (
    <div className="card space-y-4 p-4">
      <div className="-mx-4 -mt-1 border-b border-line pb-1">
        <Switch
          checked={backup}
          disabled={syncing}
          onChange={(on) => void toggleBackup(on)}
          label={
            <span className="flex items-center gap-2">
              Back up to your account {backup && <CloudCheck size={16} className="text-accent-text" aria-hidden />}
            </span>
          }
          description={
            backup
              ? `${syncing ? "Syncing… " : ""}They follow you to other devices. Only you can ever open them.`
              : "Off: photos stay on this phone only, and clearing the browser's data deletes them."
          }
        />
      </div>
      <p className="text-xs text-dim">Location data from the camera is removed before a photo is saved anywhere.</p>
      <Segmented label="Pose" value={pose} onChange={setPose} options={POSES} />
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" id="photo-input" onChange={(e) => void onFile(e.target.files?.[0])} />
      <label htmlFor="photo-input" className={`btn btn-secondary w-full ${busy ? "pointer-events-none opacity-60" : ""}`}>
        <Camera size={18} /> Add a {pose} photo for today
      </label>
      {forPose.length > 0 && (
        <>
          <ul className="grid grid-cols-3 gap-2" aria-label={`${pose} photos`}>
            {forPose.map((p, i) => (
              <li key={p.id} className="relative">
                <button
                  type="button"
                  className="press block w-full overflow-hidden rounded-xl"
                  aria-label={`Compare ${fmtMonthDay(p.date)} with ${forPose.length > 1 ? "the one before" : "itself"}`}
                  onClick={() => {
                    const other = forPose[i + 1] ?? forPose[i - 1] ?? p;
                    setSplit(50);
                    const [older, newer] = other.date <= p.date ? [other, p] : [p, other];
                    setCompare([older.id, newer.id]);
                  }}
                >
                  <img src={urls.get(p.id)} alt="" className="aspect-[3/4] w-full object-cover" />
                </button>
                <span className="num pointer-events-none absolute bottom-1 left-1 rounded-md bg-bg/80 px-1.5 text-xs">{fmtMonthDay(p.date)}</span>
              </li>
            ))}
          </ul>
          {forPose.length > 1 && <p className="text-xs text-dim">Tap a photo to compare it with the one before.</p>}
        </>
      )}

      <Sheet open={compare !== null} onClose={() => setCompare(null)} title="Compare" size="full">
        {a && b && (
          <div>
            <div className="flex gap-2">
              {[a, b].map((p, i) => (
                <select
                  key={i}
                  className="input flex-1"
                  aria-label={i === 0 ? "Earlier photo" : "Later photo"}
                  value={p.id}
                  onChange={(e) => setCompare((c) => (c ? ((i === 0 ? [e.target.value, c[1]] : [c[0], e.target.value]) as [string, string]) : c))}
                >
                  {(photos ?? []).filter((x) => x.pose === a.pose).map((x) => (
                    <option key={x.id} value={x.id}>{fmtMonthDay(x.date)}</option>
                  ))}
                </select>
              ))}
            </div>
            <div className="relative mt-3 overflow-hidden rounded-2xl bg-surface-2">
              <img src={urls.get(b.id)} alt={`${b.pose} photo, ${fmtMonthDay(b.date)}`} className="block aspect-[3/4] w-full object-cover" />
              <img
                src={urls.get(a.id)}
                alt={`${a.pose} photo, ${fmtMonthDay(a.date)}`}
                className="absolute inset-0 block aspect-[3/4] w-full object-cover"
                style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
              />
              <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-ink/80" style={{ left: `${split}%` }} aria-hidden />
              <span className="num absolute top-2 left-2 rounded-md bg-bg/80 px-1.5 text-xs">{fmtMonthDay(a.date)}</span>
              <span className="num absolute top-2 right-2 rounded-md bg-bg/80 px-1.5 text-xs">{fmtMonthDay(b.date)}</span>
            </div>
            <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="mt-3 w-full" aria-label="Slide between the two photos" />
            <div className="mt-4 flex gap-2">
              {[a, b].map((p) => (
                <button key={p.id} type="button" className="btn btn-ghost btn-sm flex-1 text-dim" onClick={() => void remove(p.id)}>
                  <Trash size={16} /> Delete {fmtMonthDay(p.date)}
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>
      {confirmSheet}
    </div>
  );
}
