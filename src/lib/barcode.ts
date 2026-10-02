// The Shape Detection API: Chromium-only, and not in TypeScript's DOM lib yet.
type Detector = { detect: (img: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
const Ctor = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;

export const canDetectBarcodes = !!Ctor;

/** The first product barcode in an image, or null. Throws if unsupported. */
export async function detectBarcode(image: Blob): Promise<string | null> {
  if (!Ctor) throw new Error("This browser can't read barcodes");
  const codes = await new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }).detect(await createImageBitmap(image));
  return codes[0]?.rawValue ?? null;
}
