# Deployment

The dedicated Vercel project is `teaching-agent-smit` under `abdul-moiz-ali-s-projects`. Deploy from `frontend/` with `vercel deploy --prod`. The public production origin is `https://teaching-agent-smit-livid.vercel.app`. See [hosted release evidence](HOSTED_RELEASE.md).

Production variables: GEMINI_API_KEY (Sensitive), DATABASE_URL (Sensitive, dedicated PostgreSQL with TLS), GEMINI_MODEL=gemini-3.5-flash-lite, APP_ORIGIN=actual production origin, AI_USER_DAILY_LIMIT=20, AI_GLOBAL_DAILY_LIMIT=100. Never configure ALLOW_LOCAL_DATABASE on Vercel. No localhost dependency in the new UI/API.

The existing Vercel installation uses `Gemini_API_key`. The server accepts this spelling as a fallback and prefers `GEMINI_API_KEY` when both are present. The model and quota variables have the defaults shown above.

Provision a dedicated Neon free-tier database, configure credentials manually, then run the additive schema migration and verify PostgreSQL semantics. First production request also performs repeat-safe schema initialization. Do not enable paid billing. No existing application's credentials may be copied without permission.

After deployment, run `npx tsx scripts/verify-hosted.ts https://teaching-agent-smit-livid.vercel.app` from `frontend/`. This creates two synthetic accounts and consumes seven Gemini requests. It prints a status summary without credentials or response bodies.
