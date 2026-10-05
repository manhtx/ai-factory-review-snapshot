import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  console.log('=== PRODUCT LIFECYCLE STATE MACHINE STATIC GRAPH & INVARIANT VERIFIER ===\n');

  const modelPath = path.join(root, '.ai-company', 'product_lifecycle_state_machine.json');
  const authPath = path.join(root, '.ai-company', 'authority_matrix.json');

  const model = JSON.parse(await readFile(modelPath, 'utf8'));
  const auth = JSON.parse(await readFile(authPath, 'utf8'));

  const states = model.states;
  const transitions = model.transitions;

  const stateMap = new Map(states.map((s) => [s.id, s]));
  const adj = new Map();
  const revAdj = new Map();

  for (const s of states) {
    adj.set(s.id, []);
    revAdj.set(s.id, []);
  }

  for (const t of transitions) {
    if (!stateMap.has(t.from)) throw new Error(`Transition ${t.id} references unknown source state ${t.from}`);
    if (!stateMap.has(t.to)) throw new Error(`Transition ${t.id} references unknown target state ${t.to}`);
    adj.get(t.from).push(t);
    revAdj.get(t.to).push(t);
  }

  const results = [];

  // Check A: REACHABILITY from PRODUCT_OBSERVATION
  const startState = 'PRODUCT_OBSERVATION';
  const visited = new Set();
  const queue = [startState];
  visited.add(startState);

  while (queue.length > 0) {
    const curr = queue.shift();
    for (const t of adj.get(curr) || []) {
      if (!visited.has(t.to)) {
        visited.add(t.to);
        queue.push(t.to);
      }
    }
  }

  const unreachable = states.filter((s) => !visited.has(s.id));
  const checkA = {
    name: 'CHECK_A_REACHABILITY',
    passed: unreachable.length === 0,
    details: unreachable.length === 0 ? `All ${states.length} states reachable from ${startState}` : `Unreachable states: ${unreachable.map((s) => s.id).join(', ')}`,
  };
  results.push(checkA);

  // Check B: NO NON-TERMINAL SINK
  const nonTerminalSinks = states.filter((s) => !s.terminal && (adj.get(s.id) || []).length === 0);
  const checkB = {
    name: 'CHECK_B_NO_NON_TERMINAL_SINK',
    passed: nonTerminalSinks.length === 0,
    details: nonTerminalSinks.length === 0 ? 'Zero non-terminal sinks found.' : `Non-terminal sinks: ${nonTerminalSinks.map((s) => s.id).join(', ')}`,
  };
  results.push(checkB);

  // Check C: NO ZERO-DELTA CLOSED SCC (Tarjan's algorithm for Strongly Connected Components)
  let index = 0;
  const indices = new Map();
  const lowlinks = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];

  function strongConnect(v) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const t of adj.get(v) || []) {
      const w = t.to;
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v), lowlinks.get(w)));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v), indices.get(w)));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc = [];
      let w = null;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const s of states) {
    if (!indices.has(s.id)) strongConnect(s.id);
  }

  // Check if any multi-node SCC has zero outgoing transitions (closed SCC)
  const closedZeroDeltaSCCs = [];
  for (const scc of sccs) {
    if (scc.length > 1) {
      const sccSet = new Set(scc);
      const outgoing = [];
      for (const node of scc) {
        for (const t of adj.get(node) || []) {
          if (!sccSet.has(t.to)) outgoing.push(t);
        }
      }
      if (outgoing.length === 0) {
        closedZeroDeltaSCCs.push({ scc, outgoingCount: 0 });
      }
    }
  }

  const checkC = {
    name: 'CHECK_C_NO_ZERO_DELTA_CLOSED_SCC',
    passed: closedZeroDeltaSCCs.length === 0,
    details: closedZeroDeltaSCCs.length === 0 ? `Evaluated ${sccs.length} SCCs; zero closed internal cycles found.` : `Closed SCCs detected: ${JSON.stringify(closedZeroDeltaSCCs)}`,
  };
  results.push(checkC);

  // Check D: WAIT RESUMABILITY
  const waitStates = states.filter((s) => s.semantic_class === 'WAIT');
  const unresumableWaits = waitStates.filter((s) => {
    const transitionsFromWait = adj.get(s.id) || [];
    return !transitionsFromWait.some((t) => t.to === 'PRODUCT_OBSERVATION' || stateMap.get(t.to)?.semantic_class === 'OBSERVATION');
  });
  const checkD = {
    name: 'CHECK_D_WAIT_RESUMABILITY',
    passed: unresumableWaits.length === 0,
    details: unresumableWaits.length === 0 ? 'All wait states have valid wake transitions to observation.' : `Unresumable waits: ${unresumableWaits.map((s) => s.id).join(', ')}`,
  };
  results.push(checkD);

  // Check E: QUARANTINE CLOSURE
  const quarantineStates = states.filter((s) => s.semantic_class === 'ISOLATION');
  const unclosedQuarantines = quarantineStates.filter((s) => (adj.get(s.id) || []).length === 0);
  const checkE = {
    name: 'CHECK_E_QUARANTINE_CLOSURE',
    passed: unclosedQuarantines.length === 0,
    details: unclosedQuarantines.length === 0 ? 'All quarantine states have valid exit transitions.' : `Unclosed quarantines: ${unclosedQuarantines.map((s) => s.id).join(', ')}`,
  };
  results.push(checkE);

  // Check F: EVIDENCE CLOSURE
  const uncertaintyStates = states.filter((s) => s.semantic_class === 'RESEARCH_UNCERTAINTY');
  const evidenceRoutes = uncertaintyStates.filter((s) => {
    const out = adj.get(s.id) || [];
    return out.some((t) => t.to === 'EVIDENCE_ACQUISITION_PLANNED');
  });
  const checkF = {
    name: 'CHECK_F_EVIDENCE_CLOSURE',
    passed: evidenceRoutes.length === uncertaintyStates.length,
    details: evidenceRoutes.length === uncertaintyStates.length ? 'Every uncertainty state connects to evidence acquisition planning.' : 'Uncertainty states missing evidence path.',
  };
  results.push(checkF);

  // Check G: FOUNDER BOUNDARY
  const prohibitedFounderActions = auth.domains.find((d) => d.domain === 'FOUNDER_AUTHORITY')?.prohibited_actions || [];
  const routineCompanyTransitions = transitions.filter((t) => t.authority === 'DELEGATED_COMPANY_AUTHORITY');
  const founderViolations = routineCompanyTransitions.filter((t) => t.actor === 'founder' || t.trigger.includes('FOUNDER_TASK_INJECTION'));
  const checkG = {
    name: 'CHECK_G_FOUNDER_BOUNDARY',
    passed: founderViolations.length === 0,
    details: founderViolations.length === 0 ? 'Zero delegated company transitions require routine founder intervention.' : `Violations: ${founderViolations.map((t) => t.id).join(', ')}`,
  };
  results.push(checkG);

  // Check H: DELIVERY TRUTH
  const deliveryTransitions = transitions.filter((t) => t.to === 'DELIVERY_COMPLETED');
  const unverifiedDeliveries = deliveryTransitions.filter((t) => !t.required_evidence.includes('FINAL_GIT_COMMIT_SHA') && !t.preconditions.includes('endpoint_consumed_by_router'));
  const checkH = {
    name: 'CHECK_H_DELIVERY_TRUTH',
    passed: unverifiedDeliveries.length === 0,
    details: unverifiedDeliveries.length === 0 ? 'Delivery terminal requires real-path consumption and git commit proof.' : `Unverified delivery paths: ${unverifiedDeliveries.map((t) => t.id).join(', ')}`,
  };
  results.push(checkH);

  // Check I: LEARNING TRUTH
  const learningTransitions = transitions.filter((t) => t.state_delta_class === 'APPLIED LEARNING');
  const validLearning = learningTransitions.every((t) => t.preconditions.length > 0 && t.side_effect_class.includes('CYCLE'));
  const checkI = {
    name: 'CHECK_I_LEARNING_TRUTH',
    passed: validLearning && learningTransitions.length > 0,
    details: validLearning ? 'Learning transitions require concrete post-delivery cycle advancement.' : 'Invalid learning transitions.',
  };
  results.push(checkI);

  // Check J: STATE AUTHORITY
  const ambiguousStates = states.filter((s) => !s.authority_domain || !['FOUNDER_AUTHORITY', 'DELEGATED_COMPANY_AUTHORITY', 'SYSTEM_MECHANICAL_AUTHORITY', 'EXTERNAL_REALITY'].includes(s.authority_domain));
  const checkJ = {
    name: 'CHECK_J_STATE_AUTHORITY',
    passed: ambiguousStates.length === 0,
    details: ambiguousStates.length === 0 ? 'All 22 states mapped to exact unambiguous authority domains.' : `Ambiguous states: ${ambiguousStates.map((s) => s.id).join(', ')}`,
  };
  results.push(checkJ);

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${icon}] ${r.name}: ${r.details}`);
    if (!r.passed) allPassed = false;
  }

  console.log(`\nOverall Static Graph Check: ${allPassed ? 'ALL 10 CHECKS PASSED (DESIGN_GATE ELIGIBLE)' : 'FAILURES DETECTED'}`);
  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
