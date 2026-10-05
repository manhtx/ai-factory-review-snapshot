#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, '.ai-company/runtime/user-telemetry.jsonl');
const output = path.join(root, '.ai-company/product-intelligence/observability-snapshot.json');
const events = await readFile(source, 'utf8')
  .then((text) => text.split('\n').filter(Boolean).map((line) => JSON.parse(line)))
  .catch((error) => (error?.code === 'ENOENT' ? [] : Promise.reject(error)));

const sessions = new Set(events.map((event) => event.sessionId));
const byType = Object.fromEntries(
  [...new Set(events.map((event) => event.eventType))].map((type) => [
    type,
    events.filter((event) => event.eventType === type).length,
  ])
);

const discoverEvents = Boolean(byType.indicator_discover);
const inspectEvents = Boolean(byType.indicator_inspect);
const compareEvents = Boolean(byType.indicator_compare);
const saveEvents = Boolean(byType.workspace_save || byType.alert_subscription);
const valueEvents = Boolean(byType.value_moment_achieved || byType.forecast_export);
const errorEvents = Boolean(byType.journey_step_error);

const fullJourneyObserved = discoverEvents && inspectEvents && compareEvents && saveEvents && valueEvents;

const snapshot = {
  generated_at: new Date().toISOString(),
  source,
  event_count: events.length,
  session_count: sessions.size,
  events_by_type: byType,
  journey_observability: {
    discover: discoverEvents,
    inspect: inspectEvents,
    compare: compareEvents,
    save_or_monitor: saveEvents,
    value_completion: valueEvents,
    error_tracking: errorEvents,
    full_funnel_supported: fullJourneyObserved,
  },
  evidence_quality: events.length > 0 && fullJourneyObserved ? 'OBSERVED_END_TO_END' : events.length ? 'PARTIAL' : 'MISSING',
  limitations: [
    'Local telemetry samples validate instrumented funnel mechanics and schema fidelity.',
    'Longitudinal user conversion requires real production traffic over time (AWAITING_REAL_EVIDENCE).',
  ],
};

await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(snapshot, null, 2));

