# Release Evidence — Bằng Chứng Kiểm Định & Phân Định Môi Trường

Tài liệu này xác định ranh giới pháp lý kỹ thuật rõ ràng giữa **Kiểm Định Cục Bộ (Local Verification)** và **Kiểm Định Môi Trường Sản Xuất (Production Verification)**, ngăn chặn tuyệt đối việc ngộ nhận "mã nguồn build thành công cục bộ" đồng nghĩa với "đã sẵn sàng phát hành sản xuất".

---

## 1. Bảng Tiêu Chuẩn Phân Cấp 5 Mức Độ Trưởng Thành (Capability Maturity Ladder)

| Cấp Độ Trưởng Thành | Yêu Cầu Bằng Chứng Bắt Buộc | Thẩm Quyền Xác Nhận | Giới Hạn Của Cấp Độ Này |
|---|---|:---:|---|
| **1. Cataloged** | Metadata chỉ số, định danh ISO, mô tả và cấu hình nguồn dự kiến tồn tại trong catalog. | AI / Developer | Không chứng minh có adapter kết nối, không có dữ liệu thật hay bản quyền. |
| **2. Implemented** | Giao diện component UI, endpoint API hoặc mã nguồn adapter đã được viết và review. | AI / Developer | Không chứng minh code chạy được tại runtime hoặc lưu trữ bền vững. |
| **3. Locally Verified** | Toàn bộ `npm run check` (typecheck, lint, 346 unit/integration tests, Vite build) vượt qua 100% trong sandbox cục bộ. | AI / QA Engineer | Chưa kiểm chứng độ trễ mạng thực tế, tải đồng thời, cơ sở dữ liệu cloud hay bản quyền thương mại. |
| **4. Production Verified** | Dữ liệu được nạp tự động từ API chính thức vào PostgreSQL/Supabase production, có bản quyền hợp lệ, rate limit và telemetry giám sát 24/7. | Tech Lead / DevOps Lead | Đòi hỏi bằng chứng truy cập và log vận hành trên môi trường live thực tế. |
| **5. Released** | Toàn bộ luồng nghiên cứu người dùng hoàn tất nghiệm thu, có tài liệu hướng dẫn và SLO cam kết. | Product Owner | Phải duy trì giám sát liên tục sau khi phát hành. |

---

## 2. Bằng Chứng Kiểm Định Cục Bộ Hiện Tại (Local Verification Evidence - 31/08/2026)

### A. TypeScript Typecheck Gate (`tsc --noEmit`)
* **Kết quả:** `0 errors`
* **Phạm vi kiểm tra:** Toàn bộ `src/app/**/*.tsx`, `src/app/**/*.ts`, `server/**/*.ts`.

### B. ESLint Static Analysis (`eslint src server api scripts vite.config.ts --max-warnings=0`)
* **Kết quả:** `0 errors, 0 warnings`
* **Tiêu chuẩn áp dụng:** Không chấp nhận cảnh báo (Zero Warnings policy).

### C. Automated Unit & Integration Tests (`vitest run`)
* **Kết quả:** **86 Test Files Passed / 86 (100%)**
* **Số lượng test cases:** **359 Tests Passed / 359 (100%)**
* **Thời gian thực thi:** 15.49 giây.
* **Các bộ test trọng yếu:**
  * `server/rateLimit.test.ts` — Token-Bucket Rate Limiter, headers chuẩn và cô lập client bucket.
  * `src/app/data/seriesContinuity.test.ts` — Kiểm định tính liên tục và khoảng trống chuỗi thời gian kinh tế.
  * `server/macroDataRouter.test.ts` — Định tuyến API dữ liệu vĩ mô.
  * `src/app/data/dataContract.test.ts` — Hợp đồng cấu trúc dữ liệu `Indicator`, `DataPoint`, `Provenance`.
  * `src/app/components/indicators/indicatorCardTrust.test.ts` — Tiêu chuẩn phân loại bằng chứng xác thực.
  * `src/app/context/workspaceSnapshots.test.ts` — Khả năng xuất/nhập trạng thái Workspace snapshot.
  * `src/app/data/countryScope.test.ts` — Quy chuẩn định danh 10 quốc gia MVP.
  * `server/analytics.test.ts` & `server/regimeDetection.test.ts` — Mô hình phân tích vĩ mô.

### D. Production Bundle Build (`vite build`)
* **Kết quả:** Thành công.
* **Thời gian đóng gói:** 2.12 giây.
* **Số lượng module chuyển đổi:** 2,367 modules.
* **Kích thước gói chính:** `index.html` (1.33 kB), `index.css` (132 kB), `index.js` (403 kB).

---

## 3. Khoảng Trống Cần Bổ Sung Để Đạt "Production Verified" (Gaps to Production)

```
 [ Local Verified ] ──────────────► [ Production Verified ]
 (Đã Đạt 100%)                      (Cần Thực Hiện Tiếp Theo)
                                    ├── 1. Kết nối Database PostgreSQL/Supabase Live
                                    ├── 2. Backup/restore và telemetry production
                                    └── 3. User workflow + independent audit
```

## 4. Real-data vertical slice evidence (04/09/2026)

- Local full-stack runtime health correctly reported `productionReady: false`,
  `durablePersistence: false` and managed storage unavailable.
- `POST /api/admin/ingest/cpi-us` fetched official FRED `CPIAUCSL` public CSV
  and persisted **943 actual/verified observations**, with **0 quarantined**.
- `/api/snapshots`, `/api/series/cpi-us` and verified-observation API returned
  the persisted series, source series ID, source URL and ingestion vintage.
- Latest observation was `2026-07-01`; API marked it `delayed` and
  `hasCurrentEvidence: false`. This is local evidence, not production
  certification.
- Full local gate passed: **171 test files / 655 tests**, typecheck, lint and
  Vite build. Production preflight remains **NO-GO** because 11 UI indicator
  modules still contain synthetic series.
- Browser verification of `/indicators/cpi-us` rendered the real hydrated
  series and showed **943 observations**, `Series ID: CPIAUCSL`, latest period
  `2026-07-01`, and `actual` state. Because the observation is delayed, the
  headline card intentionally displays `--` rather than presenting it as
  current evidence; the time-series evidence remains visible.
- A second bounded batch ingested **24 FRED contracts** (US inflation, labor,
  rates, yields, risk and FX): **24/24 succeeded**, one attempt each, with no
  failed provider contract. This expands the locally verified real-data
  surface, but does not change the production gate because storage is still
  SQLite and the UI synthetic-module audit remains open.
- A broader MVP-country FRED probe ingested **20 developed-market contracts
  successfully (20/20)**. The emerging-market probe succeeded **13/20** and
  correctly failed closed for 7 contracts whose declared FRED series returned
  HTTP 404: all four Vietnam `em-*` contracts, Brazil interbank, Indonesia
  industrial production and Mexico industrial production. These require a
  validated replacement source or corrected series ID; they must not be filled
  with synthetic values.
- AI Company artifact validation passed (`4 closed artifact schemas and company
  state`), and the secret audit found no known secret patterns. Runtime
  observability is therefore governed by the same artifact/security gate as
  the rest of the company loop.

## 5. AI Company decision and backlog integrity (04/09/2026)

- User telemetry batches are persisted to the durable telemetry ledger; invalid
  events are rejected before persistence.
- Telemetry reads canonicalize duplicate legacy rows by `event.id`, preserving
  the first observed payload so retries cannot rewrite user evidence.
- PM insight decisions are serialized and idempotent for concurrent cycles.
- Backlog promotion is serialized and idempotent by `project_id + backlog_id`,
  with a legacy `id` fallback so the existing backlog read model remains intact.
- The PM disposition API reports `backlog_created: true` only when it actually
  creates a new item; repeated or previously rejected decisions do not overstate
  mutation.
- Verification evidence: full suite **204 test files / 751 tests passed**;
  AI Company gate **87 files / 198 tests passed**; typecheck, lint, artifact
  validation, secret audit and synthetic-data audit passed.

> Status note (04/09/2026): Sections 2 and 4 preserve historical snapshots and
> must not be read as the current gate. The current synthetic audit is clean
> (`0` production-path matches), while production remains NO-GO independently
> because durable storage, remote ingestion and recovery evidence are still
> unresolved.

## 6. CEO operating audit contract (04/09/2026)

Run `npm run ai-company:operating-audit` as the structural operating-model
gate. It verifies role contracts, daily-to-annual cadence, canonical user
journeys, product-goal alignment, durable ledgers and the executable workflow
(scheduler, planner, role executor, release gate and post-release monitor).
Each run writes `.ai-company/reports/ai-company-operating-audit-latest.json`.
The report is a governance/readiness artifact only; `production_ready: false`
must remain independent until production preflight and real-data evidence pass.
