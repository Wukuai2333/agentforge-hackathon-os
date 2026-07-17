import { env } from "cloudflare:workers";

type AssistantInput = {
  prompt?: string;
  page?: string;
  selectedContext?: string;
  anonymousParticipantId?: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { code?: string; message?: string };
};

const SYSTEM_PROMPT_VERSION = "agentforge-tutor-v1";

function responseText(result: OpenAIResponse) {
  if (result.output_text?.trim()) return result.output_text.trim();
  return result.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text)
    .join("\n")
    .trim() ?? "";
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const input = (await request.json()) as AssistantInput;
  const prompt = input.prompt?.trim().slice(0, 4000) ?? "";
  const page = input.page?.trim().slice(0, 100) || "Unknown page";
  const selectedContext = input.selectedContext?.trim().slice(0, 2000) || "No text selected";
  const participantId = input.anonymousParticipantId?.trim() || crypto.randomUUID();
  const runtime = env as unknown as { DB: D1Database; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
  const model = runtime.OPENAI_MODEL || "gpt-5-mini";
  const eventId = crypto.randomUUID();

  if (!prompt) return Response.json({ error: "Please enter a question." }, { status: 400 });
  if (!runtime.OPENAI_API_KEY) return Response.json({ error: "The organizer has not connected the OpenAI API yet." }, { status: 503 });

  let status: "success" | "error" = "error";
  let answer = "";
  let errorCode: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${runtime.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: "You are the AgentForge hackathon tutor. Help participants build a useful personal agent with ClawMax and Cognee. Answer using the supplied page context. Be concise, practical, honest about uncertainty, and never request or repeat passwords or API keys. Give a concrete next step when possible.",
        input: `Current page: ${page}\nSelected context: ${selectedContext}\n\nParticipant question: ${prompt}`,
        max_output_tokens: 500,
      }),
    });
    const result = await openAIResponse.json() as OpenAIResponse;
    inputTokens = result.usage?.input_tokens ?? null;
    outputTokens = result.usage?.output_tokens ?? null;
    if (!openAIResponse.ok) {
      errorCode = result.error?.code || `openai_${openAIResponse.status}`;
      throw new Error(result.error?.message || "OpenAI could not answer this question.");
    }
    answer = responseText(result);
    if (!answer) throw new Error("OpenAI returned an empty answer.");
    status = "success";
    return Response.json({ answer, model, inputTokens, outputTokens, eventId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The assistant could not answer right now.";
    errorCode ||= "assistant_error";
    return Response.json({ error: message, eventId }, { status: 502 });
  } finally {
    await runtime.DB.prepare(
      `INSERT INTO prompt_events
        (id, anonymous_participant_id, page, user_prompt, system_prompt_version,
         context_type, context_reference, agent_name, model_name, response_text,
         latency_ms, input_tokens, output_tokens, status, error_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      eventId, participantId, page, prompt, SYSTEM_PROMPT_VERSION,
      selectedContext === "No text selected" ? "page" : "selected_text", selectedContext,
      "AgentForge Build Assistant", model, answer || null, Date.now() - startedAt,
      inputTokens, outputTokens, status, errorCode, Date.now(),
    ).run();
  }
}
