import { execFileSync } from "node:child_process";
import env from "@next/env";
env.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const root=execFileSync("git",["rev-parse","--show-toplevel"],{encoding:"utf8"}).trim();
const git=(args)=>execFileSync("git",args,{cwd:root,encoding:"utf8",maxBuffer:20*1024*1024});
const files=git(["ls-files","-z"]).split("\0").filter(Boolean);
const forbidden=/(^|\/)(node_modules|\.next|\.vercel|\.data|out|backend\/data)\/|\.(sqlite3?|db)(-|$)|(^|\/)\.env(\.|$)/;
const secrets=[process.env.GEMINI_API_KEY,process.env.DATABASE_URL].filter(x=>x&&x.length>10);
const patterns=[/AIza[\w-]{30,}/,/gh[pousr]_[A-Za-z0-9]{25,}/,/github_pat_[A-Za-z0-9_]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bsk-[\w-]{20,}/,/\bAKIA[A-Z0-9]{16}\b/,/postgres(?:ql)?:\/\/[^\s/:]+:[^\s/@]+@/i];
const bad=[];
function inspect(file,ref,label){
  if(forbidden.test(file)&&!file.endsWith(".env.example")){bad.push(label);return;}
  const value=git(["show",ref]);
  if(secrets.some(s=>value.includes(s))||patterns.some(p=>p.test(value)))bad.push(label);
}
for(const file of files)inspect(file,`:${file}`,file);
const history=git(["rev-list","HEAD"]).trim().split(/\s+/).filter(Boolean);
for(const commit of history){
  const committedFiles=git(["ls-tree","-r","--name-only","-z",commit]).split("\0").filter(Boolean);
  for(const file of committedFiles)inspect(file,`${commit}:${file}`,`${commit.slice(0,8)}:${file}`);
}
if(bad.length){console.error("BLOCKED: publication audit flagged paths:",bad.join(", "));process.exitCode=1;}
else console.log(`PASS: ${files.length} staged/tracked files and ${history.length} ancestor commits checked for configured secrets, common credential patterns and forbidden runtime paths.`);
