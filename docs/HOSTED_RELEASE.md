# Hosted release gates

The [production release](https://teaching-agent-smit-livid.vercel.app) is live. Deployed application commit `da18dd8e4d5cd022bfd6286701efc15dd1760a78`. The database is the dedicated Neon Free project `teaching-agent-smit-db`.

Local PASS: genuine Gemini invocation; validated structured learning outputs; isolated SQLite ownership/rollback/quota tests; browser registration/session refresh/conversation persistence; production build.

Production API smoke passed with two synthetic accounts and seven Gemini calls to `gemini-3.5-flash-lite`. It covered PostgreSQL schema initialization, registration, logout/login, persisted sessions, admin denial, cross-user resource and search isolation, grounded tutoring and follow-up, lesson progress and bookmarks, quiz answer concealment and scoring, roadmap retrieval, coding, and inquiry submission.

Production browser checks passed for public topic search, the support launcher, sign-in navigation, and landing width at 390 px. Browser verification of authenticated learning screens is separate from the API results.

Remaining coverage includes direct PostgreSQL constraint and concurrency tests, the full browser regression matrix, accessibility, and performance testing. See [known limitations](KNOWN_LIMITATIONS.md).
