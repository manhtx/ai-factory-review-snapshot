# Macro OS User Journey Matrix v1

This is the canonical task script for user-persona and UX-research reviews. A
review may report a task as successful only when the journey reaches its stated
outcome and records route, viewport, evidence IDs, elapsed time, friction and
limitation. A server/API 200 is not user success.

| ID | Persona | Task | Required outcome | Minimum evidence |
|---|---|---|---|---|
| UJ-001 | Daily macro reader | Find what changed today and inspect the source/as-of date | Can name the change, freshness state and source without guessing | screenshot or browser trace, indicator ID, source URL |
| UJ-002 | Vietnam investor | Compare Vietnam with a global peer across a selected period | Comparison preserves URL state and shows comparable units/freshness | viewport, URL, compared series, source evidence |
| UJ-003 | Portfolio manager | Trace a risk signal from indicator to explanation and limitation | Every factual claim is separated from hypothesis and linked to evidence | claim/evidence map, source URLs, limitation record |
| UJ-004 | Research analyst | Re-open a prior research view after refresh | Same filters, transformations and as-of state are reproducible | before/after URL, snapshot identity, browser result |
| UJ-005 | Accessibility-conscious user | Navigate, search, inspect and export a research result with keyboard only | No blocking focus, overflow or unlabeled control issue | viewport, keyboard trace, accessibility findings |

## Review protocol

1. Execute the task with a clean session and record persona plus viewport.
2. Record success, time-to-outcome, friction and any blocked step.
3. Attach only server-owned evidence or browser artifacts; mark unavailable data
   explicitly instead of filling it with a placeholder.
4. User-persona, UX, domain and stakeholder reviews remain independent and
   dissent is preserved for PM/CEO review.
