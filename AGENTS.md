# Project Engineering Rules

## Product direction is mandatory

[`docs/PRODUCT_GOAL.md`](docs/PRODUCT_GOAL.md) is the shared product source of
truth for this repository. Every new feature, integration, data source,
research calculation, UI workflow, and architecture change must explicitly
reference it before implementation.

Before coding:

1. identify the relevant product objective and user research question;
2. document affected modules, side effects, risks, and validation strategy;
3. use [`docs/FEATURE_PROPOSAL_TEMPLATE.md`](docs/FEATURE_PROPOSAL_TEMPLATE.md)
   for non-trivial work;
4. update `docs/PRODUCT_GOAL.md` first if the proposal changes the product
   vision, scope, priorities, or guardrails;
5. obtain approval for the proposal when the change is consequential or
   changes the documented direction.

Do not implement work that merely adds surface area without strengthening the
Macro OS research workflow or its trust model. Preserve the existing evidence,
data-state, security, licensing, and design-system rules described in the goal.

After coding, test the affected workflow and update the relevant documentation
so implementation and product direction remain consistent.

