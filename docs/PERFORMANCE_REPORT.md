# Performance observations

Local Next dev ready in 599 ms after restart. Observed warm database-backed API requests typically 11–36 ms in development logs. Initial auth route compilation plus registration was about 1.2 s. Initial production compilation 4.2 s; subsequent compilation 1.51 s. These are environment-specific observations, not load benchmarks.

Real Gemini workflow timings ranged from 1.998 s to 10.057 s across seven calls. No before/after provider benchmark is claimed. Bounded queries/history/retrieval, pg pool max 4 and limited concurrent inference reduce resource consumption. Long conversation rendering and full load tests remain pending.
