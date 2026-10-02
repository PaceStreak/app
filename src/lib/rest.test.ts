import { beforeEach, describe, expect, it } from "vitest";
import { rememberRest, rememberedRest } from "./persist";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
  });
});

describe("remembered rest", () => {
  it("falls back to the library default until a rest is chosen", () => {
    expect(rememberedRest("back-squat", 180)).toBe(180);
    rememberRest("back-squat", 240);
    expect(rememberedRest("back-squat", 180)).toBe(240);
    expect(rememberedRest("bench-press", 150)).toBe(150);
  });
  it("ignores corrupt or absurd values", () => {
    store.set("ps.rest.x", "banana");
    store.set("ps.rest.y", "99999");
    expect(rememberedRest("x", 90)).toBe(90);
    expect(rememberedRest("y", 90)).toBe(90);
  });
  it("still works when storage is unavailable", () => {
    Object.assign(globalThis, { localStorage: undefined });
    expect(rememberedRest("x", 60)).toBe(60);
    expect(() => rememberRest("x", 60)).not.toThrow();
  });
});
