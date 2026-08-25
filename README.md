# AgentForge

**An experimental platform for studying learning processes through consented human–AI interaction data.**

AgentForge explores a simple question: if learners increasingly use AI while solving problems, can those interactions help learners reflect on their own reasoning—and help educators improve instruction—without reducing learning to either a final artifact or an opaque AI score?

The project begins with a personal-agent hackathon and extends toward a longer-term research agenda for progress-oriented, learner-owned educational AI.

> **Current status:** research prototype and hackathon infrastructure. AgentForge does not claim to measure cognition directly, and AI-generated interpretations are not treated as grades.

## Motivation

Most academic assessment remains output-oriented: an instructor defines a task, a student submits an artifact, and the artifact is evaluated. As generative AI becomes part of the work between assignment and submission, the final output may reveal less about how the learner framed the problem, handled uncertainty, revised assumptions, evaluated AI responses, or incorporated feedback.

AgentForge investigates whether responsibly collected interaction evidence can complement—not replace—traditional assessment. The aim is to make parts of the learning process more inspectable while preserving human judgment, learner agency, provenance, and the right to challenge an inference.

## Short-term goal: the hackathon as a research testbed

The immediate goal is to validate a measurable feedback loop:

```text
Participant activity
        ↓
Consented prompts, progress, errors, and feedback
        ↓
Evidence-linked learning signals
        ↓
Human organizer review
        ↓
Tutorial or support intervention
        ↓
Before/after evaluation
```

During the hackathon, participants:

1. Register, review the privacy and consent experience, and join a team.
2. Complete a dynamic interview that turns an initial idea into a project brief, MVP scope, data plan, agent architecture, and demo criteria.
3. Learn the sponsor tools and build a personal agent.
4. Ask contextual questions through an AI assistant.
5. Record progress, errors, evaluations, feedback, and selected shared notes.
6. Demonstrate what the agent does, what it learned, and what changed after feedback.

Organizers use the resulting evidence to study:

- where participants repeatedly stall;
- which tutorial steps produce common questions or failures;
- whether prompts become clearer, more testable, or more efficient;
- whether an intervention changes completion, error, or feedback patterns;
- which participant-model facts are useful in a one-day event;
- whether semantic memory improves contextual support.

The hackathon is therefore both a building event and a bounded experiment in tutorial improvement, prompt coaching, and process-aware learning support.

## Long-term goal: progress-oriented educational AI

The longer-term vision is a student-owned educational agent system that can develop across a four-year college experience.

### 1. Learning-process evidence

The system should help learners and educators inspect how an outcome was produced:

- initial framing and prior assumptions;
- questions, revisions, and changes in strategy;
- misconceptions, blockers, and unresolved uncertainty;
- sources, tools, agents, and memories used;
- evaluation of AI responses rather than passive acceptance;
- feedback received and changes made afterward;
- evidence of transfer to a new task.

The objective is not automated mind-reading. It is a transparent evidence trail that supports reflection and human interpretation.

### 2. A mutual instructional feedback loop

Aggregated and consented interaction data may help instructors identify class-level patterns while there is still time to respond:

- recurring misconceptions;
- mismatches between intended objectives and actual student activity;
- explanations or exercises that create productive exploration;
- materials that repeatedly generate confusion;
- differences across courses, sections, and points in a semester;
- changes after an instructor adjusts pacing or content.

This creates a reciprocal model: learners receive more relevant support, while instructors receive timely evidence for improving materials and teaching decisions.

### 3. A longitudinal learner model

A learner-controlled knowledge graph could gradually connect:

- courses, concepts, prerequisites, projects, and milestones;
- demonstrated knowledge, misconceptions, confidence, recency, and transfer;
- interests, research questions, and emerging goals;
- preferred explanations, pacing, scaffolding, and feedback styles;
- planning patterns, study routines, and approved support needs;
- metacognitive behavior, including source evaluation and uncertainty recognition;
- collaboration, help-seeking, and contribution patterns;
- technical skills, tools, methods, and evidence of proficiency;
- prompting development over time;
- provenance showing where every model statement came from.

Learners should be able to inspect, correct, export, and delete appropriate model data. Sensitive traits should not be inferred simply because they might improve prediction.

### 4. Multiple learning-agent roles

Rather than relying on one generic assistant, the project may study coordinated roles such as:

- **Tutor:** explains and scaffolds at the learner’s current level.
- **Questioner:** checks understanding through Socratic prompts.
- **Critic:** challenges assumptions and requests evidence.
- **Evaluator:** performs transparent rubric-based checks without becoming the final grader.
- **Reflector:** helps the learner articulate what changed in their understanding.
- **Planner:** connects learning goals, deadlines, and available time.
- **Research guide:** supports source comparison, citation, and uncertainty.
- **Memory curator:** proposes what should be remembered and asks the learner to confirm important inferences.

A core research question is whether explicit agent roles produce stronger reflection, evaluation, and transfer than a single undifferentiated assistant.

### 5. Prompting as AI literacy

AgentForge treats prompting as a learnable component of academic and professional AI literacy. Coaching may address:

- clear goals and success criteria;
- relevant rather than excessive context;
- decomposition of complex tasks;
- separation of facts, assumptions, and requests;
- appropriate tool and agent selection;
- requests for sources, tests, counterarguments, or structured output;
- response evaluation and evidence-based iteration;
- resource efficiency without discouraging exploration.

Efficiency is not defined as minimizing tokens at any cost. A strong prompt uses the context and resources appropriate to achieve a verifiable learning or work objective.

## System roles

| Component | Role |
|---|---|
| **ClawMax** | Dynamic project interviewer, agent-building environment, and primary sponsor-tool tutorial. Ideally exposes consented prompt, run, progress, and error events for research and tutorial improvement. |
| **AgentForge** | Registration, consent, team workflow, contextual Ask AI, progress tracking, shared notes, event operations, and organizer review. |
| **Cognee** | Semantic memory and relationship layer connecting participants, projects, prompts, tutorial concepts, learning signals, and outcomes. Supports evidence-grounded retrieval and interpretation. |
| **D1 operational database** | Source of truth for exact events, timestamps, permissions, audit history, retries, quotas, and deterministic counts. |
| **OpenAI models** | Generate contextual participant support and selected analytical drafts. Model outputs remain distinguishable from observed evidence. |

## Ask AI and analysis workflow

The everyday participant workflow is automatic:

1. A participant asks a question.
2. Relevant project, tutorial, participant, and team context is retrieved from Cognee.
3. An OpenAI model generates the answer.
4. The complete interaction and operational metadata are recorded in D1.
5. A memory item is placed in the Cognee synchronization queue.

Resource-intensive analytical work remains organizer-controlled. Organizers decide when to:

- synchronize queued memory;
- detect class-level learning problems;
- ask Cognee to interpret evidence behind those problems;
- annotate current-goal Prompt adequacy and episode-level process evidence for formative coaching;
- review an intervention before updating participant support or tutorial content.

This separation supports participants immediately while retaining human control over additional AI expenditure and consequential interpretation.

## Data and evidence model

Core records include:

- Participant, Team, Project, and consent state;
- Prompt Event and AI Response;
- Agent Run, Tutorial Step, Progress Event, and Error Event;
- Feedback, Shared Space Note, and Evaluation Case;
- Participant Model Entry and Learning Signal;
- Tutorial Version and Organizer Intervention.

Every analytical statement should carry an evidence label:

| Evidence type | Meaning |
|---|---|
| **Observed fact** | A system event or measured result, such as three failed runs at a tutorial step. |
| **Participant-reported fact** | A statement explicitly provided or confirmed by the participant. |
| **AI inference** | A model-generated interpretation linked to sources, time, confidence, and review status. |

Deterministic databases should answer questions such as “How many participants failed this step?” Semantic memory and AI may help interpret *why*, but should not invent the count.

## Research questions

The current prototype is organized around the following questions:

1. Can consented prompts reveal actionable learning bottlenecks during a live event?
2. Can sequences of prompts, revisions, tests, and feedback provide useful evidence of progress?
3. Does semantic retrieval improve the relevance of participant support?
4. Can evidence-linked process annotations support useful coaching without becoming a hidden grade or an unvalidated learner score?
5. Can organizers improve a tutorial during an event and measure the effect?
6. What should be retained in a short-term participant model, and what requires longitudinal evidence?
7. Do specialized tutor roles improve questioning, reflection, or evaluation compared with a single assistant?

## Safeguards and non-goals

AgentForge is not intended to:

- equate prompt volume with learning;
- use hidden AI inference as a final grade;
- rank learners by token consumption;
- collect credentials or unrelated browsing data;
- blur private, team-shared, and instructor-visible memory;
- present correlations as proof of cognition;
- optimize efficiency in ways that suppress legitimate exploration;
- create a permanent learner model that the learner cannot inspect or challenge.

The project prioritizes informed consent, scoped visibility, provenance, human review, data minimization, and reversible learner control.

## Project stage

The repository currently contains an evolving hackathon prototype, including:

- participant and organizer interfaces;
- dynamic-survey and project-canvas concepts;
- contextual Ask AI with prompt tracking;
- Cognee memory synchronization and prompt-evaluation experiments;
- progress, feedback, team-memory, and event-management flows;
- organizer-facing learning-signal and tutorial-improvement concepts.

Several interfaces include demo data or provisional policies. Production identity, consent language, retention rules, role permissions, interoperability, evaluation validity, and longitudinal governance remain active design and research areas.

## Collaboration

We welcome collaboration from researchers and practitioners working on:

- human–AI interaction in learning;
- learning analytics and process-oriented assessment;
- learner modeling and knowledge graphs;
- AI literacy and prompt pedagogy;
- multi-agent tutoring systems;
- educational data governance, privacy, and consent;
- open infrastructure for responsible AI in education.

Contributions may include research design, evaluation instruments, technical integrations, governance review, tutorial studies, or pilot partnerships.

## Repository

[github.com/Wukuai2333/agentforge-hackathon-os](https://github.com/Wukuai2333/agentforge-hackathon-os)

## License

Licensing and research-data terms are under review. Please contact the maintainers before reusing prototype code or study materials in a deployed educational setting.
