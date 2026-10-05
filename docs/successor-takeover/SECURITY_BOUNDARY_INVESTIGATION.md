# Final convergence: local listener and admin authority

## Goal alignment and requirement

Mission: `AI_FACTORY_FINAL_CONVERGENCE_V2`, full contract in
`FINAL_CONVERGENCE_MISSION.md`. Product authority: `docs/PRODUCT_GOAL.md`
sections 9–11, 17–18 and 23. Research question: can Macro OS evidence and
company state remain trustworthy when an unauthenticated caller reaches the API?

## Problem, root cause and evidence

Current observation on 2026-10-02: PID 534 is the LaunchAgent-owned
`server/index.ts` process, and `lsof` reports IPv6 `*:8787`. Source calls
`app.listen(port, callback)` without a host, while logging 127.0.0.1.
The missing host argument exposes the service beyond its declared local envelope.
The alternative hypothesis (another process owns the listener) is falsified by
the observed PID and command. LAN reachability/firewall behavior remains unknown;
wildcard binding itself violates the local contract.

`/api/admin/company/escalations` is registered at line 3499, ahead of common
admin authentication at line 3594, and has no route-specific guard. Express
dispatch order allows its handler to execute before the guard. Three other
early admin mutations have explicit authentication, but bypass common rate
limiting. Candidate source has the same listener/order defects. Reproduction
must use isolated state and invalid input, never a real escalation transition.

Separately, 637 `.chrome-tmp/` paths remain tracked at current HEAD, including
browser databases. That finding is OPEN; this listener/auth repair does not
remove historical exposure or certify privacy closure.

## Proposed permanent solution and impacted modules

Move the existing `/api/admin` authentication/rate limiter registration directly
after the auth function, before any routes. Remove redundant route-specific
auth and the late registration, keeping one guard. Bind local standalone
server explicitly to 127.0.0.1. Keep serverless export behavior unchanged.
Affected: `server/index.ts`; all admin API consumers now consistently require
the existing bearer token and share existing rate limiting. No new architecture
primitive, provider call, UI, state schema, or public release is needed.

## Why preferred, risks, rollback and prevention

Reuse existing auth and rate limiter instead of adding per-route conventions.
Early namespace protection also covers future admin routes and mounted routers.
Loopback binding removes unintended network authority. Intended remote use of
this local process is outside the mission envelope. Reverse the focused source
patch to roll back; private state and product databases are untouched.
Risks: earlier admin routes now consume the established rate-limit budget;
service restart may interrupt API requests and initialize existing background
services. Observe executor configuration and stop sentinel before restart.

## Test strategy and decision

Before fix: enumerate mounted admin routes; missing/wrong token must be rejected
before handler execution, including the escalation path. Valid token with
invalid escalation status must reach validation (400) without writing.
Missing configured key must yield 503. Use temporary cwd and in-memory product
DB; disable startup via NODE_ENV=test. After fix: repeat all admin methods,
positive/negative controls, verify route coverage, assert explicit host, then
restart owned LaunchAgent and directly observe 127.0.0.1:8787. A valid token is
not permission to create work. Broader mutation-route census remains OPEN.

Decision: planned local reversible repair authorized by the latest Founder
mission sections 5, 6 and 86. No per-step approval required. Security block A
stays UNPROVEN until remaining obligations close. Preserve earlier denied G1
verification boundary; this repair does not retry or bypass it.

Independent review found an adjacent resource defect in the existing admin
limiter: default bucket identity accepts arbitrary bearer tokens and forwarded
IP headers, so a local caller can bypass the per-client limit and create
unbounded buckets. Reproduce with a single socket identity and varied headers;
repair only the admin limiter's key generator to use the actual socket peer.
The loopback deployment has no trusted forwarding proxy. Leave other limiter
consumers unchanged; proxy-aware production policy is outside local certification.
Preflight OPTIONS remains an intentional non-mutating 204 before authentication;
the claim covers admin route handlers, not unauthenticated CORS preflight.

Candidate compatibility: reobserved candidate `server/index.ts` SHA-256 equals
the root pre-repair source hash. Apply only the reviewed index/rateLimit patch
after `git apply --check`, preserving all prior candidate edits and state.
This avoids leaving the same security defect in the candidate. No candidate
commit, seal, execution, migration or authority transfer is implied. Browser
tracking guard changes remain in root source until candidate source authority
is reconciled separately.

## Adversarial convergence decision

Evidence considered: current source, process command, listener, candidate source,
supervisor configuration, remote refs and Product Goal. Counterexamples:
source log misstates listener; route prefix alone does not enforce auth;
test PASS alone cannot prove loaded runtime. Smallest repair is early existing
guard plus explicit host. Residual uncertainty: other mutation authorities,
historical private exposure, active writer/store completeness, exact runtime
revision, and all successor promotion proofs. No P0 closure claimed yet.
