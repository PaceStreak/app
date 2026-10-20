import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { challengeFromError, clock, isChallenge, isSixDigits, normaliseCode, resendWait } from "./signin";

describe("sign-in challenge helpers", () => {
  const challenge = { mfa_required: true, mfa_token: "t", expires_in: 1800, method: "email", resend_in: 60 };

  it("recognises a challenge", () => {
    expect(isChallenge(challenge)).toBe(true);
    expect(isChallenge({ access_token: "a" })).toBe(false);
    expect(isChallenge(null)).toBe(false);
  });

  it("keeps the challenge from a 503 that could not send the code, and nothing else", () => {
    const body = { detail: "We couldn't send your code.", ...challenge, email_sent: false };
    expect(challengeFromError(new ApiError(503, "x", body))?.mfa_token).toBe("t");
    expect(challengeFromError(new ApiError(503, "x", { detail: "down" }))).toBeNull();
    expect(challengeFromError(new ApiError(401, "x", body))).toBeNull();
    expect(challengeFromError(new Error("x"))).toBeNull();
  });

  it("reads the wait from a 429 resend", () => {
    expect(resendWait(new ApiError(429, "x", { detail: "Wait", resend_in: 41.2 }))).toBe(42);
    expect(resendWait(new ApiError(429, "x", { detail: "Slow down" }))).toBeNull();
    expect(resendWait(new ApiError(400, "x", { resend_in: 3 }))).toBeNull();
  });

  it("tells emailed codes from recovery codes", () => {
    expect(isSixDigits("123 456")).toBe(true);
    expect(isSixDigits("ABCDE-FGHJK")).toBe(false);
    expect(normaliseCode(" 123 456 ")).toBe("123456");
    expect(normaliseCode(" abcde-fghjk ")).toBe("ABCDE-FGHJK");
  });

  it("formats the countdown", () => {
    expect(clock(60)).toBe("1:00");
    expect(clock(9)).toBe("0:09");
    expect(clock(-3)).toBe("0:00");
  });
});
