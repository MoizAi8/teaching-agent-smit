# Initial audit — 2026-11-25

Verified personal public main at 34e8f16dcdc6f28d4d3e7ba91e8c48fe33abb2bc. Clean starting tree, 41 files, original remote preserved. User confirmed publication permission. Recovery branch created before modifications.

## Confirmed findings

| Severity | Evidence | Consequence |
|---|---|---|
| Critical | Legacy history/ingest APIs have no authentication or owner checks | Student history and shared documents are exposed to API clients |
| High | MockProvider is default and silent fallback | Tutor can appear intelligent while returning prerecorded text |
| High | Provider exception string sent to browser | May expose provider internals or credential-bearing errors |
| High | No quotas, bounded inference output, or request concurrency enforcement | Unbounded resource consumption |
| High | Static export plus localhost API URL | Hosted frontend cannot function independently |
| High | No account/session schema | Reported login-refresh defect is not reproducible: login does not exist |
| Medium | Client supplies conversation context; SQLite stores session strings without ownership | Persistence is not authenticated and history is not loaded by UI |
| Medium | Hash embeddings in shared Chroma | Not semantic embedding inference; unsuitable for private RAG |
| Medium | No tests, migration management, courses, lessons, assessments, inquiry or search | Requested workflows absent |

Existing interface launched at localhost:3000 and inspected in browser: two-panel tutor/Code Lab. Existing Python heuristic code analysis is preserved. Legacy SQLite and Chroma data retained untouched. Backend startup is initially blocked by unavailable Python launcher; existing source inspected directly. No claim of testing legacy runtime.

## Architecture decision

Extend existing Next.js application with same-origin server APIs. Preserve legacy source without exposing it. Node 24 supports local SQLite development; production requires PostgreSQL and refuses ephemeral local database fallback. Shared Gemini provider, structured validation, database-backed sessions/ownership/quotas. No paid services.
