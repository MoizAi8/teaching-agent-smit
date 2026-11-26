# Verification — 2026-11-26

## Final QA regression

- 216 distinct automated scenarios passed with the expanded integration suite on SQLite. All 216 passed again with 126 integration cases switched to a separate PostgreSQL 17 database. These are two engine runs of the same scenario matrix.
- The temporary PostgreSQL cluster used loopback and synthetic accounts. Verified composite foreign keys for messages, attempts and bookmarks, email uniqueness, rollback, repeat-safe migration after reconnect, cross-user API isolation, and 16 parallel reservations with exactly three accepted.
- Mocked Gemini verified routing, persistence, retrieval inputs, duplicate single-call behavior, deleted-resource replay denial, provider failures, quota rollback and structured outputs. Automated regression consumed zero live AI requests.
- The release candidate fixes resource path suffix handling, deletion racing with progress updates, replay of deleted AI results, and whitespace-only quiz fields.
- Run `npm test` from `frontend/` for SQLite. To exercise PostgreSQL, start a disposable local cluster and create database `smit_release_qa` with user `smit_qa`, then set `SMIT_QA_POSTGRES_URL` for the test process. The test harness rejects other database names, users and non-loopback hosts. Keep credentials outside source control.

## Earlier verification

- TypeScript check: PASS.
- Automated test runner: 14 passed, 0 failed, isolated SQLite. Includes multiple assertions for session persistence, two-user isolation, composite FK integrity, rollback, repeat-safe migration, concurrent quota reservation, origin validation, protected administration, quiz answer concealment/scoring, document type validation and input boundaries. This is not 250–300 tests.
- Production build: PASS before final documentation checkpoint; repeat result recorded in PROGRESS.
- npm audit production dependencies: 0 known vulnerabilities following security updates.
- Genuine Gemini smoke: beginner variable explanation passed (3,248 ms).
- Seven real provider workflows passed structured-output/persistence/isolation checks: tutor 4,707 ms; coding 10,057 ms; lesson 1,998 ms; quiz 2,341 ms; roadmap 4,707 ms; inquiry 5,454 ms; Roman Urdu tutor 6,085 ms. These checks are not comprehensive pedagogical quality evaluations.
- Browser: registration, authenticated dashboard, genuine tutor response and refresh persistence passed on localhost. Desktop landing and dashboard screenshots inspected; dashboard sizes 1920×1080, 1440×900, 1366×768, 768×1024, 390×844, 360×640. A mobile hidden-sidebar focus issue was fixed; all-screen visual regression remains incomplete.
- PostgreSQL migrations/concurrency, hosted workflows, expanded security/AI quality matrix, every feature's browser interaction, light theme and accessibility audit: NOT TESTED or BLOCKED on infrastructure.
