import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET, POST, PATCH, DELETE } from "../app/api/v2/[...path]/route";
import { closeDB, migrate, query, transaction } from "../server/db";
import { consume, createSession, hash, register } from "../server/auth";

const origin = "http://localhost:3000";
const qaDatabase = process.env.SMIT_QA_POSTGRES_URL;
if (qaDatabase) {
  const url = new URL(qaDatabase);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/smit_release_qa");
  assert.equal(url.username, "smit_qa");
  process.env.DATABASE_URL = qaDatabase;
} else {
  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "smit-release-")), "qa.sqlite");
}
process.env.APP_ORIGIN = origin;
process.env.GEMINI_API_KEY = "synthetic-test-provider-key";
process.env.AI_GLOBAL_DAILY_LIMIT = "100";
process.env.AI_USER_DAILY_LIMIT = "20";
const engine = qaDatabase ? "PostgreSQL" : "SQLite";
const stamp = new Date().toISOString();
const quiz = {title:"Stored quiz",questions:[{prompt:"Which literal is an integer?",options:["2","true"],answer:0,explanation:"Integer secret explanation"}]};
const lesson = {title:"A lesson",objectives:["Write an integer"],prerequisites:[],explanation:"An integer is a number with no fractional component.",examples:["2 + 3"],exercises:["Add two integers"],mistakes:[],summary:"Whole numbers",nextTopics:[]};
const stage = {title:"Basics",objectives:["Add numbers"],activity:"Add and compare two integers.",milestone:"Explain the result"};
const roadmap = {title:"A roadmap",stages:[stage,{...stage,title:"Practice"}]};
const ids = {conversation:randomUUID(),lesson:randomUUID(),quiz:randomUUID(),roadmap:randomUUID(),document:randomUUID()};
let owner:string, outsider:string, admin:string, a:string,b:string,c:string;
async function call(path:string, method="GET", data?:unknown, token=a, headers:Record<string,string>={}, raw?:string) {
  const url = new URL("/api/v2/" + path, origin);
  const req = new Request(url,{method,headers:{origin,"content-type":"application/json",...(token?{cookie:"smit_session="+token}:{}),...headers},...(raw!==undefined?{body:raw}:data!==undefined?{body:JSON.stringify(data)}:{})});
  return ({GET,POST,PATCH,DELETE} as Record<string,typeof GET>)[method](req,{params:Promise.resolve({path:url.pathname.slice(8).split("/").filter(Boolean)})});
}
async function status(expected:number, path:string, method="GET", data?:unknown, token=a) {
  const response = await call(path,method,data,token);
  assert.equal(response.status,expected);
  assert.equal(response.headers.get("cache-control"),"no-store");
  return response.json();
}
async function resource(id:string,user:string,kind:string,title:string,body:unknown) {
  await query("INSERT INTO resources(id,user_id,kind,title,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",[id,user,kind,title,JSON.stringify(body),stamp,stamp]);
}
before(async()=>{
  await migrate();
  const suffix=randomUUID();
  owner=await register(suffix+"-a@example.test","synthetic password A","Owner");
  outsider=await register(suffix+"-b@example.test","synthetic password B","Outsider");
  admin=await register(suffix+"-c@example.test","synthetic password C","Admin");
  await query("UPDATE users SET role='admin' WHERE id=?",[admin]);
  [a,b,c]=await Promise.all([owner,outsider,admin].map(createSession));
  await resource(ids.conversation,owner,"conversation","Tutor chat",{});
  await resource(ids.lesson,owner,"lesson","A lesson",lesson);
  await resource(ids.quiz,owner,"quiz","Stored quiz",quiz);
  await resource(ids.roadmap,owner,"roadmap","A roadmap",roadmap);
  await resource(ids.document,owner,"document","Private Zorali 50%_ note",{text:"Zorali counts three blue blocks per tray.",filename:"note.md"});
  await query("INSERT INTO messages(id,resource_id,user_id,role,content,created_at) VALUES(?,?,?,'user',?,?)",[randomUUID(),ids.conversation,owner,"Private context marker Teval",stamp]);
});
after(closeDB);

for (const [path,method,data] of [
  ["resources","GET"],["dashboard","GET"],["bookmarks","GET"],["search?q=lesson","GET"],["attempts","GET"],["progress","GET"],
  ["admin","GET"],["auth/logout","POST",{}],["ai","POST",{}],["inquiries","POST",{message:"Hello"}],
  ["documents","POST",{}],["account","PATCH",{name:"New"}],
] as const) test(engine+" anonymous "+method+" "+path,()=>status(401,path,method,data,""));

for(const [kind,id] of Object.entries(ids)) {
  test(engine+" owner reads "+kind,async()=>assert.equal((await status(200,"resources/"+id)).id,id));
  for(const method of ["GET","PATCH","DELETE"]) test(engine+" outsider cannot "+method+" "+kind,()=>status(404,"resources/"+id,method,method==="PATCH"?{title:"Other title"}:undefined,b));
  test(engine+" outsider cannot bookmark "+kind,()=>status(404,"bookmarks","POST",{id,saved:true},b));
  test(engine+" kind filter returns the owned "+kind,async()=>assert.deepEqual((await status(200,"resources?kind="+kind)).map((item:{id:string})=>item.id),[id]));
}
for(const [q,expected] of [["zORali",[ids.document]],["teval",[ids.conversation]],["%_",[ids.document]],["Integer secret explanation",[]],["no-such-term",[]]] as const) {
  test(engine+" search matches only authorized public fields for "+q,async()=>assert.deepEqual((await status(200,"search?q="+encodeURIComponent(q))).map((item:{id:string})=>item.id),expected));
  test(engine+" outsider search remains empty for "+q,async()=>assert.deepEqual(await status(200,"search?q="+encodeURIComponent(q),"GET",undefined,b),[]));
}
for(const q of ["","a","x".repeat(101)]) test(engine+" search rejects length "+q.length,()=>status(400,"search?q="+q));
for(const offset of ["-1","1.5","100001","bad"]) test(engine+" pagination rejects offset "+offset,()=>status(400,"resources?offset="+offset));
test(engine+" resource suffix is rejected",()=>status(404,"resources/"+ids.lesson+"/unrecognized"));
test(engine+" offset excludes previously listed resources",async()=>assert.deepEqual(await status(200,"resources?offset=50"),[]));
test(engine+" unknown resource kind is rejected",()=>status(400,"resources?kind=private"));
test(engine+" duplicate bookmarks are idempotent",async()=>{
  await Promise.all([1,2,3].map(()=>status(200,"bookmarks","POST",{id:ids.lesson,saved:true})));
  assert.equal((await status(200,"bookmarks")).length,1);
  assert.deepEqual(await status(200,"bookmarks","GET",undefined,b),[]);
  await status(200,"bookmarks","POST",{id:ids.lesson,saved:false});
  assert.deepEqual(await status(200,"bookmarks"),[]);
});
for(const [label,overrides] of [["missing stage",{}],["negative stage",{stage:-1}],["out-of-range stage",{stage:2}],["fractional stage",{stage:0.1}],["nonboolean completion",{completed:"true"}]] as const) {
  test(engine+" progress rejects "+label,()=>status(400,"progress","POST",{id:ids.roadmap,completed:true,...overrides}));
}
test(engine+" outsiders cannot write progress",()=>status(404,"progress","POST",{id:ids.lesson,completed:true},b));
test(engine+" duplicate completion keeps one record and can be undone",async()=>{
  await Promise.all([1,2,3].map(()=>status(200,"progress","POST",{id:ids.roadmap,stage:0,completed:true})));
  assert.equal((await status(200,"progress")).length,1);
  assert.deepEqual(await status(200,"progress","GET",undefined,b),[]);
  await status(200,"progress","POST",{id:ids.roadmap,stage:0,completed:false});
  assert.deepEqual(await status(200,"progress"),[]);
});
test(engine+" concurrent deletion and progress leave no orphan",async()=>{
  const id=randomUUID();
  await resource(id,owner,"lesson","Disposable lesson",lesson);
  const [complete,remove]=await Promise.all([call("progress","POST",{id,completed:true}),call("resources/"+id,"DELETE")]);
  assert.ok([200,404].includes(complete.status));assert.equal(remove.status,200);
  assert.deepEqual(await query("SELECT target FROM progress WHERE user_id=? AND target=?",[owner,id]),[]);
});
test(engine+" quiz answer key excluded before submitting",async()=>{
  const result=await status(200,"resources/"+ids.quiz);
  assert.deepEqual(Object.keys(result.body.questions[0]).sort(),["options","prompt"]);
});
for(const answers of [[],[1.1],[-1],[2],[0,1],["0"]]) test(engine+" invalid quiz attempt "+JSON.stringify(answers),()=>status(400,"attempts","POST",{quizId:ids.quiz,answers}));
test(engine+" outsider cannot submit a quiz",()=>status(404,"attempts","POST",{quizId:ids.quiz,answers:[0]},b));
test(engine+" lesson cannot be scored",()=>status(400,"attempts","POST",{quizId:ids.lesson,answers:[0]}));
test(engine+" correct and incorrect scores both persist",async()=>{
  assert.equal((await status(200,"attempts","POST",{quizId:ids.quiz,answers:[0]})).score,1);
  assert.equal((await status(200,"attempts","POST",{quizId:ids.quiz,answers:[1]})).score,0);
  assert.deepEqual(await status(200,"attempts","GET",undefined,b),[]);
  assert.equal(Number((await status(200,"dashboard")).assessment.attempts),2);
});
test(engine+" inquiry persisted and only admin can read or resolve",async()=>{
  const message="Release QA "+randomUUID();
  await status(201,"inquiries","POST",{message});
  await status(403,"admin");
  const dashboard=await status(200,"admin","GET",undefined,c);
  const inquiry=dashboard.inquiries.find((item:{message:string})=>item.message===message);
  assert.equal(inquiry.status,"open");
  assert.ok(dashboard.users.every((item:object)=>!("password_hash" in item)&&!("email" in item)));
  await status(403,"admin/inquiry","PATCH",{id:inquiry.id,status:"resolved"});
  await status(200,"admin/inquiry","PATCH",{id:inquiry.id,status:"resolved"},c);
  assert.equal((await query("SELECT status FROM inquiries WHERE id=?",[inquiry.id]))[0].status,"resolved");
});
for(const [label,input] of [["file extension",{filename:"note.html"}],["short content",{text:"short"}],["NUL byte",{text:"some classroom text\u0000"}],["blank title",{title:" "}]] as const) {
  test(engine+" document rejects "+label,()=>status(400,"documents","POST",Object.assign({title:"Note",filename:"note.txt",text:"Example classroom material"},input)));
}
for(const [label,headers,body,expected] of [
  ["cross-origin",{origin:"https://example.test"},"{}",403],
  ["cross-site fetch",{"sec-fetch-site":"cross-site"},"{}",403],
  ["wrong content type",{"content-type":"text/plain"},"{}",415],
  ["broken JSON",{},"{",400],
  ["oversize body",{},JSON.stringify({name:"x".repeat(120001)}),413],
] as const) test(engine+" request rejects "+label,async()=>assert.equal((await call("account","PATCH",undefined,a,headers,body)).status,expected));
test(engine+" expired sessions are rejected",async()=>{
  const token=await createSession(owner);
  await query("UPDATE sessions SET expires_at=? WHERE token_hash=?",[0,hash(token)]);
  await status(401,"dashboard","GET",undefined,token);
});
test(engine+" name updates preserve role",async()=>{
  await status(200,"account","PATCH",{name:"  Updated name  ",role:"admin"});
  const user=(await status(200,"auth/me")).user;
  assert.equal(user.name,"Updated name");assert.equal(user.role,"student");
});
for(const [label,fields] of [
  ["invalid email",{email:"no-domain"}],
  ["short password",{password:"short"}],
  ["oversize password",{password:"x".repeat(129)}],
  ["blank name",{name:"  "}],
  ["oversize name",{name:"x".repeat(81)}],
  ["missing email",{email:undefined}],
  ["missing password",{password:undefined}],
] as const) test(engine+" registration rejects "+label,()=>status(400,"auth/register","POST",Object.assign({
  email:randomUUID()+"@example.test",password:"synthetic registration password",name:"QA account",
},fields),""));
test(engine+" registration ignores privilege and normalizes email for login",async()=>{
  const email=randomUUID()+"@example.test";
  const password="synthetic registration password";
  const response=await call("auth/register","POST",{email:email.toUpperCase(),password,name:"QA",role:"admin"},"");
  assert.equal(response.status,200);
  const cookie=response.headers.get("set-cookie")??"";
  assert.match(cookie,/HttpOnly/);
  assert.match(cookie,/SameSite=Lax/);
  const login=await call("auth/login","POST",{email,password},"");
  assert.equal(login.status,200);
  const token=login.headers.get("set-cookie")?.match(/^smit_session=([a-f0-9]+)/)?.[1];
  assert.ok(token);
  const account=(await status(200,"auth/me","GET",undefined,token)).user;
  assert.equal(account.email,email);
  assert.equal(account.role,"student");
  await status(403,"admin","GET",undefined,token);
});
test(engine+" wrong password and missing user give the same public response",async()=>{
  const [account]=await query("SELECT email FROM users WHERE id=?",[owner]);
  const password="synthetic wrong password";
  const wrong=await status(401,"auth/login","POST",{email:account.email,password},"");
  const missing=await status(401,"auth/login","POST",{email:randomUUID()+"@example.test",password},"");
  assert.deepEqual(wrong,missing);
});
test(engine+" logout revokes reused cookie and leaves other account signed in",async()=>{
  const token=await createSession(owner);
  await status(200,"auth/logout","POST",{},token);
  assert.equal((await status(200,"auth/me","GET",undefined,token)).user,null);
  assert.equal((await status(200,"auth/me","GET",undefined,b)).user.id,outsider);
});
test(engine+" stored resource rename remains private",async()=>{
  await status(200,"resources/"+ids.document,"PATCH",{title:"Updated Zorali note"});
  assert.equal((await status(200,"resources/"+ids.document)).title,"Updated Zorali note");
  await status(404,"resources/"+ids.document,"GET",undefined,b);
});
test(engine+" duplicate email violates database uniqueness",async()=>{
  const [u]=await query("SELECT email FROM users WHERE id=?",[owner]);
  await assert.rejects(()=>query("INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)",[randomUUID(),u.email,"Duplicate","fixture",stamp]));
});
for(const [table,sql,values] of [
  ["messages","INSERT INTO messages(id,resource_id,user_id,role,content,created_at) VALUES(?,?,?,'user','denied',?)",()=>[randomUUID(),ids.conversation,outsider,stamp]],
  ["attempts","INSERT INTO attempts(id,quiz_id,user_id,answers,score,total,created_at) VALUES(?,?,?,'[]',0,1,?)",()=>[randomUUID(),ids.quiz,outsider,stamp]],
  ["bookmarks","INSERT INTO bookmarks(user_id,resource_id,created_at) VALUES(?,?,?)",()=>[outsider,ids.lesson,stamp]],
] as const) test(engine+" composite foreign key rejects cross-user "+table,async()=>{
  const insert=()=>query(sql,values());
  if(qaDatabase) await assert.rejects(insert,{code:"23503"});
  else await assert.rejects(insert,/FOREIGN KEY/);
});
test(engine+" transaction rollback releases consumed quota",async()=>{
  const key=randomUUID();
  await assert.rejects(transaction(async db=>{await consume(db,key,2);throw new Error("rollback marker");}),/rollback marker/);
  assert.deepEqual(await query("SELECT used FROM limits WHERE key=?",[key]),[]);
});
test(engine+" parallel quota reservations accept exactly three",async()=>{
  const key=randomUUID();
  const replies=await Promise.allSettled(Array.from({length:16},()=>transaction(db=>consume(db,key,3))));
  assert.equal(replies.filter(r=>r.status==="fulfilled").length,3);
  for(const reply of replies)if(reply.status==="rejected")assert.equal(reply.reason.code,"rate_limit");
  assert.equal(Number((await query("SELECT used FROM limits WHERE key=?",[key]))[0].used),3);
});
test(engine+" migrations remain repeat-safe after reconnect",async()=>{
  await closeDB(); await Promise.all([migrate(),migrate(),migrate()]);
  assert.deepEqual((await query("SELECT version FROM migrations ORDER BY version")).map(row=>Number(row.version)),[1]);
  assert.equal((await status(200,"health")).database,qaDatabase?"postgresql":"local-sqlite");
});

function providerResponse(value:unknown, finishReason="STOP") {
  return Response.json({candidates:[{finishReason,content:{parts:[{text:typeof value==="string"?value:JSON.stringify(value)}]}}]});
}
for(const [capability,value] of Object.entries({tutor:"A student-friendly explanation",coding:"The function subtracts instead of adding",inquiry:"This portfolio has no official admission services",lesson,quiz,roadmap})) {
  test(engine+" mocked "+capability+" persists validated result",async t=>{
    const mocked=t.mock.method(globalThis,"fetch",async()=>providerResponse(value));
    const input={requestId:randomUUID(),capability,prompt:"Explain addition.",count:1};
    const result=await status(200,"ai","POST",input);
    assert.equal(mocked.mock.callCount(),1);
    assert.equal((await status(200,"resources/"+result.id)).id,result.id);
    await status(404,"resources/"+result.id,"GET",undefined,b);
    assert.deepEqual(await status(200,"ai","POST",input),result);
    assert.equal(mocked.mock.callCount(),1);
    await status(409,"ai","POST",{...input,prompt:"Different prompt"});
    assert.equal(mocked.mock.callCount(),1);
  });
}
test(engine+" concurrent duplicate sends one mocked Gemini request",async t=>{
  let release!:()=>void, entered!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const wasCalled=new Promise<void>(resolve=>{entered=resolve;});
  const mock=t.mock.method(globalThis,"fetch",async()=>{entered();await gate;return providerResponse("One response only");});
  const input={requestId:randomUUID(),capability:"tutor",prompt:"Teach me integers."};
  const first=call("ai","POST",input);
  const early=await Promise.race([first.then(()=>false),wasCalled.then(()=>true)]);
  assert.ok(early,"first request must reach provider");
  try {
    await status(409,"ai","POST",input);
    await status(409,"ai","POST",{...input,requestId:randomUUID()});
  } finally { release(); await first; }
  assert.equal((await first).status,200);
  assert.equal(mock.mock.callCount(),1);
});
test(engine+" deleted AI result cannot be recovered through a replay",async t=>{
  const mocked=t.mock.method(globalThis,"fetch",async()=>providerResponse(lesson));
  const input={requestId:randomUUID(),capability:"lesson",prompt:"Generate a lesson about integers."};
  const result=await status(200,"ai","POST",input);
  await status(200,"resources/"+result.id,"DELETE");
  await status(404,"ai","POST",input);
  assert.equal(mocked.mock.callCount(),1);
});
test(engine+" retrieval sends only owned sources and bounded context",async t=>{
  const mock=t.mock.method(globalThis,"fetch",async()=>providerResponse("The answer is three."));
  const result=await status(200,"ai","POST",{requestId:randomUUID(),capability:"tutor",prompt:"What is in the Zorali note?",conversationId:ids.conversation});
  assert.ok(result.sources.some((item:{id:string})=>item.id===ids.document));
  const payload=JSON.parse(String((mock.mock.calls[0].arguments as unknown as [string,RequestInit])[1].body));
  assert.ok(JSON.stringify(payload.contents).includes("Private context marker Teval"));
  assert.match(JSON.stringify(payload.systemInstruction),/untrusted reference data/);
  await status(404,"ai","POST",{requestId:randomUUID(),capability:"tutor",prompt:"Open private conversation",conversationId:ids.conversation},b);
  assert.equal(mock.mock.callCount(),1);
});
test(engine+" exhausted user quota rolls back the global reservation",async t=>{
  const mock=t.mock.method(globalThis,"fetch",async()=>providerResponse("This should not be reached."));
  const day=new Date().toISOString().slice(0,10);
  const globalKey="ai:global:"+day;
  const [before]=await query("SELECT used FROM limits WHERE key=?",[globalKey]);
  await query("UPDATE limits SET used=20 WHERE key=?",["ai:"+owner+":"+day]);
  try {
    await status(429,"ai","POST",{requestId:randomUUID(),capability:"tutor",prompt:"Explain values."});
    assert.equal((await query("SELECT used FROM limits WHERE key=?",[globalKey]))[0].used,before.used);
    assert.equal(mock.mock.callCount(),0);
  } finally {
    await query("UPDATE limits SET used=0 WHERE key=?",["ai:"+owner+":"+day]);
  }
});
test(engine+" exhausted global quota rejects new user before inference",async t=>{
  const mock=t.mock.method(globalThis,"fetch",async()=>providerResponse("This should not be reached."));
  const globalKey="ai:global:"+new Date().toISOString().slice(0,10);
  const [before]=await query("SELECT used FROM limits WHERE key=?",[globalKey]);
  await query("UPDATE limits SET used=100 WHERE key=?",[globalKey]);
  try {
    await status(429,"ai","POST",{requestId:randomUUID(),capability:"tutor",prompt:"Explain values."},b);
    assert.equal(mock.mock.callCount(),0);
  } finally {
    await query("UPDATE limits SET used=? WHERE key=?",[before.used,globalKey]);
  }
});
for(const [label,expected,reply] of [
  ["provider unavailable",502,()=>new Response("sensitive provider text",{status:503})],
  ["provider quota",429,()=>new Response("sensitive provider text",{status:429})],
  ["truncated provider output",502,()=>providerResponse("partial","MAX_TOKENS")],
  ["invalid lesson schema",502,()=>providerResponse({title:"Incomplete"})],
] as const) test(engine+" mocked "+label+" returns safe error and releases job",async t=>{
  t.mock.method(globalThis,"fetch",async()=>reply());
  const requestId=randomUUID();
  const result=await status(expected,"ai","POST",{requestId,capability:"lesson",prompt:"Explain variables"});
  assert.doesNotMatch(JSON.stringify(result),/sensitive provider text|synthetic-test-provider-key/);
  assert.equal((await query("SELECT status FROM jobs WHERE user_id=? AND request_id=?",[owner,requestId]))[0].status,"failed");
});
