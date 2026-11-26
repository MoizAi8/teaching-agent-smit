import { z, ZodError } from "zod";
import { randomUUID } from "node:crypto";
import { query, transaction } from "@/server/db";
import { currentUser, requireUser, register, passwordValid, passwordHash, createSession, sessionCookie, rateLimit, hash, COOKIE } from "@/server/auth";
import { AppError, aiInput, text, scoreQuiz, quiz } from "@/server/contracts";
import { owned, visibleResource, learn } from "@/server/learning";
import { isGeminiConfigured } from "@/server/provider";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const idSchema=z.string().uuid();
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{"Cache-Control":"no-store",...headers}});
const now=()=>new Date().toISOString();
async function body(req:Request) {
  if(!req.headers.get("content-type")?.startsWith("application/json")) throw new AppError(415,"content_type","Use JSON input.");
  const reader=req.body?.getReader(); if(!reader) throw new AppError(400,"input","Missing request body.");
  const chunks:Uint8Array[]=[]; let length=0;
  while(true) { const {done,value}=await reader.read(); if(done)break; length+=value.length; if(length>120000){await reader.cancel();throw new AppError(413,"size","Request is too large.");} chunks.push(value); }
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new AppError(400,"json","Invalid JSON.");}
}
async function handle(req:Request,ctx:{params:Promise<{path:string[]}>}) {
  try {
    const params=await ctx.params;
    const path=params.path.join("/"),method=req.method,url=new URL(req.url);
    if(method!=="GET") {
      const allowed=process.env.APP_ORIGIN||url.origin;
      if(req.headers.get("origin")!==allowed || req.headers.get("sec-fetch-site")==="cross-site") throw new AppError(403,"origin","Request origin is not allowed.");
    }
    if(path==="health"&&method==="GET") { await query("SELECT version FROM migrations LIMIT 1"); return json({status:"ok",aiConfigured:isGeminiConfigured(),database:process.env.DATABASE_URL?"postgresql":"local-sqlite"}); }
    if(path==="auth/me"&&method==="GET") return json({user:await currentUser(req)});
    if((path==="auth/register"||path==="auth/login")&&method==="POST") {
      await rateLimit("auth:global",200);
      const input=z.object({email:z.string().email().max(254).transform(x=>x.toLowerCase().trim()),password:z.string().min(12).max(128),name:z.string().trim().min(1).max(80).optional()}).parse(await body(req));
      await rateLimit(`auth:${hash(input.email)}`,10,900000);
      let id:string;
      if(path==="auth/register") id=await register(input.email,input.password,input.name||"Student");
      else {
        const u=(await query("SELECT id,password_hash FROM users WHERE email=?",[input.email]))[0];
        // Perform equivalent password derivation even for unknown accounts.
        const digest=u?.password_hash||`${"0".repeat(32)}:${"0".repeat(128)}`;
        if(!await passwordValid(input.password,digest)||!u) throw new AppError(401,"credentials","Email or password is incorrect.");
        id=u.id;
      }
      return json({ok:true},200,{"Set-Cookie":sessionCookie(await createSession(id))});
    }
    const user=await requireUser(req);
    if(path==="auth/logout"&&method==="POST") {
      const token=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1)||"";
      await query("DELETE FROM sessions WHERE token_hash=?",[hash(token)]); return json({ok:true},200,{"Set-Cookie":sessionCookie("",true)});
    }
    if(path==="account"&&method==="PATCH") { const input=z.object({name:z.string().trim().min(1).max(80)}).parse(await body(req)); await query("UPDATE users SET name=? WHERE id=?",[input.name,user.id]); return json({ok:true}); }
    if(path==="ai"&&method==="POST") return json(await learn(user.id,aiInput.parse(await body(req))));
    if(path==="resources"&&method==="GET") {
      const kind=z.enum(["conversation","lesson","roadmap","quiz","document"]).optional().parse(url.searchParams.get("kind")||undefined);
      const offset=z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get("offset")||0);
      return json(await query(`SELECT id,kind,title,created_at,updated_at FROM resources WHERE user_id=? ${kind?"AND kind=?":""} ORDER BY updated_at DESC LIMIT 50 OFFSET ?`,[user.id,...(kind?[kind]:[]),offset]));
    }
    if(path.startsWith("resources/")) {
      const id=idSchema.parse(params.path[1]),row=await owned(user.id,id);
      if(method==="GET") return json({...visibleResource(row),messages:row.kind==="conversation"?await query("SELECT id,role,content,created_at FROM messages WHERE resource_id=? AND user_id=? ORDER BY created_at,id LIMIT 200",[id,user.id]):[]});
      if(method==="PATCH") { const input=z.object({title:z.string().trim().min(1).max(150)}).parse(await body(req));await query("UPDATE resources SET title=?,updated_at=? WHERE id=? AND user_id=?",[input.title,now(),id,user.id]);return json({ok:true}); }
      if(method==="DELETE") { await transaction(async db=>{await db.query("DELETE FROM progress WHERE user_id=? AND (target=? OR target LIKE ?)",[user.id,id,`${id}:%`]); await db.query("DELETE FROM resources WHERE id=? AND user_id=?",[id,user.id]);});return json({ok:true}); }
    }
    if(path==="documents"&&method==="POST") {
      await rateLimit(`documents:${user.id}`,20,86400000);
      const input=z.object({title:z.string().trim().min(1).max(150),filename:z.string().max(200).regex(/\.(txt|md)$/i),text:z.string().trim().min(10).max(80000)}).parse(await body(req));
      if(input.text.includes("\u0000")) throw new AppError(400,"document","Only UTF-8 plain text or Markdown is supported.");
      const id=randomUUID();await query("INSERT INTO resources(id,user_id,kind,title,body,created_at,updated_at) VALUES(?,?,'document',?,?,?,?)",[id,user.id,input.title,JSON.stringify({text:input.text,filename:input.filename}),now(),now()]);return json({id},201);
    }
    if(path==="attempts"&&method==="POST") {
      const input=z.object({quizId:idSchema,answers:z.array(z.number().int()).min(1).max(10)}).parse(await body(req));
      const row=await owned(user.id,input.quizId);if(row.kind!=="quiz")throw new AppError(400,"resource_type","Choose a quiz.");
      const data=quiz.parse(JSON.parse(row.body)),score=scoreQuiz(data,input.answers),id=randomUUID();
      await query("INSERT INTO attempts(id,quiz_id,user_id,answers,score,total,created_at) VALUES(?,?,?,?,?,?,?)",[id,input.quizId,user.id,JSON.stringify(input.answers),score,data.questions.length,now()]);
      return json({id,score,total:data.questions.length,questions:data.questions});
    }
    if(path==="attempts"&&method==="GET") return json(await query("SELECT a.id,a.quiz_id,a.score,a.total,a.created_at,r.title FROM attempts a JOIN resources r ON a.quiz_id=r.id WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 100",[user.id]));
    if(path==="progress"&&method==="GET") return json(await query("SELECT target,completed_at FROM progress WHERE user_id=?",[user.id]));
    if(path==="progress"&&method==="POST") {
      const input=z.object({id:idSchema,stage:z.number().int().min(0).max(11).optional(),completed:z.boolean()}).parse(await body(req));
      const row=await owned(user.id,input.id);if(!["lesson","roadmap"].includes(row.kind))throw new AppError(400,"resource_type","Choose a lesson or roadmap.");
      if(row.kind==="roadmap"&&(input.stage===undefined||input.stage>=JSON.parse(row.body).stages.length))throw new AppError(400,"stage","Choose a valid stage.");
      if(row.kind==="lesson"&&input.stage!==undefined)throw new AppError(400,"stage","Lessons do not have roadmap stages.");
      const target=input.id+(input.stage!==undefined?`:${input.stage}`:"");
      if(input.completed)await query("INSERT INTO progress(user_id,target,completed_at) VALUES(?,?,?) ON CONFLICT(user_id,target) DO NOTHING",[user.id,target,now()]);else await query("DELETE FROM progress WHERE user_id=? AND target=?",[user.id,target]);return json({ok:true});
    }
    if(path==="bookmarks"&&method==="GET")return json(await query("SELECT r.id,r.kind,r.title FROM bookmarks b JOIN resources r ON r.id=b.resource_id AND r.user_id=b.user_id WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 100",[user.id]));
    if(path==="bookmarks"&&method==="POST") {const input=z.object({id:idSchema,saved:z.boolean()}).parse(await body(req));await owned(user.id,input.id);if(input.saved)await query("INSERT INTO bookmarks(user_id,resource_id,created_at) VALUES(?,?,?) ON CONFLICT(user_id,resource_id) DO NOTHING",[user.id,input.id,now()]);else await query("DELETE FROM bookmarks WHERE user_id=? AND resource_id=?",[user.id,input.id]);return json({ok:true});}
    if(path==="search"&&method==="GET") {
      const q=z.string().trim().min(2).max(100).parse(url.searchParams.get("q"));const pattern=`%${q.toLowerCase().replace(/[!%_]/g,"!$&")}%`;
      return json(await query("SELECT DISTINCT r.id,r.kind,r.title FROM resources r WHERE r.user_id=? AND (LOWER(r.title) LIKE ? ESCAPE '!' OR (r.kind <> 'quiz' AND LOWER(r.body) LIKE ? ESCAPE '!') OR EXISTS (SELECT 1 FROM messages m WHERE m.resource_id=r.id AND m.user_id=? AND LOWER(m.content) LIKE ? ESCAPE '!')) ORDER BY r.title LIMIT 30",[user.id,pattern,pattern,user.id,pattern]));
    }
    if(path==="dashboard"&&method==="GET") return json({resources:await query("SELECT kind,COUNT(*) AS count FROM resources WHERE user_id=? GROUP BY kind",[user.id]),completed:(await query("SELECT COUNT(*) AS count FROM progress WHERE user_id=?",[user.id]))[0].count,assessment:(await query("SELECT COUNT(*) AS attempts,COALESCE(SUM(score),0) AS correct,COALESCE(SUM(total),0) AS questions FROM attempts WHERE user_id=?",[user.id]))[0],recent:await query("SELECT id,kind,title,updated_at FROM resources WHERE user_id=? ORDER BY updated_at DESC LIMIT 6",[user.id])});
    if(path==="inquiries"&&method==="POST") {await rateLimit(`inquiry:${user.id}`,5,86400000);const input=z.object({message:text}).parse(await body(req));await query("INSERT INTO inquiries(id,user_id,message,created_at) VALUES(?,?,?,?)",[randomUUID(),user.id,input.message,now()]);return json({ok:true},201);}
    if(path==="admin"&&method==="GET") {if(user.role!=="admin")throw new AppError(403,"admin","Administrator access required.");return json({users:await query("SELECT id,name,role,created_at FROM users ORDER BY created_at DESC LIMIT 100"),inquiries:await query("SELECT id,message,status,created_at FROM inquiries ORDER BY created_at DESC LIMIT 100"),events:await query("SELECT capability,status,model,duration_ms,created_at FROM events ORDER BY created_at DESC LIMIT 100")});}
    if(path==="admin/inquiry"&&method==="PATCH") {if(user.role!=="admin")throw new AppError(403,"admin","Administrator access required.");const input=z.object({id:idSchema,status:z.enum(["open","resolved"])}).parse(await body(req));await query("UPDATE inquiries SET status=? WHERE id=?",[input.status,input.id]);return json({ok:true});}
    throw new AppError(404,"not_found","Endpoint not found.");
  } catch(e) {
    if(e instanceof ZodError)return json({error:{code:"validation",message:"Invalid input. Check required fields and size limits."}},400);
    if(e instanceof AppError)return json({error:{code:e.code,message:e.message}},e.status);
    // Never serialize raw SQL, provider or validation errors; these can contain private input.
    return json({error:{code:"internal",message:"The request could not be completed. Please try later."}},500);
  }
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
