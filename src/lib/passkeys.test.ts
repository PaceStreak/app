import { describe, expect, it } from "vitest";
import { creationOptions, fromB64url, requestOptions, toB64url } from "./passkeys";

describe("base64url", () => {
  it("round-trips every byte value", () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    expect(new Uint8Array(fromB64url(toB64url(bytes)))).toEqual(bytes);
  });

  it("uses the URL-safe alphabet with no padding", () => {
    const encoded = toB64url(new Uint8Array([0xfb, 0xff, 0xfe, 0x01]));
    expect(encoded).toBe("-__-AQ");
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe("options", () => {
  it("decodes the challenge, user id and excluded credentials", () => {
    const o = creationOptions({
      challenge: "AQID",
      rp: { id: "app.pacestreak.com", name: "PaceStreak" },
      user: { id: "BAUG", name: "a@b.c", displayName: "a@b.c" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      excludeCredentials: [{ id: "BwgJ", type: "public-key", transports: ["internal"] }],
    });
    expect(new Uint8Array(o.challenge as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(o.user.id as ArrayBuffer)).toEqual(new Uint8Array([4, 5, 6]));
    expect(new Uint8Array(o.excludeCredentials![0].id as ArrayBuffer)).toEqual(new Uint8Array([7, 8, 9]));
  });

  it("leaves a usernameless request without an allow-list", () => {
    const o = requestOptions({ challenge: "AQID", rpId: "app.pacestreak.com", userVerification: "required" });
    expect(o.allowCredentials).toBeUndefined();
    expect(o.userVerification).toBe("required");
  });
});
