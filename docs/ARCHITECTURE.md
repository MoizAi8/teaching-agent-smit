# Architecture

Next.js 16 App Router / React 19 / Node 24 serve the existing frontend and same-origin /api/v2 APIs. Server modules separate database access, authentication, contracts, provider and learning orchestration. PostgreSQL via pg is required on Vercel. Node SQLite is a local development/testing adapter only. Legacy FastAPI code remains preserved, disconnected from the new UI.

Request path: JSON size/content validation → same-origin check for mutations → database session authentication → ownership/role validation → transaction and/or bounded Gemini invocation → safe response. There are no model-triggered privileged tools or student code execution.

Production DB URLs and Gemini key are server-only variables. Dynamic route results have no-store cache headers. See DATA_MODEL and AI_AGENT_ARCHITECTURE for boundaries.
