/**
 * Photo backup is an account setting with a per-device mirror. The account wins on sync; the one exception is the
 * one-time move of an old device-only "on" that had already uploaded.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  clear: () => store.clear(),
});

const net = vi.hoisted(() => ({ api: vi.fn(), photos: [] as { synced?: boolean }[] }));

vi.mock("./api", () => ({
  api: net.api,
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));
vi.mock("./db", () => ({
  db: async () => ({ getAll: async () => net.photos, put: async () => undefined, delete: async () => undefined }),
}));

import { resolveBackup, startPhotoBackup, stopPhotoBackup, syncBackupSetting } from "./photos";
import { prefs } from "./prefs";

const me = (photo_backup: boolean) => ({ profile: { photo_backup } });
const patches = () => net.api.mock.calls.filter(([, o]) => o?.method === "PATCH").map(([p, o]) => [p, o.body]);

beforeEach(() => {
  localStorage.clear();
  net.api.mockReset();
  net.photos = [];
});

describe("resolveBackup", () => {
  it("follows the account when it says on", () => {
    expect(resolveBackup(true, false, false, true)).toEqual({ on: true, migrate: false });
  });
  it("migrates a device-only on once, and only after an upload", () => {
    expect(resolveBackup(false, true, true, false)).toEqual({ on: true, migrate: true });
    expect(resolveBackup(false, true, false, false)).toEqual({ on: false, migrate: false });
    expect(resolveBackup(false, true, true, true)).toEqual({ on: false, migrate: false });
    expect(resolveBackup(false, false, true, false)).toEqual({ on: false, migrate: false });
  });
});

describe("syncBackupSetting", () => {
  it("a new device defaults off, and turns on when the account is on", async () => {
    expect(await syncBackupSetting(me(false) as never)).toBe(false);
    expect(prefs.photoBackup()).toBe(false);
    net.api.mockResolvedValueOnce(me(true));
    expect(await syncBackupSetting()).toBe(true);
    expect(prefs.photoBackup()).toBe(true);
    expect(patches()).toEqual([]);
  });

  it("the account's off wins over a stale device on that never uploaded", async () => {
    prefs.setPhotoBackup(true);
    expect(await syncBackupSetting(me(false) as never)).toBe(false);
    expect(prefs.photoBackup()).toBe(false);
    expect(patches()).toEqual([]);
  });

  it("moves an old device on that uploaded to the account, once", async () => {
    prefs.setPhotoBackup(true);
    net.photos = [{ synced: true }];
    net.api.mockResolvedValue(undefined);
    expect(await syncBackupSetting(me(false) as never)).toBe(true);
    expect(patches()).toEqual([["/me/profile", { photo_backup: true }]]);
    // Later turned off on another phone: the account wins, no second migration.
    expect(await syncBackupSetting(me(false) as never)).toBe(false);
    expect(patches()).toHaveLength(1);
  });

  it("keeps the mirror offline", async () => {
    prefs.setPhotoBackup(true);
    net.api.mockRejectedValueOnce(new Error("offline"));
    expect(await syncBackupSetting()).toBe(true);
  });
});

describe("toggling updates the account", () => {
  it("on and off are PATCHes of photo_backup; off no longer calls DELETE /body-photos", async () => {
    net.api.mockResolvedValue(undefined);
    await startPhotoBackup();
    expect(prefs.photoBackup()).toBe(true);
    await stopPhotoBackup();
    expect(prefs.photoBackup()).toBe(false);
    expect(patches()).toEqual([
      ["/me/profile", { photo_backup: true }],
      ["/me/profile", { photo_backup: false }],
    ]);
    expect(net.api.mock.calls.some(([p, o]) => p === "/body-photos" && o?.method === "DELETE")).toBe(false);
  });
});
