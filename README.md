# PaceStreak App

The product itself — the signed-in frontend of
[PaceStreak](https://www.pacestreak.com), a workout streak tracker. Will be
served from **`app.pacestreak.com`**.

**Nothing is built here yet.** This repository exists so the decisions below are
recorded before code is written, rather than rediscovered afterwards.

Copyright (c) 2026 PaceStreak. Licensed under [AGPL-3.0](./LICENSE) — anyone
running a modified version of this over a network must offer its source to
their users.

## Where this sits

| Hostname | Repository | What it is |
| --- | --- | --- |
| `www.pacestreak.com` | [`web`](https://github.com/PaceStreak/web) | Marketing site. Public, no login, indexed. |
| `app.pacestreak.com` | **this repository** | The product. Requires an account. Not indexed. |
| `api.pacestreak.com` | [`api`](https://github.com/PaceStreak/api) | Backend. |
| `blog.pacestreak.com` | [`blog`](https://github.com/PaceStreak/blog) | Build log. |

The split is deliberate: the marketing site must stay fast, static and
cacheable, and must never grow an auth dependency. Everything stateful lives
here. See [ARCHITECTURE.md](./ARCHITECTURE.md) for why that boundary is worth
the extra hostname.

## Status

| | |
| --- | --- |
| Stack | Undecided — see [ARCHITECTURE.md](./ARCHITECTURE.md#the-open-decision) |
| Hostname | `app.pacestreak.com` — **no DNS record yet, deliberately** |
| Depends on | `PaceStreak/api`, which is also unbuilt |
| Hosting | Cloudflare Pages, Git-connected, like every other site here |

## Constraints already settled

These are not suggestions. Each one is either load-bearing for another
repository or was learned by breaking something.

### Do not create the DNS record before there is a deployment

A proxied Cloudflare record with nothing behind it returns **`522`**, which is
strictly worse than the hostname not existing. Before, `app.pacestreak.com`
does not resolve; after, it serves a Cloudflare error page that reads to a
visitor as "this product is broken".

Attach the custom domain to the Pages project **first**, and let Cloudflare
create the record. Do not hand-write it in the DNS tab.

### The session cookie is shared with every other subdomain

The auth cookie is scoped `Domain=pacestreak.com` so that it reaches
`api.pacestreak.com`. That means this app, the marketing site, the blog and the
status page all sit inside one trust boundary.

- Nothing untrusted may ever be hosted under `pacestreak.com` — no
  user-generated subdomains, no third-party tooling on a vanity host.
- Use the `__Secure-` prefix, not `__Host-`. `__Host-` forbids a `Domain`
  attribute, which this setup requires.
- `SameSite=Lax` is sufficient. This app and the API are *same-site* (shared
  registrable domain) even though they are cross-origin. Reaching for
  `SameSite=None` would widen exposure for nothing.

### The CSP will block the first call to the API

Every site in this organization ships `default-src 'self'`. The first `fetch()`
to `api.pacestreak.com` will be blocked by the browser, and the page sees only
a failed request — no visible error, no console entry a user would report.

Whoever writes that call adds `connect-src 'self' https://api.pacestreak.com`
to `public/_headers` **in the same commit**.

### This app must not be indexed

It is behind a login; indexing it produces search results that lead to a login
wall. Ship `robots.txt` with `Disallow: /` *and* a `noindex` header — the
`robots.txt` prevents crawling, the header prevents indexing of URLs discovered
by other means.

The marketing site is the opposite: it must be indexed, and its
`robots.txt` allows everything. Do not copy one repository's file into the
other.

### Ship a real 404 page

Cloudflare Pages answers unknown paths with `index.html` and a **200** unless
the build emits `404.html`. On the blog, before that page existed,
`/robots.txt` returned the site's HTML and Cloudflare appended it to its own
content-signals policy — crawlers were handed a robots.txt with a full HTML
document inside it. A single-page app makes this worse, not better, because
every path legitimately renders the shell.

### Export is a launch requirement

The marketing site promises *"full JSON and CSV export from day one."* That is a
product commitment, and it needs UI here, not just an endpoint in the API.

## Local development

Nothing to run yet. When there is, this section documents the one command that
starts it and the one that runs the tests. Anything longer than that is a bug in
the setup.

## Deploying

Push to `main`. The Cloudflare Pages project builds from this repository via
Cloudflare's GitHub integration — there is no deploy workflow and no API token
to manage. CI here exists to fail a pull request before it reaches `main`, not
to deploy.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the pieces fit and why
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to work on this
- [SECURITY.md](./SECURITY.md) — reporting a vulnerability
- [CHANGELOG.md](./CHANGELOG.md) — what changed
- [Infrastructure](https://github.com/PaceStreak/infra) — DNS, Cloudflare, runbooks
