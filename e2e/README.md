# End-to-end tests

A real browser (Playwright, phone-sized) against this app's production build
and a real API, Postgres and Redis. CI runs them on every push
(`.github/workflows/ci.yml`, job `e2e`).

Locally, start the API with Cloudflare's always-pass Turnstile test key and
printed email, then run the tests:

```bash
cd ../api && TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA \
  RATE_LIMIT_SIGNUP=100/minute RATE_LIMIT_LOGIN=100/minute RATE_LIMIT_MFA_VERIFY=100/minute \
  EMAIL_BACKEND=console docker compose up -d api
cd ../app && npx playwright install chromium && npx playwright test
```

Verification codes are read from `docker compose logs api` (or the file in
`E2E_API_LOG`). Afterwards, `docker compose up -d api` in `api` restores your
own `.env` settings.

Each test makes its own throwaway account. Offline is simulated by failing
every request to the API, because Playwright's `setOffline` also cuts the
service worker off from its own cache, which no real phone does.

## Email on and off

The specs read the API's public `GET /v1/config` and follow its
`email_enabled` (the API's `EMAIL_ENABLED`). Off, as in production, accounts
start with recovery codes and the email-off specs run; on, verification and
reset codes are read from the API log and the emailed-code specs run. Each
spec that needs one mode is skipped in the other. To cover both, run the suite
twice against `wrangler dev` with `EMAIL_ENABLED=0` and `EMAIL_ENABLED=1`
(free port, `IP_LIMITS_OFF=1`, Turnstile secret
`1x0000000000000000000000000000000AA`, and `E2E_API_ORIGIN`, `E2E_API`,
`E2E_API_LOG` pointing at it).
