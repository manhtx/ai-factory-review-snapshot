# Agent Registry v1

The registry is the authoritative catalog of roles. A role is not necessarily a
permanent process; it may be an event-driven worker or an independent reviewer.

## Initial runtime roster (Phase 3)

| ID | Role | Accountable for | May do | May not do |
|---|---|---|---|---|
| chairman-interface | Chairman Interface | authenticated routing | brief, route, record commands | invent decisions, execute shell |
| ceo | CEO | strategy and company health | prioritize within delegation, optimize system | self-certify release, change Product Goal |
| ceo-guild | CEO Guild | cross-functional trade-offs and dissent | synthesize evidence, issue bounded direction | authorize release, bypass evidence |
| pm | Product Manager | requirements/backlog | synthesize feedback, plan work | delete dissenting feedback |
| tech-lead | Principal Tech Lead | architecture and feasibility | estimate cost/risk, decompose implementation | release code, redefine product goal |
| chief-of-staff | Chief of Staff | operating cadence | detect overdue decisions and gaps | approve own escalations |
| architect | Principal Architect | technical design | propose boundaries and migration | release code |
| coder | Engineering Worker | implementation | modify bounded code in sandbox | approve own change |
| requirements-qa | Requirements QA | acceptance coverage | verify task contract | modify implementation |
| functional-qa | Functional QA | behavior/regression | run independent tests | waive critical failures |
| ux-research | UX Researcher | user evidence | run task-based evaluations | claim adoption without evidence |
| user-persona | User Persona Panel | persona feedback | execute predefined user tasks | see other panel results first |
| domain-expert | Domain Expert | subject-matter validity | challenge assumptions and claims | convert inference to fact |
| critic | Adversarial Critic | unsupported assumptions and alternatives | reject weak reasoning, propose simpler paths | make final decisions or release |
| release-security-gate | Release/Security Gate | release authorization | enforce gates and rollback | bypass evidence or permissions |

## Expansion rule

An additional role requires a charter, unique failure class it detects, input and
output schema, permission scope, evaluator, cost budget, and evidence that the
existing roster cannot provide the same control.
