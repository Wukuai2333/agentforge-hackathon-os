import { env } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../lib/account";

type Runtime = { DB: D1Database; SUBMISSIONS?: R2Bucket };
type SubmissionRow = {
  id: string;
  eventId: string;
  teamId: string;
  artifactKind: "file" | "link";
  artifactUrl: string | null;
  artifactObjectKey: string | null;
  artifactFilename: string | null;
  artifactMimeType: string | null;
  artifactSizeBytes: number | null;
  notes: string | null;
  artifactSubmittedAt: number;
  demoVideoUrl: string | null;
  demoSubmittedAt: number | null;
  demoDueAt: number;
  status: "artifact_submitted" | "complete";
  updatedAt: number;
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const allowedExtensions = new Set(["zip", "json", "pdf", "txt", "md", "yaml", "yml"]);

function validHttpsUrl(value: unknown) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch { return ""; }
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 140) || "submission";
}

async function currentSubmission(runtime: Runtime, eventId: string, teamId: string) {
  return runtime.DB.prepare(`SELECT id,event_id AS eventId,team_id AS teamId,artifact_kind AS artifactKind,
    artifact_url AS artifactUrl,artifact_object_key AS artifactObjectKey,artifact_filename AS artifactFilename,
    artifact_mime_type AS artifactMimeType,artifact_size_bytes AS artifactSizeBytes,notes,
    artifact_submitted_at AS artifactSubmittedAt,demo_video_url AS demoVideoUrl,demo_submitted_at AS demoSubmittedAt,
    demo_due_at AS demoDueAt,status,updated_at AS updatedAt
    FROM team_submissions WHERE event_id=? AND team_id=?`)
    .bind(eventId, teamId).first<SubmissionRow>();
}

async function dueAt(runtime: Runtime, eventId: string, now: number) {
  const event = await runtime.DB.prepare("SELECT ends_at AS endsAt FROM hackathon_events WHERE id=?")
    .bind(eventId).first<{ endsAt: number | null }>();
  return Number(event?.endsAt || now) + 24 * 60 * 60 * 1000;
}

function requireTeam(teamId: string | null) {
  return teamId ? null : Response.json({ error: "Join a team or create a Personal Workspace before submitting." }, { status: 409 });
}

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const missingTeam = requireTeam(auth.account!.teamId);
  if (missingTeam) return missingTeam;
  const submission = await currentSubmission(runtime, auth.account!.eventId, auth.account!.teamId!);
  if (new URL(request.url).searchParams.get("download") === "artifact") {
    if (!submission?.artifactObjectKey || !runtime.SUBMISSIONS) return Response.json({ error: "No uploaded artifact is available." }, { status: 404 });
    const object = await runtime.SUBMISSIONS.get(submission.artifactObjectKey);
    if (!object) return Response.json({ error: "The uploaded artifact could not be found." }, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Disposition", `attachment; filename="${safeFilename(submission.artifactFilename || "agentforge-submission")}"`);
    headers.set("Cache-Control", "private, no-store");
    return new Response(object.body, { headers });
  }
  return Response.json({ submission, maxFileBytes: MAX_FILE_BYTES, storageAvailable: Boolean(runtime.SUBMISSIONS) });
}

export async function POST(request: Request) {
  const runtime = env as unknown as Runtime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const account = auth.account!;
  const missingTeam = requireTeam(account.teamId);
  if (missingTeam) return missingTeam;
  const contentType = request.headers.get("content-type") || "";
  const now = Date.now();

  if (contentType.includes("application/json")) {
    const input = await request.json() as { action?: string; artifactUrl?: string; demoVideoUrl?: string; notes?: string };
    if (input.action === "submit_demo") {
      const existing = await currentSubmission(runtime, account.eventId, account.teamId!);
      if (!existing) return Response.json({ error: "Submit the project artifact before adding the demo video." }, { status: 409 });
      const demoVideoUrl = validHttpsUrl(input.demoVideoUrl);
      if (!demoVideoUrl) return Response.json({ error: "Enter a valid HTTPS Google Drive, YouTube, Loom, or other shareable video link." }, { status: 400 });
      await runtime.DB.prepare(`UPDATE team_submissions SET demo_video_url=?,demo_submitted_at=?,status='complete',updated_by_participant_id=?,updated_at=? WHERE id=?`)
        .bind(demoVideoUrl, now, account.participantId, now, existing.id).run();
      return Response.json({ saved: true, submission: await currentSubmission(runtime, account.eventId, account.teamId!) });
    }
    if (input.action !== "submit_link") return Response.json({ error: "Unknown submission action." }, { status: 400 });
    const artifactUrl = validHttpsUrl(input.artifactUrl);
    if (!artifactUrl) return Response.json({ error: "Enter a valid HTTPS Google Drive, GitHub, or shareable artifact link." }, { status: 400 });
    if (await currentSubmission(runtime, account.eventId, account.teamId!)) return Response.json({ error: "This team has already submitted its project artifact. Ask an Organizer if it must be corrected." }, { status: 409 });
    const deadline = await dueAt(runtime, account.eventId, now);
    await runtime.DB.prepare(`INSERT INTO team_submissions
      (id,event_id,team_id,submitted_by_participant_id,updated_by_participant_id,artifact_kind,artifact_url,notes,artifact_submitted_at,demo_due_at,status,created_at,updated_at)
      VALUES (?,?,?,?,?,'link',?,?,?,?,'artifact_submitted',?,?)`)
      .bind(crypto.randomUUID(), account.eventId, account.teamId, account.participantId, account.participantId, artifactUrl, input.notes?.trim().slice(0, 1500) || null, now, deadline, now, now).run();
    return Response.json({ saved: true, submission: await currentSubmission(runtime, account.eventId, account.teamId!) });
  }

  if (!contentType.includes("multipart/form-data")) return Response.json({ error: "Submit a link or multipart file upload." }, { status: 415 });
  if (!runtime.SUBMISSIONS) return Response.json({ error: "File storage is not configured yet. Use a Google Drive or GitHub link for this dry run." }, { status: 503 });
  if (await currentSubmission(runtime, account.eventId, account.teamId!)) return Response.json({ error: "This team has already submitted its project artifact. Ask an Organizer if it must be corrected." }, { status: 409 });
  const form = await request.formData();
  if (String(form.get("action") || "") !== "submit_file") return Response.json({ error: "Unknown submission action." }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a project artifact file." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return Response.json({ error: "The artifact must be 25 MB or smaller. Upload it to Drive or GitHub and submit a link instead." }, { status: 413 });
  const filename = safeFilename(file.name);
  const extension = filename.split(".").at(-1)?.toLowerCase() || "";
  if (!allowedExtensions.has(extension)) return Response.json({ error: "Upload ZIP, JSON, PDF, TXT, Markdown, or YAML. For other formats, submit a shareable link." }, { status: 415 });
  const objectKey = `${account.eventId}/${account.teamId}/${crypto.randomUUID()}-${filename}`;
  await runtime.SUBMISSIONS.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { submittedBy: account.participantId, originalFilename: filename } });
  try {
    const deadline = await dueAt(runtime, account.eventId, now);
    await runtime.DB.prepare(`INSERT INTO team_submissions
      (id,event_id,team_id,submitted_by_participant_id,updated_by_participant_id,artifact_kind,artifact_object_key,artifact_filename,artifact_mime_type,artifact_size_bytes,notes,artifact_submitted_at,demo_due_at,status,created_at,updated_at)
      VALUES (?,?,?,?,?,'file',?,?,?,?,?,?,?,'artifact_submitted',?,?)`)
      .bind(crypto.randomUUID(), account.eventId, account.teamId, account.participantId, account.participantId, objectKey, filename, file.type || "application/octet-stream", file.size, String(form.get("notes") || "").trim().slice(0, 1500) || null, now, deadline, now, now).run();
  } catch (problem) {
    await runtime.SUBMISSIONS.delete(objectKey);
    throw problem;
  }
  return Response.json({ saved: true, submission: await currentSubmission(runtime, account.eventId, account.teamId!) });
}
