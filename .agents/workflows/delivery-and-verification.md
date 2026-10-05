---
description: Quy trình triển khai và kiểm thử độc lập (Delivery & Independent Verification)
---

# Bounded Delivery & Independent Verification

Quy trình phát triển và kiểm định độc lập cho từng hạng mục công việc:

1. **Phạm Vi Bounded:** Triển khai một vertical slice giới hạn, không gây phình to diff hoặc làm đứt gãy các chức năng hiện hữu.
2. **Quality Gate Bắt Buộc:**
   - `tsc --noEmit` $\longrightarrow$ 0 errors
   - `eslint src server api scripts vite.config.ts --max-warnings=0` $\longrightarrow$ 0 errors, 0 warnings
   - `vitest run` $\longrightarrow$ 100% test suites pass
   - `vite build` $\longrightarrow$ Build production thành công
3. **Kiểm Định Độc Lập (Independent Auditor):**
   - Không dùng kết luận của người viết code làm bằng chứng.
   - Chạy các test case biên, kiểm tra phản biện (adversarial checks).
   - Kiểm tra tính xác thực dữ liệu và phòng ngừa injection.
4. **Cập Nhật Bằng Chứng & Sổ Cái:** Ghi log nghiệm thu vào `evidence-ledger.jsonl` và `release-ledger.jsonl`.
