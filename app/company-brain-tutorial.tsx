"use client";

import { useState } from "react";
import styles from "./company-brain.module.css";

const stages = [
  { name: "Formulate", purpose: "Define your goal, useful context, constraints, and success criteria." },
  { name: "Engage", purpose: "Choose the help you need: explanation, hints, critique, or a comparison." },
  { name: "Verify", purpose: "Check the evidence and test the result before relying on it." },
  { name: "Integrate", purpose: "Decide what to accept, change, or reject—and explain why." },
];

const cases = [
  {
    title: "Daily GTM Brief", category: "Go-to-market · Dave Nielsen", outcome: "A source-backed daily brief, with priorities you can defend.",
    prompt: "Every weekday morning, review my target accounts, recent conversations, upcoming meetings, relevant company news, and outstanding follow-ups. Give me the 5 most important GTM actions I should take today, ranked by potential impact. For each, explain why it matters and the next action.",
    setup: "Start with synthetic account notes, meeting dates, and follow-ups. A prompt alone cannot access your email, calendar, or CRM. Connect authorized sources only after the mock-data workflow works.",
    steps: [
      ["Choose an audience and a definition of impact: renewal risk, meeting readiness, or pipeline value.", "Prepare 3–5 account records with source IDs, dates, and access boundaries. In Cognee, ingest them into your authorized company dataset using the workflow in the Cognee tutorial.", "Set success criteria: five supported actions when evidence permits; otherwise fewer actions with explicit gaps. Do not invent news or meetings."],
      ["In ClawMax, create a briefing agent. Give it access to the authorized Cognee retrieval tool; ask it to retrieve account evidence before making recommendations.", "Run the starter prompt manually. Request a source ID, source date, reason, and next action for each recommendation.", "Ask for an explanation of one ranking decision before asking the agent to rewrite the whole brief."],
      ["Compare each action against its original record. Check meeting dates, stale notes, missing owners, and unsupported urgency.", "Change one synthetic account record and ingest the update with provenance. Retrieve again and check that the next brief reflects current evidence rather than stale context.", "Test a missing-data case: the agent should report a gap, not manufacture an account activity."],
      ["Keep, reorder, or reject the recommendations. Record one decision and the evidence behind it.", "Only after the manual run works, configure the scheduler supported by your OpenClaw runtime. Set timezone, weekday schedule, and delivery destination; test delivery and how to pause it.", "Save the final brief and test evidence in Build Progress. Store approved factual updates in company memory, not unverified recommendations as facts."],
    ],
    asks: ["Which information is missing before my agent can rank these GTM actions reliably? Help me define a testable success criterion.", "Compare two ranking strategies for my goal. Explain the trade-off rather than choosing for me.", "Help me check whether these recommendations are supported by the source records. What should I test myself?", "I changed the priority of this action because [evidence]. Critique my reasoning and suggest one additional check."],
    evidence: ["Goal + selected source IDs + success criteria", "Original request + follow-up + retrieved sources", "A stale-data test and a missing-data test, with results", "Final ranking + one accepted/changed/rejected suggestion and reason"],
    transfer: "Try a new account with a different upcoming meeting. Without reusing the checklist, produce a brief and explain one priority decision.",
  },
  {
    title: "Research This Prospect", category: "Go-to-market · Dave Nielsen", outcome: "A prospect brief that separates facts, hypotheses, and unknowns.",
    prompt: "Research [company]. Tell me what they sell, who they sell to, their business model, recent product/company developments, likely technical stack, and the problems they may have that our product could solve. Identify the 3 strongest reasons they might buy from us and suggest who I should contact.",
    setup: "Supply your own product description and target customer profile. Use public company sources or a synthetic source pack; live research needs a configured search/browser tool. Never imply that a prompt automatically connects these tools.",
    steps: [
      ["Define the prospect and what your product actually solves. Decide which claims matter for an outreach decision.", "Curate a small source pack: product page, dated company announcement, and a relevant technical or hiring page. Record URLs, dates, and source IDs in your authorized Cognee dataset.", "Define success: every factual claim is traceable; technical-stack and buyer-interest hypotheses remain explicitly uncertain."],
      ["Build a ClawMax research agent that retrieves your product context and prospect evidence from Cognee. Enable live search only if your runtime has an authorized tool.", "Use the starter prompt, then request separate sections for verified facts, hypotheses, and unknowns.", "Ask the agent to identify missing evidence or critique product fit, instead of simply making the pitch sound more convincing."],
      ["Open the original sources for three important claims. Check publication date, company identity, and whether the source actually supports the wording.", "Treat a job advertisement as possible stack evidence, not proof of company-wide deployment. Check whether a suggested contact and role are current.", "Compare the agent's buying reasons with your product's actual capabilities. Keep supported recommendations; challenge unsupported ones."],
      ["Select up to three outreach reasons. Explain one suggestion you accepted, changed, or rejected using the source evidence.", "Keep verified source facts separate from the agent's sales hypotheses when writing back to Cognee.", "Save the final brief, source checks, and a short explanation of your decision. Do not send outreach automatically during this exercise."],
    ],
    asks: ["What context about our product is essential for useful prospect research, and what is unnecessary?", "Separate this brief into verified facts, hypotheses, and unknowns. Explain the evidence boundary.", "Which claims should I check first, and what evidence would justify contacting this person?", "I rejected this buying reason because [evidence]. Is my decision justified, or am I dismissing useful information?"],
    evidence: ["Product goal + chosen materials and dates", "Questions + returned claims linked to sources", "Claim checks: evidence, finding, and uncertainty", "Final outreach rationale + selective adoption decisions"],
    transfer: "Research a second company from a new source pack with fewer hints. Explain which claim you trusted most and why.",
  },
  {
    title: "Import POs into QuickBooks", category: "Finance workflow · Max", outcome: "A reviewed purchase-order update in a sandbox—not an unchecked financial write.",
    prompt: "Scan the supplied email discussions about purchase orders and summarize the requested changes. Match each request to the correct purchase order in the QuickBooks sandbox. Show the proposed changes and supporting evidence; do not write anything until I explicitly approve.",
    setup: "Use synthetic emails and a QuickBooks sandbox. You need authorized email input as well as a supported QuickBooks API/skill. If the connector is unavailable, produce a dry-run change proposal; do not claim a real update succeeded.",
    steps: [
      ["Define required fields: supplier, PO number, currency, line items, quantities, and amount. Distinguish a purchase order from an invoice or payment.", "Prepare mock emails with message IDs plus sandbox PO records. Include an ambiguous match and a duplicate request.", "Use Cognee for authorized business context and source-linked email evidence. QuickBooks remains the source of truth for the current accounting record."],
      ["In ClawMax, separate an email-extraction agent from a QuickBooks matching/update agent or skill. Give each only the access it needs.", "Have the first agent return structured requested changes with message IDs. Have the second read the current sandbox PO and propose a field-by-field diff.", "Require a review gate: ambiguous supplier, currency, or PO matches must stop for clarification. Do not grant unattended write access."],
      ["Compare extracted values with the mock email and live sandbox record. Check supplier, PO number, totals, currency, and record freshness.", "Replay the same request: it must not apply the update twice. Design a stable request ID and duplicate check with your connector's supported behavior.", "Test the ambiguous case and an API failure. The workflow must report unresolved/failed status rather than pretend the change was saved."],
      ["Review the diff, explicitly approve a specific sandbox change, then run the supported update operation.", "Read the PO back from QuickBooks and compare it with the approved change. Save the request ID, source IDs, approval, and actual outcome.", "Keep rejected requests and unverified extractions out of authoritative company facts. Explain one approval or rejection; stop before any real financial operation."],
    ],
    asks: ["Help me define the matching rules and approval boundary for this purchase-order workflow.", "How should I divide email extraction and QuickBooks updates between agents while keeping permissions narrow?", "What should I verify before an update, and how can I test duplicate handling without changing real accounting data?", "Here is my proposed change and verification evidence. What uncertainty remains before I approve this sandbox update?"],
    evidence: ["Field schema + mock source IDs + approval rules", "Extraction + proposed diff + clarification questions", "Matching, duplicate, and failure tests with outcomes", "Specific approval/rejection + read-back result + rationale"],
    transfer: "Use a new synthetic PO discussion with different line items. Decide whether to approve the proposed change and explain your checks without the detailed checklist.",
  },
];

export function CompanyBrainTutorial({ onAsk, onBack }: { onAsk?: (prompt: string, context: string) => void; onBack?: () => void }) {
  const [caseIndex, setCaseIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [support, setSupport] = useState("guided");
  const [copyStatus, setCopyStatus] = useState("");
  const item = cases[caseIndex];
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setCopyStatus("Copied. Edit the example to fit your task."); } catch { setCopyStatus("Copy unavailable. Select and copy the text below."); } }
  return <div className={styles.page}>
    {onBack && <button className={styles.back} onClick={onBack}>← Learning Center</button>}
    <header className={styles.header}><span className={styles.label}>COMPANY BRAIN · HANDS-ON TUTORIAL</span><h2>Build with shared knowledge. Keep your judgment.</h2><p>Choose a use case. Use Cognee for source-linked company memory and ClawMax to build and run the agent. FEVI helps you decide what to ask, check, and adopt.</p></header>
    <div className={styles.cases} aria-label="Choose a use case">{cases.map((entry, index) => <button key={entry.title} aria-pressed={index === caseIndex} onClick={() => { setCaseIndex(index); setStageIndex(0); setCopyStatus(""); }}><small>{entry.category}</small><strong>{entry.title}</strong><span>{entry.outcome}</span></button>)}</div>
    <div className={styles.roles}><p><b>Cognee</b>Connect authorized documents and records; retrieve relevant evidence across agents. A memory result still needs checking.</p><p><b>ClawMax / OpenClaw</b>Build agents, connect tools, and execute supported workflows or schedules. Tool access must be configured.</p><p><b>You + AgentForge</b>Learn, ask for help, test, and record decisions. Building happens in ClawMax; judgment stays with you.</p></div>
    <section className={styles.setup}><h3>Before you build</h3><p>{item.setup}</p><details><summary>Starter task prompt · adapt before using</summary><blockquote>{item.prompt}</blockquote><button onClick={() => copy(item.prompt)}>Copy starter prompt</button></details></section>
    <div className={styles.support}><label htmlFor="brain-support">Guidance level</label><select id="brain-support" value={support} onChange={event => setSupport(event.target.value)}><option value="guided">Guided · steps + example questions</option><option value="reduced">Light hints · stage goals only</option><option value="independent">Independent · new case challenge</option></select><small>This changes visible guidance only. It is not a recorded assessment or a skill score.</small></div>
    {support === "independent" ? <section className={styles.workspace}><span className={styles.label}>TRANSFER CHALLENGE</span><h3>Try it with a new case</h3><p>{item.transfer}</p><p>Keep your result and a brief rationale. You can return to guidance whenever you need it; needing help is not a failure.</p></section> : <>
      <nav className={styles.stages} aria-label="FEVI stages">{stages.map((stage, index) => <button key={stage.name} aria-current={index === stageIndex ? "step" : undefined} onClick={() => { setStageIndex(index); setCopyStatus(""); }}><span>{index + 1}</span>{stage.name}</button>)}</nav>
      <section className={styles.workspace}><span className={styles.label}>{item.title} · {stageIndex + 1} / 4</span><h3>{stages[stageIndex].name}</h3><p>{stages[stageIndex].purpose}</p>
        {support === "guided" && <ol>{item.steps[stageIndex].map(step => <li key={step}>{step}</li>)}</ol>}
        <aside className={styles.evidence}><b>Evidence to keep</b><p>{item.evidence[stageIndex]}</p><small>Keep this with your Build Progress evidence. Reading a step does not automatically record its completion.</small></aside>
        {support === "guided" && <div className={styles.ask}><span className={styles.label}>ASK AI · STARTER QUESTION</span><blockquote>{item.asks[stageIndex]}</blockquote><div><button onClick={() => copy(item.asks[stageIndex])}>Copy question</button>{onAsk && <button className={styles.primary} onClick={() => onAsk(item.asks[stageIndex], `Company Brain tutorial | ${item.title} | FEVI: ${stages[stageIndex].name} | Guidance: ${support}. This question is a tutorial-provided scaffold, not independent learner evidence. Task: ${item.prompt}`)}>Open in Ask AI →</button>}</div><small>Edit the draft with your own context. Nothing is sent until you press Send.</small></div>}
        <div className={styles.navigation}><button disabled={stageIndex === 0} onClick={() => setStageIndex(stageIndex - 1)}>← Previous</button><button disabled={stageIndex === 3} onClick={() => setStageIndex(stageIndex + 1)}>Next stage →</button></div>
      </section>
    </>}
    <p role="status" className={styles.status}>{copyStatus}</p>
    <details className={styles.notes}><summary>Why FEVI? What counts as learning evidence?</summary><p>Formulate, Engage, Verify, and Integrate are a provisional process framework—not a validated ability scale. A polished prompt or a good AI answer does not by itself demonstrate understanding.</p><p>Requesting a check is different from performing one. Explain which source you consulted, what test you ran, and why you accepted, changed, or rejected a suggestion. Preserve useful correct advice as well as correcting mistakes.</p><p>Guidance can help you practice; trying a new case with fewer hints helps distinguish following a template from independent action. This tutorial does not automatically collect source clicks, approvals, or guidance changes as research events. External activity is only available where authorized collection is connected.</p></details>
    <footer className={styles.sources}><b>Official references</b><a href="https://www.cognee.ai/company-brain" target="_blank" rel="noreferrer">Cognee Company Brain ↗</a><a href="https://docs.cognee.ai" target="_blank" rel="noreferrer">Cognee documentation ↗</a><a href="https://github.com/Maximilien-ai/clawmax" target="_blank" rel="noreferrer">ClawMax setup ↗</a><a href="https://docs.openclaw.ai/automation/cron-jobs" target="_blank" rel="noreferrer">OpenClaw scheduling ↗</a><a href="https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/purchaseorder" target="_blank" rel="noreferrer">QuickBooks purchase orders ↗</a><small>These exercises are AgentForge-authored guidance, not official partner tutorials. Check your runtime version and supported tools.</small></footer>
  </div>;
}
