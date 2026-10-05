import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const statePath = process.env.AI_COMPANY_STATE ?? ".ai-company/company-state.json";
const scorecardPath = process.env.AI_COMPANY_SCORECARD ?? ".ai-company/scorecard.json";
const state = await readJson(statePath);
const scorecard = await readJson(scorecardPath);
const stateScore = Number(state.scorecard_summary?.total_score_100);
const scorecardScore = Number(scorecard.total_score_100);
const errors = [];

if (!Number.isFinite(stateScore) || !Number.isFinite(scorecardScore)) errors.push("canonical score is missing or non-numeric");
if (stateScore !== scorecardScore) errors.push(`canonical score mismatch: company-state=${stateScore}, scorecard=${scorecardScore}`);
if (scorecard.current_epoch !== undefined && state.current_epoch !== scorecard.current_epoch) errors.push(`epoch mismatch: company-state=${state.current_epoch}, scorecard=${scorecard.current_epoch}`);
if (errors.length) {
  console.error(JSON.stringify({ status: "FAIL", statePath, scorecardPath, errors }, null, 2));
  process.exit(1);
} else {
  console.log(JSON.stringify({ status: "PASS", authority: scorecardPath, total_score_100: scorecardScore, current_epoch: state.current_epoch, mission_revision: state.current_revision ?? "not-declared", scorecard_epoch_binding: scorecard.current_epoch ?? "not-declared", historical_snapshots_excluded: true }, null, 2));
}
