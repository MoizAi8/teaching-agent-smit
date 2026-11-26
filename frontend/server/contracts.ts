import { z } from "zod";
export class AppError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export const text = z.string().trim().min(1).max(8000);
export const difficulty = z.enum(["Beginner", "Intermediate", "Advanced"]);
export const preferences = z.object({ subject:z.string().trim().min(1).max(80).default("Programming"), difficulty:difficulty.default("Beginner"), language:z.enum(["English","Urdu","Roman Urdu"]).default("English"), approach:z.enum(["Explain simply","Explain in depth","Practical examples","Step by step","Hints","Practice questions","Review my answer"]).default("Step by step") });
export const question = z.object({ prompt:z.string().trim().min(5).max(1500), options:z.array(z.string().trim().min(1).max(500)).min(2).max(4), answer:z.number().int().min(0), explanation:z.string().trim().min(5).max(2000) }).superRefine((q,c) => { if(q.answer>=q.options.length || new Set(q.options.map(o=>o.toLowerCase())).size!==q.options.length) c.addIssue({code:"custom",message:"Invalid question"}); });
export const quiz = z.object({ title:z.string().min(1).max(150), questions:z.array(question).min(1).max(10) });
export const lesson = z.object({ title:z.string().min(1).max(150), objectives:z.array(z.string().min(1).max(400)).min(1).max(8), prerequisites:z.array(z.string().max(400)).max(8), explanation:z.string().min(30).max(14000), examples:z.array(z.string().min(1).max(3000)).min(1).max(5), exercises:z.array(z.string().min(1).max(1500)).min(1).max(5), mistakes:z.array(z.string().max(500)).max(6), summary:z.string().min(5).max(2000), nextTopics:z.array(z.string().max(150)).max(6) });
export const roadmap = z.object({ title:z.string().min(1).max(150), stages:z.array(z.object({ title:z.string().min(1).max(150), objectives:z.array(z.string().min(1).max(500)).min(1).max(6), activity:z.string().min(10).max(2000), milestone:z.string().min(5).max(600) })).min(2).max(12) });
export const aiInput = preferences.extend({ requestId:z.string().uuid(), capability:z.enum(["tutor","coding","lesson","quiz","roadmap","inquiry"]), prompt:text, conversationId:z.string().uuid().optional(), count:z.number().int().min(1).max(10).default(5) });
export function scoreQuiz(data:z.infer<typeof quiz>, answers:number[]) {
  if(answers.length!==data.questions.length || answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=data.questions[i].options.length)) throw new AppError(400,"answers","Answer every question with a valid option.");
  return data.questions.reduce((score,q,i)=>score+Number(q.answer===answers[i]),0);
}
export function publicQuiz(value: z.infer<typeof quiz>) { return {title:value.title,questions:value.questions.map(({prompt,options})=>({prompt,options}))}; }
