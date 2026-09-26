import { env } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../../lib/account";

type Answer = { id?: string; label?: string; value?: string };
type Runtime = { DB: D1Database; OPENAI_API_KEY?: string; OPENAI_API_KEYS_JSON?: string; OPENAI_MODEL?: string };
type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const INTERVIEW_VERSION = "agentforge-mira-interviewer-v2";
const MAX_DYNAMIC_CALLS = 2;
const MAX_OUTPUT_TOKENS = 1000;

function keyPool(runtime: Runtime) {
  try {
    const parsed = JSON.parse(runtime.OPENAI_API_KEYS_JSON || "[]");
    if (Array.isArray(parsed)) {
      const keys = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 20).map((item) => item.trim());
      if (keys.length) return keys;
    }
  } catch { /* Fall through to the single event key. */ }
  return runtime.OPENAI_API_KEY ? [runtime.OPENAI_API_KEY] : [];
}

function stableKeyIndex(scope: string, size: number) {
  let hash = 2166136261;
  for (let index = 0; index < scope.length; index += 1) hash = Math.imul(hash ^ scope.charCodeAt(index), 16777619);
  return (hash >>> 0) % size;
}

function responseText(result: OpenAIResponse) {
  if (result.output_text?.trim()) return result.output_text.trim();
  return result.output?.flatMap((item) => item.content || []).filter((item) => item.type === "output_text" && item.text).map((item) => item.text).join("\n").trim() || "";
}

function cleanQuestion(value: string) {
  const unwrapped = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(unwrapped) as { question?: unknown };
    if (typeof parsed.question === "string") return parsed.question.trim().slice(0, 420);
  } catch { /* Accept a plain-text question below. */ }
  return unwrapped.replace(/^question\s*:\s*/i, "").trim().slice(0, 420);
}

function fallbackQuestion(answers: Answer[], callIndex: number) {
  const value = (id: string) => String(answers.find((answer) => answer.id === id)?.value || "").toLowerCase();
  if (callIndex === 0 && value("agent_experience").includes("first")) {
    return { question: "Which part feels most uncertain right now: choosing a use case, connecting memory, configuring the agent, debugging it, or evaluating whether it works?", branchRule: "first_time_builder" };
  }
  if (callIndex === 0 && value("background").includes("student")) {
    return { question: "Is the agent you want to build mainly connected to a course, research, career planning, or a personal need—and what would make it useful today?", branchRule: "student_context" };
  }
  if (callIndex === 0 && (value("background").includes("professional") || value("background").includes("founder"))) {
    return { question: "Which repeated workflow would you most like to improve, and where must a person still review the agent's work?", branchRule: "professional_workflow" };
  }
  return { question: "What concrete result would you like to demonstrate by the end of the hackathon, and what evidence would convince you that it works?", branchRule: callIndex === 0 ? "learning_goal_outcome" : "success_evidence" };
}

export async function POST(request: Request) {
  const runtime = env as unknown as Runtime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as { answers?: Answer[]; callIndex?: number };
  const callIndex = Math.max(0, Math.min(MAX_DYNAMIC_CALLS - 1, Number(input.callIndex) || 0));
  const questionId = `mira_followup_${callIndex + 1}`;
  const answers = (input.answers || []).slice(0, 14).map((answer) => ({
    id: String(answer.id || "").slice(0, 80),
    label: String(answer.label || answer.id || "Answer").slice(0, 120),
    value: String(answer.value || "").trim().replace(/\s+/g, " ").slice(0, 700),
  }));

  const existing = await runtime.DB.prepare(`SELECT question_id AS id,prompt_text AS prompt,source,branch_rule AS branchRule,
      model_name AS model,input_tokens AS inputTokens,output_tokens AS outputTokens
    FROM participant_interview_events WHERE participant_id=? AND question_id=?
      AND event_type IN ('followup_generated','followup_fallback') ORDER BY created_at DESC LIMIT 1`)
    .bind(auth.account!.participantId, questionId).first();
  if (existing) return Response.json({ question: existing, reused: true, limits: { calls: MAX_DYNAMIC_CALLS, maxOutputTokens: MAX_OUTPUT_TOKENS } });

  const used = await runtime.DB.prepare(`SELECT COUNT(*) AS count FROM participant_interview_events
    WHERE participant_id=? AND event_type IN ('followup_generated','followup_fallback')`)
    .bind(auth.account!.participantId).first<{ count: number }>();
  if (Number(used?.count || 0) >= MAX_DYNAMIC_CALLS) return Response.json({ error: "Mira has already used both optional follow-up opportunities." }, { status: 429 });

  const fallback = fallbackQuestion(answers, callIndex);
  const keys = keyPool(runtime);
  const model = runtime.OPENAI_MODEL || "gpt-5-mini";
  let question = fallback.question;
  let source: "ai" | "deterministic" = "deterministic";
  let branchRule = fallback.branchRule;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  if (keys.length) {
    try {
      const key = keys[stableKeyIndex(auth.account!.participantId, keys.length)];
      const provider = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          input: [
            { role: "system", content: "You are Mira, a warm but concise hackathon onboarding interviewer. Ask exactly one optional follow-up question that helps an organizer understand this participant's learning needs or helps the participant define a memory-enabled personal-agent outcome. Do not ask for company names, credentials, health data, financial data, or other sensitive personal information. Do not repeat a fixed question. Return only JSON: {\"question\":\"...\"}. Keep the question under 45 words." },
            { role: "user", content: `Hackathon context: participants will build a Personal Brain with Cognee and an agent with ClawMax. This is optional follow-up ${callIndex + 1} of ${MAX_DYNAMIC_CALLS}.\nParticipant self-report:\n${answers.map((answer) => `${answer.label}: ${answer.value || "Skipped"}`).join("\n")}` },
          ],
        }),
      });
      if (!provider.ok) throw new Error(`Provider returned ${provider.status}`);
      const result = await provider.json() as OpenAIResponse;
      const generated = cleanQuestion(responseText(result));
      if (!generated || !generated.endsWith("?")) throw new Error("Mira did not return a usable question.");
      question = generated;
      source = "ai";
      branchRule = `ai_followup_${callIndex + 1}`;
      inputTokens = Number(result.usage?.input_tokens || 0) || null;
      outputTokens = Number(result.usage?.output_tokens || 0) || null;
    } catch { /* The deterministic question keeps onboarding available. */ }
  }

  const eventType = source === "ai" ? "followup_generated" : "followup_fallback";
  await runtime.DB.prepare(`INSERT INTO participant_interview_events
    (id,participant_id,team_id,event_type,question_id,question_version,prompt_text,required,source,branch_rule,answer_value,model_name,input_tokens,output_tokens,consent_version,created_at)
    VALUES (?,?,?,?,?,?,?,0,?,?,NULL,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), auth.account!.participantId, auth.account!.teamId, eventType, questionId, INTERVIEW_VERSION,
      question, source, branchRule, source === "ai" ? model : null, inputTokens, outputTokens, auth.account!.consentVersion, Date.now()).run();
  return Response.json({ question: { id: questionId, prompt: question, source, branchRule }, limits: { calls: MAX_DYNAMIC_CALLS, maxOutputTokens: MAX_OUTPUT_TOKENS } });
}
