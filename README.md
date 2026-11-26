# Teaching Agent SMIT 2.0

An independent AI-powered education portfolio, extending the original [Moldrivo Teaching Agent SMIT](https://github.com/moldrivo/Teaching-Agent-SMIT). No official SMIT or Saylani endorsement. Original contributor history is preserved; no new project license has been invented.

**Status: local implementation checkpoint, not a verified hosted release.** See [release gates](docs/HOSTED_RELEASE.md) and [remaining work](docs/KNOWN_LIMITATIONS.md).

## Current implementation

Next.js 16 / React 19 / TypeScript / Node 24 serve the interface and same-origin APIs. Google Gemini `gemini-3.5-flash-lite` performs genuine inference. PostgreSQL is the required hosted database; SQLite supports local development and isolated tests. Legacy FastAPI source and data are preserved but are not exposed by the new application.

Features include authenticated tutoring and coding guidance, persistent conversations, validated lessons/MCQ quizzes/roadmaps, server-side scoring, progress, bookmarks, owned search, text-document lexical retrieval, authenticated inquiries, and protected operational administration. The responsive landing page identifies illustrative content explicitly. No student code execution or prerecorded fallback inference.

## Local setup

Use Node 24. In `frontend/`, run `npm ci`. Copy `.env.example` to ignored `.env.development.local`, enter an authorized Gemini key privately, then run `npm run dev`. Empty DATABASE_URL uses a new local database in `frontend/.data/`; legacy data is untouched. Use a dedicated PostgreSQL URL for hosted operation. Never commit secrets.

Checks: `npm run typecheck`, `npm test`, `npm run build`. Genuine bounded AI checks: `npm run ai:verify` and `npx tsx scripts/verify-workflows.ts`. These consume model quota. `npm run db:migrate` applies additive schema version 1 to the configured database. Do not point destructive tests at production.

## Evidence and limits

14 isolated automated tests passed. Seven genuine model workflows passed structural/persistence/isolation checks; these are not a comprehensive AI quality evaluation. Browser registration, a fresh tutor answer and refresh persistence were verified locally. Dashboard layouts were inspected at six sizes. Production dependency audit reported zero findings. [Detailed results](docs/TEST_RESULTS.md).

Hosted PostgreSQL and production secrets remain unconfigured; no working hosted URL is claimed. Full requested regression coverage, advanced workflows and all-screen accessibility/visual QA remain incomplete. [Deployment instructions](docs/DEPLOYMENT.md).

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) · [AI orchestration](docs/AI_AGENT_ARCHITECTURE.md) · [Security](docs/SECURITY_AUDIT.md) · [Audit](docs/AUDIT_REPORT.md) · [Progress](PROGRESS.md) · [Original setup](docs/LEGACY_SETUP.md)
