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

import { CATALOGS } from "./i18n";

describe("catalogs", () => {
  const shape = (m: unknown) => {
    const text = typeof m === "string" ? m : Object.values(m as Record<string, string>).join(" ");
    return {
      vars: [...new Set(text.match(/\{\w+\}/g) ?? [])].sort(),
      tags: [...new Set(text.match(/<\/?\w+>/g) ?? [])].sort(),
    };
  };
  for (const [lang, catalog] of Object.entries(CATALOGS)) {
    if (lang === "en") continue;
    it(`${lang} keeps every placeholder and link tag, and invents no keys`, () => {
      for (const [key, message] of Object.entries(catalog)) {
        const english = CATALOGS.en[key as keyof typeof CATALOGS.en];
        expect(english, `${lang}: unknown key ${key}`).toBeDefined();
        expect(shape(message), `${lang}: ${key}`).toEqual(shape(english));
      }
    });
    it(`${lang} translates everything the English catalog has`, () => {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(CATALOGS.en).sort());
    });
  }
});
