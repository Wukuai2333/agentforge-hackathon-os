import { env } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../../lib/account";

type ResearchRuntime = { DB: D1Database };
type OfferInput = {
  action?: "offer";
  clientKey?: string;
  scaffoldLevel?: "full" | "faded" | "none";
  feviStage?: string;
  sourcePage?: string;
  questionId?: string;
  currentAnswer?: string;
};
type EventInput = {
  action?: "event" | "decision";
  researchEpisodeId?: string;
  eventType?: "opened" | "viewed" | "dismissed" | "skipped" | "acted_on";
  metadata?: Record<string, unknown>;
  decision?: "accepted" | "modified" | "rejected" | "not_decided";
  verificationActions?: string[];
  confidence?: number;
  note?: string;
};

const verificationActions = new Set([
  "tested_in_agent", "checked_source", "compared_answer", "used_own_knowledge",
  "asked_person", "not_verified_yet", "verification_not_needed",
]);

function clean(value: unknown, max = 500) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

export async function POST(request: Request) {
  const runtime = env as unknown as ResearchRuntime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as OfferInput;
  if (input.action !== "offer") return Response.json({ error: "A valid research action is required." }, { status: 400 });
  const clientKey = clean(input.clientKey, 160);
  const questionId = clean(input.questionId, 80);
  const scaffoldLevel = input.scaffoldLevel;
  if (!clientKey || !questionId || !scaffoldLevel || !["full", "faded", "none"].includes(scaffoldLevel)) {
    return Response.json({ error: "A question, support level, and client key are required." }, { status: 400 });
  }
  const participantId = auth.account!.participantId;
  const id = crypto.randomUUID();
  const now = Date.now();
  const stimulus = JSON.stringify({
    questionId,
    currentAnswer: clean(input.currentAnswer, 1800),
    offeredSupportLevel: scaffoldLevel,
  });
  const inserted = await runtime.DB.prepare(`INSERT INTO research_episodes
    (id,participant_id,team_id,client_key,episode_type,scaffold_level,fevi_stage,source_page,status,stimulus_json,started_at,created_at)
    VALUES (?,?,?,?,'scaffold',?,?,?,'eligible',?,?,?)
    ON CONFLICT(participant_id,client_key) DO NOTHING`)
    .bind(id, participantId, auth.account!.teamId, clientKey, scaffoldLevel, clean(input.feviStage, 30) || null,
      clean(input.sourcePage, 100) || "Design Your Agent", stimulus, now, now).run();
  const episode = await runtime.DB.prepare(`SELECT id,status FROM research_episodes WHERE participant_id=? AND client_key=?`)
    .bind(participantId, clientKey).first<{ id: string; status: string }>();
  if (!episode) return Response.json({ error: "The research episode could not be prepared." }, { status: 500 });
  if (inserted.meta.changes) {
    await runtime.DB.prepare(`INSERT INTO research_episode_events
      (id,research_episode_id,participant_id,event_type,metadata_json,occurred_at) VALUES (?,?,?,'offered',?,?)`)
      .bind(crypto.randomUUID(), episode.id, participantId, JSON.stringify({ questionId, scaffoldLevel }), now).run();
  }
  return Response.json({ researchEpisodeId: episode.id, status: episode.status });
}

export async function PATCH(request: Request) {
  const runtime = env as unknown as ResearchRuntime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as EventInput;
  const participantId = auth.account!.participantId;
  const researchEpisodeId = clean(input.researchEpisodeId, 100);
  const episode = researchEpisodeId ? await runtime.DB.prepare(`SELECT id,status FROM research_episodes WHERE id=? AND participant_id=?`)
    .bind(researchEpisodeId, participantId).first<{ id: string; status: string }>() : null;
  if (!episode) return Response.json({ error: "This research episode is unavailable." }, { status: 404 });
  const now = Date.now();

  if (input.action === "event") {
    const allowed = new Set(["opened", "viewed", "dismissed", "skipped", "acted_on"]);
    if (!input.eventType || !allowed.has(input.eventType)) return Response.json({ error: "A valid episode event is required." }, { status: 400 });
    const metadata = JSON.stringify(input.metadata && typeof input.metadata === "object" ? input.metadata : {});
    const status = input.eventType === "opened" || input.eventType === "viewed" ? "shown" : input.eventType === "skipped" ? "skipped" : input.eventType === "dismissed" ? "dismissed" : "submitted";
    await runtime.DB.batch([
      runtime.DB.prepare(`INSERT INTO research_episode_events
        (id,research_episode_id,participant_id,event_type,metadata_json,occurred_at) VALUES (?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), researchEpisodeId, participantId, input.eventType, metadata, now),
      runtime.DB.prepare(`UPDATE research_episodes SET status=CASE WHEN status='submitted' THEN status ELSE ? END,
        submitted_at=CASE WHEN ?='submitted' THEN ? ELSE submitted_at END WHERE id=? AND participant_id=?`)
        .bind(status, status, now, researchEpisodeId, participantId),
    ]);
    return Response.json({ saved: true, eventType: input.eventType, occurredAt: now });
  }

  if (input.action === "decision") {
    const decisions = new Set(["accepted", "modified", "rejected", "not_decided"]);
    if (!input.decision || !decisions.has(input.decision)) return Response.json({ error: "Choose what you did with the response." }, { status: 400 });
    const confidence = Math.max(1, Math.min(5, Number(input.confidence) || 3));
    const selectedVerification = [...new Set((input.verificationActions || []).filter((item) => verificationActions.has(item)))];
    if (!selectedVerification.length) return Response.json({ error: "Choose how you checked the response, or say that you have not checked it yet." }, { status: 400 });
    const payload = { decision: input.decision, confidence, verificationActions: selectedVerification, note: clean(input.note, 600) || null };
    const statements = [
      runtime.DB.prepare(`INSERT INTO research_episode_events
        (id,research_episode_id,participant_id,event_type,metadata_json,occurred_at) VALUES (?,?,?,'decision_recorded',?,?)`)
        .bind(crypto.randomUUID(), researchEpisodeId, participantId, JSON.stringify({ decision: input.decision, confidence, note: payload.note }), now),
      runtime.DB.prepare(`INSERT INTO research_episode_events
        (id,research_episode_id,participant_id,event_type,metadata_json,occurred_at) VALUES (?,?,?,'verification_recorded',?,?)`)
        .bind(crypto.randomUUID(), researchEpisodeId, participantId, JSON.stringify({ verificationActions: selectedVerification }), now),
      runtime.DB.prepare(`UPDATE research_episodes SET status='submitted',
        response_json=json_set(COALESCE(response_json,'{}'),'$.participantDecision',json(?)),submitted_at=?
        WHERE id=? AND participant_id=?`)
        .bind(JSON.stringify(payload), now, researchEpisodeId, participantId),
    ];
    if (input.decision !== "not_decided") statements.splice(2, 0, runtime.DB.prepare(`INSERT INTO research_episode_events
      (id,research_episode_id,participant_id,event_type,metadata_json,occurred_at) VALUES (?,?,?,'acted_on',?,?)`)
      .bind(crypto.randomUUID(), researchEpisodeId, participantId, JSON.stringify({ decision: input.decision }), now));
    await runtime.DB.batch(statements);
    return Response.json({ saved: true, ...payload, occurredAt: now });
  }

  return Response.json({ error: "A valid research action is required." }, { status: 400 });
}
