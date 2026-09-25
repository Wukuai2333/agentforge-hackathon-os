import { env } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../lib/account";

const checkpointTypes = new Set(["baseline", "episode_reflection", "transfer"]);
const scaffoldLevels = new Set(["explicit", "light", "minimal"]);

export async function GET(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const result = await env.DB.prepare(`SELECT id,checkpoint_type AS checkpointType,stage,prompt_event_id AS promptEventId,
    scaffold_level AS scaffoldLevel,response_json AS responseJson,created_at AS createdAt
    FROM learning_checkins WHERE event_participant_id=? ORDER BY created_at DESC`)
    .bind(auth.account!.participantId).all();
  return Response.json({ checkins: result.results });
}

export async function POST(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as {
    checkpointType?: string;
    stage?: string;
    promptEventId?: string;
    scaffoldLevel?: string;
    response?: unknown;
  };
  const checkpointType = input.checkpointType?.trim() || "";
  const scaffoldLevel = input.scaffoldLevel?.trim() || "";
  const stage = input.stage?.trim().slice(0, 120) || "Participant portal";
  if (!checkpointTypes.has(checkpointType)) return Response.json({ error: "A valid check-in type is required." }, { status: 400 });
  if (!scaffoldLevels.has(scaffoldLevel)) return Response.json({ error: "A valid scaffold level is required." }, { status: 400 });
  if (!input.response || typeof input.response !== "object" || Array.isArray(input.response)) return Response.json({ error: "A structured response is required." }, { status: 400 });
  const responseJson = JSON.stringify(input.response);
  if (responseJson.length > 8000) return Response.json({ error: "This check-in is too long." }, { status: 400 });
  const promptEventId = input.promptEventId?.trim() || null;
  if (promptEventId) {
    const linked = await env.DB.prepare("SELECT id FROM prompt_events WHERE id=? AND anonymous_participant_id=?")
      .bind(promptEventId, auth.account!.participantId).first<{ id: string }>();
    if (!linked) return Response.json({ error: "The linked Prompt does not belong to this participant." }, { status: 403 });
  }
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await env.DB.prepare(`INSERT INTO learning_checkins
    (id,event_participant_id,team_id,checkpoint_type,stage,prompt_event_id,scaffold_level,response_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(id, auth.account!.participantId, auth.account!.teamId, checkpointType, stage, promptEventId, scaffoldLevel, responseJson, createdAt).run();
  return Response.json({ checkin: { id, checkpointType, stage, promptEventId, scaffoldLevel, responseJson, createdAt } });
}
