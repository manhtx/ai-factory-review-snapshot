# Autonomous Product Discovery, Deep Research & Decision Diversity Report

**Document Purpose**: Record autonomous discovery, deep research, and diverse decision-making across Macro OS Golden Journeys without user intervention.  
**Truth Standard**: Root Evidence > Agent Claims. Zero "Always Build" Bias.

---

## 1. Executive Summary

In accordance with AI Company V2 Governance (Sections 40–44), the system has autonomously discovered 4 distinct product opportunities anchored directly to the 3 Golden Journeys defined in the Macro OS Product Frontier (`docs/product/PRODUCT_FRONTIER.json`).

Crucially, the system demonstrated **Decision Diversity** by rejecting the naive bias that every discovered idea should result in immediate code deployment:
1. **PROTOTYPE** (`OPP-INFLATION-RATE-REGIME-SPREAD`): Golden Journey 1
2. **RESEARCH** (`OPP-COMPOSITE-LIQUIDITY-INDEX`): Golden Journey 2
3. **BUILD** (`OPP-VN-CREDIT-PROPERTY-STRESS`): Golden Journey 3
4. **KILL** (`OPP-SYNTHETIC-PREDICTIVE-TRADING-SIGNALS`): Core Boundary Enforcement

---

## 2. Deep Research & Contradiction Analysis

### Opportunity 1: Inflation Expectations & Real Yield Spread Analyzer (`OPP-INFLATION-RATE-REGIME-SPREAD`)
- **Golden Journey**: Journey 1 (Inflation & Rates Analysis)
- **Domain**: `REGIME_MODELS`
- **Hypothesis**: Breakeven inflation rates (10-Year Treasury Yield minus 10-Year TIPS Yield) combined with the Fed Funds effective rate provide an early leading signal of policy restrictiveness regimes.
- **Data Reality & Provider Limitations**: TIPS market depth is substantially thinner than nominal Treasuries. In volatile periods (e.g. March 2020 or October 2022), liquidity premia in TIPS explode, creating artificial downward spikes in breakeven rates.
- **Contradiction Identified**: During market panics, breakeven inflation falls sharply not because long-term inflation expectations collapsed, but because institutional cash managers liquidate TIPS in favor of benchmark nominal Treasuries.
- **Assumptions Rejected**: Rejected the assumption that `T10YIE` equals pure expected inflation without liquidity adjustments.
- **Decision & Rationale**: **PROTOTYPE**. Build an empirical liquidity-adjusted prototype model in research staging before exposing it on the main macro dashboard.

---

### Opportunity 2: Composite Cross-Currency Liquidity Stress Indicator (`OPP-COMPOSITE-LIQUIDITY-INDEX`)
- **Golden Journey**: Journey 2 (Liquidity & FX Stress)
- **Domain**: `REGIME_MODELS`
- **Hypothesis**: A unified 0–100 liquidity stress index combining SOFR spikes, US overnight reverse repo (RRP) drain, and DXY velocity reliably predicts bilateral exchange rate shocks in emerging markets (USD/VND, USD/CNY).
- **Data Reality & Provider Limitations**: RRP window operations are subject to quarter-end window dressing by primary dealers, generating artificial volatility that does not reflect structural dollar shortage.
- **Contradiction Identified**: Emerging market central banks (e.g. State Bank of Vietnam, People's Bank of China) actively deploy administrative tools—such as daily central parity fixings, credit quotas, and foreign exchange forward interventions—that completely break linear transmission from US dollar liquidity to spot exchange rates.
- **Assumptions Rejected**: Rejected the hypothesis of linear instantaneous transmission between global dollar liquidity stress and bilateral EM exchange rates.
- **Decision & Rationale**: **RESEARCH**. Conduct rigorous research into central bank reaction functions and intervention thresholds before committing to a composite index.

---

### Opportunity 3: Credit Growth & Property Price Decoupling Monitor (`OPP-VN-CREDIT-PROPERTY-STRESS`)
- **Golden Journey**: Journey 3 (Credit & Real Estate Regimes)
- **Domain**: `GOLDEN_JOURNEYS`
- **Hypothesis**: Decoupling between bank credit expansion and real estate transaction volumes signals structural leverage accumulation and liquidity risk.
- **Data Reality & Provider Limitations**: Commercial real estate and residential transaction volume data from GSO/CBRE are published quarterly with a 45-day lag, whereas SBV banking credit growth is released monthly.
- **Contradiction Identified**: Real estate asking prices frequently remain sticky and elevated for 2–3 quarters after transaction volumes dry up. Analysts relying strictly on price indices miss the onset of credit distress because volume freeze is the true leading indicator.
- **Assumptions Rejected**: Rejected the assumption that property prices fall simultaneously with liquidity drying up. Volume leads; prices lag.
- **Decision & Rationale**: **BUILD**. With explicit freshness and lag contracts now verified in `server/freshness.ts` (Commit `7ad51b6`), Macro OS has the necessary data foundation to build and deploy this decoupling monitor with deterministic regression tests.

---

### Opportunity 4: Automated Algorithmic Buy/Sell Trading Signals (`OPP-SYNTHETIC-PREDICTIVE-TRADING-SIGNALS`)
- **Golden Journey**: Journey 1 (Inflation & Rates Analysis)
- **Domain**: `TRADING_SIGNALS`
- **Hypothesis**: Providing automated algorithmic buy/sell recommendation tags on macro assets increases platform daily active usage.
- **Data Reality & Provider Limitations**: Momentum and statistical signals in macro markets suffer extreme regime sensitivity, leading to severe drawdown risks during geopolitical or central bank pivot events.
- **Contradiction Identified**: Directly violates the founding Product Goal of Macro OS: "Fact and inference must be strictly separated across all research surfaces... Macro OS is an evidence-first research operating system, not a black-box trading signal bot." Presenting algorithmic signals as actionable trading advice violates regulatory compliance and destroys institutional user trust.
- **Assumptions Rejected**: Rejected the claim that black-box trading signals create long-term institutional value.
- **Decision & Rationale**: **KILL**. Permanently reject and remove from the product backlog to protect product integrity and governance boundaries.

---

## 3. Decision Diversity Matrix

| Opportunity ID | Golden Journey | Domain | Action | Contradiction Found | Governance Compliance |
|---|---|---|---|---|---|
| `OPP-INFLATION-RATE-REGIME-SPREAD` | Journey 1 (Inflation/Rates) | Regime Models | **PROTOTYPE** | TIPS liquidity premia skew breakevens during flight-to-safety | Verified |
| `OPP-COMPOSITE-LIQUIDITY-INDEX` | Journey 2 (Liquidity/FX) | Regime Models | **RESEARCH** | Central bank administrative fixings buffer linear transmission | Verified |
| `OPP-VN-CREDIT-PROPERTY-STRESS` | Journey 3 (Credit/Property) | Golden Journeys | **BUILD** | Transaction volume collapse precedes price declines by 2 quarters | Verified |
| `OPP-SYNTHETIC-PREDICTIVE-TRADING-SIGNALS` | Journey 1 (Inflation/Rates) | Signals | **KILL** | Violates fact/inference separation and non-advice mandate | Verified |

---

## 4. Evidence Links
- Ledger Path: `.ai-company/product-intelligence/DISCOVERY_DECISIONS.jsonl`
- Product Frontier: `docs/product/PRODUCT_FRONTIER.json`
- Unit Test: `server/aiCompany/productDiscoveryDecisionLedger.test.ts`
