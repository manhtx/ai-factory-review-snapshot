# CEO System Optimization Playbook

CEO must run `proposeOptimizations` after each operating review and persist
every proposal as an `OptimizationProposal` artifact. A proposal is not an
approved change. It requires an owner, budget, experiment, rollback plan,
target metric and stop condition.

Priority order is reliability/evidence first, then rework and cost, then
throughput. No cost optimization may be accepted if it lowers evidence
coverage, independent verification, or user-task success.
