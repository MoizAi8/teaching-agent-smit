import { randomBytes, scrypt, timingSafeEqual, createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { query, transaction, DB } from "./db";
import { AppError } from "./contracts";
export const COOKIE = "smit_session";
export const hash = (value:string)=>createHash("sha256").update(value).digest("hex");
const derive=promisify(scrypt);
export async function passwordHash(password:string) { const salt=randomBytes(16).toString("hex"); const key=await derive(password,salt,64) as Buffer; return `${salt}:${key.toString("hex")}`; }
export async function passwordValid(password:string, stored:string) { const [salt,hex]=stored.split(":"); const key=await derive(password,salt,64) as Buffer; const expected=Buffer.from(hex,"hex"); return key.length===expected.length&&timingSafeEqual(key,expected); }
export async function consume(db:DB,key:string,max:number) {
  await db.query("INSERT INTO limits(key,used) VALUES(?,0) ON CONFLICT(key) DO NOTHING",[key]);
  const rows=await db.query("UPDATE limits SET used=used+1 WHERE key=? AND used<? RETURNING used",[key,max]);
  if(!rows.length) throw new AppError(429,"rate_limit","Usage limit reached. Please try again later.");
}
export async function rateLimit(key:string,max:number,period=3600000) { await transaction(db=>consume(db,`${key}:${Math.floor(Date.now()/period)}`,max)); }
export type User={id:string;email:string;name:string;role:string};
export async function currentUser(req:Request):Promise<User|null> {
  const token=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  if(!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (await query<User>("SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",[hash(token),Date.now()]))[0]??null;
}
export async function requireUser(req:Request) { const user=await currentUser(req); if(!user) throw new AppError(401,"authentication","Sign in to continue."); return user; }
export async function createSession(userId:string) {
  const token=randomBytes(32).toString("hex");
  await transaction(async db=>{ await db.query("DELETE FROM sessions WHERE expires_at<?",[Date.now()]); await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",[hash(token),userId,Date.now()+7*86400000]); });
  return token;
}
export function sessionCookie(value:string,expired=false) { return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expired?0:604800}${process.env.NODE_ENV==="production"?"; Secure":""}`; }
export async function register(email:string,password:string,name:string) {
  const id=randomUUID(), digest=await passwordHash(password);
  try { await query("INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)",[id,email,name,digest,new Date().toISOString()]); }
  catch { throw new AppError(409,"registration","Unable to register with these details. Try signing in."); }
  return id;
}
