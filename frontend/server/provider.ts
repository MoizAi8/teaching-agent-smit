import { AppError } from "./contracts";
export type Turn={role:"user"|"assistant";content:string};
export const modelName=()=>process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
export async function generate(system:string,turns:Turn[],json=false) {
  const key=process.env.GEMINI_API_KEY?.trim();
  if(!key) throw new AppError(503,"provider_configuration","AI is not configured. Please contact the project maintainer.");
  const model=modelName();
  if(!/^[a-z0-9.-]+$/.test(model)) throw new AppError(503,"provider_configuration","Invalid model configuration.");
  try {
    const result=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:"POST",headers:{"x-goog-api-key":key,"Content-Type":"application/json"},signal:AbortSignal.timeout(45000),
      body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:turns.slice(-12).map(t=>({role:t.role==="assistant"?"model":"user",parts:[{text:t.content.slice(0,8000)}]})),generationConfig:{maxOutputTokens:4096,...(json?{responseMimeType:"application/json"}:{})}})
    });
    if(!result.ok) throw new AppError(result.status===429?429:502,"provider_error",result.status===429?"The AI provider's quota is currently exhausted. Please try later.":"The AI provider could not complete this request. Please retry later.");
    const data=await result.json();
    const candidate=data.candidates?.[0];
    const text=(candidate?.content?.parts??[]).filter((p:{thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text??"").join("");
    if(!text || candidate.finishReason!=="STOP") throw new AppError(502,"incomplete_output","The model could not complete a valid response. Try a shorter request.");
    return text.split(key).join("[REDACTED]");
  } catch(e) { if(e instanceof AppError) throw e; throw new AppError(502,"provider_unavailable","The AI provider is unavailable or timed out. Please try later."); }
}
