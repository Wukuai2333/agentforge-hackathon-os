"use client";

import { useEffect, useRef, useState } from "react";
import { CompanyBrainTutorial } from "./company-brain-tutorial";

type View = "home" | "onboarding" | "useCases" | "learn" | "clawmaxTutorial" | "companyBrainTutorial" | "progress" | "coach" | "demo" | "team" | "model" | "data" | "admin" | "eventAdmin" | "settings" | "policy";
type PortalRole = "participant" | "organizer";
type EntryStage = "auth" | "consent" | "team" | "survey" | "portal";
type ResponseLength = "brief" | "balanced" | "detailed";
type InteractionMode = "guide" | "collaborate" | "direct";
type PortalUser = { id?: string; provider?: "email" | "google-demo"; userId?: string; participantId?: string; eventId?: string; displayName: string; email: string; role: PortalRole; consentVersion?: string; teamId?: string | null; teamName?: string | null; inviteCode?: string | null; onboardingCompleted?: number | boolean; orientationCompleted?: number | boolean; responseLength?: ResponseLength | null; interactionMode?: InteractionMode | null };
type SelectionAction = { text: string; left: number; top: number; status?: "idle" | "saving" | "saved" | "error" } | null;

const nav: Array<{ id: View; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "Overview" },
  { id: "onboarding", icon: "✦", label: "Design Your Agent" },
  { id: "learn", icon: "▤", label: "Learner Center" },
  { id: "progress", icon: "◎", label: "Build Check-ins" },
  { id: "demo", icon: "▶", label: "Demo & Evaluation" },
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

const demoOrganizerEmails = ["organizer@agentforge.demo", "yuxin.ren@nyu.edu"];
const demoPrivacySections = [
  ["01 · What enters the event log", "When you ask the assistant, save a canvas, mark progress, leave feedback, or add a Shared Space note, the demo may keep the text, page, tutorial step, timestamp, response, token usage, and a participant/team identifier. Think of it like application telemetry with a learning purpose: enough context to understand where the build succeeded or broke."],
  ["02 · The compiler is not your therapist", "Please do not paste passwords, API keys, private medical or financial records, confidential employer data, or a roommate's diary into a hackathon prompt. If a value would look alarming in a public Git commit, it should not be entered here either. Secrets belong in server-side environment variables, not prompts, screenshots, shared notes, or demo videos."],
  ["03 · Why Cognee receives memory", "Consented project facts, prompts, responses, tutorial activity, feedback, and participant-model statements may be synchronized to the event's Cognee dataset. Cognee helps retrieve relevant context and study recurring learning barriers. Raw operational records and AI interpretations remain distinguishable; an AI summary is not treated as a measured fact."],
  ["04 · Team visibility and the merge-conflict rule", "Items deliberately added to Shared Space can be viewed and edited by teammates. Private drafts should stay outside shared scope. Edit history may identify who changed a note—because collaborative memory without attribution is basically git blame with the useful part removed."],
  ["05 · Humans stay in the pull request", "Organizers may review prompts, errors, feedback, and learning signals to support participants and improve tutorials. Suggested tutorial changes require human review before publication. The system should never silently turn a model guess into a participant score, disciplinary decision, or final truth."],
  ["06 · Demo retention and deletion", "This is placeholder policy copy for product demonstration, not the final event policy. The real retention period, deletion workflow, access list, vendors, and participant rights still require organizer and legal review. For the demo, signing out does not automatically erase shared event records."],
];

type BlueprintAnswer = { selections: string[]; detail: string; customOther?: string[] };
type BlueprintAnswers = Record<string, BlueprintAnswer>;
type ScaffoldAction = "clarify" | "directions" | "challenge";
type ScaffoldSupportLevel = "guided" | "reduced" | "independent" | "review";
type AssistantScaffold = {
  action: ScaffoldAction;
  questionId: string;
  supportLevel: ScaffoldSupportLevel;
  feviStage: "Formulate" | "Engage" | "Verify" | "Integrate";
  currentAnswer: string;
  selectedUseCaseId?: string;
  researchEpisodeId?: string;
};
type BlueprintQuestion = {
  id: string;
  label: string;
  prompt: string;
  helper: string;
  choices: string[];
  multiple?: boolean;
  optional?: boolean;
  detailRequired?: boolean;
  detailLabel: string;
  placeholder: string;
  example: string;
};

const agentBlueprintQuestions: BlueprintQuestion[] = [
  { id: "context", label: "User & context", prompt: "Where in your life or work should this agent help?", helper: "Select one or more settings, then add only the context that changes what the agent should do.", choices: ["Personal life", "Academic or learning", "Professional or company", "Community or public service", "Other"], multiple: true, detailLabel: "Who is this for, and what situation are they in?", placeholder: "For example: a graduate student balancing courses, research, and recruiting…", example: "Academic or learning — I am a graduate student who needs to keep course deadlines and project commitments from colliding." },
  { id: "problem", label: "Problem", prompt: "What repeated problem is worth solving?", helper: "Describe one concrete moment of friction. Avoid naming an agent before the problem is clear.", choices: ["Repetitive manual work", "Information is scattered", "Important follow-ups are missed", "Monitoring takes too much time", "Decisions lack context", "Coordination breaks down"], multiple: true, detailRequired: true, detailLabel: "What happens today, and why is it frustrating?", placeholder: "Every week I…, but I often…", example: "Every weekday I scan several sources for relevant account news, but I miss changes and spend too long deciding what matters." },
  { id: "trigger", label: "Trigger", prompt: "What should tell the agent that it is time to act?", helper: "A precise trigger turns a broad idea into a workflow you can test.", choices: ["A schedule", "A new message or file", "A user request", "A deadline or milestone", "A change in monitored data", "Another system event"], detailRequired: true, detailLabel: "Make the trigger specific.", placeholder: "At 8:00 a.m. every weekday… / When a purchase-order email arrives…", example: "At 8:00 a.m. every weekday, before my first meeting." },
  { id: "inputs", label: "Inputs & boundaries", prompt: "What information may the agent use—and what stays off limits?", helper: "Select likely sources, then state freshness, privacy, or access boundaries.", choices: ["Email or messages", "Documents or notes", "Calendar or tasks", "Web or news", "Business system or API", "Manual user input"], multiple: true, detailRequired: true, detailLabel: "What must be current, private, or excluded?", placeholder: "It may read…, but it must never…", example: "It may read my calendar and project notes, but not personal email; news must be less than 24 hours old." },
  { id: "responsibilities", label: "Agent responsibilities", prompt: "What work should the agent actually perform?", helper: "Choose actions, not product features. Keep the first version small enough to demonstrate today.", choices: ["Search and summarize", "Compare and prioritize", "Draft or recommend", "Monitor and notify", "Update another system", "Ask clarifying questions"], multiple: true, detailRequired: true, detailLabel: "Describe the smallest useful end-to-end workflow.", placeholder: "First…, then…, and finally…", example: "Collect relevant updates, rank the five most important actions, explain why each matters, and suggest one next step." },
  { id: "checkpoints", label: "Human checkpoints", prompt: "Where must a person review or decide?", helper: "Automation is not all-or-nothing. Mark where mistakes would be costly or judgment matters.", choices: ["Before an external action", "Before changing stored data", "When confidence is low", "Before final approval", "At a scheduled review", "Automatic within clear limits"], multiple: true, detailRequired: true, detailLabel: "What can run automatically, and what needs approval?", placeholder: "The agent may…, but a person must approve…", example: "It may draft and rank actions automatically, but I must approve any email or CRM update." },
  { id: "evidence", label: "Success & failure test", prompt: "What evidence would show that the agent is useful?", helper: "Name an observable result—and one failure that would make you revise the design.", choices: ["Time saved", "Fewer missed items", "More accurate output", "Better decision quality", "Completed transaction", "User satisfaction"], multiple: true, detailRequired: true, detailLabel: "How will you test success and recognize failure?", placeholder: "It succeeds when… It fails if…", example: "It succeeds if I can identify the same top actions in under five minutes; it fails if it invents account changes or misses a scheduled meeting." },
  { id: "memory", label: "Memory & reporting", prompt: "What should persist, and how should the agent report back?", helper: "Optional · Store only context that makes future work better. Do not retain secrets just because storage is available.", choices: ["Remember preferences", "Remember prior decisions", "Remember people or projects", "No long-term memory", "Send a concise summary", "Notify only on exceptions"], multiple: true, optional: true, detailLabel: "Add a memory boundary or preferred output.", placeholder: "Remember…, forget…, and report by…", example: "Remember my priority accounts and accepted recommendations, but not raw email bodies. Send a five-item morning brief." },
];

function scaffoldSupportForStep(step: number): ScaffoldSupportLevel {
  if (step < 2) return "guided";
  if (step < 5) return "reduced";
  if (step < agentBlueprintQuestions.length) return "independent";
  return "review";
}

function feviStageForStep(step: number): AssistantScaffold["feviStage"] {
  if (step < 2) return "Formulate";
  if (step < 5) return "Engage";
  if (step < 7) return "Verify";
  return "Integrate";
}

type UseCaseIllustration = {
  id: string;
  category: string;
  title: string;
  challenge: string;
  role: string;
  flow: string[];
  inputs: string[];
  checkpoint: string;
  evidence: string;
  questions: string[];
};

const inspirationCases: UseCaseIllustration[] = [
  { id: "daily-gtm", category: "Go-To-Market", title: "Daily GTM Brief", challenge: "Important account updates, meetings, and follow-ups are spread across several places, so the user starts each day by manually deciding what matters.", role: "Create a short, ranked morning action brief—not a generic news digest.", flow: ["Wake on a weekday schedule", "Review approved account, conversation, meeting, and news context", "Rank five actions by likely impact", "Explain why each action matters and suggest the next move"], inputs: ["Target-account list", "Recent conversations", "Calendar", "Relevant company news", "Open follow-ups"], checkpoint: "The user approves any external message or CRM change. Ranking and summarization may run automatically.", evidence: "Compare the brief with the user's own priorities: Was an important action missed? How long did prioritization take?", questions: ["What evidence should determine impact?", "Which sources must be current today?", "What should the agent never send automatically?"] },
  { id: "prospect-research", category: "Go-To-Market", title: "Research This Prospect", challenge: "A seller needs a useful account hypothesis without spending an hour assembling company, product, buyer, and technical context.", role: "Build an evidence-linked prospect snapshot and identify plausible reasons to start a conversation.", flow: ["Receive a company name", "Gather current public and approved internal context", "Separate observed facts from hypotheses", "Recommend three buying reasons and likely contacts"], inputs: ["Company website", "Recent company news", "Product information", "Approved account notes"], checkpoint: "A person verifies contact details and buying hypotheses before outreach.", evidence: "Check whether each important claim has a source and whether the suggested pain points fit the company rather than any generic prospect.", questions: ["Which claims are facts and which are inferences?", "How recent must company developments be?", "What would make you reject a buying hypothesis?"] },
  { id: "quickbooks-po", category: "Finance", title: "Import POs into QuickBooks", challenge: "Purchase-order discussions arrive by email and are manually interpreted before someone updates QuickBooks.", role: "Find likely PO conversations, extract structured fields, and prepare—not silently execute—a verified accounting update.", flow: ["Detect an approved PO-related email", "Extract vendor, amount, items, dates, and references", "Flag missing or conflicting fields", "Show a review summary", "Submit to QuickBooks only after approval"], inputs: ["Approved email thread", "Purchase-order attachment", "QuickBooks API", "Vendor rules"], checkpoint: "A person must approve financial fields and the final QuickBooks write.", evidence: "Test with complete, incomplete, and contradictory purchase orders; record extraction errors and prevented bad writes.", questions: ["Which fields are required before submission?", "How should the agent handle conflicting totals?", "Where is human approval mandatory?"] },
  { id: "student-schedule", category: "Education", title: "Schedule Manager for Students", challenge: "Deadlines, classes, work, and personal commitments compete for limited time and are easy to overlook.", role: "Turn approved commitments into a realistic plan while leaving priorities and trade-offs to the student.", flow: ["Collect deadlines and fixed commitments", "Identify conflicts and available work blocks", "Propose a weekly plan", "Ask the student to approve trade-offs", "Update only confirmed changes"], inputs: ["Course deadlines", "Calendar", "Estimated task effort", "Student preferences"], checkpoint: "The student confirms priorities, workload estimates, and calendar changes.", evidence: "Track missed conflicts, unrealistic time estimates, and whether the student actually followed or revised the plan.", questions: ["Which commitments cannot move?", "How will the agent detect an unrealistic plan?", "What should be remembered next week?"] },
  { id: "stock-news", category: "Finance", title: "Stock News Monitor", challenge: "A user wants timely company updates without confusing news summarization with financial advice.", role: "Monitor selected sources, group related developments, and explain why an update may deserve review.", flow: ["Monitor a defined company list", "Collect recent items from approved sources", "Deduplicate and categorize events", "Notify only when a threshold is met", "Present sources and uncertainty"], inputs: ["Watchlist", "Approved news sources", "Time window", "Alert criteria"], checkpoint: "The user makes every investment decision; the agent never trades or presents a forecast as fact.", evidence: "Measure duplicate alerts, missed material events, source quality, and false urgency.", questions: ["What counts as a material event?", "How will you distinguish fact from interpretation?", "When should the agent stay quiet?"] },
  { id: "grading-support", category: "Education", title: "Grading Support for Instructors", challenge: "Instructors spend time organizing evidence and drafting feedback, but final academic judgment requires human responsibility.", role: "Organize rubric-linked evidence and draft feedback for instructor review—not assign an unquestioned final grade.", flow: ["Load the instructor's rubric", "Review the submitted work", "Link observations to rubric criteria", "Identify uncertainty or missing evidence", "Present a draft for instructor revision"], inputs: ["Assignment", "Rubric", "Instructor examples", "Course policy"], checkpoint: "The instructor reviews every consequential judgment and owns the final feedback and grade.", evidence: "Compare evidence links, instructor edits, disagreement patterns, and false claims across varied submissions.", questions: ["Which judgment cannot be delegated?", "What evidence supports each comment?", "How will students contest an error?"] },
  { id: "student-teamwork", category: "Education", title: "Teamwork Agent for Students", challenge: "Teams lose decisions, duplicate work, and discover ownership gaps too late.", role: "Maintain a shared view of decisions, responsibilities, blockers, and unresolved questions.", flow: ["Capture an approved meeting summary", "Extract decisions and proposed owners", "Ask members to confirm assignments", "Track blockers and approaching deadlines", "Prepare the next meeting brief"], inputs: ["Meeting notes", "Team task list", "Project milestones", "Member confirmations"], checkpoint: "Members confirm ownership and can correct summaries; the agent cannot assign blame or silently change commitments.", evidence: "Measure corrected summaries, unowned tasks, missed deadlines, and whether reminders helped without becoming noise.", questions: ["What requires explicit member confirmation?", "Which team information should remain private?", "When is a reminder useful rather than annoying?"] },
  { id: "event-topics", category: "Events", title: "Event Topic Monitoring", challenge: "Organizers need to understand emerging participant interests and repeated questions while an event is moving quickly.", role: "Cluster consented questions into topics and surface actionable gaps without treating AI labels as ground truth.", flow: ["Collect consented questions", "Group semantically related issues", "Count recurring themes", "Link each theme to examples", "Suggest where instructions or support may need attention"], inputs: ["Consented questions", "Page or stage context", "Timestamps", "Organizer-approved categories"], checkpoint: "Organizers review clusters and decide whether to change event guidance.", evidence: "Audit whether clusters link back to real examples and whether an intervention reduces repeated confusion.", questions: ["What is the unit of analysis?", "How will you preserve evidence behind a cluster?", "Which conclusions require organizer review?"] },
  { id: "speaker-sponsor", category: "Events", title: "Speaker & Sponsor Monitoring", challenge: "Relevant announcements, commitments, and follow-ups can be missed across many event communications.", role: "Track approved speaker and sponsor updates and produce exception-focused summaries.", flow: ["Monitor selected channels", "Extract commitments, changes, and deadlines", "Match updates to the correct contact", "Flag conflicts or missing confirmations", "Prepare an organizer review list"], inputs: ["Approved messages", "Contact list", "Event schedule", "Sponsor commitments"], checkpoint: "An organizer verifies sensitive claims and sends all external communication.", evidence: "Track missed commitments, false matches, outdated schedule details, and organizer corrections.", questions: ["Which channels are in scope?", "What makes an update urgent?", "How will the agent avoid mixing two contacts?"] },
  { id: "job-application", category: "Career", title: "Job Application & Employer Response Agent", challenge: "Applicants lose track of versions, deadlines, contacts, and promised follow-ups across many applications.", role: "Maintain a private application timeline and recommend the next reviewable action.", flow: ["Record an application and role", "Track approved messages and deadlines", "Summarize status changes", "Draft a follow-up when appropriate", "Ask the applicant to review before sending"], inputs: ["Application tracker", "Job description", "Approved employer messages", "Calendar"], checkpoint: "The applicant approves every message and decides what personal information is retained.", evidence: "Check status accuracy, duplicate or premature reminders, and whether drafts remain truthful to the applicant's experience.", questions: ["What personal data should not persist?", "When is a follow-up actually appropriate?", "How will the applicant verify a draft?"] },
];

type InterviewQuestion = { id: string; prompt: string; helper: string; placeholder: string; required: boolean; example?: string; choices?: string[]; source?: "fixed" | "ai" | "deterministic" };

const interviewerQuestions: InterviewQuestion[] = [
  { id: "introduction", prompt: "First, tell me a little about yourself.", helper: "Optional · Share only what feels useful for supporting you during this hackathon.", placeholder: "What do you do, and what brought you here?", required: false, example: "Example: I am a product-design student exploring agents for research workflows." },
  { id: "background", prompt: "Which background best describes you right now?", helper: "Required · This helps us understand who the tutorial is serving—not evaluate you.", placeholder: "Choose one or describe your background…", required: true, choices: ["NYU Tandon student", "Student at another school", "Tech professional", "Educator or researcher", "Founder or operator", "Other"] },
  { id: "stage", prompt: "What stage are you currently at?", helper: "Required · Use an education year, degree stage, or career stage—whichever fits you.", placeholder: "For example: undergraduate junior, master's student, early-career engineer…", required: true, choices: ["Undergraduate", "Master's student", "Doctoral student", "Early-career professional", "Experienced professional"] },
  { id: "field", prompt: "What is your major or primary field?", helper: "Required · Interdisciplinary answers are welcome.", placeholder: "Your major or primary field…", required: true, example: "Example: Computer Science + Integrated Design & Media." },
  { id: "ai_experience", prompt: "How have you used AI tools before?", helper: "Required · Think about learning, coding, research, work, or creative projects.", placeholder: "Choose one, or briefly describe your experience…", required: true, choices: ["I am new to AI tools", "I use them occasionally", "I use them most weeks", "I use them daily"] },
  { id: "agent_experience", prompt: "How much experience do you have building agents or automations?", helper: "Required · There is no preferred answer; this helps us calibrate support.", placeholder: "Choose one, or briefly describe what you have tried…", required: true, choices: ["This is my first time", "I have tried one tutorial", "I have built a few", "I build them regularly"] },
  { id: "cognee_familiarity", prompt: "How familiar are you with Cognee?", helper: "Required · This helps us decide how much Personal Brain guidance to make visible.", placeholder: "Choose the closest answer…", required: true, choices: ["I have not used it", "I have read about it", "I have tried it once", "I use it regularly"] },
  { id: "clawmax_familiarity", prompt: "How familiar are you with ClawMax or OpenClaw?", helper: "Required · This helps us separate tool setup needs from agent-design needs.", placeholder: "Choose the closest answer…", required: true, choices: ["I have not used either", "I have seen a demo", "I have tried one of them", "I use one regularly"] },
  { id: "learning_goal", prompt: "What do you most want to learn or get better at here?", helper: "Required · A concrete learning goal helps us study whether the experience actually supported it.", placeholder: "What capability do you want to leave with?", required: true, example: "Example: I want to learn how to test whether an agent uses memory reliably." },
  { id: "baseline_confidence", prompt: "How confident are you that you can design and test a memory-enabled agent right now?", helper: "Required · Choose a number from 0 to 100. This is a baseline for comparison, not a grade.", placeholder: "Enter a number from 0 to 100…", required: true, choices: ["0", "25", "50", "75", "100"] },
];

function InteractionPreferencePicker({ responseLength, interactionMode, onLength, onMode, compact = false }: { responseLength: ResponseLength; interactionMode: InteractionMode; onLength: (value: ResponseLength) => void; onMode: (value: InteractionMode) => void; compact?: boolean }) {
  return <div className={`interaction-preferences ${compact ? "compact" : ""}`}><fieldset><legend>ANSWER LENGTH</legend><div>{([['brief','Brief'],['balanced','Balanced'],['detailed','Detailed']] as Array<[ResponseLength,string]>).map(([value,label]) => <button type="button" key={value} className={responseLength === value ? "selected" : ""} aria-pressed={responseLength === value} onClick={() => onLength(value)}>{label}</button>)}</div></fieldset><fieldset><legend>HOW SHOULD AI HELP?</legend><div>{([['guide','Guide me'],['collaborate','Work with me'],['direct','Be direct']] as Array<[InteractionMode,string]>).map(([value,label]) => <button type="button" key={value} className={interactionMode === value ? "selected" : ""} aria-pressed={interactionMode === value} onClick={() => onMode(value)}>{label}</button>)}</div></fieldset></div>;
}

type AuthConfig = { enabled: boolean; mode: "agentforge"; emailDeliveryConfigured?: boolean; emailVerificationRequired?: boolean; registrationOpen: boolean; url?: string; publishableKey?: string };
type LegacyAuthConfig = AuthConfig & { googleEnabled?: boolean };

async function endSession() {
  try { await fetch("/api/auth/session", { method: "DELETE" }); } finally {
    window.location.href = "/";
  }
}

// Kept temporarily so existing Supabase sessions can be migrated without losing
// account history. New event accounts use AgentForgeAuthPanel below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AuthPanel({ eventName }: { eventName: string }) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [mode, setMode] = useState<"signup" | "signin" | "forgot" | "reset">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      try {
        const response = await fetch("/api/auth/config");
        const next = await response.json() as AuthConfig;
        if (cancelled) return;
        setConfig(next);
        if (!next.registrationOpen) setMode("signin");
      } catch (problem) { if (!cancelled) setError(problem instanceof Error ? problem.message : "Authentication could not be prepared."); }
      finally { if (!cancelled) setBusy(false); }
    };
    void prepare();
    return () => { cancelled = true; };
  // The callback is intentionally processed once when the auth surface opens.
  }, []);

  async function authRequest(kind: "signup" | "signin" | "forgot") {
    if (!config?.enabled) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (!email.trim()) throw new Error("Enter your email address.");
      if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
      if (kind === "signup" && !config.registrationOpen) throw new Error("Registration is currently closed. Existing participants can still sign in.");
      if (kind === "signup" && password !== confirmPassword) throw new Error("The passwords do not match.");
      if (kind === "signup" && !name.trim()) throw new Error("Enter the name your teammates should see.");
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: kind, email: email.trim(), password, displayName: name.trim() }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Authentication failed.");
      const returnTo = window.localStorage.getItem("agentforge_auth_return_to") || "#/home";
      window.localStorage.removeItem("agentforge_auth_return_to");
      window.history.replaceState(null, "", `${window.location.pathname}${returnTo}`);
      window.location.reload();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  async function resetPassword() {
    setError("Password recovery has moved to the AgentForge identity flow.");
  }

  function googleSignIn() {
    if (!config?.googleEnabled) return;
  }

  return <div className="entry-shell"><section className="entry-brand-panel"><span className="brand-mark large">A</span><span className="eyebrow">WELCOME TO {eventName.toUpperCase()}</span><h1>Build an agent that learns with you.</h1><p>Create one secure identity, then keep your consent, team, project, prompts, progress, and memory connected throughout the event.</p><div className="entry-flow-map"><span><b>1</b>Sign up</span><i>→</i><span><b>2</b>Verify</span><i>→</i><span><b>3</b>Consent</span><i>→</i><span><b>4</b>Build</span></div><small>Passwords are handled by Supabase Auth and never enter AgentForge, D1, Cognee, or Prompt Tracking.</small></section><section className="auth-card supabase-auth"><span className="eyebrow">SECURE EVENT ACCOUNT</span><h2>{mode === "signup" ? "Join the hackathon" : mode === "signin" ? "Welcome back" : mode === "forgot" ? "Reset your password" : "Choose a new password"}</h2>{!config ? <p>Preparing secure sign-in…</p> : !config.enabled ? <div className="auth-config-pending"><strong>Authentication setup is ready for configuration.</strong><p>Add the Supabase Project URL and Publishable Key before opening registration.</p></div> : <>{!config.registrationOpen && <div className="registration-closed-notice"><strong>Registration is closed.</strong><span>Existing Participants and Organizers can still sign in.</span></div>}{mode !== "reset" && <div className="auth-tabs"><button disabled={!config.registrationOpen} className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Sign up</button><button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); setMessage(""); }}>Sign in</button></div>}{mode === "signup" && <label>DISPLAY NAME<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="How teammates will see you" /></label>}{mode !== "reset" && <label>EMAIL<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>}{mode !== "forgot" && <label>{mode === "reset" ? "NEW PASSWORD" : "PASSWORD"}<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>}{(mode === "signup" || mode === "reset") && <label>CONFIRM PASSWORD<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" /></label>}{error && <p className="entry-error">{error}</p>}{message && <p className="auth-success">{message}</p>}{mode === "signup" && <button className="primary auth-submit" disabled={busy || !config.registrationOpen} onClick={() => void authRequest("signup")}>{busy ? "Creating account…" : "Create account →"}</button>}{mode === "signin" && <><button className="primary auth-submit" disabled={busy} onClick={() => void authRequest("signin")}>{busy ? "Signing in…" : "Sign in →"}</button><button className="auth-forgot" onClick={() => setMode("forgot")}>Forgot password?</button></>}{mode === "forgot" && <><button className="primary auth-submit" disabled={busy} onClick={() => void authRequest("forgot")}>{busy ? "Sending…" : "Send reset link →"}</button><button className="auth-forgot" onClick={() => setMode("signin")}>Back to sign in</button></>}{mode === "reset" && <button className="primary auth-submit" disabled={busy} onClick={() => void resetPassword()}>{busy ? "Updating…" : "Update password →"}</button>}{mode !== "forgot" && mode !== "reset" && <><div className="auth-divider"><span>OR</span></div><button className="google-button" disabled={!config.googleEnabled || busy} onClick={googleSignIn}><b>G</b>{config.googleEnabled ? "Continue with Google" : "Google login awaiting organizer setup"}</button></>}<p className="auth-disclaimer">New accounts are Participants by default. Organizer access is assigned only on the server.</p></>}</section></div>;
}

function AgentForgeAuthPanel({ eventName }: { eventName: string }) {
  const [config, setConfig] = useState<LegacyAuthConfig | null>(null);
  const [mode, setMode] = useState<"signup" | "signin" | "forgot" | "verify" | "reset">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionToken, setActionToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const authAction = params.get("auth"), token = params.get("token") || "";
      if (token && authAction === "verify") { setActionToken(token); setMode("verify"); }
      if (token && authAction === "reset") { setActionToken(token); setMode("reset"); }
      void fetch("/api/auth/config").then(async (response) => {
        const next = await response.json() as LegacyAuthConfig;
        if (!cancelled) { setConfig(next); if (!next.registrationOpen && !token) setMode("signin"); }
      }).catch(() => { if (!cancelled) setError("Authentication could not be prepared."); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);

  async function submit(action: "signup" | "signin") {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!email.trim()) throw new Error("Enter your email address.");
      if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
      if (action === "signup" && !name.trim()) throw new Error("Enter the name your teammates should see.");
      if (action === "signup" && password !== confirmPassword) throw new Error("The passwords do not match.");
      const response = await fetch("/api/auth/password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email: email.trim(), password, displayName: name.trim() }),
      });
      const raw = await response.text();
      let result: { error?: string; verificationRequired?: boolean; email?: string; message?: string } = {};
      if (raw) {
        try { result = JSON.parse(raw) as { error?: string }; }
        catch { throw new Error(response.ok ? "The server returned an unreadable response." : "The authentication service returned an error. Please try again."); }
      }
      if (result.verificationRequired) {
        if (result.email) setEmail(result.email);
        setMode("verify");
        if (!response.ok) {
          setError(result.error || "The verification email could not be sent. Try again below.");
          return;
        }
        // A successful delivery request is more current than the config snapshot
        // captured when this page first opened.
        setConfig((current) => current ? { ...current, emailDeliveryConfigured: true } : current);
        setMessage(result.message || "Verification email sent. Check Inbox, Spam, and All Mail.");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Authentication failed.");
      const returnTo = window.localStorage.getItem("agentforge_auth_return_to") || "#/home";
      window.localStorage.removeItem("agentforge_auth_return_to");
      window.history.replaceState(null, "", `${window.location.pathname}${returnTo}`);
      window.location.reload();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  async function emailAction(action: "request_verification" | "forgot" | "verify" | "reset") {
    setBusy(true); setError(""); setMessage("");
    try {
      if ((action === "request_verification" || action === "forgot") && !email.trim()) throw new Error("Enter your email address.");
      if (action === "reset") {
        if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
      }
      const response = await fetch("/api/auth/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, email: email.trim(), token: actionToken, password }) });
      const result = await response.json() as { error?: string; message?: string; verified?: boolean; reset?: boolean };
      if (!response.ok) throw new Error(result.error || "The email action could not be completed.");
      if (result.verified) {
        window.history.replaceState(null, "", window.location.pathname);
        window.location.reload();
        return;
      }
      if (result.reset) { setMode("signin"); setPassword(""); setConfirmPassword(""); }
      setMessage(result.message || (action === "request_verification" ? "Verification email sent. Check Inbox, Spam, and All Mail." : "If this email is registered, a reset link has been sent."));
    } catch (problem) { setError(problem instanceof Error ? problem.message : "The email action could not be completed."); }
    finally { setBusy(false); }
  }

  return <div className="entry-shell">
    <section className="entry-brand-panel">
      <span className="brand-mark large">A</span><span className="eyebrow">WELCOME TO {eventName.toUpperCase()}</span>
      <h1>Build an agent that learns with you.</h1>
      <p>Create one secure identity, then keep your consent, team, project, prompts, progress, and memory connected throughout the event.</p>
      <div className="entry-flow-map"><span><b>1</b>Sign up</span><i>→</i>{config?.emailVerificationRequired !== false && <><span><b>2</b>Verify</span><i>→</i></>}<span><b>{config?.emailVerificationRequired === false ? 2 : 3}</b>Consent</span><i>→</i><span><b>{config?.emailVerificationRequired === false ? 3 : 4}</b>Build</span></div>
      <small>AgentForge stores a salted password hash, never the original password. Sessions use secure, HttpOnly cookies.</small>
    </section>
    <section className="auth-card supabase-auth">
      <span className="eyebrow">SECURE EVENT ACCOUNT</span>
      <h2>{mode === "signup" ? "Join the hackathon" : mode === "signin" ? "Welcome back" : mode === "forgot" ? "Reset your password" : mode === "verify" ? "Verify your email" : "Choose a new password"}</h2>
      {!config ? <p>Preparing secure sign-in…</p> : <>
        {config.emailVerificationRequired === false && <div className="auth-success"><strong>Email verification is temporarily paused for the Organizer dry run.</strong><br />New and existing test accounts can continue directly after signing in.</div>}
        {!config.registrationOpen && <div className="registration-closed-notice"><strong>Registration is closed.</strong><span>Existing Participants and Organizers can still sign in.</span></div>}
        {(mode === "signup" || mode === "signin") && <div className="auth-tabs"><button disabled={!config.registrationOpen} className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Sign up</button><button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); setMessage(""); }}>Sign in</button></div>}
        {mode === "signup" && <label htmlFor="agentforge-display-name">DISPLAY NAME<input id="agentforge-display-name" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="How teammates will see you" /></label>}
        {(mode === "signup" || mode === "signin" || mode === "forgot" || (mode === "verify" && !actionToken)) && <label htmlFor="agentforge-email">EMAIL<input id="agentforge-email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
        {(mode === "signup" || mode === "signin" || mode === "reset") && <label htmlFor="agentforge-password">{mode === "reset" ? "NEW PASSWORD" : "PASSWORD"}<span className="password-input-wrap"><input id="agentforge-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /><button type="button" className="password-visibility" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}><span className={`password-eye${showPassword ? " is-visible" : ""}`} aria-hidden="true" /></button></span></label>}
        {(mode === "signup" || mode === "reset") && <label htmlFor="agentforge-confirm-password">CONFIRM PASSWORD<span className="password-input-wrap"><input id="agentforge-confirm-password" name="password-confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" /></span></label>}
        {error && <p className="entry-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}
        {mode === "signup" && <button className="primary auth-submit" disabled={busy || !config.registrationOpen} onClick={() => void submit("signup")}>{busy ? "Creating account…" : "Create account →"}</button>}
        {mode === "signin" && <><button className="primary auth-submit" disabled={busy} onClick={() => void submit("signin")}>{busy ? "Signing in…" : "Sign in →"}</button><button className="auth-forgot" onClick={() => setMode("forgot")}>Forgot password?</button></>}
        {mode === "forgot" && <><p>Enter your email. For privacy, the confirmation looks the same whether or not an account exists.</p><button className="primary auth-submit" disabled={busy} aria-busy={busy} onClick={() => void emailAction("forgot")}>{busy ? "Sending…" : "Send reset link →"}</button><button className="auth-forgot" onClick={() => setMode("signin")}>Back to sign in</button></>}
        {mode === "verify" && <><p>{actionToken ? "This one-time link will verify your email and sign you in." : "Check Inbox, Spam, and All Mail, or request a fresh one-time link."}</p>{actionToken ? <button className="primary auth-submit" disabled={busy} aria-busy={busy} onClick={() => void emailAction("verify")}>{busy ? "Verifying…" : "Verify email →"}</button> : <button className="primary auth-submit" disabled={busy} aria-busy={busy} onClick={() => void emailAction("request_verification")}>{busy ? "Sending verification email…" : "Resend verification email"}</button>}<button className="auth-forgot" onClick={() => setMode("signin")}>Back to sign in</button></>}
        {mode === "reset" && <button className="primary auth-submit" disabled={busy} onClick={() => void emailAction("reset")}>{busy ? "Updating…" : "Update password →"}</button>}
        <p className="auth-disclaimer">New accounts are Participants by default. Organizer access is assigned only on the server.</p>
      </>}
    </section>
  </div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyEntryFlow({ eventName, onComplete }: { eventName: string; onComplete: (user: PortalUser) => void }) {
  const [stage, setStage] = useState<Exclude<EntryStage, "portal">>("auth");
  const [mode, setMode] = useState<"signin" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<PortalUser | null>(null);
  const [consentChecks, setConsentChecks] = useState([false, false, false]);
  const [surveyStep, setSurveyStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const questions = [
    "What recurring problem would you most like your agent to solve?",
    "How do you handle it today, and where does that workflow break?",
    "What data may the agent use—and what must remain off limits?",
    "What observable result would prove the agent is useful?",
    "What should it remember between sessions?",
    "How should feedback change its next attempt?",
    "Does it need another agent, tool, or shared team memory?",
  ];

  function accountFor(candidateEmail: string, candidateName: string, provider: PortalUser["provider"]) {
    const normalized = candidateEmail.trim().toLowerCase();
    const stored = JSON.parse(localStorage.getItem("agentforge_demo_accounts") || "[]") as PortalUser[];
    const existing = stored.find((item) => item.email.toLowerCase() === normalized);
    const role: PortalRole = existing?.role || (demoOrganizerEmails.includes(normalized) ? "organizer" : "participant");
    const next = existing || { id: crypto.randomUUID(), displayName: candidateName.trim() || normalized.split("@")[0], email: normalized, role, provider };
    if (!existing) localStorage.setItem("agentforge_demo_accounts", JSON.stringify([...stored, next]));
    sessionStorage.setItem("agentforge_participant_id", next.id || crypto.randomUUID());
    sessionStorage.setItem("agentforge_participant_name", next.displayName);
    setUser(next);
    if (next.role === "organizer") onComplete(next);
    else setStage("consent");
  }

  function continueSurvey() {
    if (!answer.trim()) return;
    setAnswers((items) => [...items, answer.trim()]);
    setAnswer("");
    setSurveyStep((value) => value + 1);
  }

  if (stage === "auth") return <div className="entry-shell"><section className="entry-brand-panel"><span className="brand-mark large">A</span><span className="eyebrow">WELCOME TO {eventName.toUpperCase()}</span><h1>Build an agent that learns with you.</h1><p>Create your event identity first. Participants continue through privacy consent and a guided project survey; organizer accounts open the control room.</p><div className="entry-flow-map"><span><b>1</b>Sign up</span><i>→</i><span><b>2</b>Consent</span><i>→</i><span><b>3</b>Project survey</span><i>→</i><span><b>4</b>Build</span></div><small>Authentication screens are demo-ready. Production Google OAuth and password security require the final identity provider configuration.</small></section><section className="auth-card"><span className="eyebrow">{mode === "register" ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</span><h2>{mode === "register" ? "Join the hackathon" : "Sign in to continue"}</h2><div className="auth-tabs"><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button><button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign in</button></div>{mode === "register" && <label>DISPLAY NAME<input value={name} onChange={(event) => setName(event.target.value)} placeholder="How teammates will see you" /></label>}<label>EMAIL<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>PASSWORD<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8+ characters for the future real auth" /></label><button className="primary auth-submit" disabled={!email.trim() || !password.trim() || (mode === "register" && !name.trim())} onClick={() => accountFor(email, name, "email")}>{mode === "register" ? "Create account & continue" : "Sign in"} →</button><div className="auth-divider"><span>OR</span></div><button className="google-button" onClick={() => accountFor(email || "participant.google@example.com", name || "Google Participant", "google-demo")}><b>G</b> Continue with Google <small>Demo</small></button><button className="demo-organizer-login" onClick={() => accountFor("organizer@agentforge.demo", "Demo Organizer", "email")}>Preview an Organizer account →</button><p className="auth-disclaimer">Demo note: passwords are not sent or stored yet. Google uses a simulated identity in this build.</p></section></div>;

  if (stage === "consent" && user) return <div className="consent-page"><header><div><span className="brand-mark">A</span><span><strong>AgentForge</strong><small>{eventName}</small></span></div><span>STEP 2 OF 3 · PRIVACY CONSENT</span></header><main><section className="policy-document"><span className="demo-policy-badge">DEMO POLICY · REPLACE AFTER REVIEW</span><h1>Before your agent remembers anything.</h1><p className="policy-lead">This deliberately detailed, code-themed policy demonstrates the future consent experience. It is not final legal language.</p>{demoPrivacySections.map(([title, copy]) => <article key={title}><h2>{title}</h2><p>{copy}</p></article>)}</section><aside className="consent-card"><span className="eyebrow">YOUR CHOICES</span><h2>Review and confirm</h2><p>You must actively confirm each item. The final event will link the exact policy version and consent timestamp to your account.</p>{["I understand which prompts, responses, and activity may be recorded.", "I understand that selected event data may be stored in Cognee for memory and learning analysis.", "I will not enter credentials or sensitive personal information."].map((item, index) => <label key={item}><input type="checkbox" checked={consentChecks[index]} onChange={() => setConsentChecks((items) => items.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span>{item}</span></label>)}<button className="primary" disabled={!consentChecks.every(Boolean)} onClick={() => setStage("survey")}>Agree & start project survey →</button><button className="consent-signout" onClick={() => { setUser(null); setStage("auth"); }}>I do not agree · return to sign in</button><small>Demo consent version: AF-DEMO-2026-07</small></aside></main></div>;

  const complete = surveyStep >= questions.length;
  return <div className="entry-survey"><header><div><span className="brand-mark">A</span><span><strong>{eventName}</strong><small>DYNAMIC PROJECT DISCOVERY</small></span></div><span>STEP 3 OF 3</span></header><main><section><span className="eyebrow">AGENT-GUIDED ONBOARDING · DEMO</span><h1>{complete ? "Your starting direction is ready." : questions[surveyStep]}</h1>{complete ? <><p>In production, ClawMax will use each answer to choose the next question and generate the initial project brief. This demo uses the agreed question path and preserves your answers locally.</p><div className="survey-summary">{answers.map((item, index) => <article key={`${index}-${item}`}><b>{String(index + 1).padStart(2, "0")}</b><p>{item}</p></article>)}</div><button className="primary" onClick={() => user && onComplete(user)}>Enter Participant Portal →</button></> : <><p>Answer with your real workflow in mind. The future ClawMax agent will dynamically follow up when an answer is unclear or reveals a useful direction.</p><textarea rows={6} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); continueSurvey(); } }} placeholder="Describe it in your own words…" /><div className="entry-survey-actions"><small>Question {surveyStep + 1} of {questions.length} · Press Enter to continue</small><button className="primary" disabled={!answer.trim()} onClick={continueSurvey}>Continue →</button></div></>}</section><aside><span>LIVE PROJECT BRIEF</span>{["Project idea", "Problem statement", "Data boundaries", "Success criteria", "Memory role", "Improvement loop", "Agent / Brain needs"].map((item, index) => <div className={index < answers.length ? "filled" : ""} key={item}><b>{index < answers.length ? "✓" : index + 1}</b><span>{item}<small>{index < answers.length ? "Captured from your response" : "Waiting for context"}</small></span></div>)}</aside></main></div>;
}

function EntryFlow({ eventName, account, onComplete }: { eventName: string; account: PortalUser | null; onComplete: (user: PortalUser) => void }) {
  const [stage, setStage] = useState<"auth" | "consent" | "team" | "survey" | "orientation">(!account ? "auth" : account.consentVersion === "pending" ? "consent" : !account.onboardingCompleted ? "survey" : !account.teamId ? "team" : "orientation");
  const [current, setCurrent] = useState(account);
  const [consentChecks, setConsentChecks] = useState([false, false, false]);
  const [teamMode, setTeamMode] = useState<"create" | "join">("create");
  const [teamValue, setTeamValue] = useState("");
  const [surveyStep, setSurveyStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [dynamicQuestions, setDynamicQuestions] = useState<InterviewQuestion[]>([]);
  const [generatingFollowup, setGeneratingFollowup] = useState(false);
  const [responseLength, setResponseLength] = useState<ResponseLength>(account?.responseLength || "brief");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(account?.interactionMode || "guide");
  const [pointer, setPointer] = useState({ x: 50, y: 45 });
  const interviewInput = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftStatus, setDraftStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");

  const allInterviewQuestions = [...interviewerQuestions, ...dynamicQuestions];
  useEffect(() => { if (stage === "survey" && surveyStep < allInterviewQuestions.length) interviewInput.current?.focus(); }, [stage, surveyStep, allInterviewQuestions.length]);
  useEffect(() => {
    if (stage !== "survey" || !current) return;
    let cancelled = false;
    void fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { draft?: { answers?: Array<{ id?: string; value?: string }>; currentStep?: number; responseLength?: ResponseLength; interactionMode?: InteractionMode } | null; dynamicQuestions?: Array<{ id: string; prompt: string; source?: "ai" | "deterministic" }> };
      if (cancelled) return;
      const restoredDynamic = (result.dynamicQuestions || []).slice(0, 2).map((item) => ({ id: item.id, prompt: item.prompt, helper: "Optional · Mira chose this question from your earlier answers. Skip it if it is not useful.", placeholder: "A short answer is enough…", required: false, source: item.source || "deterministic" }));
      setDynamicQuestions(restoredDynamic);
      if (response.ok && result.draft) {
        const restoredQuestions = [...interviewerQuestions, ...restoredDynamic];
        const step = Math.max(0, Math.min(restoredQuestions.length, Number(result.draft.currentStep || 0)));
        const restoredById = new Map((result.draft.answers || []).map((item) => [item.id || "", item.value || ""]));
        setAnswers(restoredQuestions.slice(0, step).map((item) => restoredById.get(item.id) || ""));
        setAnswer(restoredById.get(restoredQuestions[step]?.id || "") || "");
        setSurveyStep(step);
        setResponseLength(result.draft.responseLength || "brief");
        setInteractionMode(result.draft.interactionMode || "guide");
      }
      setDraftStatus("idle");
    }).catch(() => { if (!cancelled) setDraftStatus("error"); });
    return () => { cancelled = true; };
  }, [stage, current?.participantId]);

  async function accountAction(action: string, extra: Record<string, unknown> = {}) {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const result = await response.json() as { account?: PortalUser; error?: string };
      if (!response.ok || !result.account) throw new Error(result.error || "Your event account could not be updated.");
      setCurrent(result.account);
      return result.account;
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Something went wrong."); return null; }
    finally { setSaving(false); }
  }

  async function saveDraft(nextAnswers: string[], nextStep: number, questions = allInterviewQuestions) {
    setDraftStatus("saving");
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: true, currentStep: nextStep, answers: questions.map((item, index) => ({ id: item.id, value: nextAnswers[index] || "" })), responseLength, interactionMode }) });
      if (!response.ok) throw new Error();
      setDraftStatus("saved");
    } catch { setDraftStatus("error"); }
  }

  async function continueSurvey(forcedAnswer?: string) {
    const question = allInterviewQuestions[surveyStep];
    const responseValue = forcedAnswer === undefined ? answer.trim() : forcedAnswer.trim();
    if (question?.required && !responseValue) return;
    const nextAnswers = [...answers, responseValue];
    setAnswers(nextAnswers);
    const nextStep = surveyStep + 1;
    await saveDraft(nextAnswers, nextStep);
    if (nextStep >= allInterviewQuestions.length && dynamicQuestions.length < 2) {
      setGeneratingFollowup(true);
      try {
        const response = await fetch("/api/onboarding/follow-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          callIndex: dynamicQuestions.length,
          answers: allInterviewQuestions.map((item, index) => ({ id: item.id, label: item.prompt, value: nextAnswers[index] || "" })),
        }) });
        const result = await response.json() as { question?: { id: string; prompt: string; source?: "ai" | "deterministic" }; error?: string };
        if (!response.ok || !result.question) throw new Error(result.error || "Mira could not prepare a follow-up.");
        setDynamicQuestions((items) => [...items, { id: result.question!.id, prompt: result.question!.prompt, helper: "Optional · Mira chose this question from your earlier answers. Skip it if it is not useful.", placeholder: "A short answer is enough…", required: false, source: result.question!.source || "deterministic" }]);
      } catch {
        // Dynamic questions must never block onboarding. Continue to preferences if the service is unavailable.
      } finally { setGeneratingFollowup(false); }
    }
    setAnswer("");
    setSurveyStep(nextStep);
  }

  function previousSurvey() {
    if (surveyStep < 1) return;
    const previous = answers[answers.length - 1] || "";
    setAnswers((items) => items.slice(0, -1));
    setSurveyStep((value) => value - 1);
    setAnswer(previous);
    setDraftStatus("idle");
  }

  if (stage === "auth") return <AgentForgeAuthPanel eventName={eventName} />;

  if (stage === "consent" && current) return <div className="consent-page"><header><div><span className="brand-mark">A</span><span><strong>AgentForge</strong><small>{eventName}</small></span></div><span>PRIVACY CONSENT</span></header><main><section className="policy-document"><span className="demo-policy-badge">DEMO POLICY · REPLACE AFTER REVIEW</span><h1>Before your agent remembers anything.</h1><p className="policy-lead">This policy demonstrates the consent flow and still requires organizer and legal review.</p>{demoPrivacySections.map(([title, copy]) => <article key={title}><h2>{title}</h2><p>{copy}</p></article>)}</section><aside className="consent-card"><span className="eyebrow">YOUR CHOICES</span><h2>Review and confirm</h2><p>The policy version, exact choices, participant registration, and timestamp are stored together.</p>{["I understand which prompts, responses, and activity may be recorded.", "I understand that selected event data may be stored in Cognee for memory and learning analysis.", "I will not enter credentials or sensitive personal information."].map((item, index) => <label key={item}><input type="checkbox" checked={consentChecks[index]} onChange={() => setConsentChecks((items) => items.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span>{item}</span></label>)}{error && <p className="entry-error">{error}</p>}<button className="primary" disabled={saving || !consentChecks.every(Boolean)} onClick={async () => { const next = await accountAction("accept_consent", { choices: consentChecks }); if (next) setStage("survey"); }}>{saving ? "Saving consent…" : "Agree & meet Mira →"}</button><button className="consent-signout" onClick={() => void endSession()}>I do not agree · sign out</button><small>Demo consent version: AF-DEMO-2026-07</small></aside></main></div>;

  if (stage === "team" && current) return <div className="entry-survey team-entry"><header><div><span className="brand-mark">A</span><span><strong>{eventName}</strong><small>TEAM SETUP</small></span></div><span>ONE ACTIVE TEAM PER PERSON</span></header><main><section><span className="eyebrow">TEAM MEMBERSHIP</span><h1>Build with a team—or start solo.</h1><p>Create a team and share its invite code, join an existing team, or create a private Personal Workspace. Team changes later are handled by an Organizer so earlier Shared Space access stays auditable.</p><div className="auth-tabs"><button className={teamMode === "create" ? "active" : ""} onClick={() => setTeamMode("create")}>Create team</button><button className={teamMode === "join" ? "active" : ""} onClick={() => setTeamMode("join")}>Join team</button></div><label>{teamMode === "create" ? "TEAM NAME" : "INVITE CODE"}<input value={teamValue} onChange={(event) => setTeamValue(event.target.value)} placeholder={teamMode === "create" ? "Example: Team Synapse" : "8-character code"} /></label>{error && <p className="entry-error">{error}</p>}<div className="entry-survey-actions"><button className="text-button" disabled={saving} onClick={async () => { const next = await accountAction("continue_solo"); if (next) setStage("orientation"); }}>{saving ? "Creating workspace…" : "Continue with a Personal Workspace"}</button><button className="primary" disabled={saving || !teamValue.trim()} onClick={async () => { const next = await accountAction(teamMode === "create" ? "create_team" : "join_team", teamMode === "create" ? { teamName: teamValue } : { inviteCode: teamValue }); if (next) setStage("orientation"); }}>{saving ? "Saving…" : teamMode === "create" ? "Create team →" : "Join team →"}</button></div></section><aside><span>YOUR EVENT IDENTITY</span><div className="filled"><b>✓</b><span>{current.displayName}<small>{current.email}</small></span></div><div className="filled"><b>✓</b><span>Consent recorded<small>{current.consentVersion}</small></span></div><div><b>3</b><span>Team membership<small>Waiting for your choice</small></span></div></aside></main></div>;

  if (stage === "orientation" && current) return <div className="fevi-orientation"><header><div><span className="brand-mark">A</span><span><strong>{eventName}</strong><small>HOW WE SUPPORT YOUR REASONING</small></span></div><span>READY TO BUILD</span></header><main><section className="fevi-orientation-hero"><span className="eyebrow">A LIGHTWEIGHT LEARNING SCAFFOLD</span><h1>Use AI actively—not automatically.</h1><p>FEVI is a four-step habit for working with AI. It is here to support your decisions, not to grade your intelligence or writing style.</p><div className="fevi-orientation-grid">{[
    ["F", "Formulate", "State the goal, useful context, boundaries, and what success looks like."],
    ["E", "Engage", "Ask for the kind of help you need: a hint, critique, comparison, or breakdown."],
    ["V", "Verify", "Check claims, logic, sources, assumptions, code, and test results before relying on them."],
    ["I", "Integrate", "Choose what to accept, change, or reject—and make the final decision your own."],
  ].map(([letter, title, copy]) => <article key={letter}><b>{letter}</b><div><strong>{title}</strong><p>{copy}</p></div></article>)}</div></section><aside className="fevi-research-notice"><span className="eyebrow">WHAT YOU MAY SEE</span><h2>Occasional, clearly labeled practice checks</h2><p>During the event, AgentForge may invite you to compare options, answer a short multiple-choice question, or inspect a deliberately incomplete or mixed-quality response.</p><ul><li>Every research check is clearly labeled.</li><li>You can skip it without losing access to help.</li><li>Normal Ask AI support is not intentionally degraded.</li><li>The goal is to practice noticing, checking, and deciding—not to catch you out.</li></ul><p className="fevi-reward-note"><strong>No score is shown here.</strong> Your reasoning evidence stays separate from event judging unless the event team publishes a separate, consented award process.</p>{error && <p className="entry-error">{error}</p>}<button className="primary" disabled={saving} onClick={async () => { setSaving(true); setError(""); try { const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orientationAcknowledged: true }) }); if (!response.ok) throw new Error("Your orientation acknowledgement could not be saved."); onComplete({ ...current, orientationCompleted: true }); } catch (problem) { setError(problem instanceof Error ? problem.message : "Your orientation acknowledgement could not be saved."); } finally { setSaving(false); } }}>{saving ? "Saving…" : "I understand · enter the portal →"}</button></aside></main></div>;

  const complete = surveyStep >= allInterviewQuestions.length;
  const question = allInterviewQuestions[surveyStep];
  const visualStyle = { "--interview-x": `${pointer.x}%`, "--interview-y": `${pointer.y}%`, "--typing-energy": Math.min(1, answer.length / 180) } as React.CSSProperties;
  return <div className="entry-survey interviewer-entry" style={visualStyle} onMouseMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); setPointer({ x: ((event.clientX - bounds.left) / bounds.width) * 100, y: ((event.clientY - bounds.top) / bounds.height) * 100 }); }}><div className="interviewer-atmosphere" aria-hidden="true"><i /><i /><i /><i /></div><header><div><span className="brand-mark">A</span><span><strong>{eventName}</strong><small>PARTICIPANT INTERVIEW</small></span></div><span>{complete ? "YOUR AI PREFERENCES" : `QUESTION ${surveyStep + 1} OF ${allInterviewQuestions.length}`}</span></header><main><section className="interviewer-card"><div className="interviewer-presence"><span className="interviewer-orb">✦</span><span><strong>Mira · AgentForge Interviewer</strong><small>{complete ? "One last choice before we begin" : question.required ? "Listening · required question" : question.source === "ai" ? "AI-selected · optional question" : "Listening · optional question"}</small></span></div>{complete ? <><span className="eyebrow">YOU CONTROL THE INTERACTION</span><h1>How should Ask AI work with you?</h1><p>These preferences change how answers are presented. You can change them inside Ask AI at any time.</p><InteractionPreferencePicker responseLength={responseLength} interactionMode={interactionMode} onLength={setResponseLength} onMode={setInteractionMode} />{error && <p className="entry-error">{error}</p>}<div className="draft-state" data-state={draftStatus}>{draftStatus === "saving" ? "Saving…" : draftStatus === "saved" ? "Draft saved" : draftStatus === "error" ? "Draft could not be saved" : "Your answers are saved as you continue"}</div><div className="entry-survey-actions"><button className="text-button" onClick={previousSurvey}>← Previous</button><button className="primary" disabled={saving} onClick={async () => { setSaving(true); setError(""); try { const payload = { answers: allInterviewQuestions.map((item, index) => ({ id: item.id, value: answers[index] || "" })), responseLength, interactionMode }; const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Your interview could not be saved."); if (current) { const completed = { ...current, onboardingCompleted: true, responseLength, interactionMode }; setCurrent(completed); setStage("team"); } } catch (problem) { setError(problem instanceof Error ? problem.message : "Your interview could not be saved."); } finally { setSaving(false); } }}>{saving ? "Saving your profile…" : "Continue to team setup →"}</button></div></> : <><span className="eyebrow">GETTING TO KNOW HOW YOU LEARN</span><h1>{question.prompt}</h1><p>{question.helper}</p>{question.example && <p className="interviewer-example">{question.example}</p>}{question.choices && <div className="interviewer-choices">{question.choices.map((choice) => <button type="button" key={choice} className={answer === choice ? "selected" : ""} onClick={() => { setAnswer(choice); interviewInput.current?.focus(); }}>{choice}</button>)}</div>}<textarea ref={interviewInput} autoFocus rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !generatingFollowup) { event.preventDefault(); void continueSurvey(); } }} placeholder={question.placeholder} /><div className="draft-state" data-state={draftStatus}>{generatingFollowup ? "Mira is choosing one useful optional follow-up…" : draftStatus === "loading" ? "Checking for a saved draft…" : draftStatus === "saving" ? "Saving…" : draftStatus === "saved" ? "Saved" : draftStatus === "error" ? "Could not save—try Next again" : "Changes save when you continue"}</div><div className="entry-survey-actions"><button className="text-button" disabled={surveyStep === 0 || generatingFollowup} onClick={previousSurvey}>← Previous</button><button className="text-button save-exit" disabled={generatingFollowup} onClick={async () => { const nextAnswers = [...answers]; nextAnswers[surveyStep] = answer.trim(); await saveDraft(nextAnswers, surveyStep); await endSession(); window.location.reload(); }}>Save & continue later</button>{!question.required && <button className="text-button" disabled={generatingFollowup} onClick={() => { setAnswer(""); void continueSurvey(""); }}>Skip for now</button>}<small>Press Enter or choose Next</small><button className="primary" disabled={generatingFollowup || (question.required && !answer.trim())} onClick={() => void continueSurvey()}>{generatingFollowup ? "Preparing next question…" : "Next →"}</button></div></>}</section><aside className="interviewer-progress"><span>YOUR PROFILE · RAW SELF-REPORT</span><p>Mira may ask up to two optional follow-ups. Your answers remain separate from future AI inference and can be reviewed in My Data.</p>{allInterviewQuestions.map((item, index) => <div className={index < answers.length ? "filled" : index === surveyStep ? "active" : ""} key={item.id}><b>{index < answers.length ? "✓" : index + 1}</b><span>{item.id.replaceAll("_", " ")}<small>{index < answers.length ? answers[index] ? answers[index].slice(0, 55) : "Skipped for now" : index === surveyStep ? item.required ? "Current · required" : "Current · optional" : item.required ? "Required" : "Optional"}</small></span></div>)}</aside></main></div>;
}

type EventConfig = { eventName?: string; startsAt?: number | null; endsAt?: number | null; timezone?: string; discordUrl?: string | null; announcementText?: string | null; announcementActive?: number | boolean; announcementUpdatedAt?: number | null; registrationOpen?: number | boolean; maxActiveTeams?: number; updatedAt?: number };
type PublishedAnnouncement = { id: string; announcementText: string; action: "published" | "updated"; createdAt: number };

function LiveEvent({ config }: { config: EventConfig | null }) {
  const [now, setNow] = useState(0);
  useEffect(() => { const tick = () => setNow(Date.now()); const initial = window.setTimeout(tick, 0); const interval = window.setInterval(tick, 1000); return () => { window.clearTimeout(initial); window.clearInterval(interval); }; }, []);
  const start = Number(config?.startsAt || 0), end = Number(config?.endsAt || 0);
  const target = now < start ? start : end;
  const remaining = Math.max(0, target - now);
  const hours = Math.floor(remaining / 3600000), minutes = Math.floor((remaining % 3600000) / 60000), seconds = Math.floor((remaining % 60000) / 1000);
  const label = !start || !end ? "SCHEDULE PENDING" : now < start ? "STARTS IN" : now < end ? "LIVE EVENT" : "EVENT ENDED";
  return <><div className={`event-chip live-countdown ${now >= start && now < end ? "is-live" : ""}`}><span className="live-dot" /> {label}<b>{start && end ? now >= end ? "Complete" : `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s` : "Set time"}</b></div>{config?.discordUrl && <a className="discord-link" href={config.discordUrl} target="_blank" rel="noreferrer">Join Discord ↗</a>}</>;
}

export function HackathonPortal() {
  const [view, setView] = useState<View>("home");
  const viewHistoryInitialized = useRef(false);
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [organizerParticipantMode, setOrganizerParticipantMode] = useState(false);
  const [perspectiveReady, setPerspectiveReady] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<PortalUser | null>(null);
  const [entryReady, setEntryReady] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [assistantOpened, setAssistantOpened] = useState(false);
  const [assistantWorking, setAssistantWorking] = useState(false);
  const [viewRestored, setViewRestored] = useState(false);
  const [assistantContext, setAssistantContext] = useState("");
  const [selectionAction, setSelectionAction] = useState<SelectionAction>(null);
  const [selectionCoachVisible, setSelectionCoachVisible] = useState(false);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState("");
  const [assistantDraft, setAssistantDraft] = useState<{ text: string; nonce: number } | undefined>();
  const [assistantScaffold, setAssistantScaffold] = useState<AssistantScaffold | undefined>();
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [publishedAnnouncements, setPublishedAnnouncements] = useState<PublishedAnnouncement[]>([]);
  const [announcementHistoryOpen, setAnnouncementHistoryOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        // Refresh the secure Supabase session cookie when possible before
        // resolving the participant's D1 event account.
        await fetch("/api/auth/session", { cache: "no-store" });
        const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bootstrap" }) });
        const result = await response.json() as { account?: PortalUser };
        if (!response.ok || !result.account || cancelled) return;
        if (result.account.role === "organizer" || (result.account.consentVersion !== "pending" && Boolean(result.account.onboardingCompleted) && Boolean(result.account.teamId) && Boolean(result.account.orientationCompleted))) setPortalUser(result.account);
        else setPendingAccount(result.account);
      } finally { if (!cancelled) setEntryReady(true); }
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!portalUser) return;
    const refresh = async () => {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.status === 401) {
        setPortalUser(null);
        setPendingAccount(null);
      }
    };
    const interval = window.setInterval(() => void refresh(), 45 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [portalUser]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrganizerParticipantMode(window.sessionStorage.getItem("agentforge_organizer_participant_mode") === "true");
      setPerspectiveReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const validViews: View[] = ["home", "onboarding", "useCases", "learn", "clawmaxTutorial", "companyBrainTutorial", "progress", "coach", "demo", "team", "model", "data", "admin", "eventAdmin", "settings", "policy"];
    const requested = window.location.hash.replace(/^#\/?/, "") || window.localStorage.getItem("agentforge_current_view") || "home";
    const restoreTimer = window.setTimeout(() => { if (validViews.includes(requested as View)) setView(requested as View); setViewRestored(true); }, 0);
    const restoreFromHistory = () => {
      const next = window.location.hash.replace(/^#\/?/, "");
      if (validViews.includes(next as View)) setView(next as View);
    };
    window.addEventListener("hashchange", restoreFromHistory);
    window.addEventListener("popstate", restoreFromHistory);
    return () => {
      window.clearTimeout(restoreTimer);
      window.removeEventListener("hashchange", restoreFromHistory);
      window.removeEventListener("popstate", restoreFromHistory);
    };
  }, []);

  useEffect(() => {
    if (!viewRestored) return;
    window.localStorage.setItem("agentforge_current_view", view);
    const nextHash = `#/${view}`;
    if (!viewHistoryInitialized.current) {
      viewHistoryInitialized.current = true;
      if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
      return;
    }
    if (window.location.hash !== nextHash) window.history.pushState(null, "", nextHash);
  }, [view, viewRestored]);

  useEffect(() => {
    const updateWorking = (event: Event) => setAssistantWorking(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("agentforge-assistant-working", updateWorking);
    return () => window.removeEventListener("agentforge-assistant-working", updateWorking);
  }, []);

  useEffect(() => {
    if (!portalUser) return;
    const timer = window.setTimeout(() => setSelectionCoachVisible(window.localStorage.getItem("agentforge_selection_coach_seen") !== "true"), 0);
    return () => window.clearTimeout(timer);
  }, [portalUser]);

  useEffect(() => {
    const dismissSelectionAction = (event: MouseEvent) => {
      if (!(event.target as HTMLElement | null)?.closest(".selection-context-menu")) setSelectionAction(null);
    };
    const dismissOnScroll = () => setSelectionAction(null);
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectionAction(null); };
    document.addEventListener("mousedown", dismissSelectionAction);
    document.addEventListener("keydown", dismissOnEscape);
    window.addEventListener("scroll", dismissOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", dismissSelectionAction);
      document.removeEventListener("keydown", dismissOnEscape);
      window.removeEventListener("scroll", dismissOnScroll, true);
    };
  }, []);

  useEffect(() => { const refresh = async () => { try { const response = await fetch(`/api/event?updated=${Date.now()}`); const result = await response.json() as { config?: EventConfig; publishedAnnouncements?: PublishedAnnouncement[] }; if (response.ok) { setEventConfig(result.config || null); setPublishedAnnouncements(result.publishedAnnouncements || []); } } catch { /* current configuration remains visible during a temporary network failure */ } }; const timer = window.setTimeout(() => void refresh(), 0); const interval = window.setInterval(() => void refresh(), 30000); return () => { window.clearTimeout(timer); window.clearInterval(interval); }; }, []);

  const participantSurface = portalUser?.role !== "organizer" || organizerParticipantMode;

  function openAssistant(scaffold?: AssistantScaffold) {
    setAssistantScaffold(scaffold);
    setAssistantOpened(true);
    setAssistant(true);
  }

  function offerSelectedContext(target: EventTarget | null) {
    if (view === "admin" || view === "eventAdmin") return;
    if ((target as HTMLElement | null)?.closest("input, textarea, button, a, .assistant, .selection-context-menu")) return;
    const selection = window.getSelection();
    const selected = selection?.toString().trim() || "";
    if (selected.length <= 2 || !selection?.rangeCount) {
      setSelectionAction(null);
      return;
    }
    const bounds = selection.getRangeAt(0).getBoundingClientRect();
    if (!bounds.width && !bounds.height) return;
    const safeHalfWidth = Math.min(126, Math.max(20, window.innerWidth / 2 - 12));
    const left = Math.min(window.innerWidth - safeHalfWidth, Math.max(safeHalfWidth, bounds.left + bounds.width / 2));
    const preferredTop = bounds.bottom + 12 < window.innerHeight - 54 ? bounds.bottom + 12 : bounds.top - 52;
    const top = Math.min(window.innerHeight - 54, Math.max(12, preferredTop));
    setSelectionAction({ text: selected.slice(0, 4000), left, top });
  }

  function completeSelectionCoach() {
    window.localStorage.setItem("agentforge_selection_coach_seen", "true");
    setSelectionCoachVisible(false);
  }

  async function saveSelectedNote() {
    if (!selectionAction || selectionAction.status === "saving") return;
    const selected = selectionAction;
    setSelectionAction({ ...selected, status: "saving" });
    try {
      const response = await fetch("/api/learning-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: selected.text, selectedText: selected.text, sourceType: "selection", sourcePage: title }) });
      if (!response.ok) throw new Error("The note could not be saved.");
      setSelectionAction({ ...selected, status: "saved" });
      completeSelectionCoach();
      window.dispatchEvent(new CustomEvent("agentforge-learner-note-saved"));
    } catch { setSelectionAction({ ...selected, status: "error" }); }
  }

  async function openClawMaxFromNavigation() {
    try {
      const response = await fetch("/api/clawmax/enrollments", { method: "POST" });
      const result = await response.json() as { launchUrl?: string; error?: string };
      if (!response.ok || !result.launchUrl) throw new Error(result.error || "ClawMax could not be opened.");
      window.open(result.launchUrl, "_blank", "noopener,noreferrer");
    } catch (problem) {
      setAssistantContext(problem instanceof Error ? problem.message : "ClawMax could not be opened.");
      setAssistantDraft({ text: "Help me connect to ClawMax and explain what I need to complete first.", nonce: Date.now() });
      openAssistant();
    }
  }

  const title = view === "useCases" ? "Use Case Illustrations" : view === "companyBrainTutorial" ? "Company Brain Tutorial" : view === "team" ? "Team Space" : view === "model" ? "My Learning Model" : view === "data" ? "My Data" : view === "settings" ? "Settings" : view === "policy" ? "Data Policy & Consent" : view === "eventAdmin" ? "Event Management" : view === "admin" ? "Organizer View" : nav.find((item) => item.id === view)?.label ?? "Overview";

  function enterPortal(user: PortalUser) {
    setPortalUser(user);
    setPendingAccount(null);
    setOrganizerParticipantMode(false);
    window.sessionStorage.removeItem("agentforge_organizer_participant_mode");
    setView(user.role === "organizer" ? "admin" : "home");
    window.history.replaceState(null, "", `#/${user.role === "organizer" ? "admin" : "home"}`);
  }

  function enterParticipantDemo() {
    window.sessionStorage.setItem("agentforge_organizer_participant_mode", "true");
    setOrganizerParticipantMode(true);
    setView("home");
  }

  function returnToOrganizer() {
    window.sessionStorage.removeItem("agentforge_organizer_participant_mode");
    setOrganizerParticipantMode(false);
    setAssistant(false);
    setView("admin");
  }

  function signOut() { void endSession(); }

  useEffect(() => {
    if (!portalUser || !perspectiveReady) return;
    const participantViews: View[] = ["home", "onboarding", "useCases", "learn", "clawmaxTutorial", "companyBrainTutorial", "progress", "demo", "team", "model", "data", "settings", "policy"];
    const organizerViews: View[] = ["admin", "eventAdmin"];
    const showingParticipant = portalUser.role !== "organizer" || organizerParticipantMode;
    const allowed = showingParticipant ? participantViews : organizerViews;
    if (!allowed.includes(view)) {
      const timer = window.setTimeout(() => setView(showingParticipant ? "home" : "admin"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [portalUser, view, organizerParticipantMode, perspectiveReady]);

  if (!entryReady) return <div className="entry-loading"><span className="brand-mark">A</span><p>Preparing your event…</p></div>;
  if (!portalUser) return <EntryFlow eventName={eventConfig?.eventName || "Personal Agent Hackathon"} account={pendingAccount} onComplete={enterPortal} />;

  return (
    <div className="app-shell" onMouseUp={(event) => offerSelectedContext(event.target)} onTouchEnd={(event) => window.setTimeout(() => offerSelectedContext(event.target), 0)}>
      <aside className="sidebar">
        <button className="brand" onClick={() => setView(participantSurface ? "home" : "admin")} aria-label="AgentForge home">
          <span className="brand-mark">A</span>
          <span><strong>AgentForge</strong><small>HACKATHON OS</small></span>
        </button>

        {participantSurface && <LiveEvent config={eventConfig} />}

        <nav aria-label="Main navigation">
          {participantSurface ? <><p className="nav-label">{portalUser.role === "organizer" ? "PARTICIPANT DEMO" : "YOUR HACKATHON"}</p>
          {nav.map((item) => (
            <button key={item.id} className={`${view === item.id ? "nav-item active" : "nav-item"}${item.id === "progress" || item.id === "demo" ? " mobile-core" : ""}`} onClick={() => setView(item.id)}>
              <Icon>{item.icon}</Icon>{item.label}
            </button>
          ))}
          <p className="nav-label">YOUR LEARNING RECORD</p>
          <button className={view === "model" ? "nav-item active" : "nav-item"} onClick={() => setView("model")}><Icon>⌬</Icon>Learning Model</button>
          <button className={view === "data" ? "nav-item active" : "nav-item"} onClick={() => setView("data")}><Icon>▦</Icon>My Data</button>
          <p className="nav-label secondary-nav-label">TEAM COLLABORATION</p>
          <button className={view === "team" ? "nav-item active" : "nav-item"} onClick={() => setView("team")}><Icon>♧</Icon>Shared Space<span className="status-dot on" /></button>
          <button className="nav-item clawmax-nav-link" onClick={() => void openClawMaxFromNavigation()} title="Open the event ClawMax workspace in a new tab"><Icon>↗</Icon>Open ClawMax</button>
          {portalUser.role === "organizer" && <><p className="nav-label">DEMO CONTROLS</p><button className="nav-item perspective-switch return" onClick={returnToOrganizer}><Icon>←</Icon>Return to Organizer</button></>}
          </> : <><p className="nav-label">ORGANIZER CONTROL ROOM</p>
          <button className={view === "admin" ? "nav-item active" : "nav-item"} onClick={() => setView("admin")}><Icon>▥</Icon>Organizer View</button>
          <button className={view === "eventAdmin" ? "nav-item active" : "nav-item"} onClick={() => setView("eventAdmin")}><Icon>◷</Icon>Event Management</button>
          <button className="nav-item perspective-switch" onClick={enterParticipantDemo}><Icon>▶</Icon>Switch to Participant</button>
          </>}
        </nav>

        <div className="sidebar-bottom">
          {participantSurface && <button className={view === "settings" ? "nav-item active" : "nav-item"} onClick={() => setView("settings")}><Icon>⚙</Icon>Settings</button>}
          <div className="profile"><span className="avatar">{portalUser.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{portalUser.displayName}</strong><small>{portalUser.role === "organizer" ? organizerParticipantMode ? "Organizer · Participant demo" : "Organizer account" : "Participant · Team pending"}</small></span><button onClick={signOut} title="Sign out" aria-label="Sign out">↪</button></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p>{(eventConfig?.eventName || "Personal Agent Hackathon").toUpperCase()}</p><h1>{title}</h1></div>
          <div className="top-actions"><span className={`role-chip ${organizerParticipantMode ? "demo" : ""}`}>{organizerParticipantMode ? "PARTICIPANT DEMO" : portalUser.role === "organizer" ? "ORGANIZER PORTAL" : "PARTICIPANT PORTAL"}</span><span className="connection"><i /> Systems connected</span>{organizerParticipantMode && <button className="perspective-return-top" onClick={returnToOrganizer}>Return to Organizer</button>}{participantSurface && <button className="ask-button" onClick={() => openAssistant()}>✦ Ask AI</button>}</div>
        </header>
        {Boolean(eventConfig?.announcementActive) && eventConfig?.announcementText && <div className="global-announcement" role="status"><span>EVENT ANNOUNCEMENT</span><p>{eventConfig.announcementText}</p><small>{eventConfig.announcementUpdatedAt ? `Updated ${new Date(Number(eventConfig.announcementUpdatedAt)).toLocaleString()}` : "Organizer broadcast"}</small><button type="button" onClick={() => setAnnouncementHistoryOpen(true)} aria-haspopup="dialog">View history →</button></div>}
        {organizerParticipantMode && <div className="participant-demo-banner"><div><strong>Organizer participant demo</strong><span>You are using your real organizer account inside the participant experience. Create or join a shared demo team to rehearse the live workflow.</span></div><button onClick={returnToOrganizer}>Exit demo mode</button></div>}

        <section className="content">
          {selectionCoachVisible && participantSurface && view === "home" && <aside className="selection-coach" aria-label="Text selection tutorial"><div className="selection-coach-orbit" aria-hidden="true"><i /><i /><span>✦</span></div><div><span className="eyebrow">TRY ASK AI IN CONTEXT</span><strong>Select the sentence below, then choose what to do.</strong><p className="selection-practice-line">What should my agent remember, what should it verify, and where should I stay in control?</p></div><button type="button" aria-label="Dismiss text selection tutorial" onClick={completeSelectionCoach}>×</button></aside>}
          {view === "home" && <Overview setView={setView} />}
          {view === "onboarding" && (
            <AgentCanvas selectedUseCaseId={selectedUseCaseId} onOpenClawMax={() => void openClawMaxFromNavigation()} onOpenUseCase={(id) => { setSelectedUseCaseId(id); setView("useCases"); }} onAskScaffold={(draft, context, scaffold) => { setAssistantContext(context); setAssistantDraft({ text: draft, nonce: Date.now() }); openAssistant(scaffold); }} />
          )}
          {view === "useCases" && <UseCaseLibrary initialId={selectedUseCaseId} onBack={() => setView("onboarding")} onUse={(id) => { setSelectedUseCaseId(id); setView("onboarding"); }} />}
          {view === "learn" && <LearningCenter setAssistant={(open) => { if (open) openAssistant(); else setAssistant(false); }} setView={setView} />}
          {view === "clawmaxTutorial" && <ClawMaxTutorial onOpen={() => void openClawMaxFromNavigation()} />}
          {view === "companyBrainTutorial" && <CompanyBrainTutorial onBack={() => setView("learn")} onAsk={(text, context) => { setAssistantContext(context); setAssistantDraft({ text, nonce: Date.now() }); openAssistant(); }} />}
          {view === "progress" && <Progress />}
          {view === "coach" && <PromptCoach />}
          {view === "demo" && <Demo />}
          {view === "team" && <TeamSpace />}
          {view === "model" && <MyLearningModel />}
          {view === "data" && <MyData setView={setView} />}
          {view === "admin" && <Admin />}
          {view === "eventAdmin" && <EventManagement config={eventConfig} onSaved={setEventConfig} />}
          {view === "settings" && <Settings setView={setView} />}
          {view === "policy" && <DataPolicy onBack={() => setView("settings")} />}
        </section>
      </main>

      {selectionAction && participantSurface && <div className="selection-context-menu" style={{ left: selectionAction.left, top: selectionAction.top }} onMouseDown={(event) => event.preventDefault()} role="dialog" aria-label="Actions for selected text">{selectionAction.status === "saved" ? <><span className="selection-saved">✓ Saved to Learner Center</span><button type="button" onClick={() => { setSelectionAction(null); setView("learn"); }}>Open →</button></> : <><button type="button" onClick={() => { setAssistantContext(selectionAction.text); setSelectionAction(null); completeSelectionCoach(); openAssistant(); }}><span>✦</span>Ask AI</button><button type="button" disabled={selectionAction.status === "saving"} onClick={() => void saveSelectedNote()}><span>▤</span>{selectionAction.status === "saving" ? "Saving…" : selectionAction.status === "error" ? "Try Notes again" : "Take Notes"}</button></>}</div>}
      {assistantOpened && <div className={assistant ? "assistant-mounted" : "assistant-mounted hidden"}><Assistant close={() => setAssistant(false)} page={title} selectedContext={assistantContext} draft={assistantDraft} scaffold={assistantScaffold} /></div>}
      {assistantOpened && !assistant && <button className={`assistant-minimized ${assistantWorking ? "working" : ""}`} onClick={() => setAssistant(true)} aria-label={assistantWorking ? "AI is still thinking. Reopen assistant" : "Reopen AI Assistant"}><span className="assistant-mini-orb">✦</span><span><strong>{assistantWorking ? "AI is thinking…" : "AI Assistant"}</strong><small>{assistantWorking ? "You can keep working" : "Click to reopen"}</small></span></button>}
      {announcementHistoryOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setAnnouncementHistoryOpen(false)}><section className="participant-announcement-history" role="dialog" aria-modal="true" aria-labelledby="announcement-history-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">EVENT UPDATES</span><h2 id="announcement-history-title">Published announcements</h2></div><button type="button" onClick={() => setAnnouncementHistoryOpen(false)} aria-label="Close announcement history">×</button></header><div>{publishedAnnouncements.length ? publishedAnnouncements.map((item) => <article key={item.id}><small>{new Date(item.createdAt).toLocaleString()}</small><p>{item.announcementText}</p></article>) : <p className="notes-empty">No earlier published announcements yet.</p>}</div></section></div>}
    </div>
  );
}

function Overview({ setView }: { setView: (view: View) => void }) {
  const [team, setTeam] = useState<Pick<TeamOverview, "team" | "members" | "memories" | "questions"> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadTeam() {
      try {
        const response = await fetch("/api/team");
        if (!response.ok) return;
        const result = await response.json() as TeamOverview;
        if (!cancelled) setTeam(result);
      } catch { /* The Shared Space remains available from its navigation item. */ }
    }
    void loadTeam();
    const interval = window.setInterval(() => void loadTeam(), 10000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const teamName = team?.team?.name;
  return <>
    <div className="hero-grid">
      <article className="hero-card">
        <span className="eyebrow">DAY 01 · BUILD</span>
        <h2>Make an agent<br />you’ll use <em>tomorrow.</em></h2>
        <p>Start with one real problem. Give your agent memory. Test it, learn from feedback, and show the improvement.</p>
        <div className="hero-actions"><button className="primary" onClick={() => setView("onboarding")}>Continue building <span>→</span></button><button className="text-button" onClick={() => setView("learn")}>Open learning path</button></div>
      </article>
      <article className="pulse-card">
        <div className="card-heading"><span>RESEARCH CHECK-INS</span><b>3</b></div>
        <div className="radial evidence-radial"><div><strong>3</strong><small>MOMENTS</small></div></div>
        <p><b>Brief, optional reflections.</b><br />Capture what changed without interrupting your build.</p>
        <button onClick={() => setView("progress")}>Open check-ins →</button>
      </article>
    </div>
    <div className="section-title"><div><span>YOUR NEXT MOVES</span><h3>Keep the momentum</h3></div><small>Recommended for your team</small></div>
    <div className="move-grid">
      <button className="move-card accent-violet" onClick={() => setView("learn")}><span className="move-icon">⌁</span><small>LEARN · WHEN NEEDED</small><h4>Use a scaffold<br />only when useful</h4><p>Formulate, engage, verify, integrate.</p><b>Open Learner Center →</b></button>
      <button className="move-card accent-lime" onClick={() => setView("progress")}><span className="move-icon">✓</span><small>REFLECT · UNDER 1 MIN</small><h4>Capture one<br />meaningful episode</h4><p>Record a decision, reason, and confidence.</p><b>Open check-in →</b></button>
      <button className="move-card accent-orange" onClick={() => setView("demo")}><span className="move-icon">◇</span><small>PREP · MIDPOINT</small><h4>Define how you’ll<br />measure success</h4><p>Make improvement visible.</p><b>Create evaluation →</b></button>
    </div>
    <article className="team-strip"><div><span className="team-logo">{teamName?.[0]?.toUpperCase() || "S"}</span><div><small>{teamName || "SHARED SPACE"}</small><h4>{team ? teamName ? "Your shared space is active" : "Create or join a shared space" : "Loading shared space…"}</h4></div></div><div className="team-stats"><span><b>{teamName ? team.members.length : "—"}</b><small>MEMBERS</small></span><span><b>{teamName ? team.memories.length : "—"}</b><small>MEMORIES</small></span><span><b>{teamName ? team.questions.length : "—"}</b><small>QUESTIONS</small></span></div><button onClick={() => setView("team")}>Open shared space →</button></article>
  </>;
}

function AgentCanvas({ selectedUseCaseId, onOpenClawMax, onOpenUseCase, onAskScaffold }: {
  selectedUseCaseId: string;
  onOpenClawMax: () => void;
  onOpenUseCase: (id: string) => void;
  onAskScaffold: (draft: string, context: string, scaffold: AssistantScaffold) => void;
}) {
  const emptyAnswers = () => Object.fromEntries(agentBlueprintQuestions.map((question) => [question.id, { selections: [], detail: "", customOther: [] }])) as BlueprintAnswers;
  const [answers, setAnswers] = useState<BlueprintAnswers>(emptyAnswers);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<"draft" | "completed">("draft");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [referenceUseCaseId, setReferenceUseCaseId] = useState(selectedUseCaseId);
  const lastSavedPayload = useRef("");
  const scaffoldEpisodeIds = useRef<Record<string, string>>({});
  const openedScaffoldEpisodes = useRef(new Set<string>());
  const complete = currentStep >= agentBlueprintQuestions.length;
  const question = complete ? null : agentBlueprintQuestions[currentStep];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/canvas", { cache: "no-store" });
        const result = await response.json() as { blueprint?: { answers?: BlueprintAnswers; currentStep?: number; status?: "draft" | "completed"; projectId?: string | null; selectedUseCaseId?: string | null }; error?: string };
        if (!response.ok) throw new Error(result.error || "Your saved blueprint could not be loaded.");
        if (cancelled) return;
        const restored = { ...emptyAnswers(), ...(result.blueprint?.answers || {}) };
        setAnswers(restored);
        setCurrentStep(Math.max(0, Math.min(agentBlueprintQuestions.length, Number(result.blueprint?.currentStep) || 0)));
        setStatus(result.blueprint?.status || "draft");
        setProjectId(result.blueprint?.projectId || null);
        setReferenceUseCaseId(selectedUseCaseId || result.blueprint?.selectedUseCaseId || "");
        lastSavedPayload.current = JSON.stringify(restored);
      } catch (problem) {
        if (!cancelled) setError(problem instanceof Error ? problem.message : "Your saved blueprint could not be loaded.");
      } finally { if (!cancelled) setHydrated(true); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload = JSON.stringify(answers);
    if (payload === lastSavedPayload.current) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const activeResearchEpisodeId = sessionStorage.getItem("agentforge_active_research_episode") || undefined;
        const response = await fetch("/api/canvas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, currentStep, selectedUseCaseId: referenceUseCaseId, eventType: "draft_autosave", questionId: question?.id || "review", researchEpisodeId: activeResearchEpisodeId }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "Draft could not be saved.");
        lastSavedPayload.current = payload;
        if (activeResearchEpisodeId) sessionStorage.removeItem("agentforge_active_research_episode");
        setSaveState("saved");
      } catch (problem) {
        setSaveState("error");
        setError(problem instanceof Error ? problem.message : "Draft could not be saved.");
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [answers, currentStep, hydrated, question?.id, referenceUseCaseId]);

  async function ensureScaffoldEpisode(item: BlueprintQuestion, step: number) {
    if (scaffoldEpisodeIds.current[item.id]) return scaffoldEpisodeIds.current[item.id];
    const support = scaffoldSupportForStep(step);
    const scaffoldLevel = support === "guided" ? "full" : support === "reduced" ? "faded" : "none";
    try {
      const response = await fetch("/api/research/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "offer", clientKey: `blueprint-v1:${item.id}:${scaffoldLevel}`, questionId: item.id,
        scaffoldLevel, feviStage: feviStageForStep(step), sourcePage: "Design Your Agent",
        currentAnswer: JSON.stringify(answers[item.id] || {}),
      }) });
      const result = await response.json() as { researchEpisodeId?: string };
      if (response.ok && result.researchEpisodeId) scaffoldEpisodeIds.current[item.id] = result.researchEpisodeId;
      return result.researchEpisodeId || "";
    } catch { return ""; }
  }

  async function recordResearchEvent(researchEpisodeId: string, eventType: "opened" | "viewed" | "dismissed" | "skipped" | "acted_on", metadata: Record<string, unknown> = {}) {
    if (!researchEpisodeId) return;
    try { await fetch("/api/research/episodes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "event", researchEpisodeId, eventType, metadata }) }); }
    catch { /* Research telemetry never blocks the participant workflow. */ }
  }

  useEffect(() => {
    if (!hydrated || !question) return;
    void ensureScaffoldEpisode(question, currentStep);
  }, [currentStep, hydrated, question?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const answerFor = (id: string) => answers[id] || { selections: [], detail: "", customOther: [] };
  const hasAnswer = (item: BlueprintQuestion) => {
    const value = answerFor(item.id);
    if (item.optional) return true;
    if (item.detailRequired && !value.detail.trim()) return false;
    if (value.selections.includes("Other") && !(value.customOther || []).some((entry) => entry.trim())) return false;
    return Boolean(value.detail.trim() || value.selections.length);
  };
  const summaryFor = (item: BlueprintQuestion) => {
    const value = answerFor(item.id);
    const selected = value.selections.filter((selection) => selection !== "Other");
    const other = (value.customOther || []).map((entry) => entry.trim()).filter(Boolean).map((entry) => `Other: ${entry}`);
    return [...selected, ...other, value.detail.trim()].filter(Boolean).join(" · ");
  };
  const updateDetail = (value: string) => {
    if (!question) return;
    setStatus("draft");
    setAnswers((items) => ({ ...items, [question.id]: { ...answerFor(question.id), detail: value } }));
  };
  const toggleChoice = (choice: string) => {
    if (!question) return;
    const current = answerFor(question.id);
    const selections = question.multiple ? current.selections.includes(choice) ? current.selections.filter((item) => item !== choice) : [...current.selections, choice] : [choice];
    setStatus("draft");
    setAnswers((items) => ({ ...items, [question.id]: { ...current, selections, customOther: choice === "Other" && !selections.includes("Other") ? [] : current.customOther } }));
  };
  const updateOther = (index: number, value: string) => {
    if (!question) return;
    const current = answerFor(question.id);
    const customOther = current.customOther?.length ? [...current.customOther] : [""];
    customOther[index] = value;
    while (customOther.length > 1 && !customOther.at(-1)?.trim() && !customOther.at(-2)?.trim()) customOther.pop();
    if (value.trim() && index === customOther.length - 1 && customOther.length < 3) customOther.push("");
    setStatus("draft");
    setAnswers((items) => ({ ...items, [question.id]: { ...current, customOther } }));
  };
  async function recordEvent(eventType: string, questionId: string, nextStep = currentStep, extra: Record<string, string> = {}) {
    try {
      const activeResearchEpisodeId = sessionStorage.getItem("agentforge_active_research_episode") || undefined;
      const changedSinceSave = JSON.stringify(answers) !== lastSavedPayload.current;
      await fetch("/api/canvas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, currentStep: nextStep, selectedUseCaseId: referenceUseCaseId, eventType, questionId, researchEpisodeId: activeResearchEpisodeId, ...extra }) });
      lastSavedPayload.current = JSON.stringify(answers);
      if (activeResearchEpisodeId && changedSinceSave) sessionStorage.removeItem("agentforge_active_research_episode");
      setSaveState("saved");
    } catch { setSaveState("error"); }
  }
  async function requestScaffold(action: ScaffoldAction) {
    if (!question) return;
    const supportLevel = scaffoldSupportForStep(currentStep);
    const feviStage = feviStageForStep(currentStep);
    const currentAnswer = summaryFor(question);
    if (supportLevel === "independent" && !currentAnswer) {
      setError("Write your first draft before asking AI to critique this later-stage decision.");
      return;
    }
    const researchEpisodeId = await ensureScaffoldEpisode(question, currentStep);
    if (researchEpisodeId) {
      openedScaffoldEpisodes.current.add(researchEpisodeId);
      await recordResearchEvent(researchEpisodeId, "opened", { action, questionId: question.id, supportLevel, feviStage });
    }
    const scaffold: AssistantScaffold = { action, questionId: question.id, supportLevel, feviStage, currentAnswer, selectedUseCaseId: referenceUseCaseId || undefined, researchEpisodeId: researchEpisodeId || undefined };
    await recordEvent("scaffold_opened", question.id, currentStep, { scaffoldAction: action, supportLevel, feviStage });
    const actionPrompt = action === "clarify"
      ? "Clarify what this design question is asking me. Ask one useful follow-up question, but do not write my answer."
      : action === "directions"
        ? "Give me two different directions I could consider for this design decision. Explain the trade-off briefly, but leave the choice and wording to me."
        : "Challenge my current answer. Point out one missing boundary, assumption, or test I should reconsider, without rewriting it for me.";
    onAskScaffold(actionPrompt, `Agent Blueprint · ${question.label} · FEVI ${feviStage} · ${supportLevel} support`, scaffold);
  }
  async function continueForward() {
    if (!question || !hasAnswer(question)) {
      setError("Add a short answer before continuing. You can change it later.");
      return;
    }
    setError("");
    const nextStep = Math.min(agentBlueprintQuestions.length, currentStep + 1);
    const offeredEpisodeId = scaffoldEpisodeIds.current[question.id] || await ensureScaffoldEpisode(question, currentStep);
    if (offeredEpisodeId && !openedScaffoldEpisodes.current.has(offeredEpisodeId)) await recordResearchEvent(offeredEpisodeId, "skipped", { questionId: question.id, nextStep });
    await recordEvent("answer_saved", question.id, nextStep);
    setCurrentStep(nextStep);
  }
  async function completeBlueprint() {
    setSaveState("saving");
    setError("");
    try {
      const response = await fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, currentStep: agentBlueprintQuestions.length, selectedUseCaseId: referenceUseCaseId }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Blueprint could not be completed.");
      setProjectId(result.id);
      setStatus("completed");
      setSaveState("saved");
      lastSavedPayload.current = JSON.stringify(answers);
    } catch (problem) {
      setSaveState("error");
      setError(problem instanceof Error ? problem.message : "Blueprint could not be completed.");
    }
  }

  if (!hydrated) return <div className="agent-design-loading"><span className="brand-mark">A</span><p>Loading your Agent Blueprint…</p></div>;

  return <div className="agent-design-page">
    <header className="agent-design-intro"><div><span className="eyebrow">PROBLEM DISCOVERY · NOT A PROMPT TEMPLATE</span><h2>Design the problem before the agent.</h2><p>Answer one question at a time. Your choices become a live blueprint you can revise before opening ClawMax.</p></div><div className={`blueprint-save-state ${saveState}`}><i />{saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : saveState === "saved" ? "Saved" : "Autosave ready"}</div></header>
    <details className="inspiration-drawer"><summary><span><b>Need inspiration?</b> Browse use cases without copying a full prompt.</span><small>Optional · explore illustrations inside AgentForge</small></summary><div className="inspiration-grid">{inspirationCases.map((item) => <button type="button" key={item.id} onClick={() => onOpenUseCase(item.id)}><small>{item.category}</small><strong>{item.title}</strong><span>See how it works →</span></button>)}</div></details>
    <div className="agent-design-workspace">
      <section className="agent-design-question" aria-live="polite">
        {!complete && question ? <>
          <div className="blueprint-progress"><span>GUIDING QUESTION {currentStep + 1} OF {agentBlueprintQuestions.length}</span><b>{Math.round(((currentStep + 1) / agentBlueprintQuestions.length) * 100)}%</b></div>
          <div className="blueprint-progress-track"><i style={{ width: `${((currentStep + 1) / agentBlueprintQuestions.length) * 100}%` }} /></div>
          <span className="question-section-label">{question.label}{question.optional ? " · OPTIONAL" : ""}</span>
          <h3>{question.prompt}</h3><p>{question.helper}</p>
          <aside className={`blueprint-ai-scaffold ${scaffoldSupportForStep(currentStep)}`}>
            <header><div><span className="eyebrow">OPTIONAL AI SCAFFOLD · FEVI {feviStageForStep(currentStep).toUpperCase()}</span><strong>{scaffoldSupportForStep(currentStep) === "guided" ? "Guided support" : scaffoldSupportForStep(currentStep) === "reduced" ? "Light hints" : "Draft first · critique only"}</strong></div><small>{scaffoldSupportForStep(currentStep) === "guided" ? "Early stage" : scaffoldSupportForStep(currentStep) === "reduced" ? "Support is fading" : "Independent decision"}</small></header>
            <p>{scaffoldSupportForStep(currentStep) === "guided" ? "Ask for orientation or a small set of directions. AI will not complete the Blueprint for you." : scaffoldSupportForStep(currentStep) === "reduced" ? "AI will respond with shorter prompts and trade-offs rather than a worked example." : "Write your own answer first. AI can then challenge one assumption, boundary, or test."}</p>
            <div><button type="button" disabled={scaffoldSupportForStep(currentStep) === "independent" && !summaryFor(question)} onClick={() => void requestScaffold("clarify")}>Clarify this question</button><button type="button" disabled={scaffoldSupportForStep(currentStep) === "independent" && !summaryFor(question)} onClick={() => void requestScaffold("directions")}>Give me two directions</button><button type="button" disabled={!summaryFor(question)} onClick={() => void requestScaffold("challenge")}>Challenge my answer</button></div>
          </aside>
          <div className={`blueprint-choice-grid ${question.multiple ? "multiple" : "single"}`}>{question.choices.map((choice) => { const selected = answerFor(question.id).selections.includes(choice); return <button type="button" key={choice} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleChoice(choice)}><span>{selected ? "✓" : "+"}</span>{choice}</button>; })}</div>
          {question.id === "context" && answerFor(question.id).selections.includes("Other") && <fieldset className="blueprint-other-fields"><legend>OTHER SETTINGS · UP TO 3</legend>{(answerFor(question.id).customOther?.length ? answerFor(question.id).customOther! : [""]).map((entry, index) => <label key={index}><span>Other {index + 1}</span><input autoFocus={index === 0 && !entry} value={entry} onChange={(event) => updateOther(index, event.target.value)} placeholder="Describe another setting…" /></label>)}</fieldset>}
          <label className="blueprint-detail-label">{question.detailLabel}<textarea autoFocus={!(question.id === "context" && answerFor(question.id).selections.includes("Other"))} rows={5} value={answerFor(question.id).detail} onChange={(event) => updateDetail(event.target.value)} placeholder={question.placeholder} /></label>
          <details className="blueprint-example" onToggle={(event) => { if (event.currentTarget.open) void recordEvent("example_opened", question.id); }}><summary>I need an example</summary><p>{question.example}</p><small>Use the structure, not the wording. Your own situation is the useful evidence.</small></details>
          {error && <p className="form-error">{error}</p>}
          <footer className="agent-design-actions"><button className="text-button" disabled={currentStep === 0} onClick={() => { setError(""); setCurrentStep((step) => Math.max(0, step - 1)); }}>← Previous</button><span>You can edit every answer from the Blueprint.</span><button className="primary" onClick={() => void continueForward()}>{currentStep === agentBlueprintQuestions.length - 1 ? "Review blueprint →" : "Next question →"}</button></footer>
        </> : <div className="blueprint-review"><span className="eyebrow">READY FOR YOUR REVIEW</span><h3>Your first Agent Blueprint is assembled.</h3><p>This is still your draft. Read the evidence on the right, edit anything that feels generic, then save it as your project starting point.</p><div className="blueprint-review-checks"><span>✓ A concrete problem</span><span>✓ A bounded workflow</span><span>✓ Human review points</span><span>✓ A visible success test</span></div><aside className="blueprint-final-scaffold"><div><span className="eyebrow">FINAL FADED CHECK · FEVI INTEGRATE</span><strong>Ask for gaps—not a rewrite.</strong><p>AI can identify up to three missing boundaries, assumptions, or tests. You still decide what to change.</p></div><button type="button" onClick={() => { const scaffold: AssistantScaffold = { action: "challenge", questionId: "review", supportLevel: "review", feviStage: "Integrate", currentAnswer: agentBlueprintQuestions.map((item) => `${item.label}: ${summaryFor(item) || "Not specified"}`).join("\n"), selectedUseCaseId: referenceUseCaseId || undefined }; void recordEvent("scaffold_opened", "review", currentStep, { scaffoldAction: "challenge", supportLevel: "review", feviStage: "Integrate" }); onAskScaffold("Review my Agent Blueprint. Identify up to three important gaps or untested assumptions. Do not rewrite it; ask me to decide what to change.", "Agent Blueprint · final FEVI review · faded support", scaffold); }}>✦ Review gaps with AI</button></aside>{error && <p className="form-error">{error}</p>}<div className="blueprint-review-actions"><button className="text-button" onClick={() => setCurrentStep(agentBlueprintQuestions.length - 1)}>← Edit last answer</button><button className="primary" disabled={saveState === "saving"} onClick={() => void completeBlueprint()}>{saveState === "saving" ? "Saving blueprint…" : status === "completed" ? "Save updated blueprint" : "Save Agent Blueprint"}</button></div>{status === "completed" && <div className="blueprint-complete"><div><b>Blueprint saved</b><span>Project {projectId?.slice(0, 8)}… is ready to build.</span></div><button type="button" onClick={onOpenClawMax}>Open ClawMax to build ↗</button></div>}</div>}
      </section>
      <aside className="agent-blueprint-live"><header><div><span className="eyebrow">PARTICIPANT AGENT BLUEPRINT</span><h3>Your design, in your words.</h3></div><small>{agentBlueprintQuestions.filter((item) => summaryFor(item)).length}/{agentBlueprintQuestions.length} sections</small></header><div>{agentBlueprintQuestions.map((item, index) => { const summary = summaryFor(item); return <article key={item.id} className={summary ? "filled" : currentStep === index ? "active" : ""}><div><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{item.label}</strong><p>{summary || (item.optional ? "Optional — not defined" : "Waiting for your answer")}</p></span></div><button type="button" onClick={() => { setError(""); setCurrentStep(index); void recordEvent("answer_revisited", item.id, index); }}>{summary ? "Edit" : "Add"}</button></article>; })}</div><footer><strong>This is not a generated prompt.</strong><span>It is a participant-authored record of the problem, boundaries, workflow, and test.</span></footer></aside>
    </div>
  </div>;
}

function UseCaseLibrary({ initialId, onBack, onUse }: { initialId: string; onBack: () => void; onUse: (id: string) => void }) {
  const [activeId, setActiveId] = useState(inspirationCases.some((item) => item.id === initialId) ? initialId : inspirationCases[0].id);
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(inspirationCases.map((item) => item.category))];
  const visibleCases = category === "All" ? inspirationCases : inspirationCases.filter((item) => item.category === category);
  const active = inspirationCases.find((item) => item.id === activeId) || inspirationCases[0];

  return <div className="use-case-page">
    <header className="use-case-hero"><div><span className="eyebrow">ILLUSTRATIONS · NOT TEMPLATES</span><h2>See the decisions behind an agent.</h2><p>Each example shows a problem, a bounded workflow, a human checkpoint, and a way to test whether the agent is useful. Borrow the reasoning pattern—not the wording.</p></div><button type="button" className="outline-button" onClick={onBack}>← Back to my blueprint</button></header>
    <nav className="use-case-filters" aria-label="Filter use cases">{categories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); const first = item === "All" ? inspirationCases[0] : inspirationCases.find((entry) => entry.category === item); if (first) setActiveId(first.id); }}>{item}</button>)}</nav>
    <div className="use-case-layout">
      <aside className="use-case-index" aria-label="Use case list">{visibleCases.map((item, index) => <button type="button" key={item.id} className={active.id === item.id ? "active" : ""} onClick={() => setActiveId(item.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{item.category}</small><strong>{item.title}</strong><p>{item.challenge}</p></div><b>→</b></button>)}</aside>
      <article className="use-case-illustration" key={active.id}>
        <header><div><span className="eyebrow">{active.category.toUpperCase()} · USE CASE ILLUSTRATION</span><h3>{active.title}</h3><p>{active.challenge}</p></div><span className="use-case-number">{String(inspirationCases.findIndex((item) => item.id === active.id) + 1).padStart(2, "0")}</span></header>
        <section className="use-case-role"><small>THE AGENT&apos;S BOUNDED ROLE</small><strong>{active.role}</strong></section>
        <section className="use-case-flow"><div className="use-case-section-heading"><small>WORKFLOW</small><span>Trigger → evidence → action → review</span></div><ol>{active.flow.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol></section>
        <div className="use-case-two-column">
          <section><small>INPUTS IN SCOPE</small><ul>{active.inputs.map((input) => <li key={input}>{input}</li>)}</ul></section>
          <section className="human-checkpoint"><small>HUMAN CHECKPOINT</small><p>{active.checkpoint}</p></section>
        </div>
        <section className="use-case-evidence"><small>WHAT WOULD COUNT AS EVIDENCE?</small><p>{active.evidence}</p></section>
        <section className="use-case-questions"><div><small>QUESTIONS TO TAKE BACK TO YOUR DESIGN</small><h4>Make your own choices explicit.</h4></div><ol>{active.questions.map((question) => <li key={question}>{question}</li>)}</ol></section>
        <footer><p><b>No ready-made prompt.</b> Your next step is to answer the blueprint questions using your own context, boundaries, and success test.</p><button type="button" className="primary" onClick={() => onUse(active.id)}>Return to my Agent Blueprint →</button></footer>
      </article>
    </div>
  </div>;
}

type LearnerNote = { id: string; content: string; selectedText?: string | null; sourceType: "manual" | "selection" | "assistant"; sourcePage?: string | null; sourcePromptEventId?: string | null; createdAt: number; updatedAt: number };
type LearnerPrompt = { id: string; page: string; tutorialStep?: string | null; userPrompt: string; responseText?: string | null; status: string; userFeedback?: string | null; createdAt: number };

function LearnerNoteCard({ note, onUpdated }: { note: LearnerNote; onUpdated: (note: LearnerNote) => void }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!content.trim()) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/learning-center", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: note.id, content }) });
      const result = await response.json() as { note?: { updatedAt: number }; error?: string };
      if (!response.ok || !result.note) throw new Error(result.error || "Note could not be updated.");
      onUpdated({ ...note, content: content.trim(), updatedAt: result.note.updatedAt }); setEditing(false);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Note could not be updated."); }
    finally { setSaving(false); }
  }
  return <article className={`learner-note-card ${note.sourceType}`}><header><span>{note.sourceType === "selection" ? "SELECTED TEXT" : note.sourceType === "assistant" ? "ASK AI NOTE" : "PERSONAL NOTE"}</span><small>{note.sourcePage ? `${note.sourcePage} · ` : ""}{new Date(note.updatedAt).toLocaleString()}</small></header>{note.selectedText && note.selectedText !== note.content && <blockquote>{note.selectedText}</blockquote>}{editing ? <div className="learner-note-editor"><textarea rows={5} value={content} onChange={(event) => setContent(event.target.value)} autoFocus />{error && <p className="form-error">{error}</p>}<div><button type="button" onClick={() => { setEditing(false); setContent(note.content); }}>Cancel</button><button type="button" className="primary" disabled={saving || !content.trim()} onClick={() => void save()}>{saving ? "Saving…" : "Save note"}</button></div></div> : <><p>{note.content}</p><footer><span>{note.sourcePromptEventId ? "Linked to its original Prompt and response" : "Private to your learning record"}</span><button type="button" onClick={() => setEditing(true)}>Edit</button></footer></>}</article>;
}

function LearningCenter({ setAssistant, setView }: { setAssistant: (v: boolean) => void; setView: (view: View) => void }) {
  const [tab, setTab] = useState<"notes" | "questions" | "tutorials">("notes");
  const [notes, setNotes] = useState<LearnerNote[]>([]);
  const [prompts, setPrompts] = useState<LearnerPrompt[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/learning-center", { cache: "no-store" });
        const result = await response.json() as { notes?: LearnerNote[]; prompts?: LearnerPrompt[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Your learning record could not be loaded.");
        if (!cancelled) { setNotes(result.notes || []); setPrompts(result.prompts || []); setError(""); }
      } catch (problem) { if (!cancelled) setError(problem instanceof Error ? problem.message : "Your learning record could not be loaded."); }
      finally { if (!cancelled) setLoading(false); }
    }
    const refresh = () => void load();
    void load(); window.addEventListener("agentforge-learner-note-saved", refresh);
    return () => { cancelled = true; window.removeEventListener("agentforge-learner-note-saved", refresh); };
  }, []);
  async function addNote() {
    if (!draft.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/learning-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: draft, sourceType: "manual", sourcePage: "Learner Center" }) });
      const result = await response.json() as { note?: LearnerNote; error?: string };
      if (!response.ok || !result.note) throw new Error(result.error || "The note could not be saved.");
      setNotes((current) => [result.note!, ...current]); setDraft("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "The note could not be saved."); }
    finally { setBusy(false); }
  }
  const successfulPrompts = prompts.filter((item) => item.status === "success" && item.responseText);
  const pages = [...new Set(prompts.map((item) => item.page).filter(Boolean))].slice(0, 5);
  return <div className="learner-center-page">
    <section className="learner-center-hero"><div><span className="eyebrow">YOUR PRIVATE LEARNING RECORD</span><h2>See the thinking behind your agent.</h2><p>Keep selected passages, your own notes, and earlier Ask AI exchanges together. Shared Space remains available for deliberate team collaboration; nothing here is shared automatically.</p></div><button className="outline-button" onClick={() => setAssistant(true)}>✦ Ask about this page</button></section>
    <section className="learner-center-summary"><article><strong>{notes.length}</strong><span>Personal notes</span></article><article><strong>{prompts.length}</strong><span>Questions asked</span></article><article><strong>{successfulPrompts.length}</strong><span>Responses recorded</span></article><div><small>RECENT LEARNING CONTEXT</small><p>{pages.length ? pages.join(" · ") : "Your pages and topics will appear as you work."}</p></div></section>
    <nav className="learner-center-tabs" aria-label="Learner Center sections">{([ ["notes", "My Notes"], ["questions", "Ask AI History"], ["tutorials", "Tutorials & FEVI"] ] as const).map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {error && <p className="form-error">{error}</p>}
    {tab === "notes" && <section className="learner-notes-layout"><div className="personal-note-composer"><span className="eyebrow">CAPTURE YOUR REASONING</span><h3>Write a note in your own words.</h3><textarea rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What did you notice, question, verify, or decide?" /><footer><small>Private by default · you can also highlight text anywhere and choose Take Notes.</small><button className="primary" disabled={busy || !draft.trim()} onClick={() => void addNote()}>{busy ? "Saving…" : "Save note"}</button></footer></div><div className="learner-note-list">{loading ? <p className="notes-empty">Loading your notes…</p> : notes.length ? notes.map((note) => <LearnerNoteCard key={note.id} note={note} onUpdated={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} />) : <div className="learner-empty"><b>▤</b><h3>No notes yet.</h3><p>Highlight a useful sentence on any participant page and choose Take Notes, or write your first reflection here.</p></div>}</div></section>}
    {tab === "questions" && <section className="learner-prompt-history">{loading ? <p className="notes-empty">Restoring your Ask AI history…</p> : prompts.length ? prompts.map((item) => <details key={item.id}><summary><div><small>{item.page}{item.tutorialStep ? ` · ${item.tutorialStep}` : ""} · {new Date(item.createdAt).toLocaleString()}</small><strong>{item.userPrompt}</strong><p>{item.responseText ? `${item.responseText.slice(0, 220)}${item.responseText.length > 220 ? "…" : ""}` : item.status === "success" ? "No response text was recorded." : `Request ${item.status}.`}</p></div><span>{item.userFeedback ? item.userFeedback.replaceAll("_", " ") : "Open"}</span></summary><div className="learner-prompt-detail"><span>ASSISTANT RESPONSE</span><p>{item.responseText || "No response was recorded for this request."}</p><small>This is raw interaction evidence, not a grade or an AI inference about you.</small></div></details>) : <div className="learner-empty"><b>✦</b><h3>No Ask AI history yet.</h3><p>Use the assistant from any page. Your question, page context, response, and feedback will appear here.</p></div>}</section>}
    {tab === "tutorials" && <><section className="fevi-participant-guide"><header><div><span className="eyebrow">HOW TO THINK WHILE BUILDING</span><h3>FEVI keeps you in control of the AI.</h3></div><p>This is a learning scaffold—not a grade or a measure of intelligence.</p></header><div>{[["F","Formulate","Define your goal, useful context, constraints, and what success looks like."],["E","Engage","Ask for the kind of help you need: a hint, explanation, critique, comparison, or plan."],["V","Verify","Check important claims, sources, logic, code, and assumptions before relying on them."],["I","Integrate","Choose what to accept, change, or reject—and explain the reason in your own words."]].map(([letter,title,text]) => <article key={letter}><b>{letter}</b><div><strong>{title}</strong><p>{text}</p></div></article>)}</div><footer><strong>A good result is not enough by itself.</strong><span>Keep evidence of what you checked and why you made the final decision.</span></footer></section><section className="tutorial-library company-brain-library" aria-label="Tutorial library"><button className="tutorial-library-card clawmax" onClick={() => setView("clawmaxTutorial")}><span className="library-mark">C</span><span className="library-status pending">WAITING FOR MAX</span><small>CLAWMAX · OFFICIAL MATERIALS PENDING</small><h3>Build your ClawMax agent</h3><p>This space will contain the verified setup and agent-building walkthrough once Max provides the official material.</p><b>Open placeholder →</b></button><button className="tutorial-library-card cognee" onClick={() => setView("companyBrainTutorial")}><span className="library-mark">CB</span><span className="library-status available">3 BUILD EXERCISES</span><small>COMPANY BRAIN · CLAWMAX</small><h3>Build with shared knowledge</h3><p>Build a GTM brief, prospect researcher, or purchase-order workflow. Formulate, Engage, Verify, and Integrate—with practical Ask AI questions.</p><b>Open Company Brain tutorial →</b></button></section></>}
  </div>;
}

function ClawMaxTutorial({ onOpen }: { onOpen: () => void }) {
  const steps = [
    ["01", "Open BYOK", "Open ClawMax’s provider configuration before creating or running an agent."],
    ["02", "Add your provider key", "Use the ClawMax BYOK setup. Never paste a key into AgentForge, a prompt, Shared Space, or a screenshot."],
    ["03", "Select a default model", "Return to the workspace and choose the model your agent should use."],
    ["04", "Test the provider connection", "Run the provider check. Continue only after ClawMax confirms that the model is reachable."],
    ["05", "Start and test the agent", "Activate the agent, send one small test prompt, and confirm that a real response appears."],
  ];
  return <div className="clawmax-sdk-page">
    <section className="clawmax-sdk-hero"><div><span className="eyebrow">CLAWMAX · TEMPORARY SDK TEST FLOW</span><h2>Connect a model before you build.</h2><p>This guide is for the locally running ClawMax 2.0 SDK environment used during integration testing. The Hackathon Cloud experience may provide model access differently, so participants should not assume they will need personal keys until that workflow is confirmed.</p></div><button className="primary" type="button" onClick={onOpen}>Open ClawMax SDK ↗</button></section>
    <aside className="clawmax-sdk-notice"><strong>Before building</strong><span>ClawMax cannot run an agent until a provider and default model are available. Complete these five checks first.</span></aside>
    <section className="byok-steps" aria-label="ClawMax BYOK setup steps">{steps.map(([number, title, description]) => <article key={number}><b>{number}</b><div><h3>{title}</h3><p>{description}</p></div></article>)}</section>
    <section className="clawmax-sdk-checks"><div><span className="eyebrow">READY TO BUILD WHEN</span><h3>Your setup passes four visible checks.</h3><ul><li>A provider is configured</li><li>A default model is selected</li><li>The connection test succeeds</li><li>Your agent returns a real response</li></ul></div><div className="clawmax-cloud-note"><span>HACKATHON CLOUD</span><h3>This part is still being finalized.</h3><p>We still need to confirm whether ClawMax Cloud supplies event-managed model access, uses organizer-managed credentials, or asks participants to bring their own keys. This SDK instruction will be replaced once that workflow is agreed.</p></div></section>
  </div>;
}

// Kept temporarily as inactive source while the Learning Center is being rebuilt.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CogneeTutorial({ setAssistant }: { setAssistant: (v: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const steps = [
    {
      n: "01", action: "MENTAL MODEL", title: "Decide what this memory is for",
      detail: "Start with one source, one dataset boundary, and one question that should be answered from memory. This keeps the first test understandable and makes access scope explicit.",
      code: `DATASET = "team_synapse"\nSOURCE = "Team preference: plans should be concise and avoid meeting conflicts."\nTEST_QUESTION = "How does our team prefer plans?"`,
      result: "You can name the owner, dataset, source, and one answerable test question before uploading anything.",
      advanced: "A dataset is a useful retrieval and ownership boundary. Private participant memory and team-shared memory should not silently use the same scope.",
      docs: "https://docs.cognee.ai/getting-started/quickstart",
    },
    {
      n: "02", action: "CONNECT", title: "Create a Cloud key without exposing it",
      detail: "Create a Cognee Cloud account, generate an API key, and store it as a server-side environment variable. The key is shown once and should never be committed or placed in participant browser code.",
      code: `# Server-side environment only\nCOGNEE_API_KEY="your-key-from-cognee-cloud"\n\n# Never paste this key into prompts, Shared Space, or client JavaScript.`,
      result: "The backend can authenticate to Cognee while the browser and repository never receive the secret.",
      advanced: "For a shared event, AgentForge owns the integration credential. Participants should not need to distribute personal provider keys.",
      docs: "https://docs.cognee.ai/cognee-cloud/sign-up",
    },
    {
      n: "03", action: "REMEMBER", title: "Turn trusted content into permanent memory",
      detail: "In Cognee v1.0, remember() is the recommended high-level operation. Permanent mode stores the source and builds retrieval-ready graph memory in one operation.",
      code: `import cognee\n\nawait cognee.remember(\n    SOURCE,\n    dataset_name=DATASET,\n)`,
      result: "The content is normalized, chunked, connected in graph memory, embedded, and prepared for retrieval.",
      advanced: "The older explicit path is add() followed by cognify(). It is still useful when you need pipeline-level control, but add() alone only ingests data and does not build searchable graph memory.",
      docs: "https://docs.cognee.ai/core-concepts/main-operations/remember",
    },
    {
      n: "04", action: "RECALL", title: "Retrieve memory and inspect the evidence",
      detail: "recall() is the recommended v1.0 retrieval operation. Ask a question whose expected answer you already know, then inspect whether the returned context came from the intended dataset.",
      code: `result = await cognee.recall(\n    query_text=TEST_QUESTION,\n    datasets=[DATASET],\n)\n\nprint(result)`,
      result: "The answer should mention concise plans and avoiding conflicts, grounded in the remembered source rather than a plausible guess.",
      advanced: "Legacy search() remains useful for choosing explicit retrieval modes. Retrieval-only modes can return context without paying for a separate generated answer.",
      docs: "https://docs.cognee.ai/getting-started/quickstart",
    },
    {
      n: "05", action: "SCOPE", title: "Choose permanent or session memory",
      detail: "Permanent memory is appropriate for durable participant, team, or project knowledge. A session_id creates temporary conversational memory for a bounded interaction instead of silently adding everything to the permanent graph.",
      code: `# Temporary conversational context\nawait cognee.remember(\n    "The participant wants shorter explanations today.",\n    session_id="demo-session-42",\n)\n\n# Durable project knowledge uses a dataset instead.`,
      result: "Temporary context follows its session policy; durable knowledge remains in the intended dataset and can be recalled later.",
      advanced: "This separation matters for privacy and model quality: not every chat message deserves to become a long-term fact.",
      docs: "https://docs.cognee.ai/core-concepts/main-operations/remember",
    },
    {
      n: "06", action: "OPERATE", title: "Verify status before blaming retrieval",
      detail: "Production onboarding needs visible processing state. If recall fails, first check that memory processing completed, then verify dataset scope, source sufficiency, and the test query.",
      code: `# Documented REST status checks\nGET /api/v1/datasets/status?dataset=<dataset-uuid>\nGET /api/v1/activity/pipeline-runs?dataset_id=<dataset-uuid>\n\n# REST reference is available at /docs on your deployment.`,
      result: "The UI distinguishes queued, processing, ready, and failed states, and a failed job can be retried without losing the raw source.",
      advanced: "Agents can connect through the Python client, REST API, or Cognee MCP tools (remember, recall, forget). Pipelines are the lower-level orchestration layer when custom processing is needed.",
      docs: "https://docs.cognee.ai/guides/deploy-rest-api-server",
    },
  ];
  const current = steps[step];
  async function copyCode() {
    await navigator.clipboard.writeText(current.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return <>
    <div className="demo-notice cognee-onboarding-notice"><span>TEMPORARY ONBOARDING DEMO</span><div><strong>This is a guided layer over Cognee&apos;s official documentation.</strong><p>The source links remain authoritative. This page reorganizes the current docs into a short, task-oriented path for a live onboarding demonstration.</p></div></div>
    <div className="cognee-head"><div><span className="eyebrow">COGNEE ONBOARDING · 30–40 MIN</span><h2>Remember something. Recall it. Prove it came from memory.</h2><p>The recommended v1.0 path is Remember → Recall. Advanced users can open the explicit Add → Cognify → Search pipeline when they need more control.</p></div><button className="outline-button" onClick={() => setAssistant(true)}>✦ Ask about this tutorial</button></div>
    <section className="cognee-path-switch" aria-label="Cognee operation paths">
      <article className="recommended"><small>RECOMMENDED · COGNEE V1.0</small><strong>remember()</strong><i>→</i><strong>recall()</strong><p>Fastest path from trusted source to retrieval-ready memory.</p></article>
      <article><small>LEGACY / ADVANCED CONTROL</small><strong>add()</strong><i>→</i><strong>cognify()</strong><i>→</i><strong>search()</strong><p>Useful for explicit ingestion, processing, and retrieval choices.</p></article>
    </section>
    <div className="tutorial-outcome-strip"><span>A SUCCESSFUL ONBOARDING DEMO SHOWS</span><div>{["A secret stays server-side", "One source enters the right scope", "Recall returns grounded context", "Processing state is visible"].map((item) => <p key={item}>✓ {item}</p>)}</div></div>
    <div className="cognee-tutorial-layout cognee-onboarding-layout">
      <nav className="tutorial-step-nav" aria-label="Cognee onboarding modules">{steps.map((item, index) => <button key={item.n} className={step === index ? "active" : ""} onClick={() => { setCopied(false); setStep(index); }}><b>{item.n}</b><span><small>{item.action}</small>{item.title}</span>{index < step && <i>✓</i>}</button>)}</nav>
      <section className="tutorial-workspace"><div className="workspace-meta"><span>MODULE {current.n} OF 06</span><b>OFFICIAL DOCS GUIDED</b></div><span className="action-chip">{current.action}</span><h2>{current.title}</h2><p>{current.detail}</p><div className="code-demo"><header><span>PYTHON / CONFIG · DEMO EXAMPLE</span><button onClick={() => void copyCode()}>{copied ? "Copied ✓" : "Copy"}</button></header><pre>{current.code}</pre></div><div className="demo-result"><span>CHECKPOINT</span><p>{current.result}</p></div><div className="real-step-note advanced-note"><span>ADVANCED UNDERSTANDING</span><p>{current.advanced}</p></div><footer><button className="outline-button" disabled={step === 0} onClick={() => { setCopied(false); setStep((value) => Math.max(0, value - 1)); }}>← Previous</button><a className="official-doc-button" href={current.docs} target="_blank" rel="noreferrer">Open source docs ↗</a><button className="primary" disabled={step === steps.length - 1} onClick={() => { setCopied(false); setStep((value) => Math.min(steps.length - 1, value + 1)); }}>Next module →</button></footer></section>
      <aside className="tutorial-reality cognee-reference"><span>KEEP THIS MENTAL MODEL</span><h3>Operational facts and semantic memory have different jobs.</h3><div><b>1</b><p><strong>Your app records the event.</strong><br />Identity, consent, progress, raw prompts, and audit history stay in the operational database.</p></div><div><b>2</b><p><strong>Cognee builds semantic memory.</strong><br />Consented sources become connected, retrievable context with explicit dataset or session scope.</p></div><div><b>3</b><p><strong>Your agent uses recalled context.</strong><br />The answer model receives relevant evidence; the UI should show whether memory was used.</p></div><div><b>4</b><p><strong>Humans verify the result.</strong><br />A fluent answer is not proof. Test against a known source and preserve provenance.</p></div><div className="tutorial-source-links"><a href="https://docs.cognee.ai/cognee-cloud/quickstart" target="_blank" rel="noreferrer">Cloud quickstart ↗</a><a href="https://docs.cognee.ai/core-concepts/main-operations/legacy-operations/add" target="_blank" rel="noreferrer">Add explained ↗</a><a href="https://docs.cognee.ai/core-concepts/main-operations/legacy-operations/search" target="_blank" rel="noreferrer">Search modes ↗</a><a href="https://docs.cognee.ai/cognee-mcp/mcp-tools" target="_blank" rel="noreferrer">MCP tools ↗</a><a href="https://docs.cognee.ai/core-concepts/building-blocks/pipelines" target="_blank" rel="noreferrer">Pipelines ↗</a><a href="https://docs.cognee.ai" target="_blank" rel="noreferrer">All documentation ↗</a></div><small className="tutorial-version-note">Official sources checked August 2026. Example outputs vary by source, model, and configuration.</small></aside>
    </div>
  </>;
}

// Retained on this temporary branch so the original Hackathon tutorial can be
// restored without reconstructing it after the Cognee onboarding demo.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyCogneeTutorial({ setAssistant }: { setAssistant: (v: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const steps = [
    { n: "01", action: "DESIGN", title: "Choose a memory boundary", detail: "Start with one dataset and one question your agent should answer. A dataset is the practical boundary for ownership, search scope, and team sharing.", code: `DATASET = "team_synapse"\nTEST_QUESTION = "How does our team prefer plans?"`, evidence: "A named dataset, an owner or team, a sharing scope, and one repeatable test question.", real: "AgentForge will create or select the participant's project dataset after onboarding. Team data and private data must use separate scopes." },
    { n: "02", action: "ADD", title: "Give Cognee trusted source data", detail: "Add a small source that contains the answer. Cognee accepts raw text and supported files; the REST endpoint can also organize related records with node sets.", code: `await cognee.add(\n  "Team preference: plans should be concise and avoid meeting conflicts.",\n  dataset_name=DATASET\n)`, evidence: "An ingestion record showing source, dataset, contributor, timestamp, and privacy scope.", real: "A backend worker sends prompts, tutorial events, notes, or uploaded sources to Cognee. API keys never appear in the participant's browser." },
    { n: "03", action: "COGNIFY", title: "Turn the source into connected memory", detail: "Cognify converts ingested material into chunks, embeddings, summaries, entities, and relationships so it can be searched as structured knowledge.", code: `await cognee.cognify(\n  datasets=[DATASET]\n)`, evidence: "A completed processing job—or a visible pending/failed state with an error that can be retried.", real: "AgentForge queues Cognify after new memory arrives, tracks processing status, and keeps the raw event available if a sync must be retried." },
    { n: "04", action: "SEARCH", title: "Retrieve context before the agent answers", detail: "Search only the intended dataset. For an agent workflow, only_context returns retrieved memory without paying for a second Cognee-generated answer.", code: `context = await cognee.search(\n  query_text=TEST_QUESTION,\n  query_type=SearchType.GRAPH_COMPLETION,\n  datasets=[DATASET],\n  only_context=True,\n  top_k=5\n)`, evidence: "Relevant context plus its dataset/source, followed by an answer that can be checked against the original memory.", real: "The Ask AI backend retrieves Cognee context first, then supplies that context to the configured answer model. The UI tells participants when memory was used." },
    { n: "05", action: "EVALUATE", title: "Test recall instead of trusting a demo", detail: "Run a question whose expected answer is known. Check groundedness, relevance, scope, and whether the source is sufficient—not whether the response merely sounds fluent.", code: `evaluation = {\n  "question": TEST_QUESTION,\n  "expected_fact": "Concise plans; avoid conflicts",\n  "retrieved_source": True,\n  "grounded": True,\n  "helpful": True\n}`, evidence: "The exact question, expected fact, retrieved context, answer, outcome, and participant feedback stored together.", real: "Helpful / Not helpful actions are linked to the prompt, response, participant, team, page, tutorial step, and time for organizer review." },
    { n: "06", action: "IMPROVE", title: "Change one thing and repeat the same test", detail: "If recall fails, improve the source, dataset scope, node organization, retrieval settings, or tutorial instruction. Then rerun the same evaluation so the comparison is meaningful.", code: `# Add the missing or corrected source\nawait cognee.add(corrected_memory, dataset_name=DATASET)\nawait cognee.cognify(datasets=[DATASET])\n\n# Re-run TEST_QUESTION and compare before vs. after`, evidence: "A before/after result that identifies the change and shows whether retrieval or task success improved.", real: "Organizer learning signals can group repeated questions and failures. Counts come from stored events; Cognee helps interpret themes and suggest human-reviewed tutorial updates." },
  ];
  const current = steps[step];
  async function copyCode() {
    await navigator.clipboard.writeText(current.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return <>
    <div className="demo-notice"><span>SUPPORTING DEMO TUTORIAL</span><div><strong>ClawMax remains the main Hackathon build tutorial.</strong><p>This shorter Cognee path demonstrates the memory layer participants can connect to their agent. The code and concepts follow Cognee&apos;s official documentation; the displayed run results are illustrative until a participant uses a real project dataset.</p></div></div>
    <div className="cognee-head"><div><span className="eyebrow">COGNEE MEMORY LOOP · 25–35 MIN</span><h2>From raw information to testable agent memory.</h2><p>Design → Add → Cognify → Search → Evaluate → Improve. Finish one evidence-backed loop before adding more sources.</p></div><button className="outline-button" onClick={() => setAssistant(true)}>✦ Ask about this tutorial</button></div>
    <div className="tutorial-outcome-strip"><span>BY THE END, YOUR DEMO SHOULD PROVE</span><div>{["One source entered the right dataset", "Cognify completed successfully", "The agent retrieved relevant context", "Feedback produced a measurable next change"].map((item) => <p key={item}>✓ {item}</p>)}</div></div>
    <div className="cognee-tutorial-layout"><nav className="tutorial-step-nav" aria-label="Cognee tutorial steps">{steps.map((item, index) => <button key={item.n} className={step === index ? "active" : ""} onClick={() => setStep(index)}><b>{item.n}</b><span><small>{item.action}</small>{item.title}</span>{index < step && <i>✓</i>}</button>)}</nav>
    <section className="tutorial-workspace"><div className="workspace-meta"><span>STEP {current.n} OF 06</span><b>~5 MIN</b></div><span className="action-chip">{current.action}</span><h2>{current.title}</h2><p>{current.detail}</p><div className="code-demo"><header><span>PYTHON · GUIDED EXAMPLE</span><button onClick={() => void copyCode()}>{copied ? "Copied ✓" : "Copy"}</button></header><pre>{current.code}</pre></div><div className="demo-result"><span>WHAT COUNTS AS EVIDENCE</span><p>{current.evidence}</p></div><div className="real-step-note"><span>IN THE REAL HACKATHON</span><p>{current.real}</p></div><footer><button className="outline-button" disabled={step === 0} onClick={() => { setCopied(false); setStep((value) => Math.max(0, value - 1)); }}>← Previous</button><button className="primary" disabled={step === steps.length - 1} onClick={() => { setCopied(false); setStep((value) => Math.min(steps.length - 1, value + 1)); }}>Next step →</button></footer></section>
    <aside className="tutorial-reality"><span>ARCHITECTURE IN THIS DEMO</span><h3>Cognee supports the agent—it does not replace it.</h3>{["ClawMax runs the participant's agent workflow.", "AgentForge captures consented prompts, progress, notes, feedback, and evaluation evidence.", "Cognee connects that information as scoped semantic memory.", "Ask AI retrieves relevant Cognee context before generating its answer.", "Organizers inspect evidence, trends, and suggested tutorial changes."].map((item, i) => <div key={item}><b>{i + 1}</b><p>{item}</p></div>)}<div className="tutorial-source-links"><a href="https://docs.cognee.ai/api-reference/add/add" target="_blank" rel="noreferrer">Add API ↗</a><a href="https://docs.cognee.ai/core-concepts/main-operations/legacy-operations/cognify" target="_blank" rel="noreferrer">Cognify ↗</a><a href="https://docs.cognee.ai/api-reference/search/search" target="_blank" rel="noreferrer">Search API ↗</a><a href="https://docs.cognee.ai/guides/search-basics" target="_blank" rel="noreferrer">Search basics ↗</a></div><small className="tutorial-version-note">Official sources checked July 2026. AgentForge examples are simplified for this demo.</small></aside></div>
  </>;
}

type LearningCheckin = { id: string; checkpointType: "baseline" | "episode_reflection" | "transfer"; stage: string; scaffoldLevel: "explicit" | "light" | "minimal"; responseJson: string; createdAt: number };

function ConfidenceScale({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="confidence-scale" role="group" aria-label="Confidence from 1 to 5">{[1, 2, 3, 4, 5].map((score) => <button type="button" key={score} className={value === score ? "selected" : ""} aria-pressed={value === score} onClick={() => onChange(score)}>{score}</button>)}</div>;
}

function Progress() {
  const [checkins, setCheckins] = useState<LearningCheckin[]>([]);
  const [goal, setGoal] = useState("");
  const [successEvidence, setSuccessEvidence] = useState("");
  const [baselineConfidence, setBaselineConfidence] = useState(3);
  const [decision, setDecision] = useState("");
  const [helpfulness, setHelpfulness] = useState("");
  const [episodeReason, setEpisodeReason] = useState("");
  const [episodeConfidence, setEpisodeConfidence] = useState(3);
  const [transferDecision, setTransferDecision] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferConfidence, setTransferConfidence] = useState(3);
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/checkins", { cache: "no-store" });
        const result = await response.json() as { checkins?: LearningCheckin[] };
        if (!cancelled && response.ok) setCheckins(result.checkins || []);
      } catch { /* Check-ins remain usable during a temporary read failure. */ }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function saveCheckin(checkpointType: LearningCheckin["checkpointType"], scaffoldLevel: LearningCheckin["scaffoldLevel"], responseData: Record<string, unknown>) {
    setSaving(checkpointType); setNotice(""); setError("");
    try {
      const response = await fetch("/api/checkins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkpointType, scaffoldLevel, stage: "Personal Agent Hackathon", response: responseData }) });
      const result = await response.json() as { checkin?: LearningCheckin; error?: string };
      if (!response.ok || !result.checkin) throw new Error(result.error || "This check-in could not be saved.");
      setCheckins((current) => [result.checkin!, ...current]);
      setNotice("Saved. This remains a raw participant report, not a score or learner trait.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "This check-in could not be saved."); }
    finally { setSaving(""); }
  }

  const completed = new Set(checkins.map((item) => item.checkpointType));
  return <div className="evidence-checkins-page">
    <section className="evidence-checkins-hero"><div><span className="eyebrow">THREE SHORT RESEARCH MOMENTS</span><h2>Capture what changed without interrupting your build.</h2><p>AgentForge records most activity automatically. These check-ins ask only for judgments the log cannot observe: your goal, what you did with advice, and how confident you felt.</p></div><aside><strong>{completed.size}/3</strong><span>optional moments recorded</span><small>No completion grade</small></aside></section>
    <section className="evidence-boundary"><div><span>RAW EVIDENCE</span><p>Your words, choices, confidence, page context, and time of submission.</p></div><div><span>PROVISIONAL INTERPRETATION</span><p>Researchers may code an episode later, always linked back to its evidence.</p></div><div><span>NOT CLAIMED</span><p>One check-in cannot establish intelligence, motivation, or lasting competence.</p></div></section>
    {notice && <p className="coach-notice">✓ {notice}</p>}{error && <p className="form-error">{error}</p>}
    <section className={`checkin-list ${!completed.has("baseline") ? "waiting-for-baseline" : !completed.has("episode_reflection") ? "waiting-for-episode" : "all-available"}`}>
      <article className={completed.has("baseline") ? "checkin-card complete" : "checkin-card"}><header><b>01</b><div><span>BEFORE BUILDING · ABOUT 45 SECONDS</span><h3>Your intended task</h3><p>An explicit scaffold establishes the goal and a success criterion before outside help.</p></div>{completed.has("baseline") && <em>Saved</em>}</header><label>What do you want your agent to accomplish?<textarea rows={3} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Describe one task the agent should complete…" /></label><label>What result would count as evidence that it worked?<textarea rows={2} value={successEvidence} onChange={(event) => setSuccessEvidence(event.target.value)} placeholder="A test, observable result, or comparison…" /></label><div className="checkin-confidence"><span>How confident are you that you can build this now?</span><ConfidenceScale value={baselineConfidence} onChange={setBaselineConfidence} /><small>1 = not yet confident · 5 = very confident</small></div><button className="primary" disabled={saving === "baseline" || !goal.trim() || !successEvidence.trim()} onClick={() => void saveCheckin("baseline", "explicit", { goal: goal.trim(), successEvidence: successEvidence.trim(), confidence: baselineConfidence })}>{saving === "baseline" ? "Saving…" : completed.has("baseline") ? "Save another baseline" : "Save baseline"}</button></article>
      <article className={completed.has("episode_reflection") ? "checkin-card complete" : "checkin-card"}><header><b>02</b><div><span>AFTER ONE MEANINGFUL AI RESPONSE · ABOUT 30 SECONDS</span><h3>What you did with the advice</h3><p>A light reflection captures decision ownership without asking for a long explanation after every Prompt.</p></div>{completed.has("episode_reflection") && <em>Saved</em>}</header><fieldset><legend>What did you do with the response?</legend><div className="checkin-options">{["Accepted it", "Modified it", "Rejected it", "Did not use it"].map((item) => <button type="button" key={item} className={decision === item ? "selected" : ""} onClick={() => setDecision(item)}>{item}</button>)}</div></fieldset><fieldset><legend>Was the response useful for your next action?</legend><div className="checkin-options">{["Helpful", "Partly helpful", "Not helpful"].map((item) => <button type="button" key={item} className={helpfulness === item ? "selected" : ""} onClick={() => setHelpfulness(item)}>{item}</button>)}</div></fieldset><label>One short reason <small>Optional unless the response was only partly helpful or not helpful</small><textarea rows={2} value={episodeReason} onChange={(event) => setEpisodeReason(event.target.value)} placeholder="Wrong, too long, missing context, unclear next step, or another reason…" /></label><div className="checkin-confidence"><span>How confident are you in your decision?</span><ConfidenceScale value={episodeConfidence} onChange={setEpisodeConfidence} /></div><button className="primary" disabled={saving === "episode_reflection" || !decision || !helpfulness || (helpfulness !== "Helpful" && !episodeReason.trim())} onClick={() => void saveCheckin("episode_reflection", "light", { decision, helpfulness, reason: episodeReason.trim(), confidence: episodeConfidence })}>{saving === "episode_reflection" ? "Saving…" : "Save this episode"}</button></article>
      <article className={completed.has("transfer") ? "checkin-card transfer complete" : "checkin-card transfer"}><header><b>03</b><div><span>OPTIONAL TRANSFER CHECK · ABOUT 60 SECONDS</span><h3>A new claim with no strategy cue</h3><p>This low-risk probe asks for your own decision after the earlier scaffold has faded. It stays separate from the help needed to finish your project.</p></div>{completed.has("transfer") && <em>Saved</em>}</header><blockquote>“A personal agent should save every user interaction as permanent memory because more memory always improves personalization.”</blockquote><fieldset><legend>What would you do with this recommendation?</legend><div className="checkin-options">{["Accept", "Modify", "Reject"].map((item) => <button type="button" key={item} className={transferDecision === item ? "selected" : ""} onClick={() => setTransferDecision(item)}>{item}</button>)}</div></fieldset><label>Why?<textarea rows={3} value={transferReason} onChange={(event) => setTransferReason(event.target.value)} placeholder="Explain your decision in your own words…" /></label><div className="checkin-confidence"><span>How confident are you?</span><ConfidenceScale value={transferConfidence} onChange={setTransferConfidence} /></div><button className="primary" disabled={saving === "transfer" || !transferDecision || !transferReason.trim()} onClick={() => void saveCheckin("transfer", "minimal", { decision: transferDecision, reason: transferReason.trim(), confidence: transferConfidence, probeVersion: "memory-boundary-v1" })}>{saving === "transfer" ? "Saving…" : "Save optional transfer check"}</button></article>
    </section>
  </div>;
}

type TeamSubmission = { id: string; artifactKind: "file" | "link"; artifactUrl?: string | null; artifactFilename?: string | null; artifactSizeBytes?: number | null; notes?: string | null; artifactSubmittedAt: number; demoVideoUrl?: string | null; demoSubmittedAt?: number | null; demoDueAt: number; status: "artifact_submitted" | "complete" };

function Demo() {
  const [submission, setSubmission] = useState<TeamSubmission | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [mode, setMode] = useState<"link" | "file">("link");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/submissions");
      const result = await response.json() as { submission?: TeamSubmission | null; storageAvailable?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Submission status could not be loaded.");
      setSubmission(result.submission || null); setStorageAvailable(Boolean(result.storageAvailable));
      if (result.submission?.demoVideoUrl) setDemoUrl(result.submission.demoVideoUrl);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Submission status could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  async function submitArtifact() {
    setBusy("artifact"); setError(""); setNotice("");
    try {
      let response: Response;
      if (mode === "link") {
        response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit_link", artifactUrl, notes }) });
      } else {
        if (!file) throw new Error("Choose a project artifact file first.");
        const payload = new FormData(); payload.set("action", "submit_file"); payload.set("file", file); payload.set("notes", notes);
        response = await fetch("/api/submissions", { method: "POST", body: payload });
      }
      const result = await response.json() as { submission?: TeamSubmission; error?: string };
      if (!response.ok || !result.submission) throw new Error(result.error || "The project artifact could not be submitted.");
      setSubmission(result.submission); setNotice("Project artifact submitted. Your team can now add the demo video link from home.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "The project artifact could not be submitted."); }
    finally { setBusy(""); }
  }

  async function submitDemo() {
    setBusy("demo"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit_demo", demoVideoUrl: demoUrl }) });
      const result = await response.json() as { submission?: TeamSubmission; error?: string };
      if (!response.ok || !result.submission) throw new Error(result.error || "The demo link could not be saved.");
      setSubmission(result.submission); setNotice("Demo link saved. Your team submission is complete.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "The demo link could not be saved."); }
    finally { setBusy(""); }
  }

  return <div className="submission-page">
    <section className="submission-hero"><div><span className="eyebrow">TEAM SUBMISSION</span><h2>Submit the build now.<br />Tell the story from home.</h2><p>Each team submits one project artifact before leaving. Add a short demo video link within 24 hours so Organizers can evaluate the working result and your design decisions.</p></div><aside><strong>{submission?.status === "complete" ? "2/2" : submission ? "1/2" : "0/2"}</strong><span>submission steps complete</span><small>One record per active Team or Personal Workspace</small></aside></section>
    {notice && <p className="coach-notice">✓ {notice}</p>}{error && <p className="form-error">{error}</p>}
    {loading ? <div className="submission-loading">Loading your team submission…</div> : <div className="submission-grid">
      <section className={submission ? "submission-card complete" : "submission-card"}><header><b>01</b><div><span>BEFORE YOU LEAVE</span><h3>Project artifact</h3><p>Submit a ClawMax export, compact project file, or a shareable Drive/GitHub link. This step can only be submitted once.</p></div>{submission && <em>Submitted</em>}</header>
        {submission ? <div className="submission-receipt"><strong>{submission.artifactKind === "link" ? "Shareable project link" : submission.artifactFilename || "Uploaded artifact"}</strong><span>{new Date(submission.artifactSubmittedAt).toLocaleString()}</span>{submission.artifactKind === "link" && submission.artifactUrl ? <a href={submission.artifactUrl} target="_blank" rel="noreferrer">Open artifact ↗</a> : <a href="/api/submissions?download=artifact">Download artifact ↓</a>}{submission.notes && <p>{submission.notes}</p>}<small>Need to replace this? Ask an Organizer so the original submission remains auditable.</small></div> : <>
          <div className="submission-tabs"><button className={mode === "link" ? "active" : ""} onClick={() => setMode("link")}>Share a link</button><button className={mode === "file" ? "active" : ""} disabled={!storageAvailable} title={storageAvailable ? "Upload a small project artifact" : "File storage is not configured; use a link"} onClick={() => setMode("file")}>Upload a file</button></div>
          {mode === "link" ? <label>PROJECT LINK<input type="url" value={artifactUrl} onChange={(event) => setArtifactUrl(event.target.value)} placeholder="https://drive.google.com/… or https://github.com/…" /><small>Google Drive, GitHub, or another HTTPS link is accepted.</small></label> : <label>PROJECT FILE<input type="file" accept=".zip,.json,.pdf,.txt,.md,.yaml,.yml" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>ZIP, JSON, PDF, TXT, Markdown, or YAML · maximum 25 MB.</small></label>}
          <label>SHORT NOTE <small>Optional</small><textarea rows={3} maxLength={1500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What should the reviewer open or run first?" /></label>
          {mode === "link" && <label className="sharing-confirmation"><input type="checkbox" checked={shareConfirmed} onChange={(event) => setShareConfirmed(event.target.checked)} /><span>I confirmed that Organizers can open or download this link without requesting access.</span></label>}
          <button className="primary" disabled={busy === "artifact" || (mode === "link" ? !artifactUrl.trim() || !shareConfirmed : !file)} onClick={() => void submitArtifact()}>{busy === "artifact" ? "Submitting…" : "Submit project artifact →"}</button>
        </>}
      </section>
      <section className={submission?.demoVideoUrl ? "submission-card complete" : "submission-card"}><header><b>02</b><div><span>FROM HOME · SHARE WITHIN 24 HOURS</span><h3>Demo video link</h3><p>Use Google Drive, YouTube, Loom, or another shareable HTTPS video link. AgentForge does not store the large video file.</p></div>{submission?.demoVideoUrl && <em>Complete</em>}</header>
        <label>DEMO VIDEO LINK<input type="url" value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} placeholder="https://youtu.be/… or https://drive.google.com/…" /><small>{submission ? `Target deadline: ${new Date(submission.demoDueAt).toLocaleString()}` : "Submit the project artifact first to create the 24-hour deadline."}</small></label>
        <label className="sharing-confirmation"><input type="checkbox" checked={shareConfirmed} onChange={(event) => setShareConfirmed(event.target.checked)} /><span>I confirmed that Organizers can watch this video without requesting access.</span></label>
        <button className="primary" disabled={!submission || !demoUrl.trim() || !shareConfirmed || busy === "demo"} onClick={() => void submitDemo()}>{busy === "demo" ? "Saving…" : submission?.demoVideoUrl ? "Update demo link" : "Save demo link →"}</button>
      </section>
      <aside className="demo-checklist"><span>YOUR DEMO SHOULD PROVE</span>{["The real problem", "A working end-to-end task", "The key human checkpoint", "A repeatable success test", "What changed after iteration", "What context the agent used", "Data and privacy choices"].map((item, i) => <label key={item}><input type="checkbox" /> <b>{String(i + 1).padStart(2, "0")}</b><span>{item}</span></label>)}<small className="checklist-note">This checklist stays on your device and does not affect judging.</small></aside>
    </div>}
  </div>;
}

type NoteAttribution = { text: string; editorName: string; color: string };
type SharedNote = { id: string; authorName: string; content: string; sourceType: "manual" | "assistant"; attributionJson?: string; updatedByName?: string; updatedAt?: number; revision?: number; createdAt: number };

const memberColors = ["violet", "orange", "blue", "green", "pink"];
function colorForMember(name: string) { return memberColors[[...name].reduce((total, char) => total + char.charCodeAt(0), 0) % memberColors.length]; }
function noteAttributions(note: SharedNote): NoteAttribution[] {
  try { const value = JSON.parse(note.attributionJson || "[]") as NoteAttribution[]; if (Array.isArray(value) && value.map((item) => item.text).join("") === note.content) return value; } catch { /* old notes fall back to their original author */ }
  return [{ text: note.content, editorName: note.authorName, color: colorForMember(note.authorName) }];
}
function attributeEdit(note: SharedNote, next: string, editorName: string) {
  const previous = note.content;
  const chars = noteAttributions(note).flatMap((part) => [...part.text].map((text) => ({ text, editorName: part.editorName, color: part.color })));
  let prefix = 0; while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++;
  let suffix = 0; while (suffix < previous.length - prefix && suffix < next.length - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
  const attributed = [...chars.slice(0, prefix), ...[...next.slice(prefix, next.length - suffix)].map((text) => ({ text, editorName, color: colorForMember(editorName) })), ...chars.slice(previous.length - suffix)];
  return attributed.reduce<NoteAttribution[]>((parts, char) => { const last = parts.at(-1); if (last && last.editorName === char.editorName && last.color === char.color) last.text += char.text; else parts.push({ ...char }); return parts; }, []);
}

function SharedNoteCard({ note, editorName = "Team member", onUpdated }: { note: SharedNote; editorName?: string; onUpdated: (note: SharedNote) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!draft.trim() || draft.trim() === note.content) { setEditing(false); return; }
    setSaving(true); setError("");
    let authorId = sessionStorage.getItem("agentforge_participant_id");
    if (!authorId) { authorId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", authorId); }
    const attributionJson = JSON.stringify(attributeEdit(note, draft.trim(), editorName));
    try {
      const response = await fetch("/api/team-notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: note.id, content: draft, attributionJson, expectedUpdatedAt: note.updatedAt ?? null }) });
      const result = await response.json() as { note?: Partial<SharedNote>; current?: SharedNote; conflict?: boolean; error?: string };
      if (response.status === 409 && result.current) { onUpdated(result.current); setDraft(result.current.content); throw new Error(result.error || "A teammate saved a newer version."); }
      if (!response.ok || !result.note) throw new Error(result.error || "Note could not be updated.");
      onUpdated({ ...note, ...result.note, attributionJson }); setEditing(false);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Note could not be updated."); }
    finally { setSaving(false); }
  }
  return <article><header><span className={`member-avatar ${colorForMember(note.authorName)}`}>{note.authorName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{note.authorName}</strong><small>{new Date(note.createdAt).toLocaleString()} · {note.updatedAt ? `Edited by ${note.updatedByName} ${new Date(note.updatedAt).toLocaleString()}` : note.sourceType === "assistant" ? "Saved from AI Assistant" : "Added by team member"}</small></div><span className={note.sourceType === "assistant" ? "note-source ai" : "note-source"}>{note.sourceType === "assistant" ? "AI NOTE" : "TEAM NOTE"}</span><button className="note-edit-button" onClick={() => { setDraft(note.content); setEditing(true); }}>Edit</button></header>{editing ? <div className="note-editor"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} /><div>{error && <small className="form-error">{error}</small>}<button className="text-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary" onClick={() => void save()} disabled={saving || !draft.trim()}>{saving ? "Saving…" : "Save changes"}</button></div></div> : <p className="attributed-note">{noteAttributions(note).map((part, index) => <span key={`${part.editorName}-${index}`} className={`note-attribution ${part.color}`} title={`${part.editorName} added or edited this text`}>{part.text}</span>)}</p>}</article>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyTeamSpace() {
  const [tab, setTab] = useState<"activity" | "notes" | "memories" | "questions">("notes");
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteError, setNoteError] = useState("");
  const activity = [
    { avatar: "YR", color: "violet", person: "Yuxin", action: "saved an Agent Canvas", detail: "Personal knowledge continuity agent", meta: "2 min ago · Visible to Team Synapse", icon: "✦" },
    { avatar: "AM", color: "orange", person: "Amina", action: "shared a memory", detail: "User interview notes — planning pain points", meta: "18 min ago · Cognee / team-synapse", icon: "▤" },
    { avatar: "JL", color: "blue", person: "Jason", action: "completed a milestone", detail: "First agent working", meta: "31 min ago · Evidence attached", icon: "✓" },
    { avatar: "AM", color: "orange", person: "Amina", action: "searched the shared space", detail: "What preferences did our interviews reveal?", meta: "44 min ago · 3 sources used", icon: "?" },
  ];
  const memories = [
    ["User interview notes", "Amina", "8 concepts · 14 relationships", "Team"],
    ["Agent Canvas — v1", "Yuxin", "Problem, scope, data boundaries", "Team"],
    ["ClawMax test run #04", "Jason", "Successful end-to-end run", "Team"],
    ["Mentor feedback", "Yuxin", "Evaluation and privacy suggestions", "Private"],
  ];
  const questions = [
    ["What preferences did our interviews reveal?", "Amina", "Answered · 3 sources"],
    ["What changed after mentor feedback?", "Yuxin", "Answered · 2 sources"],
    ["Which test cases are still failing?", "Jason", "Needs answer"],
  ];

  async function loadNotes() {
    setNotesLoading(true); setNoteError("");
    try {
      const response = await fetch("/api/team-notes?teamId=team-synapse-demo");
      const result = await response.json() as { notes?: SharedNote[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Shared notes could not be loaded.");
      setNotes(result.notes || []);
    } catch (error) { setNoteError(error instanceof Error ? error.message : "Shared notes could not be loaded."); }
    finally { setNotesLoading(false); }
  }

  async function addNote() {
    if (!noteDraft.trim()) return;
    let authorId = sessionStorage.getItem("agentforge_participant_id");
    if (!authorId) { authorId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", authorId); }
    const response = await fetch("/api/team-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: "team-synapse-demo", authorId, authorName: "Yuxin Ren", content: noteDraft, sourceType: "manual" }) });
    const result = await response.json() as { note?: SharedNote; error?: string };
    if (!response.ok || !result.note) { setNoteError(result.error || "Note could not be added."); return; }
    setNotes((items) => [result.note!, ...items]); setNoteDraft(""); setNoteError("");
  }

  useEffect(() => { const timer = window.setTimeout(() => void loadNotes(), 0); return () => window.clearTimeout(timer); }, []);

  return <>
    <div className="demo-notice"><span>DEMO VIEW</span><div><strong>This is an example of Shared Space before real participant data exists.</strong><p>During the hackathon, this page will populate only when team members save canvases, share notes or memories, search the shared space, or complete milestones.</p></div></div>
    <div className="team-hero"><div><span className="team-logo large">S</span><div><span className="eyebrow">TEAM SYNAPSE · SHARED WORKSPACE</span><h2>Build with one shared context.</h2><p>See what teammates decided, contributed, tested, and learned—without merging everyone’s private information.</p></div></div><button className="outline-button">＋ Invite teammate</button></div>
    <div className="team-metric-grid"><article><small>TEAM MEMBERS</small><strong>3</strong><span>All active today</span></article><article><small>SHARED MEMORIES</small><strong>24</strong><span>3 added this hour</span></article><article><small>TEAM QUESTIONS</small><strong>7</strong><span>6 answered with sources</span></article><article><small>MILESTONES</small><strong>7/11</strong><span>Next: evaluation case</span></article></div>
    <div className="team-space-grid"><section className="team-feed"><div className="team-tabs"><div>{(["activity", "notes", "memories", "questions"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div><span>{tab === "notes" ? "Live shared data" : "Demo data"}</span></div>
      {tab === "activity" && <div className="activity-list">{activity.map((item) => <article key={item.detail}><span className={`member-avatar ${item.color}`}>{item.avatar}</span><div><p><strong>{item.person}</strong> {item.action}</p><h3><span>{item.icon}</span>{item.detail}</h3><small>{item.meta}</small></div><button aria-label={`Open ${item.detail}`}>→</button></article>)}</div>}
      {tab === "notes" && <div className="shared-notes"><div className="note-composer"><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} placeholder="Add a useful decision, finding, reminder, or AI answer for your team…" /><div><small>Visible to everyone in Team Synapse</small><button className="primary" onClick={() => void addNote()} disabled={!noteDraft.trim()}>＋ Add note</button></div></div>{noteError && <p className="form-error">{noteError}</p>}{notesLoading ? <p className="notes-empty">Loading shared notes…</p> : notes.length === 0 ? <p className="notes-empty">No shared notes yet. Add the first note here or save an AI answer from the Assistant.</p> : <div className="note-list">{notes.map((note) => <SharedNoteCard key={note.id} note={note} onUpdated={(updated) => setNotes((items) => items.map((item) => item.id === updated.id ? updated : item))} />)}</div>}</div>}
      {tab === "memories" && <div className="shared-list">{memories.map(([title, person, detail, scope]) => <article key={title}><span className="list-icon">▤</span><div><h3>{title}</h3><p>Shared by {person} · {detail}</p></div><span className={scope === "Team" ? "scope team" : "scope private"}>{scope}</span><button>Open →</button></article>)}</div>}
      {tab === "questions" && <div className="shared-list">{questions.map(([question, person, status]) => <article key={question}><span className="list-icon">?</span><div><h3>{question}</h3><p>Asked by {person}</p></div><span className="question-status">{status}</span><button>Open →</button></article>)}</div>}
    </section>
    <aside className="real-event-guide"><span>IN THE REAL HACKATHON</span><h3>What makes something appear here?</h3><div><b>01</b><p><strong>A member chooses “Share with team.”</strong>The Canvas, memory, question, or evidence becomes visible to teammates.</p></div><div><b>02</b><p><strong>The system records the action.</strong>Who did what, when, and which tool or dataset was used appears in Activity.</p></div><div><b>03</b><p><strong>Teammates can reuse it.</strong>They can open the contribution, cite it in a question, or use it in their agent workflow.</p></div><div><b>04</b><p><strong>Private stays private.</strong>Personal drafts and memories remain hidden unless the owner explicitly changes their sharing scope.</p></div><hr /><p className="guide-note"><strong>What you see now:</strong> Yuxin, Amina, Jason, their memories, questions, and activity are illustrative demo records. Real participant actions will replace these examples after authentication, team membership, and Cognee event tracking are connected.</p></aside></div>
  </>;
}

type TeamOverview = {
  account: PortalUser;
  team: { id: string; name: string; inviteCode: string } | null;
  members: Array<{ id: string; displayName: string; role: string; membershipRole: string; joinedAt: number }>;
  projects: Array<{ id: string; title: string; problem: string; successCriteria?: string; status: string; participantId: string; updatedAt: number }>;
  progress: Array<{ participantId: string; displayName: string; milestone: string; status: string; source: string; occurredAt: number }>;
  memories: Array<{ id: string; participantId: string; entryKind: string; category: string; statement: string; participantName?: string; memoryStatus?: string; observedAt: number }>;
  questions: Array<{ id: string; participantId: string; page: string; tutorialStep?: string; userPrompt: string; responseText?: string; status: string; createdAt: number }>;
};

function TeamSpace() {
  const [data, setData] = useState<TeamOverview | null>(null);
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [tab, setTab] = useState<"notes" | "canvas" | "progress" | "memory" | "questions">("notes");
  const [draft, setDraft] = useState("");
  const [teamMode, setTeamMode] = useState<"create" | "join">("create");
  const [teamValue, setTeamValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function refresh(silent = false) {
    if (!silent) setBusy(true);
    try {
      const [teamResponse, noteResponse] = await Promise.all([fetch("/api/team"), fetch("/api/team-notes")]);
      const teamResult = await teamResponse.json() as TeamOverview & { error?: string };
      const noteResult = await noteResponse.json() as { notes?: SharedNote[]; error?: string };
      if (!teamResponse.ok) throw new Error(teamResult.error || "Team workspace could not be loaded.");
      setData(teamResult); if (noteResponse.ok) setNotes(noteResult.notes || []); setError("");
    } catch (problem) { if (!silent) setError(problem instanceof Error ? problem.message : "Team workspace could not be loaded."); }
    finally { if (!silent) setBusy(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); const interval = window.setInterval(() => void refresh(true), 10000); return () => { window.clearTimeout(timer); window.clearInterval(interval); }; }, []);

  async function accountAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try { const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Team could not be updated."); setTeamValue(""); await refresh(true); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Team could not be updated."); }
    finally { setBusy(false); }
  }
  async function addNote() {
    if (!draft.trim()) return; setBusy(true);
    try { const response = await fetch("/api/team-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: draft, sourceType: "manual" }) }); const result = await response.json() as { note?: SharedNote; error?: string }; if (!response.ok || !result.note) throw new Error(result.error || "Note could not be added."); setNotes((items) => [result.note!, ...items]); setDraft(""); setError(""); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Note could not be added."); } finally { setBusy(false); }
  }
  async function regenerateInvite() {
    setBusy(true); try { const response = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "regenerate_invite" }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Invite code could not be regenerated."); await refresh(true); } catch (problem) { setError(problem instanceof Error ? problem.message : "Invite code could not be regenerated."); } finally { setBusy(false); }
  }

  if (!data) return <div className="team-loading"><h2>{busy ? "Loading team workspace…" : "Team workspace unavailable"}</h2>{error && <p className="form-error">{error}</p>}</div>;
  if (!data.team) return <div className="team-onboarding-card"><span className="eyebrow">TEAM MANAGEMENT</span><h2>Create a team or join one.</h2><p>One participant can have one active team. Switching teams closes the old membership while retaining its event history.</p><div className="auth-tabs"><button className={teamMode === "create" ? "active" : ""} onClick={() => setTeamMode("create")}>Create</button><button className={teamMode === "join" ? "active" : ""} onClick={() => setTeamMode("join")}>Join</button></div><input value={teamValue} onChange={(event) => setTeamValue(event.target.value)} placeholder={teamMode === "create" ? "Team name" : "Invite code"} />{error && <p className="form-error">{error}</p>}<button className="primary" disabled={busy || !teamValue.trim()} onClick={() => void accountAction(teamMode === "create" ? "create_team" : "join_team", teamMode === "create" ? { teamName: teamValue } : { inviteCode: teamValue })}>{busy ? "Saving…" : teamMode === "create" ? "Create team" : "Join team"}</button></div>;

  const creator = data.members.find((member) => member.id === data.account.participantId)?.membershipRole === "creator";
  const latestProgress = new Map<string, TeamOverview["progress"][number]>(); for (const item of data.progress) if (!latestProgress.has(`${item.participantId}:${item.milestone}`)) latestProgress.set(`${item.participantId}:${item.milestone}`, item);
  const completed = [...latestProgress.values()].filter((item) => item.status === "completed" || item.status === "verified").length;
  const ownMemories = data.memories.filter((memory) => memory.participantId === data.account.participantId);
  const teammateMemories = data.memories.filter((memory) => memory.participantId !== data.account.participantId);
  const teammateMemoryGroups = Array.from(teammateMemories.reduce((groups, memory) => {
    const existing = groups.get(memory.participantId) || { participantId: memory.participantId, participantName: memory.participantName || "Team participant", memories: [] as TeamOverview["memories"] };
    existing.memories.push(memory); groups.set(memory.participantId, existing); return groups;
  }, new Map<string, { participantId: string; participantName: string; memories: TeamOverview["memories"] }>()).values());
  const memoryCards = (memories: TeamOverview["memories"]) => <div className="team-record-list memory-card-grid">{memories.map((memory) => <article key={memory.id}><small>{memory.entryKind.toUpperCase()} · {memory.category} · {memory.memoryStatus || "not queued"}</small><h3>{memory.statement}</h3><p>{new Date(memory.observedAt).toLocaleString()}</p></article>)}</div>;
  return <div className="real-team-space"><section className="team-command"><div><span className="team-logo large">{data.team.name[0]?.toUpperCase()}</span><div><span className="eyebrow">REAL TEAM WORKSPACE</span><h2>{data.team.name}</h2><p>{data.members.length} active members · refreshes every 10 seconds</p></div></div><div className="invite-control"><small>INVITE CODE</small><strong>{data.team.inviteCode}</strong><button onClick={() => { void navigator.clipboard.writeText(data.team!.inviteCode); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>{creator && <button onClick={() => void regenerateInvite()} disabled={busy}>Regenerate</button>}<button className="danger-link" onClick={() => void accountAction("leave_team")} disabled={busy}>Leave team</button></div></section>{error && <p className="form-error">{error}</p>}<section className="team-live-metrics"><article><small>MEMBERS</small><strong>{data.members.length}</strong><span>{data.members.map((item) => item.displayName).join(", ")}</span></article><article><small>SHARED NOTES</small><strong>{notes.length}</strong><span>Attributed edit history</span></article><article><small>MEMORIES</small><strong>{data.memories.length}</strong><span>{ownMemories.length} yours · {teammateMemories.length} from teammates</span></article><article><small>PROJECT CANVASES</small><strong>{data.projects.length}</strong><span>Visible to current team</span></article><article><small>PROGRESS EVENTS</small><strong>{completed}</strong><span>Latest completed milestones</span></article></section><section className="team-live-panel"><nav>{(["notes", "canvas", "progress", "memory", "questions"] as const).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>{tab === "notes" && <div className="shared-notes"><div className="note-composer"><textarea rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a shared decision, finding, or reminder…" /><div><small>Visible to all current members of {data.team.name}</small><button className="primary" onClick={() => void addNote()} disabled={busy || !draft.trim()}>Add note</button></div></div>{notes.length ? <div className="note-list">{notes.map((note) => <SharedNoteCard key={note.id} note={note} editorName={data.account.displayName} onUpdated={(updated) => setNotes((items) => items.map((item) => item.id === updated.id ? updated : item))} />)}</div> : <p className="notes-empty">No shared notes yet.</p>}</div>}{tab === "canvas" && <div className="team-record-list">{data.projects.length ? data.projects.map((project) => <article key={project.id}><small>{project.status.toUpperCase()} · {new Date(project.updatedAt).toLocaleString()}</small><h3>{project.title}</h3><p>{project.problem}</p><strong>Success: {project.successCriteria || "Not defined"}</strong></article>) : <p className="notes-empty">No team member has saved a project Canvas while in this team.</p>}</div>}{tab === "progress" && <div className="team-progress-board">{data.members.map((member) => { const entries = [...latestProgress.values()].filter((item) => item.participantId === member.id && (item.status === "completed" || item.status === "verified")); return <article key={member.id}><header><strong>{member.displayName}</strong><span>{entries.length}/11</span></header><div><i style={{ width: `${Math.min(100, entries.length / 11 * 100)}%` }} /></div><p>{entries.slice(0, 4).map((item) => item.milestone).join(" · ") || "No completed milestones yet"}</p></article>; })}</div>}{tab === "memory" && <div className="team-memory-groups"><section className="memory-member-section is-current-user"><header><div><span>YOUR MEMORY</span><h3>{data.account.displayName}</h3><p>Your participant model records are pinned here for quick access.</p></div><strong>{ownMemories.length}</strong></header>{ownMemories.length ? memoryCards(ownMemories) : <p className="notes-empty">You have no Team-scoped memory yet.</p>}</section><div className="memory-team-divider"><span>TEAMMATE MEMORY</span><p>Records shared by the other members of {data.team.name}.</p></div>{teammateMemoryGroups.length ? teammateMemoryGroups.map((group) => <section className="memory-member-section" key={group.participantId}><header><div><span>TEAM MEMBER</span><h3>{group.participantName}</h3></div><strong>{group.memories.length}</strong></header>{memoryCards(group.memories)}</section>) : <p className="notes-empty teammate-empty">No teammate memory has been shared yet.</p>}</div>}{tab === "questions" && <div className="team-record-list">{data.questions.length ? data.questions.map((question) => <article key={question.id}><small>{question.page} · {new Date(question.createdAt).toLocaleString()}</small><h3>{question.userPrompt}</h3><p>{question.responseText || question.status}</p></article>) : <p className="notes-empty">No team-linked Assistant questions yet.</p>}</div>}</section></div>;
}

type OrganizerData = {
  generatedAt: number;
  summary: { totalPrompts: number; inputTokens: number; outputTokens: number; interviewerCalls: number; interviewerInputTokens: number; interviewerOutputTokens: number; successRate: number; avgLatencyMs: number; lastHour: number };
  hourly: Array<{ hour: string; prompts: number; tokens: number }>;
  pages: Array<{ page: string; tutorialStep?: string; prompts: number; errors: number; tokens: number }>;
  teams: Array<{ teamId: string; teamName: string; prompts: number; tokens: number }>;
  prompts: Array<{ id: string; participantId: string; participantDisplayName: string; participantEmail?: string | null; teamId?: string; teamName: string; page: string; tutorialStep?: string; userPrompt: string; responseText?: string; modelName?: string; latencyMs?: number; inputTokens?: number; outputTokens?: number; status: string; errorCode?: string; userFeedback?: string; createdAt: number }>;
  settings: { assistantEnabled: number; eventTokenQuota: number; defaultTeamTokenQuota: number; defaultParticipantTokenQuota: number; perMinuteRequestLimit: number; perHourRequestLimit: number; maxConcurrentRequests: number; maxOutputTokens: number; providerKeyCount: number; keyRouting: string };
  preflight: { databaseReady: boolean; missingTables: string[]; emailConfigured: boolean; appOriginConfigured: boolean; scheduleConfigured?: boolean; clawmaxConfigured?: boolean; queueConfigured?: boolean; cogneeErrorCount?: number; activeReservations?: number; staleReservations?: number; expectedParticipantScale: string };
  cognee: { connected: boolean; sync: Array<{ status: string; count: number }> };
  clawmax: {
    status: Array<{ status: string; count: number }>;
    recent: Array<{ eventId: string; source: string; occurredAt: string; normalizationStatus: string; normalizationError?: string; participantId?: string; teamId?: string; receivedAt: number; participantDisplayName?: string }>;
    connections: Array<{ id: string; destinationId: string; status: string; workspaceId: string; createdAt: number; updatedAt: number; participantDisplayName: string; receiptCount: number; activeReceipts: number }>;
    purges: Array<{ id: string; receiptId: string; status: string; rawEventsPurged: number; normalizedRecordsPurged: number; cogneeRecordsPending: number; lastError?: string | null; createdAt: number; completedAt?: number | null; workspaceId: string; participantDisplayName: string }>;
  };
  participantModel: Array<{ entryKind: string; count: number }>;
  learningSignals: Array<{ id: string; page: string; tutorialStep?: string; promptCount: number; participantCount: number; errorCount: number; negativeFeedbackCount: number; detectionRule: string; cogneeSummary?: string; suggestedAction?: string; reviewStatus: string; createdAt: number }>;
  promptClusters: Array<{ id: string; page: string; tutorialStep?: string; category: string; label: string; participantLevel: string; promptCount: number; participantCount: number; errorCount: number; examplesJson: string; windowStartedAt: number; windowEndedAt: number; createdAt: number }>;
  signalEvidence: Array<{ signalId: string; promptEventId: string; userPrompt: string; status: string; errorCode?: string; userFeedback?: string; createdAt: number }>;
  feedbacks: Array<{ id: string; promptEventId: string; participantId: string; teamId?: string | null; participantDisplayName: string; feedback: "helpful" | "partly_helpful" | "not_helpful"; reasonCode?: string | null; note?: string | null; page: string; tutorialStep?: string | null; userPrompt: string; createdAt: number }>;
  promptEvaluations: Array<{ id: string; promptEventId: string; rubricVersion: string; evaluator: string; evaluationJson: string; totalScore?: number | null; createdAt: number; participantId: string; participantDisplayName?: string; participantEmail?: string | null; teamId?: string | null; teamName?: string; page: string; tutorialStep?: string; userPrompt: string; contextReference?: string; parentPromptEventId?: string; parentPrompt?: string; outcomeStatus?: string; outcomeEvidence?: string }>;
  operations: { registeredParticipants: number; activeTeams: number; submittedTeams: number; completeSubmissions: number; feedbackCount: number };
  submissions: Array<{ id: string; teamId: string; teamName: string; submittedByParticipantId: string; submittedByName: string; artifactKind: "file" | "link"; artifactUrl?: string | null; artifactFilename?: string | null; artifactSizeBytes?: number | null; notes?: string | null; artifactSubmittedAt: number; demoVideoUrl?: string | null; demoSubmittedAt?: number | null; demoDueAt: number; status: "artifact_submitted" | "complete"; updatedAt: number }>;
};

type RegisteredParticipant = { id: string; displayName: string; email?: string | null; emailVerifiedAt?: number | null; role: "participant" | "organizer"; consentVersion: string; consentStatus: "accepted" | "withdrawn" | "pending"; joinedAt: number; lastActive: number; teamId?: string | null; teamName?: string | null };
type ManagedTeam = { id: string; name: string; workspaceKind: "team" | "personal"; activeMembers: number };
type OrganizerGrant = { email: string; status: "active" | "revoked"; grantedByName: string; createdAt: number; updatedAt: number };
type AnnouncementHistoryItem = { id: string; announcementText?: string | null; action: "published" | "updated" | "withdrawn"; active: number | boolean; editorName: string; createdAt: number };
const toLocalInput = (value?: number | null) => value ? new Date(Number(value) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
type ProcessIndicatorView = { score?: number | null; status?: string; evidence: string[]; rationale?: string };
type PromptEvaluationView = { scores: Record<string, number | null>; criterionEvidence: Record<string, string[]>; processIndicators: Record<string, ProcessIndicatorView>; totalScore?: number; maxScore?: number; grade?: string; coachingStatus?: string; strengths: string[]; weaknesses: string[]; improvedPrompt?: string; summary?: string; evidenceUsed: string[]; evidenceMissing: string[]; inferenceNotice?: string };

function AIAllocationControls({ settings, totalTokens, onSave }: { settings: OrganizerData["settings"]; totalTokens: number; onSave: (settings: OrganizerData["settings"]) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const numeric = (key: keyof OrganizerData["settings"], value: string) => setDraft((current) => ({ ...current, [key]: Number(value) }));
  const fields: Array<[keyof OrganizerData["settings"], string, string, number, number]> = [
    ["eventTokenQuota", "Event token budget", "Admission ceiling across every team and participant, based on recorded usage.", 1000, 1000000000],
    ["defaultTeamTokenQuota", "Default team budget", "Shared ceiling for each team.", 1000, 10000000],
    ["defaultParticipantTokenQuota", "Default participant budget", "Personal ceiling inside the team budget.", 500, 10000000],
    ["maxOutputTokens", "Tokens per response", "Controls maximum answer length and worst-case cost.", 128, 4000],
    ["perMinuteRequestLimit", "Requests per minute", "Absorbs bursts and accidental repeated clicks.", 1, 60],
    ["perHourRequestLimit", "Requests per hour", "Sustained-use ceiling for each participant.", 1, 1000],
    ["maxConcurrentRequests", "Concurrent requests", "How many Ask AI calls one participant may run at once.", 1, 5],
  ];
  return <section className="ai-allocation-panel"><header><div><span className="eyebrow">SERVER-MANAGED AI ACCESS</span><h3>Allocation & Usage Policy</h3><p>Participants never receive provider keys. AgentForge routes each team to a stable server-side key slot, then applies Event → Team → Participant limits before a model call.</p></div><div className={settings.providerKeyCount > 1 ? "key-pool-status ready" : "key-pool-status warning"}><small>PROVIDER KEY POOL</small><strong>{settings.providerKeyCount} active slot{settings.providerKeyCount === 1 ? "" : "s"}</strong><span>{settings.providerKeyCount > 1 ? "Teams are distributed across the pool." : settings.providerKeyCount === 1 ? "One fallback key is active. Add a server-side pool before the event." : "No provider key is configured."}</span></div></header><div className="allocation-flow"><span><b>1</b>Event ceiling</span><i>→</i><span><b>2</b>Team allocation</span><i>→</i><span><b>3</b>Member allocation</span><i>→</i><span><b>4</b>Request controls</span></div><div className="allocation-fields">{fields.map(([key,label,help,min,max]) => <label key={key}><span>{label}</span><input type="number" min={min} max={max} value={Number(draft[key])} onChange={(event) => numeric(key,event.target.value)} /><small>{help}</small></label>)}</div><footer><div><b>{totalTokens.toLocaleString()} tokens used</b><span>Keys are configured only as deployment secrets. This page stores allocation rules, never secret values.</span></div><button className="primary" disabled={saving} onClick={async () => { setSaving(true); await onSave(draft); setSaving(false); }}>{saving ? "Saving…" : "Save allocation policy"}</button></footer></section>;
}

function parsePromptEvaluation(raw: string): PromptEvaluationView {
  const empty: PromptEvaluationView = { scores: {}, criterionEvidence: {}, processIndicators: {}, strengths: [], weaknesses: [], evidenceUsed: [], evidenceMissing: [] };
  function parseValue(value: unknown): unknown {
    if (typeof value !== "string") return value;
    const cleaned = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try { return JSON.parse(cleaned); } catch { return value; }
  }
  function findEvaluation(value: unknown, depth = 0): Record<string, unknown> | null {
    if (depth > 6) return null;
    const parsed = parseValue(value);
    if (Array.isArray(parsed)) {
      for (const item of parsed) { const found = findEvaluation(item, depth + 1); if (found) return found; }
      return null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    const object = parsed as Record<string, unknown>;
    if (object.scores || object.process_indicators || object.strengths || object.weaknesses || object.improved_prompt || object.total_score) return object;
    for (const key of ["search_result", "result", "response", "evaluation", "data"]) {
      if (key in object) { const found = findEvaluation(object[key], depth + 1); if (found) return found; }
    }
    for (const item of Object.values(object)) { const found = findEvaluation(item, depth + 1); if (found) return found; }
    return null;
  }
  const found = findEvaluation(raw);
  if (!found) return empty;
  const namedScores = ["goal_task_specification", "relevant_context", "constraints_criteria", "own_state_reasoning", "strategic_request", "focus_decomposition", "goal_clarity", "constraints", "decomposition", "verification", "iteration", "efficiency", "learning_agency", "outcome", "clarity", "specificity", "actionability", "iteration_readiness", "safety"];
  const topLevelScores = Object.fromEntries(namedScores.filter((key) => key in found).map((key) => [key, found[key]]));
  const rawScores = (found.scores || found.criteria || topLevelScores) as Record<string, unknown>;
  const scores = Object.fromEntries(Object.entries(rawScores).filter(([, value]) => value === null || Number.isFinite(Number(value))).map(([key, value]) => [key, value === null ? null : Number(value)]));
  const list = (value: unknown) => Array.isArray(value) ? value.map((item) => typeof item === "string" ? item : JSON.stringify(item)) : typeof value === "string" && value ? [value] : [];
  const criterionRaw = found.criterion_evidence && typeof found.criterion_evidence === "object" ? found.criterion_evidence as Record<string, unknown> : {};
  const criterionEvidence = Object.fromEntries(Object.entries(criterionRaw).map(([key, value]) => [key, list(value)]));
  const processRaw = found.process_indicators && typeof found.process_indicators === "object" ? found.process_indicators as Record<string, unknown> : {};
  const processIndicators = Object.fromEntries(Object.entries(processRaw).map(([key, value]) => {
    const indicator = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const score = indicator.score === null ? null : Number.isFinite(Number(indicator.score)) ? Number(indicator.score) : undefined;
    return [key, { score, status: typeof indicator.status === "string" ? indicator.status : undefined, evidence: list(indicator.evidence), rationale: typeof indicator.rationale === "string" ? indicator.rationale : undefined }];
  }));
  return { scores, criterionEvidence, processIndicators, totalScore: Number.isFinite(Number(found.total_score)) ? Number(found.total_score) : undefined, maxScore: Number.isFinite(Number(found.max_score)) ? Number(found.max_score) : undefined, grade: typeof found.grade === "string" ? found.grade : undefined, coachingStatus: typeof found.coaching_status === "string" ? found.coaching_status : undefined, strengths: list(found.strengths), weaknesses: list(found.weaknesses), improvedPrompt: typeof found.improved_prompt === "string" ? found.improved_prompt : undefined, summary: typeof found.summary === "string" ? found.summary : typeof found.recommendation === "string" ? found.recommendation : undefined, evidenceUsed: list(found.evidence_used || found.observed_evidence), evidenceMissing: list(found.evidence_missing), inferenceNotice: typeof found.inference_notice === "string" ? found.inference_notice : undefined };
}

function PromptEvaluationCard({ item }: { item: OrganizerData["promptEvaluations"][number] }) {
  const evaluation = parsePromptEvaluation(item.evaluationJson);
  const score = item.totalScore ?? evaluation.totalScore;
  const isV4 = item.rubricVersion.startsWith("agentforge-process-coaching-v4");
  const isV3 = item.rubricVersion.startsWith("agentforge-prompt-coaching-v3");
  const criteria: ReadonlyArray<readonly [string, string]> = isV4 ? [["goal_task_specification", "Goal / task"], ["relevant_context", "Relevant context"], ["constraints_criteria", "Constraints / criteria"], ["own_state_reasoning", "Own state / reasoning"], ["strategic_request", "Strategic request"], ["focus_decomposition", "Focus / decomposition"]] : isV3 ? [["goal_clarity", "Goal clarity"], ["relevant_context", "Relevant context"], ["constraints", "Constraints"], ["decomposition", "Decomposition"], ["verification", "Verification"], ["iteration", "Iteration"], ["efficiency", "Efficiency"], ["learning_agency", "Learning agency"], ["outcome", "Outcome"]] : [["clarity", "Clarity"], ["specificity", "Specificity"], ["relevant_context", "Relevant context"], ["actionability", "Actionability"], ["iteration_readiness", "Iteration"], ["safety", "Safety"]];
  const maxScore = evaluation.maxScore || (isV3 ? 32 : 24);
  const ratio = score == null ? null : Number(score) / maxScore;
  const tone = isV4 ? "unknown" : ratio == null ? "unknown" : ratio >= .75 ? "strong" : ratio >= .45 ? "developing" : "needs-work";
  const label = evaluation.coachingStatus?.replaceAll("_", " ") || (isV4 ? "Evidence profile" : score == null ? "Pending" : ratio! >= .75 ? "Effective" : ratio! >= .45 ? "Developing" : "Emerging");
  const observed = Object.values(evaluation.scores).filter((value) => value != null).length + Object.values(evaluation.processIndicators).filter((value) => value.status === "observed").length;
  const processCriteria: ReadonlyArray<readonly [string, string]> = [["verification", "Verification"], ["productive_iteration", "Productive iteration"], ["learning_agency", "Learning agency evidence"]];
  const selectedContext = item.contextReference && item.contextReference !== "No text selected" ? item.contextReference : "";
  return <article className={`evaluation-card ${tone}`}>
    <header><div className="evaluation-score"><div style={{ "--score-angle": `${isV4 ? 0 : Math.max(0, Math.min(maxScore, Number(score || 0))) / maxScore * 360}deg` } as React.CSSProperties}><span><strong>{isV4 ? observed : score ?? "—"}</strong><small>{isV4 ? " signals" : `/${maxScore}`}</small></span></div><span className={`evaluation-grade ${tone}`}>{evaluation.grade || label}</span></div><div className="evaluation-prompt"><span className="eyebrow">{item.participantDisplayName || item.participantId.slice(0, 12)} · {item.teamName || "Unassigned"} · {item.page}{item.tutorialStep ? ` / ${item.tutorialStep}` : ""}</span><h4>{item.userPrompt}</h4><small>{item.rubricVersion} · Evaluated {new Date(item.createdAt).toLocaleString()}</small>{item.parentPrompt && <p className="iteration-evidence"><b>Previous Prompt:</b> {item.parentPrompt}</p>}</div></header>
    {selectedContext && <section className="selected-context-evidence"><span>SELECTED CONTEXT · RAW PARTICIPANT-SUPPLIED EVIDENCE</span><blockquote>{selectedContext}</blockquote><small>This is the text the participant highlighted before asking. It is context for review, not an AI inference.</small></section>}
    <section className="rubric-visual"><div className="rubric-heading"><b>{isV4 ? "PROMPT ADEQUACY FOR THE CURRENT GOAL" : "RUBRIC BREAKDOWN"}</b><span>{isV4 ? "0–3 when observable · N/O when not applicable or missing" : "Each dimension is scored from 0–4"}</span></div><div className="rubric-grid">{criteria.map(([key, labelText]) => { const value = evaluation.scores[key]; const scale = isV4 ? 3 : 4; return <div key={key}><span><b>{labelText}</b><strong>{value == null ? "N/O" : value}<small>{value == null ? "" : `/${scale}`}</small></strong></span><i><em style={{ width: `${value == null ? 0 : Math.max(0, Math.min(scale, Number(value))) / scale * 100}%` }} /></i>{isV4 && <p>{evaluation.criterionEvidence[key]?.join(" · ") || "No criterion-level evidence cited."}</p>}</div>; })}</div></section>
    {isV4 && <section className="process-indicator-grid">{processCriteria.map(([key, labelText]) => { const indicator = evaluation.processIndicators[key]; return <div key={key}><span>{labelText}</span><strong>{indicator?.score == null ? indicator?.status?.replaceAll("_", " ") || "N/O" : `${indicator.score}/4 · ${indicator.status || "provisional"}`}</strong><p>{indicator?.evidence.length ? indicator.evidence.join(" · ") : indicator?.rationale || "Required episode evidence is not available."}</p></div>; })}</section>}
    <section className="evaluation-insights"><div><span className="insight-label positive">STRENGTHS</span>{evaluation.strengths.length ? <ul>{evaluation.strengths.map((text) => <li key={text}>{text}</li>)}</ul> : <p>No strengths were returned in this evaluation.</p>}</div><div><span className="insight-label negative">WHAT TO IMPROVE</span>{evaluation.weaknesses.length ? <ul>{evaluation.weaknesses.map((text) => <li key={text}>{text}</li>)}</ul> : <p>No weaknesses were returned in this evaluation.</p>}</div></section>
    {(isV3 || isV4) && <section className="coaching-evidence-row"><div><span>OBSERVED / REPORTED EVIDENCE</span><p>{evaluation.evidenceUsed.length ? evaluation.evidenceUsed.join(" · ") : "Raw Prompt and linked task context only"}</p></div><div><span>MISSING EVIDENCE</span><p>{evaluation.evidenceMissing.length ? evaluation.evidenceMissing.join(" · ") : "No missing evidence reported"}</p></div><div><span>OUTCOME — SEPARATE FROM PROMPT ADEQUACY</span><p>{item.outcomeStatus ? `${item.outcomeStatus.replaceAll("_", " ")}${item.outcomeEvidence ? ` — ${item.outcomeEvidence}` : ""}` : "Not recorded; no learning or success claim is made"}</p></div></section>}
    {(evaluation.improvedPrompt || evaluation.summary) && <section className="improved-prompt"><div><span>COGNEE-SUGGESTED REVISION</span><small>AI inference · review before use</small></div><p>{evaluation.improvedPrompt || evaluation.summary}</p><button onClick={() => void navigator.clipboard.writeText(evaluation.improvedPrompt || evaluation.summary || "")}>Copy revision</button></section>}
    <details className="raw-evaluation"><summary>Technical details · view raw Cognee payload</summary><pre>{item.evaluationJson}</pre></details>
  </article>;
}

function EventManagement({ config, onSaved }: { config: EventConfig | null; onSaved: (config: EventConfig) => void }) {
  const [participants, setParticipants] = useState<RegisteredParticipant[]>([]);
  const [teams, setTeams] = useState<ManagedTeam[]>([]);
  const [organizerGrants, setOrganizerGrants] = useState<OrganizerGrant[]>([]);
  const [serverOrganizerEmails, setServerOrganizerEmails] = useState<string[]>([]);
  const [currentOrganizerParticipantId, setCurrentOrganizerParticipantId] = useState("");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [organizerSearch, setOrganizerSearch] = useState("");
  const [organizerNotice, setOrganizerNotice] = useState("");
  const [announcementHistory, setAnnouncementHistory] = useState<AnnouncementHistoryItem[]>([]);
  const [showAnnouncementHistory, setShowAnnouncementHistory] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ eventName: config?.eventName || "Personal Agent Hackathon", startsAt: toLocalInput(config?.startsAt), endsAt: toLocalInput(config?.endsAt), timezone: config?.timezone || "America/New_York", discordUrl: config?.discordUrl || "", announcementText: config?.announcementText || "", announcementActive: config?.announcementActive === true || config?.announcementActive === 1, registrationOpen: config?.registrationOpen !== false && config?.registrationOpen !== 0, maxActiveTeams: config?.maxActiveTeams || 35 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function open() {
    setError("");
    const response = await fetch("/api/event?admin=1");
    const result = await response.json() as { config?: EventConfig; participants?: RegisteredParticipant[]; teams?: ManagedTeam[]; organizerGrants?: OrganizerGrant[]; serverOrganizerEmails?: string[]; currentOrganizerParticipantId?: string; announcementHistory?: AnnouncementHistoryItem[]; error?: string };
    if (!response.ok) { setError(response.status === 401 ? "Your account does not have Organizer access." : result.error || "Event management could not be loaded."); return; }
    setParticipants(result.participants || []); setTeams(result.teams || []); setOrganizerGrants(result.organizerGrants || []); setServerOrganizerEmails(result.serverOrganizerEmails || []); setCurrentOrganizerParticipantId(result.currentOrganizerParticipantId || ""); setAnnouncementHistory(result.announcementHistory || []);
    if (result.config) { onSaved(result.config); setForm({ eventName: result.config.eventName || "Personal Agent Hackathon", startsAt: toLocalInput(result.config.startsAt), endsAt: toLocalInput(result.config.endsAt), timezone: result.config.timezone || "America/New_York", discordUrl: result.config.discordUrl || "", announcementText: result.config.announcementText || "", announcementActive: result.config.announcementActive === true || result.config.announcementActive === 1, registrationOpen: result.config.registrationOpen !== false && result.config.registrationOpen !== 0, maxActiveTeams: result.config.maxActiveTeams || 35 }); }
  }

  useEffect(() => { const timer = window.setTimeout(() => void open(), 0); return () => window.clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true); setError("");
    const next: EventConfig = { eventName: form.eventName, startsAt: form.startsAt ? new Date(form.startsAt).getTime() : null, endsAt: form.endsAt ? new Date(form.endsAt).getTime() : null, timezone: form.timezone, discordUrl: form.discordUrl, announcementText: form.announcementText, announcementActive: form.announcementActive, announcementUpdatedAt: Date.now(), registrationOpen: form.registrationOpen, maxActiveTeams: form.maxActiveTeams };
    try {
      const response = await fetch("/api/event", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Event settings could not be saved.");
      onSaved(next);
      await open();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Event settings could not be saved."); }
    finally { setSaving(false); }
  }

  async function updateRole(participant: RegisteredParticipant, role: RegisteredParticipant["role"]) {
    if (participant.role === role) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/event", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participantId: participant.id, role }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The user role could not be changed.");
      setParticipants((items) => items.map((item) => item.id === participant.id ? { ...item, role } : item));
      setOrganizerNotice(role === "organizer" ? `${participant.displayName} now has Organizer access.` : `${participant.displayName} is now a Participant.`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The user role could not be changed."); }
    finally { setSaving(false); }
  }

  async function moveParticipant(participant: RegisteredParticipant, destination: string) {
    if (!destination || destination === participant.teamId) return;
    const destinationName = destination === "personal" ? "a new Personal Workspace" : teams.find((team) => team.id === destination)?.name || "the selected team";
    if (!window.confirm(`Move ${participant.displayName} to ${destinationName}? Earlier records stay linked to the previous team, and previous Shared Space access ends.`)) return;
    const reason = window.prompt("Reason for this team change (saved in the membership audit trail):", "Organizer-managed correction") || "Organizer-managed correction";
    setSaving(true); setError(""); setOrganizerNotice("");
    try {
      const response = await fetch("/api/event", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move_team", participantId: participant.id, targetTeamId: destination === "personal" ? undefined : destination, createPersonal: destination === "personal", reason }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The participant could not be moved.");
      setOrganizerNotice(`${participant.displayName} was moved to ${destinationName}. Earlier team records were preserved.`);
      await open();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The participant could not be moved."); }
    finally { setSaving(false); }
  }

  async function verifyParticipantEmail(participant: RegisteredParticipant) {
    if (!window.confirm(`Manually verify ${participant.email}? Use this only after confirming the address with the participant in person.`)) return;
    setSaving(true); setError(""); setOrganizerNotice("");
    try {
      const response = await fetch("/api/event", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify_email", participantId: participant.id, reason: "Organizer confirmed participant identity during dry run" }) });
      const result = await response.json() as { error?: string; emailVerifiedAt?: number };
      if (!response.ok) throw new Error(result.error || "The email could not be manually verified.");
      setParticipants((items) => items.map((item) => item.id === participant.id ? { ...item, emailVerifiedAt: result.emailVerifiedAt || Date.now() } : item));
      setOrganizerNotice(`${participant.email} is now verified. The action was added to the authentication audit log.`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The email could not be manually verified."); }
    finally { setSaving(false); }
  }

  async function grantOrganizer() {
    setSaving(true); setError(""); setOrganizerNotice("");
    try {
      const response = await fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: organizerEmail }) });
      const result = await response.json() as { error?: string; registered?: boolean; email?: string };
      if (!response.ok) throw new Error(result.error || "Organizer access could not be added.");
      setOrganizerEmail("");
      setOrganizerNotice(result.registered ? `${result.email} now has Organizer access.` : `${result.email} is pre-authorized and will become an Organizer after first sign-in.`);
      await open();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Organizer access could not be added."); }
    finally { setSaving(false); }
  }

  async function revokeOrganizer(email: string) {
    if (!window.confirm(`Remove Organizer access for ${email}?`)) return;
    setSaving(true); setError(""); setOrganizerNotice("");
    try {
      const response = await fetch("/api/event", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Organizer access could not be removed.");
      setOrganizerNotice(`${email} no longer has Organizer access.`);
      await open();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Organizer access could not be removed."); }
    finally { setSaving(false); }
  }

  const query = search.trim().toLowerCase();
  const filtered = participants.filter((participant) => [participant.displayName, participant.email, participant.role, participant.teamName, participant.consentStatus, participant.consentVersion].some((value) => String(value || "").toLowerCase().includes(query)));
  const activeOrganizers = participants.filter((participant) => participant.role === "organizer");
  const activeOrganizerEmails = new Set(activeOrganizers.map((participant) => participant.email?.toLowerCase()).filter(Boolean));
  const pendingGrantEmails = [...new Set([...serverOrganizerEmails, ...organizerGrants.filter((grant) => grant.status === "active").map((grant) => grant.email)])].filter((email) => !activeOrganizerEmails.has(email.toLowerCase()));
  const candidateQuery = organizerSearch.trim().toLowerCase();
  const organizerCandidates = participants.filter((participant) => participant.role === "participant" && (!candidateQuery || [participant.displayName, participant.email, participant.teamName].some((value) => String(value || "").toLowerCase().includes(candidateQuery)))).slice(0, 8);
  return <div className="event-management">
    <div className="live-admin-head"><div><span className="eyebrow">LIVE OPERATIONS</span><h2>Event Management</h2><p>Controls the public countdown, announcements, Discord destination, registration state, and participant directory.</p></div><span className="pill on-track">Real event data</span></div>
    <div className="event-management-grid">
      <section className="event-settings-card"><div className="table-title"><div><h3>Schedule & Community</h3><p>Changes update participant pages after saving.</p></div></div>
        <label>EVENT NAME<input value={form.eventName} onChange={(event) => setForm({ ...form, eventName: event.target.value })} /></label>
        <div className="event-time-fields"><label>START TIME<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label>END TIME<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label></div>
        <label>TIMEZONE<input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></label>
        <label>DISCORD INVITE URL<input type="url" placeholder="https://discord.gg/…" value={form.discordUrl} onChange={(event) => setForm({ ...form, discordUrl: event.target.value })} /></label>
        <label>ACTIVE WORKSPACE LIMIT<input type="number" min={1} max={100} value={form.maxActiveTeams} onChange={(event) => setForm({ ...form, maxActiveTeams: Math.max(1, Math.min(100, Number(event.target.value) || 35)) })} /><small className="field-help">{teams.length} active now · target 25–30 at kickoff · hard limit {form.maxActiveTeams} leaves room for later team splits.</small></label>
        <div className="announcement-editor"><div className="announcement-editor-title"><span>WEBSITE ANNOUNCEMENT</span><button type="button" onClick={() => setShowAnnouncementHistory((visible) => !visible)}>{showAnnouncementHistory ? "Hide history" : `View history (${announcementHistory.filter((item) => item.active).length})`}</button></div><textarea rows={4} maxLength={1000} placeholder="Example: Midpoint feedback starts in Room 204 at 2:30 PM." value={form.announcementText} onChange={(event) => setForm({ ...form, announcementText: event.target.value })} /><label><input type="checkbox" checked={form.announcementActive} onChange={(event) => setForm({ ...form, announcementActive: event.target.checked })} /><span><b>Publish across the website</b><small>Participants receive updates automatically within 30 seconds.</small></span></label><small>{form.announcementText.length}/1000 characters · Website only for now; Discord posting requires a secure webhook.</small>{showAnnouncementHistory && <div className="announcement-history">{announcementHistory.filter((item) => item.active).length ? announcementHistory.filter((item) => item.active).map((item) => <article key={item.id}><header><span className="pill on-track">{item.action}</span><small>{new Date(item.createdAt).toLocaleString()} · {item.editorName}</small></header><p>{item.announcementText}</p></article>) : <p className="notes-empty">No announcements have been published yet.</p>}</div>}</div>
        <label className="registration-toggle"><input type="checkbox" checked={form.registrationOpen} onChange={(event) => setForm({ ...form, registrationOpen: event.target.checked })} /><span><b>Registration open</b><small>When closed, new accounts cannot enter the event. Existing Participants and Organizers can still sign in.</small></span></label>
        {error && <p className="form-error">{error}</p>}<button className="primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : form.announcementActive ? "Save & publish" : "Save event settings"}</button>
      </section>
      <aside className="event-preview-card"><span>PARTICIPANT PREVIEW</span><LiveEvent config={{ ...config, ...form, startsAt: form.startsAt ? new Date(form.startsAt).getTime() : null, endsAt: form.endsAt ? new Date(form.endsAt).getTime() : null }} />{form.announcementActive && form.announcementText && <div className="announcement-preview"><b>EVENT ANNOUNCEMENT</b><p>{form.announcementText}</p></div>}<p>The countdown and announcement use saved event data. No AI or tokens are used.</p></aside>
    </div>
    <section className="organizer-management"><div className="table-title"><div><span className="eyebrow">SERVER-ENFORCED ACCESS</span><h3>Organizer Management</h3><p>Add an email before signup, promote a registered Participant, or remove Organizer access. At least one Organizer must remain.</p></div><span className="organizer-count"><strong>{activeOrganizers.length}</strong> active</span></div>
      {organizerNotice && <p className="organizer-notice">{organizerNotice}</p>}{error && <p className="form-error organizer-error">{error}</p>}
      <div className="organizer-management-grid"><div className="organizer-roster"><h4>Current Organizers</h4>{activeOrganizers.length ? activeOrganizers.map((participant) => { const email = participant.email?.toLowerCase() || ""; const protectedOrganizer = serverOrganizerEmails.includes(email); return <article key={participant.id}><span className="organizer-avatar">{participant.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{participant.displayName}{participant.id === currentOrganizerParticipantId ? " · You" : ""}</strong><small>{participant.email || "Email unavailable"}</small><em>{participant.teamName || "No participant team"} · joined {new Date(participant.joinedAt).toLocaleDateString()}</em></div><span className={`access-source ${protectedOrganizer ? "protected" : "managed"}`}>{protectedOrganizer ? "SERVER PROTECTED" : "MANAGED HERE"}</span><button className="outline-button danger" disabled={saving || protectedOrganizer || activeOrganizers.length <= 1} title={protectedOrganizer ? "This email is protected by the server allowlist." : activeOrganizers.length <= 1 ? "At least one Organizer must remain." : "Remove Organizer access"} onClick={() => void revokeOrganizer(email)}>Remove access</button></article>; }) : <p className="notes-empty">No Organizer accounts are registered yet.</p>}{pendingGrantEmails.length > 0 && <div className="pending-organizers"><span>PENDING FIRST SIGN-IN</span>{pendingGrantEmails.map((email) => { const protectedOrganizer = serverOrganizerEmails.includes(email.toLowerCase()); return <div key={email}><span><strong>{email}</strong><small>{protectedOrganizer ? "Server-approved email" : `Added by ${organizerGrants.find((grant) => grant.email === email)?.grantedByName || "Organizer"}`}</small></span>{protectedOrganizer ? <b>PROTECTED</b> : <button disabled={saving} onClick={() => void revokeOrganizer(email)}>Revoke</button>}</div>; })}</div>}</div>
        <aside className="organizer-controls"><div><span className="eyebrow">ADD BY EMAIL</span><h4>Authorize an Organizer</h4><p>If the account already exists, access changes immediately. Otherwise the email is safely held until first sign-in.</p><label>ORGANIZER EMAIL<input type="email" placeholder="organizer@example.com" value={organizerEmail} onChange={(event) => setOrganizerEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && organizerEmail.trim()) void grantOrganizer(); }} /></label><button className="primary" disabled={saving || !organizerEmail.trim()} onClick={() => void grantOrganizer()}>{saving ? "Saving…" : "Add Organizer"}</button></div><div className="promote-participant"><span className="eyebrow">REGISTERED USERS</span><h4>Promote a Participant</h4><input type="search" placeholder="Search name, email, or team…" value={organizerSearch} onChange={(event) => setOrganizerSearch(event.target.value)} />{organizerCandidates.length ? organizerCandidates.map((participant) => <button key={participant.id} disabled={saving} onClick={() => void updateRole(participant, "organizer")}><span><strong>{participant.displayName}</strong><small>{participant.email || participant.teamName || "Registered Participant"}</small></span><b>Make Organizer</b></button>) : <p className="notes-empty">No matching Participants.</p>}</div></aside></div>
    </section>
    {participants.some((participant) => !participant.emailVerifiedAt) && <section className="email-fallback-panel"><div><span className="eyebrow">DRY-RUN FALLBACK</span><h3>Email verification needs attention</h3><p>Use manual verification only after confirming the participant’s identity in person. Every override is audited.</p></div><div>{participants.filter((participant) => !participant.emailVerifiedAt).map((participant) => <article key={participant.id}><span><strong>{participant.displayName}</strong><small>{participant.email || "Email unavailable"}</small></span><button className="outline-button" disabled={saving || !participant.email} onClick={() => void verifyParticipantEmail(participant)}>Verify manually</button></article>)}</div></section>}
    <section className="participant-directory"><div className="table-title"><div><h3>Registered Users</h3><p>{participants.length} authenticated event accounts · role and active Team are enforced by the server</p></div><input type="search" placeholder="Search name, email, role, team…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>{error && <p className="form-error directory-error">{error}</p>}<div className="participant-table user-management-table"><div className="participant-row heading"><span>USER</span><span>ROLE</span><span>ACTIVE TEAM</span><span>CONSENT</span><span>JOINED</span><span>LAST ACTIVE</span></div>{filtered.map((participant) => <div className="participant-row" key={participant.id}><span className="participant-identity"><strong>{participant.displayName}</strong><small>{participant.email || "Not collected"}</small></span><select aria-label={`Role for ${participant.displayName}`} value={participant.role} disabled={saving} onChange={(event) => void updateRole(participant, event.target.value as RegisteredParticipant["role"])}><option value="participant">Participant</option><option value="organizer">Organizer</option></select><select className="team-assignment-select" aria-label={`Active team for ${participant.displayName}`} value={participant.teamId || ""} disabled={saving} onChange={(event) => void moveParticipant(participant, event.target.value)}><option value="" disabled>Unassigned</option>{teams.filter((team) => team.workspaceKind === "team" || team.id === participant.teamId).map((team) => <option key={team.id} value={team.id}>{team.name} · {team.activeMembers}</option>)}<option value="personal">Create personal workspace…</option></select><span><b className={`pill ${participant.consentStatus === "accepted" ? "on-track" : "needs-help"}`}>{participant.consentStatus}</b><small className="consent-version">{participant.consentVersion}</small></span><span>{new Date(participant.joinedAt).toLocaleString()}</span><span>{new Date(participant.lastActive).toLocaleString()}</span></div>)}{!filtered.length && <p className="notes-empty">No registered users match this search.</p>}</div></section>
  </div>;
}

function Admin() {
  const [data, setData] = useState<OrganizerData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cogneeAction, setCogneeAction] = useState("");
  const [cogneeNotice, setCogneeNotice] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<OrganizerData["prompts"][number] | null>(null);
  const [section, setSection] = useState<"overview" | "access" | "evidence" | "submissions" | "systems">("overview");
  const [evidenceView, setEvidenceView] = useState<"activity" | "analysis">("activity");
  const [promptSearch, setPromptSearch] = useState("");
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "helpful" | "partly_helpful" | "not_helpful" | "missing">("all");

  async function loadOrganizer() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/organizer");
      const result = await response.json() as OrganizerData & { error?: string };
      if (!response.ok) throw new Error(response.status === 401 ? "Your account does not have Organizer access." : result.error || "Organizer data could not be loaded.");
      setData(result);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Organizer access failed."); }
    finally { setLoading(false); }
  }

  // Load once on mount; every request is authorized by the signed-in role.
  useEffect(() => { const timer = window.setTimeout(() => void loadOrganizer(), 0); return () => window.clearTimeout(timer); }, []);

  async function updateSettings(assistantEnabled: boolean, quota = data?.settings.defaultTeamTokenQuota || 100000) {
    const response = await fetch("/api/organizer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data?.settings, assistantEnabled, defaultTeamTokenQuota: quota }) });
    if (response.ok) await loadOrganizer();
  }

  async function saveAllocation(settings: OrganizerData["settings"]) {
    const response = await fetch("/api/organizer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    const result = await response.json() as { error?: string };
    if (!response.ok) setError(result.error || "AI allocation settings could not be saved."); else await loadOrganizer();
  }

  async function reviewSignal(signalId: string, decision: "approved" | "rejected" | "reviewing", editedSummary?: string, suggestedAction?: string) {
    const response = await fetch("/api/organizer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review_signal", signalId, decision, editedSummary, suggestedAction }) });
    if (response.ok) await loadOrganizer(); else setError("Learning signal review could not be saved.");
  }

  async function editSignal(signal: OrganizerData["learningSignals"][number]) {
    const summary = window.prompt("Edit the evidence-grounded interpretation", signal.cogneeSummary || "");
    if (summary == null) return;
    const action = window.prompt("Edit the suggested organizer action", signal.suggestedAction || "");
    if (action == null) return;
    await reviewSignal(signal.id, "reviewing", summary, action);
  }

  async function deletePrompt(id: string) {
    const response = await fetch(`/api/organizer?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) { setSelectedPrompt(null); await loadOrganizer(); }
  }

  async function runCognee(action: "detect" | "sync" | "analyze" | "seed_tutorials" | "backfill_all" | "grade_prompts", signalId?: string) {
    setCogneeAction(signalId ? `${action}:${signalId}` : action); setError(""); setCogneeNotice("");
    try {
      const response = await fetch("/api/cognee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, signalId }) });
      const result = await response.json() as { error?: string; queued?: number; skipped?: number; examined?: number; synced?: number; graded?: number; created?: number; message?: string; nextStep?: string };
      if (!response.ok) throw new Error(result.error || "Cognee action failed.");
      const label = action === "seed_tutorials" ? "Tutorial memory checked" : action === "backfill_all" ? "Historical data checked" : action === "sync" ? "Cognee sync completed" : action === "grade_prompts" ? "Prompt evaluation completed" : action === "detect" ? "Learning-signal detection completed" : "Cognee analysis completed";
      const facts = [result.queued != null ? `${result.queued} newly queued` : "", result.skipped != null ? `${result.skipped} already present` : "", result.synced != null ? `${result.synced} synced` : "", result.graded != null ? `${result.graded} evaluated` : "", result.created != null ? `${result.created} signals created` : ""].filter(Boolean).join(" · ");
      setCogneeNotice(`${label}${facts ? `: ${facts}.` : "."} ${result.nextStep || result.message || ""}`.trim());
      await loadOrganizer();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Cognee action failed."); }
    finally { setCogneeAction(""); }
  }

  function exportCsv() {
    if (!data) return;
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const feedbackLookup = new Map(data.feedbacks.map((item) => [item.promptEventId, item]));
    const rows = [["time", "participant_name", "participant_email", "participant_id", "team_name", "team_id", "page", "tutorial_step", "status", "model", "input_tokens", "output_tokens", "latency_ms", "feedback", "feedback_reason", "feedback_note", "prompt"], ...data.prompts.map((item) => { const feedback = feedbackLookup.get(item.id); return [new Date(item.createdAt).toISOString(), item.participantDisplayName, item.participantEmail, item.participantId, item.teamName, item.teamId, item.page, item.tutorialStep, item.status, item.modelName, item.inputTokens, item.outputTokens, item.latencyMs, feedback?.feedback, feedback?.reasonCode, feedback?.note, item.userPrompt]; })];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "agentforge-prompt-events.csv"; link.click(); URL.revokeObjectURL(url);
  }

  if (!data) return <div className="organizer-login"><span className="service-mark purple">▥</span><span className="eyebrow">PROTECTED ORGANIZER PORTAL</span><h2>{loading ? "Opening the control room…" : "Organizer access required."}</h2><p>Access is checked from the signed-in account role on the server.</p>{error && <p className="form-error">{error}</p>}<button className="primary" onClick={() => void loadOrganizer()} disabled={loading}>{loading ? "Loading…" : "Retry"}</button></div>;

  const totalTokens = Number(data.summary.inputTokens) + Number(data.summary.outputTokens) + Number(data.summary.interviewerInputTokens || 0) + Number(data.summary.interviewerOutputTokens || 0);
  const teamTokenQuota = Math.max(1, Number(data.settings.defaultTeamTokenQuota));
  const visibleEvaluations = [...data.promptEvaluations].sort((a, b) => b.createdAt - a.createdAt).filter((item, index, items) => items.findIndex((candidate) => candidate.promptEventId === item.promptEventId) === index);
  const currentRubricIds = new Set(data.promptEvaluations.filter((item) => item.rubricVersion === "agentforge-process-coaching-v4").map((item) => item.promptEventId));
  const awaitingEvaluations = data.prompts.filter((item) => item.status === "success" && !currentRubricIds.has(item.id));
  const preflightReady = data.preflight.databaseReady && data.preflight.emailConfigured && data.preflight.appOriginConfigured && data.preflight.scheduleConfigured && Number(data.preflight.staleReservations || 0) === 0 && Number(data.preflight.cogneeErrorCount || 0) === 0;
  const feedbackByPrompt = new Map(data.feedbacks.map((item) => [item.promptEventId, item]));
  const normalizedSearch = promptSearch.trim().toLowerCase();
  const filteredPrompts = data.prompts.filter((item) => {
    const feedback = feedbackByPrompt.get(item.id);
    const matchesSearch = !normalizedSearch || [item.participantDisplayName, item.participantEmail, item.teamName, item.page, item.tutorialStep, item.userPrompt].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
    const matchesFeedback = feedbackFilter === "all" || feedbackFilter === "missing" ? !feedback && feedbackFilter === "missing" : feedback?.feedback === feedbackFilter;
    return matchesSearch && matchesFeedback;
  });
  const cogneeErrors = Number(data.cognee.sync.find((item) => item.status === "error")?.count || 0);
  const cogneePending = Number(data.cognee.sync.find((item) => item.status === "pending")?.count || 0);
  const organizerSections = ["overview", "access", "evidence", "submissions", "systems"] as const;
  if (organizerSections.includes(section)) return <div className="organizer-console">
    <div className="organizer-console-head"><div><span className="eyebrow">LIVE ORGANIZER CONTROL ROOM</span><h2>{section === "overview" ? "Event overview" : section === "access" ? "AI access & token usage" : section === "evidence" ? "Prompt evidence & Cognee analysis" : section === "submissions" ? "Project submissions" : "Integrations & data health"}</h2><p>{section === "overview" ? "See what needs attention now, then move into the relevant workspace." : section === "access" ? "Pause access, set safeguards, and monitor event, team, and participant usage in one place." : section === "evidence" ? "Connect each interaction to its participant, team, stage, timestamp, feedback, and provisional analysis." : section === "submissions" ? "Review the first project artifact and the later demo link without mixing them with Prompt telemetry." : "Verify external delivery, consent, deletion, and database health before they affect participants."}</p></div><div><button className="outline-button" onClick={exportCsv}>Export Prompt CSV</button><button className="outline-button" onClick={() => void loadOrganizer()} disabled={loading}>{loading ? "Refreshing…" : "Refresh data"}</button></div></div>
    <nav className="organizer-section-tabs" aria-label="Organizer workspaces">{organizerSections.map((item) => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}><span>{item === "overview" ? "01" : item === "access" ? "02" : item === "evidence" ? "03" : item === "submissions" ? "04" : "05"}</span>{item === "overview" ? "Overview" : item === "access" ? "AI Access & Usage" : item === "evidence" ? "Prompt Evidence" : item === "submissions" ? "Submissions" : "Systems & Privacy"}{item === "systems" && (cogneeErrors > 0 || !preflightReady) && <b>!</b>}</button>)}</nav>
    {error && <p className="form-error organizer-error">{error}</p>}

    {section === "overview" && <>
      <section className={`organizer-command-status ${preflightReady ? "ready" : "attention"}`}><div><span className="eyebrow">EVENT STATUS · EXPECTED {data.preflight.expectedParticipantScale} PARTICIPANTS</span><h3>{preflightReady ? "Core AgentForge services are ready." : "There are setup items to review before participants arrive."}</h3><p>This status distinguishes “configured” from an end-to-end test. External services remain visible in Systems & Privacy.</p></div><button className="outline-button" onClick={() => setSection("systems")}>Review system checks →</button></section>
      <div className="organizer-overview-metrics"><article><small>REGISTERED PARTICIPANTS</small><strong>{Number(data.operations.registeredParticipants)}</strong><span>Authenticated active accounts</span></article><article><small>ACTIVE TEAMS</small><strong>{Number(data.operations.activeTeams)} / 35</strong><span>{Math.max(0, 35 - Number(data.operations.activeTeams))} team slots remain</span></article><article><small>ASK AI ACTIVITY</small><strong>{Number(data.summary.totalPrompts)}</strong><span>{Number(data.summary.lastHour)} prompts in the last hour</span></article><article><small>PARTICIPANT FEEDBACK</small><strong>{Number(data.operations.feedbackCount)}</strong><span>{data.summary.totalPrompts ? Math.round(Number(data.operations.feedbackCount) / Number(data.summary.totalPrompts) * 100) : 0}% of prompts rated</span></article><article><small>ARTIFACTS SUBMITTED</small><strong>{Number(data.operations.submittedTeams)}</strong><span>{Number(data.operations.completeSubmissions)} include a demo video</span></article><article><small>AI TOKEN USAGE</small><strong>{totalTokens.toLocaleString()}</strong><span>{Math.round(totalTokens / Math.max(1, Number(data.settings.eventTokenQuota)) * 100)}% of event budget</span></article></div>
      <section className="organizer-next-actions"><div className="table-title"><div><h3>Organizer workspaces</h3><p>Each task has one home so event operations and research evidence do not become mixed together.</p></div></div><div><button onClick={() => setSection("access")}><span>02</span><strong>Manage AI access</strong><p>Pause Ask AI, change token limits, review team usage, and spot abnormal traffic.</p></button><button onClick={() => setSection("evidence")}><span>03</span><strong>Inspect Prompt evidence</strong><p>Search by person or team, read feedback, and review Cognee interpretations.</p></button><button onClick={() => setSection("submissions")}><span>04</span><strong>Review submissions</strong><p>Open artifacts, check missing demo links, and monitor the 24-hour follow-up.</p></button><button onClick={() => setSection("systems")}><span>05</span><strong>Check integrations</strong><p>ClawMax delivery, Cognee queue, consent receipts, and deletion health.</p></button></div></section>
      <section className="organizer-attention-list"><div className="table-title"><div><h3>Attention queue</h3><p>Only conditions that may require an organizer action are shown here.</p></div></div>{[
        [!data.preflight.scheduleConfigured, "Event schedule is missing", "Set start and end times in Event Management."],
        [!data.preflight.clawmaxConfigured, "ClawMax Cloud is not configured", "Waiting for the Cloud URL and handoff details from Max."],
        [cogneeErrors > 0, `${cogneeErrors} Cognee deliveries failed`, "Operational records are safe; inspect delivery before retrying."],
        [Number(data.preflight.staleReservations || 0) > 0, `${Number(data.preflight.staleReservations)} stale AI reservations`, "Review token reservation cleanup before opening Ask AI."],
        [data.submissions.some((item) => item.status !== "complete" && item.demoDueAt < data.generatedAt), "One or more demo links are overdue", "Follow up with the affected teams from Submissions."],
      ].filter(([show]) => show).map(([, title, detail]) => <article key={String(title)}><b>!</b><span><strong>{String(title)}</strong><small>{String(detail)}</small></span></article>)}{preflightReady && !data.submissions.some((item) => item.status !== "complete" && item.demoDueAt < data.generatedAt) && <p className="notes-empty">No active operational alerts.</p>}</section>
    </>}

    {section === "access" && <>
      <section className="admin-controls organizer-access-summary"><div><span className={data.settings.assistantEnabled ? "control-dot on" : "control-dot"} /><span><small>AGENTFORGE ASK AI</small><strong>{data.settings.assistantEnabled ? "Available to participants" : "Paused for all participants"}</strong></span><button className={data.settings.assistantEnabled ? "danger-button" : "primary"} onClick={() => void updateSettings(!data.settings.assistantEnabled)}>{data.settings.assistantEnabled ? "Pause Ask AI" : "Resume Ask AI"}</button></div><div><span><small>EVENT BUDGET</small><strong>{totalTokens.toLocaleString()} / {Number(data.settings.eventTokenQuota).toLocaleString()} tokens</strong></span><div className="quota-bar"><i style={{ width: `${Math.min(100, totalTokens / Math.max(1, Number(data.settings.eventTokenQuota)) * 100)}%` }} /></div><small>{data.settings.providerKeyCount} server-side provider key slot{data.settings.providerKeyCount === 1 ? "" : "s"} configured</small></div></section>
      <AIAllocationControls settings={data.settings} totalTokens={totalTokens} onSave={saveAllocation} />
      <div className="live-admin-grid"><section className="usage-panel"><div className="table-title"><div><h3>Hourly token trend</h3><p>Last 24 recorded hours</p></div></div><div className="usage-bars">{data.hourly.length ? data.hourly.map((item) => { const max = Math.max(...data.hourly.map((point) => Number(point.tokens)), 1); return <div key={item.hour} title={`${item.hour}: ${item.tokens} tokens`}><i style={{ height: `${Math.max(6, Number(item.tokens) / max * 100)}%` }} /><small>{item.hour.slice(11, 16)}</small></div>; }) : <p>No token data yet.</p>}</div></section><section className="usage-panel"><div className="table-title"><div><h3>Usage by page & stage</h3><p>Where participants ask questions or encounter errors</p></div></div><div className="compact-rows">{data.pages.map((item) => <div key={`${item.page}-${item.tutorialStep}`}><span><strong>{item.page}</strong><small>{item.tutorialStep || "General page"}</small></span><b>{item.prompts} prompts</b><em>{item.errors} errors</em><small>{Number(item.tokens).toLocaleString()} tokens</small></div>)}</div></section></div>
      <section className="team-quota-panel"><div className="table-title"><div><h3>Team usage & remaining quota</h3><p>Use names for event operations; internal IDs remain available underneath for audit and debugging.</p></div></div>{data.teams.length ? data.teams.map((team) => <div className="team-quota-row" key={team.teamId}><span><strong>{team.teamName}</strong><small>{team.teamId}</small></span><span>{team.prompts} prompts</span><div><i style={{ width: `${Math.min(100, Number(team.tokens) / teamTokenQuota * 100)}%` }} /></div><b>{Number(team.tokens).toLocaleString()} used</b><em>{Math.max(0, teamTokenQuota - Number(team.tokens)).toLocaleString()} remaining</em></div>) : <p className="notes-empty">No team-linked token usage yet.</p>}</section>
    </>}

    {section === "evidence" && <>
      <nav className="organizer-subtabs"><button className={evidenceView === "activity" ? "active" : ""} onClick={() => setEvidenceView("activity")}>Prompt activity</button><button className={evidenceView === "analysis" ? "active" : ""} onClick={() => setEvidenceView("analysis")}>Cognee analysis & review</button></nav>
      {evidenceView === "activity" ? <>
        <section className="prompt-evidence-panel"><div className="table-title"><div><span className="eyebrow">MASKED ORGANIZER EVIDENCE</span><h3>Participant Prompt activity</h3><p>Latest 100 interactions. Search a person, email, team, page, stage, or Prompt; click a row to inspect its response.</p></div><span>{filteredPrompts.length} shown</span></div><div className="evidence-filters"><input type="search" value={promptSearch} onChange={(event) => setPromptSearch(event.target.value)} placeholder="Search participant, team, stage, or Prompt…" /><select value={feedbackFilter} onChange={(event) => setFeedbackFilter(event.target.value as typeof feedbackFilter)}><option value="all">All feedback</option><option value="helpful">Helpful</option><option value="partly_helpful">Partly helpful</option><option value="not_helpful">Not helpful</option><option value="missing">No feedback</option></select></div><div className="evidence-table"><div className="evidence-row heading"><span>TIME</span><span>PARTICIPANT & TEAM</span><span>PAGE / STAGE</span><span>PROMPT</span><span>FEEDBACK</span><span>STATUS</span></div>{filteredPrompts.map((item) => { const feedback = feedbackByPrompt.get(item.id); return <button className="evidence-row" key={item.id} onClick={() => setSelectedPrompt(item)}><span>{new Date(item.createdAt).toLocaleString()}</span><span><strong>{item.participantDisplayName}</strong><small>{item.participantEmail || item.participantId}</small><em>{item.teamName}</em></span><span><strong>{item.page}</strong><small>{item.tutorialStep || "General"}</small></span><span>{item.userPrompt}</span><span>{feedback ? <><b className={`pill ${feedback.feedback === "helpful" ? "on-track" : "needs-help"}`}>{feedback.feedback === "helpful" ? "Helpful" : feedback.feedback === "partly_helpful" ? "Partly helpful" : "Not helpful"}</b><small>{feedback.reasonCode?.replaceAll("_", " ") || "No reason selected"}</small></> : <small>Not rated</small>}</span><span><b className={`pill ${item.status === "success" ? "on-track" : "blocked"}`}>{item.status}</b><small>{Number(item.inputTokens || 0) + Number(item.outputTokens || 0)} tokens</small></span></button>; })}{!filteredPrompts.length && <p className="notes-empty">No Prompt evidence matches these filters.</p>}</div></section>
        <section className="feedback-monitor"><div className="table-title"><div><h3>Feedback reasons</h3><p>Short qualitative explanations stay linked to the exact interaction and context.</p></div><span>{data.feedbacks.length} recorded</span></div><div className="feedback-reason-grid">{data.feedbacks.map((item) => <article key={item.id}><span><b className={`pill ${item.feedback === "helpful" ? "on-track" : "needs-help"}`}>{item.feedback.replaceAll("_", " ")}</b><small>{new Date(item.createdAt).toLocaleString()}</small></span><strong>{item.participantDisplayName} · {item.page}</strong><p>{item.reasonCode?.replaceAll("_", " ") || "No reason selected"}{item.note ? ` — ${item.note}` : ""}</p></article>)}{!data.feedbacks.length && <p className="notes-empty">No participant feedback has been recorded yet.</p>}</div></section>
      </> : <>
        <section className="cognee-operations compact-cognee"><div className="table-title"><div><span className="eyebrow">COGNEE SEMANTIC ANALYSIS</span><h3>Evidence queue & analysis controls</h3><p>“Configured” means credentials exist. It does not mean the last delivery succeeded.</p></div><span className={`pill ${data.cognee.connected && cogneeErrors === 0 ? "on-track" : "needs-help"}`}>{!data.cognee.connected ? "API key required" : cogneeErrors > 0 ? `${cogneeErrors} delivery errors` : "Credentials configured"}</span></div><div className="cognee-status-grid">{["pending", "syncing", "synced", "error"].map((status) => <div key={status}><small>{status.toUpperCase()}</small><strong>{Number(data.cognee.sync.find((item) => item.status === status)?.count || 0)}</strong></div>)}</div>{cogneeNotice && <div className="cognee-action-notice" role="status"><b>✓</b><span>{cogneeNotice}</span></div>}<div className="cognee-actions"><button className="outline-button" onClick={() => void runCognee("backfill_all")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>Backfill existing data</button><button className="outline-button" onClick={() => void runCognee("detect")} disabled={Boolean(cogneeAction)}>Detect evidence patterns</button><button className="outline-button" onClick={() => void runCognee("grade_prompts")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>Annotate next interaction</button><button className="primary" onClick={() => void runCognee("sync")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>Sync {cogneePending} pending</button></div></section>
        {data.learningSignals.length > 0 && <section className="signal-review-queue"><div className="table-title"><div><h3>Human review queue</h3><p>Edit, approve, or reject provisional interpretations before they influence tutorial changes.</p></div></div>{data.learningSignals.map((signal) => <div key={signal.id}><span><strong>{signal.page} · {signal.tutorialStep || "General"}</strong><small>{signal.promptCount} prompts · {signal.participantCount} participants · {signal.reviewStatus}</small></span><button onClick={() => void editSignal(signal)}>Edit</button><button onClick={() => void reviewSignal(signal.id, "approved")} disabled={signal.reviewStatus === "approved"}>Approve</button><button onClick={() => void reviewSignal(signal.id, "rejected")} disabled={signal.reviewStatus === "rejected"}>Reject</button></div>)}</section>}
        <section className="prompt-evaluations"><div className="table-title"><div><span className="eyebrow">PROVISIONAL AI ANNOTATION · NOT A GRADE</span><h3>Evidence-linked process coaching</h3><p>Current-goal Prompt adequacy, episode-level process evidence, and outcomes remain separate.</p></div><span>{visibleEvaluations.length} annotated · {awaitingEvaluations.length} awaiting</span></div>{visibleEvaluations.length ? <div className="evaluation-list">{visibleEvaluations.map((item) => <PromptEvaluationCard key={item.id} item={item} />)}</div> : <p className="notes-empty">No completed process annotations yet.</p>}</section>
        <section className="prompt-cluster-panel"><div className="table-title"><div><span className="eyebrow">RULE-BASED FIRST</span><h3>Common questions & error categories</h3><p>Deterministic clusters remain distinct from Cognee interpretation.</p></div><span>{data.promptClusters.length} clusters</span></div><div className="cluster-grid">{data.promptClusters.slice(0, 12).map((cluster) => <article key={cluster.id}><span>{cluster.category.replaceAll("_", " ")}</span><h4>{cluster.page} · {cluster.tutorialStep || "General"}</h4><div><b>{cluster.promptCount} prompts</b><b>{cluster.participantCount} participants</b><b>{cluster.errorCount} errors</b></div></article>)}{!data.promptClusters.length && <p className="notes-empty">No evidence cluster has been generated yet.</p>}</div></section>
      </>}
    </>}

    {section === "submissions" && <section className="submission-review-panel"><div className="table-title"><div><span className="eyebrow">PROJECT ARTIFACT + FOLLOW-UP DEMO</span><h3>Team submission review</h3><p>The first artifact is locked after submission; teams may add a shareable demo link within 24 hours.</p></div><span>{data.operations.completeSubmissions} complete · {data.operations.submittedTeams} started</span></div><div className="submission-review-grid">{data.submissions.map((item) => <article key={item.id}><header><div><small>{item.status === "complete" ? "READY FOR REVIEW" : "WAITING FOR DEMO"}</small><h3>{item.teamName}</h3><p>Submitted by {item.submittedByName} · {new Date(item.artifactSubmittedAt).toLocaleString()}</p></div><b className={`pill ${item.status === "complete" ? "on-track" : item.demoDueAt < data.generatedAt ? "blocked" : "needs-help"}`}>{item.status === "complete" ? "Complete" : item.demoDueAt < data.generatedAt ? "Overdue" : "Artifact received"}</b></header><div className="submission-links">{item.artifactKind === "link" && item.artifactUrl ? <a href={item.artifactUrl} target="_blank" rel="noreferrer">Open project artifact ↗</a> : <a href={`/api/organizer?downloadSubmission=${encodeURIComponent(item.id)}`}>Download {item.artifactFilename || "artifact"} ↓</a>}{item.demoVideoUrl ? <a href={item.demoVideoUrl} target="_blank" rel="noreferrer">Watch demo video ↗</a> : <span>Demo due {new Date(item.demoDueAt).toLocaleString()}</span>}</div>{item.notes && <p className="submission-note">{item.notes}</p>}<small>Team ID: {item.teamId}</small></article>)}{!data.submissions.length && <div className="empty-live-state"><strong>No team has submitted an artifact yet.</strong><p>Submission activity will appear here without mixing it into Prompt evidence.</p></div>}</div></section>}

    {section === "systems" && <>
      <section className={`organizer-preflight ${preflightReady ? "ready" : "attention"}`}><div><span className="eyebrow">AGENTFORGE PREFLIGHT</span><h3>{preflightReady ? "No internal readiness blocker detected." : "Review the checks below."}</h3><p>These checks report configuration and recorded delivery state, not an unsupported claim of external availability.</p></div><div><span className={data.preflight.databaseReady ? "ok" : "missing"}><b>{data.preflight.databaseReady ? "✓" : "!"}</b>Database schema</span><span className={data.preflight.emailConfigured ? "ok" : "missing"}><b>{data.preflight.emailConfigured ? "✓" : "!"}</b>Email provider</span><span className={data.preflight.appOriginConfigured ? "ok" : "missing"}><b>{data.preflight.appOriginConfigured ? "✓" : "!"}</b>Public origin</span><span className={data.preflight.scheduleConfigured ? "ok" : "missing"}><b>{data.preflight.scheduleConfigured ? "✓" : "!"}</b>Event schedule</span><span className={data.preflight.queueConfigured ? "ok" : "missing"}><b>{data.preflight.queueConfigured ? "✓" : "!"}</b>Background queue</span><span className={cogneeErrors === 0 ? "ok" : "missing"}><b>{cogneeErrors === 0 ? "✓" : "!"}</b>{cogneeErrors} failed deliveries</span><span className={Number(data.preflight.staleReservations || 0) === 0 ? "ok" : "missing"}><b>{Number(data.preflight.staleReservations || 0) === 0 ? "✓" : "!"}</b>{Number(data.preflight.staleReservations || 0)} stale AI reservations</span><span className="external-pending"><b>{data.preflight.clawmaxConfigured ? "✓" : "↗"}</b>{data.preflight.clawmaxConfigured ? "ClawMax URL configured" : "ClawMax Cloud waiting for Max"}</span></div></section>
      <section className="clawmax-operations"><div className="table-title"><div><span className="eyebrow">CLAWMAX PARTNER INGESTION</span><h3>Consent, delivery, normalization & deletion</h3><p>Identity mapping and an active consent receipt are required before evidence becomes an AgentForge record.</p></div><span>{data.clawmax.connections.filter((item) => item.status === "active").length} active connections</span></div><div className="clawmax-status-grid">{["quarantined", "mapped", "normalized", "rejected"].map((status) => <article key={status}><small>{status.toUpperCase()}</small><strong>{Number(data.clawmax.status.find((item) => item.status === status)?.count || 0)}</strong></article>)}</div><div className="clawmax-monitor-grid"><div><h4>Participant connections</h4>{data.clawmax.connections.slice(0, 20).map((item) => <article className="clawmax-connection-row" key={item.id}><span><strong>{item.participantDisplayName}</strong><small>{item.workspaceId}</small></span><span>{item.activeReceipts} active receipt{item.activeReceipts === 1 ? "" : "s"}</span><b className={`pill ${item.status === "active" ? "on-track" : "blocked"}`}>{item.status}</b></article>)}{!data.clawmax.connections.length && <p className="notes-empty">No participant connection has been recorded.</p>}</div><div><h4>Recent delivery evidence</h4>{data.clawmax.recent.slice(0, 20).map((item) => <article className="clawmax-event-row" key={item.eventId}><span><strong>{item.source}</strong><small>{item.participantDisplayName || "Unmapped participant"} · {new Date(item.receivedAt).toLocaleString()}</small></span><b className={`memory-state ${item.normalizationStatus}`}>{item.normalizationStatus}</b></article>)}{!data.clawmax.recent.length && <p className="notes-empty">No ClawMax event has been delivered.</p>}</div></div><div className="clawmax-purge-panel"><header><div><h4>Revocation & deletion</h4><p>Deletion is not complete while local or Cognee records remain unresolved.</p></div><span>{data.clawmax.purges.filter((item) => item.status !== "completed").length} need attention</span></header>{data.clawmax.purges.map((item) => <article key={item.id}><span><strong>{item.participantDisplayName}</strong><small>{item.workspaceId}</small></span><span>{item.rawEventsPurged} raw · {item.normalizedRecordsPurged} normalized</span><b className={`pill ${item.status === "completed" ? "on-track" : "needs-help"}`}>{item.status}</b></article>)}{!data.clawmax.purges.length && <p className="notes-empty">No deletion job has been requested.</p>}</div></section>
      <section className="cognee-operations compact-cognee"><div className="table-title"><div><span className="eyebrow">COGNEE DELIVERY HEALTH</span><h3>{data.cognee.connected ? "Credentials configured" : "API key not configured"}</h3><p>Use queue counts and delivery errors—not credential presence alone—to assess connection health.</p></div><span className={`pill ${data.cognee.connected && cogneeErrors === 0 ? "on-track" : "needs-help"}`}>{cogneeErrors > 0 ? `${cogneeErrors} errors` : data.cognee.connected ? "No recorded errors" : "Setup required"}</span></div><div className="cognee-status-grid">{["pending", "syncing", "synced", "error"].map((status) => <div key={status}><small>{status.toUpperCase()}</small><strong>{Number(data.cognee.sync.find((item) => item.status === status)?.count || 0)}</strong></div>)}</div></section>
    </>}

    {selectedPrompt && <div className="milestone-backdrop" onClick={() => setSelectedPrompt(null)}><aside className="prompt-detail organizer-prompt-detail" onClick={(event) => event.stopPropagation()}><header><span>PROMPT EVIDENCE</span><button onClick={() => setSelectedPrompt(null)}>×</button></header><div className="prompt-owner"><strong>{selectedPrompt.participantDisplayName}</strong><span>{selectedPrompt.participantEmail || selectedPrompt.participantId}</span><b>{selectedPrompt.teamName}</b></div><small>{new Date(selectedPrompt.createdAt).toLocaleString()} · {selectedPrompt.page} / {selectedPrompt.tutorialStep || "General"} · {selectedPrompt.modelName || "Model unavailable"}</small><h3>User Prompt</h3><p>{selectedPrompt.userPrompt}</p><h3>Assistant response</h3><p>{selectedPrompt.responseText || "No response was recorded."}</p>{feedbackByPrompt.get(selectedPrompt.id) && <div className="prompt-linked-feedback"><strong>Participant feedback</strong><span>{feedbackByPrompt.get(selectedPrompt.id)!.feedback.replaceAll("_", " ")}</span><p>{feedbackByPrompt.get(selectedPrompt.id)!.reasonCode?.replaceAll("_", " ") || "No reason selected"}{feedbackByPrompt.get(selectedPrompt.id)!.note ? ` — ${feedbackByPrompt.get(selectedPrompt.id)!.note}` : ""}</p></div>}<div className="prompt-facts"><span>{selectedPrompt.inputTokens || 0} input</span><span>{selectedPrompt.outputTokens || 0} output</span><span>{selectedPrompt.latencyMs || 0} ms</span><span>{selectedPrompt.status}</span></div><button className="danger-button" onClick={() => void deletePrompt(selectedPrompt.id)}>Delete this Prompt and response</button></aside></div>}
  </div>;
  return <>
    <section className={`organizer-preflight ${preflightReady ? "ready" : "attention"}`}><div><span className="eyebrow">HACKATHON PREFLIGHT · EXPECTED {data.preflight.expectedParticipantScale} PARTICIPANTS</span><h3>{preflightReady ? "AgentForge is ready for an organizer dry run." : "AgentForge setup still needs attention."}</h3><p>Configured means the server can see the setting. It does not claim that an email reached an inbox or that an external service passed an end-to-end test.</p></div><div><span className={data.preflight.databaseReady ? "ok" : "missing"}><b>{data.preflight.databaseReady ? "✓" : "!"}</b>Database schema</span><span className={data.preflight.emailConfigured ? "ok" : "missing"}><b>{data.preflight.emailConfigured ? "✓" : "!"}</b>Email provider configured</span><span className={data.preflight.appOriginConfigured ? "ok" : "missing"}><b>{data.preflight.appOriginConfigured ? "✓" : "!"}</b>Public origin</span><span className={data.preflight.scheduleConfigured ? "ok" : "missing"}><b>{data.preflight.scheduleConfigured ? "✓" : "!"}</b>{data.preflight.scheduleConfigured ? "Event schedule saved" : "Event schedule missing"}</span><span className={data.preflight.queueConfigured ? "ok" : "missing"}><b>{data.preflight.queueConfigured ? "✓" : "!"}</b>{data.preflight.queueConfigured ? "Background queue configured" : "Background queue pending"}</span><span className={Number(data.preflight.cogneeErrorCount || 0) === 0 ? "ok" : "missing"}><b>{Number(data.preflight.cogneeErrorCount || 0) === 0 ? "✓" : "!"}</b>{Number(data.preflight.cogneeErrorCount || 0)} failed background deliveries</span><span className={Number(data.preflight.staleReservations || 0) === 0 ? "ok" : "missing"}><b>{Number(data.preflight.staleReservations || 0) === 0 ? "✓" : "!"}</b>{Number(data.preflight.activeReservations || 0)} active · {Number(data.preflight.staleReservations || 0)} stale AI reservations</span><span className="external-pending"><b>{data.preflight.clawmaxConfigured ? "✓" : "↗"}</b>{data.preflight.clawmaxConfigured ? "ClawMax Cloud URL configured" : "ClawMax Cloud waiting for Max"}</span>{data.preflight.missingTables.length > 0 && <small>Missing: {data.preflight.missingTables.join(", ")}</small>}</div></section>
    {data.learningSignals.length > 0 && <section className="signal-review-queue"><div className="table-title"><div><h3>Human Review Queue</h3><p>Edit, approve, or reject Cognee interpretations before they influence tutorial changes.</p></div></div>{data.learningSignals.map((signal) => <div key={`review-${signal.id}`}><span><strong>{signal.page} · {signal.tutorialStep || "General"}</strong><small>{signal.reviewStatus}</small></span><button onClick={() => void editSignal(signal)}>Edit</button><button onClick={() => void reviewSignal(signal.id, "approved")} disabled={signal.reviewStatus === "approved"}>Approve</button><button onClick={() => void reviewSignal(signal.id, "rejected")} disabled={signal.reviewStatus === "rejected"}>Reject</button></div>)}</section>}
    <div className="live-admin-head"><div><span className="eyebrow">LIVE ORGANIZER PORTAL</span><h2>Prompt and Token Operations</h2><p>Connected to real AgentForge prompt events. Sensitive patterns are masked before display.</p></div><div><button className="outline-button" onClick={exportCsv}>Export CSV</button><button className="outline-button" onClick={() => void loadOrganizer()}>Refresh</button></div></div>
    <div className="metric-grid explained live-metrics"><article><small>TOTAL PROMPTS</small><strong>{data.summary.totalPrompts}</strong><span>{data.summary.lastHour} in the last hour</span><p>All recorded Assistant requests.</p></article><article><small>TOTAL TOKENS</small><strong>{totalTokens.toLocaleString()}</strong><span>{Number(data.summary.inputTokens).toLocaleString()} in · {Number(data.summary.outputTokens).toLocaleString()} out</span><p>Actual usage reported by OpenAI.</p></article><article><small>SUCCESS RATE</small><strong>{data.summary.successRate}%</strong><span>{100 - Number(data.summary.successRate)}% errors</span><p>Requests that returned a usable answer.</p></article><article><small>AVG. LATENCY</small><strong>{(Number(data.summary.avgLatencyMs) / 1000).toFixed(1)}s</strong><span>End-to-end response time</span><p>Includes OpenAI generation time.</p></article></div>
    <section className="admin-controls"><div><span className={data.settings.assistantEnabled ? "control-dot on" : "control-dot"} /><span><small>AI ASSISTANT</small><strong>{data.settings.assistantEnabled ? "Running" : "Paused"}</strong></span><button className={data.settings.assistantEnabled ? "danger-button" : "primary"} onClick={() => void updateSettings(!data.settings.assistantEnabled)}>{data.settings.assistantEnabled ? "Pause assistant" : "Resume assistant"}</button></div><div><span><small>EVENT AI USAGE</small><strong>{totalTokens.toLocaleString()} / {Number(data.settings.eventTokenQuota).toLocaleString()} tokens</strong></span><div className="quota-bar"><i style={{ width: `${Math.min(100, (totalTokens / Math.max(1, Number(data.settings.eventTokenQuota))) * 100)}%` }} /></div><small>Change budgets and safeguards below.</small></div></section>
    <AIAllocationControls settings={data.settings} totalTokens={totalTokens} onSave={saveAllocation} />
    {error && <p className="form-error organizer-error">{error}</p>}
    <section className="clawmax-operations"><div className="table-title"><div><span className="eyebrow">CLAWMAX PARTNER INGESTION</span><h3>Consent, delivery, normalization, and deletion</h3><p>Events appear here only after server authentication. Identity mapping and receipt validation happen before Prompt/Progress records or Cognee memory are created.</p></div><span>{data.clawmax?.connections.filter((item) => item.status === "active").length || 0} active connections</span></div><div className="clawmax-status-grid">{["quarantined", "mapped", "normalized", "rejected"].map((status) => <article key={status}><small>{status.toUpperCase()}</small><strong>{Number(data.clawmax?.status.find((item) => item.status === status)?.count || 0)}</strong><p>{status === "normalized" ? "Authorized evidence converted into AgentForge records." : status === "rejected" ? "Stored with a reviewable normalization reason." : status === "mapped" ? "Participant mapping resolved; normalization pending." : "Raw sanitized evidence awaiting authorization or mapping."}</p></article>)}</div><div className="clawmax-monitor-grid"><div><h4>Connected participants</h4>{data.clawmax?.connections.length ? data.clawmax.connections.slice(0, 20).map((item) => <article className="clawmax-connection-row" key={item.id}><span><strong>{item.participantDisplayName}</strong><small>{item.workspaceId}</small></span><span>{Number(item.activeReceipts)} active receipt{Number(item.activeReceipts) === 1 ? "" : "s"}</span><b className={`pill ${item.status === "active" ? "on-track" : "blocked"}`}>{item.status}</b></article>) : <p className="notes-empty">No participant has connected ClawMax yet.</p>}</div><div><h4>Recent delivery evidence</h4>{data.clawmax?.recent.length ? data.clawmax.recent.slice(0, 20).map((item) => <article className="clawmax-event-row" key={item.eventId}><span><strong>{item.source}</strong><small>{item.participantDisplayName || "Unmapped participant"} · {new Date(item.receivedAt).toLocaleString()}</small></span><b className={`memory-state ${item.normalizationStatus}`}>{item.normalizationStatus}</b>{item.normalizationError && <small title={item.normalizationError}>Review reason: {item.normalizationError}</small>}</article>) : <p className="notes-empty">No ClawMax events have been delivered yet.</p>}</div></div><div className="clawmax-purge-panel"><header><div><h4>Revocation & deletion status</h4><p>Local evidence is removed immediately. A job is not marked complete while Cognee deletion is still unresolved.</p></div><span>{data.clawmax?.purges.filter((item) => item.status !== "completed").length || 0} need attention</span></header>{data.clawmax?.purges.length ? data.clawmax.purges.slice(0, 20).map((item) => <article key={item.id}><span><strong>{item.participantDisplayName}</strong><small>{item.workspaceId} · receipt {item.receiptId.slice(0, 12)}…</small></span><span><b>{Number(item.rawEventsPurged)} raw</b><small>{Number(item.normalizedRecordsPurged)} normalized · {Number(item.cogneeRecordsPending)} Cognee pending</small></span><b className={`pill ${item.status === "completed" ? "on-track" : item.status === "error" ? "blocked" : "needs-help"}`}>{item.status}</b>{item.lastError && <small className="purge-error" title={item.lastError}>{item.lastError}</small>}</article>) : <p className="notes-empty">No deletion jobs have been requested.</p>}</div></section>
    <section className="cognee-operations"><div className="table-title"><div><span className="eyebrow">COGNEE SEMANTIC MEMORY</span><h3>Hackathon Learning Memory</h3><p>Prompts, responses, participant-model facts, project canvases, feedback, Shared Space notes, and tutorial content are organized by node set.</p></div><span className={`pill ${data.cognee.connected ? "on-track" : "needs-help"}`}>{data.cognee.connected ? "Cloud connected" : "API key required"}</span></div><div className="cognee-status-grid">{["pending", "syncing", "synced", "error"].map((status) => <div key={status}><small>{status.toUpperCase()}</small><strong>{Number(data.cognee.sync.find((item) => item.status === status)?.count || 0)}</strong><p>{status === "pending" ? "Memory events waiting for delivery." : status === "synced" ? "Events accepted and sent for graph processing." : status === "error" ? "Safe to retry; original operational records remain intact." : "Batch currently being delivered."}</p></div>)}</div><div className="cognee-action-guide"><span><b>1</b>Queue creates missing outbox records</span><i>→</i><span><b>2</b>Sync sends pending records to Cognee</span><i>→</i><span><b>3</b>Cognify runs in the background</span></div>{cogneeNotice && <div className="cognee-action-notice" role="status"><b>✓</b><span>{cogneeNotice}</span></div>}<div className="cognee-actions"><button className="outline-button" title="Queue the current ClawMax placeholder and Cognee tutorial summary. This does not crawl documentation." onClick={() => void runCognee("seed_tutorials")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "seed_tutorials" ? "Checking tutorials…" : "Queue tutorial memory"}</button><button className="outline-button" title="Find historical Prompts, projects, notes, and feedback that have not entered the Cognee outbox." onClick={() => void runCognee("backfill_all")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "backfill_all" ? "Checking history…" : "Backfill existing data"}</button><button className="outline-button" onClick={() => void runCognee("detect")} disabled={Boolean(cogneeAction)}>{cogneeAction === "detect" ? "Checking…" : "Detect learning signals"}</button><button className="outline-button" onClick={() => void runCognee("grade_prompts")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "grade_prompts" ? "Coaching…" : "Coach prompts with Cognee"}</button><button className="primary" onClick={() => void runCognee("sync")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "sync" ? "Syncing…" : "Sync all pending memory"}</button></div></section>
    <section className="prompt-evaluations"><div className="table-title"><div><span className="eyebrow">PROCESS COACHING · PROVISIONAL AI ANNOTATION</span><h3>Cognee Evidence-Linked Process Coaching</h3><p>Framework v4 separates current-goal Prompt adequacy, episode-level process evidence, and outcomes. It produces no holistic learner score or automatic grade.</p></div><span>{visibleEvaluations.length} annotated · {awaitingEvaluations.length} awaiting</span></div>{awaitingEvaluations.length > 0 && <div className="evaluation-queue"><header><div><span className="eyebrow">AWAITING ANNOTATION</span><h4>{awaitingEvaluations.length} successful interaction{awaitingEvaluations.length === 1 ? "" : "s"} not yet reviewed with framework v4</h4><p>The next click annotates one interaction in context. Digits, greetings, and test strings are handled by zero-token rules.</p></div><button className="primary" onClick={() => void runCognee("grade_prompts")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "grade_prompts" ? "Annotating…" : "Annotate next interaction"}</button></header><div>{awaitingEvaluations.slice(0, 8).map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.userPrompt}</strong><small>{item.page} · {new Date(item.createdAt).toLocaleString()}</small></div><span className="evaluation-pending-pill">AWAITING</span></article>)}</div>{awaitingEvaluations.length > 8 && <small className="queue-more">+ {awaitingEvaluations.length - 8} more interaction{awaitingEvaluations.length - 8 === 1 ? "" : "s"} in the queue</small>}</div>}{visibleEvaluations.length ? <div className="evaluation-list">{visibleEvaluations.map((item) => <PromptEvaluationCard key={item.id} item={item} />)}</div> : <p className="notes-empty">No completed process annotations yet. Use “Annotate next interaction” above when you are ready.</p>}</section>
    <section className="prompt-cluster-panel"><div className="table-title"><div><span className="eyebrow">ZERO-TOKEN PROMPT CLUSTERING</span><h3>Common Questions & Error Categories</h3><p>Deterministic keyword/error rules group the last hour by tutorial step before any AI interpretation.</p></div><span>{data.promptClusters?.length || 0} clusters</span></div><div className="cluster-grid">{data.promptClusters?.length ? data.promptClusters.slice(0, 12).map((cluster) => <article key={cluster.id}><span>{cluster.category.replaceAll("_", " ")}</span><h4>{cluster.page} · {cluster.tutorialStep || "General"}</h4><div><b>{cluster.promptCount} prompts</b><b>{cluster.participantCount} participants</b><b>{cluster.errorCount} errors</b></div><details><summary>Representative examples</summary>{(() => { try { return (JSON.parse(cluster.examplesJson) as string[]).slice(0, 4).map((example) => <p key={example}>{example}</p>); } catch { return <p>Examples unavailable.</p>; } })()}</details></article>) : <p className="notes-empty">Run “Detect learning signals” after Prompt activity to create real clusters.</p>}</div></section>
    <section className="learning-signal-live"><div className="table-title"><div><h3>Detected Learning Signals</h3><p>Counts are rule-based SQL facts. Cognee adds an evidence-grounded interpretation only when requested.</p></div></div>{data.learningSignals.length ? data.learningSignals.map((signal) => { const evidence = (data.signalEvidence || []).filter((item) => item.signalId === signal.id); return <article key={signal.id}><div><span className="eyebrow">{signal.reviewStatus}</span><h4>{signal.page} · {signal.tutorialStep || "General page"}</h4><p><b>{signal.promptCount}</b> prompts from <b>{signal.participantCount}</b> participants · {signal.errorCount} errors · {signal.negativeFeedbackCount} negative feedback</p><small>FACTS: calculated by {signal.detectionRule}. These counts are not generated by AI.</small><details className="signal-evidence"><summary>View {evidence.length} linked Prompt examples</summary>{evidence.map((item) => <p key={item.promptEventId}><b>{item.status}</b> {item.userPrompt}</p>)}</details></div><div className="signal-interpretation"><b>COGNEE INTERPRETATION</b><p>{signal.cogneeSummary || "Not generated yet. An organizer may request analysis after evidence has synced."}</p><small>INFERENCE: requires human review and remains linked to the Prompt examples at left.</small>{signal.suggestedAction && <strong>Suggested action: {signal.suggestedAction}</strong>}</div><div className="signal-review-actions"><button className="outline-button" onClick={() => void runCognee("analyze", signal.id)} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === `analyze:${signal.id}` ? "Analyzing…" : "Analyze with Cognee"}</button><button onClick={() => void reviewSignal(signal.id, "approved")} disabled={signal.reviewStatus === "approved"}>Approve</button><button onClick={() => void reviewSignal(signal.id, "rejected")} disabled={signal.reviewStatus === "rejected"}>Reject</button></div></article>; }) : <div className="empty-live-state"><strong>No learning signal currently crosses the threshold.</strong><p>This is a real empty state—not demo data. Run detection after participants begin asking questions.</p></div>}</section>
    <div className="live-admin-grid"><section className="usage-panel"><div className="table-title"><div><h3>Hourly Token Trend</h3><p>Last 24 recorded hours</p></div></div><div className="usage-bars">{data.hourly.length ? data.hourly.map((item) => { const max = Math.max(...data.hourly.map((point) => Number(point.tokens)), 1); return <div key={item.hour} title={`${item.hour}: ${item.tokens} tokens`}><i style={{ height: `${Math.max(6, Number(item.tokens) / max * 100)}%` }} /><small>{item.hour.slice(11, 16)}</small></div>; }) : <p>No token data yet.</p>}</div></section><section className="usage-panel"><div className="table-title"><div><h3>Usage by Page & Step</h3><p>Where participants ask and fail</p></div></div><div className="compact-rows">{data.pages.map((item) => <div key={`${item.page}-${item.tutorialStep}`}><span><strong>{item.page}</strong><small>{item.tutorialStep || "General page"}</small></span><b>{item.prompts} prompts</b><em>{item.errors} errors</em><small>{Number(item.tokens).toLocaleString()} tokens</small></div>)}</div></section></div>
    <section className="prompt-monitor"><div className="table-title"><div><h3>Recent Prompts</h3><p>Latest 100 · click a row to inspect the masked prompt and response</p></div><span>Protected organizer data</span></div><div className="prompt-table"><div className="prompt-row heading"><span>TIME</span><span>PAGE</span><span>PROMPT</span><span>TOKENS</span><span>STATUS</span></div>{data.prompts.map((item) => <button className="prompt-row" key={item.id} onClick={() => setSelectedPrompt(item)}><span>{new Date(item.createdAt).toLocaleTimeString()}</span><span>{item.page}</span><span>{item.userPrompt}</span><span>{Number(item.inputTokens || 0) + Number(item.outputTokens || 0)}</span><span className={`pill ${item.status === "success" ? "on-track" : "blocked"}`}>{item.status}</span></button>)}</div></section>
    <section className="feedback-monitor"><div className="table-title"><div><h3>Recent Assistant Feedback</h3><p>Three-level usefulness feedback with an optional explanation; every event stays linked to its response and context.</p></div><span>{data.feedbacks.length} recorded</span></div><div className="feedback-table"><div className="feedback-row heading"><span>TIME</span><span>PARTICIPANT</span><span>PAGE</span><span>PROMPT</span><span>FEEDBACK</span></div>{data.feedbacks.map((item) => <div className="feedback-row" key={item.id}><span>{new Date(item.createdAt).toLocaleString()}</span><span><strong>{item.participantDisplayName}</strong><small title={item.participantId}>{item.participantId.slice(0, 12)}… · {item.teamId || "Unassigned"}</small></span><span>{item.page}<small>{item.tutorialStep || "General page"}</small></span><span>{item.userPrompt}</span><span><b className={`pill ${item.feedback === "helpful" ? "on-track" : "needs-help"}`}>{item.feedback === "helpful" ? "Helpful" : item.feedback === "partly_helpful" ? "Partly helpful" : "Not helpful"}</b>{item.reasonCode && <small>{item.reasonCode.replaceAll("_", " ")}{item.note ? ` · ${item.note}` : ""}</small>}</span></div>)}{!data.feedbacks.length && <p className="notes-empty">No participant feedback has been recorded yet.</p>}</div></section>
    <section className="team-quota-panel"><div className="table-title"><div><h3>Team Usage & Remaining Quota</h3><p>“Unassigned” will be replaced by real team IDs after login and team membership are connected.</p></div></div>{data.teams.map((team) => <div className="team-quota-row" key={team.teamId}><strong>{team.teamId}</strong><span>{team.prompts} prompts</span><div><i style={{ width: `${Math.min(100, Number(team.tokens) / teamTokenQuota * 100)}%` }} /></div><b>{Number(team.tokens).toLocaleString()} used</b><em>{Math.max(0, teamTokenQuota - Number(team.tokens)).toLocaleString()} remaining</em></div>)}</section>
    {selectedPrompt && <div className="milestone-backdrop" onClick={() => setSelectedPrompt(null)}><aside className="prompt-detail" onClick={(event) => event.stopPropagation()}><header><span>PROMPT DETAIL</span><button onClick={() => setSelectedPrompt(null)}>×</button></header><small>{new Date(selectedPrompt.createdAt).toLocaleString()} · {selectedPrompt.page} · {selectedPrompt.modelName}</small><h3>User prompt</h3><p>{selectedPrompt.userPrompt}</p><h3>Assistant response</h3><p>{selectedPrompt.responseText || "No response was recorded."}</p><div className="prompt-facts"><span>{selectedPrompt.inputTokens || 0} input</span><span>{selectedPrompt.outputTokens || 0} output</span><span>{selectedPrompt.latencyMs || 0} ms</span><span>{selectedPrompt.status}</span></div><button className="danger-button" onClick={() => void deletePrompt(selectedPrompt.id)}>Delete this prompt and response</button></aside></div>}
  </>;
}

// Kept temporarily as migration reference; it is never rendered or exposed in Organizer View.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _AdminDemo() {
  const rows = [["Team Synapse", "7/11", "Cognee recall", "82%", "On track"], ["Pocket Pilot", "5/11", "First memory", "67%", "Needs help"], ["Mosaic", "8/11", "Evaluation", "91%", "On track"], ["Echo Lab", "4/11", "ClawMax setup", "58%", "Blocked"]];
  const metrics = [
    { label: "ACTIVE TEAMS", value: "24", trend: "↑ 4 in the last hour", meaning: "Teams with a participant action during the selected time window—such as opening a lesson, running an agent, saving progress, or asking AI." },
    { label: "PROMPTS CAPTURED", value: "1,284", trend: "92% successful", meaning: "Questions and task prompts sent through this platform. “Successful” means the connected agent returned a usable response without an API or safety error." },
    { label: "MOST COMMON BLOCKER", value: "Cognee cognify", trend: "38 related prompts", meaning: "The step most often associated with errors, repeated questions, low feedback, or stalled progress. Organizers use it to decide where live help is needed." },
    { label: "EST. MODEL COST", value: "$18.42", trend: "$0.77 per team", meaning: "Estimated LLM usage cost calculated from recorded model, input tokens, and output tokens. It excludes vendor credits and non-model infrastructure unless configured." },
  ];
  return <>
  <div className="demo-notice admin-demo"><span>DEMO VIEW</span><div><strong>Every number on this page is illustrative—not live participant data.</strong><p>In the real hackathon, these panels will update from authenticated team activity, ClawMax runs, Cognee events, milestone evidence, prompt telemetry, and participant feedback.</p></div></div>
  <div className="page-intro"><div><span className="eyebrow">ORGANIZER CONTROL ROOM</span><h2>See where learning breaks—while there’s time to help.</h2><p>Organizers use this private operational view to identify teams that need support and improve tutorials during the event.</p></div><button className="outline-button">Export event data</button></div>
  <div className="metric-grid explained">{metrics.map((metric) => <article key={metric.label}><small>{metric.label} <i title={metric.meaning}>?</i></small><strong className={metric.label === "MOST COMMON BLOCKER" ? "small-stat" : ""}>{metric.value}</strong><span>{metric.trend}</span><p>{metric.meaning}</p></article>)}</div>
  <div className="admin-grid"><section className="team-table"><div className="table-title"><div><h3>Team progress</h3><p>One row per registered team. Demo names and values below will be replaced by live team records.</p></div><button>View all →</button></div>
  <div className="table-explainer"><div><b>TEAM</b><span>Registered team name and workspace.</span></div><div><b>PROGRESS</b><span>Verified milestones completed out of 11.</span></div><div><b>CURRENT STEP</b><span>Latest lesson, build action, or integration event.</span></div><div><b>SUCCESS</b><span>Share of that team’s evaluation cases currently passing.</span></div><div><b>STATUS</b><span>Zero-token, rule-based support signal—not an AI judgment or final score.</span></div></div>
  <div className="tr th"><span>TEAM</span><span>PROGRESS</span><span>CURRENT STEP</span><span>SUCCESS</span><span>STATUS</span></div>{rows.map((row) => <div className="tr" key={row[0]}>{row.map((cell, i) => <span key={cell} className={i === 4 ? `pill ${cell.toLowerCase().replace(" ", "-")}` : ""}>{cell}</span>)}</div>)}
  <div className="status-rules"><div className="rule-heading"><span>RULE-BASED SUPPORT STATUS · ZERO AI TOKENS</span><p>In the real hackathon, these labels are calculated from timestamps, error events, milestones, and explicit help requests. The demo rows above use illustrative labels.</p></div><div className="status-guide"><span><i className="on-track" /><span><b>On track</b>Activity in the last 30 minutes, no repeated errors, and expected progress.</span></span><span><i className="needs-help" /><span><b>Needs help</b>No recent progress, or the same step failed 2–3 times.</span></span><span><i className="blocked" /><span><b>Blocked</b>Connection/critical task repeatedly failed, or a participant clicked “Request help.”</span></span></div></div></section>
  <aside className="signal-card"><span>DEMO LEARNING SIGNAL</span><h3>38 students asked about <em>cognify</em> in 42 minutes.</h3><p>In a real event, prompts are grouped by tutorial step and issue. This example means many participants recently struggled to confirm whether Cognee finished processing their data.</p><div><b>Suggested organizer action</b><span>Add a “How to verify cognify” checkpoint to lesson 03.</span><small>Generated from the prompt cluster, errors, and negative feedback. A human organizer reviews it before publishing.</small></div><button className="primary">Draft tutorial update</button><p className="signal-footnote">Demo button: the real version will create a reviewable tutorial draft, record its source signals, and compare completion rates before and after publication.</p></aside></div>
  <section className="signal-explainer"><div className="signal-explainer-head"><div><span className="eyebrow">FROM PARTICIPANT FRICTION TO A BETTER TUTORIAL</span><h2>How Learning Signals work in reality</h2></div><span className="cost-badge">Detection: zero AI tokens</span></div>
  <div className="signal-flow">{[
    ["01", "Capture context", "Record the anonymized participant, tutorial step, prompt, selected text, response status, error code, latency, and helpful/not-helpful feedback."],
    ["02", "Detect a spike", "A database rule triggers when one step receives enough questions, unique users, failures, negative feedback, or help requests within a time window."],
    ["03", "Group the issue", "Start with zero-token keywords and error codes: status/finished, missing dataset, timeout, authentication, or unclear next step."],
    ["04", "Create a signal", "Store the affected step, unique students, prompt count, time window, error rate, feedback rate, severity, and representative anonymized examples."],
    ["05", "Review and improve", "An organizer reviews the evidence, edits a tutorial draft, publishes a new version, and compares outcomes before and after the change."],
  ].map(([n, title, text]) => <article key={n}><b>{n}</b><h3>{title}</h3><p>{text}</p></article>)}</div>
  <div className="signal-reality-grid"><article><span>ZERO-TOKEN DETECTION</span><h3>Rules find the problem first.</h3><pre>{`IF questions ≥ 15\nAND unique students ≥ 5\nOR error rate ≥ 20%\nOR negative feedback ≥ 25%\n→ create Learning Signal`}</pre><p>Counts, timestamps, error events, milestone activity, and feedback come directly from the database. No model call is required.</p></article><article><span>OPTIONAL AI, ON DEMAND</span><h3>Use AI only for the draft.</h3><p>When an organizer clicks <b>Draft tutorial update</b>, one optional model call can summarize 3–5 anonymized examples and propose a clearer checkpoint. The draft never publishes automatically.</p><div className="human-review">Human review → Edit → Approve → Publish or reject</div></article><article><span>MEASURE THE RESULT</span><h3>Did the tutorial actually improve?</h3><div className="comparison"><div><small>METRIC</small><small>BEFORE</small><small>AFTER</small></div><div><span>Completion rate</span><b>58%</b><strong>81%</strong></div><div><span>Average time</span><b>19 min</b><strong>11 min</strong></div><div><span>Help requests</span><b>38</b><strong>12</strong></div><div><span>Error rate</span><b>24%</b><strong>9%</strong></div></div><p>These demo values show the comparison we would calculate from real participant events after a tutorial version is published.</p></article></div>
  <footer><strong>Recommended MVP</strong><span>Prompt + step tracking → scheduled database aggregation → threshold rules → keyword/error-code categories → human-reviewed template draft → before/after metrics.</span></footer></section></>;
}

type LearningModelEvidence = { id: string; type: string; preview: string; occurredAt: number };
type LearningModelEntry = { id: string; entryKind: "fact" | "inference" | "confirmation"; category: string; statement: string; sourceType: string; sourceId?: string; confidencePercent?: number; confirmedByParticipant: number; supersededById?: string; observedAt: number; memoryStatus?: string; datasetName?: string; evidencePreview?: string; evidenceItems?: LearningModelEvidence[] };
type LearningModelReview = { id: string; entryId: string; action: "confirmed" | "corrected" | "disputed"; replacementEntryId?: string; note?: string; createdAt: number };

function MyLearningModel() {
  const [entries, setEntries] = useState<LearningModelEntry[]>([]);
  const [reviews, setReviews] = useState<LearningModelReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<LearningModelEntry | null>(null);
  const [correction, setCorrection] = useState("");
  const [filter, setFilter] = useState<"all" | "fact" | "inference" | "confirmation">("all");
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() { setLoading(true); try { const response = await fetch("/api/model"); const result = await response.json() as { entries?: LearningModelEntry[]; reviews?: LearningModelReview[]; error?: string }; if (!response.ok) throw new Error(result.error || "Learning model could not be loaded."); setEntries(result.entries || []); setReviews(result.reviews || []); setError(""); } catch (problem) { setError(problem instanceof Error ? problem.message : "Learning model could not be loaded."); } finally { setLoading(false); } }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);
  async function review(action: "confirm" | "correct" | "dispute", entry: LearningModelEntry) { try { const response = await fetch("/api/model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, entryId: entry.id, correction: action === "correct" ? correction : undefined }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Review could not be saved."); setEditing(null); setCorrection(""); await load(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Review could not be saved."); } }
  async function updateModel() {
    setUpdating(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_model" }) });
      const result = await response.json() as { created?: number; evidenceCount?: number; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "The learning model could not be updated.");
      setNotice(`${result.message || "Learning model updated."} ${result.evidenceCount ? `${result.evidenceCount} evidence records were considered.` : ""}`.trim());
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "The learning model could not be updated."); }
    finally { setUpdating(false); }
  }
  const visible = entries.filter((entry) => filter === "all" || entry.entryKind === filter);
  const reviewFor = (id: string) => reviews.find((reviewItem) => reviewItem.entryId === id);
  return <div className="learning-model-page">
    <section className="model-hero"><div><span className="eyebrow">TRANSPARENT PARTICIPANT MODEL</span><h2>Facts, observations, and inference stay separate.</h2><p>You can see the evidence behind each item, confirm an inference, dispute it, or replace it with a corrected fact. Earlier records remain in the audit trail.</p></div><div className="model-update-control"><div className="model-legend"><span className="fact">FACT</span><span className="inference">AI INFERENCE</span><span className="confirmation">CONFIRMATION</span></div><button className="model-update-button" disabled={updating} onClick={() => void updateModel()}>{updating ? "Updating from Cognee…" : "Update My Model"}</button><small>One participant-requested Cognee analysis call. You review every inference.</small></div></section>
    <section className="model-current-state"><header><span className="eyebrow">CURRENT CAPABILITIES</span><h3>What each record means right now</h3></header><div><article><b>FACT</b><strong>Available</strong><p>Facts are created from your Agent Canvas and from corrections you explicitly provide.</p></article><article><b>AI INFERENCE</b><strong>Participant initiated</strong><p>Update My Model retrieves relevant Cognee memory and uses linked Canvas, Ask AI, Prompt Coach, Progress, and Feedback evidence. It does not run automatically.</p></article><article><b>CONFIRMATION</b><strong>Available after review</strong><p>A confirmation is created only when you confirm an AI inference. You can also dispute it or replace it with a corrected fact.</p></article></div></section>
    {notice && <p className="model-update-notice">✓ {notice}</p>}
    <section className="model-summary">{(["fact", "inference", "confirmation"] as const).map((kind) => <article key={kind}><small>{kind.toUpperCase()}</small><strong>{entries.filter((entry) => entry.entryKind === kind).length}</strong><span>{kind === "fact" ? "Reported or observed evidence" : kind === "inference" ? "Requires participant review" : "Participant review events"}</span></article>)}</section>
    <nav className="model-filters">{(["all", "fact", "inference", "confirmation"] as const).map((kind) => <button className={filter === kind ? "active" : ""} onClick={() => setFilter(kind)} key={kind}>{kind}</button>)}</nav>
    {error && <p className="form-error">{error}</p>}
    {loading ? <p className="notes-empty">Loading learning model…</p> : <section className="model-list">{visible.length ? visible.map((entry) => {
      const reviewItem = reviewFor(entry.id);
      return <article className={`model-card ${entry.entryKind} ${entry.supersededById ? "superseded" : ""}`} key={entry.id}>
        <header><span>{entry.entryKind === "inference" ? "AI INFERENCE" : entry.entryKind.toUpperCase()}</span><small>{entry.category.replaceAll("_", " ")} · {new Date(entry.observedAt).toLocaleString()}</small></header>
        <h3>{entry.statement}</h3>
        <div className="model-evidence"><div><small>EVIDENCE SOURCE</small><strong>{entry.sourceType}</strong><p>{entry.evidencePreview || entry.sourceId || "Structured event record"}</p></div><div><small>CONFIDENCE</small><strong>{entry.entryKind === "fact" && entry.confirmedByParticipant ? "Confirmed" : entry.confidencePercent != null ? `${entry.confidencePercent}%` : "Not assigned"}</strong><p>{entry.memoryStatus || "not queued"} · {entry.datasetName || "AgentForge operational record"}</p></div></div>
        {entry.evidenceItems && entry.evidenceItems.length > 0 && <details className="model-evidence-details"><summary>View {entry.evidenceItems.length} linked source record{entry.evidenceItems.length === 1 ? "" : "s"}</summary>{entry.evidenceItems.map((source) => <div key={source.id}><span>{source.type.replaceAll("_", " ")}</span><p>{source.preview}</p><small>{new Date(source.occurredAt).toLocaleString()} · {source.id}</small></div>)}</details>}
        {entry.supersededById && <p className="model-status superseded">Superseded by a newer participant correction or inference.</p>}
        {reviewItem && <p className={`model-status ${reviewItem.action}`}>Participant review: {reviewItem.action} · {new Date(reviewItem.createdAt).toLocaleString()}</p>}
        {entry.entryKind === "inference" && !entry.supersededById && !reviewItem && <footer><button className="outline-button" onClick={() => void review("confirm", entry)}>Confirm</button><button className="outline-button" onClick={() => void review("dispute", entry)}>Dispute</button><button className="primary" onClick={() => { setEditing(entry); setCorrection(""); }}>Correct it</button></footer>}
      </article>;
    }) : <p className="notes-empty">No entries match this view yet. Complete your Agent Canvas or ask AI, then select Update My Model.</p>}</section>}
    {editing && <div className="modal-backdrop" onMouseDown={() => setEditing(null)}><section className="model-correction" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">PARTICIPANT CORRECTION</span><h2>Replace this inference with your own statement.</h2><blockquote>{editing.statement}</blockquote><textarea rows={5} value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder="Write the corrected fact…" /><div><button className="text-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary" disabled={!correction.trim()} onClick={() => void review("correct", editing)}>Save correction</button></div><small>The original inference remains visible as superseded evidence.</small></section></div>}
  </div>;
}

type MyDataPayload = {
  exportedAt: string;
  account: PortalUser;
  relationship: { userId: string; eventRegistrationId: string; eventId: string; teamId: string | null };
  consent: Array<{ id: string; policyVersion: string; status: string; recordedAt: number }>;
  onboardingProfile: { onboardingVersion: string; answers: Array<{ id: string; label: string; value: string }>; responseLength: ResponseLength; interactionMode: InteractionMode; completedAt: number; updatedAt: number } | null;
  onboardingRevisions: Array<{ id: string; answers: Array<{ id: string; label: string; value: string }>; responseLength: ResponseLength; interactionMode: InteractionMode; changeSource: string; createdAt: number }>;
  interviewEvents: Array<{ id: string; eventType: string; questionId: string; promptText?: string; required: number; source: string; branchRule?: string; answerValue?: string; modelName?: string; inputTokens?: number; outputTokens?: number; createdAt: number }>;
  researchEpisodes: Array<{ id: string; episodeType: string; scaffoldLevel: string; feviStage?: string; status: string; createdAt: number }>;
  projects: Array<{ id: string; title: string; problem: string; successCriteria?: string; status: string; updatedAt: number }>;
  prompts: Array<{ id: string; page: string; tutorialStep?: string; userPrompt: string; responseText?: string; modelName?: string; inputTokens?: number; outputTokens?: number; status: string; userFeedback?: string; createdAt: number; memoryStatus?: string; memorySyncedAt?: number }>;
  memory: Array<{ id: string; entryKind: string; category: string; statement: string; sourceType: string; confirmedByParticipant: number; observedAt: number; memoryStatus?: string; memorySyncedAt?: number }>;
  progress: Array<{ id: string; milestone: string; status: string; source: string; occurredAt: number }>;
  learningCheckins: Array<{ id: string; researchEpisodeId?: string; checkpointType: string; stage: string; scaffoldLevel: string; responseJson: string; createdAt: number }>;
};

function MyData({ setView }: { setView: (view: View) => void }) {
  const [data, setData] = useState<MyDataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { const load = async () => { try { const response = await fetch("/api/me"); const result = await response.json() as MyDataPayload & { error?: string }; if (!response.ok) throw new Error(result.error || "Your data could not be loaded."); setData(result); } catch (problem) { setError(problem instanceof Error ? problem.message : "Your data could not be loaded."); } finally { setLoading(false); } }; void load(); }, []);
  if (loading) return <div className="my-data-page"><section className="my-data-hero"><span className="eyebrow">YOUR EVENT RECORD</span><h2>Loading your data…</h2></section></div>;
  if (error || !data) return <div className="my-data-page"><section className="my-data-hero"><span className="eyebrow">YOUR EVENT RECORD</span><h2>We could not load this page.</h2><p>{error}</p></section></div>;
  return <div className="my-data-page"><section className="my-data-hero"><div><span className="eyebrow">YOUR EVENT RECORD</span><h2>See what AgentForge remembers about your work.</h2><p>This page separates raw activity, participant reports, and later interpretation so you can inspect what supports each claim.</p></div><a className="primary" href="/api/me?download=1" download>Export my data (.json) ↓</a></section><section className="identity-chain"><article><small>USER</small><strong>{data.account.displayName}</strong><span>{data.account.email}</span></article><i>→</i><article><small>EVENT REGISTRATION</small><strong>{data.relationship.eventRegistrationId.slice(0, 8)}…</strong><span>{data.account.role}</span></article><i>→</i><article><small>CONSENT</small><strong>{data.consent[0]?.status || "Not recorded"}</strong><span>{data.consent[0]?.policyVersion || "—"}</span></article><i>→</i><article><small>TEAM</small><strong>{data.account.teamName || "Solo / pending"}</strong><span>{data.account.inviteCode || "No invite code"}</span></article><i>→</i><article><small>PROJECT & EVIDENCE</small><strong>{data.projects.length} project · {data.prompts.length} prompts</strong><span>{data.learningCheckins.length} check-ins</span></article></section><section className="profile-data-review"><header><div><span className="eyebrow">MY PROFILE & INTERVIEW ANSWERS</span><h3>Your self-report stays under your control.</h3><p>These answers personalize Ask AI and may be included in the consented research export. They are kept separate from AI inference. Earlier versions remain in the audit history.</p></div><div><button className="outline-button" onClick={() => setView("settings")}>Edit my answers</button><button className="text-button" onClick={() => setView("policy")}>Review consent</button></div></header>{data.onboardingProfile ? <><div className="profile-data-meta"><span>Interview: {data.onboardingProfile.onboardingVersion}</span><span>Updated {new Date(data.onboardingProfile.updatedAt).toLocaleString()}</span><span>{data.onboardingRevisions.length} saved version{data.onboardingRevisions.length === 1 ? "" : "s"}</span></div><div className="profile-answer-grid">{data.onboardingProfile.answers.map((item) => <article key={item.id}><small>{item.id.startsWith("mira_followup_") ? "MIRA OPTIONAL FOLLOW-UP" : "PARTICIPANT-REPORTED"}</small><strong>{item.label || item.id.replaceAll("_", " ")}</strong><p>{item.value || "Not provided"}</p></article>)}</div><details className="profile-history"><summary>View profile revision history</summary>{data.onboardingRevisions.map((revision) => <div key={revision.id}><strong>{new Date(revision.createdAt).toLocaleString()}</strong><span>{revision.changeSource.replaceAll("_", " ")} · {revision.responseLength} · {revision.interactionMode}</span></div>)}</details></> : <p className="notes-empty">No completed Mira interview is stored for this account yet.</p>}</section><div className="my-data-grid"><section><header><div><span className="eyebrow">RAW OPERATIONAL RECORDS</span><h3>My prompts</h3></div><b>{data.prompts.length}</b></header>{data.prompts.length ? data.prompts.map((item) => <article className="data-record" key={item.id}><div><small>{item.page}{item.tutorialStep ? ` · ${item.tutorialStep}` : ""} · {new Date(item.createdAt).toLocaleString()}</small><span className={`memory-state ${item.memoryStatus || "unknown"}`}>{item.memoryStatus || "not queued"}</span></div><strong>{item.userPrompt}</strong>{item.responseText && <p>{item.responseText}</p>}<footer><span>{item.status} · {item.modelName || "No model"}</span><span>{item.inputTokens ?? "—"} input · {item.outputTokens ?? "—"} output</span></footer></article>) : <p className="notes-empty">No prompts have been recorded for this account yet.</p>}</section><section><header><div><span className="eyebrow">PARTICIPANT-CONTROLLED RECORDS</span><h3>My learning model</h3></div><b>{data.memory.length}</b></header>{data.memory.length ? data.memory.map((item) => <article className="data-record memory-record" key={item.id}><div><small>{item.entryKind.toUpperCase()} · {item.category}</small><span className={`memory-state ${item.memoryStatus || "unknown"}`}>{item.memoryStatus || "not queued"}</span></div><strong>{item.statement}</strong><footer><span>Source: {item.sourceType}</span><span>{item.confirmedByParticipant ? "Participant-confirmed" : "Not confirmed"}</span></footer></article>) : <p className="notes-empty">No participant-model records have been created yet.</p>}</section></div><section className="data-progress"><header><div><span className="eyebrow">RAW PARTICIPANT REPORTS</span><h3>My research check-ins</h3></div><b>{data.learningCheckins.length}</b></header>{data.learningCheckins.map((item) => <div key={item.id}><strong>{item.checkpointType.replaceAll("_", " ")}</strong><span>{item.scaffoldLevel} scaffold · {item.stage}</span><small>{new Date(item.createdAt).toLocaleString()}</small></div>)}</section><p className="data-retention-note"><strong>Deletion note:</strong> single-record deletion is intentionally not enabled in this phase. The export is live; retention and deletion need a reviewed event policy so shared team evidence and audit history are handled consistently.</p></div>;
}

function DataPolicy({ onBack }: { onBack: () => void }) {
  const [checks, setChecks] = useState([false, false, false]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const choices = [
    "I understand which prompts, responses, and activity may be recorded.",
    "I understand that selected event data may be stored in Cognee for memory and learning analysis.",
    "I will not enter credentials or sensitive personal information.",
  ];

  async function saveConsent() {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept_consent", choices: checks }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Consent could not be saved.");
      setNotice("Consent saved. You can now connect ClawMax.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Consent could not be saved."); }
    finally { setSaving(false); }
  }

  return <div className="policy-review-page"><header><div><span className="eyebrow">DATA POLICY & CONSENT</span><h2>Know what is shared before you connect.</h2><p>This is the same policy used during onboarding. You can review it at any time and explicitly record the current consent version here.</p></div><button className="outline-button" onClick={onBack}>← Back to Settings</button></header><div className="policy-review-grid"><section className="policy-document"><span className="demo-policy-badge">DEMO POLICY · REPLACE AFTER REVIEW</span>{demoPrivacySections.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</section><aside className="consent-card"><span className="eyebrow">YOUR CHOICES</span><h3>Review and confirm</h3><p>Each choice is stored with the policy version and timestamp. Organizer configuration never replaces participant consent.</p>{choices.map((item, index) => <label key={item}><input type="checkbox" checked={checks[index]} onChange={() => setChecks((items) => items.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span>{item}</span></label>)}{notice && <p className="policy-save-notice">✓ {notice}</p>}{error && <p className="entry-error">{error}</p>}<button className="primary" disabled={saving || !checks.every(Boolean)} onClick={() => void saveConsent()}>{saving ? "Saving consent…" : "Save consent"}</button><button className="consent-signout" onClick={onBack}>Review only · return without changes</button><small>Consent version: AF-DEMO-2026-07</small></aside></div></div>;
}

type ClawMaxEnrollment = { id: string; destinationId: string; workspaceId: string; status: "active" | "revoked"; createdAt: number; updatedAt: number };

function ParticipantProfileSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [dynamicQuestions, setDynamicQuestions] = useState<InterviewQuestion[]>([]);
  const [responseLength, setResponseLength] = useState<ResponseLength>("brief");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("guide");
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { profile?: { answers?: Array<{ id: string; label?: string; value: string }>; responseLength?: ResponseLength; interactionMode?: InteractionMode }; dynamicQuestions?: Array<{ id: string; prompt: string; source?: "ai" | "deterministic" }>; error?: string };
      if (!response.ok) throw new Error(result.error || "Your profile could not be loaded.");
      if (cancelled) return;
      setValues(Object.fromEntries((result.profile?.answers || []).map((answer) => [answer.id, answer.value || ""])));
      setDynamicQuestions((result.dynamicQuestions || []).map((item) => ({ id: item.id, prompt: item.prompt, helper: "Optional Mira follow-up", placeholder: "You may leave this blank to remove the optional answer.", required: false, source: item.source || "deterministic" })));
      setResponseLength(result.profile?.responseLength || "brief");
      setInteractionMode(result.profile?.interactionMode || "guide");
      setStatus("idle");
    }).catch((problem) => { if (!cancelled) { setStatus("error"); setMessage(problem instanceof Error ? problem.message : "Your profile could not be loaded."); } });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    setStatus("saving"); setMessage("");
    try {
      const response = await fetch("/api/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: [...interviewerQuestions, ...dynamicQuestions].map((question) => ({ id: question.id, value: values[question.id] || "" })), responseLength, interactionMode, changeSource: "participant_settings" }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Your profile could not be saved.");
      setStatus("saved"); setMessage("Profile and response preferences saved. The previous version remains in your audit history.");
    } catch (problem) { setStatus("error"); setMessage(problem instanceof Error ? problem.message : "Your profile could not be saved."); }
  }

  return <article className="setting-card profile-settings-card"><div className="setting-title"><span className="service-mark lime">P</span><div><h3>My profile & response preferences</h3><p>Update the background facts you reported during onboarding and how Ask AI should respond. Optional answers can be removed by clearing them.</p></div><span className="pill">Participant controlled</span></div>{status === "loading" ? <p>Loading your profile…</p> : <><div className="profile-settings-grid">{[...interviewerQuestions, ...dynamicQuestions].map((question) => <label key={question.id}><span>{question.prompt} <small>{question.required ? "Required" : "Optional"}</small></span><textarea rows={2} value={values[question.id] || ""} placeholder={question.placeholder} onChange={(event) => setValues((current) => ({ ...current, [question.id]: event.target.value }))} /></label>)}</div><InteractionPreferencePicker responseLength={responseLength} interactionMode={interactionMode} onLength={setResponseLength} onMode={setInteractionMode} compact />{message && <p className={status === "error" ? "form-error" : "connection-notice"}>{status === "error" ? "" : "✓ "}{message}</p>}<button className="primary" disabled={status === "saving"} onClick={() => void save()}>{status === "saving" ? "Saving…" : "Save profile & preferences"}</button></>}</article>;
}

function Settings({ setView }: { setView: (view: View) => void }) {
  const [enrollments, setEnrollments] = useState<ClawMaxEnrollment[]>([]);
  const [connectionNotice, setConnectionNotice] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [connectionBusy, setConnectionBusy] = useState(false);
  const active = enrollments.find((item) => item.status === "active");

  async function loadConnections() {
    try {
      const response = await fetch("/api/clawmax/enrollments", { cache: "no-store" });
      const result = await response.json() as { enrollments?: ClawMaxEnrollment[]; error?: string };
      if (!response.ok) throw new Error(result.error || "ClawMax connection status could not be loaded.");
      setEnrollments(result.enrollments || []); setConnectionError("");
    } catch (problem) { setConnectionError(problem instanceof Error ? problem.message : "ClawMax connection status could not be loaded."); }
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void loadConnections(), 0);
    const timer = window.setInterval(() => void loadConnections(), 10000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  async function openClawMax() {
    setConnectionBusy(true); setConnectionError(""); setConnectionNotice("");
    try {
      const response = await fetch("/api/clawmax/enrollments", { method: "POST" });
      const result = await response.json() as { launchUrl?: string; error?: string };
      if (!response.ok || !result.launchUrl) throw new Error(result.error || "ClawMax could not be opened securely.");
      window.location.assign(result.launchUrl);
    } catch (problem) { setConnectionError(problem instanceof Error ? problem.message : "ClawMax could not be opened securely."); }
    finally { setConnectionBusy(false); }
  }

  async function disconnect() {
    if (!active) return;
    setConnectionBusy(true); setConnectionError(""); setConnectionNotice("");
    try {
      const response = await fetch("/api/clawmax/enrollments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollmentId: active.id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "ClawMax could not be disconnected.");
      setConnectionNotice("ClawMax sharing has been revoked. Related purge work has been queued.");
      await loadConnections();
    } catch (problem) { setConnectionError(problem instanceof Error ? problem.message : "ClawMax could not be disconnected."); }
    finally { setConnectionBusy(false); }
  }

  return <div className="settings-layout">
    <section><span className="eyebrow">CONNECTIONS & PRIVACY</span><h2>Keep access explicit.</h2><p>Open ClawMax from AgentForge and your signed-in event identity is linked automatically. No code, API key, or password needs to be copied.</p>
      <ParticipantProfileSettings />
      <article className="setting-card clawmax-connect-card"><div className="setting-title"><span className="service-mark purple">C</span><div><h3>ClawMax activity sharing</h3><p>Connect consented ClawMax prompts and build activity to your AgentForge event record.</p></div><span className={active ? "pill on-track" : "pill needs-help"}>{active ? "Connected" : "Not connected"}</span></div>
        {active ? <><div className="connection-summary"><small>CONNECTED WORKSPACE</small><strong>{active.workspaceId}</strong><span>Only activity covered by an active, matching consent receipt is accepted.</span></div><div className="setting-actions"><small>You can stop future sharing at any time. Revocation immediately blocks new ingestion.</small><button className="outline-button danger" disabled={connectionBusy} onClick={() => void disconnect()}>{connectionBusy ? "Disconnecting…" : "Disconnect ClawMax"}</button></div></> : <><div className="connection-flow"><span><b>1</b>Open ClawMax</span><i>→</i><span><b>2</b>Review sharing scopes</span><i>→</i><span><b>3</b>Start building</span></div><div className="setting-actions"><small>Your identity is linked server-to-server. No passwords, Sessions, or Partner secrets are sent to ClawMax.</small><button className="primary" disabled={connectionBusy} onClick={() => void openClawMax()}>{connectionBusy ? "Opening ClawMax…" : "Open ClawMax & connect"}</button></div></>}
        {connectionNotice && <p className="connection-notice">✓ {connectionNotice}</p>}
        {connectionError && (connectionError.includes("privacy consent") ? <button className="consent-recovery-link" onClick={() => setView("policy")}><span>Consent required</span><strong>{connectionError}</strong><small>Review and accept the data policy →</small></button> : <p className="form-error">{connectionError}</p>)}
      </article>
      <article className="setting-card"><div className="setting-title"><span className="service-mark green">C</span><div><h3>Cognee memory</h3><p>Authorized evidence is queued through the AgentForge server after identity and consent validation.</p></div><span className="pill on-track">Server managed</span></div><p className="settings-explanation">Sanitized ClawMax evidence is retained with its receipt, source, and normalization status. Only mapped and authorized evidence becomes Prompt/Progress data and enters the Cognee outbox.</p></article>
    </section>
    <aside className="privacy-card"><span>WHAT WE TRACK</span><h3>Prompt analytics, with boundaries.</h3>{["Partner-scoped participant and workspace IDs", "Consented Prompt and visible assistant response", "Agent, workflow, page, and tutorial context", "Timestamps, delivery, and normalization status", "Linked progress and participant feedback"].map((item) => <p key={item}>✓ {item}</p>)}<hr />{["AgentForge or ClawMax passwords", "Partner API keys", "Activity created before consent", "Group content in the initial launch", "Unselected local files or unrelated browsing"].map((item) => <p className="not-tracked" key={item}>× {item}</p>)}<button className="policy-read-button" onClick={() => setView("policy")}><span>DATA POLICY</span><strong>Read and review consent</strong><small>See what is collected, excluded, retained, and shared →</small></button></aside>
  </div>;
}

type CoachingItem = { id: string; parentPromptEventId?: string; conversationId?: string; page: string; tutorialStep?: string; taskReference?: string; userPrompt: string; responseText?: string; userFeedback?: string; outcomeStatus?: "worked" | "partial" | "not_worked"; outcomeEvidence?: string; createdAt: number; parentPrompt?: string; evaluationId?: string; rubricVersion?: string; evaluator?: string; evaluationJson?: string; totalScore?: number; evaluatedAt?: number };
type CoachingAction = { id: string; promptEventId: string; evaluationId?: string; action: string; note?: string; createdAt: number };
const coachingCriteria = [["goal_task_specification", "Goal / task", "Is the current request understandable?"], ["relevant_context", "Relevant context", "Does it include the information needed for this task?"], ["constraints_criteria", "Constraints / criteria", "When needed, are boundaries or success criteria stated?"], ["own_state_reasoning", "Own state / reasoning", "Does it show the learner's attempt, hypothesis, or uncertainty?"], ["strategic_request", "Strategic request", "Is the requested help appropriate for the current goal?"], ["focus_decomposition", "Focus / decomposition", "When complex, is the problem narrowed productively?"]] as const;
const processCriteria = [["verification", "Verification", "Claim → task-relevant evidence → justified decision"], ["productive_iteration", "Productive iteration", "A response-contingent change in diagnosis, strategy, or evidence"], ["learning_agency", "Learning agency evidence", "Goal ownership, reasoning, help-seeking, decision ownership, and regulation"]] as const;

function PromptCoach() {
  return <section className="prompt-coach-placeholder" aria-labelledby="prompt-coach-title">
    <span className="eyebrow">PROMPT COACH</span>
    <h2 id="prompt-coach-title">Prompt Coach</h2>
  </section>;
}

// Preserved temporarily outside the participant experience while Prompt Coach is redesigned.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyPromptCoach() {
  const [items, setItems] = useState<CoachingItem[]>([]);
  const [actions, setActions] = useState<CoachingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, string>>({});

  async function readCoachingResponse(response: Response) {
    const raw = await response.text();
    if (!raw.trim()) return {} as { items?: CoachingItem[]; actions?: CoachingAction[]; error?: string; reevaluationRequired?: boolean };
    try { return JSON.parse(raw) as { items?: CoachingItem[]; actions?: CoachingAction[]; error?: string; reevaluationRequired?: boolean }; }
    catch { throw new Error(`Prompt Coach received an invalid server response (${response.status}). Please refresh or ask an organizer to check the deployment.`); }
  }

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/coaching");
      const result = await readCoachingResponse(response);
      if (!response.ok) throw new Error(result.error || "Prompt coaching could not be loaded.");
      setItems(result.items || []); setActions(result.actions || []); setError("");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Prompt coaching could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  async function saveAction(item: CoachingItem, action: "copied_revision" | "adopted_revision" | "dismissed_coaching" | "record_outcome", outcomeStatus?: string) {
    setSaving(`${item.id}:${action}`); setError(""); setNotice("");
    try {
      const response = await fetch("/api/coaching", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptEventId: item.id, evaluationId: item.evaluationId, action, outcomeStatus, note: evidenceDrafts[item.id] || "" }) });
      const result = await readCoachingResponse(response);
      if (!response.ok) throw new Error(result.error || "Coaching action could not be saved.");
      setNotice(result.reevaluationRequired ? "Outcome evidence saved. This Prompt is ready for a new evidence-aware coaching pass." : "Your coaching choice was saved and linked to this Prompt.");
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Coaching action could not be saved."); }
    finally { setSaving(""); }
  }

  async function copyRevision(item: CoachingItem, revision: string) {
    await navigator.clipboard.writeText(revision);
    await saveAction(item, "copied_revision");
  }

  const evaluated = items.filter((item) => item.evaluationId).length;
  const outcomes = items.filter((item) => item.outcomeStatus).length;
  return <div className="participant-coach-page">
    <section className="coach-hero"><div><span className="eyebrow">EVIDENCE-LINKED PROCESS COACHING</span><h2>Improve how you work with AI—not how formal you sound.</h2><p>Framework v4 treats a Prompt as one piece of an interaction episode. Prompt adequacy, process behavior, and outcomes remain separate; missing evidence becomes N/O, not a low learner score.</p></div><div className="coach-summary"><article><strong>{items.length}</strong><span>Tracked interactions</span></article><article><strong>{evaluated}</strong><span>Annotated</span></article><article><strong>{outcomes}</strong><span>Outcomes recorded</span></article></div></section>
    <section className="coach-tutorial"><header><div><span className="eyebrow">HOW PROCESS COACHING WORKS</span><h3>Read the evidence in layers.</h3></div><p>This tutorial explains the rubric, why the layers stay separate, and what the system is not allowed to infer.</p></header><div className="coach-rationale"><div><span>WHY WE CHANGED THE RUBRIC</span><h4>A better Prompt is not automatically better learning.</h4><p>The previous rubric mixed Prompt wording, interaction behavior, learner agency, and outcomes into one score. Framework v4 separates them so a polished Prompt, successful AI output, or temporary failure cannot be misread as a stable statement about the participant.</p></div><div><span>PREFERRED UNIT OF ANALYSIS</span><h4>The interaction episode—not an isolated sentence.</h4><p>A Prompt can show how a request is framed. Verification and productive iteration usually require the AI response, the participant’s follow-up, supporting evidence, and what happened afterward.</p></div></div><div className="coach-tutorial-steps"><article><b>1</b><span>PROMPT ADEQUACY</span><h4>Does this request fit its current goal?</h4><p>We check goal, context, criteria, visible reasoning, help strategy, and focus. Concise expert Prompts are not penalized.</p></article><article><b>2</b><span>PROCESS EVIDENCE</span><h4>What happened across the episode?</h4><p>Verification, productive iteration, and agency require observable follow-up behavior—not one isolated sentence.</p></article><article><b>3</b><span>OUTCOME</span><h4>What actually happened afterward?</h4><p>Reported or observed results stay separate. A better AI answer does not automatically prove learning.</p></article><article><b>4</b><span>REVIEW</span><h4>Annotations remain provisional.</h4><p>N/O means the evidence was not observable. It is not a zero, a grade, or a statement about ability.</p></article></div><div className="rubric-scale-guide"><article><strong>0</strong><p><b>Observed absence or counterproductive behavior</b><span>Use only when there was a real opportunity to observe the criterion.</span></p></article><article><strong>1</strong><p><b>Limited evidence</b><span>The behavior appears, but is incomplete or weakly connected to the goal.</span></p></article><article><strong>2</strong><p><b>Adequate evidence</b><span>The behavior supports the current task, with some important limitation.</span></p></article><article><strong>3</strong><p><b>Strong current-goal evidence</b><span>Clear and task-relevant; every non-null annotation must cite an evidence span.</span></p></article><article><strong>N/O</strong><p><b>Not observable or not applicable</b><span>Missing evidence is not converted into a low score.</span></p></article></div><details open><summary>Example: what counts as Verification 3?</summary><div className="verification-example"><p><strong>AI claim</strong><span>“This endpoint returns the completed result immediately.”</span></p><i>→</i><p><strong>Task-relevant evidence</strong><span>The participant checks the documentation or runs a status test and observes asynchronous processing.</span></p><i>→</i><p><strong>Justified decision</strong><span>The participant rejects or qualifies the claim and adds status polling.</span></p></div><p className="tutorial-near-miss"><b>Near miss:</b> “Are you sure?” shows verification intent, but without independent evidence and a justified decision it is at most a provisional 2. If the follow-up is missing, the correct result is N/O.</p></details><div className="rubric-boundaries"><div><span>THE RUBRIC DOES NOT REWARD</span><p>Length · advanced English · grammar sophistication · persona prompts · formatting · politeness · jargon</p></div><div><span>THE SYSTEM DOES NOT CLAIM</span><p>Intelligence · motivation · personality · misconduct · domain learning from AI output alone · a stable student trait from one episode</p></div><div><span>VALIDATION STATUS</span><p>These are provisional AI annotations. Research use still requires trained human coding, inter-rater reliability, task-level error analysis, and fairness tests.</p></div></div></section>
    <section className="coach-rubric"><header><div><span className="eyebrow">FRAMEWORK V4 · PROMPT ADEQUACY</span><h3>Six current-goal questions—not a learner grade.</h3></div><span>0–3 when observable · N/O when unnecessary or missing · no holistic score</span></header><div>{coachingCriteria.map(([, label, detail]) => <article key={label}><strong>{label}</strong><p>{detail}</p></article>)}</div></section>
    <section className="coach-rubric"><header><div><span className="eyebrow">EPISODE-LEVEL PROCESS INDICATORS</span><h3>Only annotate what the interaction trace can support.</h3></div><span>Provisional indicators · evidence spans required · human validation pending</span></header><div>{processCriteria.map(([, label, detail]) => <article key={label}><strong>{label}</strong><p>{detail}</p></article>)}</div></section>
    {notice && <p className="coach-notice">✓ {notice}</p>}{error && <p className="form-error">{error}</p>}
    {loading ? <p className="notes-empty">Loading your Prompt evidence…</p> : <section className="participant-coaching-list">{items.length ? items.map((item) => {
      const evaluation = item.evaluationJson ? parsePromptEvaluation(item.evaluationJson) : null;
      const itemActions = actions.filter((action) => action.promptEventId === item.id);
      const observed = evaluation ? Object.values(evaluation.scores).filter((value) => value != null).length + Object.values(evaluation.processIndicators).filter((value) => value.status === "observed").length : 0;
      return <article className="participant-coaching-card" key={item.id}><header><div><span className="eyebrow">{item.page}{item.tutorialStep ? ` · ${item.tutorialStep}` : ""}</span><h3>{item.userPrompt}</h3><small>{new Date(item.createdAt).toLocaleString()} · RAW PARTICIPANT PROMPT</small></div><div className="participant-coach-score"><strong>{item.evaluationId ? observed : "—"}</strong><span>{item.evaluationId ? " evidence signals" : ""}</span><small>{evaluation?.coachingStatus?.replaceAll("_", " ") || (item.evaluationId ? "Annotated" : "Awaiting organizer annotation")}</small></div></header>
        {item.parentPrompt && <div className="prompt-chain"><span>PREVIOUS PROMPT</span><p>{item.parentPrompt}</p><i>→</i><b>This Prompt is evaluated as an iteration, not an isolated sentence.</b></div>}
        {evaluation ? <><div className="participant-rubric-grid">{coachingCriteria.map(([key, label]) => { const value = evaluation.scores[key]; return <div key={key}><span><b>{label}</b><strong>{value == null ? "N/O" : `${value}/3`}</strong></span><i><em style={{ width: `${value == null ? 0 : Math.max(0, Math.min(3, value)) / 3 * 100}%` }} /></i><p>{evaluation.criterionEvidence[key]?.join(" · ") || "No criterion-level evidence cited."}</p></div>; })}</div>
          <div className="process-indicator-grid">{processCriteria.map(([key, label]) => { const indicator = evaluation.processIndicators[key]; return <div key={key}><span>{label}</span><strong>{indicator?.score == null ? indicator?.status?.replaceAll("_", " ") || "N/O" : `${indicator.score}/4 · ${indicator.status || "provisional"}`}</strong><p>{indicator?.evidence.length ? indicator.evidence.join(" · ") : indicator?.rationale || "Required episode evidence is not available."}</p></div>; })}</div>
          <div className="participant-coach-insights"><div><span>WHAT ALREADY WORKS</span>{evaluation.strengths.length ? <ul>{evaluation.strengths.map((text) => <li key={text}>{text}</li>)}</ul> : <p>No supported strength was identified yet.</p>}</div><div><span>NEXT IMPROVEMENT</span>{evaluation.weaknesses.length ? <ul>{evaluation.weaknesses.map((text) => <li key={text}>{text}</li>)}</ul> : <p>No specific improvement was returned.</p>}</div></div>
          {evaluation.improvedPrompt && <div className="coach-revision"><span>AI-SUGGESTED REVISION · REVIEW BEFORE USE</span><p>{evaluation.improvedPrompt}</p><div><button className="outline-button" disabled={Boolean(saving)} onClick={() => void copyRevision(item, evaluation.improvedPrompt!)}>Copy revision</button><button className="primary" disabled={Boolean(saving)} onClick={() => void saveAction(item, "adopted_revision")}>I’ll try this revision</button><button className="text-button" disabled={Boolean(saving)} onClick={() => void saveAction(item, "dismissed_coaching")}>Not useful</button></div></div>}
          <p className="coach-inference-note"><b>AI INFERENCE:</b> {evaluation.inferenceNotice || "This coaching interpretation must remain linked to the raw Prompt and can be challenged by later outcome evidence."}</p></> : <div className="coach-awaiting"><strong>Waiting for coaching</strong><p>Your raw Prompt and context are recorded. An organizer controls when Cognee analysis runs, so this step does not spend AI tokens automatically.</p></div>}
        <div className="outcome-recorder"><div><span>PARTICIPANT-REPORTED OUTCOME</span><h4>What actually happened after this Prompt?</h4><p>This evidence is more important than the wording score. Recording it makes the next coaching pass more accurate.</p></div><textarea rows={3} value={evidenceDrafts[item.id] ?? item.outcomeEvidence ?? ""} onChange={(event) => setEvidenceDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Example: The agent passed 4/5 retrieval tests; one citation was still wrong." /><div><button disabled={Boolean(saving)} onClick={() => void saveAction(item, "record_outcome", "worked")}>✓ Worked</button><button disabled={Boolean(saving)} onClick={() => void saveAction(item, "record_outcome", "partial")}>~ Partly worked</button><button disabled={Boolean(saving)} onClick={() => void saveAction(item, "record_outcome", "not_worked")}>× Did not work</button></div>{item.outcomeStatus && <small>Current recorded outcome: <b>{item.outcomeStatus.replaceAll("_", " ")}</b>{item.outcomeEvidence ? ` · ${item.outcomeEvidence}` : ""}</small>}</div>
        {itemActions.length > 0 && <footer>Coaching audit: {itemActions.slice(0, 4).map((action) => `${action.action.replaceAll("_", " ")} · ${new Date(action.createdAt).toLocaleString()}`).join(" | ")}</footer>}
      </article>;
    }) : <p className="notes-empty">Ask the AI Assistant to create your first tracked Prompt.</p>}</section>}
  </div>;
}

type AssistantHistoryMessage = { id: string; parentPromptEventId?: string; conversationId?: string; page: string; tutorialStep?: string; taskReference?: string; userPrompt: string; responseText?: string; modelName?: string; inputTokens?: number; outputTokens?: number; status: string; errorCode?: string; outcomeStatus?: string; outcomeEvidence?: string; createdAt: number };

function Assistant({ close, page, selectedContext, draft, scaffold }: { close: () => void; page: string; selectedContext: string; draft?: { text: string; nonce: number }; scaffold?: AssistantScaffold }) {
  const conversationId = useRef("");
  const [text, setText] = useState("");
  // A new selection is an explicit user action; synchronizing it here keeps the
  // open drawer while replacing its draft text.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (draft) setText(draft.text); }, [draft]);
  const [answer, setAnswer] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [promptEventId, setPromptEventId] = useState("");
  const [researchEpisodeId, setResearchEpisodeId] = useState("");
  const [episodeDecision, setEpisodeDecision] = useState<"accepted" | "modified" | "rejected" | "not_decided" | "">("");
  const [episodeVerification, setEpisodeVerification] = useState<string[]>([]);
  const [episodeConfidence, setEpisodeConfidence] = useState(3);
  const [episodeNote, setEpisodeNote] = useState("");
  const [episodeStatus, setEpisodeStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const answerRef = useRef<HTMLDivElement | null>(null);
  const viewedEpisodeRef = useRef("");
  const [brainStatus, setBrainStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ model: string; inputTokens?: number; outputTokens?: number } | null>(null);
  const [history, setHistory] = useState<AssistantHistoryMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [memoryUsed, setMemoryUsed] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "helpful" | "partly_helpful" | "not_helpful" | "error">("idle");
  const [feedbackChoice, setFeedbackChoice] = useState<"helpful" | "partly_helpful" | "not_helpful" | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [responseLength, setResponseLength] = useState<ResponseLength>("brief");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("guide");
  const preferenceRef = useRef<{ responseLength: ResponseLength; interactionMode: InteractionMode }>({ responseLength: "brief", interactionMode: "guide" });
  const [preferenceStatus, setPreferenceStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => { window.dispatchEvent(new CustomEvent("agentforge-assistant-working", { detail: loading })); }, [loading]);

  useEffect(() => {
    const node = answerRef.current;
    if (!node || !answer || !researchEpisodeId || viewedEpisodeRef.current === researchEpisodeId) return;
    let timer = 0;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5) && document.visibilityState === "visible";
      window.clearTimeout(timer);
      if (visible) timer = window.setTimeout(() => {
        viewedEpisodeRef.current = researchEpisodeId;
        void fetch("/api/research/episodes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "event", researchEpisodeId, eventType: "viewed", metadata: { visibleMs: 4000, threshold: 0.5 } }) });
      }, 4000);
    }, { threshold: [0.5] });
    observer.observe(node);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [answer, researchEpisodeId]);

  async function loadHistory() {
    let participantId = sessionStorage.getItem("agentforge_participant_id");
    if (!participantId) { participantId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", participantId); }
    try {
      const response = await fetch(`/api/assistant?participantId=${encodeURIComponent(participantId)}`);
      const result = await response.json() as { messages?: AssistantHistoryMessage[] };
      if (response.ok) setHistory(result.messages || []);
    } finally { setHistoryLoading(false); }
  }

  useEffect(() => { const timer = window.setTimeout(() => void loadHistory(), 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const timer = window.setTimeout(async () => { try { const response = await fetch("/api/onboarding", { cache: "no-store" }); const result = await response.json() as { profile?: { responseLength?: ResponseLength; interactionMode?: InteractionMode } | null }; if (response.ok && result.profile) { const next = { responseLength: result.profile.responseLength || "brief", interactionMode: result.profile.interactionMode || "guide" }; preferenceRef.current = next; setResponseLength(next.responseLength); setInteractionMode(next.interactionMode); } } catch { /* Defaults remain usable. */ } }, 0); return () => window.clearTimeout(timer); }, []);

  async function savePreferences(nextLength: ResponseLength, nextMode: InteractionMode) {
    preferenceRef.current = { responseLength: nextLength, interactionMode: nextMode };
    setResponseLength(nextLength); setInteractionMode(nextMode); setPreferenceStatus("saving");
    try {
      const response = await fetch("/api/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responseLength: nextLength, interactionMode: nextMode }) });
      if (!response.ok) throw new Error("Preferences could not be saved.");
      setPreferenceStatus("saved");
      window.setTimeout(() => setPreferenceStatus("idle"), 1600);
    } catch { setPreferenceStatus("error"); }
  }

  async function ask() {
    if (!text.trim() || loading) return;
    const promptToSend = text.trim();
    const parentPromptEventId = promptEventId || undefined;
    if (!conversationId.current) conversationId.current = crypto.randomUUID();
    setSubmittedPrompt(promptToSend); setText("");
    setLoading(true); setError(""); setAnswer(""); setUsage(null);
    setPromptEventId(""); setResearchEpisodeId(""); setEpisodeDecision(""); setEpisodeVerification([]); setEpisodeConfidence(3); setEpisodeNote(""); setEpisodeStatus("idle"); setBrainStatus("idle"); setFeedbackStatus("idle"); setFeedbackChoice(null); setFeedbackReason(""); setFeedbackNote(""); setMemoryUsed(false);
    try {
      let anonymousParticipantId = sessionStorage.getItem("agentforge_participant_id");
      if (!anonymousParticipantId) { anonymousParticipantId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", anonymousParticipantId); }
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ prompt: promptToSend, page, selectedContext, anonymousParticipantId, parentPromptEventId, conversationId: conversationId.current, idempotencyKey, tutorialStep: scaffold ? `Agent Blueprint · ${scaffold.questionId} · ${scaffold.supportLevel}` : undefined, scaffold }) });
      const result = await response.json() as { answer?: string; error?: string; model?: string; inputTokens?: number; outputTokens?: number; eventId?: string; researchEpisodeId?: string; cogneeMemoryUsed?: boolean; sharedParticipantContextUsed?: boolean };
      if (!response.ok || !result.answer) throw new Error(result.error || "The assistant could not answer right now.");
      setAnswer(result.answer);
      setPromptEventId(result.eventId || "");
      setResearchEpisodeId(result.researchEpisodeId || "");
      setUsage({ model: result.model || "OpenAI", inputTokens: result.inputTokens, outputTokens: result.outputTokens });
      setMemoryUsed(Boolean(result.cogneeMemoryUsed));
      setHistory((items) => [...items, { id: result.eventId || crypto.randomUUID(), page, userPrompt: promptToSend, responseText: result.answer, modelName: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, status: "success", createdAt: Date.now() }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not answer right now.");
    } finally {
      setLoading(false);
    }
  }

  async function saveToLearnerCenter() {
    if (!answer || brainStatus === "saving" || brainStatus === "saved") return;
    setBrainStatus("saving");
    try {
      const response = await fetch("/api/learning-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: `Question: ${submittedPrompt}\n\nResponse summary:\n${answer}`, sourceType: "assistant", sourcePage: page, sourcePromptEventId: promptEventId }) });
      if (!response.ok) throw new Error("Note could not be saved.");
      setBrainStatus("saved");
      window.dispatchEvent(new CustomEvent("agentforge-learner-note-saved"));
    } catch { setBrainStatus("error"); }
  }

  async function saveFeedback(feedback: "helpful" | "partly_helpful" | "not_helpful", reasonCode?: string, note?: string) {
    if (!promptEventId || feedbackStatus === "saving") return;
    let participantId = sessionStorage.getItem("agentforge_participant_id");
    if (!participantId) { participantId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", participantId); }
    setFeedbackStatus("saving");
    try {
      const response = await fetch("/api/assistant", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptEventId, feedback, reasonCode, note }) });
      if (!response.ok) throw new Error("Feedback could not be saved.");
      setFeedbackStatus(feedback);
      setFeedbackChoice(feedback);
    } catch { setFeedbackStatus("error"); }
  }

  function toggleVerification(value: string) {
    const exclusive = value === "not_verified_yet" || value === "verification_not_needed";
    setEpisodeVerification((items) => {
      if (exclusive) return items.length === 1 && items[0] === value ? [] : [value];
      if (items.includes(value)) return items.filter((item) => item !== value);
      return [...items.filter((item) => item !== "not_verified_yet" && item !== "verification_not_needed"), value];
    });
  }

  async function saveEpisodeDecision() {
    if (!researchEpisodeId || !episodeDecision || !episodeVerification.length || episodeStatus === "saving") return;
    setEpisodeStatus("saving");
    try {
      const response = await fetch("/api/research/episodes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decision", researchEpisodeId, decision: episodeDecision, verificationActions: episodeVerification, confidence: episodeConfidence, note: episodeNote }) });
      if (!response.ok) throw new Error("Episode reflection could not be saved.");
      if (episodeDecision === "modified") sessionStorage.setItem("agentforge_active_research_episode", researchEpisodeId);
      setEpisodeStatus("saved");
    } catch { setEpisodeStatus("error"); }
  }

  function closeAssistant() {
    if (researchEpisodeId && answer && episodeStatus !== "saved") {
      void fetch("/api/research/episodes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "event", researchEpisodeId, eventType: "dismissed", metadata: { responseVisible: true, reflectionCompleted: false } }) });
    }
    close();
  }

  const visibleHistory = history.filter((item) => item.id !== promptEventId);
  const hasConversation = visibleHistory.length > 0 || Boolean(submittedPrompt);
  const feedbackReasons = [
    ["incorrect", "Incorrect"],
    ["too_long", "Too long"],
    ["missing_context", "Missing context"],
    ["not_relevant", "Not relevant"],
    ["unclear_next_step", "Unclear next step"],
    ["other", "Other"],
  ] as const;
  const verificationChoices = [
    ["tested_in_agent", "Tested it in my agent"], ["checked_source", "Checked a source or documentation"],
    ["compared_answer", "Compared another answer"], ["used_own_knowledge", "Used my own knowledge"],
    ["asked_person", "Asked a teammate or organizer"], ["not_verified_yet", "Could not verify it yet"],
    ["verification_not_needed", "Verification was not needed"],
  ] as const;
  const feedbackControl = <div className="assistant-feedback-control"><div className="feedback-choice-row">{([
    ["helpful", "Helpful"], ["partly_helpful", "Partly helpful"], ["not_helpful", "Not helpful"],
  ] as const).map(([value, label]) => <button key={value} className={feedbackChoice === value || feedbackStatus === value ? `feedback-selected${value === "not_helpful" ? " negative" : value === "partly_helpful" ? " partial" : ""}` : ""} disabled={feedbackStatus === "saving" || ["helpful", "partly_helpful", "not_helpful"].includes(feedbackStatus)} onClick={() => { if (value === "helpful") void saveFeedback(value); else { setFeedbackChoice(value); setFeedbackStatus("idle"); } }}>{feedbackStatus === value ? `✓ ${label}` : label}</button>)}</div>{(feedbackChoice === "partly_helpful" || feedbackChoice === "not_helpful") && feedbackStatus !== feedbackChoice && <div className="feedback-followup"><strong>What was the main issue?</strong><div className="feedback-reason-chips">{feedbackReasons.map(([value, label]) => <button type="button" key={value} className={feedbackReason === value ? "selected" : ""} onClick={() => setFeedbackReason(value)}>{label}</button>)}</div><textarea rows={2} maxLength={500} value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} placeholder="Add a short note (optional)" /><div><button className="feedback-save" disabled={!feedbackReason || feedbackStatus === "saving"} onClick={() => void saveFeedback(feedbackChoice, feedbackReason, feedbackNote)}>Save feedback</button><button onClick={() => { setFeedbackChoice(null); setFeedbackReason(""); setFeedbackNote(""); }}>Cancel</button></div></div>}{feedbackStatus === "saving" && <small className="feedback-confirmation">Saving feedback…</small>}{feedbackStatus === "error" && <small className="feedback-confirmation error">Feedback was not saved. Please try again.</small>}{(["helpful", "partly_helpful", "not_helpful"] as const).includes(feedbackStatus as "helpful" | "partly_helpful" | "not_helpful") && <small className="feedback-confirmation">Feedback saved and linked to this response.</small>}</div>;
  return <div className="assistant-backdrop"><aside className="assistant"><header><div><span className="assistant-mark">✦</span><span><strong>Build Assistant</strong><small>Shared participant context · Cognee memory · Prompt tracked</small></span></div><button onClick={closeAssistant}>×</button></header><details className="assistant-preferences"><summary><span>Response style</span><b>{responseLength} · {interactionMode}</b></summary><InteractionPreferencePicker compact responseLength={responseLength} interactionMode={interactionMode} onLength={(value) => void savePreferences(value, preferenceRef.current.interactionMode)} onMode={(value) => void savePreferences(preferenceRef.current.responseLength, value)} /><small className={preferenceStatus === "error" ? "error" : ""}>{preferenceStatus === "saving" ? "Saving…" : preferenceStatus === "saved" ? "Saved" : preferenceStatus === "error" ? "Could not save" : "Change this at any time"}</small></details>{scaffold && <div className={`assistant-scaffold-context ${scaffold.supportLevel}`}><span>{scaffold.supportLevel.toUpperCase()} SCAFFOLD · FEVI {scaffold.feviStage.toUpperCase()}</span><strong>{scaffold.action === "clarify" ? "Clarify the decision" : scaffold.action === "directions" ? "Compare possible directions" : "Challenge the participant’s draft"}</strong><small>The assistant can use your interview and Blueprint, but it must leave the final design decision to you.</small></div>}<div className="assistant-context"><span>{selectedContext ? "SELECTED CONTEXT" : "CURRENT PAGE"}</span><p>{selectedContext ? `“${selectedContext.slice(0, 180)}${selectedContext.length > 180 ? "…" : "”"}` : page}</p><small>Highlight different text on the page to replace this context. Your saved interview, Blueprint, design stage, notes, and recent check-in remain available on every page.</small></div><div className={`assistant-chat ${hasConversation ? "has-messages" : ""}`}>{historyLoading && <small className="history-status">Restoring conversation…</small>}{visibleHistory.map((item) => <div className="history-turn" key={item.id}><div className="user-message"><small>YOU · {new Date(item.createdAt).toLocaleString()}</small><p>{item.userPrompt}</p></div>{item.responseText ? <div className="answer historical"><small>OPENAI · {item.modelName || "Assistant"} · {item.page}</small><p>{item.responseText}</p><em>{item.inputTokens ?? "—"} input · {item.outputTokens ?? "—"} output tokens</em></div> : <div className="assistant-error historical"><strong>Request failed</strong><p>{item.errorCode || "No answer was recorded."}</p></div>}</div>)}{submittedPrompt && <div className="user-message"><small>YOU</small><p>{submittedPrompt}</p></div>}{loading ? <div className="assistant-loading"><span className="assistant-mark large">✦</span><h3>Thinking…</h3><p>Reading your saved context, then recalling relevant Cognee memory.</p></div> : error ? <div className="assistant-error"><strong>Couldn’t connect</strong><p>{error}</p><button onClick={() => { setText(submittedPrompt); setSubmittedPrompt(""); setError(""); }}>Edit and retry</button></div> : answer ? <div className="answer" ref={answerRef}><small>OPENAI · {usage?.model} · {memoryUsed ? "COGNEE MEMORY USED" : "SHARED PARTICIPANT CONTEXT USED"}</small><p>{answer}</p>{usage && <em>{usage.inputTokens ?? "—"} input · {usage.outputTokens ?? "—"} output tokens</em>}{feedbackControl}<details className="assistant-episode-reflection"><summary><span>Did this change your plan?</span><small>Optional · about 20 seconds</small></summary>{episodeStatus === "saved" ? <p className="episode-saved">✓ Reflection saved. If you chose “Modified,” your next Blueprint change will be linked to this response.</p> : <div><strong>What did you do with this response?</strong><div className="episode-choice-row">{([['accepted','Accepted it'],['modified','Modified it'],['rejected','Rejected it'],['not_decided','Not decided yet']] as const).map(([value,label]) => <button type="button" key={value} className={episodeDecision === value ? "selected" : ""} onClick={() => setEpisodeDecision(value)}>{label}</button>)}</div><strong>How did you check it?</strong><div className="episode-verification-grid">{verificationChoices.map(([value,label]) => <button type="button" key={value} className={episodeVerification.includes(value) ? "selected" : ""} onClick={() => toggleVerification(value)}>{episodeVerification.includes(value) ? "✓ " : "+ "}{label}</button>)}</div><label>Optional note<textarea rows={2} maxLength={600} value={episodeNote} onChange={(event) => setEpisodeNote(event.target.value)} placeholder="What did you find or change?" /></label><div className="episode-confidence"><span>Confidence in this decision</span>{[1,2,3,4,5].map((value) => <button type="button" key={value} className={episodeConfidence === value ? "selected" : ""} onClick={() => setEpisodeConfidence(value)}>{value}</button>)}</div><button className="episode-save" disabled={!episodeDecision || !episodeVerification.length || episodeStatus === "saving"} onClick={() => void saveEpisodeDecision()}>{episodeStatus === "saving" ? "Saving…" : "Save this short reflection"}</button>{episodeStatus === "error" && <small className="feedback-confirmation error">Reflection was not saved. Your build is unaffected.</small>}</div>}</details><div><button onClick={() => void saveToLearnerCenter()} disabled={brainStatus === "saving" || brainStatus === "saved"}>{brainStatus === "saving" ? "Saving…" : brainStatus === "saved" ? "✓ Saved to Learner Center" : brainStatus === "error" ? "Try saving again" : "＋ Save to Learner Center"}</button></div></div> : !hasConversation && !historyLoading ? <><span className="assistant-mark large">✦</span><h3>What would you like to understand?</h3><p>I’ll use your saved profile and Agent Blueprint, start small, and leave the final decision to you. Don’t include API keys or sensitive information.</p></> : null}</div><footer><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="Ask a follow-up…" rows={3} /><button onClick={() => void ask()} disabled={loading || !text.trim()}>↑</button><small>Conversation history is restored in Learner Center. Never paste credentials.</small></footer></aside></div>;
}
