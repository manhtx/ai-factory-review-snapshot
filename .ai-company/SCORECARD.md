# Macro OS Autonomous Product Company — Evidence-Based Scorecard

**Cập nhật lần cuối:** 2 Tháng 9, 2026 (Codex Epoch 0042)  
**Trạng thái chứng nhận:** **Tier 3 — Locally Verified Developer Baseline (78.0 / 100 Điểm)**
**Phương pháp chấm điểm:** Dựa trên bằng chứng thực tế tại repository (Local Verification Evidence); không cộng điểm cho các giả định người dùng, tính năng chưa deploy production hoặc tự chứng thực.

---

## Bảng Điểm 12 Tiêu Chí Định Lượng

| ID | Tiêu Chí | Điểm (0–5) | Độ Tin Cậy (0–1) | Bằng Chứng Hiện Hữu (Epoch 7) | Đánh Giá Trạng Thái |
|---|---|:---:|:---:|---|---|
| **SC-01** | Product truth / claim integrity | **4.2** | 0.95 | Không mock data trên primary journeys; Dynamic lookups; Fail-closed state | Locally Verified |
| **SC-02** | Core workflow coherence | **4.6** | 0.90 | Universal Compare, cycle detection, lead/lag and wavelet modules; task success remains unproven | Locally Verified |
| **SC-03** | Global country/domain coverage | **2.5** | 0.85 | Runtime smoke: 133 catalog indicators, 81 hydrated, 94,175 observations; US 22/23 hydrated (1 current), VN 11/26 (8 current) | Locally Verified |
| **SC-04** | Data correctness & freshness | **4.0** | 0.90 | Runtime smoke confirms observations carry state/provenance; freshness is uneven and production reconciliation remains unproven | Locally Verified |
| **SC-05** | Performance & latency | **4.5** | 0.90 | Build evidence exists; production/mobile latency and world-scale hydration remain unmeasured | Locally Verified |
| **SC-06** | Reliability & observability | **3.3** | 0.80 | Error boundaries, bounded diagnostics, token-bucket throttling & operational telemetry snapshots | Locally Verified |
| **SC-07** | Security & abuse-cost control | **3.5** | 0.85 | Token-bucket rate limiting middleware (`rateLimit.ts`), per-route quota bounds | Locally Verified |
| **SC-08** | Accessibility & responsiveness | **3.8** | 0.85 | Responsive layout và bilingual UI; Screen-reader audit: **Pending** | Locally Verified |
| **SC-09** | Test & release confidence | **4.9** | 1.00 | 0 TS errors, 0 ESLint warnings, 110 test files (529 tests pass), Vite build passed | Locally Verified |
| **SC-10** | Adoption & retention evidence | **1.0** | 0.20 | UNKNOWN: no production user analytics or real retention data; hypothetical personas only | Unknown |
| **SC-11** | Maintainability & velocity | **4.4** | 0.90 | Strict TypeScript contracts, bounded FIFO buffers, modular telemetry endpoints | Locally Verified |
| **SC-12** | Business viability & licensing | **3.4** | 0.70 | Token bucket limiter bảo vệ chi phí API; Ưu tiên dữ liệu chính phủ mở và telemetry sử dụng thực tế | Locally Verified |
| **TỔNG** | **Tổng Điểm Nền Tảng** | **46.8 / 60** | — | **78.0 / 100 Điểm (Tier 3: Locally Verified Developer Baseline)** | **Tier 3** |
