# Fixture lifetime repair

Product lineage: Product Goal Trust/Authority. Standing local mission permits this focused test/evidence repair; it grants no production or controller authority.

Retained export diagnostics show asynchronous queue/handoff fixture initialization continuing after a 5000ms test timeout. `afterEach` immediately deletes its root while that initialization can still write, producing ENOTEMPTY. Dispatch children are not registered with cleanup; their 6000ms kill timer is independent of the test's timeout. A later unchanged pass does not close this lifetime defect or explain preparation latency.

Plan: give each test a local fixture scope that tracks initialization/dispatch promises and actual ChildProcess close handles. Cleanup closes admission first, signals registered children, awaits their close and in-flight work, then removes owned roots. Initialization that completes after closure cannot return a usable fixture or spawn a child. Keep the 5000ms test deadline and existing dispatch kill deadline unchanged. No fixture root deletion before work drains; no new company scheduler, lock or authority store.

Affected module: `cliSandboxBoundary.test.ts` only. Verify an actual delayed filesystem writer and actual child shutdown against cleanup, then run the existing transport/policy tests and affected convergence regression. Preserve all historical failures. This improves fixture validity; production Git-effect cancellation, preparation latency cause, actual model/tool policy, callers/AGY and independent review remain open.
