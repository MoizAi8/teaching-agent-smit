import { loadEnvConfig } from "@next/env";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { register } from "../server/auth";
import { query,closeDB } from "../server/db";
import { learn,owned } from "../server/learning";
import { aiInput } from "../server/contracts";
loadEnvConfig(process.cwd(),true,{info(){},error(){}});
delete process.env.DATABASE_URL;
process.env.LOCAL_DATABASE_PATH=join(mkdtempSync(join(tmpdir(),"smit-live-")),"verification.sqlite");
async function main(){
 const user=await register("live-verification@example.test","synthetic test password only","Live evaluation");
 const outsider=await register("outsider@example.test","another synthetic password","Isolation check");
 const checks=[
  {capability:"tutor",prompt:"Explain Python lists to a beginner in 100 words with one example.",language:"English"},
  {capability:"coding",prompt:"Review this Python code without executing it: def add(a,b): return a-b. Explain the bug.",language:"English"},
  {capability:"lesson",prompt:"Create a concise lesson on Python variables. One example and one exercise.",language:"English"},
  {capability:"quiz",prompt:"Create 3 unambiguous questions on Python variable assignments.",count:3,language:"English"},
  {capability:"roadmap",prompt:"Create a short 3-stage Python learning roadmap for a beginner with two hours a week.",language:"English"},
  {capability:"inquiry",prompt:"Is this official SMIT admission support? How can I begin learning Python?",language:"English"},
  {capability:"tutor",prompt:"Python variable ko choti misaal ke saath samjhayen.",language:"Roman Urdu"},
 ];
 for(const check of checks){const start=Date.now();const result=await learn(user,aiInput.parse({...check,requestId:randomUUID()}));assert.ok(result.id);const row=await owned(user,result.id);assert.ok(row);await assert.rejects(()=>owned(outsider,result.id));if(check.capability==="quiz")assert.equal(result.body.questions[0].answer,undefined);console.log(JSON.stringify({capability:check.capability,language:check.language,status:"PASS",model:result.model,durationMs:Date.now()-start,persisted:true,ownerIsolation:true}));}
 console.log(JSON.stringify({persistedResources:(await query("SELECT COUNT(*) AS n FROM resources WHERE user_id=?",[user]))[0].n,completedEvents:(await query("SELECT COUNT(*) AS n FROM events WHERE user_id=? AND status='complete'",[user]))[0].n}));
}
main().catch(e=>{console.log(JSON.stringify({status:"FAIL",code:e?.code||"verification_failed"}));process.exitCode=1;}).finally(closeDB);
