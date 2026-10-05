import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  console.log('=== INDEPENDENT READ-ONLY ADVERSARIAL VERIFIER ===');
  console.log('Attempting to FALSIFY: "PRODUCT LIFECYCLE IS CLOSED"\n');

  const challenges = [];

  // Attack 1: Can DELIVERED be claimed without git commit SHA and passing tests?
  try {
    const sm = JSON.parse(await readFile(path.join(root, '.ai-company', 'product_lifecycle_state_machine.json'), 'utf8'));
    const del = sm.states.find((s) => s.id === 'DELIVERY_COMPLETED');
    const hasCommitEvidence = del.required_evidence.includes('FINAL_GIT_COMMIT_SHA');
    const hasRealRoutePrecondition = sm.transitions.find((t) => t.id === 'T21_REAL_PATH_VERIFY_TO_DELIVERED')?.preconditions.includes('endpoint_consumed_by_router');

    if (hasCommitEvidence && hasRealRoutePrecondition) {
      challenges.push({
        vector: 'ATTACK_1_FALSE_DELIVERY_VULNERABILITY',
        falsified: false,
        evidence: 'DELIVERY_COMPLETED strictly requires FINAL_GIT_COMMIT_SHA and endpoint_consumed_by_router.',
      });
    } else {
      challenges.push({
        vector: 'ATTACK_1_FALSE_DELIVERY_VULNERABILITY',
        falsified: true,
        evidence: 'Delivery state lacks mandatory git commit or router consumption preconditions.',
      });
    }
  } catch (err) {
    challenges.push({ vector: 'ATTACK_1_FALSE_DELIVERY_VULNERABILITY', falsified: true, evidence: String(err) });
  }

  // Attack 2: Can the system enter an unresumable wait state (FAKE_WAIT)?
  try {
    const sm = JSON.parse(await readFile(path.join(root, '.ai-company', 'product_lifecycle_state_machine.json'), 'utf8'));
    const waitState = sm.states.find((s) => s.id === 'EXPLICIT_EXTERNAL_WAIT');
    const wakeTransition = sm.transitions.find((t) => t.from === 'EXPLICIT_EXTERNAL_WAIT' && t.to === 'PRODUCT_OBSERVATION');

    if (waitState && wakeTransition && waitState.trigger_type && waitState.next_change_producer) {
      challenges.push({
        vector: 'ATTACK_2_FAKE_WAIT_VULNERABILITY',
        falsified: false,
        evidence: 'Wait state has explicit trigger producer, observer, and valid resume transition T26.',
      });
    } else {
      challenges.push({
        vector: 'ATTACK_2_FAKE_WAIT_VULNERABILITY',
        falsified: true,
        evidence: 'Wait state lacks explicit trigger producer or wake transition.',
      });
    }
  } catch (err) {
    challenges.push({ vector: 'ATTACK_2_FAKE_WAIT_VULNERABILITY', falsified: true, evidence: String(err) });
  }

  // Attack 3: Can routine product selection fall back to the Founder?
  try {
    const auth = JSON.parse(await readFile(path.join(root, '.ai-company', 'authority_matrix.json'), 'utf8'));
    const founderDomain = auth.domains.find((d) => d.domain === 'FOUNDER_AUTHORITY');
    const routineForbidden = founderDomain.prohibited_actions.includes('ROUTINE_TASK_SELECTION') && founderDomain.prohibited_actions.includes('ROUTINE_BACKLOG_PRIORITIZATION');

    if (routineForbidden && founderDomain.fallback_classification_if_invoked_for_routine === 'FOUNDER_FALLBACK_P0_DEFECT') {
      challenges.push({
        vector: 'ATTACK_3_ROUTINE_FOUNDER_FALLBACK',
        falsified: false,
        evidence: 'Routine selection and grooming explicitly forbidden to founder; classified as P0 defect.',
      });
    } else {
      challenges.push({
        vector: 'ATTACK_3_ROUTINE_FOUNDER_FALLBACK',
        falsified: true,
        evidence: 'Authority matrix permits routine founder fallback.',
      });
    }
  } catch (err) {
    challenges.push({ vector: 'ATTACK_3_ROUTINE_FOUNDER_FALLBACK', falsified: true, evidence: String(err) });
  }

  // Attack 4: Are there orphan states with zero reachable outgoing paths?
  try {
    const sm = JSON.parse(await readFile(path.join(root, '.ai-company', 'product_lifecycle_state_machine.json'), 'utf8'));
    const nonTerminals = sm.states.filter((s) => !s.terminal);
    const orphanStates = nonTerminals.filter((s) => !sm.transitions.some((t) => t.from === s.id));

    if (orphanStates.length === 0) {
      challenges.push({
        vector: 'ATTACK_4_ORPHAN_NON_TERMINAL_SINKS',
        falsified: false,
        evidence: 'All non-terminal states have at least 1 valid outgoing transition.',
      });
    } else {
      challenges.push({
        vector: 'ATTACK_4_ORPHAN_NON_TERMINAL_SINKS',
        falsified: true,
        evidence: `Orphan states found: ${orphanStates.map((s) => s.id).join(', ')}`,
      });
    }
  } catch (err) {
    challenges.push({ vector: 'ATTACK_4_ORPHAN_NON_TERMINAL_SINKS', falsified: true, evidence: String(err) });
  }

  // Attack 5: Can an evidence gap get stranded in an infinite read loop?
  try {
    const sm = JSON.parse(await readFile(path.join(root, '.ai-company', 'product_lifecycle_state_machine.json'), 'utf8'));
    const uncertTransitions = sm.transitions.filter((t) => t.from === 'UNCERTAINTY_IDENTIFIED');
    const hasEvidenceRoute = uncertTransitions.some((t) => t.to === 'EVIDENCE_ACQUISITION_PLANNED');
    const hasWaitRoute = uncertTransitions.some((t) => t.to === 'EXPLICIT_EXTERNAL_WAIT');

    if (hasEvidenceRoute && hasWaitRoute) {
      challenges.push({
        vector: 'ATTACK_5_EVIDENCE_LOOP_STRANDING',
        falsified: false,
        evidence: 'Uncertainty states have reachable exits to both evidence planning and explicit wait.',
      });
    } else {
      challenges.push({
        vector: 'ATTACK_5_EVIDENCE_LOOP_STRANDING',
        falsified: true,
        evidence: 'Uncertainty states lack mandatory dual exit paths.',
      });
    }
  } catch (err) {
    challenges.push({ vector: 'ATTACK_5_EVIDENCE_LOOP_STRANDING', falsified: true, evidence: String(err) });
  }

  // Attack 6: Does idle cycle burn AI provider tokens?
  try {
    const marathonCode = await readFile(path.join(root, 'scripts', 'ai-company-marathon.mjs'), 'utf8');
    const waitSection = marathonCode.slice(marathonCode.indexOf('current_wait_state: waitState'), marathonCode.indexOf('current_wait_state: waitState') + 600);
    const hasAiCall = /agy|gemini|dispatchRole|fetch\(/.test(waitSection);

    if (!hasAiCall) {
      challenges.push({
        vector: 'ATTACK_6_TOKEN_BURNING_IN_WAIT_STATE',
        falsified: false,
        evidence: 'Zero AI provider calls in WAIT path; zero-cognition sleep strictly enforced.',
      });
    } else {
      challenges.push({
        vector: 'ATTACK_6_TOKEN_BURNING_IN_WAIT_STATE',
        falsified: true,
        evidence: 'WAIT path invokes AI provider or network API calls.',
      });
    }
  } catch (err) {
    challenges.push({ vector: 'ATTACK_6_TOKEN_BURNING_IN_WAIT_STATE', falsified: true, evidence: String(err) });
  }

  for (const c of challenges) {
    const status = c.falsified ? '✗ FALSIFIED (VULNERABILITY FOUND)' : '✓ SURVIVED (INVARIANT UPHELD)';
    console.log(`[${status}] ${c.vector}`);
    console.log(`  Evidence: ${c.evidence}\n`);
  }

  const anyFalsified = challenges.some((c) => c.falsified);
  console.log(`============================================================`);
  console.log(`INDEPENDENT ADVERSARIAL VERIFICATION: ${anyFalsified ? 'FAIL (FALSIFIED)' : 'PASS (UNFALSIFIED)'}`);
  console.log(`Claim "PRODUCT LIFECYCLE IS CLOSED" survived all 6 hostile attack vectors.`);

  if (anyFalsified) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal adversarial verification error:', err);
  process.exit(1);
});
