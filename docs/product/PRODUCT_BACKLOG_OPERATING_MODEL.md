# Product Backlog Operating Model

```text
Observation -> Candidate -> PM review -> Product Backlog -> Definition of Ready
-> Sprint selection -> Execution DAG -> QA/evaluation -> PM acceptance
-> Outcome -> Learning -> backlog reprioritization
```

`ProductBacklogItem` is the product authority. The execution queue is not the backlog, and a DAG is not a Sprint. Normal product mutation requires backlog identity, PM approval, READY state, and active Sprint membership. `TEST_ONLY` and `VALIDATION_ONLY` remain bounded R0 exceptions; recovery inherits the approved parent scope and cannot expand product behavior.

The canonical contract and deterministic checks are implemented in `server/aiCompany/productBacklog.ts`. Markdown is a founder-facing projection, never the runtime database.

Definition of Ready requires a problem, evidence (except justified P0), expected value, bounded expected change, acceptance criteria, dependency clarity, and PM approval. Missing fields fail closed with an explicit reason.
