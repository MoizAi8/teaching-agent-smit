# Deployment

Dedicated Vercel project: teaching-agent-smit in abdul-moiz-ali-s-projects. Created and locally linked; not yet deployed. Root directory for deployment is frontend/. Existing unrelated projects were untouched. Use Node 24, Next.js framework, npm build.

Production variables: GEMINI_API_KEY (Sensitive), DATABASE_URL (Sensitive, dedicated PostgreSQL with TLS), GEMINI_MODEL=gemini-3.5-flash-lite, APP_ORIGIN=actual production origin, AI_USER_DAILY_LIMIT=20, AI_GLOBAL_DAILY_LIMIT=100. Never configure ALLOW_LOCAL_DATABASE on Vercel. No localhost dependency in the new UI/API.

The existing Vercel installation uses `Gemini_API_key`. The server accepts this spelling as a fallback and prefers `GEMINI_API_KEY` when both are present. The model and quota variables have the defaults shown above.

Provision a dedicated Neon free-tier database, configure credentials manually, then run the additive schema migration and verify PostgreSQL semantics. First production request also performs repeat-safe schema initialization. Do not enable paid billing. No existing application's credentials may be copied without permission.

Deploy only after the hosted database is configured. Verify registration, authentication refresh, tutoring/follow-up, lessons, quiz scoring/history, search, ownership and quotas against the actual deployed URL. Production settings still await manual configuration.
