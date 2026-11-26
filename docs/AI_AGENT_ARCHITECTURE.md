# AI architecture

Verified provider: Google Gemini, gemini-3.5-flash-lite. One shared generateContent integration routes an explicit validated capability to tutor, coding, lesson, quiz, roadmap or inquiry instructions. These are distinct prompt/validation responsibilities, not six model deployments. No fabricated reasoning traces or agent executions.

Context includes at most 12 recent messages (each bounded to 8,000 characters) and at most three keyword-ranked document excerpts of 4,000 characters. Retrieval is lexical over the latest 50 owned documents; no semantic embeddings. Sources passed to the model are displayed as references, not guaranteed citations.

Lessons, quizzes and roadmaps are validated against Zod contracts before persistence. Quiz answer keys stay server-side until submission; scoring is deterministic. Timeouts: 45 seconds. Output cap: 4,096 tokens. No automatic retries multiply model cost. Daily database counters cap global and per-user requests; pending jobs enforce one request per user and at most five globally. Failed requests consume quota. Client request IDs deduplicate completed calls. Actual events contain capability/status/model/duration, not prompts or credentials.

Provider failures return safe errors. No mock inference exists in the new server path. Streaming, cancellation and automated response regeneration remain unimplemented.
