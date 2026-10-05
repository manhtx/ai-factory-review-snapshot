AI COMPANY

MASTER BUILD PLAN — AUTONOMOUS PRODUCT COMPANY OS

Document Type: Master Technical Implementation Plan
Project Root: AI Company/
Version: 0.1
Status: Build Specification
Primary Executor: Codex
Primary Owner: Founder
Runtime: Local-first
Product Goal: See PRODUCT_GOAL.md

⸻

0. EXECUTION DIRECTIVE FOR CODEX

You are not being asked to build a demo.

You are building the foundation of a long-running local AI-native product company operating system.

Before modifying anything:

1. Read this entire document.
2. Read PRODUCT_GOAL.md.
3. Inspect the existing repository completely.
4. Identify what already exists.
5. Identify what works.
6. Identify what is incomplete.
7. Identify architectural conflicts.
8. Identify reusable components.
9. Identify dangerous technical debt.
10. Produce an implementation audit.
11. Create a migration plan from CURRENT STATE → TARGET STATE.
12. Preserve working functionality whenever possible.
13. Do NOT blindly rebuild the repository from scratch.
14. Do NOT introduce unnecessary frameworks.
15. Do NOT introduce infrastructure merely because it appears in this document if an existing equivalent already solves the problem well.
16. Prefer migration over rewrite.
17. Prefer deterministic software over LLM calls where deterministic software can reliably solve the problem.
18. Keep the entire system logically contained inside:

AI Company/

Do not begin major destructive refactoring until the repository audit is complete.

⸻

1. PRIMARY BUILD OBJECTIVE

Build a local-first operating system capable of continuously managing the product-development lifecycle of real digital products.

The system must eventually be capable of:

OBSERVE
↓
UNDERSTAND
↓
DISCOVER
↓
CHALLENGE
↓
DECIDE
↓
PRIORITIZE
↓
PLAN
↓
BUILD
↓
TEST
↓
REVIEW
↓
SHIP
↓
MEASURE
↓
LEARN
↓
REMEMBER
↓
REPEAT

The operating system must coordinate AI providers such as Codex, Gemini/Antigravity, future models, deterministic tools, product telemetry, persistent company memory, and human approval.

AI models are workers.

AI Company is the operating system.

⸻

2. CRITICAL ARCHITECTURAL PRINCIPLE

Do NOT build:

CEO chatbot
↓
talks to PM chatbot
↓
talks to Engineer chatbot
↓
talks to QA chatbot

That architecture creates AI bureaucracy.

Instead build:

COMPANY STATE
+
WORKFLOWS
+
EVENTS
+
TASKS
+
AGENT CONTRACTS
+
TOOLS
+
EVIDENCE
+
MEMORY
+
EVALUATION

Agents operate on structured company state.

Conversation is not company state.

Prompt history is not company memory.

⸻

3. CORE SYSTEM RULE

The authoritative state of AI Company MUST live outside the LLM.

LLMs must never be the source of truth for:

* task status
* backlog status
* permissions
* budgets
* experiment status
* deployment status
* product metrics
* company decisions
* workflow state
* memory records
* provider health
* agent performance

These belong in persistent structured storage.

⸻

4. TARGET SYSTEM ARCHITECTURE

                        FOUNDER
                           │
                           ▼
                 ┌──────────────────┐
                 │ FOUNDER CONSOLE  │
                 └────────┬─────────┘
                          │
                          ▼
                ┌────────────────────┐
                │ COMPANY CONTROL    │
                │                    │
                │ Vision             │
                │ Strategy           │
                │ Objectives         │
                │ Policies           │
                │ Budgets            │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │ COMPANY KERNEL     │
                │                    │
                │ Orchestrator       │
                │ State Machines     │
                │ Scheduler          │
                │ Event Bus          │
                │ Decision Engine    │
                │ Permission Engine  │
                │ Context Builder    │
                └─────────┬──────────┘
                          │
          ┌───────────────┼─────────────────┐
          │               │                 │
          ▼               ▼                 ▼
       AGENTS          WORKFLOWS          MEMORY
          │               │                 │
          └───────────────┼─────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ MODEL ROUTER  │
                  └───────┬───────┘
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
           CODEX        GEMINI       FUTURE
             │            │          PROVIDERS
             └────────────┼────────────┘
                          │
                          ▼
                     TOOL GATEWAY
                          │
       ┌───────────┬──────┼───────┬──────────┐
       ▼           ▼      ▼       ▼          ▼
      Git        Shell   DB    Browser    Analytics
                          │
                          ▼
                       PRODUCT
                          │
                          ▼
                         USER
                          │
                          ▼
                      TELEMETRY
                          │
                          ▼
                    COMPANY DATA
                          │
                          ▼
                       MEMORY
                          │
                          └────────→ COMPANY KERNEL

⸻

5. TARGET REPOSITORY STRUCTURE

The repository should converge toward:

AI Company/
│
├── PRODUCT_GOAL.md
├── MASTER_BUILD_PLAN.md
├── README.md
├── CHANGELOG.md
├── docker-compose.yml
├── pyproject.toml
├── .env.example
├── .gitignore
│
├── company/
│   ├── constitution.md
│   ├── mission.md
│   ├── vision/
│   │   ├── vision_15y.md
│   │   ├── vision_5y.md
│   │   └── annual_strategy.md
│   │
│   ├── strategy/
│   ├── objectives/
│   ├── policies/
│   └── decisions/
│
├── products/
│   └── <product_id>/
│       ├── product.yaml
│       ├── vision.md
│       ├── positioning.md
│       ├── personas.md
│       ├── jtbd.md
│       ├── metrics.yaml
│       ├── integrations.yaml
│       └── knowledge/
│
├── src/
│   └── ai_company/
│       │
│       ├── kernel/
│       │   ├── orchestrator.py
│       │   ├── state_machine.py
│       │   ├── scheduler.py
│       │   ├── event_bus.py
│       │   ├── context_builder.py
│       │   └── lifecycle.py
│       │
│       ├── agents/
│       │   ├── registry.py
│       │   ├── runtime.py
│       │   ├── contracts.py
│       │   └── roles/
│       │
│       ├── workflows/
│       │   ├── engine.py
│       │   ├── registry.py
│       │   └── definitions/
│       │
│       ├── providers/
│       │   ├── base.py
│       │   ├── router.py
│       │   ├── registry.py
│       │   ├── codex.py
│       │   ├── gemini.py
│       │   └── local.py
│       │
│       ├── tools/
│       │   ├── gateway.py
│       │   ├── registry.py
│       │   ├── git.py
│       │   ├── shell.py
│       │   ├── browser.py
│       │   ├── database.py
│       │   └── analytics.py
│       │
│       ├── permissions/
│       │   ├── engine.py
│       │   ├── policies.py
│       │   └── approvals.py
│       │
│       ├── memory/
│       │   ├── service.py
│       │   ├── retrieval.py
│       │   ├── writer.py
│       │   ├── consolidation.py
│       │   └── embeddings.py
│       │
│       ├── decisions/
│       │   ├── engine.py
│       │   ├── scoring.py
│       │   └── calibration.py
│       │
│       ├── backlog/
│       │   ├── service.py
│       │   ├── prioritization.py
│       │   └── lifecycle.py
│       │
│       ├── experiments/
│       │   ├── service.py
│       │   ├── evaluator.py
│       │   └── lifecycle.py
│       │
│       ├── telemetry/
│       │   ├── tracing.py
│       │   ├── metrics.py
│       │   └── logging.py
│       │
│       ├── evaluation/
│       │   ├── engine.py
│       │   ├── scorecards.py
│       │   └── regression.py
│       │
│       ├── workers/
│       │   ├── worker.py
│       │   ├── pool.py
│       │   └── watchdog.py
│       │
│       ├── models/
│       ├── repositories/
│       ├── services/
│       ├── config/
│       └── api/
│
├── agents/
│   ├── ceo/
│   ├── product/
│   ├── research_data/
│   ├── tech_lead/
│   ├── engineer/
│   ├── qa/
│   └── critic/
│
├── workflows/
│   ├── product_improvement.yaml
│   ├── feature_delivery.yaml
│   ├── bug_fix.yaml
│   ├── incident_response.yaml
│   ├── daily_company_review.yaml
│   ├── weekly_executive_review.yaml
│   └── self_improvement.yaml
│
├── migrations/
│
├── runtime/
│   ├── worktrees/
│   ├── sandboxes/
│   ├── checkpoints/
│   └── temp/
│
├── data/
│   ├── imports/
│   ├── exports/
│   └── backups/
│
├── logs/
│
├── dashboard/
│
├── scripts/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── workflows/
│   ├── providers/
│   ├── permissions/
│   └── e2e/
│
└── docs/
    ├── architecture/
    ├── operations/
    ├── ADR/
    └── research/

Do not mechanically create empty directories if the existing repository has a better organization.

Converge toward this logical separation.

⸻

6. CORE TECHNOLOGY STRATEGY

Prefer:

Python
FastAPI
PostgreSQL
pgvector
Pydantic
SQLAlchemy
Alembic
Docker Compose
Playwright
OpenTelemetry
pytest

Do NOT introduce in v0.x unless proven necessary:

Kubernetes
Kafka
RabbitMQ
Neo4j
Pinecone
Elasticsearch
Temporal
multiple microservices
service mesh
distributed cluster infrastructure

This system runs locally.

Complex distributed infrastructure is premature.

⸻

7. DATABASE — SOURCE OF OPERATIONAL TRUTH

Use PostgreSQL as the primary persistent store.

Required logical entities:

companies
products
agents
agent_versions
agent_runs
providers
provider_runs
objectives
key_results
opportunities
ideas
backlog_items
tasks
task_dependencies
workflows
workflow_runs
workflow_steps
events
decisions
decision_options
predictions
experiments
experiment_results
metrics
metric_snapshots
user_feedback
research_findings
bugs
incidents
memories
memory_links
tool_calls
approvals
deployments
releases
evaluations
agent_scores
resource_usage
system_health

⸻

8. UNIVERSAL ENTITY FIELDS

Important operational entities should generally include:

id
created_at
updated_at
created_by
status
version
metadata

Use UUIDs.

Use UTC internally.

Convert timezone only at presentation boundaries.

⸻

9. TASK MODEL

Tasks are fundamental.

A task must include approximately:

id
product_id
parent_task_id
objective_id
backlog_item_id
title
description
task_type
priority
risk_level
status
assigned_agent
required_capabilities
acceptance_criteria
input_refs
output_refs
dependency_ids
max_attempts
attempt_count
timeout_seconds
budget_limit
token_limit
created_at
started_at
completed_at
failure_reason
checkpoint_ref

⸻

10. TASK STATE MACHINE

Implement explicit transitions.

CREATED
↓
QUEUED
↓
READY
↓
RUNNING
↓
REVIEW_REQUIRED
↓
VERIFYING
↓
COMPLETED

Alternative terminal states:

FAILED
BLOCKED
CANCELLED
REJECTED
EXPIRED

Retry:

FAILED
↓
RETRY_PENDING
↓
QUEUED

LLMs may recommend transitions.

Only application logic performs transitions.

⸻

11. BACKLOG MODEL

Backlog items must represent product problems/opportunities rather than merely requested features.

Required conceptual fields:

title
problem
user_segment
evidence
hypothesis
strategic_alignment
expected_user_impact
expected_business_impact
reach
confidence
engineering_cost
risk
learning_value
defensibility
success_metric
baseline
target
kill_condition
source
priority_score

⸻

12. BACKLOG STATE MACHINE

INBOX
↓
CANDIDATE
↓
VALIDATING
↓
VALIDATED
↓
PRIORITIZED
↓
READY
↓
IN_PROGRESS
↓
SHIPPED
↓
MEASURING
↓
LEARNED
↓
DONE

Alternative states:

REJECTED
PARKED
DUPLICATE
KILLED
STALE

⸻

13. BACKLOG HYGIENE

Implement automatic backlog maintenance.

Periodically detect:

duplicates
stale ideas
unsupported ideas
missing evidence
invalid assumptions
completed problems
obsolete opportunities

Never allow infinite backlog growth.

Backlog size should be a controlled operational resource.

⸻

14. WIP LIMITS

Implement configurable WIP limits.

Initial defaults:

active_P0 = 1
active_P1 = 3
active_engineering_features = 2
active_experiments = 3
major_research_threads = 3

These are configuration values, not hard-coded constants.

⸻

15. AGENT ARCHITECTURE

Start with seven primary functional agents:

CEO
Product
Research & Data
Tech Lead
Engineer
QA
Critic

Do not add new permanent agents casually.

Temporary specialist agents may eventually be spawned.

⸻

16. AGENT CONTRACT STANDARD

Each agent MUST have a structured contract.

Example:

id: product_manager
version: 0.1
purpose:
  maximize_product_outcomes
responsibilities:
  - discover_problems
  - evaluate_opportunities
  - manage_backlog
  - design_experiments
inputs:
  - company_strategy
  - product_metrics
  - user_feedback
  - research_findings
  - relevant_memory
outputs:
  - product_proposal
  - backlog_update
  - experiment_hypothesis
capabilities:
  - reasoning
  - analytics_read
  - memory_read
permissions:
  backlog.read: true
  backlog.create: true
  backlog.update: true
  code.write: false
  deploy.production: false
limits:
  max_runtime_seconds: 1800
  max_attempts: 2
  max_child_tasks: 3
review:
  required_for:
    - high_risk_decision

⸻

17. CEO AGENT

CEO owns:

strategy interpretation
priority arbitration
resource allocation
portfolio health
major decision review
kill decisions
company health

CEO does NOT:

write production code
micromanage implementation
perform routine QA
perform routine research

CEO should receive summarized evidence rather than raw conversation history.

⸻

18. PRODUCT AGENT

Product owns:

product health
problem discovery
opportunity evaluation
backlog
hypotheses
PRDs
experiments
product prioritization

Product must justify proposals with evidence.

Statements such as:

"users will probably like this"

are insufficient.

⸻

19. RESEARCH & DATA AGENT

Owns:

analytics
product behavior
user feedback
market research
competitive research
evidence quality
anomaly investigation

Every research finding should contain:

claim
evidence
source
confidence
sample_size where relevant
limitations
implications
recommended_action

⸻

20. TECH LEAD AGENT

Owns:

architecture
technical planning
feasibility
security
performance
technical debt
engineering estimates
implementation decomposition

Tech Lead must be able to reject technically irrational Product proposals.

⸻

21. ENGINEER AGENT

Engineer owns:

implementation
tests
technical documentation
migration work
bug fixes

Engineer receives structured tasks.

Engineer does NOT independently redefine product scope unless a discovered technical constraint requires escalation.

⸻

22. QA AGENT

QA owns:

acceptance verification
regression
E2E
edge cases
cross-browser testing
performance checks
failure reproduction

QA must independently verify implementation.

Do not let Engineer self-certify completion.

⸻

23. CRITIC AGENT

Critic exists to challenge important work.

Core behavior:

Assume the proposal may be wrong.
Find:
unsupported assumptions
weak evidence
hidden cost
unnecessary complexity
security risk
user harm
opportunity cost
better alternatives
copyability
strategic weakness

Critic does not own final decisions.

⸻

24. STRUCTURED OUTPUTS

All important agent outputs MUST be schema validated.

Use Pydantic models.

Do not parse critical business state from arbitrary prose.

Examples:

ProductProposal
ResearchFinding
TechnicalPlan
ImplementationResult
QAReport
Critique
DecisionRecommendation
ExperimentProposal

If schema validation fails:

retry once with validation error

If still invalid:

fail task

Do not silently accept malformed outputs.

⸻

25. PROVIDER ABSTRACTION

Define a stable provider interface.

Conceptually:

class Provider:
    async def execute(self, request):
        ...
    async def health_check(self):
        ...
    def capabilities(self):
        ...
    def estimate_cost(self, request):
        ...

Request should contain:

task
context
workspace
tools
timeout
model_preference
risk
output_schema

Response:

status
output
usage
duration
provider
model
tool_calls
error

⸻

26. PROVIDER REGISTRY

Providers should register capabilities.

Example:

codex
capabilities:
coding
repo_analysis
tests
shell
refactoring
gemini
capabilities:
reasoning
research
large_context
code_review
structured_analysis

Future:

claude
local
specialized models

⸻

27. MODEL / PROVIDER ROUTER

Routing must not be based only on agent identity.

Route based on TASK CAPABILITY.

Inputs:

task_type
complexity
required_tools
risk
context_size
expected_cost
provider_health
historical_quality
historical_latency
budget_remaining

Output:

selected_provider
selected_model
reason
fallback_chain

⸻

28. ROUTING SCORE

Eventually calculate approximately:

Provider Score =
quality_fit
+ capability_fit
+ reliability
+ historical_task_success
+ latency_fit
+ cost_efficiency
- current_failure_rate
- quota_pressure

Do not implement complex ML routing in v0.1.

Begin rules-based.

Collect data for future adaptive routing.

⸻

29. PROVIDER FALLBACK

Example:

primary provider fails
↓
retry according to policy
↓
fallback provider
↓
if no compatible provider
↓
BLOCK task
↓
raise system event

Provider failure must not corrupt workflow state.

⸻

30. CODEX INTEGRATION

Codex should be treated as an execution provider.

Responsibilities may include:

repo inspection
implementation
refactoring
tests
debugging
code review

Do not make AI Company dependent on internal Codex-specific state.

Store company state outside Codex.

Build a provider adapter around whatever supported local/non-interactive execution mechanism is available in the installed environment.

Capture:

exit code
stdout
stderr
duration
workspace
files changed
git diff
test results
usage when available

⸻

31. GEMINI / ANTIGRAVITY INTEGRATION

Use programmatic/headless interfaces when supported.

Prefer structured JSON output.

Capture:

response
model
token statistics
tool statistics
errors
duration
files modified

Never assume provider subscription means unlimited compute.

Provider adapter must expose quota/failure information when observable.

⸻

32. PROVIDER HEALTH

Maintain runtime provider health.

States:

HEALTHY
DEGRADED
RATE_LIMITED
UNAVAILABLE
AUTH_REQUIRED
UNKNOWN

Health checks should not consume excessive model quota.

⸻

33. TOOL GATEWAY

Agents must not directly execute arbitrary capabilities.

All tools go through:

Agent
↓
Tool Gateway
↓
Permission Engine
↓
Tool

Every tool call records:

agent
task
tool
arguments hash
permission result
start
finish
status
output summary

⸻

34. TOOL CATEGORIES

Initial categories:

filesystem
git
shell
database
browser
analytics
deployment
memory
backlog
experiments

⸻

35. PERMISSION ENGINE

Permissions are enforced by application logic.

Never rely only on:

"Do not delete production."

inside prompts.

Permission check:

agent
+
tool
+
action
+
resource
+
risk
+
environment

→

ALLOW
DENY
REQUIRE_APPROVAL

⸻

36. RISK LEVELS

Define:

R0 READ_ONLY
R1 LOCAL_REVERSIBLE
R2 REPO_MUTATION
R3 EXTERNAL_SIDE_EFFECT
R4 PRODUCTION_CHANGE
R5 DESTRUCTIVE / IRREVERSIBLE

⸻

37. DEFAULT AUTONOMY

Initial target:

R0 → automatic
R1 → automatic
R2 → automatic inside isolated worktree
R3 → policy dependent
R4 → Founder approval
R5 → Founder approval / generally blocked

Do not begin with full production autonomy.

⸻

38. APPROVAL SYSTEM

Create explicit approvals table/state.

Approval request contains:

requested_action
agent
task
risk
reason
expected_effect
rollback_plan
expiration

Founder can:

APPROVE
REJECT
REQUEST_CHANGES

Paused workflows must resume after approval.

⸻

39. WORKSPACE ISOLATION

Engineering tasks must not freely mutate main.

Use:

git worktree

or equivalent isolated workspace.

Lifecycle:

Task
↓
Create worktree
↓
Execute
↓
Test
↓
QA
↓
Review
↓
Merge decision
↓
Cleanup

Worktree management must be automatic.

Founder should not manually merge dozens of agent worktrees.

⸻

40. WORKTREE MANAGER

Implement:

create(task_id)
get(task_id)
status(task_id)
diff(task_id)
merge(task_id)
cleanup(task_id)
recover(task_id)

Track worktrees in DB.

On startup:

detect orphaned worktrees.

Do not blindly delete them.

Reconcile state first.

⸻

41. WORKFLOW ENGINE

Workflows must be deterministic stateful definitions coordinating agents and tools.

Example:

workflow: feature_delivery
steps:
  - product_spec
  - critic_review
  - technical_plan
  - implementation
  - automated_tests
  - qa_review
  - staging
  - measurement_setup

Each step declares:

executor
input
output schema
retry policy
timeout
permission requirement
success condition
failure transition

⸻

42. CORE WORKFLOW — PRODUCT IMPROVEMENT

Implement as flagship workflow:

OBSERVE
Research/Data
↓
identify problem/opportunity
UNDERSTAND
Research/Data
↓
evidence package
PROPOSE
Product
↓
solution hypotheses
CHALLENGE
Critic
↓
critique
REFINE
Product
↓
final proposal
ESTIMATE
Tech Lead
↓
cost/risk/architecture
DECIDE
CEO / decision engine
↓
build / experiment / reject
PLAN
Tech Lead
↓
implementation plan
BUILD
Engineer
↓
implementation
VERIFY
automated tests
+
QA
SHIP
staging initially
MEASURE
Data
LEARN
Product + CEO
REMEMBER
Memory service

⸻

43. BUG WORKFLOW

bug detected
↓
reproduce
↓
classify severity
↓
identify root cause
↓
create isolated workspace
↓
fix
↓
regression tests
↓
QA
↓
merge
↓
monitor
↓
close

⸻

44. INCIDENT WORKFLOW

anomaly
↓
confirm
↓
severity
↓
containment
↓
diagnosis
↓
mitigation
↓
verification
↓
postmortem
↓
memory

Do not let long-term product work block critical incident handling.

⸻

45. EVENT SYSTEM

Implement lightweight durable events in PostgreSQL first.

Event fields:

id
type
source
product_id
entity_type
entity_id
payload
created_at
processed_at
processing_status
retry_count

Examples:

task.completed
task.failed
metric.anomaly_detected
experiment.completed
deployment.completed
provider.unavailable
bug.detected
approval.granted
memory.created

⸻

46. EVENT PROCESSING

Must be idempotent.

Each event handler needs:

idempotency key
retry policy
failure state

Do not process one event twice and create duplicate business actions.

⸻

47. SCHEDULER

Implement local scheduler.

Responsibilities:

daily review
weekly review
memory maintenance
backlog hygiene
provider health
system health
evaluation

Schedules stored/configured centrally.

Avoid scattering cron scripts around the Mac.

⸻

48. WORKER POOL

Workers execute queued jobs.

Initial concurrency should be conservative.

Example:

MAX_WORKERS=3

Make configurable.

Do not assume more concurrent AI workers = more productivity.

⸻

49. ADAPTIVE CONCURRENCY — FUTURE

Collect:

CPU
RAM
provider latency
failure rate
task latency

Later allow concurrency adjustment.

Do NOT build sophisticated adaptive concurrency before baseline reliability exists.

⸻

50. WATCHDOG

Implement process watchdog.

Detect:

worker dead
task timeout
stale lock
provider hung
workflow stalled

Recover safely.

Never blindly restart a task that may have completed external side effects.

Check idempotency first.

⸻

51. CHECKPOINTING

Long tasks must checkpoint meaningful state.

Examples:

research collected
plan completed
workspace created
implementation finished
tests finished

Restarting the computer must not destroy company progress.

⸻

52. MEMORY SYSTEM

Memory is institutional knowledge.

Do not confuse:

chat history

with:

company memory

⸻

53. MEMORY TYPES

Implement:

WORKING
EPISODIC
SEMANTIC
DECISION
EXPERIMENT
FAILURE
ARCHITECTURE
USER_INSIGHT
MARKET_INTELLIGENCE

⸻

54. MEMORY RECORD

Conceptually:

id
product_id
type
statement
summary
source_refs
confidence
importance
created_by
reviewed
valid_from
valid_until
supersedes
contradicts
embedding
created_at

⸻

55. MEMORY WRITE POLICY

Do NOT automatically permanently store all LLM output.

Permanent memory candidates:

verified research
completed experiment
important decision
validated user insight
incident learning
architecture decision
important failure

Other output remains task artifacts.

⸻

56. MEMORY RETRIEVAL

Retrieval should combine:

structured filters
+
recency
+
importance
+
semantic similarity

Do not use pure vector similarity for everything.

⸻

57. VECTOR STORAGE

Use PostgreSQL + pgvector.

Do not introduce standalone vector infrastructure initially.

Start with exact similarity if dataset is small.

Only introduce approximate indexes after real scale requires them.

⸻

58. CONTEXT BUILDER

Before every significant agent call:

Task
↓
Context Builder

Context Builder selects only relevant information.

Potential context:

Company Constitution
Product Goal
Current strategy
Current objective
Task
Relevant backlog item
Relevant metrics
Relevant decisions
Relevant memories
Relevant code references
Relevant experiment history

Do NOT inject entire company history.

⸻

59. CONTEXT BUDGET

Every task gets a context budget.

Context Builder should rank information.

Priority example:

P0 task requirements
P1 current product state
P1 relevant evidence
P2 recent decisions
P2 related memory
P3 background context

This is essential for token efficiency.

⸻

60. DECISION ENGINE

The Decision Engine combines structured scoring and agent reasoning.

Do NOT allow CEO LLM alone to decide every priority.

Initial score dimensions:

strategic_alignment
user_impact
business_impact
reach
evidence_confidence
learning_value
defensibility
engineering_cost
risk
time_to_value
operational_burden

⸻

61. PRIORITY SCORING

Implement configurable weighted scoring.

Do not pretend mathematical score equals truth.

Store:

raw dimensions
calculated score
human/CEO override
override reason

This allows future calibration.

⸻

62. DECISION RECORD

Important decisions must record:

question
options
selected_option
reason
evidence
assumptions
expected_result
prediction
confidence
decision_maker
review_date

⸻

63. PREDICTION CALIBRATION

This is a major requirement.

If Product predicts:

activation +10%

store prediction BEFORE results.

After measurement:

actual +3%

calculate error.

Over time calculate:

agent prediction calibration
overconfidence
underconfidence
domain accuracy

Use this data later to improve decision weighting.

⸻

64. EXPERIMENT ENGINE

Experiment model:

hypothesis
target_segment
primary_metric
secondary_metrics
baseline
expected_effect
minimum_success
kill_condition
start
end
result
interpretation
decision

States:

PROPOSED
APPROVED
RUNNING
MEASURING
CONCLUDED
CANCELLED

⸻

65. EXPERIMENT OUTCOMES

Must support:

WIN
LOSS
INCONCLUSIVE
INVALID

Do not force every experiment into success/failure.

⸻

66. PRODUCT TELEMETRY

AI Company cannot improve a product it cannot observe.

Create integration boundary for:

product events
analytics
errors
performance
logs
user feedback
revenue/business metrics

⸻

67. METRIC HIERARCHY

Metrics must have hierarchy.

NORTH STAR
↓
L1
Acquisition
Activation
Engagement
Retention
Revenue
Quality
↓
L2 diagnostic metrics

Each product defines metrics in configuration.

⸻

68. METRIC DEFINITION

Metric should include:

id
name
description
formula
source
owner
direction
baseline
target
warning_threshold
critical_threshold

Avoid metric ambiguity.

⸻

69. ANOMALY DETECTION

Start deterministic.

Examples:

percentage change
rolling baseline
standard deviation
threshold rules

Do not call LLM to detect basic numeric anomalies.

LLM may interpret anomalies AFTER detection.

⸻

70. OBSERVABILITY

Instrument AI Company itself.

Capture:

traces
metrics
logs

Use OpenTelemetry-compatible instrumentation where practical.

⸻

71. TRACE HIERARCHY

Recommended:

workflow_run
  agent_run
    model_call
    tool_call
    validation
  workflow_step

Every trace should correlate to:

task_id
workflow_run_id
product_id
agent_id

⸻

72. AI USAGE TELEMETRY

Capture when available:

provider
model
input tokens
output tokens
cached tokens
duration
retries
tool calls
errors
estimated cost

Do not fabricate missing usage.

Store NULL/unknown.

⸻

73. SYSTEM METRICS

Track:

tasks completed
tasks failed
workflow success rate
provider failure rate
average task duration
retry rate
agent acceptance rate
QA rejection rate
regression rate
token/resource usage
Founder approval count
Founder intervention rate

⸻

74. PRODUCT OUTCOME METRICS

Do not let operational metrics become the North Star.

Eventually correlate:

AI Company action
↓
product change
↓
product metric movement

This is the true value chain.

⸻

75. EVALUATION FRAMEWORK

Evaluation must exist from early versions.

Five layers:

E1 OUTPUT
E2 PROCESS
E3 ENGINEERING
E4 PRODUCT
E5 BUSINESS

⸻

76. E1 OUTPUT QUALITY

Evaluate:

schema validity
completeness
correctness
evidence quality
internal consistency

⸻

77. E2 PROCESS QUALITY

Evaluate:

permission compliance
tool correctness
unnecessary calls
duplicate work
context efficiency
workflow compliance

⸻

78. E3 ENGINEERING QUALITY

Evaluate:

tests
regressions
maintainability
security
performance
review acceptance

⸻

79. E4 PRODUCT IMPACT

Evaluate:

target metric movement
user friction
retention
activation
engagement
quality

⸻

80. E5 BUSINESS IMPACT

When available:

revenue
cost reduction
growth
retention
competitive advantage
operational leverage

⸻

81. AGENT SCORECARDS

Each agent has scorecard.

Do not rank agents solely by LLM judge.

Use objective outcomes where possible.

Engineer example:

implementation acceptance
test pass rate
QA rejection
regression rate
cycle time
resource efficiency

Product example:

proposal acceptance
experiment win rate
prediction calibration
evidence quality
product impact
low-value work avoided

⸻

82. SELF-IMPROVEMENT ENGINE

AI Company eventually evaluates itself.

Questions:

Which agent adds little value?
Which workflow is too expensive?
Which prompts fail?
Which provider performs best for each task?
Which steps can become deterministic?
Where does Founder repeatedly intervene?
Which tasks repeatedly fail?
Which context is unnecessary?

⸻

83. SELF-IMPROVEMENT SAFETY

Self-improvement cannot directly mutate critical system policy.

Protected:

Constitution
permission boundaries
Founder authority
security policy
budget ceilings
production safety

Changes require explicit review.

⸻

84. SELF-IMPROVEMENT WORKFLOW

observe weakness
↓
create hypothesis
↓
create candidate configuration
↓
offline evaluation
↓
shadow test
↓
compare baseline
↓
accept/reject
↓
record learning

Never:

agent rewrites own prompt
↓
immediately runs new prompt in production

⸻

85. COMPANY HEARTBEAT

Implement multiple operational cadences.

⸻

86. CONTINUOUS LOOP

Monitor:

task queue
workflow failures
provider health
product anomalies
critical errors
approvals
experiments

⸻

87. DAILY LOOP

Daily workflow should generate:

DAILY COMPANY BRIEF
Product health
Metric changes
Incidents
Experiments
Engineering progress
New user insights
New opportunities
Current blockers
Top priorities
Founder decisions required

Avoid generating long useless corporate reports.

⸻

88. WEEKLY EXECUTIVE LOOP

Review:

North Star
L1 metrics
experiments
wins
losses
engineering health
user insights
market changes
resource usage
agent performance
risks
unknowns

Output:

START
STOP
CONTINUE
DOUBLE DOWN
INVESTIGATE

⸻

89. MONTHLY STRATEGY LOOP

Review:

strategy assumptions
product direction
market movement
user behavior
technical direction
business model
resource allocation

⸻

90. QUARTERLY CHALLENGE

Explicitly ask:

If we started this product today with everything we know now,
would we build it the same way?

Require Critic participation.

⸻

91. FOUNDER CONSOLE

Founder should not read raw agent logs.

Dashboard should answer:

How is the company doing?
How is each product doing?
What is running?
What failed?
What changed?
What did we learn?
What are the top priorities?
How much compute was consumed?
What requires my decision?

⸻

92. DASHBOARD V0

Pages:

Overview
Products
Objectives
Backlog
Tasks
Workflows
Agents
Experiments
Decisions
Memory
Providers
System Health
Approvals

⸻

93. OVERVIEW SCREEN

Display:

Company Health
Product Health
North Star
Top Priorities
Active Tasks
Active Experiments
Critical Issues
Recent Learnings
Provider Status
Founder Decisions Required

⸻

94. FOUNDER ATTENTION METRIC

Track:

Founder interventions / completed meaningful cycles

Goal:

decrease over time without decreasing quality.

Ultimate optimization:

Product Value
──────────────
Founder Attention

⸻

95. RESOURCE GOVERNOR

Resources are finite.

Implement budgets:

per task
per workflow
per agent
daily
weekly

Resources may include:

tokens
provider requests
runtime
external spend

⸻

96. BUDGET BEHAVIOR

If budget approaches limit:

downgrade model if appropriate
reduce optional context
skip low-value work
delay low-priority tasks
escalate if important

Do not simply continue until provider quota dies.

⸻

97. DETERMINISTIC-FIRST POLICY

Before LLM call ask:

Can code solve this reliably?

Examples:

Use SQL for:

aggregation

Use Python for:

calculation

Use pytest for:

correctness

Use rules for:

permissions

Use LLM for:

reasoning under ambiguity
research synthesis
product judgment
planning
critique
code generation

⸻

98. SECURITY

Never commit secrets.

Use:

.env

with:

.env.example

Validate required secrets on startup.

Never log raw credentials.

Redact sensitive environment variables from traces.

⸻

99. LOCAL-FIRST OPERATIONS

AI Company should boot locally with minimal commands.

Target:

docker compose up -d

plus application startup if needed.

Eventually provide:

./scripts/company start
./scripts/company stop
./scripts/company status
./scripts/company doctor

⸻

100. COMPANY DOCTOR

Implement diagnostic command.

Check:

Postgres
database migrations
provider CLIs
provider authentication
Git
Docker
disk space
required directories
worker health
scheduler health
stale tasks
orphaned worktrees

Output actionable results.

⸻

101. SAFE SHUTDOWN

Shutdown must:

stop accepting new work
checkpoint running tasks
wait/cancel safely
release locks
flush telemetry
persist state

Laptop shutdown must not destroy company state.

⸻

102. STARTUP RECOVERY

On startup:

inspect RUNNING tasks
inspect workflow runs
inspect worktrees
inspect locks
inspect provider jobs

Determine:

resume
retry
mark failed
require review

Never blindly assume interrupted work failed.

⸻

103. TEST STRATEGY

Every core module requires tests.

Minimum:

unit
integration
workflow
permission
provider adapter
recovery
E2E

⸻

104. CRITICAL TESTS

Must test:

invalid state transitions
duplicate event processing
provider timeout
provider malformed output
worker crash
system restart
permission denial
approval pause/resume
worktree recovery
task retry
budget exceeded
schema failure
memory retrieval
workflow rollback/failure

⸻

105. PLAYWRIGHT

Use Playwright for:

dashboard E2E
managed product browser testing
synthetic journeys

Configure browser projects only when useful.

At minimum eventually test:

Chromium
WebKit
mobile viewport

⸻

106. SYNTHETIC USER LAB — LATER MILESTONE

Do not prioritize before core loop works.

Eventually define synthetic personas.

Each persona:

goal
context
constraints
behavior
success criteria

Run journeys.

Measure:

completion
errors
friction
steps
time
confusion indicators

Synthetic users supplement real users.

They never replace real telemetry.

⸻

107. DOCUMENTATION

Maintain:

architecture docs
ADRs
operations guide
provider setup
workflow docs
recovery procedures

Do not document trivial implementation details excessively.

⸻

108. ARCHITECTURE DECISION RECORDS

Use ADRs for significant decisions.

Example:

ADR-001 PostgreSQL as operational store
ADR-002 Local monolith architecture
ADR-003 Provider abstraction
ADR-004 Worktree isolation
ADR-005 Permission enforcement outside prompts

⸻

109. LOGGING

Use structured logs.

Each relevant record should include:

timestamp
severity
component
task_id
workflow_id
agent_id
provider
message

Do not dump entire prompts containing sensitive information into default logs.

⸻

110. ERROR TAXONOMY

Create explicit error categories:

ProviderError
AuthenticationError
RateLimitError
ValidationError
PermissionError
ToolError
TimeoutError
WorkflowError
StateTransitionError
BudgetExceeded
InfrastructureError

Retry policy depends on error type.

⸻

111. RETRY POLICY

Retry only transient failures.

Examples retry:

temporary provider error
network failure
timeout where safe

Do not automatically retry:

permission denied
invalid task
schema repeatedly invalid
destructive operation rejected

Use exponential backoff with jitter for transient errors.

⸻

112. DEAD LETTER HANDLING

Repeatedly failing jobs go to:

DEAD_LETTER

Founder/System can inspect:

reason
attempt history
provider history
last output
recovery recommendation

⸻

113. ARTIFACT STORAGE

Large task artifacts should not necessarily live directly inside DB rows.

Store files under controlled:

data/artifacts/

DB stores:

path
hash
type
owner
created_at

⸻

114. DATA RETENTION

Define policies for:

temporary runtime artifacts
logs
raw provider outputs
task artifacts
permanent memory

Do not let local disk grow forever.

⸻

115. BACKUPS

Create local backup process for:

PostgreSQL
company configuration
critical memory
decisions
experiments

Runtime caches do not need permanent backup.

⸻

116. IMPLEMENTATION PHILOSOPHY

Build vertical slices.

Do NOT build every subsystem separately for months.

Each milestone must create a working end-to-end capability.

⸻

117. MILESTONE 000 — REPOSITORY AUDIT

FIRST TASK.

Produce:

docs/current_state_audit.md

Include:

existing architecture
existing components
working features
broken features
duplicate systems
technical debt
current providers
current agent system
current database
current task model
current workflow model
current tests
current risks

Then:

docs/migration_plan.md

No major rewrite before this.

⸻

118. MILESTONE 001 — COMPANY KERNEL

Goal:

Reliable persistent execution.

Build/verify:

configuration
database
migrations
task model
task state machine
event system
worker
scheduler
structured logging

Acceptance:

create task
queue task
worker receives task
task completes
state persists
restart application
state remains correct

⸻

119. MILESTONE 002 — PROVIDER LAYER

Build:

Provider interface
Provider registry
Codex adapter
Gemini adapter where locally available
health checks
routing
usage capture
fallback

Acceptance:

same abstract task can be dispatched without kernel knowing provider implementation details.

⸻

120. MILESTONE 003 — AGENT RUNTIME

Build:

agent contracts
agent registry
structured outputs
context builder
runtime limits
agent runs
validation

Acceptance:

Product Agent can receive structured context and return schema-valid proposal stored in DB.

⸻

121. MILESTONE 004 — TOOL + PERMISSION LAYER

Build:

tool gateway
permissions
risk levels
approval flow
filesystem
git
shell

Acceptance:

Engineer can modify isolated workspace.

Engineer cannot perform blocked operation.

Approval-required operation pauses correctly.

⸻

122. MILESTONE 005 — WORKTREE ENGINEERING LOOP

Build:

worktree manager
Engineer execution
test runner
QA
diff capture
cleanup/recovery

Acceptance:

structured engineering task

→ worktree

→ implementation

→ tests

→ QA

→ result

without modifying main unexpectedly.

⸻

123. MILESTONE 006 — PRODUCT/BACKLOG LOOP

Build:

opportunities
backlog
Product Agent
Research/Data Agent
Critic
Tech Lead
CEO decision

Acceptance:

problem

→ evidence

→ proposal

→ critique

→ estimate

→ decision

→ backlog transition.

⸻

124. MILESTONE 007 — MEMORY

Build:

memory storage
memory types
embedding
retrieval
context integration
write policy

Acceptance:

completed learning becomes memory.

Future relevant task retrieves it.

Irrelevant memory does not dominate context.

⸻

125. MILESTONE 008 — PRODUCT IMPROVEMENT WORKFLOW

Connect:

Research
Product
Critic
Tech
CEO
Engineer
QA
Memory

Acceptance:

one end-to-end improvement workflow runs successfully.

⸻

126. MILESTONE 009 — TELEMETRY + EXPERIMENTS

Build:

metric definitions
metric ingestion
snapshots
anomaly detection
experiments
results
prediction calibration

Acceptance:

AI Company can associate product change with measured outcome.

⸻

127. MILESTONE 010 — FOUNDER CONSOLE

Build useful dashboard.

Do not overdesign.

Founder can see:

health
priorities
tasks
workflows
decisions
experiments
approvals
providers
learnings

⸻

128. MILESTONE 011 — DAILY COMPANY LOOP

Build automated daily review.

Acceptance:

AI Company produces evidence-based daily priorities from current product/system state.

⸻

129. MILESTONE 012 — WEEKLY EXECUTIVE LOOP

Build:

weekly review
strategy alignment
resource review
agent performance
START/STOP/CONTINUE/DOUBLE DOWN

⸻

130. MILESTONE 013 — SELF-EVALUATION

Build:

agent scorecards
workflow metrics
provider performance
prediction calibration
Founder intervention metrics

Do not auto-change system yet.

⸻

131. MILESTONE 014 — CONTROLLED SELF-IMPROVEMENT

Build candidate configuration experiments.

Examples:

prompt A vs B
provider A vs B
context strategy A vs B

Changes promoted only after evaluation.

⸻

132. MILESTONE 015 — SYNTHETIC USER LAB

Only after real product loop is stable.

Build browser-based synthetic journeys.

Use them as QA/product evidence.

⸻

133. MILESTONE 016 — LIMITED AUTONOMY

Allow low-risk workflows to complete without Founder approval.

Measure:

success
regression
rollback
Founder intervention

Increase autonomy only if reliability supports it.

⸻

134. DO NOT BUILD EVERYTHING AT ONCE

Codex must execute milestones sequentially.

For each milestone:

PLAN
↓
IMPLEMENT
↓
TEST
↓
REVIEW
↓
UPDATE DOCUMENTATION
↓
COMMIT
↓
VERIFY ACCEPTANCE GATE
↓
NEXT MILESTONE

Do not begin the next milestone while critical acceptance criteria fail.

⸻

135. MILESTONE COMPLETION REPORT

After every milestone create/update:

docs/progress/MILESTONE_XXX.md

Include:

Goal
Implemented
Files changed
Tests
Acceptance criteria
Known issues
Technical debt
Architecture changes
Next milestone

⸻

136. BUILD PROGRESS

Create:

BUILD_STATUS.md

Format:

Current milestone
Overall progress
Completed milestones
Current blockers
Critical issues
Pending Founder decisions
Next action

This is the Founder-readable project status.

⸻

137. CODING RULES

Prefer:

small modules
typed interfaces
explicit schemas
dependency injection where useful
clear boundaries
tests
simple architecture

Avoid:

god classes
massive orchestrator files
hidden global state
deep inheritance
framework magic
untyped dictionaries everywhere

⸻

138. DATABASE RULES

Use migrations.

Never manually mutate production schema without migration.

Add indexes only based on expected query patterns.

Avoid premature optimization.

⸻

139. CONFIGURATION

Separate:

code
configuration
secrets
company policy
product configuration

Do not hard-code:

provider names
model names
budgets
WIP limits
schedules
product IDs
agent limits

when they should be configurable.

⸻

140. FEATURE FLAGS

Use feature flags for experimental subsystems.

Examples:

self_improvement_enabled
synthetic_users_enabled
autonomous_merge_enabled
production_deploy_enabled

Safe default:

false

for high-risk capabilities.

⸻

141. IDEMPOTENCY

Important side-effecting actions require idempotency.

Especially:

event handling
task creation
workflow transitions
deployment
experiment creation
external integrations

⸻

142. LOCKING

Prevent multiple workers claiming same task.

Use PostgreSQL locking patterns.

Locks must expire/recover safely after worker death.

⸻

143. HEALTH MODEL

Company system health should aggregate:

database
workers
scheduler
providers
disk
queue
failed tasks
stalled workflows

States:

HEALTHY
DEGRADED
CRITICAL

⸻

144. COMPANY HEALTH ≠ PRODUCT HEALTH

Keep separate.

Company Health:

Is AI Company operating correctly?

Product Health:

Is managed product performing correctly?

Never mix them.

⸻

145. FIRST MANAGED PRODUCT

Choose exactly ONE existing real product for initial validation.

Do not attempt multi-product orchestration before one product works end-to-end.

Create:

products/<first_product>/

with:

vision
users
JTBD
metrics
repository location
integration config

⸻

146. FIRST REAL COMPANY EXPERIMENT

After infrastructure is functional:

Give AI Company ONE objective.

Example:

Improve successful completion of the product's primary user journey.

Then run:

Research/Data
↓
identify biggest problem
Product
↓
propose solutions
Critic
↓
challenge
Tech
↓
estimate
CEO
↓
choose
Engineer
↓
build
QA
↓
verify
Experiment
↓
measure
Memory
↓
learn

This is the primary proof.

⸻

147. V0.1 SUCCESS GATE

Do NOT declare v0.1 successful because:

dashboard works
agents run
Codex writes code
database exists

V0.1 succeeds when AI Company repeatedly completes:

REAL PROBLEM
↓
EVIDENCE
↓
DECISION
↓
IMPLEMENTATION
↓
VERIFICATION
↓
MEASUREMENT
↓
LEARNING

⸻

148. REPEATABILITY REQUIREMENT

Target at least:

10 successful full improvement cycles

before claiming the operating model is stable.

Track failure reasons for unsuccessful cycles.

⸻

149. AUTONOMY METRIC

Measure:

Autonomy Rate =
meaningful cycles completed
without Founder intervention
/
total meaningful cycles

Do not maximize autonomy at expense of quality.

⸻

150. QUALITY METRIC

Track:

post-change regressions
QA rejection
rollback
incorrect decisions
failed experiments
product metric impact

⸻

151. LEARNING VELOCITY

Measure:

valuable validated learnings
/
time

A killed bad idea can be valuable learning.

⸻

152. COMPANY EFFICIENCY

Eventually estimate:

Verified Product Value
──────────────────────
Compute + Founder Attention

This is more important than number of agents.

⸻

153. ANTI-PATTERN — AGENT MEETINGS

Do not create daily AI meetings merely because human companies have them.

Agents should communicate through:

structured artifacts
tasks
evidence
decisions
events

Use multi-agent discussion only when disagreement has actual value.

⸻

154. ANTI-PATTERN — AGENT EXPLOSION

Do not automatically create:

CEO
COO
CPO
CTO
CMO
VP
Director
Manager
Lead
Senior
Junior

Roles exist only when they provide distinct decision value.

⸻

155. ANTI-PATTERN — RESEARCH FOREVER

Every research task needs:

question
evidence requirement
time/token budget
stop condition
decision it informs

Research without decision purpose should usually not run.

⸻

156. ANTI-PATTERN — FEATURE FACTORY

No feature is successful merely because it shipped.

After shipment:

MEASURE

must occur.

⸻

157. ANTI-PATTERN — LLM AS DATABASE

Never ask:

"What tasks are currently running?"

and trust model memory.

Query DB.

⸻

158. ANTI-PATTERN — LLM AS PERMISSION SYSTEM

Never ask model:

"Are you allowed to delete this?"

Permission Engine decides.

⸻

159. ANTI-PATTERN — LLM AS CALCULATOR

Use deterministic computation.

⸻

160. ANTI-PATTERN — UNBOUNDED LOOPS

Every agent loop requires:

max turns
max runtime
max retries
max budget
stop condition

⸻

161. ANTI-PATTERN — CONTEXT DUMP

Never send entire repository/company history unless truly necessary.

Retrieve selectively.

⸻

162. ANTI-PATTERN — SELF-MODIFICATION WITHOUT EVAL

Never let AI Company silently mutate its own core behavior.

Self-improvement is an experiment.

⸻

163. ANTI-PATTERN — PROVIDER LOCK-IN

Core business logic must not depend directly on one provider SDK.

Use adapters.

⸻

164. ANTI-PATTERN — PREMATURE DISTRIBUTION

This runs locally.

Do not architect as if operating thousands of servers.

Reliability > distributed complexity.

⸻

165. PERFORMANCE

Optimize after measuring.

Initial priorities:

correctness
recoverability
observability
maintainability
then speed

⸻

166. LOCAL RESOURCE AWARENESS

Monitor:

RAM
CPU
disk
worker count

Do not allow AI Company to make the Mac unusable.

⸻

167. RESOURCE PRESSURE

When local resource pressure becomes high:

pause low-priority workers
do not start new background jobs
preserve running critical work
resume when safe

Implement later after baseline.

⸻

168. FOUNDER NOTIFICATION POLICY

Do not notify Founder for everything.

Notify for:

high-risk approval
critical system failure
critical product incident
major strategic decision
persistent workflow failure
budget exhaustion
security issue

Everything else belongs in dashboard/daily brief.

⸻

169. EXPLAINABILITY

Every important action should answer:

Why did this happen?
Who/what initiated it?
What evidence supported it?
What changed?
What is the expected outcome?

⸻

170. AUDITABILITY

Important actions should be reconstructable.

Given a product change, system should eventually reconstruct:

problem
evidence
proposal
critique
decision
task
provider execution
code change
QA
deployment
experiment
result
learning

This chain is extremely important.

⸻

171. PROVENANCE

Every important insight should preserve source references.

Avoid orphan statements such as:

"Users dislike X."

without evidence.

⸻

172. CONFIDENCE

Use confidence carefully.

Confidence is not truth.

Store both:

confidence
+
evidence quality

Agent confidence alone has low evidentiary weight.

⸻

173. CONTRADICTIONS

Memory system should eventually detect:

new evidence contradicts existing memory

Do not silently overwrite.

Link:

CONTRADICTS

and request reconciliation.

⸻

174. KNOWLEDGE DECAY

Some information expires.

Examples:

competitor pricing
market conditions
provider capabilities

Support:

valid_until

Permanent historical decisions remain preserved.

⸻

175. PROVIDER BENCHMARKING

Periodically evaluate providers on representative tasks.

Store:

quality
latency
failure
resource usage

Use data to improve routing.

Do not trust marketing claims.

⸻

176. SHADOW MODE

Before granting new autonomy:

run workflow in:

SHADOW

System recommends what it would do but does not perform side effects.

Compare with actual decisions.

⸻

177. AUTONOMY LEVELS

Define:

A0 OBSERVE
A1 RECOMMEND
A2 PLAN
A3 BUILD_LOCAL
A4 STAGING
A5 LOW_RISK_PRODUCTION
A6 BROAD_AUTONOMY

Autonomy can vary by capability.

Example:

testing = A4
database deletion = A1

⸻

178. AUTONOMY EARNED BY EVIDENCE

Promotion requires:

sufficient sample
high success rate
low regression
successful recovery
good evaluation

No autonomy promotion because Founder feels optimistic.

⸻

179. ROLLBACK

Every automated production capability eventually needs rollback strategy.

No rollback:

→ higher risk level.

⸻

180. SYSTEM VERSIONING

Version:

agent contracts
workflows
prompts
routing config
policies

Every run records versions used.

Without versioning, evaluations are meaningless.

⸻

181. PROMPT MANAGEMENT

Prompts belong in repository/config.

Do not scatter prompt strings throughout Python files.

Prompt version must be traceable.

⸻

182. PROMPT CHANGE

Prompt changes should eventually be evaluated like code changes.

Do not assume longer prompt = better agent.

⸻

183. WORKFLOW VERSIONING

Running workflows retain their starting version.

Do not mutate an in-progress workflow definition unexpectedly.

⸻

184. MIGRATION SAFETY

Schema migrations must be reversible when reasonable.

Backup before destructive migration.

⸻

185. BUILD ORDER — STRICT PRIORITY

If existing repository is incomplete, prioritize in this order:

1 persistence
2 state machines
3 recovery
4 provider abstraction
5 structured agents
6 permissions
7 worktree execution
8 product workflow
9 memory
10 telemetry
11 experiments
12 dashboard
13 evaluation
14 self-improvement
15 autonomy

Do not reverse this by building fancy UI first.

⸻

186. MVP CORE

If scope must be reduced, preserve:

DB
Tasks
Workflow
Codex provider
Product
Tech
Engineer
QA
Critic
Worktree
Memory
Evaluation

Everything else can wait.

⸻

187. DEFINITION OF DONE — FEATURE

A feature is done only when:

implementation exists
tests pass
acceptance criteria pass
QA passes
documentation updated where necessary
telemetry exists where necessary
no critical regression

⸻

188. DEFINITION OF DONE — MILESTONE

Milestone is done only when:

acceptance test passes
critical tests pass
system restart tested
documentation updated
BUILD_STATUS updated
known debt recorded

⸻

189. DEFINITION OF DONE — AI COMPANY

There is no permanent DONE.

The operating company loop is continuous.

Individual work terminates.

Company learning continues.

⸻

190. FINAL SYSTEM TEST

The final architecture must demonstrate:

Founder defines objective
↓
AI Company observes real product state
↓
identifies opportunity
↓
gathers evidence
↓
Product proposes
↓
Critic challenges
↓
Tech estimates
↓
CEO prioritizes
↓
Engineer builds in isolated workspace
↓
tests run
↓
QA independently verifies
↓
change is staged
↓
experiment/measurement occurs
↓
result is evaluated
↓
learning enters memory
↓
future prioritization changes because of learning

If any arrow requires the Founder to manually coordinate routine agent behavior, identify it as automation debt.

⸻

191. FINAL OPTIMIZATION TARGET

Do not optimize AI Company for:

maximum AI usage

Optimize for:

maximum verified product progress
with
minimum unnecessary compute
and
minimum Founder coordination.

⸻

192. MASTER ENGINEERING PRINCIPLE

Whenever choosing between two architectures:

Prefer the one that is:

simpler
observable
recoverable
testable
provider-independent
easy to modify
hard to misuse

over the one that merely looks more sophisticated.

⸻

193. CODEX CONTINUATION RULE

Do not stop merely because one task has been implemented.

After completing a task:

run tests
inspect result
update state
inspect next milestone
continue

Stop only when:

Founder decision is genuinely required
unsafe action requires approval
required external credential is unavailable
architectural contradiction cannot be safely resolved
all planned acceptance gates currently possible have passed

Do not stop simply to ask:

"Would you like me to continue?"

Continue when the next safe action is obvious.

⸻

194. CODEX PROBLEM-SOLVING RULE

When encountering an error:

Do not immediately ask Founder.

First:

inspect error
inspect logs
inspect relevant code
reproduce
research locally available documentation
attempt safe fix
test

Escalate only when necessary.

⸻

195. NO FAKE COMPLETION

Never claim:

implemented

unless implementation exists.

Never claim:

tested

unless tests actually ran.

Never claim:

working

unless evidence supports it.

Never silently substitute mocks for production capability without clearly marking them.

⸻

196. NO SILENT SCOPE REDUCTION

If a requirement cannot currently be implemented:

record:

BLOCKED
reason
dependency
recommended next step

Do not silently omit it.

⸻

197. CONTINUOUS CLEANUP

After each milestone:

inspect for:

dead code
duplicate abstractions
unused dependencies
temporary files
orphaned worktrees
obsolete configs

Clean safely.

Do not allow AI-generated code entropy to accumulate indefinitely.

⸻

198. ARCHITECTURE GUARD

After major milestones ask:

Has this change increased unnecessary complexity?
Did we duplicate an existing capability?
Did we create provider lock-in?
Did we bypass permission boundaries?
Did we make recovery harder?
Did we create hidden state?

If yes:

fix before expansion.

⸻

199. NORTH STAR TEST

For every proposed subsystem ask:

Does this help AI Company:
make better product decisions,
execute them more effectively,
learn from reality faster,
or reduce Founder coordination?

If no:

do not build it.

⸻

200. EXECUTION START

Begin now with:

MILESTONE 000
REPOSITORY AUDIT

Steps:

1. Read PRODUCT_GOAL.md.
2. Read MASTER_BUILD_PLAN.md.
3. Map the entire existing repository.
4. Run existing tests.
5. Identify running services.
6. Identify existing agent architecture.
7. Identify provider integrations.
8. Identify database/storage architecture.
9. Identify task/workflow implementation.
10. Identify current permission boundaries.
11. Identify existing local automation.
12. Identify what already satisfies this specification.
13. Identify what conflicts with it.
14. Produce docs/current_state_audit.md.
15. Produce docs/migration_plan.md.
16. Produce/update BUILD_STATUS.md.
17. Determine the smallest safe next implementation milestone.
18. Begin implementation.
19. Test.
20. Continue milestone-by-milestone.

⸻

FINAL DIRECTIVE

You are not building a collection of agents.

You are building a persistent AI-native product organization.

The organization must be able to:

see reality,

understand reality,

make decisions,

challenge itself,

execute,

verify its work,

measure consequences,

remember what happened,

and

become better because of what it learned.

Every architecture decision should serve that objective.

The system should become increasingly autonomous only as its demonstrated reliability improves.

The end goal is not to remove the Founder.

The end goal is to multiply the Founder.

Build accordingly.
