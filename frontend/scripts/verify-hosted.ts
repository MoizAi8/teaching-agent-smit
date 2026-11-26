import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const supplied = process.argv[2];
if (!supplied) throw new Error("Provide the expected HTTPS deployment origin.");
const deployment = new URL(supplied);
if (deployment.protocol !== "https:" || deployment.username || deployment.password || deployment.pathname !== "/" || deployment.search || deployment.hash) {
  throw new Error("Provide only an HTTPS deployment origin.");
}

type Session = { cookie: string };
let step = "startup";
async function request(path: string, expected: number, session?: Session, method = "GET", data?: unknown) {
  const response = await fetch(new URL(`/api/v2/${path}`, deployment), {
    method, redirect: "error", signal: AbortSignal.timeout(65000),
    headers: {
      Origin: deployment.origin,
      ...(session?.cookie ? { Cookie: session.cookie } : {}),
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  assert.equal(response.status, expected);
  const cookie = response.headers.get("set-cookie");
  if (session && cookie) session.cookie = cookie.split(";")[0];
  return response.json();
}

async function register(name: string) {
  const account = { email: `${randomUUID()}@example.test`, name, password: randomUUID() };
  const session = { cookie: "" };
  await request("auth/register/", 200, session, "POST", account);
  assert.ok(session.cookie.startsWith("smit_session="));
  return { session, account };
}

async function main() {
  step = "PostgreSQL and Gemini configuration";
  const health = await request("health/", 200);
  assert.equal(health.database, "postgresql");
  assert.equal(health.aiConfigured, true);

  step = "registration, session persistence, and admin protection";
  const learner = await register("Release verification");
  const outsider = await register("Isolation verification");
  const { session } = learner;
  const me = await request("auth/me/", 200, session);
  assert.ok(me.user.id);
  await request("admin/", 403, session);
  await request("auth/logout/", 200, session, "POST", {});
  assert.equal((await request("auth/me/", 200, session)).user, null);
  await request("auth/login/", 200, session, "POST", learner.account);
  assert.equal((await request("auth/me/", 200, session)).user.id, me.user.id);

  const generate = (capability: string, prompt: string, extra: Record<string, unknown> = {}) =>
    request("ai/", 200, session, "POST", { requestId: randomUUID(), capability, prompt, ...extra });

  step = "owned document, grounded tutor, and contextual follow-up";
  const document = await request("documents/", 201, session, "POST", {
    title: "Synthetic Zorali classroom note", filename: "zorali.txt",
    text: "In this fictional teaching example, Zorali groups three blue blocks per tray. It is a synthetic classroom concept.",
  });
  await request(`resources/${document.id}/`, 404, outsider.session);
  const tutor = await generate("tutor", "According to my Zorali note, how many blue blocks are in one tray?");
  assert.ok(tutor.model.startsWith("gemini-"));
  assert.ok(tutor.sources.some((source: { id: string }) => source.id === document.id));
  assert.match(tutor.answer, /three|\b3\b/i);
  await generate("tutor", "What would two trays hold in that same example?", { conversationId: tutor.id });
  const savedChat = await request(`resources/${tutor.id}/`, 200, session);
  assert.equal(savedChat.messages.length, 4);
  assert.match(savedChat.messages[3].content, /six|\b6\b/i);
  await request(`resources/${tutor.id}/`, 404, outsider.session);
  assert.ok((await request("search/?q=Zorali", 200, session)).some((item: { id: string }) => item.id === document.id));
  assert.deepEqual(await request("search/?q=Zorali", 200, outsider.session), []);

  step = "lesson, progress, and bookmarks";
  const lesson = await generate("lesson", "Generate a concise lesson on Python integer addition with one exercise.");
  await request("progress/", 200, session, "POST", { id: lesson.id, completed: true });
  await request("bookmarks/", 200, session, "POST", { id: lesson.id, saved: true });
  assert.ok((await request("progress/", 200, session)).some((item: { target: string }) => item.target === lesson.id));
  assert.ok((await request("bookmarks/", 200, session)).some((item: { id: string }) => item.id === lesson.id));

  step = "quiz answer concealment, deterministic scoring, and isolation";
  const quiz = await generate("quiz", "Write two unambiguous questions about Python integer addition.", { count: 2 });
  assert.equal(quiz.body.questions.length, 2);
  assert.ok(quiz.body.questions.every((item: object) => !("answer" in item) && !("explanation" in item)));
  const answers = [0, 1];
  const attempt = await request("attempts/", 200, session, "POST", { quizId: quiz.id, answers });
  assert.equal(attempt.score, attempt.questions.filter((q: { answer: number }, index: number) => q.answer === answers[index]).length);
  assert.ok((await request("attempts/", 200, session)).some((item: { id: string }) => item.id === attempt.id));
  assert.deepEqual(await request("attempts/", 200, outsider.session), []);

  step = "roadmap, coding, and inquiry";
  const roadmap = await generate("roadmap", "Create a concise two-stage Python roadmap with one hour per week.");
  assert.ok((await request(`resources/${roadmap.id}/`, 200, session)).body.stages.length >= 2);
  assert.ok((await generate("coding", "Explain why def add(a,b): return a-b fails to add.")).answer.length > 20);
  const support = await generate("inquiry", "Can I use this independent portfolio for official SMIT admission?");
  assert.ok(support.answer.length > 20);
  await request("inquiries/", 201, session, "POST", { message: "Synthetic release verification inquiry." });

  console.log(JSON.stringify({ status: "PASS", database: health.database, model: tutor.model, syntheticAccounts: 2, liveModelCalls: 7 }));
}

main().catch(() => {
  console.error(`FAIL: hosted verification stopped at ${step}. Response bodies and credentials were omitted.`);
  process.exitCode = 1;
});
