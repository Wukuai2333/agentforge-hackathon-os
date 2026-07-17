"use client";

import { useEffect, useMemo, useState } from "react";

type View = "home" | "onboarding" | "learn" | "clawmaxTutorial" | "cogneeTutorial" | "progress" | "demo" | "team" | "admin" | "settings";

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

export function HackathonPortal() {
  const [view, setView] = useState<View>("home");
  const [done, setDone] = useState<number[]>([0, 1, 2]);
  const [assistant, setAssistant] = useState(false);
  const [assistantContext, setAssistantContext] = useState("");
  const [surveyStep, setSurveyStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [surveyAnswers, setSurveyAnswers] = useState<string[]>([]);
  const [keySaved, setKeySaved] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<number | null>(null);
  const progress = Math.round((done.length / milestones.length) * 100);
  const surveyQuestions = [
    "What recurring problem in your life would you most like an agent to solve?",
    "How do you handle this today, and where does the workflow break down?",
    "What information may the agent access—and what must stay off limits?",
    "What observable result would prove the agent is useful?",
    "What should the agent remember between sessions?",
  ];

  const title = useMemo(() => view === "team" ? "Team Space" : nav.find((item) => item.id === view)?.label ?? "Overview", [view]);

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
    <div className="app-shell" onMouseUp={() => {
      const selected = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
      if (selected && selected.length > 2) { setAssistantContext(selected); setAssistant(true); }
    }}>
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("home")} aria-label="AgentForge home">
          <span className="brand-mark">A</span>
          <span><strong>AgentForge</strong><small>HACKATHON OS</small></span>
        </button>

        <div className="event-chip"><span className="live-dot" /> LIVE EVENT <b>8h 14m</b></div>

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
        </nav>

        <div className="sidebar-bottom">
          <button className={view === "settings" ? "nav-item active" : "nav-item"} onClick={() => setView("settings")}><Icon>⚙</Icon>Settings</button>
          <div className="profile"><span className="avatar">YR</span><span><strong>Yuxin Ren</strong><small>Team Synapse</small></span><button aria-label="More profile options">•••</button></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p>PERSONAL AGENT HACKATHON</p><h1>{title}</h1></div>
          <div className="top-actions"><span className="connection"><i /> Systems connected</span><button className="ask-button" onClick={() => setAssistant(true)}>✦ Ask AI</button></div>
        </header>

        <section className="content">
          {view === "home" && <Overview progress={progress} setView={setView} />}
          {view === "onboarding" && (
            <AgentCanvas surveyStep={surveyStep} questions={surveyQuestions} answer={answer} setAnswer={setAnswer} next={nextSurvey} answers={surveyAnswers} savedProjectId={savedProjectId} onSaved={(id) => { setSavedProjectId(id); setDone((items) => items.includes(0) ? items : [...items, 0]); setSelectedMilestone(0); setView("progress"); }} />
          )}
          {view === "learn" && <LearningCenter setAssistant={setAssistant} setView={setView} />}
          {view === "clawmaxTutorial" && <ClawMaxTutorial />}
          {view === "cogneeTutorial" && <CogneeTutorial setAssistant={setAssistant} />}
          {view === "progress" && <Progress milestones={milestones} done={done} toggle={toggleMilestone} progress={progress} selected={selectedMilestone} setSelected={setSelectedMilestone} />}
          {view === "demo" && <Demo />}
          {view === "team" && <TeamSpace />}
          {view === "admin" && <Admin />}
          {view === "settings" && <Settings keySaved={keySaved} setKeySaved={setKeySaved} />}
        </section>
      </main>

      {assistant && <Assistant close={() => setAssistant(false)} page={title} selectedContext={assistantContext} />}
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

type SharedNote = { id: string; authorName: string; content: string; sourceType: "manual" | "assistant"; createdAt: number };

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
      {tab === "notes" && <div className="shared-notes"><div className="note-composer"><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} placeholder="Add a useful decision, finding, reminder, or AI answer for your team…" /><div><small>Visible to everyone in Team Synapse</small><button className="primary" onClick={() => void addNote()} disabled={!noteDraft.trim()}>＋ Add note</button></div></div>{noteError && <p className="form-error">{noteError}</p>}{notesLoading ? <p className="notes-empty">Loading shared notes…</p> : notes.length === 0 ? <p className="notes-empty">No shared notes yet. Add the first note here or save an AI answer from the Assistant.</p> : <div className="note-list">{notes.map((note) => <article key={note.id}><header><span className="member-avatar violet">{note.authorName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{note.authorName}</strong><small>{new Date(note.createdAt).toLocaleString()} · {note.sourceType === "assistant" ? "Saved from AI Assistant" : "Added by team member"}</small></div><span className={note.sourceType === "assistant" ? "note-source ai" : "note-source"}>{note.sourceType === "assistant" ? "AI NOTE" : "TEAM NOTE"}</span></header><p>{note.content}</p></article>)}</div>}</div>}
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
};

function Admin() {
  const [code, setCode] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [data, setData] = useState<OrganizerData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<OrganizerData["prompts"][number] | null>(null);

  async function loadOrganizer(candidate = accessCode) {
    if (!candidate) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/organizer", { headers: { "x-organizer-code": candidate } });
      const result = await response.json() as OrganizerData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Organizer data could not be loaded.");
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
    <div className="live-admin-grid"><section className="usage-panel"><div className="table-title"><div><h3>Hourly Token Trend</h3><p>Last 24 recorded hours</p></div></div><div className="usage-bars">{data.hourly.length ? data.hourly.map((item) => { const max = Math.max(...data.hourly.map((point) => Number(point.tokens)), 1); return <div key={item.hour} title={`${item.hour}: ${item.tokens} tokens`}><i style={{ height: `${Math.max(6, Number(item.tokens) / max * 100)}%` }} /><small>{item.hour.slice(11, 16)}</small></div>; }) : <p>No token data yet.</p>}</div></section><section className="usage-panel"><div className="table-title"><div><h3>Usage by Page & Step</h3><p>Where participants ask and fail</p></div></div><div className="compact-rows">{data.pages.map((item) => <div key={`${item.page}-${item.tutorialStep}`}><span><strong>{item.page}</strong><small>{item.tutorialStep || "General page"}</small></span><b>{item.prompts} prompts</b><em>{item.errors} errors</em><small>{Number(item.tokens).toLocaleString()} tokens</small></div>)}</div></section></div>
    <section className="prompt-monitor"><div className="table-title"><div><h3>Recent Prompts</h3><p>Latest 100 · click a row to inspect the masked prompt and response</p></div><span>Protected organizer data</span></div><div className="prompt-table"><div className="prompt-row heading"><span>TIME</span><span>PAGE</span><span>PROMPT</span><span>TOKENS</span><span>STATUS</span></div>{data.prompts.map((item) => <button className="prompt-row" key={item.id} onClick={() => setSelectedPrompt(item)}><span>{new Date(item.createdAt).toLocaleTimeString()}</span><span>{item.page}</span><span>{item.userPrompt}</span><span>{Number(item.inputTokens || 0) + Number(item.outputTokens || 0)}</span><span className={`pill ${item.status === "success" ? "on-track" : "blocked"}`}>{item.status}</span></button>)}</div></section>
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
    setPromptEventId(""); setBrainStatus("idle");
    try {
      let anonymousParticipantId = sessionStorage.getItem("agentforge_participant_id");
      if (!anonymousParticipantId) { anonymousParticipantId = crypto.randomUUID(); sessionStorage.setItem("agentforge_participant_id", anonymousParticipantId); }
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: promptToSend, page, selectedContext, anonymousParticipantId }) });
      const result = await response.json() as { answer?: string; error?: string; model?: string; inputTokens?: number; outputTokens?: number; eventId?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || "The assistant could not answer right now.");
      setAnswer(result.answer);
      setPromptEventId(result.eventId || "");
      setUsage({ model: result.model || "OpenAI", inputTokens: result.inputTokens, outputTokens: result.outputTokens });
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

  const visibleHistory = history.filter((item) => item.id !== promptEventId);
  const hasConversation = visibleHistory.length > 0 || Boolean(submittedPrompt);
  return <div className="assistant-backdrop" onClick={close}><aside className="assistant" onClick={(e) => e.stopPropagation()}><header><div><span className="assistant-mark">✦</span><span><strong>Build Assistant</strong><small>OpenAI · History saved · Prompt tracked</small></span></div><button onClick={close}>×</button></header><div className="assistant-context"><span>{selectedContext ? "SELECTED CONTEXT" : "CURRENT PAGE"}</span><p>{selectedContext ? `“${selectedContext.slice(0, 180)}${selectedContext.length > 180 ? "…" : "”"}` : page}</p></div><div className={`assistant-chat ${hasConversation ? "has-messages" : ""}`}>{historyLoading && <small className="history-status">Restoring conversation…</small>}{visibleHistory.map((item) => <div className="history-turn" key={item.id}><div className="user-message"><small>YOU · {new Date(item.createdAt).toLocaleString()}</small><p>{item.userPrompt}</p></div>{item.responseText ? <div className="answer historical"><small>OPENAI · {item.modelName || "Assistant"} · {item.page}</small><p>{item.responseText}</p><em>{item.inputTokens ?? "—"} input · {item.outputTokens ?? "—"} output tokens</em></div> : <div className="assistant-error historical"><strong>Request failed</strong><p>{item.errorCode || "No answer was recorded."}</p></div>}</div>)}{submittedPrompt && <div className="user-message"><small>YOU</small><p>{submittedPrompt}</p></div>}{loading ? <div className="assistant-loading"><span className="assistant-mark large">✦</span><h3>Thinking…</h3><p>Using this page and your question.</p></div> : error ? <div className="assistant-error"><strong>Couldn’t connect</strong><p>{error}</p><button onClick={() => { setText(submittedPrompt); setSubmittedPrompt(""); setError(""); }}>Edit and retry</button></div> : answer ? <div className="answer"><small>OPENAI · {usage?.model}</small><p>{answer}</p>{usage && <em>{usage.inputTokens ?? "—"} input · {usage.outputTokens ?? "—"} output tokens</em>}<div><button>Helpful</button><button>Not helpful</button><button onClick={() => void addToTeamBrain()} disabled={brainStatus === "saving" || brainStatus === "saved"}>{brainStatus === "saving" ? "Saving…" : brainStatus === "saved" ? "✓ Added to team brain" : brainStatus === "error" ? "Try adding again" : "＋ Add to team brain"}</button></div></div> : !hasConversation && !historyLoading ? <><span className="assistant-mark large">✦</span><h3>What would you like to understand?</h3><p>I’ll use this page and the selected text. Don’t include API keys or sensitive information.</p></> : null}</div><footer><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="Ask a follow-up…" rows={3} /><button onClick={() => void ask()} disabled={loading || !text.trim()}>↑</button><small>Conversation history is restored from Prompt Tracking. Never paste credentials.</small></footer></aside></div>;
}
