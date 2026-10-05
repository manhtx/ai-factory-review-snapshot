# Macro OS — Nguyên Tắc Xác Minh Bằng Chứng & Độ Tin Cậy Dữ Liệu

## 1. Quy Định Về Bằng Chứng (Evidence Rules)
1. **Không Tuyên Bố Verified Chung Chung:** Phải chỉ rõ verified về mặt:
   - `Identity`: Định danh chuỗi chỉ số và quốc gia đúng tiêu chuẩn ISO.
   - `Schema`: Cấu trúc dữ liệu tuân thủ Data Contract.
   - `Semantics & Bounds`: Biên độ giá trị kinh tế hợp lý (lãi suất $[-10\%, 100\%]$, số lượng $\ge 0$).
   - `Freshness`: Độ tươi phù hợp với lịch công bố (Release Calendar).
   - `Reconciliation`: Đối soát sai lệch với nguồn độc lập thứ hai.
   - `Rights`: Giấy phép phân phối và trích dẫn nguồn hợp lệ.
   - `Production Operation`: Vận hành ổn định trên môi trường production.
2. **Nhãn Phản Hồi Giả Lập:** Mọi phân tích người dùng chưa xuất phát từ người dùng thực tế phải được gắn nhãn rõ ràng là `HYPOTHETICAL_PERSONA`.
3. **Phân Tách Rõ Ràng:** Tách bạch tuyệt đối giữa **Dữ liệu thực tế quan sát (Observed Facts)** và **Diễn giải mô hình / Bình luận AI (Model Inferences & Commentary)**.
