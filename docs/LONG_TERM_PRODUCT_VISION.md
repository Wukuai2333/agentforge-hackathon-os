# Long-Term Product Vision

## Memory status

This document is the durable product-memory anchor for AgentForge. It records the founder's long-term intent beyond the Hackathon prototype. Product architecture, Cognee schemas, prompt analytics, evaluation rubrics, and roadmap decisions should be checked against it.

Last confirmed: July 24, 2026

## Core thesis

Education is still largely evaluated through outputs: an instructor specifies an assignment, a student may paste the requirements into an AI tool, and the resulting artifact is submitted for grading. The final artifact often reveals little about the student's reasoning, misconceptions, iteration, use of feedback, or actual learning.

AgentForge should acknowledge that students already use AI and turn those interactions into a transparent, consent-based view of the learning process. The goal is to complement output-oriented assessment with progress-oriented evidence—not to reward prompt volume, surveil students, or let an AI assign unreviewed judgments.

The Hackathon is a practical proving ground for this larger idea.

## Product goals

### 1. Progress-oriented learning evidence

Help students and instructors see the cognitive process behind an outcome:

- How the student framed the problem.
- What assumptions and prior knowledge they started with.
- Which questions they asked and how those questions changed.
- Where they became confused or blocked.
- Which sources, tools, agents, and memories they used.
- How they evaluated an AI response instead of accepting it.
- What feedback they received.
- What they revised after feedback.
- Whether they can transfer the idea to a new task.
- What remains uncertain at the end.

The product should distinguish observed facts, student-confirmed statements, and AI inferences. AI inference must retain its evidence, confidence, timestamp, and review status.

### 2. A mutual classroom feedback loop

Consented prompt and workflow data can reveal class-level learning signals in near real time:

- Common misconceptions and recurring questions.
- Tutorial or lecture steps where students repeatedly stall.
- Concepts that are understood quickly versus concepts needing more time.
- Gaps between the instructor's intended learning objective and the work students are actually doing.
- Materials that generate productive exploration versus confusion.
- Differences across sections, courses, and points in the semester.
- Changes after an instructor updates an explanation, example, exercise, or pace.

Students receive more relevant support; instructors receive evidence for adjusting timing and materials. Aggregate counts should come from deterministic event data. AI may interpret themes or draft improvements, but humans review the conclusions.

### 3. A longitudinal student model

Over a four-year college journey, the system may develop a student-owned, inspectable knowledge graph containing:

- Academic timeline: institution, year, program, major, minor, courses, prerequisites, and milestones.
- Concept mastery: demonstrated knowledge, misconceptions, confidence, recency, and evidence of transfer.
- Learning history: questions asked, strategies tried, feedback received, revisions, and outcomes.
- Interests: topics, domains, projects, research questions, and emerging curiosities.
- Learning preferences: examples versus theory, visual versus textual explanation, desired pace, level of scaffolding, and preferred feedback style.
- Work habits: planning patterns, focus windows, procrastination signals, review cadence, and study routines.
- Metacognition: ability to identify uncertainty, evaluate sources, challenge AI output, and reflect on strategy.
- Prompting development: clarity, context selection, constraints, decomposition, evaluation, iteration, and efficiency.
- Collaboration: team roles, explanation to peers, help-seeking, contribution patterns, and shared-memory use.
- Tools and technical skills: languages, frameworks, agent tools, research methods, and demonstrated proficiency.
- Goals: short-term assignments, semester objectives, career direction, research interests, and evolving aspirations.
- Support needs: recurring blockers, accessibility preferences, and interventions the student has approved.
- Evidence provenance: where every model statement came from, when it was observed, who confirmed it, and whether later evidence superseded it.

The student should be able to inspect, correct, export, or delete appropriate model data. Sensitive traits should not be inferred merely because they might improve prediction.

### 4. A team of learning agents

The long-term experience may coordinate specialized agents instead of relying on one generic tutor:

- Tutor: explains and scaffolds at the student's current level.
- Questioner: uses Socratic questions and checks understanding before giving answers.
- Critic: challenges assumptions, identifies weaknesses, and requests evidence.
- Evaluator: runs transparent rubric-based checks without becoming the final human grader.
- Reflector: helps the student summarize what changed in their understanding.
- Planner: connects assignments, study plans, deadlines, and available time.
- Research guide: supports source discovery, comparison, citation, and uncertainty.
- Memory curator: decides what is worth remembering, links it to prior knowledge, and asks the student to confirm important inferences.
- Peer/collaboration coach: helps teams share useful context without leaking private information.
- Career and transfer agent: connects course learning to later courses, projects, internships, and professional goals.

Agent roles should be explicit. The product should study whether a role or team of roles improves learning compared with a single assistant.

### 5. Long-term prompting skills

Prompting should be treated as a learnable form of AI literacy. The product can coach students gradually, inside real work, on:

- Stating the goal and success criteria.
- Providing only relevant context.
- Separating facts, assumptions, and requests.
- Breaking complex work into appropriate steps.
- Choosing the right tool or agent.
- Requesting sources, tests, counterarguments, or structured output.
- Evaluating and correcting responses.
- Iterating from evidence rather than repeatedly rephrasing at random.
- Avoiding unnecessary tokens, duplicated context, and overly broad requests.
- Balancing efficiency with the depth needed for genuine learning.

Efficiency must not become "use the fewest tokens at any cost." A good prompt is one that achieves the intended learning or work outcome with appropriate context, verifiability, and resource use. Long term, this skill may matter in workplaces that evaluate effective and responsible use of agent resources.

## Role of Cognee

Cognee is the semantic memory and relationship layer for this vision. Potential memory categories include:

- Raw prompt/response events and their operational metadata.
- Participant-confirmed profile facts.
- AI-inferred learning hypotheses with evidence and confidence.
- Course, concept, assignment, tutorial, and learning-objective relationships.
- Project canvases, progress events, evaluations, feedback, and revisions.
- Shared team notes and scoped collaborative memory.
- Prompt-quality evaluations and changes over time.
- Instructor interventions and before/after learning signals.
- Agent roles, tool calls, retrieved context, and resulting outcomes.

The operational database remains the source for exact counts, permissions, audit events, deletion, quotas, and retries. Cognee connects and retrieves meaning across those records. Every analytical claim should remain traceable to source evidence.

## Hackathon research questions

The current Hackathon should help test:

1. Can consented prompts reveal where participants are actually blocked?
2. Can a participant's sequence of prompts and revisions provide useful progress evidence?
3. Can Cognee retrieve the right personal, project, tutorial, and team context for Ask AI?
4. Can a transparent rubric identify prompt strengths and actionable improvements?
5. Can organizers improve a tutorial during the event and measure the result?
6. Which participant-model facts are useful within one day, and which require longitudinal evidence?
7. Can specialized tutor roles support better reflection, questioning, and evaluation than one generic assistant?

## Non-goals and safeguards

- Do not equate more prompts with more learning.
- Do not use hidden AI inference as a final grade.
- Do not rank students using token consumption alone.
- Do not collect credentials or unrelated browsing data.
- Do not blur private student memory with team or instructor-visible memory.
- Do not present correlations as proof of cognition.
- Do not optimize efficiency in a way that discourages exploration.
- Do not build a permanent student model that the student cannot inspect or challenge.

