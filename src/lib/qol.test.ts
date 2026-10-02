import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { matches } from "../components/CommandPalette";
import { readView } from "./persist";

describe("command palette matching", () => {
  const journal = { label: "Write in the journal", keywords: "mood note diary" };
  it("matches word starts in the label or keywords", () => {
    expect(matches(journal, "jou")).toBe(true);
    expect(matches(journal, "mood")).toBe(true);
    expect(matches(journal, "write jour")).toBe(true);
    expect(matches(journal, "WRITE")).toBe(true);
  });
  it("needs every word to match", () => {
    expect(matches(journal, "write food")).toBe(false);
    expect(matches({ label: "💧 Water" }, "water")).toBe(true);
  });
});

describe("remembered views", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("returns the stored value when it is still valid", () => {
    store.set("ps.view.tools", JSON.stringify("plates"));
    expect(readView("tools", "timer", ["timer", "plates"])).toBe("plates");
  });
  it("falls back when the value is stale, the wrong type or corrupt", () => {
    store.set("ps.view.tools", JSON.stringify("removed-tab"));
    expect(readView("tools", "timer", ["timer", "plates"])).toBe("timer");
    store.set("ps.view.range", JSON.stringify("90"));
    expect(readView("range", 90)).toBe(90);
    store.set("ps.view.x", "{not json");
    expect(readView("x", "a")).toBe("a");
  });
  it("works with no storage at all", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(readView("tools", "timer")).toBe("timer");
  });
});
