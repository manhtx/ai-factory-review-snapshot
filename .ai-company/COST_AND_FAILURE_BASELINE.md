# Cost and Failure Baseline — Phase 0

## Current known baseline

- The repository contains a large historical set of epoch logs.
- A repository-wide scan during Phase 0 found **1,322** log files matching
  quota/error patterns.
- The current controller's provider failover resets the consecutive-error count,
  which can allow an unbounded loop while providers are unavailable.
- Exact token spend is **unknown** because invocation usage is not yet persisted
  as a normalized per-run cost record.

## Required normalized run record

Every future invocation must persist:

```text
run_id, epoch_id, provider, model, started_at, ended_at,
input_tokens, output_tokens, estimated_cost, attempt,
failure_class, retry_after, circuit_state, terminal_reason
```

## Baseline policy

Until usage accounting exists, autonomous execution is limited to deterministic
local checks and bounded dry runs. A successful process exit is not evidence of
acceptable cost or quality.
