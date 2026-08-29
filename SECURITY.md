# Security Policy

## Reporting

**Do not open a public issue.** Email **<hello@pacestreak.com>** with what you
found, how to reproduce it, and the impact. You will get an acknowledgement
within 72 hours. There is no bug bounty; what you will get is a straight answer.

This file exists per-repository because community health files in a **public**
`.github` repository do not apply to **private** ones, and this repository is
private.

## Scope

Once this exists, it is the surface every user touches while authenticated.

| In scope | Out of scope |
| --- | --- |
| Session handling and anything that exposes the auth cookie | Cloudflare and GitHub infrastructure |
| XSS, and any CSP bypass | Findings with no demonstrated impact |
| Rendering another user's data | Missing headers with no exploit path |
| Signed-in responses reaching a shared cache | Social engineering |
| Clickjacking or framing of authenticated views | Denial of service |

Server-side issues — authorization, injection, data access — belong to
[`PaceStreak/api`](https://github.com/PaceStreak/api). Report them the same way;
the address is the same.

## Known and deliberate

- **The session cookie is scoped to the whole registrable domain**
  (`Domain=pacestreak.com`). It has to be: this app and the API are on
  different subdomains. The mitigation is that nothing untrusted is ever hosted
  under `pacestreak.com` — if you find something that is, *that* is the report
  worth sending.
- **`SameSite=Lax`, not `None`.** The two hosts are same-site, so `Lax` is
  sufficient and narrower.
- **`default-src 'self'` with no `'unsafe-inline'`.** This is load-bearing, not
  defence in depth. Any change that loosens it is a security change and is
  reviewed as one.
