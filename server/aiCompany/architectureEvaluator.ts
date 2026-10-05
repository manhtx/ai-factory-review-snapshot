export type FreshnessEvaluation = {
  product_quality: number;
  domain_correctness: number;
  reasons: string[];
};

/**
 * Compact deterministic evaluator for the freshness product contract.
 * This calibrates discrimination on known anchors; it is not market/user
 * evidence and must not be used as a production outcome claim.
 */
export function evaluateFreshnessOutput(input: {
  freshness: 'fresh' | 'delayed' | 'outdated' | 'unavailable';
  displayedLabel: string;
  sourceVerified: boolean;
}): FreshnessEvaluation {
  const label = input.displayedLabel.toLowerCase();
  const hasAgeQualifier = /today|day|month|year|delayed|outdated|unavailable|unknown/.test(label);
  const honest = input.freshness === 'fresh'
    ? input.sourceVerified && !/current|latest/.test(label) || input.sourceVerified && hasAgeQualifier
    : !/current|latest/.test(label) && hasAgeQualifier;
  const grounded = input.sourceVerified || input.freshness === 'unavailable';
  return {
    product_quality: honest && grounded ? 5 : honest ? 3 : 0,
    domain_correctness: honest && grounded ? 5 : honest ? 2 : 0,
    reasons: [
      honest ? 'freshness label is consistent with the observed state' : 'freshness label overclaims or lacks an age qualifier',
      grounded ? 'source provenance is sufficient for this anchor' : 'source provenance is missing',
    ],
  };
}

export function calibrateFreshnessEvaluator() {
  const anchors = {
    strong: evaluateFreshnessOutput({ freshness: 'fresh', displayedLabel: '1 month ago', sourceVerified: true }),
    weak: evaluateFreshnessOutput({ freshness: 'outdated', displayedLabel: 'Latest', sourceVerified: true }),
    unsupported: evaluateFreshnessOutput({ freshness: 'fresh', displayedLabel: '1 month ago', sourceVerified: false }),
  };
  return {
    anchors,
    discriminates: anchors.strong.product_quality > anchors.weak.product_quality
      && anchors.strong.domain_correctness > anchors.weak.domain_correctness
      && anchors.strong.product_quality > anchors.unsupported.product_quality,
  };
}
