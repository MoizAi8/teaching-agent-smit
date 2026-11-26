# Data model

Schema version 1 lives in frontend/server/db.ts. Tables: migrations, users, sessions, resources, messages, attempts, progress, bookmarks, inquiries, limits, jobs, events. A resource is an owned conversation, lesson, roadmap, quiz or text document. Validated structured learning bodies are stored as JSON text for portable PostgreSQL/SQLite support.

Composite (resource_id,user_id) foreign keys on messages, attempts and bookmarks prevent cross-account associations. Sessions store token hashes and expirations. Users have unique normalized emails and scrypt password hashes. Resource deletion cascades associated messages/attempts/bookmarks; progress is deleted transactionally. Queries are parameterized; list APIs are bounded. PostgreSQL migration uses an advisory lock; SQLite operations serialize through a transaction queue. Version 1 is additive and repeat-safe.

Legacy backend/data is preserved; its records have no verified user owner and are not automatically imported. Production migration/rollback and PostgreSQL concurrency still require live verification. Backup the dedicated database before future migrations.
