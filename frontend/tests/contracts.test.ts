import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { aiInput, lesson, question, quiz, roadmap } from "../server/contracts";

type Cases = Record<string, unknown>;
function contract(
  label: string,
  schema: { safeParse(value: unknown): { success: boolean } },
  fixture: Cases,
  invalid: Record<string, Cases>,
  valid: Record<string, Cases> = {},
) {
  for (const [scenario, fields] of Object.entries({ baseline: {}, ...valid })) {
    test(label + " accepts " + scenario, () => assert.equal(schema.safeParse({ ...fixture, ...fields }).success, true));
  }
  for (const [scenario, fields] of Object.entries(invalid)) {
    test(label + " rejects " + scenario, () => assert.equal(schema.safeParse({ ...fixture, ...fields }).success, false));
  }
}
const repeat = (length: number) => "x".repeat(length);
const copies = <T>(length: number, item: T) => Array.from({ length }, () => item);
contract("AI request", aiInput, { requestId: randomUUID(), capability: "tutor", prompt: "Teach me arrays." }, {
  "malformed conversation ID": { conversationId: "../private" },
  "malformed request ID": { requestId: "not-a-uuid" },
  "missing prompt": { prompt: undefined },
  "non-string prompt": { prompt: ["text"] },
  "blank subject": { subject: "   " },
  "oversize subject": { subject: repeat(81) },
  "unknown difficulty": { difficulty: "Expert" },
  "unknown teaching approach": { approach: "Execute code" },
  "unsupported language": { language: "automatic" },
  "zero questions": { count: 0 },
  "too many questions": { count: 11 },
  "fractional question count": { count: 1.5 },
  "string question count": { count: "2" },
}, {
  "80-character subject": { subject: repeat(80) },
  "8000-character prompt": { prompt: repeat(8000) },
  "minimum assessment length": { capability: "quiz", count: 1 },
  "maximum assessment length": { capability: "quiz", count: 10 },
  "Urdu follow-up": { language: "Urdu", conversationId: randomUUID() },
});
const quizQuestion = { prompt: "Which is an integer?", options: ["3", "3.5"], answer: 0, explanation: "Three is an integer." };
contract("Quiz question", question, quizQuestion, {
  "missing prompt": { prompt: undefined },
  "white-space prompt": { prompt: "     " },
  "oversize prompt": { prompt: repeat(1501) },
  "one option": { options: ["3"] },
  "five options": { options: ["1","2","3","4","5"] },
  "blank option": { options: ["3","  "] },
  "oversize option": { options: ["3",repeat(501)] },
  "non-string option": { options: ["3",3.5] },
  "blank explanation": { explanation: "     " },
  "oversize explanation": { explanation: repeat(2001) },
}, {
  "four options and final valid answer index": { options: ["A","B","C","D"], answer: 3 },
  "surrounding whitespace": { prompt: " Which is an integer? ", options: [" 3 ", "3.5"], explanation: " Three is an integer. " },
});
contract("Assessment output", quiz, { title: "Integers", questions: [quizQuestion] }, {
  "empty title": { title: "" },
  "oversize title": { title: repeat(151) },
  "empty question set": { questions: [] },
  "too many questions": { questions: copies(11, quizQuestion) },
  "malformed question in an otherwise valid quiz": { questions: [quizQuestion, { ...quizQuestion, answer: 2 }] },
}, { "10-question maximum": { questions: copies(10, quizQuestion) } });
const planStage = { title: "Foundations", objectives: ["Understand variables"], activity: "Write a small program", milestone: "Explain your program" };
contract("Learning roadmap", roadmap, { title: "Learn Python", stages: [planStage, planStage] }, {
  "empty title": { title: "" },
  "oversize title": { title: repeat(151) },
  "single stage": { stages: [planStage] },
  "too many stages": { stages: copies(13, planStage) },
  "unnamed stage": { stages: [planStage, { ...planStage, title: "" }] },
  "no objectives": { stages: [planStage, { ...planStage, objectives: [] }] },
  "too many objectives": { stages: [planStage, { ...planStage, objectives: copies(7,"Objective") }] },
  "oversize objective": { stages: [planStage, { ...planStage, objectives: [repeat(501)] }] },
  "short activity": { stages: [planStage, { ...planStage, activity: "Read" }] },
  "oversize activity": { stages: [planStage, { ...planStage, activity: repeat(2001) }] },
  "missing milestone": { stages: [planStage, { ...planStage, milestone: undefined }] },
  "oversize milestone": { stages: [planStage, { ...planStage, milestone: repeat(601) }] },
}, { "12-stage maximum": { stages: copies(12, planStage) } });
contract("Structured lesson", lesson, {
  title: "Integers", objectives: ["Add integers"], prerequisites: [],
  explanation: "Integers are whole numbers including negative numbers.",
  examples: ["1 + 2"], exercises: ["Add 2 and 3"], mistakes: [], summary: "Whole numbers", nextTopics: [],
}, {
  "oversize title": { title: repeat(151) },
  "empty objectives": { objectives: [] },
  "too many objectives": { objectives: copies(9,"Objective") },
  "oversize objective": { objectives: [repeat(401)] },
  "too many prerequisites": { prerequisites: copies(9,"Basics") },
  "oversize prerequisite": { prerequisites: [repeat(401)] },
  "short explanation": { explanation: "Short" },
  "oversize explanation": { explanation: repeat(14001) },
  "missing examples": { examples: undefined },
  "empty examples": { examples: [] },
  "oversize example": { examples: [repeat(3001)] },
  "empty exercises": { exercises: [] },
  "too many exercises": { exercises: copies(6,"Exercise") },
  "oversize exercise": { exercises: [repeat(1501)] },
  "too many mistakes": { mistakes: copies(7,"Mistake") },
  "oversize mistake": { mistakes: [repeat(501)] },
  "missing summary": { summary: undefined },
  "oversize summary": { summary: repeat(2001) },
  "too many next topics": { nextTopics: copies(7,"Topic") },
  "oversize next topic": { nextTopics: [repeat(151)] },
}, {
  "maximum sized applicable teaching list": { objectives: copies(8,"Objective"), prerequisites: copies(8,"Basics") },
  "Markdown in examples": { examples: ["**Example**: add two integers."] },
});
