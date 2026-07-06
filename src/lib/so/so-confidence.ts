export const AUTO_APPLY_CONFIDENCE = 0.72;

export function needsReview(confidence: number) {
  return confidence < AUTO_APPLY_CONFIDENCE;
}

export function averageConfidence(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
