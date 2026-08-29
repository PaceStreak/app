# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository created to hold the signed-in product frontend for
  `app.pacestreak.com`, split from the marketing site at `www`.
- Documentation of the constraints that already bind this code before any of it
  exists: the shared-domain session cookie, the `default-src 'self'` CSP that
  will block the first API call, the `noindex` requirement, and the reason the
  DNS record must not be created ahead of a deployment.
- `ARCHITECTURE.md`, recording the rendering-strategy decision as explicitly
  open, with the trade-off table and the default if nobody argues otherwise.
