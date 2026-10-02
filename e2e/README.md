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
