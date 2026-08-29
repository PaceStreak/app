# Contributing

See the [organization guide](https://github.com/PaceStreak/.github/blob/main/CONTRIBUTING.md)
for anything general. This file covers what is specific to the app.

## Before you start

**Open an issue first.** There is no code here yet, so any pull request is
effectively a proposal about the stack and the rendering strategy. That is a
conversation, not a diff — see
[ARCHITECTURE.md](./ARCHITECTURE.md#the-open-decision).

## Non-negotiables

These come from decisions made elsewhere and will fail review if broken:

- **No third-party origins.** The CSP is `default-src 'self'`. No font CDN, no
  analytics, no embedded widget. If you need a dependency, vendor it.
- **No inline scripts or styles.** There is no `'unsafe-inline'`, so they are
  blocked by the browser with nothing visible on the page. If a build tool
  inlines something for you, turn that off rather than loosening the policy.
- **No user data in a shared cache.** Signed-in responses are
  `Cache-Control: private, no-store`. A single leaked response is somebody
  else's health data.
- **`robots.txt` disallows everything, plus a `noindex` header.** This app is
  behind a login. Do not copy the marketing site's `robots.txt` here.
- **A real `404.html` must be emitted.** Without it Cloudflare Pages returns
  `index.html` with a **200** for every unknown path, including `/robots.txt`.
- **Auth cookies:** `__Secure-` prefix, `HttpOnly`, `Secure`, `SameSite=Lax`,
  `Domain=pacestreak.com`. Not `__Host-` — it forbids `Domain`, which this
  setup requires.

## Accessibility and responsiveness are review criteria

The marketing site went through several rounds of this and the conclusions
carry over:

- Text must meet **WCAG AA** contrast against its actual background, not
  against the page background. Measure it; muted greys that look fine are
  routinely around 4.0:1 and fail.
- Layouts must work from **320px to 1920px**. Test the narrow end — it is
  where things break, and it is where phones are.
- Everything animated is behind `prefers-reduced-motion`.
- Keyboard focus must be visible, and a skip link must reach the main content.

## When you wire the first API call

Do this in the same pull request, or it breaks silently:

1. Add `https://api.pacestreak.com` to `connect-src` in `public/_headers`.
2. Handle the unauthenticated case explicitly. A failed `fetch` in a static
   shell is indistinguishable from "logged out" unless you make it so.

## When this host first responds

Register `app.pacestreak.com` in
[`PaceStreak/status`](https://github.com/PaceStreak/status) with a body content
assertion. A 200 alone does not prove the app works — a broken build still
returns 200 with an empty shell.

## Commits

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). The
subject line says what changed; the body says **why**, because the what is
already in the diff.

## Security

Do not open an issue for a vulnerability. Email **<hello@pacestreak.com>** —
see [SECURITY.md](./SECURITY.md).
