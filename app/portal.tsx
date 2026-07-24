"use client";

import { useEffect, useMemo, useState } from "react";

type View = "home" | "onboarding" | "learn" | "clawmaxTutorial" | "cogneeTutorial" | "progress" | "demo" | "team" | "admin" | "eventAdmin" | "settings";

const nav: Array<{ id: View; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "Overview" },
  { id: "onboarding", icon: "✦", label: "Agent Canvas" },
  { id: "learn", icon: "▤", label: "Learning Center" },
  { id: "progress", icon: "◎", label: "Build Progress" },
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
  { n: "03", title: "Give your agent memory", meta: "18 min · Cognee", status: "Start", color: "blue" },
  { n: "04", title: "Recall the right context", meta: "15 min · Cognee", status: "Locked", color: "orange" },
  { n: "05", title: "Evaluate and improve", meta: "16 min · Evaluation", status: "Locked", color: "pink" },
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
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
  const [done, setDone] = useState<number[]>([0, 1, 2]);
  const [assistant, setAssistant] = useState(false);
  const [assistantOpened, setAssistantOpened] = useState(false);
  const [assistantWorking, setAssistantWorking] = useState(false);
  const [viewRestored, setViewRestored] = useState(false);
  const [assistantContext, setAssistantContext] = useState("");
  const [surveyStep, setSurveyStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [surveyAnswers, setSurveyAnswers] = useState<string[]>([]);
  const [keySaved, setKeySaved] = useState(false);
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
    const validViews: View[] = ["home", "onboarding", "learn", "clawmaxTutorial", "cogneeTutorial", "progress", "demo", "team", "admin", "eventAdmin", "settings"];
    const requested = window.location.hash.replace(/^#\/?/, "") || window.localStorage.getItem("agentforge_current_view") || "home";
    const restoreTimer = window.setTimeout(() => { if (validViews.includes(requested as View)) setView(requested as View); setViewRestored(true); }, 0);
    const onHashChange = () => { const next = window.location.hash.replace(/^#\/?/, ""); if (validViews.includes(next as View)) setView(next as View); };
    window.addEventListener("hashchange", onHashChange);
    return () => { window.clearTimeout(restoreTimer); window.removeEventListener("hashchange", onHashChange); };
  }, []);

  useEffect(() => {
    if (!viewRestored) return;
    window.localStorage.setItem("agentforge_current_view", view);
    const nextHash = `#/${view}`;
    if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
  }, [view, viewRestored]);

  useEffect(() => {
    const updateWorking = (event: Event) => setAssistantWorking(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("agentforge-assistant-working", updateWorking);
    return () => window.removeEventListener("agentforge-assistant-working", updateWorking);
  }, []);

  useEffect(() => { const refresh = async () => { try { const response = await fetch(`/api/event?updated=${Date.now()}`); const result = await response.json() as { config?: EventConfig; publishedAnnouncements?: PublishedAnnouncement[] }; if (response.ok) { setEventConfig(result.config || null); setPublishedAnnouncements(result.publishedAnnouncements || []); } } catch { /* current configuration remains visible during a temporary network failure */ } }; const timer = window.setTimeout(() => void refresh(), 0); const interval = window.setInterval(() => void refresh(), 30000); return () => { window.clearTimeout(timer); window.clearInterval(interval); }; }, []);

  function openAssistant() { setAssistantOpened(true); setAssistant(true); }

  const title = useMemo(() => view === "team" ? "Team Space" : view === "eventAdmin" ? "Event Management" : nav.find((item) => item.id === view)?.label ?? "Overview", [view]);

  function toggleMilestone(index: number) {
    setDone((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  }

  function nextSurvey() {
    if (!answer.trim()) return;
    setSurveyAnswers((items) => [...items, answer.trim()]);
    setAnswer("");
    setSurveyStep((step) => Math.min(step + 1, surveyQuestions.length));
  }

  return (
    <div className="app-shell" onMouseUp={(event) => {
      if (view === "admin" || view === "eventAdmin") return;
      if ((event.target as HTMLElement).closest("input, textarea, button, a")) return;
      const selected = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
      if (selected && selected.length > 2) { setAssistantContext(selected); openAssistant(); }
    }}>
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("home")} aria-label="AgentForge home">
          <span className="brand-mark">A</span>
          <span><strong>AgentForge</strong><small>HACKATHON OS</small></span>
        </button>

        <LiveEvent config={eventConfig} />

        <nav aria-label="Main navigation">
          <p className="nav-label">YOUR HACKATHON</p>
          {nav.map((item) => (
            <button key={item.id} className={`${view === item.id ? "nav-item active" : "nav-item"}${item.id === "progress" || item.id === "demo" ? " mobile-core" : ""}`} onClick={() => setView(item.id)}>
              <Icon>{item.icon}</Icon>{item.label}
              {item.id === "progress" && <span className="nav-badge">{done.length}/{milestones.length}</span>}
            </button>
          ))}
          <p className="nav-label">TEAM SPACE</p>
          <button className={view === "team" ? "nav-item active" : "nav-item"} onClick={() => setView("team")}><Icon>♧</Icon>Shared Brain<span className="status-dot on" /></button>
          <button className={view === "admin" ? "nav-item active" : "nav-item"} onClick={() => setView("admin")}><Icon>▥</Icon>Organizer View</button>
          <button className={view === "eventAdmin" ? "nav-item active" : "nav-item"} onClick={() => setView("eventAdmin")}><Icon>◷</Icon>Event Management</button>
        </nav>

        <div className="sidebar-bottom">
          <button className={view === "settings" ? "nav-item active" : "nav-item"} onClick={() => setView("settings")}><Icon>⚙</Icon>Settings</button>
          <div className="profile"><span className="avatar">YR</span><span><strong>Yuxin Ren</strong><small>Team Synapse</small></span><button aria-label="More profile options">•••</button></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p>{(eventConfig?.eventName || "Personal Agent Hackathon").toUpperCase()}</p><h1>{title}</h1></div>
          <div className="top-actions"><span className="connection"><i /> Systems connected</span><button className="ask-button" onClick={openAssistant}>✦ Ask AI</button></div>
        </header>
        {eventConfig?.announcementActive && eventConfig.announcementText && <div className="global-announcement" role="status"><span>EVENT ANNOUNCEMENT</span><p>{eventConfig.announcementText}</p><small>{eventConfig.announcementUpdatedAt ? `Updated ${new Date(Number(eventConfig.announcementUpdatedAt)).toLocaleString()}` : "Organizer broadcast"}</small><button type="button" onClick={() => setAnnouncementHistoryOpen(true)} aria-haspopup="dialog">View history →</button></div>}

        <section className="content">
          {view === "home" && <Overview progress={progress} setView={setView} />}
          {view === "onboarding" && (
            <AgentCanvas surveyStep={surveyStep} questions={surveyQuestions} answer={answer} setAnswer={setAnswer} next={nextSurvey} answers={surveyAnswers} savedProjectId={savedProjectId} onSaved={(id) => { setSavedProjectId(id); setDone((items) => items.includes(0) ? items : [...items, 0]); setSelectedMilestone(0); setView("progress"); }} />
          )}
          {view === "learn" && <LearningCenter setAssistant={(open) => { if (open) openAssistant(); else setAssistant(false); }} setView={setView} />}
          {view === "clawmaxTutorial" && <ClawMaxTutorial />}
          {view === "cogneeTutorial" && <CogneeTutorial setAssistant={(open) => { if (open) openAssistant(); else setAssistant(false); }} />}
          {view === "progress" && <Progress milestones={milestones} done={done} toggle={toggleMilestone} progress={progress} selected={selectedMilestone} setSelected={setSelectedMilestone} />}
          {view === "demo" && <Demo />}
          {view === "team" && <TeamSpace />}
          {view === "admin" && <Admin />}
          {view === "eventAdmin" && <EventManagement config={eventConfig} onSaved={setEventConfig} />}
          {view === "settings" && <Settings keySaved={keySaved} setKeySaved={setKeySaved} />}
        </section>
      </main>

      {assistantOpened && <div className={assistant ? "assistant-mounted" : "assistant-mounted hidden"}><Assistant close={() => setAssistant(false)} page={title} selectedContext={assistantContext} /></div>}
      {assistantOpened && !assistant && <button className={`assistant-minimized ${assistantWorking ? "working" : ""}`} onClick={() => setAssistant(true)} aria-label={assistantWorking ? "AI is still thinking. Reopen assistant" : "Reopen AI Assistant"}><span className="assistant-mini-orb">✦</span><span><strong>{assistantWorking ? "AI is thinking…" : "AI Assistant"}</strong><small>{assistantWorking ? "You can keep working" : "Click to reopen"}</small></span></button>}
      {announcementHistoryOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setAnnouncementHistoryOpen(false)}><section className="participant-announcement-history" role="dialog" aria-modal="true" aria-labelledby="announcement-history-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">EVENT UPDATES</span><h2 id="announcement-history-title">Published announcements</h2></div><button type="button" onClick={() => setAnnouncementHistoryOpen(false)} aria-label="Close announcement history">×</button></header><div>{publishedAnnouncements.length ? publishedAnnouncements.map((item) => <article key={item.id}><small>{new Date(item.createdAt).toLocaleString()}</small><p>{item.announcementText}</p></article>) : <p className="notes-empty">No earlier published announcements yet.</p>}</div></section></div>}
    </div>
  );
}

function Overview({ progress, setView }: { progress: number; setView: (view: View) => void }) {
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
      <button className="move-card accent-violet" onClick={() => setView("learn")}><span className="move-icon">⌁</span><small>LEARN · 18 MIN</small><h4>Give your agent<br />long-term memory</h4><p>Add → Cognify → Search</p><b>Start tutorial →</b></button>
      <button className="move-card accent-lime" onClick={() => setView("progress")}><span className="move-icon">✓</span><small>BUILD · MILESTONE 04</small><h4>Store your first<br />useful memory</h4><p>Prove recall with one test.</p><b>Open milestone →</b></button>
      <button className="move-card accent-orange" onClick={() => setView("demo")}><span className="move-icon">◇</span><small>PREP · MIDPOINT</small><h4>Define how you’ll<br />measure success</h4><p>Make improvement visible.</p><b>Create evaluation →</b></button>
    </div>
    <article className="team-strip"><div><span className="team-logo">S</span><div><small>TEAM SYNAPSE</small><h4>Your shared brain is active</h4></div></div><div className="team-stats"><span><b>3</b><small>MEMBERS</small></span><span><b>24</b><small>MEMORIES</small></span><span><b>7</b><small>QUESTIONS</small></span></div><button onClick={() => setView("team")}>Open team space →</button></article>
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
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Describe a specific moment, not a broad category…" rows={6} />
        <div className="question-footer"><small>ClawMax will use this answer to choose the next question.</small><button className="primary" onClick={next}>Continue →</button></div>
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
        <span className="library-mark">◎</span><span className="library-status available">DEMO AVAILABLE</span>
        <small>COGNEE · FIVE-STEP MEMORY LOOP</small><h3>Give your agent long-term memory</h3>
        <p>Practice Add, Cognify, Search, Feedback, and Improve in one guided walkthrough with expected evidence.</p>
        <b>Start demo tutorial →</b>
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
  const steps = [
    { n: "01", action: "ADD", title: "Give Cognee something to remember", detail: "Add one short, trusted source to a project dataset. In the real hackathon this can be text, a document, or another supported source.", code: `await cognee.add(\n  "Team preferences: concise plans, no meeting conflicts.",\n  dataset_name="team_synapse"\n)` },
    { n: "02", action: "COGNIFY", title: "Build structured memory", detail: "Cognify processes the added source into searchable entities, relationships, chunks, and embeddings. The real page will show pipeline status and errors.", code: `await cognee.cognify(\n  datasets=["team_synapse"]\n)` },
    { n: "03", action: "SEARCH", title: "Recall the right context", detail: "Ask a question whose answer exists in the saved source. A successful result should include an answer and enough source context to verify it.", code: `results = await cognee.search(\n  "How does the team prefer plans?",\n  datasets=["team_synapse"]\n)` },
    { n: "04", action: "FEEDBACK", title: "Record whether recall helped", detail: "The participant marks the result helpful or not helpful and records what was missing. This becomes evidence for improving the agent and tutorial.", code: `feedback = {\n  "helpful": true,\n  "note": "Found the correct preference"\n}` },
    { n: "05", action: "IMPROVE", title: "Use feedback in the next run", detail: "Update the source, retrieval settings, or agent workflow, then repeat the same evaluation question and compare the result.", code: `# Repeat the same test\n# Compare before vs. after\n# Save the improvement evidence` },
  ];
  const current = steps[step];
  return <>
    <div className="demo-notice"><span>DEMO TUTORIAL</span><div><strong>This walkthrough demonstrates the intended participant experience.</strong><p>Buttons and results are illustrative. The real version will call the configured Cognee service, use authenticated team datasets, and record progress events.</p></div></div>
    <div className="cognee-head"><div><span className="eyebrow">COGNEE MEMORY LOOP</span><h2>Remember. Connect. Recall. Improve.</h2><p>Complete one small memory loop before adding more data or building multiple agents.</p></div><button className="outline-button" onClick={() => setAssistant(true)}>✦ Ask about this tutorial</button></div>
    <div className="cognee-tutorial-layout"><nav className="tutorial-step-nav" aria-label="Cognee tutorial steps">{steps.map((item, index) => <button key={item.n} className={step === index ? "active" : ""} onClick={() => setStep(index)}><b>{item.n}</b><span><small>{item.action}</small>{item.title}</span>{index < step && <i>✓</i>}</button>)}</nav>
    <section className="tutorial-workspace"><div className="workspace-meta"><span>STEP {current.n} OF 05</span><b>~5 MIN</b></div><span className="action-chip">{current.action}</span><h2>{current.title}</h2><p>{current.detail}</p><div className="code-demo"><header><span>PYTHON · DEMO</span><button>Copy</button></header><pre>{current.code}</pre></div><div className="demo-result"><span>EXPECTED REAL-HACKATHON EVIDENCE</span><p>{step === 0 && "A memory record with dataset, owner, source, and sharing scope."}{step === 1 && "A completed pipeline run with processing duration and any error details."}{step === 2 && "A retrieved answer with source context and a repeatable test question."}{step === 3 && "Helpful/not-helpful feedback linked to the exact search result."}{step === 4 && "Before/after results showing whether the same evaluation improved."}</p></div><footer><button className="outline-button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>← Previous</button><button className="primary" disabled={step === steps.length - 1} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Next step →</button></footer></section>
    <aside className="tutorial-reality"><span>HOW THIS BECOMES REAL</span><h3>Demo now. Connected workflow later.</h3>{["Participant signs in and selects a Team/Project dataset.", "AgentForge calls Cognee through the backend—never directly with a secret in the browser.", "Pipeline events automatically verify tutorial and milestone progress.", "Every answer shows its memory source and sharing scope.", "Feedback and repeated tests become improvement evidence."].map((item, i) => <div key={item}><b>{i + 1}</b><p>{item}</p></div>)}<a href="https://docs.cognee.ai" target="_blank" rel="noreferrer">Open official Cognee docs ↗</a></aside></div>
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
type SharedNote = { id: string; authorName: string; content: string; sourceType: "manual" | "assistant"; attributionJson?: string; updatedByName?: string; updatedAt?: number; createdAt: number };

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

function SharedNoteCard({ note, onUpdated }: { note: SharedNote; onUpdated: (note: SharedNote) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editorName = "Yuxin Ren";
  async function save() {
    if (!draft.trim() || draft.trim() === note.content) { setEditing(false); return; }
    setSaving(true); setError("");
    let authorId = sessionStorage.getItem("agentforge_participant_id");
    if (!authorId) { authorId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", authorId); }
    const attributionJson = JSON.stringify(attributeEdit(note, draft.trim(), editorName));
    try {
      const response = await fetch("/api/team-notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: note.id, teamId: "team-synapse-demo", authorId, authorName: editorName, content: draft, attributionJson }) });
      const result = await response.json() as { note?: Partial<SharedNote>; error?: string };
      if (!response.ok || !result.note) throw new Error(result.error || "Note could not be updated.");
      onUpdated({ ...note, ...result.note, attributionJson }); setEditing(false);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Note could not be updated."); }
    finally { setSaving(false); }
  }
  return <article><header><span className={`member-avatar ${colorForMember(note.authorName)}`}>{note.authorName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{note.authorName}</strong><small>{new Date(note.createdAt).toLocaleString()} · {note.updatedAt ? `Edited by ${note.updatedByName} ${new Date(note.updatedAt).toLocaleString()}` : note.sourceType === "assistant" ? "Saved from AI Assistant" : "Added by team member"}</small></div><span className={note.sourceType === "assistant" ? "note-source ai" : "note-source"}>{note.sourceType === "assistant" ? "AI NOTE" : "TEAM NOTE"}</span><button className="note-edit-button" onClick={() => { setDraft(note.content); setEditing(true); }}>Edit</button></header>{editing ? <div className="note-editor"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} /><div>{error && <small className="form-error">{error}</small>}<button className="text-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary" onClick={() => void save()} disabled={saving || !draft.trim()}>{saving ? "Saving…" : "Save changes"}</button></div></div> : <p className="attributed-note">{noteAttributions(note).map((part, index) => <span key={`${part.editorName}-${index}`} className={`note-attribution ${part.color}`} title={`${part.editorName} added or edited this text`}>{part.text}</span>)}</p>}</article>;
}

function TeamSpace() {
  const [tab, setTab] = useState<"activity" | "notes" | "memories" | "questions">("notes");
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteError, setNoteError] = useState("");
  const activity = [
    { avatar: "YR", color: "violet", person: "Yuxin", action: "saved an Agent Canvas", detail: "Personal knowledge continuity agent", meta: "2 min ago · Visible to Team Synapse", icon: "✦" },
    { avatar: "AM", color: "orange", person: "Amina", action: "shared a memory", detail: "User interview notes — planning pain points", meta: "18 min ago · Cognee / team-synapse", icon: "▤" },
    { avatar: "JL", color: "blue", person: "Jason", action: "completed a milestone", detail: "First agent working", meta: "31 min ago · Evidence attached", icon: "✓" },
    { avatar: "AM", color: "orange", person: "Amina", action: "asked the team brain", detail: "What preferences did our interviews reveal?", meta: "44 min ago · 3 sources used", icon: "?" },
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
    <div className="demo-notice"><span>DEMO VIEW</span><div><strong>This is an example of Team Space before real participant data exists.</strong><p>During the hackathon, this page will populate only when team members save canvases, share memories, ask the team brain, or complete milestones.</p></div></div>
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

type OrganizerData = {
  summary: { totalPrompts: number; inputTokens: number; outputTokens: number; successRate: number; avgLatencyMs: number; lastHour: number };
  hourly: Array<{ hour: string; prompts: number; tokens: number }>;
  pages: Array<{ page: string; tutorialStep?: string; prompts: number; errors: number; tokens: number }>;
  teams: Array<{ teamId: string; prompts: number; tokens: number }>;
  prompts: Array<{ id: string; participantId: string; teamId?: string; page: string; userPrompt: string; responseText?: string; modelName?: string; latencyMs?: number; inputTokens?: number; outputTokens?: number; status: string; errorCode?: string; createdAt: number }>;
  settings: { assistantEnabled: number; defaultTeamTokenQuota: number };
  cognee: { connected: boolean; sync: Array<{ status: string; count: number }> };
  participantModel: Array<{ entryKind: string; count: number }>;
  learningSignals: Array<{ id: string; page: string; tutorialStep?: string; promptCount: number; participantCount: number; errorCount: number; negativeFeedbackCount: number; detectionRule: string; cogneeSummary?: string; reviewStatus: string; createdAt: number }>;
  feedbacks: Array<{ id: string; promptEventId: string; participantId: string; teamId?: string | null; participantDisplayName: string; feedback: "helpful" | "not_helpful"; page: string; tutorialStep?: string | null; userPrompt: string; createdAt: number }>;
  promptEvaluations: Array<{ id: string; promptEventId: string; rubricVersion: string; evaluator: string; evaluationJson: string; totalScore?: number | null; createdAt: number; participantId: string; page: string; userPrompt: string }>;
};

type RegisteredParticipant = { id: string; displayName: string; email?: string | null; role: string; status: string; joinedAt: number; teamName?: string | null };
type AnnouncementHistoryItem = { id: string; announcementText?: string | null; action: "published" | "updated" | "withdrawn"; active: number | boolean; editorName: string; createdAt: number };
const toLocalInput = (value?: number | null) => value ? new Date(Number(value) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

function EventManagement({ config, onSaved }: { config: EventConfig | null; onSaved: (config: EventConfig) => void }) {
  const [code, setCode] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [participants, setParticipants] = useState<RegisteredParticipant[]>([]);
  const [announcementHistory, setAnnouncementHistory] = useState<AnnouncementHistoryItem[]>([]);
  const [showAnnouncementHistory, setShowAnnouncementHistory] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ eventName: config?.eventName || "Personal Agent Hackathon", startsAt: toLocalInput(config?.startsAt), endsAt: toLocalInput(config?.endsAt), timezone: config?.timezone || "America/New_York", discordUrl: config?.discordUrl || "", announcementText: config?.announcementText || "", announcementActive: config?.announcementActive === true || config?.announcementActive === 1, registrationOpen: config?.registrationOpen !== false && config?.registrationOpen !== 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function open(candidate = accessCode) {
    if (!candidate) return;
    setError("");
    const response = await fetch("/api/event", { headers: { "x-organizer-code": candidate } });
    const result = await response.json() as { config?: EventConfig; participants?: RegisteredParticipant[]; announcementHistory?: AnnouncementHistoryItem[]; error?: string };
    if (!response.ok) { setError(response.status === 401 ? "Organizer code false. Please enter the correct access code." : result.error || "Event management could not be loaded."); return; }
    setAccessCode(candidate); setCode(candidate); sessionStorage.setItem("agentforge_organizer_code", candidate); setParticipants(result.participants || []); setAnnouncementHistory(result.announcementHistory || []);
    if (result.config) { onSaved(result.config); setForm({ eventName: result.config.eventName || "Personal Agent Hackathon", startsAt: toLocalInput(result.config.startsAt), endsAt: toLocalInput(result.config.endsAt), timezone: result.config.timezone || "America/New_York", discordUrl: result.config.discordUrl || "", announcementText: result.config.announcementText || "", announcementActive: result.config.announcementActive === true || result.config.announcementActive === 1, registrationOpen: result.config.registrationOpen !== false && result.config.registrationOpen !== 0 }); }
  }

  useEffect(() => { const saved = sessionStorage.getItem("agentforge_organizer_code"); if (!saved) return; const timer = window.setTimeout(() => void open(saved), 0); return () => window.clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true); setError("");
    const next: EventConfig = { eventName: form.eventName, startsAt: form.startsAt ? new Date(form.startsAt).getTime() : null, endsAt: form.endsAt ? new Date(form.endsAt).getTime() : null, timezone: form.timezone, discordUrl: form.discordUrl, announcementText: form.announcementText, announcementActive: form.announcementActive, announcementUpdatedAt: Date.now(), registrationOpen: form.registrationOpen };
    try {
      const response = await fetch("/api/event", { method: "PUT", headers: { "Content-Type": "application/json", "x-organizer-code": accessCode }, body: JSON.stringify(next) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Event settings could not be saved.");
      onSaved(next);
      await open(accessCode);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Event settings could not be saved."); }
    finally { setSaving(false); }
  }

  if (!accessCode) return <div className="organizer-login"><span className="service-mark purple">◷</span><span className="eyebrow">PROTECTED EVENT MANAGEMENT</span><h2>Manage the live event.</h2><p>Use the same Organizer Access Code as the Prompt & Memory portal.</p><label>ORGANIZER ACCESS CODE<input type="password" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void open(code); }} /></label>{error && <p className="form-error">{error}</p>}<button className="primary" onClick={() => void open(code)} disabled={!code}>Open event management</button></div>;

  const query = search.trim().toLowerCase();
  const filtered = participants.filter((participant) => [participant.displayName, participant.email, participant.role, participant.status, participant.teamName].some((value) => String(value || "").toLowerCase().includes(query)));
  return <div className="event-management">
    <div className="live-admin-head"><div><span className="eyebrow">LIVE OPERATIONS</span><h2>Event Management</h2><p>Controls the public countdown, announcements, Discord destination, registration state, and participant directory.</p></div><span className="pill on-track">Real event data</span></div>
    <div className="event-management-grid">
      <section className="event-settings-card"><div className="table-title"><div><h3>Schedule & Community</h3><p>Changes update participant pages after saving.</p></div></div>
        <label>EVENT NAME<input value={form.eventName} onChange={(event) => setForm({ ...form, eventName: event.target.value })} /></label>
        <div className="event-time-fields"><label>START TIME<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label>END TIME<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label></div>
        <label>TIMEZONE<input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></label>
        <label>DISCORD INVITE URL<input type="url" placeholder="https://discord.gg/…" value={form.discordUrl} onChange={(event) => setForm({ ...form, discordUrl: event.target.value })} /></label>
        <div className="announcement-editor"><div className="announcement-editor-title"><span>WEBSITE ANNOUNCEMENT</span><button type="button" onClick={() => setShowAnnouncementHistory((visible) => !visible)}>{showAnnouncementHistory ? "Hide history" : `View history (${announcementHistory.filter((item) => item.active).length})`}</button></div><textarea rows={4} maxLength={1000} placeholder="Example: Midpoint feedback starts in Room 204 at 2:30 PM." value={form.announcementText} onChange={(event) => setForm({ ...form, announcementText: event.target.value })} /><label><input type="checkbox" checked={form.announcementActive} onChange={(event) => setForm({ ...form, announcementActive: event.target.checked })} /><span><b>Publish across the website</b><small>Participants receive updates automatically within 30 seconds.</small></span></label><small>{form.announcementText.length}/1000 characters · Website only for now; Discord posting requires a secure webhook.</small>{showAnnouncementHistory && <div className="announcement-history">{announcementHistory.filter((item) => item.active).length ? announcementHistory.filter((item) => item.active).map((item) => <article key={item.id}><header><span className="pill on-track">{item.action}</span><small>{new Date(item.createdAt).toLocaleString()} · {item.editorName}</small></header><p>{item.announcementText}</p></article>) : <p className="notes-empty">No announcements have been published yet.</p>}</div>}</div>
        <label className="registration-toggle"><input type="checkbox" checked={form.registrationOpen} onChange={(event) => setForm({ ...form, registrationOpen: event.target.checked })} /><span><b>Registration open</b><small>Shown here now; enforcement will connect to the registration flow.</small></span></label>
        {error && <p className="form-error">{error}</p>}<button className="primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : form.announcementActive ? "Save & publish" : "Save event settings"}</button>
      </section>
      <aside className="event-preview-card"><span>PARTICIPANT PREVIEW</span><LiveEvent config={{ ...config, ...form, startsAt: form.startsAt ? new Date(form.startsAt).getTime() : null, endsAt: form.endsAt ? new Date(form.endsAt).getTime() : null }} />{form.announcementActive && form.announcementText && <div className="announcement-preview"><b>EVENT ANNOUNCEMENT</b><p>{form.announcementText}</p></div>}<p>The countdown and announcement use saved event data. No AI or tokens are used.</p></aside>
    </div>
    <section className="participant-directory"><div className="table-title"><div><h3>Registered Users</h3><p>{participants.length} records · authenticated registrations and current prototype participants</p></div><input type="search" placeholder="Search name, email, role, team…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="participant-table"><div className="participant-row heading"><span>NAME</span><span>EMAIL</span><span>ROLE</span><span>TEAM</span><span>STATUS</span><span>JOINED</span></div>{filtered.map((participant) => <div className="participant-row" key={participant.id}><strong>{participant.displayName}</strong><span>{participant.email || "Not collected"}</span><span>{participant.role}</span><span>{participant.teamName || "Unassigned"}</span><span className={`pill ${participant.status === "active" ? "on-track" : "needs-help"}`}>{participant.status}</span><span>{new Date(participant.joinedAt).toLocaleString()}</span></div>)}{!filtered.length && <p className="notes-empty">No registered users match this search.</p>}</div></section>
  </div>;
}

function Admin() {
  const [code, setCode] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [data, setData] = useState<OrganizerData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cogneeAction, setCogneeAction] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<OrganizerData["prompts"][number] | null>(null);

  async function loadOrganizer(candidate = accessCode) {
    if (!candidate) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/organizer", { headers: { "x-organizer-code": candidate } });
      const result = await response.json() as OrganizerData & { error?: string };
      if (!response.ok) throw new Error(response.status === 401 ? "Organizer code false. Please enter the correct access code." : result.error || "Organizer data could not be loaded.");
      setAccessCode(candidate); sessionStorage.setItem("agentforge_organizer_code", candidate); setData(result);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Organizer access failed."); }
    finally { setLoading(false); }
  }

  // Restore an organizer session once on mount; subsequent refreshes use the explicit controls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const saved = sessionStorage.getItem("agentforge_organizer_code"); if (!saved) return; const timer = window.setTimeout(() => { setCode(saved); void loadOrganizer(saved); }, 0); return () => window.clearTimeout(timer); }, []);

  async function updateSettings(assistantEnabled: boolean, quota = data?.settings.defaultTeamTokenQuota || 100000) {
    const response = await fetch("/api/organizer", { method: "PATCH", headers: { "Content-Type": "application/json", "x-organizer-code": accessCode }, body: JSON.stringify({ assistantEnabled, defaultTeamTokenQuota: quota }) });
    if (response.ok) await loadOrganizer();
  }

  async function deletePrompt(id: string) {
    const response = await fetch(`/api/organizer?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-organizer-code": accessCode } });
    if (response.ok) { setSelectedPrompt(null); await loadOrganizer(); }
  }

  async function runCognee(action: "detect" | "sync" | "analyze" | "seed_tutorials" | "grade_prompts", signalId?: string) {
    setCogneeAction(signalId ? `${action}:${signalId}` : action); setError("");
    try {
      const response = await fetch("/api/cognee", { method: "POST", headers: { "Content-Type": "application/json", "x-organizer-code": accessCode }, body: JSON.stringify({ action, signalId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Cognee action failed.");
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

  if (!data) return <div className="organizer-login"><span className="service-mark purple">▥</span><span className="eyebrow">PROTECTED ORGANIZER PORTAL</span><h2>Open the live control room.</h2><p>Only real prompts, responses, token usage, and participant activity are shown here. Enter the Organizer Access Code stored in the local environment file.</p><label>ORGANIZER ACCESS CODE<input type="password" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadOrganizer(code); }} /></label>{error && <p className="form-error">{error}</p>}<button className="primary" onClick={() => void loadOrganizer(code)} disabled={loading || !code}>{loading ? "Opening…" : "Open organizer portal"}</button></div>;

  const totalTokens = Number(data.summary.inputTokens) + Number(data.summary.outputTokens);
  const quota = Number(data.settings.defaultTeamTokenQuota);
  return <>
    <div className="live-admin-head"><div><span className="eyebrow">LIVE ORGANIZER PORTAL</span><h2>Prompt and Token Operations</h2><p>Connected to real AgentForge prompt events. Sensitive patterns are masked before display.</p></div><div><button className="outline-button" onClick={exportCsv}>Export CSV</button><button className="outline-button" onClick={() => void loadOrganizer()}>Refresh</button></div></div>
    <div className="metric-grid explained live-metrics"><article><small>TOTAL PROMPTS</small><strong>{data.summary.totalPrompts}</strong><span>{data.summary.lastHour} in the last hour</span><p>All recorded Assistant requests.</p></article><article><small>TOTAL TOKENS</small><strong>{totalTokens.toLocaleString()}</strong><span>{Number(data.summary.inputTokens).toLocaleString()} in · {Number(data.summary.outputTokens).toLocaleString()} out</span><p>Actual usage reported by OpenAI.</p></article><article><small>SUCCESS RATE</small><strong>{data.summary.successRate}%</strong><span>{100 - Number(data.summary.successRate)}% errors</span><p>Requests that returned a usable answer.</p></article><article><small>AVG. LATENCY</small><strong>{(Number(data.summary.avgLatencyMs) / 1000).toFixed(1)}s</strong><span>End-to-end response time</span><p>Includes OpenAI generation time.</p></article></div>
    <section className="admin-controls"><div><span className={data.settings.assistantEnabled ? "control-dot on" : "control-dot"} /><span><small>AI ASSISTANT</small><strong>{data.settings.assistantEnabled ? "Running" : "Paused"}</strong></span><button className={data.settings.assistantEnabled ? "danger-button" : "primary"} onClick={() => void updateSettings(!data.settings.assistantEnabled)}>{data.settings.assistantEnabled ? "Pause assistant" : "Resume assistant"}</button></div><div><span><small>DEFAULT TEAM QUOTA</small><strong>{quota.toLocaleString()} tokens</strong></span><div className="quota-bar"><i style={{ width: `${Math.min(100, (totalTokens / quota) * 100)}%` }} /></div><button className="outline-button" onClick={() => { const next = window.prompt("Default tokens per team", String(quota)); if (next) void updateSettings(Boolean(data.settings.assistantEnabled), Number(next)); }}>Edit quota</button></div></section>
    {error && <p className="form-error organizer-error">{error}</p>}
    <section className="cognee-operations"><div className="table-title"><div><span className="eyebrow">COGNEE SEMANTIC MEMORY</span><h3>Hackathon Learning Memory</h3><p>Prompts, responses, participant-model facts, project canvases, feedback, Team Brain notes, and tutorial content are organized by node set.</p></div><span className={`pill ${data.cognee.connected ? "on-track" : "needs-help"}`}>{data.cognee.connected ? "Cloud connected" : "API key required"}</span></div><div className="cognee-status-grid">{["pending", "syncing", "synced", "error"].map((status) => <div key={status}><small>{status.toUpperCase()}</small><strong>{Number(data.cognee.sync.find((item) => item.status === status)?.count || 0)}</strong><p>{status === "pending" ? "Memory events waiting for delivery." : status === "synced" ? "Events accepted and sent for graph processing." : status === "error" ? "Safe to retry; original operational records remain intact." : "Batch currently being delivered."}</p></div>)}</div><div className="cognee-actions"><button className="outline-button" onClick={() => void runCognee("seed_tutorials")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "seed_tutorials" ? "Queuing…" : "Queue tutorial memory"}</button><button className="outline-button" onClick={() => void runCognee("detect")} disabled={Boolean(cogneeAction)}>{cogneeAction === "detect" ? "Checking…" : "Detect learning signals"}</button><button className="outline-button" onClick={() => void runCognee("grade_prompts")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "grade_prompts" ? "Grading…" : "Grade prompts with Cognee"}</button><button className="primary" onClick={() => void runCognee("sync")} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === "sync" ? "Syncing…" : "Sync all pending memory"}</button></div></section>
    <section className="prompt-evaluations"><div className="table-title"><div><h3>Cognee Prompt Quality Evaluations</h3><p>AI inference using rubric v1 · every result remains linked to its raw Prompt and participant evidence</p></div><span>{data.promptEvaluations.length} graded</span></div>{data.promptEvaluations.length ? data.promptEvaluations.map((item) => <article key={item.id}><div><span className="eyebrow">SCORE</span><strong>{item.totalScore ?? "—"}<small>/24</small></strong></div><div><h4>{item.page} · {item.participantId.slice(0, 12)}…</h4><p>{item.userPrompt}</p><small>{item.rubricVersion} · {new Date(item.createdAt).toLocaleString()}</small></div><details><summary>View Cognee evaluation</summary><pre>{item.evaluationJson}</pre></details></article>) : <p className="notes-empty">No prompts have been graded yet. Sync memory first, then run Cognee grading.</p>}</section>
    <section className="learning-signal-live"><div className="table-title"><div><h3>Detected Learning Signals</h3><p>Counts are rule-based SQL facts. Cognee adds an evidence-grounded interpretation only when requested.</p></div></div>{data.learningSignals.length ? data.learningSignals.map((signal) => <article key={signal.id}><div><span className="eyebrow">{signal.reviewStatus}</span><h4>{signal.page} · {signal.tutorialStep || "General page"}</h4><p><b>{signal.promptCount}</b> prompts from <b>{signal.participantCount}</b> participants · {signal.errorCount} errors · {signal.negativeFeedbackCount} negative feedback</p><small>FACTS: calculated by {signal.detectionRule}. These counts are not generated by AI.</small></div><div className="signal-interpretation"><b>COGNEE INTERPRETATION</b><p>{signal.cogneeSummary || "Not generated yet. An organizer may request analysis after evidence has synced."}</p><small>INFERENCE: requires human review and must remain linked to its source signal.</small></div><button className="outline-button" onClick={() => void runCognee("analyze", signal.id)} disabled={Boolean(cogneeAction) || !data.cognee.connected}>{cogneeAction === `analyze:${signal.id}` ? "Analyzing…" : "Analyze with Cognee"}</button></article>) : <div className="empty-live-state"><strong>No learning signal currently crosses the threshold.</strong><p>This is a real empty state—not demo data. Run detection after participants begin asking questions.</p></div>}</section>
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

function Settings({ keySaved, setKeySaved }: { keySaved: boolean; setKeySaved: (v: boolean) => void }) {
  return <div className="settings-layout"><section><span className="eyebrow">CONNECTIONS & PRIVACY</span><h2>Keep access explicit.</h2><p>For the prototype, credentials stay in this browser session and are never included in prompt analytics.</p><article className="setting-card"><div className="setting-title"><span className="service-mark purple">C</span><div><h3>ClawMax API key</h3><p>Used to guide onboarding and answer build questions.</p></div><span className={keySaved ? "pill on-track" : "pill needs-help"}>{keySaved ? "Connected" : "Not connected"}</span></div><label>API KEY<input type="password" placeholder="clawmax_••••••••••••" /></label><div className="setting-actions"><small>Stored for this session only. Never written to prompt logs.</small><button className="primary" onClick={() => setKeySaved(true)}>Test & save</button></div></article><article className="setting-card"><div className="setting-title"><span className="service-mark green">C</span><div><h3>Cognee endpoint</h3><p>Connect a team dataset through your server-side proxy.</p></div><span className="pill on-track">Connected</span></div><label>ENDPOINT<input defaultValue="https://api.cognee.ai" /></label></article></section><aside className="privacy-card"><span>WHAT WE TRACK</span><h3>Prompt analytics, with boundaries.</h3>{["Anonymized user and team IDs", "Page and tutorial step", "Prompt and assistant response", "Model, latency, tokens, and status", "Helpful / not helpful feedback"].map((item) => <p key={item}>✓ {item}</p>)}<hr />{["Passwords or API keys", "Unselected local files", "Browsing outside this app", "Sensitive data by design"].map((item) => <p className="not-tracked" key={item}>× {item}</p>)}<button className="outline-button">Read data policy</button></aside></div>;
}

type AssistantHistoryMessage = { id: string; page: string; userPrompt: string; responseText?: string; modelName?: string; inputTokens?: number; outputTokens?: number; status: string; errorCode?: string; createdAt: number };

function Assistant({ close, page, selectedContext }: { close: () => void; page: string; selectedContext: string }) {
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
    setSubmittedPrompt(promptToSend); setText("");
    setLoading(true); setError(""); setAnswer(""); setUsage(null);
    setPromptEventId(""); setBrainStatus("idle"); setFeedbackStatus("idle"); setMemoryUsed(false);
    try {
      let anonymousParticipantId = sessionStorage.getItem("agentforge_participant_id");
      if (!anonymousParticipantId) { anonymousParticipantId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", anonymousParticipantId); }
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: promptToSend, page, selectedContext, anonymousParticipantId }) });
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
  return <div className="assistant-backdrop" onClick={close}><aside className="assistant" onClick={(e) => e.stopPropagation()}><header><div><span className="assistant-mark">✦</span><span><strong>Build Assistant</strong><small>OpenAI · Cognee memory · Prompt tracked</small></span></div><button onClick={close}>×</button></header><div className="assistant-context"><span>{selectedContext ? "SELECTED CONTEXT" : "CURRENT PAGE"}</span><p>{selectedContext ? `“${selectedContext.slice(0, 180)}${selectedContext.length > 180 ? "…" : "”"}` : page}</p></div><div className={`assistant-chat ${hasConversation ? "has-messages" : ""}`}>{historyLoading && <small className="history-status">Restoring conversation…</small>}{visibleHistory.map((item) => <div className="history-turn" key={item.id}><div className="user-message"><small>YOU · {new Date(item.createdAt).toLocaleString()}</small><p>{item.userPrompt}</p></div>{item.responseText ? <div className="answer historical"><small>OPENAI · {item.modelName || "Assistant"} · {item.page}</small><p>{item.responseText}</p><em>{item.inputTokens ?? "—"} input · {item.outputTokens ?? "—"} output tokens</em></div> : <div className="assistant-error historical"><strong>Request failed</strong><p>{item.errorCode || "No answer was recorded."}</p></div>}</div>)}{submittedPrompt && <div className="user-message"><small>YOU</small><p>{submittedPrompt}</p></div>}{loading ? <div className="assistant-loading"><span className="assistant-mark large">✦</span><h3>Thinking…</h3><p>Recalling relevant Cognee memory, then answering.</p></div> : error ? <div className="assistant-error"><strong>Couldn’t connect</strong><p>{error}</p><button onClick={() => { setText(submittedPrompt); setSubmittedPrompt(""); setError(""); }}>Edit and retry</button></div> : answer ? <div className="answer"><small>OPENAI · {usage?.model} · {memoryUsed ? "COGNEE MEMORY USED" : "NO MATCHING MEMORY"}</small><p>{answer}</p>{usage && <em>{usage.inputTokens ?? "—"} input · {usage.outputTokens ?? "—"} output tokens</em>}<div><button className={feedbackStatus === "helpful" ? "feedback-selected" : ""} onClick={() => void saveFeedback("helpful")} disabled={feedbackStatus === "saving"}>{feedbackStatus === "helpful" ? "✓ Helpful" : "Helpful"}</button><button className={feedbackStatus === "not_helpful" ? "feedback-selected negative" : ""} onClick={() => void saveFeedback("not_helpful")} disabled={feedbackStatus === "saving"}>{feedbackStatus === "not_helpful" ? "✓ Not helpful" : "Not helpful"}</button><button onClick={() => void addToTeamBrain()} disabled={brainStatus === "saving" || brainStatus === "saved"}>{brainStatus === "saving" ? "Saving…" : brainStatus === "saved" ? "✓ Added to team brain" : brainStatus === "error" ? "Try adding again" : "＋ Add to team brain"}</button></div>{feedbackStatus === "saving" && <small className="feedback-confirmation">Saving feedback…</small>}{feedbackStatus === "error" && <small className="feedback-confirmation error">Feedback was not saved. Please try again.</small>}{(feedbackStatus === "helpful" || feedbackStatus === "not_helpful") && <small className="feedback-confirmation">Feedback saved and linked to this response.</small>}</div> : !hasConversation && !historyLoading ? <><span className="assistant-mark large">✦</span><h3>What would you like to understand?</h3><p>I’ll use this page, selected text, and relevant Cognee memory. Don’t include API keys or sensitive information.</p></> : null}</div><footer><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="Ask a follow-up…" rows={3} /><button onClick={() => void ask()} disabled={loading || !text.trim()}>↑</button><small>Conversation history is restored from Prompt Tracking. Never paste credentials.</small></footer></aside></div>;
}
