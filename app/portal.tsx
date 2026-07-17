"use client";

import { useMemo, useState } from "react";

type View = "home" | "onboarding" | "learn" | "progress" | "demo" | "team" | "admin" | "settings";

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
      if (selected && selected.length > 2) setAssistant(true);
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
            <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}>
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
          {view === "learn" && <LearningCenter setAssistant={setAssistant} />}
          {view === "progress" && <Progress milestones={milestones} done={done} toggle={toggleMilestone} progress={progress} selected={selectedMilestone} setSelected={setSelectedMilestone} />}
          {view === "demo" && <Demo />}
          {view === "team" && <TeamSpace />}
          {view === "admin" && <Admin />}
          {view === "settings" && <Settings keySaved={keySaved} setKeySaved={setKeySaved} />}
        </section>
      </main>

      {assistant && <Assistant close={() => setAssistant(false)} />}
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

function LearningCenter({ setAssistant }: { setAssistant: (v: boolean) => void }) {
  return <>
    <div className="page-intro"><div><span className="eyebrow">TASK-BASED · OFFICIAL SOURCES</span><h2>Learn only what you need to build.</h2><p>Short, practical lessons connected to your milestones. Select any text on this page to ask the AI assistant.</p></div><button className="outline-button" onClick={() => setAssistant(true)}>✦ Ask about this page</button></div>
    <div className="learning-layout"><section className="lesson-list">{lessons.map((lesson, i) => <article className="lesson" key={lesson.n}><span className={`lesson-number ${lesson.color}`}>{lesson.n}</span><div><small>{lesson.meta}</small><h3>{lesson.title}</h3><div className="lesson-bar"><i style={{ width: i === 0 ? "100%" : i === 1 ? "54%" : "0%" }} /></div></div><button disabled={lesson.status === "Locked"}>{lesson.status} {lesson.status !== "Locked" && "→"}</button></article>)}</section>
    <aside className="memory-loop"><span>COGNEE MEMORY LOOP</span><h3>One loop. Five moves.</h3>{["Add / Remember data", "Cognify / Build memory", "Search / Recall", "Collect feedback", "Improve the agent"].map((item, i) => <div key={item}><b>{i + 1}</b><span>{item}</span>{i < 4 && <i>↓</i>}</div>)}<a href="https://docs.cognee.ai" target="_blank" rel="noreferrer">Open official Cognee docs ↗</a></aside></div>
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

function TeamSpace() {
  const [tab, setTab] = useState<"activity" | "memories" | "questions">("activity");
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

  return <>
    <div className="demo-notice"><span>DEMO VIEW</span><div><strong>This is an example of Team Space before real participant data exists.</strong><p>During the hackathon, this page will populate only when team members save canvases, share memories, ask the team brain, or complete milestones.</p></div></div>
    <div className="team-hero"><div><span className="team-logo large">S</span><div><span className="eyebrow">TEAM SYNAPSE · SHARED WORKSPACE</span><h2>Build with one shared context.</h2><p>See what teammates decided, contributed, tested, and learned—without merging everyone’s private information.</p></div></div><button className="outline-button">＋ Invite teammate</button></div>
    <div className="team-metric-grid"><article><small>TEAM MEMBERS</small><strong>3</strong><span>All active today</span></article><article><small>SHARED MEMORIES</small><strong>24</strong><span>3 added this hour</span></article><article><small>TEAM QUESTIONS</small><strong>7</strong><span>6 answered with sources</span></article><article><small>MILESTONES</small><strong>7/11</strong><span>Next: evaluation case</span></article></div>
    <div className="team-space-grid"><section className="team-feed"><div className="team-tabs"><div>{(["activity", "memories", "questions"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div><span>Demo data</span></div>
      {tab === "activity" && <div className="activity-list">{activity.map((item) => <article key={item.detail}><span className={`member-avatar ${item.color}`}>{item.avatar}</span><div><p><strong>{item.person}</strong> {item.action}</p><h3><span>{item.icon}</span>{item.detail}</h3><small>{item.meta}</small></div><button aria-label={`Open ${item.detail}`}>→</button></article>)}</div>}
      {tab === "memories" && <div className="shared-list">{memories.map(([title, person, detail, scope]) => <article key={title}><span className="list-icon">▤</span><div><h3>{title}</h3><p>Shared by {person} · {detail}</p></div><span className={scope === "Team" ? "scope team" : "scope private"}>{scope}</span><button>Open →</button></article>)}</div>}
      {tab === "questions" && <div className="shared-list">{questions.map(([question, person, status]) => <article key={question}><span className="list-icon">?</span><div><h3>{question}</h3><p>Asked by {person}</p></div><span className="question-status">{status}</span><button>Open →</button></article>)}</div>}
    </section>
    <aside className="real-event-guide"><span>IN THE REAL HACKATHON</span><h3>What makes something appear here?</h3><div><b>01</b><p><strong>A member chooses “Share with team.”</strong>The Canvas, memory, question, or evidence becomes visible to teammates.</p></div><div><b>02</b><p><strong>The system records the action.</strong>Who did what, when, and which tool or dataset was used appears in Activity.</p></div><div><b>03</b><p><strong>Teammates can reuse it.</strong>They can open the contribution, cite it in a question, or use it in their agent workflow.</p></div><div><b>04</b><p><strong>Private stays private.</strong>Personal drafts and memories remain hidden unless the owner explicitly changes their sharing scope.</p></div><hr /><p className="guide-note"><strong>What you see now:</strong> Yuxin, Amina, Jason, their memories, questions, and activity are illustrative demo records. Real participant actions will replace these examples after authentication, team membership, and Cognee event tracking are connected.</p></aside></div>
  </>;
}

function Admin() {
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

function Assistant({ close }: { close: () => void }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  return <div className="assistant-backdrop" onClick={close}><aside className="assistant" onClick={(e) => e.stopPropagation()}><header><div><span className="assistant-mark">✦</span><span><strong>Build Assistant</strong><small>Page-aware · Prompt tracked</small></span></div><button onClick={close}>×</button></header><div className="assistant-context"><span>SELECTED CONTEXT</span><p>“Cognify / Build memory → Search / Recall”</p></div><div className="assistant-chat">{!sent ? <><span className="assistant-mark large">✦</span><h3>What would you like to understand?</h3><p>I’ll use this page, your project stage, and the selected text. Don’t include API keys or sensitive information.</p></> : <div className="answer"><small>COGNEE · LESSON 03</small><h3>Think of Cognify as the indexing step.</h3><p>After you add data, Cognify turns it into connected, searchable memory. Your fastest success test is to add one short source, run Cognify, then ask a question whose answer exists only in that source.</p><div><button>Helpful</button><button>Not helpful</button><button>＋ Add to team brain</button></div></div>}</div><footer><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about the selected text…" rows={3} /><button onClick={() => { if (text.trim()) setSent(true); }}>↑</button><small>Prompts are recorded to improve this event. Never paste credentials.</small></footer></aside></div>;
}
