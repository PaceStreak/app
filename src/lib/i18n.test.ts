import { describe, expect, it } from "vitest";
import { formatNumber, t } from "./i18n";

describe("t", () => {
  it("picks the plural form from Intl.PluralRules, not n === 1", () => {
    expect(t("streak.weeks", { count: 1 })).toBe("1 week");
    expect(t("streak.weeks", { count: 0 })).toBe("0 weeks");
    expect(t("streak.weeks", { count: 12 })).toBe("12 weeks");
  });
  it("formats interpolated numbers for the locale", () => {
    expect(t("streak.sessions", { count: 1200 })).toBe(`${formatNumber(1200)} sessions`);
  });
  it("returns plain messages unchanged", () => {
    expect(t("nav.today")).toBe("Today");
  });
});

import { isValidElement } from "react";
import { rich } from "./i18n-rich";

describe("rich", () => {
  it("wraps tagged text and keeps the rest", () => {
    const out = rich("auth.signup.agree", { terms: (x) => `[${x}]`, privacy: (x) => `(${x})` }) as unknown[];
    const text = out.map((n) => (isValidElement(n) ? (n.props as { children: string }).children : n)).join("");
    expect(text).toBe("By continuing you agree to the [terms] and (privacy policy).");
  });
  it("leaves unknown tags as plain text", () => {
    const out = rich("auth.login.newHere", {}) as unknown[];
    expect(out.join("")).toBe("New here? <signup>Create an account</signup>");
  });
});
