# AgentForge Process Coaching Framework v4

## Design decision

AgentForge no longer treats Prompt properties, interaction processes, learner constructs, and outcomes as one additive Prompt Quality score. Framework v4 uses the interaction episode as the preferred unit of analysis and separates three layers:

1. **Prompt adequacy for the current goal** — observable properties of the current request;
2. **episode-level provisional process indicators** — verification, productive iteration, and evidence of learning agency; and
3. **outcome evidence** — participant-reported or system-observed results, stored separately from the Prompt annotation.

This is formative coaching and provisional annotation, not participant grading or a validated skill measurement.

## Layer A: Prompt adequacy

Each available criterion uses `0–3`. A criterion is `N/O` when it is unnecessary for the task or the required evidence is not observable.

Every non-null annotation must include the exact transcript evidence span used for that criterion. A plausible explanation without a referenceable evidence span is insufficient.

| Criterion | Observable question |
|---|---|
| Goal/task specification | Is the current goal or request understandable? |
| Relevant context | Is the task-relevant information available? |
| Constraints/criteria | When needed, are boundaries or success criteria stated? |
| Own state/reasoning | Is the learner's attempt, hypothesis, knowledge, or uncertainty visible? |
| Strategic request | Is the requested form of help appropriate for the current goal? |
| Focus/decomposition | When the task is complex, is it narrowed productively? |

Length, grammar sophistication, persona wording, formatting, politeness, and stylistic elaboration must not independently increase an annotation.

## Layer B: Episode-level process indicators

### Productive iteration

| Score | Observable behavior |
|---|---|
| 0 | Repeats the same request without substantive adjustment. |
| 1 | Surface rephrasing only. |
| 2 | Adds response-contingent context, a constraint, or a subgoal. |
| 3 | Identifies a specific problem and changes the reasoning or help strategy. |
| 4 | Makes an evidence-driven revision followed by verified resolution or improved understanding. |

Iteration count alone is not productive iteration.

### Verification — Score 3 specification

**Criterion:** The learner explicitly evaluates at least one substantive AI claim using task-relevant evidence and makes a justified decision to accept, reject, qualify, or revise that claim.

**Required observable evidence:**

1. an identifiable AI claim, recommendation, or output;
2. task-relevant evidence such as a test, source, calculation, comparison with requirements, counterexample, or explained domain knowledge; and
3. an evidence-based decision to accept, reject, qualify, or revise the claim.

**Near miss / Score 2:** The learner expresses doubt or requests another check, but does not inspect independent evidence or explain the final decision. Running a test without using its result to evaluate the AI claim is also insufficient for Score 3.

**N/O:** Use `not_observable`, not 0, when there is no substantive AI claim, no learner follow-up, no captured tool/source result, or no recorded opportunity to observe verification. Score 0 is reserved for an observed opportunity followed by explicit unverified adoption.

### Learning agency evidence

Agency is not a single-Prompt trait score. The annotation may summarize observable evidence for:

- goal ownership;
- reasoning contribution;
- strategic help-seeking;
- epistemic decision ownership; and
- adaptive regulation.

Missing evidence is not low agency. Longitudinal statements must remain contextualized by task, domain, scaffold level, and number of supporting episodes.

## Layer C: Outcome evidence

Outcome is stored separately and never added to Prompt adequacy. An improved AI output does not establish domain learning. Stronger research claims require independent outcomes, transfer tasks, appropriate-reliance trials, and coaching-removed conditions.

## Validation status

Framework v4 is an implementation hypothesis. Before using its annotations for research claims, AgentForge should establish a human-coded benchmark, inter-rater reliability, criterion-level human–AI agreement, task and subgroup error analysis, and counterfactual verbosity/language tests. Until then, the UI should say **provisional AI annotation**, not skill measurement.
