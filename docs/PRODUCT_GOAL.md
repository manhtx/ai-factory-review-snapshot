# Macro OS — Product Goal

## 1. Authority

This document defines the enduring product goal of Macro OS.

It is the highest-level product reference for deciding:

- what problem the product exists to solve;
- whose decisions it should improve;
- what user outcome matters;
- what constitutes real product progress;
- what truth and trust standards cannot be compromised.

This document is deliberately not:

- a roadmap;
- a feature backlog;
- a product requirements document;
- a data catalog;
- an architecture specification;
- an AI Company operating manual;
- an agent or workflow specification.

Those artifacts must derive their direction from this Product Goal.

They must not redefine it implicitly.

Supporting product context may live in documents such as:

- product strategy;
- user research;
- product review;
- data strategy;
- research methodology;
- feature proposals;
- architecture;
- delivery plans.

If implementation conflicts with this Product Goal, the conflict must be
resolved before implementation proceeds.

---

# 2. Mission

Macro OS exists to help people make sense of important changes in the economy
and markets through trustworthy, connected, inspectable evidence.

The product should help a user move from:

**Something important may be changing**

to:

**I understand what changed**

to:

**I understand the relevant historical and economic context**

to:

**I can inspect the evidence and competing explanations**

to:

**I know what remains uncertain**

to:

**I know what evidence matters next.**

Macro OS should improve understanding.

It should not manufacture certainty.

---

# 3. Core problem

Economic and market information is abundant.

Understanding is scarce.

Relevant information is fragmented across data providers, statistical agencies,
central banks, markets, disclosures, research, news, charts, spreadsheets, and
historical datasets.

The user therefore has to repeatedly reconstruct:

- what happened;
- whether it matters;
- whether the information is current and trustworthy;
- how unusual the change is;
- what historical context matters;
- which variables may be related;
- which explanations are supported;
- which explanations are merely plausible;
- what contradicts the current interpretation;
- what remains unknown;
- what should be monitored next.

Macro OS exists to reduce this fragmentation without hiding uncertainty.

---

# 4. User hypothesis

The initial hypothesis is that Macro OS is most valuable to people who actively
research macroeconomic and investment conditions and currently assemble their
understanding from many disconnected sources.

The initial focus includes users researching Vietnam within a broader global
macro context.

This user definition is a hypothesis.

It must become more specific only when real evidence supports doing so.

Do not optimize the product around invented personas merely because they sound
plausible.

---

# 5. Job to be done

When an important economic or market condition changes, help the user determine:

1. **What changed?**

2. **How significant is it?**

3. **What context is necessary to understand it?**

4. **What evidence may explain it?**

5. **What evidence challenges that explanation?**

6. **What remains uncertain?**

7. **What could materially change the current interpretation?**

8. **What should be investigated or monitored next?**

9. **What may deserve preparation over the relevant investment horizon?**

Macro OS supports research and preparation.

It does not need to turn these questions into automatic investment
instructions.

---

# 6. Core research loop

The primary product loop is:

# Detect → Investigate → Compare → Explain → Challenge → Synthesize → Monitor

## Detect

Identify a potentially meaningful change.

## Investigate

Inspect the underlying observations, source, history, freshness, revisions, and
context.

## Compare

Compare the current state with relevant:

- history;
- indicators;
- countries;
- assets;
- cycles;
- regimes;
- transformations;
- periods.

## Explain

Connect observations to traceable evidence and plausible relationships.

## Challenge

Expose:

- contradictory evidence;
- competing explanations;
- missing evidence;
- uncertainty;
- limitations.

## Synthesize

Help the user form or update a coherent research view while preserving the
difference between evidence and interpretation.

## Monitor

Identify and track the evidence that could strengthen, weaken, invalidate, or
materially change that view.

Features exist to improve this loop.

The loop does not exist to justify features.

---

# 7. North Star outcome

Macro OS succeeds when it can repeatedly help a user move from:

> “Something important appears to be changing.”

to:

> “I understand what changed, how unusual it is, what evidence supports the
> leading explanations, what evidence challenges them, what remains uncertain,
> and what I should monitor next.”

with:

- trustworthy evidence;
- relevant historical context;
- explicit uncertainty;
- preserved research context;
- materially less fragmented research effort.

The North Star is therefore:

# Evidence-backed understanding of material macro change with lower research friction.

This is an outcome direction.

It is not permission to invent a precise score before sufficient product and
user evidence exists.

---

# 8. Product value

Macro OS should create value along five dimensions.

## Trust

The user can understand where important information came from, what it
represents, how current it is, and what its limitations are.

## Research efficiency

The user spends less effort locating, validating, reconnecting, and
reconstructing relevant information.

## Research depth

The user can move from an observation into relevant history, relationships,
comparisons, events, and evidence.

## Research continuity

The user can preserve an investigation and return when new evidence arrives
without rebuilding the reasoning from scratch.

## Decision clarity

The user can distinguish:

- what is known;
- what is calculated;
- what is inferred;
- what is hypothesized;
- what is uncertain;
- what contradicts the current view;
- what evidence matters next.

These dimensions are hypotheses about product value until validated by real
usage and user evidence.

---

# 9. Product truth model

Macro OS must preserve the distinction between:

## Observation

What a source actually reports.

## Calculation

What is deterministically derived from observations.

## Relationship

An observed statistical or analytical association.

## Interpretation

What available evidence may imply.

## Hypothesis

A falsifiable possible explanation.

## Scenario

A conditional possible future.

## Unknown

Something the available evidence cannot currently resolve.

These states must not silently collapse into one another.

Correlation is not automatically causation.

Interpretation is not automatically fact.

Confidence is not evidence.

AI agreement is not independent evidence.

---

# 10. Trust invariants

Macro OS must never knowingly present:

- fabricated observations;
- mock data;
- synthetic data;
- stale data;
- estimated data;
- unsupported data;
- unverified data

as verified current reality.

Important values and claims must preserve enough context for the user to
understand, where relevant:

- source;
- identity;
- observation period;
- publication or market time;
- frequency;
- freshness;
- revision state;
- quality state;
- limitations.

Missing evidence must remain visible as missing.

Unknown must remain a valid product state.

Prefer explicit uncertainty over false precision.

---

# 11. Evidence principle

Product belief should be constrained by independent reality.

Relevant evidence may include:

- authoritative primary data;
- real product behavior;
- real usage;
- real outcomes;
- official releases;
- controlled experiments;
- expert evidence;
- user evidence;
- verified external research;
- repository and runtime evidence;
- synthetic evaluation;
- AI reasoning.

The appropriate evidence depends on the question.

The invariant is:

# Evidence generated by the system about itself is not automatically evidence about the outside world.

Multiple AI agents agreeing with one another does not establish product truth.

---

# 12. Product model

Indicators are foundational data primitives.

They are not the entire product.

Macro research may involve connected concepts such as:

- countries;
- indicators;
- assets and markets;
- events;
- evidence;
- relationships;
- historical periods;
- cycles and regimes;
- hypotheses;
- scenarios;
- research views;
- research context.

These are product concepts.

They are not architectural mandates.

The implementation should remain as simple as the product need permits.

---

# 13. Scope direction

Macro OS should eventually support the economic and market domains necessary to
understand material macro conditions.

This may include:

- growth;
- inflation;
- labor;
- monetary policy;
- rates;
- liquidity;
- credit;
- currencies;
- bonds;
- equities;
- real estate where evidence permits;
- energy;
- metals;
- agriculture;
- digital assets;
- other decision-relevant markets.

Vietnam is the initial priority market.

Global context exists to improve understanding, not to maximize geographic
coverage.

Breadth is valuable only when it improves the research loop.

---

# 14. Freshness principle

“Current” means the latest observation actually available for the relevant
source, release schedule, or market session.

It does not mean forcing all information into daily frequency.

Daily and intraday instruments should respect their actual market/session
behavior.

Official monthly, quarterly, or annual statistics should retain their real:

- observation period;
- publication date;
- revision state where relevant;
- expected release timing where known;
- freshness state.

Macro OS must not manufacture continuity where reality contains gaps.

---

# 15. Evidence-linked intelligence

When a material change is detected, Macro OS should make the relevant evidence
inspectable.

Depending on the question, evidence may include:

- official releases;
- central-bank communication;
- national statistics;
- market observations;
- disclosures;
- reserve information;
- methodology;
- reputable licensed news;
- research;
- explicitly labeled analytical hypotheses.

The product should support competing explanations.

It should not default to a single confident causal narrative merely because one
can be generated.

---

# 16. Research continuity

A useful research system should remember more than a chart.

It should make it possible to preserve enough context to understand:

- what was being investigated;
- what evidence mattered;
- what comparisons were useful;
- what interpretation existed;
- what contradicted it;
- what remained uncertain;
- what evidence was expected next;
- what changed when the investigation was revisited.

The implementation of this capability is not prescribed here.

The product outcome is.

---

# 17. Product progress

The preferred concept of progress is:

# Verified Product Progress

Product progress may include:

- resolving an important uncertainty;
- obtaining stronger evidence;
- falsifying a bad assumption;
- improving an important research workflow;
- reducing research friction;
- improving trust;
- making useful context easier to inspect;
- enabling meaningful research continuity;
- observing genuine capability consumption;
- observing a useful outcome;
- removing unnecessary complexity;
- killing a weak idea;
- deciding not to build;
- waiting when no valuable action is currently justified.

Product progress is not equivalent to:

- code written;
- features shipped;
- tasks completed;
- tests passed;
- reports generated;
- agents invoked;
- tokens consumed;
- autonomous cycles completed.

---

# 18. Investment chain

Before significant product investment, the reasoning should be traceable through:

# Product Goal
→ User Decision
→ Decision-Relevant Uncertainty
→ Evidence
→ Intervention
→ Expected User or Product Change
→ Verification

If this chain breaks, implementation should not automatically proceed.

The appropriate next action may instead be:

- observe;
- acquire evidence;
- research;
- measure;
- prototype;
- challenge;
- simplify;
- defer;
- kill;
- do nothing;
- wait.

BUILD is one possible action.

It is not the default action.

---

# 19. Decision-relevant uncertainty

The company should not ask:

> “What else can we research?”

It should ask:

# “What do we not know that could materially change an important product decision?”

An uncertainty deserves attention when resolving it could materially change:

- what problem should be addressed;
- what evidence should be trusted;
- what product investment should be made;
- what workflow should change;
- what assumption should be rejected;
- what should be monitored;
- whether the company should act at all.

The existence of an unanswered question alone does not justify work.

---

# 20. Product learning

Macro OS should improve because contact with reality changes future decisions.

The product-learning loop is:

# Observe Reality
→ Identify Important Uncertainty
→ Acquire Evidence
→ Compare Explanations
→ Decide
→ Act or Intentionally Do Nothing
→ Observe What Happened
→ Update Belief
→ Change a Future Decision

A report saying “learning occurred” is not proof of learning.

A stored memory is not proof of learning.

A changed future decision caused by evidence is stronger evidence of learning.

---

# 21. Capability claims

Technical existence must not be confused with product value.

A capability may progress through states conceptually similar to:

Defined
→ Implemented
→ Verified
→ Runtime Used
→ Research Workflow Consumed
→ Outcome Observed

The exact operational state machine belongs outside this document.

The invariant is:

# No capability should be called successful merely because it exists or passes tests.

---

# 22. Anti-goals

Macro OS does not exist to maximize:

- indicator count;
- country count;
- data volume;
- chart count;
- feature count;
- AI-generated insight count;
- prediction count;
- code volume;
- architecture sophistication;
- autonomous activity.

Macro OS should not become:

- a generic dashboard collection;
- a financial news feed;
- an AI commentary feed;
- a trading-signal factory;
- an automatic financial adviser;
- a prediction engine disguised as research;
- a Bloomberg clone measured by breadth alone.

The product should become more useful, not merely larger.

---

# 23. Architecture boundary

Architecture exists to support the Product Goal.

The Product Goal does not prescribe:

- agent topology;
- orchestration;
- queues;
- schedulers;
- worktrees;
- model providers;
- databases;
- service boundaries;
- caches;
- autonomous-company mechanics.

Those decisions belong downstream and should be justified by observed product
or operational needs.

Architectural sophistication is not product progress.

---

# 24. Product principles

Important research experiences should be:

## Traceable

Evidence and provenance can be inspected.

## Historical

Current state can be understood in context.

## Comparable

Relevant comparisons are possible when the underlying evidence supports them.

## Connected

The user can move between observations, relationships, events, evidence, and
research context.

## Explainable

Reasoning exposes evidence, assumptions, limitations, and uncertainty.

## Challengeable

The product makes it possible to inspect contradictory evidence and alternative
explanations.

## Revisable

A research view can change when reality changes.

## Continuous

Research can continue over time rather than resetting every session.

## Research-serving

A capability should ultimately improve the user's ability to understand,
investigate, challenge, synthesize, or monitor an important economic or market
question.

---

# 25. Current strategic hypothesis

The current strategic hypothesis is:

> People researching macroeconomic and investment conditions do not primarily
> need another collection of disconnected data, charts, news, and AI
> commentary.
>
> They need a trustworthy research environment that helps them detect meaningful
> change, investigate it through history and relationships, inspect supporting
> and contradictory evidence, preserve their reasoning, and know what evidence
> matters next.

This is a hypothesis.

It is expected to evolve when stronger product and user evidence becomes
available.

---

# 26. Ultimate product test

The ultimate question is not:

> How much information does Macro OS contain?

It is:

# Can Macro OS materially improve how a person understands an important macroeconomic or market question?

A strong research journey should eventually allow a user to say:

> I know what changed.

> I know where the evidence came from.

> I understand the relevant historical context.

> I can inspect the important relationships.

> I understand the strongest explanations.

> I can see evidence that challenges those explanations.

> I know what remains uncertain.

> I know what evidence matters next.

> I can return later and understand what changed.

If Macro OS repeatedly enables that experience with trustworthy evidence and
materially less research fragmentation, it is moving toward its Product Goal.

Everything else is subordinate to that outcome.

---

# 27. Change control

This document should change rarely.

Change it only when meaningful evidence changes one of the following:

- the core problem;
- the user hypothesis;
- the job to be done;
- the core research loop;
- the North Star outcome;
- the product truth model;
- the trust invariants;
- the long-term product boundary.

Do not modify this Product Goal merely because:

- the backlog changed;
- the company ran out of tasks;
- an experiment failed;
- a feature was added;
- an AI agent recommended new architecture;
- a new data source appeared;
- a temporary implementation constraint changed.

Those changes belong in downstream product artifacts.

The Product Goal must remain stable enough to guide the company while remaining
revisable when reality disproves its assumptions.
