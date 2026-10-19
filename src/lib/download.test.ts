import { describe, expect, it } from "vitest";
import { exportFilename } from "./download";

describe("exportFilename", () => {
  it("uses the server's name when it can be read", () => {
    expect(exportFilename('attachment; filename="pacestreak-2026-10-19.zip"', "application/zip", "csv")).toBe("pacestreak-2026-10-19.zip");
  });
  it("names a zipped CSV export .zip when the header is hidden", () => {
    expect(exportFilename(null, "application/zip", "csv")).toBe("pacestreak.zip");
  });
  it("otherwise falls back to the format", () => {
    expect(exportFilename(null, "application/json", "json")).toBe("pacestreak.json");
    expect(exportFilename(null, "text/calendar; charset=utf-8", "ics")).toBe("pacestreak.ics");
  });
});
