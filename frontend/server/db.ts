import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";

export type Row = Record<string, any>;
export interface DB { query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]> }
const schema = [
  `CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')), created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('conversation','lesson','roadmap','quiz','document')), title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(id,user_id))`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, resource_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(resource_id,user_id) REFERENCES resources(id,user_id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, user_id TEXT NOT NULL, answers TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(quiz_id,user_id) REFERENCES resources(id,user_id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, target TEXT NOT NULL, completed_at TEXT NOT NULL, PRIMARY KEY(user_id,target))`,
  `CREATE TABLE IF NOT EXISTS bookmarks (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, resource_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,resource_id), FOREIGN KEY(resource_id,user_id) REFERENCES resources(id,user_id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')), created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, used INTEGER NOT NULL CHECK(used >= 0))`,
  `CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','complete','failed')), result TEXT, started_at BIGINT NOT NULL, UNIQUE(user_id,request_id))`,
  `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, capability TEXT NOT NULL, status TEXT NOT NULL, model TEXT NOT NULL, duration_ms INTEGER NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS resources_owner_kind ON resources(user_id,kind,updated_at)`,
  `CREATE INDEX IF NOT EXISTS messages_owner_resource ON messages(user_id,resource_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)`,
  `CREATE INDEX IF NOT EXISTS jobs_user_status ON jobs(user_id,status,started_at)`,
  `CREATE INDEX IF NOT EXISTS attempts_owner ON attempts(user_id,created_at)`,
];
type State = { pool?: Pool; sqlite?: any; ready?: Promise<void>; queue: Promise<unknown> };
const globalDB = globalThis as typeof globalThis & { smitDB?: State };
const state: State = globalDB.smitDB ??= { queue: Promise.resolve() };
async function connect(): Promise<DB> {
  if (process.env.DATABASE_URL) {
    state.pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 8000, idleTimeoutMillis: 10000 });
    return { query: async (sql, params = []) => { let i=0; return (await state.pool!.query(sql.replace(/\?/g, () => `$${++i}`), params)).rows; } };
  }
  if (process.env.VERCEL || (process.env.NODE_ENV === "production" && !process.env.ALLOW_LOCAL_DATABASE)) throw new Error("Production database is not configured");
  if (!state.sqlite) {
    const path = resolve(/* turbopackIgnore: true */ process.env.LOCAL_DATABASE_PATH || ".data/learning.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    const { DatabaseSync } = await import("node:sqlite");
    state.sqlite = new DatabaseSync(path);
    state.sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  }
  return { query: async (sql, params = []) => state.sqlite.prepare(sql).all(...params) };
}
async function rawTransaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
  const base = await connect();
  if (state.pool) {
    const client = await state.pool.connect();
    const db: DB = { query: async (sql, params = []) => { let i=0; return (await client.query(sql.replace(/\?/g, () => `$${++i}`), params)).rows; } };
    try { await client.query("BEGIN"); const value=await fn(db); await client.query("COMMIT"); return value; }
    catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  }
  const job = state.queue.then(async () => {
    await base.query("BEGIN IMMEDIATE");
    try { const value=await fn(base); await base.query("COMMIT"); return value; }
    catch(e) { await base.query("ROLLBACK"); throw e; }
  });
  state.queue = job.catch(() => {});
  return job;
}
export async function migrate() {
  state.ready ??= rawTransaction(async db => {
    if (state.pool) await db.query("SELECT pg_advisory_xact_lock(827361)");
    for (const sql of schema) await db.query(sql);
    await db.query("INSERT INTO migrations(version,applied_at) VALUES(1,?) ON CONFLICT(version) DO NOTHING", [new Date().toISOString()]);
  }).catch(e => { state.ready=undefined; throw e; });
  return state.ready;
}
export async function transaction<T>(fn: (db: DB) => Promise<T>) { await migrate(); return rawTransaction(fn); }
export async function query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  await migrate();
  // Serialize local reads too: never observe another asynchronous transaction's uncommitted state.
  if (!state.pool) return rawTransaction(db => db.query<T>(sql, params));
  return (await connect()).query<T>(sql, params);
}
export async function closeDB() { await state.queue; await state.pool?.end(); state.sqlite?.close(); state.pool=undefined; state.sqlite=undefined; state.ready=undefined; }
