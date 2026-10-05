# Macro OS Autonomous Product Company — Handoff Context

## 1. Trạng Thái Hiện Tại (State Summary)
- **Current Epoch:** `0400` hoàn tất; sẵn sàng cho `0401`.
- **Scorecard:** **78.0 / 100 Điểm (Strict Local Verification Evidence Model)**.
- **Quality Gate:** 100% Passed locally (0 TS errors, 0 ESLint warnings, 110 test files, 529 tests passed, Vite build passed). This is not production evidence.
- **Active Constraint:** Evidence-based core workflow and production data verification.

## Codex Epoch 0042–0043 Process Review

- Full local verification: TypeScript pass; 110 test files; 529 tests pass.
- Scope recovery completed; transaction-execution families are removed/parked.
- Feature expansion is held until provider, production-runtime and real-user
  evidence exists. See `.ai-company/reports/process-review-epoch-0042.md`.
- Scorecard/handoff reconciliation completed in `.ai-company/reports/epoch-0043-scorecard-reconciliation.md`.
- Country Explorer now renders server-derived registered/hydrated/current coverage state; see `.ai-company/reports/epoch-0044-country-coverage-ui.md`.
- Lint and type quality gate cleanup completed in `.ai-company/reports/epoch-0045-lint-and-evidence-cleanup.md`.
- Full local release gate passed in `.ai-company/reports/epoch-0046-release-gate.md`; this is not production readiness evidence.
- Quiet controller mode is available with `QUIET=1`; details in `.ai-company/reports/epoch-0047-quiet-controller.md`.
- Browser inspection found and removed hard-coded risk/stress widgets from World entry; see `.ai-company/reports/epoch-0048-runtime-truth-reset.md`.
- Browser inspection also reset stale navigation maturity claims; see `.ai-company/reports/epoch-0049-navigation-claim-reset.md`.
- World Hub subtitle now distinguishes catalog registration from hydrated verified data; see `.ai-company/reports/epoch-0050-world-claim-reset.md`.
- Ingestion sidebar copy now avoids asserting operational health without runtime evidence; see `.ai-company/reports/epoch-0051-ingestion-claim-reset.md`.
- **P0 blocker:** BACKLOG-038 is now highest priority for restoring real-data provider-to-UI hydration. Expansion is frozen until its approval gate passes.
- Client hydration now preserves successful series when another series endpoint fails; see `.ai-company/reports/epoch-0053-partial-hydration.md`.
- Indicator calls are independent with bounded concurrency (six); BACKLOG-039 tracks timeout/metrics verification.
- BACKLOG-040/041 are H0 blockers for gold/reserves/fund flows and evidence-linked macro news; implementation remains gated by BACKLOG-038.
- Data inventory confirms static source configuration is not runtime coverage; the first vertical slice is US + VN core macro plus approved gold contracts.
- Backend probe found local persisted observations but no durable production persistence (`productionReady=false`); see `.ai-company/reports/epoch-0057-backend-data-probe.md`.
- Full local data requires `npm run dev:full` (API + Vite); production needs an equivalent health/snapshot/coverage/hydration smoke gate.
- `scripts/audit-real-data.mjs` now requires and reports country coverage; see `.ai-company/reports/epoch-0059-runtime-smoke-audit.md`.
- Epoch 0060 baseline: 133 catalog, 81 hydrated, 94,175 observations; audit blocked by non-durable SQLite and `productionReady=false`.
- Gold audit confirms only monthly World Bank Pink Sheet is registered; daily LBMA, Vietnam pricing, central-bank purchases and fund flows remain gated by BACKLOG-040.
- World Hub now visibly reports loading/partial/unavailable hydration state instead of leaving users with an unexplained empty screen.
- Full hydration regression gate passed: 110 test files / 529 tests; production evidence remains absent.
- Governance JSON/JSONL artifacts parse successfully; unrelated whitespace hygiene remains recorded debt.
- Hydration now prioritizes runtime snapshot source URLs over stale catalog metadata.
- Scorecard SC-03/SC-04 now reflect the smoke baseline (133 catalog, 81 hydrated, 94,175 observations) without a score increase.
- Config audit confirms blank FRED/Supabase secrets and only two scheduled IDs locally; no silent schedule expansion is allowed.
- Gold series rows now carry runtime source URL fallback; daily LBMA/Vietnam gold and fund/reserve flows remain P0 backlog work.
- API provenance regression gate passed: 96 targeted tests; production evidence remains absent.
- Full quality gate passed: 110 test files / 529 tests, lint/typecheck pass, Vite build 2.21s; score unchanged.
- Production data recovery runbook added at `docs/PRODUCTION_DATA_RECOVERY_RUNBOOK.md`; current SQLite baseline remains non-production.
- Client API calls now timeout after 15s and still respect caller abort signals; production provider SLAs remain open.
- Timeout/persistence contract gate passed: 86 targeted tests and governance JSON validation.
- Company epoch validator passed for Epoch 0073; state, ledger, scope and score integrity are aligned.
- Five-epoch process review completed at `.ai-company/reports/process-review-epoch-0075.md`; score increase and expansion remain denied.
- Repeated durable production audit remains blocked: SQLite/local, 133 catalog, 81 hydrated, `productionReady=false`.
- Source URL audit found 125/133 reachable and 8 HTTP 404 contracts; affected series must be quarantined/reviewed before evidence use.
- Next actions: verify hydrated coverage/vintage, run browser task checks, and produce an independent reviewer verdict.
- Epoch 0078 added P0 BACKLOG-042 for eight broken source contracts (404) and requires repair/quarantine before current/verified promotion.
- Epoch 0079 added timestamped source-audit artifacts with bounded concurrency; Epoch 0080 process review rejected release and score increase.
- Epoch 0081 added an HTTP promotion gate so 4xx/5xx provider responses cannot become actual/verified observations.
- Epoch 0082 full local gate passed; Epoch 0083 durable runtime audit failed (`durablePersistence=false`, `productionReady=false`).
- Epoch 0084 bounded source auditing; Epoch 0085 process review; Epoch 0086 rerun confirmed the same eight 404 contracts.
- Epoch 0088 real-data baseline passed structural checks but confirmed 133 catalog / 81 hydrated / non-durable SQLite.
- Epoch 0089 scope audit kept 16 pre-recovery out-of-scope records historical only; Epoch 0090 process review rejected release.
- Epoch 0091 provider research rejected a semantically incorrect annual FRED Vietnam CPI replacement; Epochs 0092–0093 added and reran content-type evidence (8 persistent 404s).
- Epoch 0095 process review rejected release; Epochs 0096–0098 expanded content-type, runtime coverage and gold catalog audits.
- Epoch 0099 corrected gold provenance to the exact World Bank workbook artifact consumed by ingestion; Epoch 0100 review kept release and score increase rejected.
- Epoch 0104 restarted the API and verified gold `sourceUrl` in runtime; Epoch 0105 review kept release rejected.
- Epochs 0106–0108 verified post-restart health, source audit after the gold fix, and gold freshness (~63.5 days old at probe); “latest gold price” remains unapproved.
- Epoch 0111 added the ten-epoch controller meta-review gate and corrected gold unit metadata; Epoch 0112 added controller hardening backlog item BACKLOG-043.
- Epoch 0113 added controlled historical validator replay and verified Epoch 0110 replay without weakening live validation.
- Epoch 0117 added P0 BACKLOG-044 (freshness truth) and BACKLOG-045 (daily market/gold data) after screenshots showed stale 2023 deposit-rate and monthly gold data presented in the research flow.
- Epoch 0118 changed UI wording to “latest available observation” and displays observation date; this is a guardrail, not a daily-data implementation.
- Epochs 0121–0123 removed realtime wording and exposed freshness/observation-date gaps; Epoch 0124 made global daily intelligence the Product Goal baseline.
- Epoch 0125 process review and Epoch 0126 created `GLOBAL_DAILY_INTELLIGENCE_PLAN.md` plus BACKLOG-046–050; forecasting remains H2/H3 until data foundation gates pass.
- Epoch 0128 confirmed Product Goal, delivery plan and current P0/P1 backlog are consistent; Epochs 0127–0129 preserve this baseline for the next review.
- Epoch 0130 process/meta review confirmed the new global-daily baseline is correctly governed but not delivered; release and score increase remain rejected.
- Epoch 0132 synchronized controller priorities with the new goal; Epoch 0133 confirmed Product Goal, delivery plan, state, ledger, scorecard and 50-record backlog integrity.

## 2. Định Hướng Phạm Vi Bắt Buộc (Strict Scope Guardrails Alignment)
Dự án tuân thủ nghiêm ngặt định vị trong `docs/PRODUCT_GOAL.md` (Personal Macroeconomic & Investment-Intelligence Research Platform):
- Tuyệt đối loại bỏ mọi chủ đề ngoài phạm vi.
- Bám sát 9 ưu tiên cốt lõi:
  1. Product truth & evidence (tách bạch Fact vs Inference, trích dẫn nguồn gốc dữ liệu).
  2. UX / workflow phân tích vĩ mô (trực quan hóa chu kỳ kinh tế, so sánh quốc gia, bảng điều khiển).
  3. Coverage dữ liệu vĩ mô thật (mở rộng series thời gian thật, hydrate dữ liệu FRED/World Bank/OECD/IMF).
  4. Provenance, Freshness calendar & Revision tracking (lịch phát hành, độ trễ dữ liệu, lịch sử điều chỉnh số liệu).
  5. Canonical Country & Indicator Ontology (chuẩn hóa mã chỉ số, đơn vị, tính tương thích giữa các quốc gia).
  6. Runtime performance & API reliability.
  7. User evidence & quy trình nghiên cứu có thể tái lập (reproducible research memory).
  8. Production verification & bảo mật cấu hình.
  9. Scorecard integrity (đánh giá trung thực dựa trên bằng chứng thực tế, không tự chấm điểm phóng đại).

## 3. Lịch sử kỹ thuật (đã hoàn tất trước Epoch 0042)
- **Dynamic Wavelet Transform & Frequency-Domain Macro Comovement Engine (`CORE-MACRO-040`):**
  - Xây dựng module kinh tế lượng lõi `src/app/data/macroWaveletComovement.ts`:
    - Triển khai thuật toán biến đổi Wavelet chồng lấp cực đại MODWT (Maximal Overlap Discrete Wavelet Transform) với bộ lọc Haar đa quy mô (Multi-Resolution Analysis - MRA).
    - Phân tách chuỗi thời gian vĩ mô thành 4 cấp độ chi tiết (D1..D4) và 1 mức làm mịn xu hướng dài hạn (A4), tương ứng các phổ chu kỳ:
      - Scale D1: 2–4 tháng (Nhiễu dữ liệu tần số cao / High-frequency noise)
      - Scale D2: 4–8 tháng (Dao động ngắn hạn / Short-run fluctuations)
      - Scale D3: 8–16 tháng (Chu kỳ kinh doanh ngắn / Short business cycle)
      - Scale D4: 16–32 tháng (Chu kỳ kinh doanh trung hạn / Intermediate cycle)
      - Scale A4: >32 tháng (Xu hướng cấu trúc dài hạn / Secular trend)
    - Tính toán năng lượng phân rã Wavelet (% phương sai giải thích tại mỗi dải tần số).
    - Tính toán tương quan Pearson theo từng dải tần số kèm kiểm định ý nghĩa thống kê ($t$-statistic, $p$-value).
    - Phát hiện hiện tượng phân kỳ tần số (Frequency Decoupling): tách biệt rõ rệt khi hai chuỗi có tương quan gần 0 ở tần số cao (nhiễu ngắn hạn) nhưng đồng pha mạnh mẽ ở các dải chu kỳ kinh tế trung hạn.
    - Cung cấp các cặp chỉ số kinh điển (Fed Funds vs US CPI, US 10Y vs VN Interbank, US 10Y vs DE 10Y, Real GDP vs M2).
    - Tách bạch nghiêm ngặt theo chuẩn Product Truth giữa Quan sát thực tế (Observed Facts) và Suy luận kinh tế & Giới hạn mô hình (Analytical Inferences).
  - Xây dựng UI component tương tác `src/app/components/indicators/MacroWaveletComovementWidget.tsx` với bảng quang phổ quy mô Wavelet, chỉ số đồng pha cực đại, phân loại truyền dẫn, và thẻ kiểm toán Product Truth & Evidence.
  - Tích hợp trực tiếp vào `src/app/pages/RelationshipsPage.tsx` khi phân tích từ 2 chỉ số trở lên.
  - Viết bộ unit tests: `macroWaveletComovement.test.ts` (7 tests) và `MacroWaveletComovementWidget.test.ts` (2 tests).
  - Số liệu kiểm thử của epoch lịch sử không còn là quality-gate hiện tại; xem kết quả 110 test files/529 tests ở phần trạng thái trên.

## 4. Các Hạng Mục Tiếp Theo Cho Epoch 0043
1. Đối soát coverage hydrated/vintage với dữ liệu runtime và phát hành báo cáo độc lập.
2. Chạy browser task checks cho Discover → Inspect → Compare → Save/Monitor; ghi nhận lỗi thay vì suy diễn.
3. Không mở rộng series/provider hoặc xây stress scenario cho đến khi có production/provider evidence và approval gate.

## 5. Quy Trình Vận Hành Controller
- Chạy: `./scripts/ai-company-loop.sh`
- Dừng an toàn: Tạo file `.ai-company/STOP` hoặc gửi tín hiệu ngắt `SIGINT`.

## 6. Master Operating Contract — Execution Authority (Protocol V2)
- **Law:** The interactive controller that explicitly starts or takes control of the run defines the execution provider and model for that run (`Current Controller + Current Selected Model → Explicit Run Execution Lease`).
- **Operating Rules:**
  > INHERIT EXPLICIT CURRENT RUN EXECUTION AUTHORITY.
  > PRESERVE THE ACTIVE RUN-SCOPED EXECUTION LEASE UNTIL EXPLICIT TAKEOVER OR RUN TERMINATION.
- **Fail-Closed Protection:** When execution authority is ambiguous or unverified, fail closed (`EXECUTOR_AFFINITY_UNRESOLVED`). Never guess, never inherit stale historical affinity as authority, and never silently switch providers on quota exhaustion (`WAIT_SAME_PROVIDER`).
