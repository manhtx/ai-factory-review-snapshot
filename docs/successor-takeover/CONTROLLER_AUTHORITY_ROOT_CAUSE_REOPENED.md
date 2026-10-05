# Controller ownership root cause reopened

Mission AI_FACTORY_FINAL_CONVERGENCE_V2, Block A. Product Goal sections 11, 17, 21 and 23 require evidence-bound system trust and bounded operation. This records a reproduced failure and the next design investigation; it grants no runtime authority or Block A closure.

## Current counterexample

At clean source 239fe220b453ce11e83f8da805e907cb0d9b1687, the actual ai-company-run-ready entrypoint was launched as three real OS processes sharing one temporary project control root. All processes were held before role dispatch; no providers, models, product stores or external effects were invoked. A was SIGSTOP-paused immediately before its coordinator owner file publication. B observed the partial lock with no owner, deleted it, and acquired while A remained alive. Resuming A overwrote B's owner metadata. A's normal SIGTERM handler then deleted the slot without checking issued identity. C acquired while B was still alive.

Exact evidence: evidence/coordinator-init-239fe22-counterexample.json and its retained reproducible temporary-store harness. The actual source hash is recorded in the evidence; the wrapper injects a pause into the OS publication boundary without modifying the repository source. All three processes are stopped and the temporary control root removed in cleanup.

## Root cause and competing explanation

The coordinator interprets unknown/missing owner metadata as permission to delete a slot, initializes the slot outside serialized exclusion, and releases by pathname alone. The experiment disproves an explanation based only on provider quota or a provider response: it occurs before any dispatch. The unchanged source contains the direct recovery and signal-release paths.

The broader causal class is replicated authority: queue attempt handles, execution leases, provider resource grants and coordinator directory locks describe overlapping lifetimes but are not one enforced controller authority. Fixing the physical provider slot does not authorize the coordinator that can stop, requeue or relaunch work. A selected queue CAS prevents a stale row write; it does not decide whether a controller may obtain a fresh row and administer it.

## Repeated-failure decision

The resource repair already moved from caller-only admission to actual provider-group lifetime after a stronger original-entrypoint counterexample. This newly reproduced sibling lock failure reopens the ownership architecture under the continuation's repeated-failure rule. Do not add a third tactical ownership layer, age threshold, recovery timer, scheduler or state family. Retain the clean candidate and counterexample; redesign the use of existing authority before modifying coordinator code.

## Next design investigation and acceptance

Inspect the actual execution-lease issuer, replacement/revocation rules and all run-ready launch callers. Determine whether the existing lease can serve as the controller's issued lifetime authority, and which current metadata can be retired. Inspect authenticated administrative stop/requeue paths separately from controller-owned failure reconciliation. Explicitly map owner, work, attempt, resource grant, original provider group and terminal effect.

Use the existing queue mutation gate only for short serialized admission/release operations. Holding its transaction for a whole coordinator lifetime would block the queue operations the coordinator itself needs and is not an acceptable simplification. A durable lifetime identity must not become an independent optimistic authority file. Compare reusing the current execution lease with retaining a minimal fenced coordinator slot; select only after caller and effect coverage is understood.

Affected modules are run-ready, continuity/recovery launch callers, executionLease, queue administration and role-dispatch integration. Risks include preventing legitimate recovery, parallel project/run scope changes, lock-order deadlocks, legacy unattested owners, controller crashes and provider groups surviving the controller. Existing live writers must be classified before any rollout; no live lock may be deleted as a source repair shortcut.

Acceptance must preserve the actual three-process negative, prove serialized initialization and original-owner release, preserve unknown partial state, and exercise current administrative stop, actual controller revocation/replacement, surviving providers and crash reconciliation. Tests must not invent an unrelated lease or replace the actual entrypoint with a local capability imitation. Process-birth identity, filesystem rights, cross-store atomicity, exact-revision independent review and a reliable timing envelope remain open obligations.

## Current disposition

The clean candidate passes 533 tests across 51 files, full typecheck and affected lint; it contains this coordinator counterexample. Resource/provider lifecycle proofs are scoped builder evidence only. Initial ten full-suite timeouts and the 30-test focused unchanged-deadline recheck are both retained; timing cause remains UNKNOWN. No live service was restarted or enabled, no migration performed, no production authority granted. A/B/C/D remain UNPROVEN. The prior independent review safety denial remains REVIEW_PENDING and is not retried, rephrased or substituted.

## Actual execution-selection issuer and consumer falsification

At clean documentation carrier 1635505dfa3416a831048f308a3257fbc1370db6, the actual ExecutionLeaseManager issued revision one in a temporary control root. Two real OS processes then invoked its createOrUpdateExecutionLease with expectedRevision one. The fixture paused each only after its genuine persisted read, allowing A to finish publication before B continued from the same read. Both accepted and returned the identical revision-two lease ID for different controllers; B overwrote A. The current T17 test is sequential despite its concurrent label and cannot prove exclusion between the read and publication. Evidence: execution-lease-race-1635505.json and its actual-source harness.

A second original-entrypoint experiment created and revoked a real execution selection using the issuer and revoker APIs, created a genuine temporary queued handoff, then passed that revoked lease ID to role-dispatch. The temporary Node codex stub was invoked; the dispatcher exited zero, recorded the revoked ID/revision in a receipt, and advanced the temporary work to DONE. The revoked lease bytes were unchanged. This demonstrates that execution selection is descriptive at this caller; it does not demonstrate unauthorized host access, independent acceptance or a real product outcome. Evidence: revoked-lease-dispatch-1635505.json and its actual-source harness. No actual provider/model was contacted.

The relevant caller effects are now concrete:

| Component | Current use | Authority gap |
| --- | --- | --- |
| ExecutionLeaseManager | Friendly model/provider selection, optional expected revision, file publication | Read/check/write is not serialized; no process owner, authenticated issuer or effect fence |
| Marathon | Resolves selection, records lease metadata in cycle operation, passes lease ID to run-ready | Lease resolution is not a fence throughout a cycle; takeover-active flag is caller-supplied |
| Continuity kernel | Resolves selection before child launch; acquires a supervisor TTL lease | Child launch omits selected ID/revision; supervisor expiry is not a child/effect quiescence proof |
| Run-ready | Reads selection once for defaults; passes lease ID to child | Preclaim worktree and dependency writes precede the child's queue claim; coordinator ownership is not rechecked at effects |
| Role-dispatch | Reads selection for defaults and receipt metadata | Supplied revoked selection is not checked before provider issuance or terminal publication |
| Queue attempt transitions | Genuine current handle, selected row and original evidence guards | These do not authenticate the controller that prepares workspaces or calls administrative methods |
| Resource governor | Genuine resource grant, bound actual provider group and quiescence checks | Scoped agy physical pool; no controller authority transfer or full filesystem fencing |

## Architecture comparison and decision

Promoting the existing execution-selection file as-is is rejected by both new experiments. A serialized selection CAS would repair its configuration race but would not close controller authority. Adding a second controller ID to reports is rejected because it would reproduce the descriptive lease failure. Removing coordinator exclusion and relying only on queue attempts is rejected because worktree creation and dependency propagation occur before the queue claim. Holding the queue gate throughout a coordinator lifetime remains rejected because the child's legitimate queue operations need that gate.

The existing DurableSupervisorState is also not an automatic authority replacement: its current source accepts expiry-based takeover while a PID may be alive, conflates missing/corrupt reads during acquisition, and is not consulted by role receipt transitions. These are current source capabilities, not additional reproduced runtime claims. CompanySupervisor's in-memory ticking guard protects one instance only.

The historical isolated SuccessorGovernanceStore offers transactional revision/command receipt checks, but its own contract explicitly leaves actor authentication and filesystem exclusion to a trusted runtime gateway. It must not be promoted or substituted for the safety-denied G1 review. It is not evidence of a current authenticated controller. The dirty historical candidate remains untouched and unpromoted.

The selected direction is one enforced controller gateway with a declared relationship to the existing transactional authority and current queue attempt publisher. Execution selection stays model/provenance configuration. Controller issuance must bind the actual process and project/run scope, and delegation must bind the actual spawned dispatcher. Workspace preparation, provider issuance, failure/retry administration and receipt/terminal effects must require that still-current controller relationship at their mutation boundary. Authenticated operator actions retain a distinct, explicit authority path. Unknown launch or surviving descendants cannot authorize replacement.

Before implementation, specify the existing-store integration and which coordinator/supervisor authority claims are retired. Do not create a new independent optimistic JSON authority, a generic lease framework or a scheduler. Required design evidence is an effect-by-effect gateway placement, lock order, original-entrypoint delegation/verification, legacy classification, loss-of-controller reconciliation and rollback without deleting live state. The architecture is reopened; no third tactical coordinator patch has been applied and no selection CAS has been misrepresented as controller closure.
