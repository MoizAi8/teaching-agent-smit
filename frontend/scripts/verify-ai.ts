// Loads only this project's authorized configuration; never prints credentials or provider errors.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
async function main() {
  const key=process.env.GEMINI_API_KEY?.trim();
  if (!key) { console.log("BLOCKED: GEMINI_API_KEY is empty."); process.exitCode=1; return; }
  const headers={"x-goog-api-key":key,"Content-Type":"application/json"};
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models",{headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok) { console.log(`BLOCKED: model discovery returned HTTP ${response.status}. No provider error content logged.`); process.exitCode=1; return; }
  const data=await response.json() as {models?:{name:string;supportedGenerationMethods?:string[]}[]};
  const models=(data.models??[]).filter(m=>m.supportedGenerationMethods?.includes("generateContent")&&/flash/.test(m.name)&&!/(preview|exp|image|tts|live)/.test(m.name)).map(m=>m.name.replace("models/",""));
  console.log("Available stable Flash models:",models.join(", "));
  const model=["gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemini-2.5-flash-lite",process.env.GEMINI_MODEL].find(m=>m&&models.includes(m));
  if(!model) { console.log("BLOCKED: no supported stable model found."); process.exitCode=1; return; }
  const started=Date.now();
  const result=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:"POST",headers,signal:AbortSignal.timeout(45000),body:JSON.stringify({contents:[{role:"user",parts:[{text:"Explain a programming variable to a beginner in two short sentences, with a Python example."}]}],generationConfig:{maxOutputTokens:512}})});
  if(!result.ok) { console.log(`BLOCKED: live inference on ${model} returned HTTP ${result.status}. No provider error content logged.`); process.exitCode=1; return; }
  const output=await result.json() as {candidates?:{content?:{parts?:{text?:string;thought?:boolean}[]}}[]};
  const answer=output.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text??"").join("")??"";
  if(answer.length<20) { console.log("FAIL: provider returned no substantive explanation."); process.exitCode=1; return; }
  console.log(JSON.stringify({status:"PASS",provider:"Gemini",model,durationMs:Date.now()-started,responseCharacters:answer.length}));
  // Test input contains no private data. Print output only after removing the secret in case of an anomalous echo.
  console.log(answer.split(key).join("[REDACTED]"));
}
main().catch(()=>{ console.log("BLOCKED: provider network request failed or timed out. No sensitive diagnostics logged."); process.exitCode=1; });
