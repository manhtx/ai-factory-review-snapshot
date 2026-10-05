import { createHash } from 'node:crypto';

export type ProductObservation = { revision: string; timestamp: string; surfaces: Array<{ surface_id: string; route: string; feature: string; journey: string; observation_status: string }>; journeys: string[]; observed_failures: string[]; evidence_references: string[]; prior_learning_references: string[]; known_unknowns: string[] };
export type OpportunityCandidate = { opportunity_id: string; discovered_at: string; product_revision: string; idea: string; user_problem: string; problem_statement: string; product_goal_objectives: string[]; affected_surface: string; affected_journey: string; affected_persona: string; evidence_ids: string[]; evidence_quality: 'STRUCTURAL' | 'RUNTIME' | 'SYNTHETIC' | 'UNKNOWN'; severity: 'HIGH' | 'MEDIUM' | 'LOW'; priority: 'P0' | 'P1' | 'P2' | 'P3'; confidence: number; expected_value: 'HIGH' | 'MEDIUM' | 'LOW'; risk: 'HIGH' | 'MEDIUM' | 'LOW'; uncertainty: string[]; estimated_scope: string[]; allowed_paths?: string[]; non_goals: string[]; acceptance_criteria: string[]; dependencies: string[]; novelty: 'NEW' | 'DUPLICATE' | 'RELATED' | 'RECURRENCE' | 'REGRESSION'; lifecycle_status: 'DISCOVERED' | 'EVIDENCE_READY' | 'PRIORITIZED' | 'SELECTED' | 'IN_PROGRESS' | 'EVALUATING' | 'WON' | 'LOST' | 'INCONCLUSIVE' | 'DEFERRED' | 'REJECTED' | 'INVALID'; pm_decision: 'PENDING' | 'PROCEED' | 'HOLD'; suggested_work_intent: 'PRODUCT_CHANGE' | 'BUG_FIX' | 'PRODUCT_DISCOVERY' };

export function createProductObservation(input: { revision: string; routes: Array<[string, string]>; failures?: string[]; evidence?: string[]; priorLearnings?: string[] }): ProductObservation {
  const journeys = ['understand-current-environment', 'inspect-indicator', 'inspect-freshness-provenance', 'compare-indicators', 'evaluate-evidence', 'compare-time-periods', 'understand-macro-regime'];
  return { revision: input.revision, timestamp: new Date().toISOString(), surfaces: input.routes.map(([route, feature]) => ({ surface_id: createHash('sha256').update(route).digest('hex').slice(0, 12), route, feature, journey: route.startsWith('/indicators') ? 'inspect-indicator' : 'understand-current-environment', observation_status: 'STRUCTURAL_OBSERVATION' })), journeys, observed_failures: input.failures ?? [], evidence_references: input.evidence ?? [], prior_learning_references: input.priorLearnings ?? [], known_unknowns: ['browser runtime error/console evidence requires an active browser capture', 'real-user telemetry is unavailable in pre-user stage'] };
}

export function discoverOpportunities(observation: ProductObservation, existingIds: string[] = []): OpportunityCandidate[] {
  const now = new Date().toISOString();
  const candidates: OpportunityCandidate[] = [];
  const evidence = new Set(observation.evidence_references);
  const hasIndicatorSurface = observation.surfaces.some((surface) => surface.route.startsWith('/indicators'));
  const add = (candidate: Omit<OpportunityCandidate, 'product_revision'> & Partial<Pick<OpportunityCandidate, 'product_revision'>>) => { if (!existingIds.includes(candidate.opportunity_id)) candidates.push({ ...candidate, product_revision: candidate.product_revision ?? observation.revision }); };
  if (hasIndicatorSurface && evidence.has('OBS-ROUTE-INDICATOR-DETAIL') && evidence.has('PRODUCT_GOAL-TRUST')) add({ opportunity_id: 'OPP-PROVENANCE-TRACEABILITY', discovered_at: now, idea: 'Make every indicator observation auditable from value to source and freshness.', user_problem: 'A researcher cannot reliably inspect where a displayed value came from or whether it is current.', problem_statement: 'Users need an explicit, inspectable provenance path from indicator value to source and freshness state.', product_goal_objectives: ['truthful macro research', 'evidence and provenance', 'latest-available observations'], affected_surface: '/indicators/:id', affected_journey: 'inspect-freshness-provenance', affected_persona: 'Professional Analyst', evidence_ids: ['OBS-ROUTE-INDICATOR-DETAIL', 'PRODUCT_GOAL-TRUST'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.78, expected_value: 'HIGH', risk: 'MEDIUM', uncertainty: ['runtime interaction coverage', 'task success baseline'], estimated_scope: ['indicator detail provenance state', 'deterministic browser acceptance'], allowed_paths: ['src/app/pages/IndicatorDetailPage.tsx', 'src/app/components/indicators/IndicatorCard.tsx', 'server/freshness.ts', 'server/freshness.test.ts'], non_goals: ['adding providers', 'changing production data'], acceptance_criteria: ['source remains inspectable for delayed data', 'current claims fail closed', 'independent browser evidence recorded'], dependencies: ['source metadata'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (hasIndicatorSurface && evidence.has('OBS-ROUTE-INDICATOR-DETAIL') && evidence.has('FRESHNESS-CONTRACT')) add({ opportunity_id: 'OPP-FRESHNESS-COMPREHENSION', discovered_at: now, idea: 'Make freshness states consistently understandable across indicator surfaces.', user_problem: 'Researchers may mistake delayed, unavailable, or stale data for current data.', problem_statement: 'Freshness and unavailable states may not be equally understandable across research surfaces.', product_goal_objectives: ['truthful macro research', 'explicit freshness'], affected_surface: '/indicators/:id', affected_journey: 'inspect-freshness-provenance', affected_persona: 'Time-Constrained Executive', evidence_ids: ['OBS-ROUTE-INDICATOR-DETAIL', 'FRESHNESS-CONTRACT'], evidence_quality: 'STRUCTURAL', severity: 'MEDIUM', priority: 'P2', confidence: 0.65, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['cross-surface consistency'], estimated_scope: ['freshness display contract', 'browser evaluation'], allowed_paths: ['src/app/pages/IndicatorDetailPage.tsx', 'src/app/components/indicators/IndicatorCard.tsx', 'server/freshness.ts', 'server/freshness.test.ts'], non_goals: ['changing release schedules without provider evidence'], acceptance_criteria: ['fresh/stale/unavailable states are distinct', 'no stale value is labeled current'], dependencies: ['freshness metadata'], novelty: 'RELATED', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (observation.observed_failures.includes('core-pce-us contains duplicate observation periods in the runtime payload') && evidence.has('RUNTIME-SERIES-DUPLICATES')) add({ opportunity_id: 'OPP-SERIES-PERIOD-UNIQUENESS', discovered_at: now, idea: 'Canonicalize repeated periods before calculating trends and turning points.', user_problem: 'Duplicate observations for one period can distort comparisons, volatility, and turning-point summaries.', problem_statement: 'Runtime series payloads must contain one canonical observation per period before product calculations.', product_goal_objectives: ['truthful macro research', 'evidence and provenance'], affected_surface: '/indicators/core-pce-us', affected_journey: 'inspect-indicator', affected_persona: 'Professional Analyst', evidence_ids: ['RUNTIME-SERIES-DUPLICATES', 'OBS-ROUTE-INDICATOR-DETAIL'], evidence_quality: 'RUNTIME', severity: 'HIGH', priority: 'P1', confidence: 0.92, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['provider vintage selection semantics'], estimated_scope: ['series hydration canonicalization', 'regression tests', 'turning-point recalculation'], allowed_paths: ['server/index.ts', 'server/index.test.ts'], non_goals: ['changing provider data', 'deduplicating durable source rows destructively'], acceptance_criteria: ['one displayed point per period', 'newest provider-ordered value wins', 'snapshot/trend calculations use canonical series', 'regression test covers duplicate periods'], dependencies: ['provider ordering contract'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'BUG_FIX' });
  if (evidence.has('OBS-DASHBOARD') && evidence.has('PRODUCT_GOAL-RESEARCH-USEFULNESS')) add({ opportunity_id: 'OPP-RESEARCH-FUNNEL', discovered_at: now, idea: 'Reduce friction from overview to supporting evidence.', user_problem: 'A researcher may not be able to move from a macro overview to the evidence needed to validate a conclusion.', problem_statement: 'The path from overview to supporting evidence should be measurable and low-friction.', product_goal_objectives: ['research usefulness', 'evidence and provenance'], affected_surface: '/dashboard', affected_journey: 'understand-current-environment', affected_persona: 'Macro Beginner', evidence_ids: ['OBS-DASHBOARD', 'PRODUCT_GOAL-RESEARCH-USEFULNESS'], evidence_quality: 'STRUCTURAL', severity: 'MEDIUM', priority: 'P2', confidence: 0.58, expected_value: 'MEDIUM', risk: 'MEDIUM', uncertainty: ['runtime funnel completion'], estimated_scope: ['dashboard-to-evidence flow', 'synthetic task baseline'], allowed_paths: ['src/app/pages/MacroDashboard.tsx', 'src/app/components/dashboard/MacroExecutiveBrief.tsx', 'src/app/data/index.ts'], non_goals: ['inventing adoption claims'], acceptance_criteria: ['baseline funnel is recorded', 'navigation path is browser-verified'], dependencies: ['existing telemetry'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_DISCOVERY' });
  if (evidence.has('RUNTIME-SCHEDULER-6H')) add({ opportunity_id: 'OPP-INGESTION-CADENCE', discovered_at: now, idea: 'Align scheduled ingestion with provider release cadence and daily intelligence needs.', user_problem: 'A six-hour polling interval may delay newly published observations or waste calls for slow-moving series.', problem_statement: 'Provider-specific ingestion cadence should be evidence-driven so current data arrives promptly without unnecessary token or API cost.', product_goal_objectives: ['latest-available observations', 'daily intelligence', 'provider-specific data planes'], affected_surface: '/data-sources', affected_journey: 'understand-current-environment', affected_persona: 'Professional Analyst', evidence_ids: ['RUNTIME-SCHEDULER-6H', 'PRODUCT_GOAL-TRUST'], evidence_quality: 'RUNTIME', severity: 'MEDIUM', priority: 'P1', confidence: 0.82, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['per-provider publication schedules', 'API quota impact'], estimated_scope: ['scheduler cadence policy', 'provider release calendar', 'bounded ingestion tests'], allowed_paths: ['server/scheduler.ts', 'server/scheduler.test.ts', 'server/ingestion.ts', 'server/ingestion.test.ts'], non_goals: ['unbounded polling', 'changing provider credentials'], acceptance_criteria: ['cadence is configurable per provider class', 'daily/slow series are not polled wastefully', 'new releases are picked up within declared SLA', 'tests prove bounded request budget'], dependencies: ['provider schedules', 'ingestion telemetry'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-RELATIONSHIPS') && evidence.has('PRODUCT_GOAL-COMOVEMENT')) add({ opportunity_id: 'OPP-COMOVEMENT-PROVENANCE', discovered_at: now, idea: 'Provide observable frequency-domain evidence for macro comovement and decoupling.', user_problem: 'Users see correlation metrics without knowing which economic cycles drive the relationship.', problem_statement: 'Macro relationship comovement must link multi-resolution wavelet scales to observable economic cycle frequencies.', product_goal_objectives: ['truthful macro research', 'relationships and cycles', 'evidence and provenance'], affected_surface: '/relationships', affected_journey: 'compare-indicators', affected_persona: 'Investment Research Analyst', evidence_ids: ['OBS-ROUTE-RELATIONSHIPS', 'PRODUCT_GOAL-COMOVEMENT'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.85, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['statistical significance bounds'], estimated_scope: ['wavelet comovement engine', 'relationships widget', 'unit tests'], allowed_paths: ['src/app/data/macroWaveletComovement.ts', 'src/app/data/macroWaveletComovement.test.ts', 'src/app/pages/RelationshipsPage.tsx'], non_goals: ['predictive market timing claims'], acceptance_criteria: ['decomposition into 4 Haar scale levels', 'statistical significance and decoupling signals visible', 'unit test coverage verified'], dependencies: ['indicator series data'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-COUNTRIES') && evidence.has('PRODUCT_GOAL-CROSS-COUNTRY')) add({ opportunity_id: 'OPP-COUNTRY-COMPARISON-NORMALIZATION', discovered_at: now, idea: 'Standardize cross-country macro comparisons with clear frequency and vintage labeling.', user_problem: 'Comparing indicators across different economies (e.g. US vs Vietnam) can mislead if units or release lags differ.', problem_statement: 'Cross-country explorer must explicitly surface observation dates, normalized units, and lag differences.', product_goal_objectives: ['canonical ontology', 'cross-country comparability', 'truthful macro research'], affected_surface: '/countries', affected_journey: 'compare-indicators', affected_persona: 'Economist', evidence_ids: ['OBS-ROUTE-COUNTRIES', 'PRODUCT_GOAL-CROSS-COUNTRY'], evidence_quality: 'STRUCTURAL', severity: 'MEDIUM', priority: 'P2', confidence: 0.75, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['indicator alignment across national statistical agencies'], estimated_scope: ['country comparison normalization', 'unit consistency check'], allowed_paths: ['src/app/pages/CountryExplorerPage.tsx', 'src/app/data/index.ts'], non_goals: ['arbitrary currency translations without source rates'], acceptance_criteria: ['unit normalization visible', 'observation dates juxtaposed', 'regression test for cross-country alignment'], dependencies: ['country ontology'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-DATA-SOURCES') && evidence.has('PRODUCT_GOAL-DATA-HEALTH')) add({ opportunity_id: 'OPP-DATA-HEALTH-TRANSPARENCY', discovered_at: now, idea: 'Expose live data provider health, quarantine state, and contract validation directly to researchers.', user_problem: 'Researchers cannot tell whether a missing data series is due to provider outage, quarantine, or unreleased data.', problem_statement: 'Data sources management surface must distinguish active, delayed, and quarantined series fail-closed.', product_goal_objectives: ['provider portfolio governance', 'provenance and freshness', 'explicit data-quality states'], affected_surface: '/data-sources', affected_journey: 'evaluate-evidence', affected_persona: 'Data Trust / Evidence Expert', evidence_ids: ['OBS-ROUTE-DATA-SOURCES', 'PRODUCT_GOAL-DATA-HEALTH'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.88, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['provider status latency'], estimated_scope: ['data sources status table', 'quarantine indicator display'], allowed_paths: ['src/app/pages/DataSourcesPage.tsx', 'server/index.ts'], non_goals: ['bypassing quarantine without evidence'], acceptance_criteria: ['quarantined sources explicitly flagged', 'no quarantined source served as verified', 'health probe integration verified'], dependencies: ['quarantine contracts'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-REGIMES') && evidence.has('PRODUCT_GOAL-MACRO-REGIME')) add({ opportunity_id: 'OPP-REGIME-DETECTION-GROUNDING', discovered_at: now, idea: 'Ground macro regime probabilities with observable indicator thresholds.', user_problem: 'Analysts cannot verify why an economy is classified into expansion, slowdown, contraction, or recovery.', problem_statement: 'Macro regime detection must trace classification states directly to indicator observations and threshold boundaries.', product_goal_objectives: ['truthful macro research', 'understand macro regime', 'fact/inference separation'], affected_surface: '/regimes', affected_journey: 'understand-macro-regime', affected_persona: 'Macro Strategist', evidence_ids: ['OBS-ROUTE-REGIMES', 'PRODUCT_GOAL-MACRO-REGIME'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.86, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['regime boundary transition delay'], estimated_scope: ['regime classification threshold engine', 'unit tests'], allowed_paths: ['src/app/data/regimeDetection.ts', 'src/app/data/regimeDetection.test.ts', 'src/app/pages/RegimeDetectionPage.tsx'], non_goals: ['opaque black-box regime outputs'], acceptance_criteria: ['observable thresholds displayed', 'classification state matches documented rule', 'targeted tests pass'], dependencies: ['indicator series data'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-SCENARIOS') && evidence.has('PRODUCT_GOAL-STRESS-TEST')) add({ opportunity_id: 'OPP-SCENARIO-STRESS-TESTING', discovered_at: now, idea: 'Provide deterministic stress tests comparing baseline against macro shock scenarios.', user_problem: 'Risk managers cannot tell whether simulated shocks adhere to historical empirical correlations.', problem_statement: 'Scenario analysis must preserve baseline-versus-shock comparability and explicit correlation boundaries.', product_goal_objectives: ['stress-testing and risk', 'truthful macro research', 'evidence and provenance'], affected_surface: '/scenarios', affected_journey: 'evaluate-evidence', affected_persona: 'Risk Manager', evidence_ids: ['OBS-ROUTE-SCENARIOS', 'PRODUCT_GOAL-STRESS-TEST'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.84, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['nonlinear contagion elasticity'], estimated_scope: ['scenario stress generator', 'shock comparison logic', 'unit tests'], allowed_paths: ['src/app/data/scenarioStressGenerator.ts', 'src/app/data/scenarioStressGenerator.test.ts', 'src/app/pages/ScenarioAnalysisPage.tsx'], non_goals: ['arbitrary manual shock multipliers'], acceptance_criteria: ['baseline and shocked paths clearly differentiated', 'empirical elasticity bounds enforced', 'targeted tests pass'], dependencies: ['stress shock templates'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-SIMILARITY') && evidence.has('PRODUCT_GOAL-HISTORICAL-SIMILARITY')) add({ opportunity_id: 'OPP-HISTORICAL-SIMILARITY-DISTANCE', discovered_at: now, idea: 'Surface inspectable statistical distance metrics for historical analog matching.', user_problem: 'Researchers cannot verify why a past episode is identified as similar to current conditions.', problem_statement: 'Historical similarity engine must display component-level distance metrics and time-horizon coverage.', product_goal_objectives: ['historical crisis libraries', 'evidence and provenance', 'canonical methodology'], affected_surface: '/similarity', affected_journey: 'compare-time-periods', affected_persona: 'Senior Economist', evidence_ids: ['OBS-ROUTE-SIMILARITY', 'PRODUCT_GOAL-HISTORICAL-SIMILARITY'], evidence_quality: 'STRUCTURAL', severity: 'MEDIUM', priority: 'P2', confidence: 0.80, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['sampling frequency variance'], estimated_scope: ['historical similarity distance engine', 'unit tests'], allowed_paths: ['src/app/data/historicalSimilarity.ts', 'src/app/data/historicalSimilarity.test.ts', 'src/app/pages/HistoricalSimilarityPage.tsx'], non_goals: ['claiming identical economic recurrence'], acceptance_criteria: ['Euclidean/DTW distance visible', 'vintage boundaries respected', 'targeted tests pass'], dependencies: ['crisis episode data'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-CYCLES') && evidence.has('PRODUCT_GOAL-CYCLE-DETECTION')) add({ opportunity_id: 'OPP-BUSINESS-CYCLE-TURNING-POINTS', discovered_at: now, idea: 'Detect business cycle peaks, troughs, and turning points with explicit lag transparency.', user_problem: 'Users cannot distinguish between confirmed cyclical turning points and preliminary revisions.', problem_statement: 'Business cycle engine must explicitly indicate confirmation lag and revision confidence.', product_goal_objectives: ['relationships and cycles', 'truthful macro research'], affected_surface: '/cycles', affected_journey: 'compare-time-periods', affected_persona: 'Investment Strategist', evidence_ids: ['OBS-ROUTE-CYCLES', 'PRODUCT_GOAL-CYCLE-DETECTION'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.83, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['NBER / OECD revision lag'], estimated_scope: ['business cycle detector', 'turning point indicator', 'unit tests'], allowed_paths: ['src/app/data/businessCycleDetector.ts', 'src/app/data/businessCycleDetector.test.ts', 'src/app/pages/HistoricalCyclesPage.tsx'], non_goals: ['premature peak declarations without revision data'], acceptance_criteria: ['turning points dated explicitly', 'preliminary versus confirmed status distinct', 'targeted tests pass'], dependencies: ['cycle definition ontologies'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-SCORECARDS') && evidence.has('PRODUCT_GOAL-FACTOR-ATTRIBUTION')) add({ opportunity_id: 'OPP-FACTOR-ATTRIBUTION-INTEGRITY', discovered_at: now, idea: 'Calculate multi-factor macro risk attribution without synthetic filler or arbitrary weights.', user_problem: 'Analysts cannot inspect the weight and factor contributions of sovereign risk scorecards.', problem_statement: 'Scorecard risk factors must provide inspectable contribution breakdowns backed by empirical data.', product_goal_objectives: ['risk scorecards', 'truthful macro research', 'cross-country comparability'], affected_surface: '/scorecards', affected_journey: 'understand-current-environment', affected_persona: 'Credit Analyst', evidence_ids: ['OBS-ROUTE-SCORECARDS', 'PRODUCT_GOAL-FACTOR-ATTRIBUTION'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.87, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['factor missingness handling'], estimated_scope: ['multi-factor attribution engine', 'scorecard display', 'unit tests'], allowed_paths: ['src/app/data/multiFactorAttribution.ts', 'src/app/data/multiFactorAttribution.test.ts', 'src/app/pages/ScorecardsPage.tsx'], non_goals: ['inventing default scores for missing countries'], acceptance_criteria: ['factor weights inspectable', 'missing indicators produce explicit unknown state', 'targeted tests pass'], dependencies: ['indicator metadata'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-FORECASTS') && evidence.has('PRODUCT_GOAL-FORECAST-TRUST')) add({ opportunity_id: 'OPP-FORECAST-EVALUATION-TRUST', discovered_at: now, idea: 'Track forecast accuracy and revisions against actual observed outcomes fail-closed.', user_problem: 'Institutional researchers cannot audit historical forecast performance across revision vintages.', problem_statement: 'Forecast center must evaluate accuracy against verified historical releases with clear error metrics.', product_goal_objectives: ['truthful macro research', 'forecast evaluation', 'fact/inference separation'], affected_surface: '/forecasts', affected_journey: 'evaluate-evidence', affected_persona: 'Portfolio Manager', evidence_ids: ['OBS-ROUTE-FORECASTS', 'PRODUCT_GOAL-FORECAST-TRUST'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.85, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['vintage release revision lag'], estimated_scope: ['forecast trust calculation', 'revision evaluation', 'unit tests'], allowed_paths: ['src/app/data/forecastTrust.ts', 'src/app/data/forecastTrust.test.ts', 'src/app/pages/ForecastCenterPage.tsx'], non_goals: ['predictive market timing'], acceptance_criteria: ['MAE / RMSE calculated from verified releases', 'unverified forecasts labeled pending', 'targeted tests pass'], dependencies: ['forecast history'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-MONITORING') && evidence.has('PRODUCT_GOAL-LIQUIDITY-CASCADE')) add({ opportunity_id: 'OPP-LIQUIDITY-CONTAGION-MODELING', discovered_at: now, idea: 'Model cross-market liquidity contagion and cascade thresholds transparently.', user_problem: 'Traders and risk officers lack early warning indicators for sovereign and interbank liquidity cascades.', problem_statement: 'Liquidity contagion model must surface transmission channels and stress thresholds without black-box claims.', product_goal_objectives: ['crisis models', 'truthful macro research', 'evidence and provenance'], affected_surface: '/monitoring', affected_journey: 'evaluate-evidence', affected_persona: 'Liquidity Risk Officer', evidence_ids: ['OBS-ROUTE-MONITORING', 'PRODUCT_GOAL-LIQUIDITY-CASCADE'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.81, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['interbank market stress spread speed'], estimated_scope: ['liquidity cascade contagion engine', 'monitoring widget', 'unit tests'], allowed_paths: ['src/app/data/liquidityCascadeContagion.ts', 'src/app/data/liquidityCascadeContagion.test.ts', 'src/app/pages/MonitoringPage.tsx'], non_goals: ['guaranteeing crisis detection'], acceptance_criteria: ['contagion stages visible', 'cascade thresholds explicit', 'targeted tests pass'], dependencies: ['financial stress indicators'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-FED') && evidence.has('PRODUCT_GOAL-CENTRAL-BANK')) add({ opportunity_id: 'OPP-CENTRAL-BANK-DIFF-ALIGNMENT', discovered_at: now, idea: 'Separate factual central bank rate shifts from qualitative hawkish/dovish scores.', user_problem: 'Central bank sentiment scoring can hallucinate hawkish tilt without explicit statement quotes.', problem_statement: 'Fed and central bank intelligence must anchor sentiment scores in side-by-side statement diff quotes.', product_goal_objectives: ['truthful macro research', 'qualitative evidence', 'fact/inference separation'], affected_surface: '/fed-intelligence', affected_journey: 'understand-current-environment', affected_persona: 'Central Bank Watcher', evidence_ids: ['OBS-ROUTE-FED', 'PRODUCT_GOAL-CENTRAL-BANK'], evidence_quality: 'STRUCTURAL', severity: 'MEDIUM', priority: 'P2', confidence: 0.84, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['multilingual central bank transcription'], estimated_scope: ['central bank qualitative evidence diff', 'unit tests'], allowed_paths: ['server/qualitativeEvidence.ts', 'server/qualitativeEvidence.test.ts', 'src/app/pages/FedIntelligencePage.tsx'], non_goals: ['predicting rate decisions ahead of meetings'], acceptance_criteria: ['exact statement quote citations visible', 'confidence score bounded', 'targeted tests pass'], dependencies: ['statement transcripts'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-WATCHLIST') && evidence.has('PRODUCT_GOAL-WATCHLIST')) add({ opportunity_id: 'OPP-WATCHLIST-THRESHOLD-ALERT', discovered_at: now, idea: 'Provide deterministic indicator alert triggers and state change notifications.', user_problem: 'Users cannot configure custom threshold alerts on key macroeconomic releases.', problem_statement: 'Watchlist surface must evaluate threshold triggers fail-closed and preserve notification history.', product_goal_objectives: ['macro os research workflow', 'daily intelligence', 'evidence and provenance'], affected_surface: '/watchlist', affected_journey: 'evaluate-evidence', affected_persona: 'Macro Analyst', evidence_ids: ['OBS-ROUTE-WATCHLIST', 'PRODUCT_GOAL-WATCHLIST'], evidence_quality: 'STRUCTURAL', severity: 'MEDIUM', priority: 'P2', confidence: 0.82, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['user session state persistence'], estimated_scope: ['watchlist state store', 'threshold alerts', 'unit tests'], allowed_paths: ['src/app/data/watchlist.ts', 'src/app/data/watchlist.test.ts', 'src/app/pages/WatchlistPage.tsx'], non_goals: ['automated trade execution'], acceptance_criteria: ['threshold breaches recorded', 'stale indicators flagged', 'targeted tests pass'], dependencies: ['indicator series data'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (evidence.has('OBS-ROUTE-WORKSPACES') && evidence.has('PRODUCT_GOAL-WORKSPACES')) add({ opportunity_id: 'OPP-WORKSPACE-RESEARCH-LOG-REPRODUCIBILITY', discovered_at: now, idea: 'Capture reproducible analytical state snapshots for institutional research logs.', user_problem: 'Research notes lack frozen indicator vintages and reproducible calculation formulas.', problem_statement: 'Workspace logs must bind charts, transformations, and observations to immutable revision hashes.', product_goal_objectives: ['research reproducibility', 'evidence and provenance', 'truthful macro research'], affected_surface: '/workspaces', affected_journey: 'evaluate-evidence', affected_persona: 'Institutional Research Director', evidence_ids: ['OBS-ROUTE-WORKSPACES', 'PRODUCT_GOAL-WORKSPACES'], evidence_quality: 'STRUCTURAL', severity: 'HIGH', priority: 'P1', confidence: 0.86, expected_value: 'HIGH', risk: 'LOW', uncertainty: ['workspace payload serialization'], estimated_scope: ['workspace research log', 'reproducibility snapshots', 'unit tests'], allowed_paths: ['src/app/data/workspaceResearchLog.ts', 'src/app/data/workspaceResearchLog.test.ts', 'src/app/pages/WorkspacesPage.tsx'], non_goals: ['arbitrary binary blob storage'], acceptance_criteria: ['snapshot hash generated', 'observation date recorded', 'targeted tests pass'], dependencies: ['workspace state store'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_CHANGE' });
  if (!candidates.length && (evidence.size > 0 || observation.surfaces.length > 0)) {
    candidates.push({
      opportunity_id: 'OPP-PROVENANCE-REGRESSION-AUDIT',
      discovered_at: now,
      idea: 'Re-audit indicator detail provenance contracts after multi-epoch operations.',
      user_problem: 'Continuous evolution may introduce subtle regressions in core indicator provenance contracts.',
      problem_statement: 'Core indicator provenance and freshness contracts must undergo periodic regression auditing.',
      product_goal_objectives: ['truthful macro research', 'evidence and provenance', 'regression protection'],
      affected_surface: '/indicators/:id',
      affected_journey: 'inspect-freshness-provenance',
      affected_persona: 'Chief Risk Officer',
      evidence_ids: ['OBS-ROUTE-INDICATOR-DETAIL', 'PRODUCT_GOAL-TRUST'],
      evidence_quality: 'STRUCTURAL',
      severity: 'HIGH',
      priority: 'P1',
      confidence: 0.90,
      expected_value: 'HIGH',
      risk: 'LOW',
      uncertainty: ['cross-epoch drift'],
      estimated_scope: ['indicator detail regression verification', 'targeted tests'],
      allowed_paths: ['src/app/pages/IndicatorDetailPage.tsx', 'server/freshness.ts', 'server/freshness.test.ts'],
      non_goals: ['introducing untested schema migrations'],
      acceptance_criteria: ['provenance contracts remain unbroken', 'freshness semantics verified', 'targeted tests pass'],
      dependencies: ['freshness contracts'],
      novelty: 'REGRESSION',
      lifecycle_status: 'EVIDENCE_READY',
      pm_decision: 'PENDING',
      suggested_work_intent: 'PRODUCT_CHANGE',
      product_revision: observation.revision
    });
  }
  return candidates.filter((candidate) => candidate.novelty !== 'DUPLICATE');
}

/** Convert one Product Frontier gap into a PM-gated discovery opportunity. */
export function discoverFrontierGapOpportunity(input: {
  gap: { gap_id: string; domain: string; severity: 'P0' | 'P1' | 'P2' | 'P3'; description: string; candidate_opportunity: string };
  observation: ProductObservation;
  existingIds?: string[];
}): OpportunityCandidate | null {
  const { gap, observation } = input;
  if (!gap.gap_id || !gap.description || !gap.candidate_opportunity) return null;
  if ((input.existingIds ?? []).includes(gap.candidate_opportunity)) return null;
  return {
    opportunity_id: gap.candidate_opportunity,
    discovered_at: new Date().toISOString(), product_revision: observation.revision,
    idea: gap.description, user_problem: gap.description,
    problem_statement: `Product frontier gap requires evidence-backed scoping before implementation: ${gap.description}`,
    product_goal_objectives: ['truthful macro research', 'evidence and provenance', gap.domain.toLowerCase()],
    affected_surface: 'product-frontier', affected_journey: 'evaluate-evidence', affected_persona: 'Professional Analyst',
    evidence_ids: [`FRONTIER:${gap.gap_id}`, 'PRODUCT_GOAL-TRUST', `PRODUCT_REVISION:${observation.revision}`],
    evidence_quality: 'STRUCTURAL', severity: gap.severity === 'P0' || gap.severity === 'P1' ? 'HIGH' : gap.severity === 'P2' ? 'MEDIUM' : 'LOW', priority: gap.severity,
    confidence: 0.65, expected_value: 'HIGH', risk: 'LOW',
    uncertainty: ['runtime product impact', 'implementation scope', 'provider or licensing dependencies'],
    estimated_scope: ['PM discovery and evidence review', 'bounded product experiment', 'deterministic acceptance tests'],
    allowed_paths: ['docs/product/PRODUCT_FRONTIER.json', '.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json'],
    non_goals: ['automatic implementation authorization', 'inventing user adoption or provider evidence'],
    acceptance_criteria: ['PM reviews Product Goal lineage', 'missing evidence is explicitly recorded', 'no build commitment occurs before qualification'],
    dependencies: ['Product Goal review', 'evidence-backed scope'], novelty: 'NEW', lifecycle_status: 'EVIDENCE_READY', pm_decision: 'PENDING', suggested_work_intent: 'PRODUCT_DISCOVERY',
  };
}

export function selectOpportunity(candidates: OpportunityCandidate[]): OpportunityCandidate | null {
  if (!candidates.length) return null;
  const noveltyWeight = { REGRESSION: 4, RECURRENCE: 3, NEW: 2, RELATED: 1, DUPLICATE: 0 };
  const expectedValueWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const priorityWeight = { P0: 4, P1: 3, P2: 2, P3: 1 };
  return [...candidates].sort((a, b) => {
    const noveltyDiff = (noveltyWeight[b.novelty] ?? 0) - (noveltyWeight[a.novelty] ?? 0);
    if (noveltyDiff !== 0) return noveltyDiff;
    const evDiff = (expectedValueWeight[b.expected_value] ?? 0) - (expectedValueWeight[a.expected_value] ?? 0);
    if (evDiff !== 0) return evDiff;
    const prioDiff = (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
    if (prioDiff !== 0) return prioDiff;
    return b.confidence - a.confidence;
  })[0] ?? null;
}

// ============================================================================
// REGENERATIVE DISCOVERY & DECISION-RELEVANT UNCERTAINTY (Protocol V2 / V3)
// ============================================================================

export type SearchLensType =
  | 'GOAL_COVERAGE'
  | 'PRODUCT_REALITY'
  | 'CONSUMPTION_INTEGRITY'
  | 'EVIDENCE_INTEGRITY'
  | 'GOLDEN_JOURNEYS';

export interface RegenerativeProductQuestion {
  id: string; // e.g. "RQ-..."
  question: string;
  goal_lineage: string;
  reality_trigger: string;
  decision_at_stake: string;
  current_belief: string;
  known_evidence: string[];
  counterevidence?: string[];
  important_unknown: string;
  falsifier: string;
  evidence_path: string;
  reality_revision: string;
  evidence_revision: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'HELD' | 'KILLED';
  search_lens: SearchLensType;
  created_at: string;
}

export interface DecisionRelevantUncertainty {
  uncertainty_id: string;
  search_lens: SearchLensType;
  uncertainty: string;
  decision_at_stake: string;
  why_it_matters: string;
  goal_lineage: string;
  is_material: boolean;
  evidence_path: string;
  reality_trigger: string;
  current_belief: string;
  falsifier: string;
  known_evidence: string[];
}

export interface DiscoveryAdmissionResult {
  admitted: boolean;
  goal_relevance_score: number;
  decision_leverage: 'HIGH' | 'MEDIUM' | 'LOW';
  expected_information_value: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence_accessibility: 'ACCESSIBLE' | 'REQUIRES_PROBE' | 'INACCESSIBLE';
  resource_bound_cycles: number;
  reason: string;
}

export interface ProductGoalSpecification {
  objectives: Array<{ id: number; text: string }>;
  priorities: Array<{ rank: number; title: string; description: string }>;
  coreTenets: string[];
  rawGoalText: string;
}

export interface ProductRealitySpecification {
  revision: string;
  catalogIndicatorCount: number;
  hydratedIndicatorCount: number;
  unhydratedIndicatorIds: string[];
  quarantinedSourceCount: number;
  quarantinedSourceIds: string[];
  unconsumedModules: string[];
  activeHoldContracts: Array<{ id: string; hold_reason: string; permitted_next_action: string; evidence_gap: string }>;
  goldenJourneys: Array<{ id: string; name: string; current_maturity: string; blockers: string[] }>;
  routeCount: number;
  auditStatus: string;
  telemetryRowCount: number;
}

/**
 * Evaluates Discovery Admission (Section 11).
 * Asks: Is learning about this uncertainty worth bounded resources?
 */
export function evaluateDiscoveryAdmission(uncertainty: DecisionRelevantUncertainty): DiscoveryAdmissionResult {
  const isGoalAligned = uncertainty.goal_lineage.length > 10;
  const isActionable = uncertainty.evidence_path.length > 5;
  const score = (isGoalAligned ? 50 : 0) + (uncertainty.is_material ? 30 : 0) + (isActionable ? 20 : 0);
  const admitted = score >= 70 && uncertainty.decision_at_stake.length > 10;
  return {
    admitted,
    goal_relevance_score: score,
    decision_leverage: uncertainty.is_material ? 'HIGH' : 'LOW',
    expected_information_value: isActionable ? 'HIGH' : 'LOW',
    evidence_accessibility: isActionable ? 'ACCESSIBLE' : 'INACCESSIBLE',
    resource_bound_cycles: 1,
    reason: admitted
      ? `Admitted under lens ${uncertainty.search_lens}: high decision leverage for '${uncertainty.decision_at_stake}'.`
      : `Rejected: insufficient goal relevance or missing decision leverage.`,
  };
}

/**
 * Computes semantic discovery fingerprint (Section 15).
 * Detects whether any decision-relevant aspect of Goal, Reality, Questions, or Backlog has changed.
 */
export function computeSemanticDiscoveryFingerprint(input: {
  goalText: string;
  realityHash: string;
  questionIds: string[];
  candidateIds: string[];
  runwayState: string;
  deliveredIds: string[];
}): string {
  const payload = [
    createHash('sha256').update(input.goalText.trim()).digest('hex'),
    input.realityHash,
    [...input.questionIds].sort().join(','),
    [...input.candidateIds].sort().join(','),
    input.runwayState,
    [...input.deliveredIds].sort().join(','),
  ].join('::');
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Parses authoritative docs/PRODUCT_GOAL.md into structured objectives and priorities.
 */
export function parseProductGoal(goalText: string): ProductGoalSpecification {
  const objectives: Array<{ id: number; text: string }> = [];
  const priorities: Array<{ rank: number; title: string; description: string }> = [];
  const coreTenets: string[] = [];

  const lines = goalText.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.replace('## ', '').toLowerCase();
      continue;
    }

    if (currentSection.includes('core product objectives')) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (match) {
        objectives.push({ id: Number(match[1]), text: match[2] });
      }
    } else if (currentSection.includes('scope and priorities')) {
      const match = trimmed.match(/^(\d+)\.\s+\*\*(.*?)\*\*(.*)$/);
      if (match) {
        priorities.push({ rank: Number(match[1]), title: match[2].trim(), description: match[3].trim() });
      }
    } else if (currentSection.includes('product philosophy')) {
      if (trimmed.startsWith('- ')) {
        coreTenets.push(trimmed.replace('- ', ''));
      }
    }
  }

  return {
    objectives,
    priorities,
    coreTenets,
    rawGoalText: goalText,
  };
}

/**
 * Evaluates the 5 Search Lenses (Section 8) to discover decision-relevant uncertainties
 * without hardcoded topic injection.
 */
export function evaluateSearchLenses(params: {
  goal: ProductGoalSpecification;
  reality: ProductRealitySpecification;
  existingIds: Set<string>;
  existingQuestions?: Array<{ id: string; question: string }>;
}): DecisionRelevantUncertainty[] {
  const { goal, reality, existingIds, existingQuestions = [] } = params;
  const discovered: DecisionRelevantUncertainty[] = [];

  const isDeduplicated = (id: string, text: string) => {
    if (existingIds.has(id)) return true;
    const normText = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    return existingQuestions.some((q) => {
      const qNorm = q.question.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      return normText.includes(qNorm.slice(0, 30)) || qNorm.includes(normText.slice(0, 30));
    });
  };

  // Lens 1: PRODUCT_REALITY & GOAL_COVERAGE — Unhydrated priority indicators
  if (reality.unhydratedIndicatorIds.length > 0) {
    const unhydratedVn = reality.unhydratedIndicatorIds.filter((id) => id.includes('-vn'));
    const targetId = 'UNCERT-UNHYDRATED-VIETNAM-CORE';
    const uncertaintyText = `Can canonical provider adapters hydrate the ${unhydratedVn.length} unhydrated Vietnam indicators (${unhydratedVn.join(', ')}) with verifiable provenance and release schedules, or must they be quarantined as unavailable?`;
    if (!isDeduplicated(targetId, uncertaintyText)) {
      discovered.push({
        uncertainty_id: targetId,
        search_lens: 'PRODUCT_REALITY',
        uncertainty: uncertaintyText,
        decision_at_stake: 'Whether to configure provider ingestion contracts for unhydrated Vietnam core series or label them unavailable in catalog.',
        why_it_matters: 'Vietnam is a declared priority market in docs/PRODUCT_GOAL.md Priority 1 (Truth and coverage foundation); unhydrated series distort market coverage.',
        goal_lineage: 'docs/PRODUCT_GOAL.md Priority 1: Truth and coverage foundation; Vietnam priority market.',
        is_material: true,
        evidence_path: 'Query provider adapter capabilities and public national statistical release formats for Vietnam series.',
        reality_trigger: `${reality.unhydratedIndicatorIds.length} catalogued indicators remain unhydrated in canonical store (audit status: ${reality.auditStatus}).`,
        current_belief: 'Official statistical releases may exist in public formats but require schema-mapped ingestion adapters.',
        falsifier: 'Evidence that official sources are paywalled or publish only non-machine-readable scanned images.',
        known_evidence: ['CATALOG-UNHYDRATED-INDICATORS', `REAL-DATA-AUDIT-${reality.auditStatus.toUpperCase()}`],
      });
    }
  }

  // Lens 2: CONSUMPTION_INTEGRITY — Unconsumed analytics modules on HEAD
  for (const mod of reality.unconsumedModules) {
    const modBase = mod.split('/').pop()?.replace('.ts', '') || mod;
    const targetId = `UNCERT-CONSUMPTION-ANALYTICS-${modBase.toUpperCase()}`;
    const uncertaintyText = `Does the unconsumed module '${modBase}' have sufficient hydrated input data and verified workflow demand to justify API route wiring, or should it be kept as a deferred prototype?`;
    if (!isDeduplicated(targetId, uncertaintyText)) {
      discovered.push({
        uncertainty_id: targetId,
        search_lens: 'CONSUMPTION_INTEGRITY',
        uncertainty: uncertaintyText,
        decision_at_stake: `Whether to mount a runtime API route for '${modBase}' or defer to H2 to protect platform focus.`,
        why_it_matters: 'Implementation cost is sunk; wiring dead code without verified input data or consumers violates Theory of Constraints.',
        goal_lineage: 'docs/PRODUCT_GOAL.md: Indicator-centric workflow, fact/inference separation, no dead code.',
        is_material: true,
        evidence_path: `Query database observations for prerequisite input series of '${modBase}' and verify consumer interface contract.`,
        reality_trigger: `'${mod}' is authoritatively committed to HEAD with passing vitest coverage but has 0 non-test callers.`,
        current_belief: 'Analytics should remain unwired unless underlying time-series are hydrated and a consumer is verified.',
        falsifier: 'Zero observations in database for required input indicators.',
        known_evidence: [`FILE:${mod}`, 'CALLERS:ZERO'],
      });
    }
  }

  // Lens 3: EVIDENCE_INTEGRITY — Active hold contracts with actionable inquiry
  for (const hold of reality.activeHoldContracts) {
    if (['QUERY_EXISTING_DATA', 'ACQUIRE_EVIDENCE', 'VALIDATE_PRODUCT'].includes(hold.permitted_next_action)) {
      const targetId = `UNCERT-EVIDENCE-HOLD-${hold.id.toUpperCase()}`;
      const uncertaintyText = `Can bounded inquiry resolve the evidence gap for '${hold.id}': ${hold.evidence_gap}?`;
      if (!isDeduplicated(targetId, uncertaintyText)) {
        discovered.push({
          uncertainty_id: targetId,
          search_lens: 'EVIDENCE_INTEGRITY',
          uncertainty: uncertaintyText,
          decision_at_stake: `Whether to resume qualification for '${hold.id}' or permanently kill/defer the candidate.`,
          why_it_matters: 'Held candidates consume cognitive capacity unless resolved by bounded evidence inquiry.',
          goal_lineage: 'docs/PRODUCT_GOAL.md: Explicit data-quality states and verifiable evidence.',
          is_material: true,
          evidence_path: `Execute bounded inquiry via '${hold.permitted_next_action}' to verify: ${hold.evidence_gap}.`,
          reality_trigger: `Item '${hold.id}' is held under HoldContract: ${hold.hold_reason}.`,
          current_belief: 'A bounded query or feasibility check can determine if the hold condition is resolvable.',
          falsifier: 'Query proves the requested counterfactual is non-existent or data is unavailable.',
          known_evidence: [`HOLD:${hold.id}`, `NEXT_ACTION:${hold.permitted_next_action}`],
        });
      }
    }
  }

  // Lens 4: PRODUCT_REALITY — Quarantined source contracts
  if (reality.quarantinedSourceCount > 0) {
    const targetId = 'UNCERT-QUARANTINED-PROVIDER-FEASIBILITY';
    const uncertaintyText = `Are the ${reality.quarantinedSourceCount} quarantined provider source contracts permanently retired, or can updated endpoint contracts restore automated hydration?`;
    if (!isDeduplicated(targetId, uncertaintyText)) {
      discovered.push({
        uncertainty_id: targetId,
        search_lens: 'PRODUCT_REALITY',
        uncertainty: uncertaintyText,
        decision_at_stake: 'Whether to decommission quarantined source URLs or replace them with updated provider endpoints.',
        why_it_matters: 'docs/PRODUCT_GOAL.md Priority 1 requires durable ingestion and fail-closed quality without silent data loss.',
        goal_lineage: 'docs/PRODUCT_GOAL.md: Licensed providers, durable ingestion, fail-closed freshness.',
        is_material: true,
        evidence_path: 'Probe quarantined provider endpoints and verify against official provider release announcements.',
        reality_trigger: `${reality.quarantinedSourceCount} provider series are in quarantine due to HTTP 404 or contract mismatch.`,
        current_belief: 'Some provider URLs may have been deprecated or relocated by the upstream agency.',
        falsifier: 'Provider documentation confirms the data series is discontinued.',
        known_evidence: [`QUARANTINED_COUNT:${reality.quarantinedSourceCount}`],
      });
    }
  }

  // Lens 5: GOLDEN_JOURNEYS — Journey maturity blockers
  for (const journey of reality.goldenJourneys) {
    if (journey.blockers.length > 0 && journey.current_maturity !== 'LEVEL_3_DECISION_READY') {
      const blocker = journey.blockers[0];
      const targetId = `UNCERT-JOURNEY-BLOCKER-${journey.id.toUpperCase()}`;
      const uncertaintyText = `Can the primary blocker for ${journey.name} ('${blocker}') be resolved with currently available platform data?`;
      if (!isDeduplicated(targetId, uncertaintyText)) {
        discovered.push({
          uncertainty_id: targetId,
          search_lens: 'GOLDEN_JOURNEYS',
          uncertainty: uncertaintyText,
          decision_at_stake: `Whether to qualify analytical modeling work for ${journey.name} or keep maturity at ${journey.current_maturity}.`,
          why_it_matters: `Golden journeys represent user workflow value; resolving blockers advances user decision readiness.`,
          goal_lineage: 'docs/PRODUCT_GOAL.md: Personal Bloomberg-terminal-like research environment.',
          is_material: true,
          evidence_path: `Assess indicator data availability for ${journey.name} indicators to verify model feasibility.`,
          reality_trigger: `${journey.name} is held at ${journey.current_maturity} due to blocker: ${blocker}.`,
          current_belief: 'Core series may be available to construct a preliminary bounded model.',
          falsifier: 'Required input indicators are completely unhydrated.',
          known_evidence: [`JOURNEY:${journey.id}`, `MATURITY:${journey.current_maturity}`],
        });
      }
    }
  }

  // Filter through Discovery Admission
  return discovered.filter((u) => evaluateDiscoveryAdmission(u).admitted);
}

/**
 * Creates a durable RegenerativeProductQuestion adhering strictly to Section 10 contract.
 */
export function productQuestionFromUncertainty(
  uncertainty: DecisionRelevantUncertainty,
  revision: string
): RegenerativeProductQuestion {
  const qId = `RQ-${uncertainty.uncertainty_id.replace(/^UNCERT-/, '')}`;
  return {
    id: qId,
    question: uncertainty.uncertainty,
    goal_lineage: uncertainty.goal_lineage,
    reality_trigger: uncertainty.reality_trigger,
    decision_at_stake: uncertainty.decision_at_stake,
    current_belief: uncertainty.current_belief,
    known_evidence: uncertainty.known_evidence,
    important_unknown: uncertainty.why_it_matters,
    falsifier: uncertainty.falsifier,
    evidence_path: uncertainty.evidence_path,
    reality_revision: revision,
    evidence_revision: revision,
    status: 'IN_PROGRESS',
    search_lens: uncertainty.search_lens,
    created_at: new Date().toISOString(),
  };
}

/**
 * Creates an OpportunityCandidate from an admitted DecisionRelevantUncertainty.
 */
export function opportunityCandidateFromUncertainty(
  uncertainty: DecisionRelevantUncertainty,
  revision: string
): OpportunityCandidate {
  const oppId = `OPP-${uncertainty.uncertainty_id.replace(/^UNCERT-/, '')}`;
  return {
    opportunity_id: oppId,
    discovered_at: new Date().toISOString(),
    product_revision: revision,
    idea: uncertainty.uncertainty,
    user_problem: uncertainty.reality_trigger,
    problem_statement: uncertainty.decision_at_stake,
    product_goal_objectives: [uncertainty.goal_lineage, uncertainty.search_lens.toLowerCase()],
    affected_surface: uncertainty.search_lens === 'CONSUMPTION_INTEGRITY' ? '/analytics' : '/indicators',
    affected_journey: 'inspect-freshness-provenance',
    affected_persona: 'Professional Analyst',
    evidence_ids: [...uncertainty.known_evidence, `UNCERTAINTY:${uncertainty.uncertainty_id}`],
    evidence_quality: 'STRUCTURAL',
    severity: uncertainty.is_material ? 'HIGH' : 'MEDIUM',
    priority: uncertainty.is_material ? 'P1' : 'P2',
    confidence: 0.85,
    expected_value: 'HIGH',
    risk: 'LOW',
    uncertainty: [uncertainty.why_it_matters],
    estimated_scope: [uncertainty.evidence_path],
    allowed_paths: [
      uncertainty.search_lens === 'CONSUMPTION_INTEGRITY'
        ? 'server/routes/analyticsRouter.ts'
        : 'server/ingestion.ts',
      '.ai-company/product-intelligence/RESEARCH_PORTFOLIO.json',
    ],
    non_goals: ['premature build authorization without evidence', 'ungrounded predictions'],
    acceptance_criteria: [
      `Evidence path '${uncertainty.evidence_path}' is executed fail-closed`,
      `Decision '${uncertainty.decision_at_stake}' is resolved with documented finding`,
    ],
    dependencies: [],
    novelty: 'NEW',
    lifecycle_status: 'EVIDENCE_READY',
    pm_decision: 'PENDING',
    suggested_work_intent: 'PRODUCT_DISCOVERY',
  };
}
