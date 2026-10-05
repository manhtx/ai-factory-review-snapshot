import type { AnalystOutput, EvidenceBullet } from "../src/app/data/macroDebate.js";

const identity = (bullet: EvidenceBullet) => JSON.stringify([bullet.indicatorId, bullet.shortName, bullet.value, bullet.unit, bullet.asOf, bullet.trend, bullet.sourceName, bullet.sourceUrl, bullet.seriesId]);

export function validateGroundedAnalystOutput(output: AnalystOutput, allowedBullets: EvidenceBullet[]): AnalystOutput {
  const allowed = new Set(allowedBullets.map(identity));
  if (output.bullets.some((bullet) => !allowed.has(identity(bullet)))) throw new Error("LLM output contains an evidence bullet outside the locked evidence bundle");
  return output;
}
