import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Screens already moved to the catalog stay there. A hard-coded English
 * string in one of these files is a string a future translation silently
 * misses, so the build fails instead.
 */
const MIGRATED = [
  "src/routes/auth/Login.tsx",
  "src/routes/auth/Signup.tsx",
  "src/routes/auth/ForgotPassword.tsx",
  "src/routes/auth/ResetPassword.tsx",
  "src/routes/auth/VerifyEmail.tsx",
  "src/routes/auth/Unsubscribe.tsx",
  "src/routes/auth/AuthLayout.tsx",
  "src/routes/auth/Recover.tsx",
  "src/routes/auth/ConfirmEmail.tsx",
  "src/components/TermsGate.tsx",
];

// Brand and product names are not translated.
const ALLOWED = new Set(["PaceStreak"]);

function offenders(source: string): string[] {
  const found: string[] = [];
  // JSX text between tags: >Some words<
  for (const m of source.matchAll(/>\s*([A-Za-z][^<>{}]*[A-Za-z.!?…])\s*</g)) {
    if (!ALLOWED.has(m[1].trim())) found.push(m[1].trim());
  }
  // Visible props given a literal: title="Words", label="Words", etc.
  for (const m of source.matchAll(/\b(title|subtitle|label|hint|placeholder|error|aria-label)="([^"]*[A-Za-z]{2}[^"]*)"/g)) {
    found.push(`${m[1]}="${m[2]}"`);
  }
  return found;
}

describe("translation guard", () => {
  for (const file of MIGRATED) {
    it(`${file} has no hard-coded text`, () => {
      expect(offenders(readFileSync(file, "utf8"))).toEqual([]);
    });
  }
});
