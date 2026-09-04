"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type View = "home" | "onboarding" | "learn" | "clawmaxTutorial" | "cogneeTutorial" | "progress" | "coach" | "demo" | "team" | "model" | "data" | "admin" | "eventAdmin" | "settings" | "policy";
type PortalRole = "participant" | "organizer";
type EntryStage = "auth" | "consent" | "team" | "survey" | "portal";
type PortalUser = { id?: string; provider?: "email" | "google-demo"; userId?: string; participantId?: string; eventId?: string; displayName: string; email: string; role: PortalRole; consentVersion?: string; teamId?: string | null; teamName?: string | null; inviteCode?: string | null };

const nav: Array<{ id: View; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "Overview" },
  { id: "onboarding", icon: "✦", label: "Agent Canvas" },
  { id: "learn", icon: "▤", label: "Learning Center" },
  { id: "progress", icon: "◎", label: "Build Progress" },
  { id: "coach", icon: "◇", label: "Prompt Coach" },
  { id: "demo", icon: "▶", label: "Demo & Evaluation" },
];

const milestones = [
  ["Idea selected", "Turn a personal pain point into one clear agent goal."],
  ["First agent working", "Run one end-to-end task successfully."],
  ["ClawMax connected", "Connect and verify your agent workspace."],
  ["Cognee connected", "Create a memory dataset for your team."],
  ["First memory stored", "Add and cognify one useful source."],
  ["Agent retrieves memory", "Answer a question using saved context."],
  ["Evaluation case created", "Define a repeatable success test."],
  ["Feedback received", "Collect structured peer or mentor feedback."],
  ["Improvement completed", "Ship and measure one improvement."],
  ["Multi-agent sharing", "Use another agent or team memory source."],
  ["Final demo ready", "Prepare a 60–90 second evidence-led demo."],
] as const;

const lessons = [
  { n: "01", title: "Shape a useful agent", meta: "12 min · Agent design", status: "Done", color: "lime" },
  { n: "02", title: "Build your first ClawMax agent", meta: "20 min · ClawMax", status: "In progress", color: "violet" },
  { n: "03", title: "Remember your first source", meta: "15 min · Cognee v1.0", status: "Start", color: "blue" },
  { n: "04", title: "Recall and verify context", meta: "15 min · Cognee v1.0", status: "Locked", color: "orange" },
  { n: "05", title: "Evaluate and improve", meta: "16 min · Evaluation", status: "Locked", color: "pink" },
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

type AuthConfig = { enabled: boolean; mode: "agentforge"; googleEnabled: boolean; registrationOpen: boolean; url?: string; publishableKey?: string };

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
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [mode, setMode] = useState<"signup" | "signin" | "forgot">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/config").then(async (response) => {
      const next = await response.json() as AuthConfig;
      if (!cancelled) { setConfig(next); if (!next.registrationOpen) setMode("signin"); }
    }).catch(() => { if (!cancelled) setError("Authentication could not be prepared."); });
    return () => { cancelled = true; };
  }, []);

  async function submit(action: "signup" | "signin") {
    setBusy(true); setError("");
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
      let result: { error?: string } = {};
      if (raw) {
        try { result = JSON.parse(raw) as { error?: string }; }
        catch { throw new Error(response.ok ? "The server returned an unreadable response." : "The authentication service returned an error. Please try again."); }
      }
      if (!response.ok) throw new Error(result.error || "Authentication failed.");
      const returnTo = window.localStorage.getItem("agentforge_auth_return_to") || "#/home";
      window.localStorage.removeItem("agentforge_auth_return_to");
      window.history.replaceState(null, "", `${window.location.pathname}${returnTo}`);
      window.location.reload();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  return <div className="entry-shell">
    <section className="entry-brand-panel">
      <span className="brand-mark large">A</span><span className="eyebrow">WELCOME TO {eventName.toUpperCase()}</span>
      <h1>Build an agent that learns with you.</h1>
      <p>Create one secure identity, then keep your consent, team, project, prompts, progress, and memory connected throughout the event.</p>
      <div className="entry-flow-map"><span><b>1</b>Sign up</span><i>→</i><span><b>2</b>Consent</span><i>→</i><span><b>3</b>Team</span><i>→</i><span><b>4</b>Build</span></div>
      <small>AgentForge stores a salted password hash, never the original password. Sessions use secure, HttpOnly cookies.</small>
    </section>
    <section className="auth-card supabase-auth">
      <span className="eyebrow">SECURE EVENT ACCOUNT</span>
      <h2>{mode === "signup" ? "Join the hackathon" : mode === "signin" ? "Welcome back" : "Account recovery"}</h2>
      {!config ? <p>Preparing secure sign-in…</p> : <>
        {!config.registrationOpen && <div className="registration-closed-notice"><strong>Registration is closed.</strong><span>Existing Participants and Organizers can still sign in.</span></div>}
        {mode !== "forgot" && <div className="auth-tabs"><button disabled={!config.registrationOpen} className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Sign up</button><button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); }}>Sign in</button></div>}
        {mode === "signup" && <label htmlFor="agentforge-display-name">DISPLAY NAME<input id="agentforge-display-name" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="How teammates will see you" /></label>}
        {mode !== "forgot" && <><label htmlFor="agentforge-email">EMAIL<input id="agentforge-email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label htmlFor="agentforge-password">PASSWORD<span className="password-input-wrap"><input id="agentforge-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /><button type="button" className="password-visibility" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}><span className={`password-eye${showPassword ? " is-visible" : ""}`} aria-hidden="true" /></button></span></label></>}
        {mode === "signup" && <label htmlFor="agentforge-confirm-password">CONFIRM PASSWORD<span className="password-input-wrap"><input id="agentforge-confirm-password" name="password-confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" /><button type="button" className="password-visibility" aria-label={showPassword ? "Hide passwords" : "Show passwords"} aria-pressed={showPassword} title={showPassword ? "Hide passwords" : "Show passwords"} onClick={() => setShowPassword((visible) => !visible)}><span className={`password-eye${showPassword ? " is-visible" : ""}`} aria-hidden="true" /></button></span></label>}
        {error && <p className="entry-error">{error}</p>}
        {mode === "signup" && <button className="primary auth-submit" disabled={busy || !config.registrationOpen} onClick={() => void submit("signup")}>{busy ? "Creating account…" : "Create account →"}</button>}
        {mode === "signin" && <><button className="primary auth-submit" disabled={busy} onClick={() => void submit("signin")}>{busy ? "Signing in…" : "Sign in →"}</button><button className="auth-forgot" onClick={() => setMode("forgot")}>Forgot password?</button></>}
        {mode === "forgot" && <><p>Automated email recovery is the next identity step. For this pilot, contact an Organizer to reset access.</p><button className="auth-forgot" onClick={() => setMode("signin")}>Back to sign in</button></>}
        {mode !== "forgot" && <><div className="auth-divider"><span>OR</span></div><button className="google-button" disabled><b>G</b>Google OAuth is the next phase</button></>}
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
  const [stage, setStage] = useState<"auth" | "consent" | "team" | "survey">(account ? "consent" : "auth");
  const [current, setCurrent] = useState(account);
  const [consentChecks, setConsentChecks] = useState([false, false, false]);
  const [teamMode, setTeamMode] = useState<"create" | "join">("create");
  const [teamValue, setTeamValue] = useState("");
  const [surveyStep, setSurveyStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const questions = [
    "What recurring problem would you most like your agent to solve?",
    "How do you handle it today, and where does that workflow break?",
    "What data may the agent use—and what must remain off limits?",
    "What observable result would prove the agent is useful?",
    "What should it remember between sessions?",
    "How should feedback change its next attempt?",
    "Does it need another agent, tool, or shared team memory?",
  ];

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

  function continueSurvey() {
    if (!answer.trim()) return;
    setAnswers((items) => [...items, answer.trim()]);
    setAnswer("");
    setSurveyStep((value) => value + 1);
  }

  if (stage === "auth") return <AgentForgeAuthPanel eventName={eventName} />;

  if (stage === "consent" && current) return <div className="consent-page"><header><div><span className="brand-mark">A</span><span><strong>AgentForge</strong><small>{eventName}</small></span></div><span>PRIVACY CONSENT</span></header><main><section className="policy-document"><span className="demo-policy-badge">DEMO POLICY · REPLACE AFTER REVIEW</span><h1>Before your agent remembers anything.</h1><p className="policy-lead">This policy demonstrates the consent flow and still requires organizer and legal review.</p>{demoPrivacySections.map(([title, copy]) => <article key={title}><h2>{title}</h2><p>{copy}</p></article>)}</section><aside className="consent-card"><span className="eyebrow">YOUR CHOICES</span><h2>Review and confirm</h2><p>The policy version, exact choices, participant registration, and timestamp are stored together.</p>{["I understand which prompts, responses, and activity may be recorded.", "I understand that selected event data may be stored in Cognee for memory and learning analysis.", "I will not enter credentials or sensitive personal information."].map((item, index) => <label key={item}><input type="checkbox" checked={consentChecks[index]} onChange={() => setConsentChecks((items) => items.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span>{item}</span></label>)}{error && <p className="entry-error">{error}</p>}<button className="primary" disabled={saving || !consentChecks.every(Boolean)} onClick={async () => { const next = await accountAction("accept_consent", { choices: consentChecks }); if (next) setStage("team"); }}>{saving ? "Saving consent…" : "Agree & choose a team →"}</button><button className="consent-signout" onClick={() => void endSession()}>I do not agree · sign out</button><small>Demo consent version: AF-DEMO-2026-07</small></aside></main></div>;

  if (stage === "team" && current) return <div className="entry-survey team-entry"><header><div><span className="brand-mark">A</span><span><strong>{eventName}</strong><small>TEAM SETUP</small></span></div><span>ONE ACTIVE TEAM PER PERSON</span></header><main><section><span className="eyebrow">TEAM MEMBERSHIP</span><h1>Build with a team—or start solo.</h1><p>Create a team and share its invite code, or join an existing team. You can switch later; earlier membership records and event data remain available through the event.</p><div className="auth-tabs"><button className={teamMode === "create" ? "active" : ""} onClick={() => setTeamMode("create")}>Create team</button><button className={teamMode === "join" ? "active" : ""} onClick={() => setTeamMode("join")}>Join team</button></div><label>{teamMode === "create" ? "TEAM NAME" : "INVITE CODE"}<input value={teamValue} onChange={(event) => setTeamValue(event.target.value)} placeholder={teamMode === "create" ? "Example: Team Synapse" : "8-character code"} /></label>{error && <p className="entry-error">{error}</p>}<div className="entry-survey-actions"><button className="text-button" onClick={() => setStage("survey")}>Continue solo for now</button><button className="primary" disabled={saving || !teamValue.trim()} onClick={async () => { const next = await accountAction(teamMode === "create" ? "create_team" : "join_team", teamMode === "create" ? { teamName: teamValue } : { inviteCode: teamValue }); if (next) setStage("survey"); }}>{saving ? "Saving…" : teamMode === "create" ? "Create team →" : "Join team →"}</button></div></section><aside><span>YOUR EVENT IDENTITY</span><div className="filled"><b>✓</b><span>{current.displayName}<small>{current.email}</small></span></div><div className="filled"><b>✓</b><span>Consent recorded<small>{current.consentVersion}</small></span></div><div><b>3</b><span>Team membership<small>Waiting for your choice</small></span></div></aside></main></div>;

  const complete = surveyStep >= questions.length;
  return <div className="entry-survey"><header><div><span className="brand-mark">A</span><span><strong>{eventName}</strong><small>DYNAMIC PROJECT DISCOVERY</small></span></div><span>PROJECT SURVEY</span></header><main><section><span className="eyebrow">AGENT-GUIDED ONBOARDING · DEMO</span><h1>{complete ? "Your starting direction is ready." : questions[surveyStep]}</h1>{complete ? <><p>These responses become your project record and participant-model evidence. ClawMax will eventually choose the follow-up questions dynamically.</p><div className="survey-summary">{answers.map((item, index) => <article key={`${index}-${item}`}><b>{String(index + 1).padStart(2, "0")}</b><p>{item}</p></article>)}</div>{error && <p className="entry-error">{error}</p>}<button className="primary" disabled={saving} onClick={async () => { setSaving(true); setError(""); try { const response = await fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Project could not be saved."); if (current) onComplete(current); } catch (problem) { setError(problem instanceof Error ? problem.message : "Project could not be saved."); } finally { setSaving(false); } }}>{saving ? "Saving project…" : "Enter Participant Portal →"}</button></> : <><p>Answer with your real workflow in mind. The future ClawMax interviewer will follow up when an answer is unclear.</p><textarea rows={6} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); continueSurvey(); } }} placeholder="Describe it in your own words…" /><div className="entry-survey-actions"><small>Question {surveyStep + 1} of {questions.length} · Press Enter to continue</small><button className="primary" disabled={!answer.trim()} onClick={continueSurvey}>Continue →</button></div></>}</section><aside><span>LIVE PROJECT BRIEF</span>{["Project idea", "Problem statement", "Data boundaries", "Success criteria", "Memory role", "Improvement loop", "Agent / Brain needs"].map((item, index) => <div className={index < answers.length ? "filled" : ""} key={item}><b>{index < answers.length ? "✓" : index + 1}</b><span>{item}<small>{index < answers.length ? "Captured from your response" : "Waiting for context"}</small></span></div>)}</aside></main></div>;
}

type EventConfig = { eventName?: string; startsAt?: number | null; endsAt?: number | null; timezone?: string; discordUrl?: string | null; announcementText?: string | null; announcementActive?: number | boolean; announcementUpdatedAt?: number | null; registrationOpen?: number | boolean; updatedAt?: number };
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
  const [done, setDone] = useState<number[]>([]);
  const [assistant, setAssistant] = useState(false);
  const [assistantOpened, setAssistantOpened] = useState(false);
  const [assistantWorking, setAssistantWorking] = useState(false);
  const [viewRestored, setViewRestored] = useState(false);
  const [assistantContext, setAssistantContext] = useState("");
  const [surveyStep, setSurveyStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [surveyAnswers, setSurveyAnswers] = useState<string[]>([]);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<number | null>(null);
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [publishedAnnouncements, setPublishedAnnouncements] = useState<PublishedAnnouncement[]>([]);
  const [announcementHistoryOpen, setAnnouncementHistoryOpen] = useState(false);
  const progress = Math.round((done.length / milestones.length) * 100);
  const surveyQuestions = [
    "What recurring problem in your life would you most like an agent to solve?",
    "How do you handle this today, and where does the workflow break down?",
    "What information may the agent access—and what must stay off limits?",
    "What observable result would prove the agent is useful?",
    "What should the agent remember between sessions?",
  ];

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
        if (result.account.role === "organizer" || result.account.consentVersion !== "pending") setPortalUser(result.account);
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
    const validViews: View[] = ["home", "onboarding", "learn", "clawmaxTutorial", "cogneeTutorial", "progress", "coach", "demo", "team", "model", "data", "admin", "eventAdmin", "settings", "policy"];
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

  useEffect(() => { const refresh = async () => { try { const response = await fetch(`/api/event?updated=${Date.now()}`); const result = await response.json() as { config?: EventConfig; publishedAnnouncements?: PublishedAnnouncement[] }; if (response.ok) { setEventConfig(result.config || null); setPublishedAnnouncements(result.publishedAnnouncements || []); } } catch { /* current configuration remains visible during a temporary network failure */ } }; const timer = window.setTimeout(() => void refresh(), 0); const interval = window.setInterval(() => void refresh(), 30000); return () => { window.clearTimeout(timer); window.clearInterval(interval); }; }, []);

  const participantSurface = portalUser?.role !== "organizer" || organizerParticipantMode;

  useEffect(() => {
    if (!portalUser || !participantSurface) return;
    const load = async () => {
      try {
        const response = await fetch("/api/progress");
        const result = await response.json() as { events?: Array<{ milestone: string; status: string }> };
        if (!response.ok) return;
        const latest = new Map<string, string>();
        for (const event of result.events || []) latest.set(event.milestone, event.status);
        setDone(milestones.map((item, index) => latest.get(item[0]) === "completed" || latest.get(item[0]) === "verified" ? index : -1).filter((index) => index >= 0));
      } catch { /* Progress remains interactive during a temporary network failure. */ }
    };
    void load();
  }, [portalUser, participantSurface]);

  function openAssistant() { setAssistantOpened(true); setAssistant(true); }

  const title = useMemo(() => view === "team" ? "Team Space" : view === "model" ? "My Learning Model" : view === "data" ? "My Data" : view === "policy" ? "Data Policy & Consent" : view === "eventAdmin" ? "Event Management" : view === "admin" ? "Organizer View" : nav.find((item) => item.id === view)?.label ?? "Overview", [view]);

  async function toggleMilestone(index: number) {
    const completed = !done.includes(index);
    setDone((current) => completed ? [...current, index] : current.filter((item) => item !== index));
    try {
      const response = await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ milestone: milestones[index][0], status: completed ? "completed" : "started" }) });
      if (!response.ok) throw new Error();
    } catch { setDone((current) => completed ? current.filter((item) => item !== index) : [...current, index]); }
  }

  function nextSurvey() {
    if (!answer.trim()) return;
    setSurveyAnswers((items) => [...items, answer.trim()]);
    setAnswer("");
    setSurveyStep((step) => Math.min(step + 1, surveyQuestions.length));
  }

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
    const participantViews: View[] = ["home", "onboarding", "learn", "clawmaxTutorial", "cogneeTutorial", "progress", "coach", "demo", "team", "model", "data", "settings", "policy"];
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
    <div className="app-shell" onMouseUp={(event) => {
      if (view === "admin" || view === "eventAdmin") return;
      if ((event.target as HTMLElement).closest("input, textarea, button, a, .assistant")) return;
      const selected = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
      if (selected && selected.length > 2) { setAssistantContext(selected); openAssistant(); }
    }}>
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
              {item.id === "progress" && <span className="nav-badge">{done.length}/{milestones.length}</span>}
            </button>
          ))}
          <p className="nav-label">TEAM SPACE</p>
          <button className={view === "team" ? "nav-item active" : "nav-item"} onClick={() => setView("team")}><Icon>♧</Icon>Shared Space<span className="status-dot on" /></button>
          <button className={view === "model" ? "nav-item active" : "nav-item"} onClick={() => setView("model")}><Icon>⌬</Icon>Learning Model</button>
          <button className={view === "data" ? "nav-item active" : "nav-item"} onClick={() => setView("data")}><Icon>▦</Icon>My Data</button>
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
          <div className="top-actions"><span className={`role-chip ${organizerParticipantMode ? "demo" : ""}`}>{organizerParticipantMode ? "PARTICIPANT DEMO" : portalUser.role === "organizer" ? "ORGANIZER PORTAL" : "PARTICIPANT PORTAL"}</span><span className="connection"><i /> Systems connected</span>{organizerParticipantMode && <button className="perspective-return-top" onClick={returnToOrganizer}>Return to Organizer</button>}{participantSurface && <button className="ask-button" onClick={openAssistant}>✦ Ask AI</button>}</div>
        </header>
        {eventConfig?.announcementActive && eventConfig.announcementText && <div className="global-announcement" role="status"><span>EVENT ANNOUNCEMENT</span><p>{eventConfig.announcementText}</p><small>{eventConfig.announcementUpdatedAt ? `Updated ${new Date(Number(eventConfig.announcementUpdatedAt)).toLocaleString()}` : "Organizer broadcast"}</small><button type="button" onClick={() => setAnnouncementHistoryOpen(true)} aria-haspopup="dialog">View history →</button></div>}
        {organizerParticipantMode && <div className="participant-demo-banner"><div><strong>Organizer participant demo</strong><span>You are using your real organizer account inside the participant experience. Create or join a shared demo team to rehearse the live workflow.</span></div><button onClick={returnToOrganizer}>Exit demo mode</button></div>}

        <section className="content">
          {view === "home" && <Overview progress={progress} setView={setView} />}
          {view === "onboarding" && (
            <AgentCanvas surveyStep={surveyStep} questions={surveyQuestions} answer={answer} setAnswer={setAnswer} next={nextSurvey} answers={surveyAnswers} savedProjectId={savedProjectId} onSaved={(id) => { setSavedProjectId(id); setDone((items) => items.includes(0) ? items : [...items, 0]); setSelectedMilestone(0); setView("progress"); }} />
          )}
          {view === "learn" && <LearningCenter setAssistant={(open) => { if (open) openAssistant(); else setAssistant(false); }} setView={setView} />}
          {view === "clawmaxTutorial" && <ClawMaxTutorial />}
          {view === "cogneeTutorial" && <CogneeTutorial setAssistant={(open) => { if (open) openAssistant(); else setAssistant(false); }} />}
          {view === "progress" && <Progress milestones={milestones} done={done} toggle={toggleMilestone} progress={progress} selected={selectedMilestone} setSelected={setSelectedMilestone} />}
          {view === "coach" && <PromptCoach />}
          {view === "demo" && <Demo />}
          {view === "team" && <TeamSpace />}
          {view === "model" && <MyLearningModel />}
          {view === "data" && <MyData />}
          {view === "admin" && <Admin />}
          {view === "eventAdmin" && <EventManagement config={eventConfig} onSaved={setEventConfig} />}
          {view === "settings" && <Settings setView={setView} />}
          {view === "policy" && <DataPolicy onBack={() => setView("settings")} />}
        </section>
      </main>

      {assistantOpened && <div className={assistant ? "assistant-mounted" : "assistant-mounted hidden"}><Assistant close={() => setAssistant(false)} page={title} selectedContext={assistantContext} /></div>}
      {assistantOpened && !assistant && <button className={`assistant-minimized ${assistantWorking ? "working" : ""}`} onClick={() => setAssistant(true)} aria-label={assistantWorking ? "AI is still thinking. Reopen assistant" : "Reopen AI Assistant"}><span className="assistant-mini-orb">✦</span><span><strong>{assistantWorking ? "AI is thinking…" : "AI Assistant"}</strong><small>{assistantWorking ? "You can keep working" : "Click to reopen"}</small></span></button>}
      {announcementHistoryOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setAnnouncementHistoryOpen(false)}><section className="participant-announcement-history" role="dialog" aria-modal="true" aria-labelledby="announcement-history-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">EVENT UPDATES</span><h2 id="announcement-history-title">Published announcements</h2></div><button type="button" onClick={() => setAnnouncementHistoryOpen(false)} aria-label="Close announcement history">×</button></header><div>{publishedAnnouncements.length ? publishedAnnouncements.map((item) => <article key={item.id}><small>{new Date(item.createdAt).toLocaleString()}</small><p>{item.announcementText}</p></article>) : <p className="notes-empty">No earlier published announcements yet.</p>}</div></section></div>}
    </div>
  );
}

function Overview({ progress, setView }: { progress: number; setView: (view: View) => void }) {
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
        <div className="card-heading"><span>YOUR BUILD PULSE</span><b>{progress}%</b></div>
        <div className="radial" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}%</strong><small>ON TRACK</small></div></div>
        <p><b>3 milestones complete.</b><br />Next: connect your Cognee memory.</p>
        <button onClick={() => setView("progress")}>View progress →</button>
      </article>
    </div>
    <div className="section-title"><div><span>YOUR NEXT MOVES</span><h3>Keep the momentum</h3></div><small>Recommended for your team</small></div>
    <div className="move-grid">
      <button className="move-card accent-violet" onClick={() => setView("learn")}><span className="move-icon">⌁</span><small>LEARN · 30 MIN</small><h4>Give your agent<br />verifiable memory</h4><p>Remember → Recall → Verify</p><b>Start onboarding →</b></button>
      <button className="move-card accent-lime" onClick={() => setView("progress")}><span className="move-icon">✓</span><small>BUILD · MILESTONE 04</small><h4>Store your first<br />useful memory</h4><p>Prove recall with one test.</p><b>Open milestone →</b></button>
      <button className="move-card accent-orange" onClick={() => setView("demo")}><span className="move-icon">◇</span><small>PREP · MIDPOINT</small><h4>Define how you’ll<br />measure success</h4><p>Make improvement visible.</p><b>Create evaluation →</b></button>
    </div>
    <article className="team-strip"><div><span className="team-logo">{teamName?.[0]?.toUpperCase() || "S"}</span><div><small>{teamName || "SHARED SPACE"}</small><h4>{team ? teamName ? "Your shared space is active" : "Create or join a shared space" : "Loading shared space…"}</h4></div></div><div className="team-stats"><span><b>{teamName ? team.members.length : "—"}</b><small>MEMBERS</small></span><span><b>{teamName ? team.memories.length : "—"}</b><small>MEMORIES</small></span><span><b>{teamName ? team.questions.length : "—"}</b><small>QUESTIONS</small></span></div><button onClick={() => setView("team")}>Open shared space →</button></article>
  </>;
}

function AgentCanvas({ surveyStep, questions, answer, setAnswer, next, answers, savedProjectId, onSaved }: { surveyStep: number; questions: string[]; answer: string; setAnswer: (v: string) => void; next: () => void; answers: string[]; savedProjectId: string | null; onSaved: (id: string) => void }) {
  const complete = surveyStep >= questions.length;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function saveCanvas() {
    if (savedProjectId || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      let anonymousParticipantId = sessionStorage.getItem("agentforge_participant_id");
      if (!anonymousParticipantId) {
        anonymousParticipantId = crypto.randomUUID();
        sessionStorage.setItem("agentforge_participant_id", anonymousParticipantId);
      }
      const response = await fetch("/api/canvas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anonymousParticipantId, answers }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Canvas could not be saved.");
      onSaved(result.id);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Canvas could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return <div className="split-layout">
    <section className="survey-panel">
      <span className="eyebrow">AGENT-GUIDED DISCOVERY</span>
      <h2>{complete ? "Your agent canvas is ready." : "Let’s find the agent worth building."}</h2>
      <p>{complete ? "Here is the first build brief based on your answers. You can refine it with your team." : "I’ll ask one useful question at a time. Your answers become a practical one-day build plan—not a generic idea."}</p>
      {!complete ? <div className="question-card">
        <div className="question-meta"><span>QUESTION {surveyStep + 1} OF {questions.length}</span><span>{Math.round((surveyStep / questions.length) * 100)}%</span></div>
        <h3>{questions[surveyStep]}</h3>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); next(); } }} placeholder="Describe a specific moment, not a broad category…" rows={6} />
        <div className="question-footer"><small>Press Enter to continue. Shift + Enter adds a new line.</small><button className="primary" onClick={next}>Continue →</button></div>
      </div> : <div className="brief-card"><span>DRAFT BUILD BRIEF</span><h3>Personal knowledge continuity agent</h3><dl><div><dt>Problem</dt><dd>{answers[0]}</dd></div><div><dt>MVP scope</dt><dd>Capture one trusted source, remember it with Cognee, and recall it inside one ClawMax workflow.</dd></div><div><dt>Demo success</dt><dd>{answers[3] || "Complete a repeatable task with measurable improvement."}</dd></div></dl>{saveError && <p className="form-error">{saveError}</p>}<button className="primary" onClick={saveCanvas} disabled={saving || Boolean(savedProjectId)}>{saving ? "Saving…" : savedProjectId ? "Canvas saved" : "Save canvas & start building"}</button></div>}
    </section>
    <aside className="canvas-aside"><span>LIVE CANVAS</span><h3>Your brief takes shape here</h3>{["Project idea", "Problem statement", "MVP scope", "Data sources", "Agent architecture", "Cognee memory role", "Demo success criteria"].map((item, i) => <div className={i < answers.length ? "canvas-item filled" : "canvas-item"} key={item}><b>{i < answers.length ? "✓" : i + 1}</b><span>{item}<small>{i < answers.length ? "Captured from your answer" : "Waiting for context"}</small></span></div>)}</aside>
  </div>;
}

function LearningCenter({ setAssistant, setView }: { setAssistant: (v: boolean) => void; setView: (view: View) => void }) {
  return <>
    <div className="page-intro"><div><span className="eyebrow">YOUR HACKATHON LEARNING HUB</span><h2>Learn only what you need to build.</h2><p>Start with the tool you need now, then return to the build path below. Each tutorial is designed around something your team can demonstrate—not passive reading.</p></div><button className="outline-button" onClick={() => setAssistant(true)}>✦ Ask about this page</button></div>
    <section className="tutorial-library" aria-label="Tutorial library">
      <button className="tutorial-library-card clawmax" onClick={() => setView("clawmaxTutorial")}>
        <span className="library-mark">C</span><span className="library-status pending">WAITING FOR MAX</span>
        <small>CLAWMAX · OFFICIAL MATERIALS PENDING</small><h3>Build your ClawMax agent</h3>
        <p>This space will contain the verified setup and agent-building walkthrough once Max provides the official material.</p>
        <b>Open placeholder →</b>
      </button>
      <button className="tutorial-library-card cognee" onClick={() => setView("cogneeTutorial")}>
        <span className="library-mark">◎</span><span className="library-status available">ONBOARDING DEMO</span>
        <small>COGNEE · OFFICIAL DOCS GUIDED PATH</small><h3>Build memory you can actually verify</h3>
        <p>Learn the current Remember and Recall workflow, then understand where Add, Cognify, Search, sessions, REST, and MCP fit.</p>
        <b>Start Cognee onboarding →</b>
      </button>
    </section>
    <section className="tutor-team-note">
      <div className="tutor-team-icon">✦</div>
      <div><span className="eyebrow">PROPOSED CLAWMAX AGENTIC TUTOR TEAM</span><h3>Help participants learn sponsor tools while they build.</h3><p>A team of ClawMax tutor agents could answer step-specific questions, explain ClawMax and Cognee concepts, recommend the next tutorial, and pass unresolved issues—with page and project context—to a human mentor.</p></div>
      <aside><span>MEETING WITH MAX</span><b>Confirm capabilities, tool access, escalation rules, and how tutor agents should improve from participant feedback.</b></aside>
    </section>
    <div className="learning-section-title"><div><span className="eyebrow">RECOMMENDED BUILD PATH</span><h3>From idea to measurable improvement</h3></div><p>These lessons will unlock as the real platform records completed tutorial steps and build evidence.</p></div>
    <div className="learning-layout"><section className="lesson-list">{lessons.map((lesson, i) => <article className="lesson" key={lesson.n}><span className={`lesson-number ${lesson.color}`}>{lesson.n}</span><div><small>{lesson.meta}</small><h3>{lesson.title}</h3><div className="lesson-bar"><i style={{ width: i === 0 ? "100%" : i === 1 ? "54%" : "0%" }} /></div></div><button disabled={lesson.status === "Locked"} onClick={() => lesson.n === "02" ? setView("clawmaxTutorial") : lesson.n === "03" ? setView("cogneeTutorial") : undefined}>{lesson.status} {lesson.status !== "Locked" && "→"}</button></article>)}</section>
    <aside className="memory-loop"><span>HOW TO USE THIS CENTER</span><h3>Learn, build, prove.</h3>{["Open the tutorial for your current step", "Try the task in your own project", "Save evidence in Build Progress", "Ask AI when you get stuck", "Return after feedback and improve"].map((item, i) => <div key={item}><b>{i + 1}</b><span>{item}</span>{i < 4 && <i>↓</i>}</div>)}<a href="https://docs.cognee.ai" target="_blank" rel="noreferrer">Open official Cognee docs ↗</a></aside></div>
  </>;
}

function ClawMaxTutorial() {
  return <div className="waiting-page"><div className="waiting-mark">C</div><span className="eyebrow">CLAWMAX TUTORIAL</span><h2>Waiting for Max.</h2><p>This page is reserved for the official ClawMax tutorial. Product steps, screenshots, terminology, and integration instructions will be added after Max provides or verifies the source materials.</p><div className="waiting-status"><span>CONTENT STATUS</span><b>Official materials pending</b></div><div className="waiting-proposal"><span>MEETING NOTE</span><p>Discuss adding a ClawMax Agentic Tutor Team that helps participants learn sponsor tools, answers questions with tutorial and project context, and escalates unresolved issues to human mentors.</p></div></div>;
}

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

function Progress({ milestones: items, done, toggle, progress, selected, setSelected }: { milestones: readonly (readonly [string, string])[]; done: number[]; toggle: (i: number) => void; progress: number; selected: number | null; setSelected: (i: number | null) => void }) {
  return <><div className="page-intro"><div><span className="eyebrow">BUILD CHECKPOINTS</span><h2>Turn a busy day into visible progress.</h2><p>Check items manually now. Connected events can verify them automatically later.</p></div><div className="progress-total"><strong>{progress}%</strong><span><i style={{ width: `${progress}%` }} /></span><small>{done.length} of {items.length} complete</small></div></div>
  <div className="milestone-grid">{items.map(([name, detail], i) => <button key={name} className={done.includes(i) ? "milestone done" : "milestone"} onClick={() => setSelected(i)}><span className="check">{done.includes(i) ? "✓" : i + 1}</span><span><small>MILESTONE {String(i + 1).padStart(2, "0")}</small><h3>{name}</h3><p>{detail}</p></span><b>{done.includes(i) ? "Verified" : "Open →"}</b></button>)}</div>
  {selected !== null && <div className="milestone-backdrop" onClick={() => setSelected(null)}><aside className="milestone-detail" onClick={(event) => event.stopPropagation()}><header><span>MILESTONE {String(selected + 1).padStart(2, "0")}</span><button onClick={() => setSelected(null)}>×</button></header><div className="detail-status">{done.includes(selected) ? "✓ COMPLETED" : "NEXT CHECKPOINT"}</div><h2>{items[selected][0]}</h2><p>{items[selected][1]}</p><section><h3>Definition of done</h3><ul><li>You can show concrete evidence for this checkpoint.</li><li>A teammate can repeat or verify the result.</li><li>You recorded what worked and what still needs attention.</li></ul></section><section><h3>Evidence</h3><textarea rows={4} placeholder="Add a test result, link, note, or screenshot description…" /></section><div className="detail-actions"><button className="outline-button" onClick={() => setSelected(null)}>Close</button><button className="primary" onClick={() => { toggle(selected); setSelected(null); }}>{done.includes(selected) ? "Mark incomplete" : "Mark complete"}</button></div></aside></div>}
  </>;
}

function Demo() {
  return <div className="demo-layout"><section><span className="eyebrow">FINAL STORY</span><h2>Show the change,<br />not just the agent.</h2><p>Your strongest demo compares the same task before and after feedback.</p><div className="upload-zone"><span>▶</span><h3>Drop your 60–90 second demo here</h3><p>MP4, MOV, or a shareable video link</p><button className="outline-button">Choose video</button></div></section><aside className="demo-checklist"><span>YOUR DEMO SHOULD PROVE</span>{["The real problem", "A working end-to-end task", "Before vs. after", "A repeatable success test", "What the agent learned", "How memory was used", "Data and privacy choices"].map((item, i) => <label key={item}><input type="checkbox" /> <b>{String(i + 1).padStart(2, "0")}</b><span>{item}</span></label>)}<button className="primary">Save demo draft</button></aside></div>;
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
  summary: { totalPrompts: number; inputTokens: number; outputTokens: number; successRate: number; avgLatencyMs: number; lastHour: number };
  hourly: Array<{ hour: string; prompts: number; tokens: number }>;
  pages: Array<{ page: string; tutorialStep?: string; prompts: number; errors: number; tokens: number }>;
  teams: Array<{ teamId: string; prompts: number; tokens: number }>;
  prompts: Array<{ id: string; participantId: string; teamId?: string; page: string; userPrompt: string; responseText?: string; modelName?: string; latencyMs?: number; inputTokens?: number; outputTokens?: number; status: string; errorCode?: string; createdAt: number }>;
  settings: { assistantEnabled: number; defaultTeamTokenQuota: number };
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
  feedbacks: Array<{ id: string; promptEventId: string; participantId: string; teamId?: string | null; participantDisplayName: string; feedback: "helpful" | "not_helpful"; page: string; tutorialStep?: string | null; userPrompt: string; createdAt: number }>;
  promptEvaluations: Array<{ id: string; promptEventId: string; rubricVersion: string; evaluator: string; evaluationJson: string; totalScore?: number | null; createdAt: number; participantId: string; page: string; tutorialStep?: string; userPrompt: string; contextReference?: string; parentPromptEventId?: string; parentPrompt?: string; outcomeStatus?: string; outcomeEvidence?: string }>;
};

type RegisteredParticipant = { id: string; displayName: string; email?: string | null; role: "participant" | "organizer"; consentVersion: string; consentStatus: "accepted" | "withdrawn" | "pending"; joinedAt: number; lastActive: number; teamName?: string | null };
type OrganizerGrant = { email: string; status: "active" | "revoked"; grantedByName: string; createdAt: number; updatedAt: number };
type AnnouncementHistoryItem = { id: string; announcementText?: string | null; action: "published" | "updated" | "withdrawn"; active: number | boolean; editorName: string; createdAt: number };
const toLocalInput = (value?: number | null) => value ? new Date(Number(value) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
type ProcessIndicatorView = { score?: number | null; status?: string; evidence: string[]; rationale?: string };
type PromptEvaluationView = { scores: Record<string, number | null>; criterionEvidence: Record<string, string[]>; processIndicators: Record<string, ProcessIndicatorView>; totalScore?: number; maxScore?: number; grade?: string; coachingStatus?: string; strengths: string[]; weaknesses: string[]; improvedPrompt?: string; summary?: string; evidenceUsed: string[]; evidenceMissing: string[]; inferenceNotice?: string };

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
    <header><div className="evaluation-score"><div style={{ "--score-angle": `${isV4 ? 0 : Math.max(0, Math.min(maxScore, Number(score || 0))) / maxScore * 360}deg` } as React.CSSProperties}><span><strong>{isV4 ? observed : score ?? "—"}</strong><small>{isV4 ? " signals" : `/${maxScore}`}</small></span></div><span className={`evaluation-grade ${tone}`}>{evaluation.grade || label}</span></div><div className="evaluation-prompt"><span className="eyebrow">{item.page}{item.tutorialStep ? ` · ${item.tutorialStep}` : ""} · {item.participantId.slice(0, 12)}…</span><h4>{item.userPrompt}</h4><small>{item.rubricVersion} · Evaluated {new Date(item.createdAt).toLocaleString()}</small>{item.parentPrompt && <p className="iteration-evidence"><b>Previous Prompt:</b> {item.parentPrompt}</p>}</div></header>
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
  const [organizerGrants, setOrganizerGrants] = useState<OrganizerGrant[]>([]);
  const [serverOrganizerEmails, setServerOrganizerEmails] = useState<string[]>([]);
  const [currentOrganizerParticipantId, setCurrentOrganizerParticipantId] = useState("");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [organizerSearch, setOrganizerSearch] = useState("");
  const [organizerNotice, setOrganizerNotice] = useState("");
  const [announcementHistory, setAnnouncementHistory] = useState<AnnouncementHistoryItem[]>([]);
  const [showAnnouncementHistory, setShowAnnouncementHistory] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ eventName: config?.eventName || "Personal Agent Hackathon", startsAt: toLocalInput(config?.startsAt), endsAt: toLocalInput(config?.endsAt), timezone: config?.timezone || "America/New_York", discordUrl: config?.discordUrl || "", announcementText: config?.announcementText || "", announcementActive: config?.announcementActive === true || config?.announcementActive === 1, registrationOpen: config?.registrationOpen !== false && config?.registrationOpen !== 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function open() {
    setError("");
    const response = await fetch("/api/event?admin=1");
    const result = await response.json() as { config?: EventConfig; participants?: RegisteredParticipant[]; organizerGrants?: OrganizerGrant[]; serverOrganizerEmails?: string[]; currentOrganizerParticipantId?: string; announcementHistory?: AnnouncementHistoryItem[]; error?: string };
    if (!response.ok) { setError(response.status === 401 ? "Your account does not have Organizer access." : result.error || "Event management could not be loaded."); return; }
    setParticipants(result.participants || []); setOrganizerGrants(result.organizerGrants || []); setServerOrganizerEmails(result.serverOrganizerEmails || []); setCurrentOrganizerParticipantId(result.currentOrganizerParticipantId || ""); setAnnouncementHistory(result.announcementHistory || []);
    if (result.config) { onSaved(result.config); setForm({ eventName: result.config.eventName || "Personal Agent Hackathon", startsAt: toLocalInput(result.config.startsAt), endsAt: toLocalInput(result.config.endsAt), timezone: result.config.timezone || "America/New_York", discordUrl: result.config.discordUrl || "", announcementText: result.config.announcementText || "", announcementActive: result.config.announcementActive === true || result.config.announcementActive === 1, registrationOpen: result.config.registrationOpen !== false && result.config.registrationOpen !== 0 }); }
  }

  useEffect(() => { const timer = window.setTimeout(() => void open(), 0); return () => window.clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true); setError("");
    const next: EventConfig = { eventName: form.eventName, startsAt: form.startsAt ? new Date(form.startsAt).getTime() : null, endsAt: form.endsAt ? new Date(form.endsAt).getTime() : null, timezone: form.timezone, discordUrl: form.discordUrl, announcementText: form.announcementText, announcementActive: form.announcementActive, announcementUpdatedAt: Date.now(), registrationOpen: form.registrationOpen };
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
    <section className="participant-directory"><div className="table-title"><div><h3>Registered Users</h3><p>{participants.length} authenticated event accounts · roles are enforced by the server</p></div><input type="search" placeholder="Search name, email, role, team…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>{error && <p className="form-error directory-error">{error}</p>}<div className="participant-table user-management-table"><div className="participant-row heading"><span>USER</span><span>ROLE</span><span>TEAM</span><span>CONSENT</span><span>JOINED</span><span>LAST ACTIVE</span></div>{filtered.map((participant) => <div className="participant-row" key={participant.id}><span className="participant-identity"><strong>{participant.displayName}</strong><small>{participant.email || "Not collected"}</small></span><select aria-label={`Role for ${participant.displayName}`} value={participant.role} disabled={saving} onChange={(event) => void updateRole(participant, event.target.value as RegisteredParticipant["role"])}><option value="participant">Participant</option><option value="organizer">Organizer</option></select><span>{participant.teamName || "Unassigned"}</span><span><b className={`pill ${participant.consentStatus === "accepted" ? "on-track" : "needs-help"}`}>{participant.consentStatus}</b><small className="consent-version">{participant.consentVersion}</small></span><span>{new Date(participant.joinedAt).toLocaleString()}</span><span>{new Date(participant.lastActive).toLocaleString()}</span></div>)}{!filtered.length && <p className="notes-empty">No registered users match this search.</p>}</div></section>
  </div>;
}

function Admin() {
  const [data, setData] = useState<OrganizerData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cogneeAction, setCogneeAction] = useState("");
  const [cogneeNotice, setCogneeNotice] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<OrganizerData["prompts"][number] | null>(null);

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
    const response = await fetch("/api/organizer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assistantEnabled, defaultTeamTokenQuota: quota }) });
    if (response.ok) await loadOrganizer();
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
    const rows = [["time", "page", "participant", "status", "model", "input_tokens", "output_tokens", "latency_ms", "prompt"], ...data.prompts.map((item) => [new Date(item.createdAt).toISOString(), item.page, item.participantId, item.status, item.modelName, item.inputTokens, item.outputTokens, item.latencyMs, item.userPrompt])];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "agentforge-prompt-events.csv"; link.click(); URL.revokeObjectURL(url);
  }

  if (!data) return <div className="organizer-login"><span className="service-mark purple">▥</span><span className="eyebrow">PROTECTED ORGANIZER PORTAL</span><h2>{loading ? "Opening the control room…" : "Organizer access required."}</h2><p>Access is checked from the signed-in account role on the server.</p>{error && <p className="form-error">{error}</p>}<button className="primary" onClick={() => void loadOrganizer()} disabled={loading}>{loading ? "Loading…" : "Retry"}</button></div>;

  const totalTokens = Number(data.summary.inputTokens) + Number(data.summary.outputTokens);
  const quota = Number(data.settings.defaultTeamTokenQuota);
  const visibleEvaluations = [...data.promptEvaluations].sort((a, b) => b.createdAt - a.createdAt).filter((item, index, items) => items.findIndex((candidate) => candidate.promptEventId === item.promptEventId) === index);
  const currentRubricIds = new Set(data.promptEvaluations.filter((item) => item.rubricVersion === "agentforge-process-coaching-v4").map((item) => item.promptEventId));
  const awaitingEvaluations = data.prompts.filter((item) => item.status === "success" && !currentRubricIds.has(item.id));
  return <>
    {data.learningSignals.length > 0 && <section className="signal-review-queue"><div className="table-title"><div><h3>Human Review Queue</h3><p>Edit, approve, or reject Cognee interpretations before they influence tutorial changes.</p></div></div>{data.learningSignals.map((signal) => <div key={`review-${signal.id}`}><span><strong>{signal.page} · {signal.tutorialStep || "General"}</strong><small>{signal.reviewStatus}</small></span><button onClick={() => void editSignal(signal)}>Edit</button><button onClick={() => void reviewSignal(signal.id, "approved")} disabled={signal.reviewStatus === "approved"}>Approve</button><button onClick={() => void reviewSignal(signal.id, "rejected")} disabled={signal.reviewStatus === "rejected"}>Reject</button></div>)}</section>}
    <div className="live-admin-head"><div><span className="eyebrow">LIVE ORGANIZER PORTAL</span><h2>Prompt and Token Operations</h2><p>Connected to real AgentForge prompt events. Sensitive patterns are masked before display.</p></div><div><button className="outline-button" onClick={exportCsv}>Export CSV</button><button className="outline-button" onClick={() => void loadOrganizer()}>Refresh</button></div></div>
    <div className="metric-grid explained live-metrics"><article><small>TOTAL PROMPTS</small><strong>{data.summary.totalPrompts}</strong><span>{data.summary.lastHour} in the last hour</span><p>All recorded Assistant requests.</p></article><article><small>TOTAL TOKENS</small><strong>{totalTokens.toLocaleString()}</strong><span>{Number(data.summary.inputTokens).toLocaleString()} in · {Number(data.summary.outputTokens).toLocaleString()} out</span><p>Actual usage reported by OpenAI.</p></article><article><small>SUCCESS RATE</small><strong>{data.summary.successRate}%</strong><span>{100 - Number(data.summary.successRate)}% errors</span><p>Requests that returned a usable answer.</p></article><article><small>AVG. LATENCY</small><strong>{(Number(data.summary.avgLatencyMs) / 1000).toFixed(1)}s</strong><span>End-to-end response time</span><p>Includes OpenAI generation time.</p></article></div>
    <section className="admin-controls"><div><span className={data.settings.assistantEnabled ? "control-dot on" : "control-dot"} /><span><small>AI ASSISTANT</small><strong>{data.settings.assistantEnabled ? "Running" : "Paused"}</strong></span><button className={data.settings.assistantEnabled ? "danger-button" : "primary"} onClick={() => void updateSettings(!data.settings.assistantEnabled)}>{data.settings.assistantEnabled ? "Pause assistant" : "Resume assistant"}</button></div><div><span><small>DEFAULT TEAM QUOTA</small><strong>{quota.toLocaleString()} tokens</strong></span><div className="quota-bar"><i style={{ width: `${Math.min(100, (totalTokens / quota) * 100)}%` }} /></div><button className="outline-button" onClick={() => { const next = window.prompt("Default tokens per team", String(quota)); if (next) void updateSettings(Boolean(data.settings.assistantEnabled), Number(next)); }}>Edit quota</button></div></section>
    {error && <p className="form-error organizer-error">{error}</p>}
    <section className="clawmax-operations"><div className="table-title"><div><span className="eyebrow">CLAWMAX PARTNER INGESTION</span><h3>Consent, delivery, normalization, and deletion</h3><p>Events appear here only after server authentication. Identity mapping and receipt validation happen before Prompt/Progress records or Cognee memory are created.</p></div><span>{data.clawmax?.connections.filter((item) => item.status === "active").length || 0} active connections</span></div><div className="clawmax-status-grid">{["quarantined", "mapped", "normalized", "rejected"].map((status) => <article key={status}><small>{status.toUpperCase()}</small><strong>{Number(data.clawmax?.status.find((item) => item.status === status)?.count || 0)}</strong><p>{status === "normalized" ? "Authorized evidence converted into AgentForge records." : status === "rejected" ? "Stored with a reviewable normalization reason." : status === "mapped" ? "Participant mapping resolved; normalization pending." : "Raw sanitized evidence awaiting authorization or mapping."}</p></article>)}</div><div className="clawmax-monitor-grid"><div><h4>Connected participants</h4>{data.clawmax?.connections.length ? data.clawmax.connections.slice(0, 20).map((item) => <article className="clawmax-connection-row" key={item.id}><span><strong>{item.participantDisplayName}</strong><small>{item.workspaceId}</small></span><span>{Number(item.activeReceipts)} active receipt{Number(item.activeReceipts) === 1 ? "" : "s"}</span><b className={`pill ${item.status === "active" ? "on-track" : "blocked"}`}>{item.status}</b></article>) : <p className="notes-empty">No participant has connected ClawMax yet.</p>}</div><div><h4>Recent delivery evidence</h4>{data.clawmax?.recent.length ? data.clawmax.recent.slice(0, 20).map((item) => <article className="clawmax-event-row" key={item.eventId}><span><strong>{item.source}</strong><small>{item.participantDisplayName || "Unmapped participant"} · {new Date(item.receivedAt).toLocaleString()}</small></span><b className={`memory-state ${item.normalizationStatus}`}>{item.normalizationStatus}</b>{item.normalizationError && <small title={item.normalizationError}>Review reason: {item.normalizationError}</small>}</article>) : <p className="notes-empty">No ClawMax events have been delivered yet.</p>}</div></div><div className="clawmax-purge-panel"><header><div><h4>Revocation & deletion status</h4><p>Local evidence is removed immediately. A job is not marked complete while Cognee deletion is still unresolved.</p></div><span>{data.clawmax?.purges.filter((item) => item.status !== "completed").length || 0} need attention</span></header>{data.clawmax?.purges.length ? data.clawmax.purges.slice(0, 20).map((item) => <article key={item.id}><span><strong>{item.participantDisplayName}</strong><small>{item.workspaceId} · receipt {item.receiptId.slice(0, 12)}…</small></span><span><b>{Number(item.rawEventsPurged)} raw</b><small>{Number(item.normalizedRecordsPurged)} normalized · {Number(item.cogneeRecordsPending)} Cognee pending</small></span><b className={`pill ${item.status === "completed" ? "on-track" : item.status === "error" ? "blocked" : "needs-help"}`}>{item.status}</b>{item.lastError && <small className="purge-error" title={item.lastError}>{item.lastError}</small>}</article>) : <p className="notes-empty">No deletion jobs have been requested.</p>}</div></section>
    <section className="cognee-operations"><div className="table-title"><div><span className="eyebrow">COGNEE SEMANTIC MEMORY</span><h3>Hackathon Learning Memory</h3><p>Prompts, responses, participant-model facts, project canvases, feedback, Shared Space notes, and tutorial content are organized by node set.</p></div><span className={`pill ${data.cognee.connected ? "on-track" : "needs-help"}`}>{data.cognee.connected ? "Cloud connected" : "API key required"}</span></div><div className="cognee-status-grid">{["pending", "syncing", "synced", "error"].map((status) => <div key={status}><small>{status.toUpperCase()}</small><strong>{Number(data.cognee.sync.find((item) => item.status === status)?.count || 0)}</strong><p>{status === "pending" ? "Memory events waiting for delivery." : status === "synced" ? "Events accepted and sent for graph processing." : status === "error" ? "Safe to retry; original operational records remain intact." : "Batch currently being delivered."}</p></div>)}</div><div className="cognee-action-guide"><span><b>1</b>Queue creates missing outbox records</span><i>→</i><span><b>2</b>Sync sends pending records to Cognee</span><i>→</i><span><b>3</b>Cognify runs in the background</span></div>{cogneeNotice && <div className="cognee-action-notice" role="status"><b>✓</b><span>{cogneeNotice}</span></div>}<div className="cognee-actions"><button className="outline-button" title="Queue the current ClawMax placeholder and Cognee tutorial summary. This does not crawl documentation." onClick={() => void runCognee("seed_tutorials")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "seed_tutorials" ? "Checking tutorials…" : "Queue tutorial memory"}</button><button className="outline-button" title="Find historical Prompts, projects, notes, and feedback that have not entered the Cognee outbox." onClick={() => void runCognee("backfill_all")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "backfill_all" ? "Checking history…" : "Backfill existing data"}</button><button className="outline-button" onClick={() => void runCognee("detect")} disabled={Boolean(cogneeAction)}>{cogneeAction === "detect" ? "Checking…" : "Detect learning signals"}</button><button className="outline-button" onClick={() => void runCognee("grade_prompts")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "grade_prompts" ? "Coaching…" : "Coach prompts with Cognee"}</button><button className="primary" onClick={() => void runCognee("sync")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "sync" ? "Syncing…" : "Sync all pending memory"}</button></div></section>
    <section className="prompt-evaluations"><div className="table-title"><div><span className="eyebrow">PROCESS COACHING · PROVISIONAL AI ANNOTATION</span><h3>Cognee Evidence-Linked Process Coaching</h3><p>Framework v4 separates current-goal Prompt adequacy, episode-level process evidence, and outcomes. It produces no holistic learner score or automatic grade.</p></div><span>{visibleEvaluations.length} annotated · {awaitingEvaluations.length} awaiting</span></div>{awaitingEvaluations.length > 0 && <div className="evaluation-queue"><header><div><span className="eyebrow">AWAITING ANNOTATION</span><h4>{awaitingEvaluations.length} successful interaction{awaitingEvaluations.length === 1 ? "" : "s"} not yet reviewed with framework v4</h4><p>The next click annotates one interaction in context. Digits, greetings, and test strings are handled by zero-token rules.</p></div><button className="primary" onClick={() => void runCognee("grade_prompts")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "grade_prompts" ? "Annotating…" : "Annotate next interaction"}</button></header><div>{awaitingEvaluations.slice(0, 8).map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.userPrompt}</strong><small>{item.page} · {new Date(item.createdAt).toLocaleString()}</small></div><span className="evaluation-pending-pill">AWAITING</span></article>)}</div>{awaitingEvaluations.length > 8 && <small className="queue-more">+ {awaitingEvaluations.length - 8} more interaction{awaitingEvaluations.length - 8 === 1 ? "" : "s"} in the queue</small>}</div>}{visibleEvaluations.length ? <div className="evaluation-list">{visibleEvaluations.map((item) => <PromptEvaluationCard key={item.id} item={item} />)}</div> : <p className="notes-empty">No completed process annotations yet. Use “Annotate next interaction” above when you are ready.</p>}</section>
    <section className="prompt-cluster-panel"><div className="table-title"><div><span className="eyebrow">ZERO-TOKEN PROMPT CLUSTERING</span><h3>Common Questions & Error Categories</h3><p>Deterministic keyword/error rules group the last hour by tutorial step before any AI interpretation.</p></div><span>{data.promptClusters?.length || 0} clusters</span></div><div className="cluster-grid">{data.promptClusters?.length ? data.promptClusters.slice(0, 12).map((cluster) => <article key={cluster.id}><span>{cluster.category.replaceAll("_", " ")}</span><h4>{cluster.page} · {cluster.tutorialStep || "General"}</h4><div><b>{cluster.promptCount} prompts</b><b>{cluster.participantCount} participants</b><b>{cluster.errorCount} errors</b></div><details><summary>Representative examples</summary>{(() => { try { return (JSON.parse(cluster.examplesJson) as string[]).slice(0, 4).map((example) => <p key={example}>{example}</p>); } catch { return <p>Examples unavailable.</p>; } })()}</details></article>) : <p className="notes-empty">Run “Detect learning signals” after Prompt activity to create real clusters.</p>}</div></section>
    <section className="learning-signal-live"><div className="table-title"><div><h3>Detected Learning Signals</h3><p>Counts are rule-based SQL facts. Cognee adds an evidence-grounded interpretation only when requested.</p></div></div>{data.learningSignals.length ? data.learningSignals.map((signal) => { const evidence = (data.signalEvidence || []).filter((item) => item.signalId === signal.id); return <article key={signal.id}><div><span className="eyebrow">{signal.reviewStatus}</span><h4>{signal.page} · {signal.tutorialStep || "General page"}</h4><p><b>{signal.promptCount}</b> prompts from <b>{signal.participantCount}</b> participants · {signal.errorCount} errors · {signal.negativeFeedbackCount} negative feedback</p><small>FACTS: calculated by {signal.detectionRule}. These counts are not generated by AI.</small><details className="signal-evidence"><summary>View {evidence.length} linked Prompt examples</summary>{evidence.map((item) => <p key={item.promptEventId}><b>{item.status}</b> {item.userPrompt}</p>)}</details></div><div className="signal-interpretation"><b>COGNEE INTERPRETATION</b><p>{signal.cogneeSummary || "Not generated yet. An organizer may request analysis after evidence has synced."}</p><small>INFERENCE: requires human review and remains linked to the Prompt examples at left.</small>{signal.suggestedAction && <strong>Suggested action: {signal.suggestedAction}</strong>}</div><div className="signal-review-actions"><button className="outline-button" onClick={() => void runCognee("analyze", signal.id)} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === `analyze:${signal.id}` ? "Analyzing…" : "Analyze with Cognee"}</button><button onClick={() => void reviewSignal(signal.id, "approved")} disabled={signal.reviewStatus === "approved"}>Approve</button><button onClick={() => void reviewSignal(signal.id, "rejected")} disabled={signal.reviewStatus === "rejected"}>Reject</button></div></article>; }) : <div className="empty-live-state"><strong>No learning signal currently crosses the threshold.</strong><p>This is a real empty state—not demo data. Run detection after participants begin asking questions.</p></div>}</section>
    <div className="live-admin-grid"><section className="usage-panel"><div className="table-title"><div><h3>Hourly Token Trend</h3><p>Last 24 recorded hours</p></div></div><div className="usage-bars">{data.hourly.length ? data.hourly.map((item) => { const max = Math.max(...data.hourly.map((point) => Number(point.tokens)), 1); return <div key={item.hour} title={`${item.hour}: ${item.tokens} tokens`}><i style={{ height: `${Math.max(6, Number(item.tokens) / max * 100)}%` }} /><small>{item.hour.slice(11, 16)}</small></div>; }) : <p>No token data yet.</p>}</div></section><section className="usage-panel"><div className="table-title"><div><h3>Usage by Page & Step</h3><p>Where participants ask and fail</p></div></div><div className="compact-rows">{data.pages.map((item) => <div key={`${item.page}-${item.tutorialStep}`}><span><strong>{item.page}</strong><small>{item.tutorialStep || "General page"}</small></span><b>{item.prompts} prompts</b><em>{item.errors} errors</em><small>{Number(item.tokens).toLocaleString()} tokens</small></div>)}</div></section></div>
    <section className="prompt-monitor"><div className="table-title"><div><h3>Recent Prompts</h3><p>Latest 100 · click a row to inspect the masked prompt and response</p></div><span>Protected organizer data</span></div><div className="prompt-table"><div className="prompt-row heading"><span>TIME</span><span>PAGE</span><span>PROMPT</span><span>TOKENS</span><span>STATUS</span></div>{data.prompts.map((item) => <button className="prompt-row" key={item.id} onClick={() => setSelectedPrompt(item)}><span>{new Date(item.createdAt).toLocaleTimeString()}</span><span>{item.page}</span><span>{item.userPrompt}</span><span>{Number(item.inputTokens || 0) + Number(item.outputTokens || 0)}</span><span className={`pill ${item.status === "success" ? "on-track" : "blocked"}`}>{item.status}</span></button>)}</div></section>
    <section className="feedback-monitor"><div className="table-title"><div><h3>Recent Assistant Feedback</h3><p>Real Helpful / Not helpful events · participant identity will resolve to login accounts when authentication is connected</p></div><span>{data.feedbacks.length} recorded</span></div><div className="feedback-table"><div className="feedback-row heading"><span>TIME</span><span>PARTICIPANT</span><span>PAGE</span><span>PROMPT</span><span>FEEDBACK</span></div>{data.feedbacks.map((item) => <div className="feedback-row" key={item.id}><span>{new Date(item.createdAt).toLocaleString()}</span><span><strong>{item.participantDisplayName}</strong><small title={item.participantId}>{item.participantId.slice(0, 12)}… · {item.teamId || "Unassigned"}</small></span><span>{item.page}<small>{item.tutorialStep || "General page"}</small></span><span>{item.userPrompt}</span><span className={`pill ${item.feedback === "helpful" ? "on-track" : "needs-help"}`}>{item.feedback === "helpful" ? "Helpful" : "Not helpful"}</span></div>)}{!data.feedbacks.length && <p className="notes-empty">No participant feedback has been recorded yet.</p>}</div></section>
    <section className="team-quota-panel"><div className="table-title"><div><h3>Team Usage & Remaining Quota</h3><p>“Unassigned” will be replaced by real team IDs after login and team membership are connected.</p></div></div>{data.teams.map((team) => <div className="team-quota-row" key={team.teamId}><strong>{team.teamId}</strong><span>{team.prompts} prompts</span><div><i style={{ width: `${Math.min(100, Number(team.tokens) / quota * 100)}%` }} /></div><b>{Number(team.tokens).toLocaleString()} used</b><em>{Math.max(0, quota - Number(team.tokens)).toLocaleString()} remaining</em></div>)}</section>
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
  projects: Array<{ id: string; title: string; problem: string; successCriteria?: string; status: string; updatedAt: number }>;
  prompts: Array<{ id: string; page: string; tutorialStep?: string; userPrompt: string; responseText?: string; modelName?: string; inputTokens?: number; outputTokens?: number; status: string; userFeedback?: string; createdAt: number; memoryStatus?: string; memorySyncedAt?: number }>;
  memory: Array<{ id: string; entryKind: string; category: string; statement: string; sourceType: string; confirmedByParticipant: number; observedAt: number; memoryStatus?: string; memorySyncedAt?: number }>;
  progress: Array<{ id: string; milestone: string; status: string; source: string; occurredAt: number }>;
};

function MyData() {
  const [data, setData] = useState<MyDataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { const load = async () => { try { const response = await fetch("/api/me"); const result = await response.json() as MyDataPayload & { error?: string }; if (!response.ok) throw new Error(result.error || "Your data could not be loaded."); setData(result); } catch (problem) { setError(problem instanceof Error ? problem.message : "Your data could not be loaded."); } finally { setLoading(false); } }; void load(); }, []);
  if (loading) return <div className="my-data-page"><section className="my-data-hero"><span className="eyebrow">YOUR EVENT RECORD</span><h2>Loading your data…</h2></section></div>;
  if (error || !data) return <div className="my-data-page"><section className="my-data-hero"><span className="eyebrow">YOUR EVENT RECORD</span><h2>We could not load this page.</h2><p>{error}</p></section></div>;
  const synced = data.prompts.filter((item) => item.memoryStatus === "synced").length + data.memory.filter((item) => item.memoryStatus === "synced").length;
  const pending = data.prompts.filter((item) => item.memoryStatus === "pending").length + data.memory.filter((item) => item.memoryStatus === "pending").length;
  return <div className="my-data-page"><section className="my-data-hero"><div><span className="eyebrow">YOUR EVENT RECORD</span><h2>See what AgentForge remembers about your work.</h2><p>This page separates operational Prompt records from participant-model Memory. Cognee delivery status is shown explicitly.</p></div><a className="primary" href="/api/me?download=1" download>Export my data (.json) ↓</a></section><section className="identity-chain"><article><small>USER</small><strong>{data.account.displayName}</strong><span>{data.account.email}</span></article><i>→</i><article><small>EVENT REGISTRATION</small><strong>{data.relationship.eventRegistrationId.slice(0, 8)}…</strong><span>{data.account.role}</span></article><i>→</i><article><small>CONSENT</small><strong>{data.consent[0]?.status || "Not recorded"}</strong><span>{data.consent[0]?.policyVersion || "—"}</span></article><i>→</i><article><small>TEAM</small><strong>{data.account.teamName || "Solo / pending"}</strong><span>{data.account.inviteCode || "No invite code"}</span></article><i>→</i><article><small>PROJECT & EVIDENCE</small><strong>{data.projects.length} project · {data.prompts.length} prompts</strong><span>{synced} synced · {pending} pending</span></article></section><div className="my-data-grid"><section><header><div><span className="eyebrow">RAW OPERATIONAL RECORDS</span><h3>My prompts</h3></div><b>{data.prompts.length}</b></header>{data.prompts.length ? data.prompts.map((item) => <article className="data-record" key={item.id}><div><small>{item.page}{item.tutorialStep ? ` · ${item.tutorialStep}` : ""} · {new Date(item.createdAt).toLocaleString()}</small><span className={`memory-state ${item.memoryStatus || "unknown"}`}>{item.memoryStatus || "not queued"}</span></div><strong>{item.userPrompt}</strong>{item.responseText && <p>{item.responseText}</p>}<footer><span>{item.status} · {item.modelName || "No model"}</span><span>{item.inputTokens ?? "—"} input · {item.outputTokens ?? "—"} output</span></footer></article>) : <p className="notes-empty">No prompts have been recorded for this account yet.</p>}</section><section><header><div><span className="eyebrow">COGNEE-BOUND PARTICIPANT MODEL</span><h3>My memory</h3></div><b>{data.memory.length}</b></header>{data.memory.length ? data.memory.map((item) => <article className="data-record memory-record" key={item.id}><div><small>{item.entryKind.toUpperCase()} · {item.category}</small><span className={`memory-state ${item.memoryStatus || "unknown"}`}>{item.memoryStatus || "not queued"}</span></div><strong>{item.statement}</strong><footer><span>Source: {item.sourceType}</span><span>{item.confirmedByParticipant ? "Participant-confirmed" : "Not confirmed"}</span></footer></article>) : <p className="notes-empty">No participant-model memory has been recorded yet.</p>}</section></div><section className="data-progress"><header><div><span className="eyebrow">APPEND-ONLY ACTIVITY</span><h3>Progress history</h3></div><b>{data.progress.length}</b></header>{data.progress.slice(0, 20).map((item) => <div key={item.id}><strong>{item.milestone}</strong><span>{item.status} · {item.source}</span><small>{new Date(item.occurredAt).toLocaleString()}</small></div>)}</section><p className="data-retention-note"><strong>Deletion note:</strong> single-record deletion is intentionally not enabled in this phase. The export is live; retention and deletion need a reviewed event policy so shared team evidence and audit history are handled consistently.</p></div>;
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

function Settings({ setView }: { setView: (view: View) => void }) {
  const [enrollments, setEnrollments] = useState<ClawMaxEnrollment[]>([]);
  const [connectionCode, setConnectionCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
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

  async function createConnectionCode() {
    setConnectionBusy(true); setConnectionError(""); setConnectionNotice("");
    try {
      const response = await fetch("/api/clawmax/enrollments", { method: "POST" });
      const result = await response.json() as { connectionCode?: string; expiresAt?: number; error?: string };
      if (!response.ok || !result.connectionCode) throw new Error(result.error || "A connection code could not be created.");
      setConnectionCode(result.connectionCode); setExpiresAt(result.expiresAt || null);
      setConnectionNotice("Enter this one-time code in ClawMax. It is shown only here and expires in 10 minutes.");
    } catch (problem) { setConnectionError(problem instanceof Error ? problem.message : "A connection code could not be created."); }
    finally { setConnectionBusy(false); }
  }

  async function disconnect() {
    if (!active) return;
    setConnectionBusy(true); setConnectionError(""); setConnectionNotice("");
    try {
      const response = await fetch("/api/clawmax/enrollments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enrollmentId: active.id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "ClawMax could not be disconnected.");
      setConnectionCode(""); setExpiresAt(null); setConnectionNotice("ClawMax sharing has been revoked. Related purge work has been queued.");
      await loadConnections();
    } catch (problem) { setConnectionError(problem instanceof Error ? problem.message : "ClawMax could not be disconnected."); }
    finally { setConnectionBusy(false); }
  }

  return <div className="settings-layout">
    <section><span className="eyebrow">CONNECTIONS & PRIVACY</span><h2>Keep access explicit.</h2><p>AgentForge never asks participants to paste a Partner API key. A short-lived code links your signed-in account to ClawMax server-to-server.</p>
      <article className="setting-card clawmax-connect-card"><div className="setting-title"><span className="service-mark purple">C</span><div><h3>ClawMax activity sharing</h3><p>Connect consented ClawMax prompts and build activity to your AgentForge event record.</p></div><span className={active ? "pill on-track" : "pill needs-help"}>{active ? "Connected" : "Not connected"}</span></div>
        {active ? <><div className="connection-summary"><small>CONNECTED WORKSPACE</small><strong>{active.workspaceId}</strong><span>Only activity covered by an active, matching consent receipt is accepted.</span></div><div className="setting-actions"><small>You can stop future sharing at any time. Revocation immediately blocks new ingestion.</small><button className="outline-button danger" disabled={connectionBusy} onClick={() => void disconnect()}>{connectionBusy ? "Disconnecting…" : "Disconnect ClawMax"}</button></div></> : <><div className="connection-flow"><span><b>1</b>Generate a one-time code</span><i>→</i><span><b>2</b>Enter it in ClawMax</span><i>→</i><span><b>3</b>Review sharing consent</span></div>{connectionCode && <div className="connection-code"><small>ONE-TIME CONNECTION CODE</small><strong>{connectionCode}</strong><button className="outline-button" onClick={() => void navigator.clipboard.writeText(connectionCode)}>Copy code</button><span>{expiresAt ? `Expires ${new Date(expiresAt).toLocaleTimeString()}` : "Expires in 10 minutes"}</span></div>}<div className="setting-actions"><small>No passwords, AgentForge Sessions, or Partner secrets are sent to ClawMax.</small><button className="primary" disabled={connectionBusy} onClick={() => void createConnectionCode()}>{connectionBusy ? "Generating…" : connectionCode ? "Generate a new code" : "Connect ClawMax"}</button></div></>}
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

function Assistant({ close, page, selectedContext }: { close: () => void; page: string; selectedContext: string }) {
  const conversationId = useRef("");
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [promptEventId, setPromptEventId] = useState("");
  const [brainStatus, setBrainStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ model: string; inputTokens?: number; outputTokens?: number } | null>(null);
  const [history, setHistory] = useState<AssistantHistoryMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [memoryUsed, setMemoryUsed] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "helpful" | "not_helpful" | "error">("idle");

  useEffect(() => { window.dispatchEvent(new CustomEvent("agentforge-assistant-working", { detail: loading })); }, [loading]);

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

  async function ask() {
    if (!text.trim() || loading) return;
    const promptToSend = text.trim();
    const parentPromptEventId = promptEventId || undefined;
    if (!conversationId.current) conversationId.current = crypto.randomUUID();
    setSubmittedPrompt(promptToSend); setText("");
    setLoading(true); setError(""); setAnswer(""); setUsage(null);
    setPromptEventId(""); setBrainStatus("idle"); setFeedbackStatus("idle"); setMemoryUsed(false);
    try {
      let anonymousParticipantId = sessionStorage.getItem("agentforge_participant_id");
      if (!anonymousParticipantId) { anonymousParticipantId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", anonymousParticipantId); }
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: promptToSend, page, selectedContext, anonymousParticipantId, parentPromptEventId, conversationId: conversationId.current }) });
      const result = await response.json() as { answer?: string; error?: string; model?: string; inputTokens?: number; outputTokens?: number; eventId?: string; cogneeMemoryUsed?: boolean };
      if (!response.ok || !result.answer) throw new Error(result.error || "The assistant could not answer right now.");
      setAnswer(result.answer);
      setPromptEventId(result.eventId || "");
      setUsage({ model: result.model || "OpenAI", inputTokens: result.inputTokens, outputTokens: result.outputTokens });
      setMemoryUsed(Boolean(result.cogneeMemoryUsed));
      setHistory((items) => [...items, { id: result.eventId || crypto.randomUUID(), page, userPrompt: promptToSend, responseText: result.answer, modelName: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, status: "success", createdAt: Date.now() }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not answer right now.");
    } finally {
      setLoading(false);
    }
  }

  async function addToTeamBrain() {
    if (!answer || brainStatus === "saving" || brainStatus === "saved") return;
    setBrainStatus("saving");
    let authorId = sessionStorage.getItem("agentforge_participant_id");
    if (!authorId) { authorId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", authorId); }
    try {
      const response = await fetch("/api/team-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: "team-synapse-demo", authorId, authorName: "Yuxin Ren", content: `Question: ${submittedPrompt}\n\n${answer}`, sourceType: "assistant", sourcePromptEventId: promptEventId }) });
      if (!response.ok) throw new Error("Note could not be saved.");
      setBrainStatus("saved");
    } catch { setBrainStatus("error"); }
  }

  async function saveFeedback(feedback: "helpful" | "not_helpful") {
    if (!promptEventId || feedbackStatus === "saving") return;
    let participantId = sessionStorage.getItem("agentforge_participant_id");
    if (!participantId) { participantId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", participantId); }
    setFeedbackStatus("saving");
    try {
      const response = await fetch("/api/assistant", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promptEventId, anonymousParticipantId: participantId, anonymousTeamId: "team-synapse-demo", participantDisplayName: sessionStorage.getItem("agentforge_participant_name") || "Prototype participant", feedback }) });
      if (!response.ok) throw new Error("Feedback could not be saved.");
      setFeedbackStatus(feedback);
    } catch { setFeedbackStatus("error"); }
  }

  const visibleHistory = history.filter((item) => item.id !== promptEventId);
  const hasConversation = visibleHistory.length > 0 || Boolean(submittedPrompt);
  return <div className="assistant-backdrop"><aside className="assistant"><header><div><span className="assistant-mark">✦</span><span><strong>Build Assistant</strong><small>OpenAI · Cognee memory · Prompt tracked</small></span></div><button onClick={close}>×</button></header><div className="assistant-context"><span>{selectedContext ? "SELECTED CONTEXT" : "CURRENT PAGE"}</span><p>{selectedContext ? `“${selectedContext.slice(0, 180)}${selectedContext.length > 180 ? "…" : "”"}` : page}</p><small>Highlight different text on the page to replace this context.</small></div><div className={`assistant-chat ${hasConversation ? "has-messages" : ""}`}>{historyLoading && <small className="history-status">Restoring conversation…</small>}{visibleHistory.map((item) => <div className="history-turn" key={item.id}><div className="user-message"><small>YOU · {new Date(item.createdAt).toLocaleString()}</small><p>{item.userPrompt}</p></div>{item.responseText ? <div className="answer historical"><small>OPENAI · {item.modelName || "Assistant"} · {item.page}</small><p>{item.responseText}</p><em>{item.inputTokens ?? "—"} input · {item.outputTokens ?? "—"} output tokens</em></div> : <div className="assistant-error historical"><strong>Request failed</strong><p>{item.errorCode || "No answer was recorded."}</p></div>}</div>)}{submittedPrompt && <div className="user-message"><small>YOU</small><p>{submittedPrompt}</p></div>}{loading ? <div className="assistant-loading"><span className="assistant-mark large">✦</span><h3>Thinking…</h3><p>Recalling relevant Cognee memory, then answering.</p></div> : error ? <div className="assistant-error"><strong>Couldn’t connect</strong><p>{error}</p><button onClick={() => { setText(submittedPrompt); setSubmittedPrompt(""); setError(""); }}>Edit and retry</button></div> : answer ? <div className="answer"><small>OPENAI · {usage?.model} · {memoryUsed ? "COGNEE MEMORY USED" : "NO MATCHING MEMORY"}</small><p>{answer}</p>{usage && <em>{usage.inputTokens ?? "—"} input · {usage.outputTokens ?? "—"} output tokens</em>}<div><button className={feedbackStatus === "helpful" ? "feedback-selected" : ""} onClick={() => void saveFeedback("helpful")} disabled={feedbackStatus === "saving"}>{feedbackStatus === "helpful" ? "✓ Helpful" : "Helpful"}</button><button className={feedbackStatus === "not_helpful" ? "feedback-selected negative" : ""} onClick={() => void saveFeedback("not_helpful")} disabled={feedbackStatus === "saving"}>{feedbackStatus === "not_helpful" ? "✓ Not helpful" : "Not helpful"}</button><button onClick={() => void addToTeamBrain()} disabled={brainStatus === "saving" || brainStatus === "saved"}>{brainStatus === "saving" ? "Saving…" : brainStatus === "saved" ? "✓ Added to shared space" : brainStatus === "error" ? "Try adding again" : "＋ Add to shared space"}</button></div>{feedbackStatus === "saving" && <small className="feedback-confirmation">Saving feedback…</small>}{feedbackStatus === "error" && <small className="feedback-confirmation error">Feedback was not saved. Please try again.</small>}{(feedbackStatus === "helpful" || feedbackStatus === "not_helpful") && <small className="feedback-confirmation">Feedback saved and linked to this response.</small>}</div> : !hasConversation && !historyLoading ? <><span className="assistant-mark large">✦</span><h3>What would you like to understand?</h3><p>I’ll use this page, selected text, and relevant Cognee memory. Don’t include API keys or sensitive information.</p></> : null}</div><footer><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="Ask a follow-up…" rows={3} /><button onClick={() => void ask()} disabled={loading || !text.trim()}>↑</button><small>Conversation history is restored from Prompt Tracking. Never paste credentials.</small></footer></aside></div>;
}
