import { HistoricalCycle } from "./types";

export const historicalCycles: HistoricalCycle[] = [
  {
    id: "dotcom-bubble",
    name: "Dotcom Bubble",
    period: { start: "1997-01-01", end: "2002-12-01" },
    context:
      "Internet revolution tạo ra làn sóng đầu tư điên cuồng vào các công ty công nghệ không có lợi nhuận. NASDAQ tăng 400% từ 1995-2000. Mọi thứ có '.com' đều được định giá cao ngất. IPO không cần doanh thu, chỉ cần 'eyeballs'.",
    policy:
      "Fed giữ lãi suất thấp trong giai đoạn đầu để hỗ trợ tăng trưởng. Greenspan cảnh báo 'irrational exuberance' từ 1996 nhưng không hành động quyết liệt. Sau bong bóng vỡ, Fed cắt giảm mạnh từ 6.5% xuống 1.0%.",
    impact:
      "NASDAQ mất 78% giá trị từ đỉnh 5,048 (tháng 3/2000) xuống còn 1,114 (tháng 10/2002). Hàng nghìn công ty dot-com phá sản. $5 nghìn tỷ vốn hóa bị xóa sổ. Tỷ lệ thất nghiệp Mỹ tăng từ 3.8% lên 6.3%.",
    lesson:
      "Định giá cần dựa trên cashflow thực tế, không phải câu chuyện tương lai. Chu kỳ công nghệ có thể kéo dài hàng năm trước khi vỡ. Lãi suất thấp kéo dài tạo điều kiện cho bong bóng tài sản hình thành.",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: P/E, PMI và lãi suất đã thay đổi theo thứ tự nào trước khi bong bóng vỡ? Hãy mở từng chỉ báo và kiểm tra ngày quan sát, nguồn và giới hạn của dữ liệu.",
    keyIndicators: ["pmi-us", "fed-funds-rate", "us10y-yield", "yield-curve", "unemployment-us"],
    severity: "severe",
    region: "US",
    kind: "historical",
  },
  {
    id: "gfc-2008",
    name: "Global Financial Crisis 2008",
    period: { start: "2007-06-01", end: "2009-06-01" },
    context:
      "Bong bóng bất động sản Mỹ được tài trợ bởi hệ thống tín dụng phức tạp (MBS, CDO, CDS). Ngân hàng cho vay dưới chuẩn (subprime) không kiểm soát. Lehman Brothers sụp đổ tháng 9/2008 châm ngòi khủng hoảng hệ thống tài chính toàn cầu.",
    policy:
      "Fed hạ lãi từ 5.25% xuống 0-0.25% trong 15 tháng. Lần đầu tiên trong lịch sử Fed thực hiện QE — mua $1.75 nghìn tỷ MBS và Treasuries. TARP $700 tỷ giải cứu ngân hàng. FDIC bảo lãnh tiền gửi không giới hạn.",
    impact:
      "S&P 500 mất 57% từ đỉnh. GDP Mỹ giảm 4.3%. Thất nghiệp tăng từ 4.5% lên 10%. 8 triệu người mất việc. 4 triệu ngôi nhà bị tịch thu. Credit spread HY vọt lên 22%.",
    lesson:
      "Leverage trong hệ thống tài chính là rủi ro hệ thống lớn nhất. Credit spread tăng đột biến là tín hiệu sớm nhất. Yield curve đảo ngược từ 2006 — đã cảnh báo 2 năm trước. Khi ngân hàng mất niềm tin lẫn nhau, toàn bộ hệ thống đóng băng.",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: credit spread và yield curve đã phát tín hiệu trước các sự kiện tín dụng bao lâu? So sánh chuỗi lịch sử với các chỉ báo thất nghiệp và lãi suất; dữ liệu này không tự xác định hành động đầu tư.",
    keyIndicators: [
      "credit-spread-us",
      "yield-curve",
      "fed-funds-rate",
      "unemployment-us",
      "us10y-yield",
      "fed-balance-sheet",
    ],
    severity: "severe",
    region: "GLOBAL",
    kind: "historical",
  },
  {
    id: "covid-crash-2020",
    name: "COVID-19 Market Crash",
    period: { start: "2020-02-01", end: "2020-12-01" },
    context:
      "Đại dịch COVID-19 gây ra cú sốc nhu cầu và cung cùng lúc — chưa từng có trong lịch sử. Lockdown toàn cầu, chuỗi cung ứng đứt gãy. Thị trường tài chính cực kỳ bất ổn: S&P 500 giảm 34% chỉ trong 33 ngày — nhanh nhất lịch sử.",
    policy:
      "Phản ứng nhanh và mạnh nhất lịch sử: Fed cắt về 0% trong emergency meeting. QE không giới hạn. $2.2 nghìn tỷ CARES Act. PPP cho doanh nghiệp nhỏ. Unemployment $600/tuần bổ sung. Tổng kích thích toàn cầu >$20 nghìn tỷ.",
    impact:
      "GDP Mỹ Q2/2020 giảm 31.4% — kỷ lục lịch sử. Thất nghiệp vọt lên 14.7% chỉ trong 2 tháng. -20.5 triệu việc làm tháng 4/2020. Nhưng thị trường chứng khoán phục hồi nhanh nhất lịch sử nhờ kích thích khổng lồ.",
    lesson:
      "V-shape recovery là có thể khi chính sách tài khóa + tiền tệ đủ mạnh. Kích thích quá mức → inflation hậu COVID (2021-2022). Initial claims là chỉ báo có tần suất cao để quan sát cú sốc việc làm. Cần tách phản ứng chính sách khỏi kết luận về hướng đi của thị trường.",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: chính sách tiền tệ, initial claims và M2 đã thay đổi như thế nào trước và sau cú sốc? So sánh thời điểm phát hành với phản ứng của thị trường; đây là mô tả lịch sử, không phải khuyến nghị.",
    keyIndicators: [
      "initial-claims-us",
      "unemployment-us",
      "nfp-us",
      "fed-funds-rate",
      "fed-balance-sheet",
      "m2-us",
      "credit-spread-us",
    ],
    severity: "severe",
    region: "GLOBAL",
    kind: "historical",
  },
  {
    id: "inflation-crisis-2022",
    name: "Inflation Crisis 2022-2023",
    period: { start: "2021-06-01", end: "2023-12-01" },
    context:
      "M2 tăng 27% YoY năm 2021 + chuỗi cung ứng đứt gãy + thị trường lao động thắt chặt → lạm phát cao nhất 40 năm. CPI đạt 9.1% tháng 6/2022. Fed phản ứng muộn (gọi là 'transitory' quá lâu) → phải tăng lãi suất mạnh nhất kể từ 1980.",
    policy:
      "Fed tăng lãi suất từ 0-0.25% lên 5.25-5.50% trong 18 tháng (450 bps) — nhanh nhất kể từ Volcker 1980. Cùng lúc QT $95 tỷ/tháng. ECB, BOE, BOC, RBNZ cũng tăng mạnh đồng loạt. Global monetary tightening chưa từng có.",
    impact:
      "Bond crash: US 10Y từ 1.5% lên 5.0% — lỗ ~30% với bond 10 năm. Stocks: NASDAQ giảm 33%, S&P giảm 20%. BTC giảm 75%. Bất động sản Mỹ giao dịch đóng băng (mortgage rate 3% → 7%+). DXY tăng lên 114.8 — ảnh hưởng toàn EM.",
    lesson:
      "M2 tăng đột biến thường đi trước lạm phát với độ trễ thay đổi theo từng giai đoạn; không nên xem đó là quy luật chắc chắn. 'Transitory inflation' là một giả định chính sách đã bị thách thức. Khi nhiều tài sản cùng giảm, các khái niệm như cash/gold cần được xem là chủ đề để kiểm tra, không phải kết luận an toàn.",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: M2, Core PCE và lãi suất có quan hệ dẫn-trễ nào trong giai đoạn này? Kiểm tra từng chuỗi, đơn vị đo và thời điểm công bố trước khi hình thành diễn giải.",
    keyIndicators: [
      "m2-us",
      "cpi-us",
      "core-pce-us",
      "fed-funds-rate",
      "us10y-yield",
      "yield-curve",
      "dxy",
      "credit-growth-vn",
    ],
    severity: "moderate",
    region: "GLOBAL",
    kind: "historical",
  },
  {
    id: "vn-realestate-cycle",
    name: "Chu kỳ BĐS Việt Nam 2020-2023",
    period: { start: "2020-06-01", end: "2023-12-01" },
    context:
      "Lãi suất huy động về 3-4% (thấp nhất lịch sử) + COVID thay đổi tâm lý (muốn sở hữu nhà) + tín dụng BĐS nới lỏng → sốt đất toàn quốc 2020-2021. Đất vùng ven tăng 2-3 lần. Sau đó khủng hoảng trái phiếu BĐS + vụ Vạn Thịnh Phát/SCB → thị trường đóng băng 2022-2023.",
    policy:
      "NHNN nới tín dụng BĐS và hạ lãi điều hành 2020. Khi thị trường sốt, NHNN kiểm soát tín dụng BĐS từ 2021. Sau khủng hoảng SCB tháng 10/2022, NHNN tăng lãi khẩn cấp, thị trường trái phiếu doanh nghiệp đóng băng. 2023 bắt đầu cắt giảm lãi để cứu thị trường.",
    impact:
      "Đất vùng ven +200-300% rồi về -30-40% từ đỉnh. Thanh khoản giao dịch giảm 90%. Nhiều chủ đầu tư lớn (Novaland, Hưng Thịnh...) mất khả năng trả nợ trái phiếu. Hàng trăm nghìn sản phẩm tồn kho pháp lý. VN-Index từ 1,528 → 873.",
    lesson:
      "Tín dụng BĐS tăng mạnh kết hợp lãi suất thấp tạo bong bóng tài sản. Thị trường trái phiếu doanh nghiệp VN còn yếu — rủi ro hệ thống khi chủ đầu tư vỡ nợ. Tốc độ tín dụng tăng trưởng >15% + đất tăng >50% YoY = cảnh báo đỏ. Giao dịch BĐS giảm 50% là dấu hiệu đỉnh.",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: tín dụng, lãi suất và giao dịch BĐS đã dẫn-trễ nhau ra sao? Mở các chỉ báo liên quan để kiểm tra độ phủ dữ liệu và phân biệt giá, thanh khoản với diễn giải về rủi ro.",
    keyIndicators: [
      "credit-growth-vn",
      "deposit-rate-vn",
      "lending-rate-vn",
      "apartment-price-vn",
      "transaction-volume-vn",
      "vnindex",
      "usd-vnd",
    ],
    severity: "moderate",
    region: "VN",
    kind: "historical",
  },
  {
    id: "vn-stock-cycle-2021",
    name: "Chu kỳ TTCK Việt Nam 2020-2022",
    period: { start: "2020-04-01", end: "2023-01-01" },
    context:
      "COVID crash tháng 3/2020 đưa VN-Index về vùng 660, sau đó thanh khoản và số tài khoản mới tăng mạnh. Tiền rẻ + F0 (nhà đầu tư mới) ào ạt vào thị trường + cổ phiếu penny pump + thao túng → bong bóng. Hơn 1 triệu tài khoản mới mở 2021. VN-Index lên 1,528 điểm — ATH lịch sử tháng 11/2021.",
    policy:
      "NHNN giữ lãi suất thấp hỗ trợ kinh tế COVID. Margin lending tăng vọt lên 170,000 tỷ (gấp 3 lần 2019). Sau đó UBCKNN siết IPO, phát hành, thao túng. Vụ FLC/Trịnh Văn Quyết (tháng 3/2022) và Tân Hoàng Minh rồi Vạn Thịnh Phát gây hoảng loạn.",
    impact:
      "VN-Index từ 1,528 → 873 (-43%) trong 6 tháng. Margin calls hàng loạt. Nhiều cổ phiếu vốn hóa nhỏ giảm 80-90%. Thanh khoản từ 28,000 tỷ/ngày xuống 6,000 tỷ/ngày. F0 lỗ nặng, nhiều người rời thị trường.",
    lesson:
      "P/E thị trường >18x + margin cao >150,000 tỷ + F0 ào ạt vào là một cấu hình rủi ro cần nghiên cứu, không phải tín hiệu tự động. Các tin tức về lãnh đạo doanh nghiệp và thanh khoản cần được đối chiếu với dữ liệu nguồn, thời điểm và bối cảnh trước khi diễn giải.",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: P/E, margin lending, dòng vốn ngoại và thanh khoản đã đồng biến trước giai đoạn điều chỉnh như thế nào? Kiểm tra ngày quan sát và nguồn của từng chuỗi; không suy ra hành động cá nhân từ một ngưỡng đơn lẻ.",
    keyIndicators: [
      "vnindex",
      "vnindex-pe",
      "market-liquidity-vn",
      "foreign-flow-vn",
      "credit-growth-vn",
      "deposit-rate-vn",
    ],
    severity: "moderate",
    region: "VN",
    kind: "historical",
  },
  {
    id: "fed-soft-landing-2024",
    name: "Scenario: Fed Soft Landing 2024",
    period: { start: "2024-01-01", end: "2024-12-01" },
    context:
      "Sau chu kỳ tăng lãi suất mạnh nhất 40 năm (2022-2023), lạm phát giảm từ 9.1% về 3.1% mà không gây recession — hiếm có trong lịch sử. Fed bắt đầu cắt lãi từ tháng 6/2024 (từ 5.5% về 4.75%). S&P 500 recovery mạnh, tăng 22% năm 2024. Thị trường lao động vẫn chặt (thất nghiệp 3.8%).",
    policy:
      "Fed thực hiện 'measured cuts' — cắt 75 bps trong 3 lần họp (June, September, December 2024). Powell nhấn mạnh 'data-dependent' và tránh lặp lại sai lầm 1970s (cắt quá nhanh → inflation tái phát). ECB và BOE cũng bắt đầu cắt lãi nhưng chậm hơn Fed.",
    impact:
      "Bonds rally mạnh — US 10Y từ 5.0% về 3.8%. Tech stocks rebound (NASDAQ +28%). Regional banks recover sau khủng hoảng SVB 2023. Real estate thở phào với mortgage rates về 6%. DXY giảm từ 108 về 102 — giúp EM currencies phục hồi.",
    lesson:
      "Soft landing là có thể với policy mix đúng. Productivity growth (nhờ AI) giúp kinh tế tăng trưởng mà không gây inflation. Trong mẫu lịch sử này, nhóm tài sản rủi ro tăng trước một số lần cắt lãi thực tế; đó là mô tả cần kiểm tra theo từng chuỗi và không phải quy tắc dự báo hay hướng dẫn giao dịch.",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: CPI, Core PCE, quyết định của Fed và phản ứng của các nhóm tài sản có quan hệ thời gian thế nào trong kịch bản này? Đây là scenario để kiểm tra giả định, không phải dự báo hay hướng dẫn giao dịch.",
    keyIndicators: [
      "fed-funds-rate",
      "cpi-us",
      "core-pce-us",
      "unemployment-us",
      "us10y-yield",
      "credit-spread-us",
      "dxy",
    ],
    severity: "mild",
    region: "US",
    kind: "scenario",
  },
  {
    id: "ai-boom-2024-2025",
    name: "Scenario: AI Infrastructure Boom 2024-2025",
    period: { start: "2024-01-01", end: "2025-12-01" },
    context:
      "Từ ChatGPT (Nov 2022) đến Sora, Claude, Gemini — AI trở thành megatrend lớn nhất thập kỷ. Nvidia market cap vượt $3T (tháng 6/2024). CAPEX cho AI infrastructure (data centers, GPUs, power) tăng vọt. Microsoft, Google, Amazon chi hàng trăm tỷ USD cho AI. P/E của Magnificent 7 lên 35x.",
    policy:
      "Chính phủ các nước đua nhau đầu tư AI: US CHIPS Act bổ sung $50B cho semiconductors, EU AI Act regulation, China National AI Strategy. Fed không can thiệp vào AI bubble — học từ dotcom, chờ xem liệu có real earnings hay không. SEC giám sát IPO các công ty AI hype.",
    impact:
      "Nvidia +240% trong 2024-2025. NASDAQ outperform S&P 500 18%. Energy demand tăng vọt (AI data centers tiêu tốn nhiều điện). Power utilities stocks tăng mạnh. Small cap tech bị bỏ rơi (capital concentrate vào Big Tech). Valuations cao nhất kể từ dotcom bubble.",
    lesson:
      "Megatrends có thể kéo dài hàng năm trước khi mean revert. Thị trường có thể duy trì P/E cao nếu earnings growth đủ mạnh. Infrastructure plays (power, cooling, chips) có thể có diễn biến khác software trong giai đoạn đầu; cần kiểm tra chuỗi doanh thu, định giá và thời gian quan sát trước khi kết luận.",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: chi tiêu hạ tầng, doanh thu, định giá và nhu cầu năng lượng có thay đổi đồng pha không? So sánh các giả định của scenario với dữ liệu thực tế trước khi kết luận về triển vọng.",
    keyIndicators: [
      "pmi-us",
      "credit-spread-us",
      "us10y-yield",
      "dxy",
      "bitcoin",
      "gold",
    ],
    severity: "mild",
    region: "GLOBAL",
    kind: "scenario",
  },
  {
    id: "vn-recovery-2024-2025",
    name: "Scenario: Việt Nam Economic Recovery 2024-2025",
    period: { start: "2024-01-01", end: "2025-12-01" },
    context:
      "Sau đáy khủng hoảng BĐS và TTCK 2022-2023, Việt Nam bắt đầu phục hồi mạnh mẽ. Chính phủ ban hành gói kích thích 120,000 tỷ (tháng 1/2024) tập trung vào hạ tầng. FDI tăng trở lại nhờ China+1 strategy. VN-Index từ 1,050 (Jan 2024) lên 1,380 (Dec 2025). Credit growth đạt 14-15%.",
    policy:
      "NHNN cắt lãi điều hành 4 lần trong 2024 (về 4.5%). Nới room tín dụng BĐS có chọn lọc. Chính phủ đẩy nhanh giải ngân vốn ODA và đầu tư công. Thông qua Luật Đất đai mới (2024) và Luật Nhà ở sửa đổi giúp gỡ vướng pháp lý. NHNN cho phép restructure nợ BĐS đến 2025.",
    impact:
      "GDP growth 2024: 6.5%, 2025: 7.0% — trở lại궤đạo trước COVID. VN-Index +31% trong 2 năm. Foreign inflows trở lại mạnh mẽ (+$3.2B năm 2024). BĐS Hà Nội/HCM phục hồi 15-20% so với đáy 2023. Tuy nhiên, nhiều chủ đầu tư nhỏ vẫn phá sản, chỉ big players sống sót.",
    lesson:
      "Việt Nam có khả năng phục hồi nhanh với policy support đúng. Tuy nhiên recovery không đều — Hà Nội/HCM phục hồi nhanh hơn tier 2/3. China+1 là tailwind dài hạn nhưng phụ thuộc vào địa chính trị. Credit growth 14-15% là mức lành mạnh, tránh tái phạm sai lầm 2020-2021 (quá nóng).",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: FDI giải ngân, tín dụng, tăng trưởng GDP và VN-Index có cùng nhịp phục hồi không? Kiểm tra khác biệt giữa dữ liệu cam kết và giải ngân, cùng các giới hạn của scenario này.",
    keyIndicators: [
      "vnindex",
      "vnindex-pe",
      "credit-growth-vn",
      "deposit-rate-vn",
      "lending-rate-vn",
      "usd-vnd",
      "foreign-flow-vn",
      "market-liquidity-vn",
    ],
    severity: "mild",
    region: "VN",
    kind: "scenario",
  },
  {
    id: "banking-stress-2025-2026",
    name: "Scenario: Global Banking Stress 2025-2026",
    period: { start: "2025-09-01", end: "2026-06-01" },
    context:
      "Sau 2 năm lãi suất cao (4.5-5%), các ngân hàng vùng (regional banks) Mỹ và châu Âu bắt đầu báo cáo NPL tăng mạnh trong commercial real estate (CRE) và corporate loans. Deutsche Bank, Credit Agricole gặp vấn đề. US regional bank stocks giảm 35% từ Sept 2025. Unrealized losses trong bond portfolios tái hiện.",
    policy:
      "Fed và ECB phải balance giữa chống inflation và financial stability. Fed cắt emergency 50 bps tháng 3/2026 để hỗ trợ banking system. ECB mở lại LTRO facility. FDIC nâng insurance limit lên $500K. Basel III implementation bị delay thêm 1 năm. Không có systemic bailout như 2008, nhưng có targeted support.",
    impact:
      "Credit spread tăng từ 3.5% lên 5.2% trong 3 tháng. S&P 500 correction -18% (từ 5,800 về 4,750). Flight to quality: US Treasuries rally (10Y về 3.2%). Gold tăng 22%. Small business lending đóng băng. M&A activity giảm 60%. Dù vậy không có crisis hệ thống như 2008 — regulated banks có capital buffer tốt hơn.",
    lesson:
      "Higher for longer có hậu quả. Yield curve inversion kéo dài (2022-2024) đã cảnh báo. Commercial real estate là điểm yếu lớn nhất (remote work + high rates). Credit spread >5% là dấu hiệu stress nghiêm trọng. Banking sector có thể gặp vấn đề kể cả khi macro data còn tốt (lagging indicator).",
    whatIDo:
      "Câu hỏi nghiên cứu tiếp theo: credit spread, nợ xấu CRE, lãi suất và thanh khoản ngân hàng có phản ứng theo thứ tự nào trong scenario này? Đây là kịch bản giả định; không xem các ngưỡng minh họa là tín hiệu mua bán.",
    keyIndicators: [
      "credit-spread-us",
      "fed-funds-rate",
      "us10y-yield",
      "unemployment-us",
      "dxy",
      "gold",
      "bitcoin",
    ],
    severity: "moderate",
    region: "GLOBAL",
    kind: "scenario",
  },
];
