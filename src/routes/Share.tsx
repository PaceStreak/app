import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { saveJournal } from "../components/Mood";
import { Barcode, Image as ImageIcon, NotePencil } from "../components/phosphor";
import { toast } from "../components/toast";
import { Empty, PageHeader, Segmented } from "../components/ui";
import { errorText } from "../lib/api";
import { canDetectBarcodes, detectBarcode } from "../lib/barcode";
import { localToday } from "../lib/dates";
import { addPhoto } from "../lib/photos";
import { useMe } from "../lib/session";

const SHARE_CACHE = "pacestreak-share";
type Pose = "front" | "side" | "back";

/** Whatever was shared into the app from the phone's share sheet. The
 * service worker left it in this device's cache; nothing was uploaded. */
export default function Share() {
  const me = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const today = localToday(me.profile.timezone);
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pose, setPose] = useState<Pose>("front");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    void (async () => {
      try {
        const cache = await caches.open(SHARE_CACHE);
        const img = await cache.match("/share-target/image");
        const txt = await cache.match("/share-target/text");
        if (img) {
          const blob = await img.blob();
          url = URL.createObjectURL(blob);
          setImage(blob);
          setPreview(url);
        }
        if (txt) setText(await txt.text());
      } finally {
        setLoaded(true);
      }
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const finish = async (to: string) => {
    try {
      await caches.delete(SHARE_CACHE);
    } catch {
      /* best effort; the next share replaces it anyway */
    }
    navigate(to, { replace: true });
  };

  const scan = async () => {
    if (!image) return;
    setBusy(true);
    try {
      const code = await detectBarcode(image);
      if (!code) toast.error("No barcode found in that photo. Try a closer shot.");
      else await finish(`/food?barcode=${code}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const savePhoto = async () => {
    if (!image) return;
    setBusy(true);
    try {
      await addPhoto(image, today, pose);
      toast.success("Saved to progress photos", { body: "Kept on this device unless you turned on backup." });
      await finish("/body");
    } catch (err) {
      toast.error(errorText(err));
      setBusy(false);
    }
  };

  const toJournal = async () => {
    if (!text) return;
    setBusy(true);
    try {
      await saveJournal(today, null, text);
      toast.success("Added to today's journal");
      await finish("/journal");
    } catch (err) {
      toast.error(errorText(err));
      setBusy(false);
    }
  };

  if (loaded && !image && !text) {
    return (
      <div>
        <PageHeader title="Share" back="/" />
        <Empty title={params.get("error") ? "That share didn't come through" : "Nothing was shared"} body="Share a photo or text to PaceStreak from another app, and it shows up here to file." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Shared with PaceStreak" back="/" subtitle="It's only on this device until you choose what it is." />
      {preview && <img src={preview} alt="The shared photo" className="card mt-2 max-h-80 w-full object-contain" />}
      {text && <p className="card mt-2 p-4 whitespace-pre-line">{text}</p>}
      <div className="mt-4 space-y-3">
        {image && canDetectBarcodes && (
          <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void scan()}>
            <Barcode size={18} /> It's a barcode: look up the food
          </button>
        )}
        {image && (
          <div className="card space-y-3 p-4">
            <Segmented label="Pose" value={pose} onChange={setPose} options={[{ value: "front", label: "Front" }, { value: "side", label: "Side" }, { value: "back", label: "Back" }]} />
            <button type="button" className="btn w-full" disabled={busy} onClick={() => void savePhoto()}>
              <ImageIcon size={18} /> Save as a progress photo
            </button>
          </div>
        )}
        {text && (
          <button type="button" className="btn w-full" disabled={busy} onClick={() => void toJournal()}>
            <NotePencil size={18} /> Add to today's journal
          </button>
        )}
        <button type="button" className="btn btn-ghost w-full" onClick={() => void finish("/")}>
          Discard
        </button>
      </div>
    </div>
  );
}
