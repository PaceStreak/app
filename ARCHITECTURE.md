# Architecture

Nothing is implemented. This records the shape the code has to fit into and the
one decision that is still genuinely open.

## Why `app` is a separate host from `www`

It would be simpler to serve the product from `www.pacestreak.com/app`. It is
not done that way, for three reasons that are hard to retrofit:

1. **The marketing site must never depend on auth.** It is the page a stranger
   sees first. Keeping it a separate, fully static deployment means an outage
   in the product cannot take down the thing that explains the product — and
   that the status page can report on them independently.
2. **Caching policies are opposite.** Marketing pages want long-lived edge
   caching. Signed-in pages must never be cached at a shared edge; one leaked
   response is another user's training data. Separate hosts make that a
   property of the deployment rather than a per-route rule someone forgets.
3. **Indexing policies are opposite.** One must be crawled, the other must not.
   A single origin serving both invites exactly one mistake in `robots.txt`.

The cost is a second Pages project and a shared-domain cookie. That is the
trade, and it is accepted.

## Request path

```text
browser
  ├── app.pacestreak.com   Cloudflare Pages  →  static build of this repo
  └── api.pacestreak.com   (unbuilt)         →  data, sessions
```

The app talks only to the API. It has no server of its own; anything that needs
a secret belongs in the API, not in a Pages Function here. If that stops being
true, that is an architecture change and belongs in a pull request that says so.

## The open decision

**Rendering strategy is not decided.** The rest of the organization is static
Astro, which suits a marketing site and a blog. This is an application, and the
trade is real:

| | Static SPA shell | Server-rendered |
| --- | --- | --- |
| Hosting | Pages, no runtime | Pages Functions or Workers |
| First paint when signed in | Blank until data loads | Content immediately |
| Auth handling | Client redirects after a failed call | Redirect before render |
| Cache safety | Trivial — the shell holds no user data | Must set `Cache-Control: private` correctly, every route |
| Fits existing tooling | Yes | Adds a runtime to operate |

The default, absent a reason, is **the static shell**: it keeps this repository
in the same operational shape as the others, and the cache-safety row is not a
small consideration when the payload is personal health data.

Whichever is chosen, record it in [CHANGELOG.md](./CHANGELOG.md) and in
[`PaceStreak/infra`](https://github.com/PaceStreak/infra)'s `DECISIONS.md`,
because it determines what the Pages project is allowed to run.

## Things that are decided

- **Cloudflare Pages, Git-connected.** Push to `main` deploys. No deploy
  workflow, no API token in this repository.
- **No third-party scripts.** The CSP is `default-src 'self'`, and it stays
  that way. No analytics CDN, no font CDN, no widget. Vendor what you need.
- **Assets are content-hashed by the build.** Do not hand-roll cache busting —
  it was tried on the marketing site and shipping new markup against a stale
  cached stylesheet is how that ends.
- **If Astro: `assetsInlineLimit: 0` is load-bearing.** Vite inlines small
  assets as `data:` URIs and Astro inlines small `<script>` blocks. The CSP
  blocks both, silently.
- **Motion is opt-out.** Everything animated sits behind
  `prefers-reduced-motion`, and the settled state is the correct one.

## What this repository does not own

- Sessions, tokens and password handling — those are the API's.
- DNS and Cloudflare configuration — those are
  [`infra`](https://github.com/PaceStreak/infra)'s.
- Uptime checks — those are
  [`status`](https://github.com/PaceStreak/status)'s, and this host should be
  added there once it responds.
