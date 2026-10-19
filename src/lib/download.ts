/**
 * The name to save an export under. The server's Content-Disposition is only
 * readable when CORS exposes it, which it doesn't for a cross-origin API, so
 * the fallback goes by the body's type: the CSV export is a zip of CSV files,
 * and saving it as `.csv` leaves a file nothing opens.
 */
export function exportFilename(disposition: string | null, type: string, format: string): string {
  const named = /filename="([^"]+)"/.exec(disposition ?? "")?.[1];
  if (named) return named;
  return `pacestreak.${/zip/.test(type) ? "zip" : format}`;
}
