/** Normalize legacy severity/horizon fields without mutating append-only backlog history. */
export function normalizedPriority(item) {
  if (item.priority && /^P[0-3]$/.test(item.priority)) return item.priority;
  if (item.severity === "blocker" || item.horizon === "H0") return "P0";
  if (item.severity === "critical" || item.horizon === "H1") return "P1";
  if (item.severity === "major" || item.horizon === "H2") return "P2";
  return "P3";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import("node:fs/promises");
  const input = process.argv[2] ?? ".ai-company/backlog.jsonl";
  const lines = (await fs.readFile(input, "utf8")).trim().split("\n").filter(Boolean);
  const items = lines.map((line) => JSON.parse(line));
  console.log(JSON.stringify(items.map((item) => ({ id: item.id, priority: normalizedPriority(item) })), null, 2));
}
