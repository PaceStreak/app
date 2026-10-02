import { beforeEach, describe, expect, it } from "vitest";
import { installMoment, markInstallMoment, recordVisit } from "./installMoments";

const local = new Map<string, string>();
const session = new Map<string, string>();
const storage = (m: Map<string, string>) => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
beforeEach(() => {
  local.clear();
  session.clear();
  Object.assign(globalThis, { localStorage: storage(local), sessionStorage: storage(session) });
});

describe("install moments", () => {
  it("welcomes on the first visit, then waits for a later day", () => {
    expect(installMoment(recordVisit())).toBe("welcome");
    markInstallMoment("welcome");
    session.clear(); // a new tab the same day
    expect(installMoment(recordVisit())).toBeNull();
    local.set("ps.visitDays", JSON.stringify(["2026-01-01"]));
    session.clear();
    expect(installMoment(recordVisit())).toBe("return");
    markInstallMoment("return");
    expect(installMoment(2)).toBeNull();
  });
  it("offers once after the first logged session", () => {
    expect(installMoment(null, true)).toBe("logged");
    markInstallMoment("logged");
    expect(installMoment(null, true)).toBeNull();
  });
  it("counts a tab once", () => {
    expect(recordVisit()).toBe(1);
    expect(recordVisit()).toBe(1);
  });
  it("still works when storage is unavailable", () => {
    Object.assign(globalThis, { localStorage: undefined, sessionStorage: undefined });
    expect(() => recordVisit()).not.toThrow();
    expect(() => markInstallMoment("welcome")).not.toThrow();
    expect(installMoment(1)).toBe("welcome");
  });
});
