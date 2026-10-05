# AI Company Before / After — 2026-09-08

| Capability | V1 / before | V2 / after | Evidence |
|---|---|---|---|
| Assignment scope | Prompt precedence conflict; untyped fallback possible | Envelope persisted and asserted before provider | queue + dispatcher tests, V2 logs |
| DAG integrity | Partial DAG could be written | `createBatch` validates before write | atomic DAG tests |
| Dispatch isolation | Global READY selection | run/namespace/prefix filtering | V2 three isolated runs |
| Worker workspace | Prompt-only boundary | disposable worktree + read-only control-plane default | worktree manager, V2 logs |
| Artifact handoff | Downstream could not see worktree output | coordinator collects worker reports | V2-1/2/3 logs |
| Task/verdict model | HOLD could be conflated with BLOCKED | typed verdict stored separately | queue/executor tests |
| Recovery | HOLD stopped at CEO narrative | real CEO RecoveryPlan creates corrective task and automatic re-review with bounded terminal HOLD | fresh Codex recovery run `codex-recovery-1788842037696` |
| DAG advancement | manual repeated waves | filtered run-ready advances ordinary DAG automatically | V2 12 role-runs |
| Context | 51k–146k tokens/role | V2 33k–61k observed | V2 logs; still above target |
| Telemetry | inconsistent role/provider evidence | live prompt fingerprint/context/latency/token output | provider-telemetry.jsonl |
| Regression gate | security noise and duplicated worktree tests | 105 files/231 tests; full AI Company gate PASS | `npm run ai-company:gate` |
| Founder intervention | V1 setup/retry/manual waves | V2 ordinary runs: 0 after start | benchmark logs |

## Remaining gaps

The system is materially safer and more observable. A fresh real Codex run now proves CEO-emitted recovery, corrective execution, automatic re-review and bounded terminal HOLD. QA/QC disagreement and stronger adversarial control-plane prevention still need dedicated real-provider scenarios. Context usage remains above the envelope target and is not a proven 50% reduction against identical V1 capture.

Production autonomy remains disabled. The next safe milestone is bounded local/staging execution with human-gated release, after the remaining adversarial proofs pass.
