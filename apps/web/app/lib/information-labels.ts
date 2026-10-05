import type { ContentNature, SourceDimension, VerificationStatus } from "@aihot/contracts/site";

export const SOURCE_DIMENSION_LABELS: Record<SourceDimension, string> = {
  original: "原始发布",
  secondary: "媒体转述",
  processed: "加工数据",
  research: "研究解读",
  signal: "市场信号",
};

export const CONTENT_NATURE_LABELS: Record<ContentNature, string> = {
  fact: "事实记录",
  estimate: "估算",
  opinion: "观点",
  unknown: "性质待判定",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  original_checked: "已核对原文",
  pending: "待核对原文",
};

export function informationFiltersFromParams(params: URLSearchParams) {
  const pick = <T extends string>(key: string, labels: Record<T, string>): T | null => {
    const value = params.get(key);
    return value && Object.hasOwn(labels, value) ? value as T : null;
  };
  return {
    sourceType: pick("sourceType", SOURCE_DIMENSION_LABELS),
    nature: pick("nature", CONTENT_NATURE_LABELS),
    verification: pick("verification", VERIFICATION_LABELS),
  };
}
