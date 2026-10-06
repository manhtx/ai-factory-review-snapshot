# Feature proposal — actual controller gateway

## Goal alignment

Product objective: `docs/PRODUCT_GOAL.md`, Authority, Trust and Traceable research. Research question: can an observer distinguish an authorized current research execution from output or mutation produced by a superseded process? Strengthens system trust; adds no product feature or UI.

This design is derived from clean source candidate `e5420707853c3a18bd84f6b3e769597a0867e893`, inspected through carrier `997a6db035cf8fd235b61b9f589b16b34656c28b`. Source/evidence identity is not operating authority. A/B/C/D stay UNPROVEN.

## Requirement and observed cause

The retained actual coordinator initialization/release counterexample and two-process execution-selection race show that labels and separately initialized files cannot establish controller ownership. Current source adds effects before queue claim: worktree creation, runtime sentinel, dependency copies and product propagation. Later queue CAS cannot retroactively authorize these effects. Current `block`/`requeueBlocked` accept selected rows; possession of a fresh row is not authentication of the controller. Existing attempt handles remain necessary for attempt-owned publication.

Actual Git lifecycle falsification at clean carrier `9f2f94147bb5fcfeebb312fac8be2a69cad0cfa2`: the original run-ready and WorktreeManager APIs operated on a temporary Git repository. A Node Git wrapper paused a genuine `git worktree add` before executing it. The real coordinator's unchanged 5000ms phase timeout terminated it with exit 1 while the queue remained READY, without an issued attempt. Its Git helper was still alive; releasing the fixture pause then let actual Git create the worktree successfully. Evidence and reproducible harness: `evidence/controller-git-effect-9f2f941-counterexample.json`, `evidence/controller-git-effect-probe.mts`. Source hashes are bound; no provider/model/live product was invoked. This proves a preclaim effect can outlive the controller, not that a replacement actor was safely authorized.

Execution selection stays configuration/provenance. The current queue SQLite gate is short-lived exclusion; it stores no work state and unconditionally rolls back. The historical unpromoted SuccessorGovernanceStore commits revision/command receipts but accepts a caller-provided actor string and explicitly depends on an authenticated gateway. Neither primitive can be promoted as an already implemented controller authority. G1/PD009 denial remains pending, without retry or substitute.

## Technical design decision

Use one trusted runtime gateway for controller issuance, actual-child delegation and effect admission. Reuse the current project queue SQLite database and short transaction boundary for a candidate authority/effect journal; do not create another authority JSON file or database. This requires explicitly changing the gate's current exclusion-only contract. Adding rows without changing its rollback/commit semantics is rejected.

The candidate journal must bind root identity, mission hash, schema version, source revision, project/run/namespace scope, controller generation, actual process identity and delegated dispatcher identity. A requested PID, owner string, command-line lease ID, environment flag or copied row cannot be a credential. Delegation is issued to an actual spawned ChildProcess verified against its parent and delivered on that child's private IPC channel. Model/tool workers receive no delegation capability or controller credential. Actual OS identity uncertainty withholds issuance/replacement.

Scope is hierarchical: a project-wide controller conflicts with every active run scope for that project; an exact run scope conflicts with the same run/namespace and any project-wide owner. Do not reproduce the existing global-vs-run lock overlap by creating independent slot names. Project/run scope must match canonical work and assignment before an effect is admitted.

Gateway enrollment and host/private-state isolation are prerequisites. Ordinary source code cannot authenticate itself just by importing an issuer. Initial enrollment must originate at the trusted runtime/operator boundary; candidate fixtures must declare that boundary and try unauthorized direct entrypoints. Existing HOME/CODEX_HOME, private Git history, unconfined/optional worker paths and actual provider authentication remain open. A gateway prototype must not claim to solve these through a caller Boolean.

An actual installed Codex CLI `0.145.0` sandbox-utility fixture with isolated HOME and dummy control credential reproduced `privateRead=true` in both requested read-only and workspace-write configurations. The same utility denied control writes; workspace writes succeeded only for the latter configuration. This is bounded utility evidence, not an actual model tool invocation or proof of every Codex policy. `evidence/codex-native-read-boundary-20261006.json` records the launcher hash, commands' requested modes and outcomes; native payload completeness remains open. The first attempted older platform-selector spelling failed and was not used as a permission proof. The installed help and [official OpenAI sandbox helper documentation](https://learn.chatgpt.com/docs/developer-commands?surface=cli) establish the utility interface; observed outcomes establish this local fixture's behavior.

Implementation order is therefore conditional: do not place a persistent enrollment/signing secret in a control-root file and assume workspace-write makes it confidential. First define and prove the model/tool readable-root boundary using the runner's supported permission interface, separated from the trusted provider's authentication needs. Both runners and non-worktree paths require disposition. Do not expand another ad-hoc SBPL exception or silently trust a permission label. Only after enrollment/private-state protection is sufficient can journal issuance claim actual actor authority. Candidate schema work alone cannot close this prerequisite.

### Effect placement

| Actual source boundary | Required admission and subject | Outcome/reconciliation |
| --- | --- | --- |
| run-ready before WorktreeManager.create | Current controller generation; canonical work/assignment/source/base ref and workspace effect ID | Reserve before Git/filesystem effect; observed result recorded separately; timeout does not cancel an already running promise |
| run-ready runtime sentinel/dependency copy/propagation | Same controller, work, dependency evidence identities, allowed target paths and exact content/source revisions | Retry only idempotent exact effect; partially applied overlay UNKNOWN until examined |
| run-ready spawn | Actual parent process, current generation and exact child command/work digest | Private child delegation; spawn uncertainty cannot authorize another child |
| role-dispatch claim | Actual delegated child plus current controller scope; canonical assignment | Queue attempt capability issued only after this admission; raw owner string insufficient |
| role-dispatch reserveProviderDispatch | Current delegation/controller and existing actual attempt handle; provider/config selection digest | Single issuance retained; surviving or unattested provider prevents replacement |
| native/CLI receipt publishers | Existing attempt/issuance guard plus current delegated generation and original receipt identity | Late output may be forensic; no current receipt authority after revocation |
| evidence admission and terminal reducer | Current command actor, objective/work/assignment/attempt/revision, admitted original evidence and review/effect status | No positive terminal state from output, receipt ID or PASS alone |
| run-ready block/requeue and wave-level suppression | Current controller command scope and expected current row/attempt/revision | Fresh row lookup cannot grant old controller administrative rights |
| authenticated HTTP administrative mutation | Existing operator authentication; explicit command/target/reason and expected revision | Distinct operator authority, no controller token implied |
| artifact collection, security reconciliation and audit spawn | Current controller/effect subject, actual launched attempt and bounded artifact identity | Read/collection failure remains UNKNOWN, not empty mutation set or success |

### Transaction, lock order and crash semantics

One short root/project transaction validates controller generation, delegation, queue read set and command identity, then records an admitted effect or publication. No SQLite transaction spans a provider/Git/filesystem operation, child lifetime or await. Holding the existing queue gate across the controller lifetime is rejected because child queue writes require it.

Authority/effect rows and JSONL stores cannot be described as globally atomic. Before implementation, define commit order and reader admission: a JSONL positive row without the corresponding committed journal record is uncertain/legacy and cannot become trusted through recovery. If journal commit fails after file publication, return COMMIT_UNCERTAIN and reconcile the exact command/bytes; never replay as a fresh effect. If journal admission commits but the process dies before effect completion, preserve RESERVED/UNKNOWN and withhold replacement until actual effect/process reconciliation. Acknowledgement loss after a committed terminal command uses its original command digest; replay still checks authorization and cannot mint a second terminal effect.

Avoid nested acquisition of queue and resource gates. Validate/admit under the queue journal transaction, release it, then perform physical provider-group lifecycle operations and record observed outcomes. The existing resource governor remains a physical pool guard; it does not issue controller identity. Any reconciliation needing both stores has explicit uncertain status, not a claim of atomicity.

Controller revocation stops new admission immediately. Already admitted non-atomic effects may have occurred; their identity and uncertainty are preserved. Old actors cannot write current positive state or administratively block a newer attempt. A controller/process death alone is insufficient proof that all its provider groups or effects ended. No TTL/age takeover and no missing/corrupt-owner-as-empty initialization.

Git/process preparation therefore needs an admitted effect before spawn and actual owned ChildProcess binding, not only a Promise timeout. Existing WorktreeManager's promisified execFile operations must expose their real child lifecycle to the gateway. Missing worktree records after a crash are not permission to remove/prune a still-running effect's target. Do not fix this with a second timer or a new ownership file. Admission, actual effect-process observation and restart reconciliation belong to the same journal/gateway contract.

### Complexity retired and change budget

Observed failure: actual three-controller directory initialization/release and actual two-issuer selection collision. Existing primitives cannot solve identity as-is: queue gate supplies exclusion, selection supplies configuration, supervisor TTL supplies descriptive liveness, historical governance assumes an authenticated caller.

New primitive: one enforced runtime gateway and authority/effect rows in the existing queue database, with private actual-child delegation. Retire authoritative use of run-ready directory owner files and supervisor TTL ownership; keep any diagnostic projections explicitly non-authoritative. No new scheduler, agent, generic lease service, UI, state-file family or database. Do not add a third tactical coordinator lock.

## Risks, legacy and rollout guardrails

Affected modules: queueMutationGate/RoleWorkQueue, run-ready, role-dispatch, native issuers/receipt admission, continuity/marathon launch callers and authenticated admin transport. WorktreeManager remains an effect executor; it cannot infer authorization from task ID. This is a consequential source contract change, not permission to migrate live state.

Legacy roots without bound journal/enrollment are LEGACY_UNATTESTED, not empty/new authority. Missing/corrupt gate, unknown PID birth identity, missing delegation or ambiguous publication fails closed. Do not synthesize successor identity for old DONE or quarantine every difficult legacy item as a closure shortcut. Record explicit legacy disposition and conservation in the later migration rehearsal. Production remains disabled. Candidate-only temporary roots are permitted under the standing local mission; no live trust-genesis migration or service activation is authorized by this proposal.

Rollback before live transfer restores the prior source and leaves candidate journal/evidence intact. After any future authority transfer, rollback requires writer quiescence and a reviewed conservation/reconciliation plan; deleting a live lock/database is never rollback.

## Validation and implementation order

1. Define/test the existing gate's explicit journal commit API, schema/root binding, unknown/corrupt handling and read-only identity checks in isolated roots. No caller-supplied actor credential accepted.
2. Test trusted runtime enrollment and actual ChildProcess/IPC delegation with actual OS participants; forged label/PID/token and unauthorized direct entrypoints denied. Establish the host/private-state operating envelope before treating this as actor proof.
3. Replace coordinator directory authority and wire preclaim workspace effects and original run-ready launch callers. Preserve the actual three-process counterexample and repeat initialization/revocation/old-release tests on the exact candidate.
4. Wire delegated claim/provider/receipt/terminal and separate administrative commands; test stale positive and negative mutation against newer owners through actual entrypoints.
5. Crash each journal/file/effect boundary; retain evidence for output-before-receipt, receipt-before-transition, evidence-before-terminal, terminal-before-ack and surviving providers. Reconciliation cannot manufacture success.
6. Seal clean exact source, run applicable full regression/typecheck/lint, and obtain the required independent review through an authorized available path. Builder fixtures cannot close PD009 or Block A.

## Decision

Status: source design selected for isolated candidate work under standing local authority; NOT IMPLEMENTED, NOT PROMOTED. No product direction change. Enrollment/host boundary and journal/file reader admission are explicit prerequisites; do not start by replacing only the physical coordinator lock. This document changes the next implementation contract, not current operating authority.
