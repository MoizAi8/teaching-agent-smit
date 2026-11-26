# Security status

Initial legacy findings are in AUDIT_REPORT. New production path adds scrypt passwords, random hashed seven-day sessions, HttpOnly/SameSite cookies (Secure in production), same-origin mutation checks, parameterized SQL, ownership checks/FKs, protected admin endpoints, safe validation/provider errors, bounded JSON and document input, AI quotas and pending-job limits. Markdown does not enable raw HTML. Student code is never executed. Text-only documents are limited to 80 KB by UI and 80,000 characters by server plus 120 KB request cap.

Dependency audit after upgrades: zero production findings. Credentials, local DBs, build output and deployment metadata are ignored. Build tracing and Vercel upload exclusions protect local configuration/data. No paid billing enabled.

Limitations: no email verification/reset, CAPTCHA, password change, account deletion/retention automation, full CSP, independent penetration test or comprehensive prompt-injection evaluation. Auth limits are global/account-based, not a complete anti-abuse system. No public guest inference. Do not claim commercial production readiness.
