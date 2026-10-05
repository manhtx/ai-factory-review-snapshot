import { DataSourceConfig } from "../src/app/config/dataSources.js";
import { ProviderCapability } from "../src/app/config/providerRegistry.js";

export interface ResearchLineageRun {
  id: string;
  title: string;
  indicatorIds: string[];
  sourceVintages: Array<{ indicatorId: string; sourceSeriesId: string | null; vintage: string | null }>;
  transformations: string[];
  calculation: { method: string; version: string };
  evidence: Array<{ indicatorId: string; sourceUrl: string; periods: string[] }>;
  output: unknown;
  limitations: string[];
}

export interface ResearchLineageNode {
  id: string;
  type: "run" | "indicator" | "source" | "vintage" | "transformation" | "calculation" | "output";
  label: string;
  evidence: "configuration" | "persisted-run" | "none";
}

export interface ResearchLineageEdge {
  from: string;
  to: string;
  relation: "uses" | "derived-from" | "transformed-by" | "calculated-by" | "produces";
}

export function buildResearchLineage(
  run: ResearchLineageRun,
  sources: Record<string, DataSourceConfig>,
  capabilities: Record<string, ProviderCapability> = {},
) {
  const nodes: ResearchLineageNode[] = [{
    id: `run:${run.id}`, type: "run", label: run.title, evidence: "persisted-run",
  }];
  const edges: ResearchLineageEdge[] = [];
  const limitations = [...run.limitations];
  const addNode = (node: ResearchLineageNode) => { if (!nodes.some((item) => item.id === node.id)) nodes.push(node); };
  const addEdge = (edge: ResearchLineageEdge) => { if (!edges.some((item) => item.from === edge.from && item.to === edge.to && item.relation === edge.relation)) edges.push(edge); };

  for (const indicatorId of run.indicatorIds) {
    const indicatorNode = `indicator:${indicatorId}`;
    addNode({ id: indicatorNode, type: "indicator", label: indicatorId, evidence: sources[indicatorId] ? "configuration" : "none" });
    addEdge({ from: `run:${run.id}`, to: indicatorNode, relation: "uses" });
    const source = sources[indicatorId];
    if (!source) {
      limitations.push(`Missing catalog source for ${indicatorId}.`);
      continue;
    }
    const sourceNode = `source:${source.type}:${source.seriesId ?? source.coinId ?? indicatorId}`;
    addNode({ id: sourceNode, type: "source", label: source.source, evidence: "configuration" });
    addEdge({ from: indicatorNode, to: sourceNode, relation: "derived-from" });
    const capability = capabilities[source.type];
    if (!capability) limitations.push(`Provider capability evidence is unavailable for ${indicatorId}.`);
    const vintage = run.sourceVintages.find((item) => item.indicatorId === indicatorId);
    if (vintage) {
      const vintageNode = `vintage:${indicatorId}:${vintage.vintage ?? "unknown"}`;
      addNode({ id: vintageNode, type: "vintage", label: vintage.vintage ?? "unknown vintage", evidence: "persisted-run" });
      addEdge({ from: sourceNode, to: vintageNode, relation: "uses" });
    } else {
      limitations.push(`Source vintage is missing for ${indicatorId}.`);
    }
  }

  for (const transformation of run.transformations) {
    const node = `transformation:${transformation}`;
    addNode({ id: node, type: "transformation", label: transformation, evidence: "persisted-run" });
    addEdge({ from: `run:${run.id}`, to: node, relation: "transformed-by" });
  }
  const calculationNode = `calculation:${run.calculation.method}:${run.calculation.version}`;
  addNode({ id: calculationNode, type: "calculation", label: `${run.calculation.method} v${run.calculation.version}`, evidence: "persisted-run" });
  addEdge({ from: `run:${run.id}`, to: calculationNode, relation: "calculated-by" });
  const outputNode = `output:${run.id}`;
  addNode({ id: outputNode, type: "output", label: "Research output", evidence: run.output === null ? "none" : "persisted-run" });
  addEdge({ from: calculationNode, to: outputNode, relation: "produces" });

  return { runId: run.id, nodes, edges, limitations: [...new Set(limitations)] };
}
