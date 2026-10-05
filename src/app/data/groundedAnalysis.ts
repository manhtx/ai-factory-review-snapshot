import { Indicator } from "./types";
import { isCurrentSourceBackedIndicator } from "./dataContract";
import { deterministicFingerprint } from "./deterministicFingerprint";

export interface GroundedAnalysis {
  text: string;
  usedIndicators: string[];
  evidence: Array<{
    indicatorId: string;
    value: number;
    unit: string;
    asOf: string;
    status: string;
    quality: string;
    sourceName: string;
    seriesId: string | null;
    frequency: string;
    freshness?: string;
    sourceUrl: string | null;
  }>;
  calculation: {
    method: "latest-direction";
    definition: string;
    comparedIndicatorCount: number;
    causalInference: false;
  };
  limitation: string;
  eligibility: {
    status: "eligible" | "partial" | "unavailable";
    selectedCount: number;
    eligibleCount: number;
    excludedIndicatorIds: string[];
    reason: string;
  };
}

export interface EvidenceCommentarySnapshot {
  schema: "macro-os.evidence-commentary";
  version: 1;
  generatedAt: string;
  fingerprint: string;
  question: string;
  answer: string;
  usedIndicators: string[];
  evidence: GroundedAnalysis["evidence"];
  calculation: GroundedAnalysis["calculation"];
  limitation: string;
  eligibility: GroundedAnalysis["eligibility"];
  boundary: "bounded-research-artifact";
}

export function createEvidenceCommentarySnapshot(
  question: string,
  analysis: GroundedAnalysis,
  generatedAt = new Date().toISOString(),
): EvidenceCommentarySnapshot {
  const bounded = {
    question,
    answer: analysis.text,
    usedIndicators: [...analysis.usedIndicators],
    evidence: analysis.evidence.map((item) => ({ ...item })),
    calculation: { ...analysis.calculation },
    limitation: analysis.limitation,
    eligibility: {
      ...analysis.eligibility,
      excludedIndicatorIds: [...analysis.eligibility.excludedIndicatorIds],
    },
  };
  return {
    schema: "macro-os.evidence-commentary",
    version: 1,
    generatedAt,
    fingerprint: deterministicFingerprint(bounded),
    ...bounded,
    boundary: "bounded-research-artifact",
  };
}

function selectIndicators(
  question: string,
  indicators: Indicator[],
): Indicator[] {
  const query = question.toLowerCase();
  const preferred =
    query.includes("việt") || query.includes("vn") || query.includes("bđs")
      ? ["credit-growth-vn", "cpi-vn", "gdp-vn", "usd-vnd", "vnindex"]
      : query.includes("fed")
        ? [
            "fed-funds-rate",
            "core-pce-us",
            "unemployment-us",
            "us10y-yield",
            "dxy",
          ]
        : query.includes("rủi ro")
          ? [
              "credit-spread-us",
              "yield-curve",
              "unemployment-us",
              "dxy",
              "credit-growth-vn",
            ]
          : [
              "core-pce-us",
              "fed-funds-rate",
              "unemployment-us",
              "yield-curve",
              "credit-spread-us",
            ];
  return preferred
    .map((id) => indicators.find((indicator) => indicator.id === id))
    .filter((indicator): indicator is Indicator => Boolean(indicator));
}

function formatObservation(indicator: Indicator): string {
  const provenance = indicator.provenance;
  const status = provenance?.status ?? "simulated";
  return (
    `• ${indicator.shortName}: ${indicator.snapshot.value.toLocaleString()} ${indicator.unit} ` +
    `(as of ${indicator.snapshot.date}, ${status}, source: ${provenance?.sourceName ?? indicator.source}, ` +
    `series: ${provenance?.sourceSeriesId ?? "N/A"}, freshness: ${provenance?.freshness ?? "not-provided"}, ${provenance?.sourceUrl ?? "source URL unavailable"})`
  );
}

export function generateGroundedAnalysis(
  question: string,
  indicators: Indicator[],
): GroundedAnalysis {
  const selected = selectIndicators(question, indicators);
  if (selected.length === 0) {
    return {
      text:
        "**SỰ KIỆN — observations và provenance**\nChưa có bằng chứng chỉ báo phù hợp.\n\n" +
        "**GIỚI HẠN**\nKhông tạo kết luận khi chưa có bằng chứng từ catalog.",
      usedIndicators: [],
      evidence: [],
      calculation: {
        method: "latest-direction",
        definition:
          "Compare the direction of each eligible indicator between its two latest observations.",
        comparedIndicatorCount: 0,
        causalInference: false,
      },
      limitation: "No matching indicator evidence is available.",
      eligibility: {
        status: "unavailable",
        selectedCount: 0,
        eligibleCount: 0,
        excludedIndicatorIds: [],
        reason: "No registered indicators matched the question.",
      },
    };
  }
  const eligible = selected.filter(isCurrentSourceBackedIndicator);
  const excludedIndicatorIds = selected
    .filter((indicator) => !eligible.includes(indicator))
    .map((indicator) => indicator.id);
  const eligibility = {
    status:
      eligible.length === 0
        ? "unavailable"
        : eligible.length < selected.length
          ? "partial"
          : "eligible",
    selectedCount: selected.length,
    eligibleCount: eligible.length,
    excludedIndicatorIds,
    reason:
      eligible.length === 0
        ? "Không có chỉ báo nào được chọn đồng thời đạt actual, verified, có URL nguồn và freshness hiện tại."
        : excludedIndicatorIds.length
          ? `${excludedIndicatorIds.length} chỉ báo được chọn bị loại khỏi phép tính vì yêu cầu bằng chứng chưa đầy đủ.`
          : "Tất cả chỉ báo được chọn đều đạt actual, verified, có URL nguồn và freshness hiện tại.",
  } as GroundedAnalysis["eligibility"];
  const rising = eligible
    .filter((indicator) => indicator.trend === "up")
    .map((indicator) => indicator.shortName);
  const falling = eligible
    .filter((indicator) => indicator.trend === "down")
    .map((indicator) => indicator.shortName);

  const facts = eligible.map(formatObservation).join("\n");
  const exclusionNote = excludedIndicatorIds.length
    ? `\n\n**CỔNG BẰNG CHỨNG**\n${eligibility.reason} Bị loại: ${excludedIndicatorIds.join(", ")}.`
    : "";
  const inference =
    (eligible.length === 0
      ? "Không có phép tính inference nào được thực hiện vì không có observation đủ điều kiện. "
      : `Các phép tính deterministic cho thấy ${rising.length ? `${rising.join(", ")} đang tăng` : "không có chuỗi tăng rõ"}; ` +
        `${falling.length ? `${falling.join(", ")} đang giảm` : "không có chuỗi giảm rõ"}. `) +
    "Đây là mô tả hướng biến động giữa hai kỳ gần nhất, không chứng minh quan hệ nhân quả.";
  const limitation =
    eligible.length === selected.length
      ? "Các observation dùng trong phép tính có trạng thái actual, quality verified và URL nguồn trong phiên hiện tại."
      : "Chỉ observation đạt actual + verified + URL nguồn được dùng trong suy luận; phần bị loại không được dùng như đánh giá thị trường hiện tại.";

  return {
    text:
      `**SỰ KIỆN — observations và provenance**\n${facts || "Chưa có observation đủ điều kiện có nguồn."}${exclusionNote}\n\n` +
      `**SUY LUẬN — deterministic, phạm vi giới hạn**\n${inference}\n\n` +
      `**KỊCH BẢN — không phải dự báo**\nNếu các hướng biến động trên tiếp diễn, cần kiểm tra lại bằng bản phát hành mới và nguồn gốc trước khi hình thành kết luận. Không có xác suất hoặc khuyến nghị giao dịch được tạo.\n\n` +
      `**GIỚI HẠN**\n${limitation}\n\nCâu hỏi: “${question}”`,
    usedIndicators: eligible.map((indicator) => indicator.id),
    evidence: eligible.map((indicator) => ({
      indicatorId: indicator.id,
      value: indicator.snapshot.value,
      unit: indicator.unit,
      asOf: indicator.snapshot.date,
      status: indicator.provenance?.status ?? "unavailable",
      quality: indicator.provenance?.quality ?? "unverified",
      sourceName: indicator.provenance?.sourceName ?? indicator.source,
      seriesId: indicator.provenance?.sourceSeriesId ?? null,
      frequency: indicator.frequency,
      freshness: indicator.provenance?.freshness,
      sourceUrl: indicator.provenance?.sourceUrl ?? null,
    })),
    calculation: {
      method: "latest-direction",
      definition:
        "Compare the direction of each eligible indicator between its two latest observations.",
      comparedIndicatorCount: eligible.length,
      causalInference: false,
    },
    limitation,
    eligibility,
  };
}
