import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const base = path.join(root, 'docs/successor-takeover');
const inventory = JSON.parse(readFileSync(path.join(base, 'evidence/legacy-execution-surface.json')));
const targets = JSON.parse(readFileSync(path.join(base, 'TARGET_SYSTEM_MAP.json')));
const names = new Set(inventory.files.map(file => file.path));
const edges = [], unresolved = [];
for (const file of inventory.files) {
  const bytes = readFileSync(path.join(root, file.path));
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`SOURCE_DRIFT:${file.path}`);
  if (!/\.(?:[cm]?js|tsx?)$/.test(file.path)) continue;
  const source = ts.createSourceFile(file.path, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  function record(node, spec, kind) {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    if (!spec || !ts.isStringLiteralLike(spec)) { unresolved.push({ file: file.path, line, kind, reason: 'NON_LITERAL' }); return; }
    if (!spec.text.startsWith('.')) return; // External packages/aliases are not resolved here.
    const stem = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), spec.text));
    const sourceStem = stem.replace(/\.(?:js|mjs|cjs)$/, '');
    const matches = [...new Set([stem, ...['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'].map(ext => sourceStem + ext)])].filter(name => names.has(name));
    if (matches.length !== 1) { unresolved.push({ file: file.path, line, kind, specifier: spec.text, reason: matches.length ? 'AMBIGUOUS' : 'OUTSIDE_OR_UNRESOLVED' }); return; }
    edges.push({ consumer: file.path, source: matches[0], line, kind, test: /\.test\./.test(file.path) });
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) record(node, node.moduleSpecifier, node.importClause?.isTypeOnly ? 'TYPE_IMPORT' : 'IMPORT');
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) record(node, node.moduleSpecifier, node.isTypeOnly ? 'TYPE_REEXPORT' : 'REEXPORT');
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) record(node, node.arguments[0], 'DYNAMIC_IMPORT');
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') record(node, node.arguments[0], 'REQUIRE');
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const capabilities = targets.subsystems.map(item => {
  const direct = edges.filter(edge => edge.source === item.source);
  const visited = new Set([item.source]), pending = [item.source];
  while (pending.length) {
    const source = pending.pop();
    for (const edge of edges.filter(edge => edge.source === source && !edge.test && !edge.kind.startsWith('TYPE_'))) {
      if (!visited.has(edge.consumer)) { visited.add(edge.consumer); pending.push(edge.consumer); }
    }
  }
  visited.delete(item.source);
  return { subsystem: item.subsystem, disposition: item.capabilityDisposition, source: item.source,
    sourceSha256: inventory.files.find(file => file.path === item.source)?.sha256,
    requiredBehavior: item.rationale, directConsumers: direct, transitiveNonTestConsumers: [...visited].sort(),
    runtimeReachability: 'UNVERIFIED', preservedBySuccessor: 'UNPROVEN' };
});
const result = { schema: 'successor-takeover.capability-preservation.v1', authoritative: false,
  sourceDenominator: inventory.denominatorSha256, status: 'BOUNDED_SOURCE_CONSUMER_MAP', capabilities, unresolved,
  limitations: ['Representative subsystem sources are not a complete capability denominator', 'Module edges do not prove symbol invocation or active runtime use', 'Inline type-only imports may be conservatively counted as runtime edges', 'Nonrelative aliases, reflection, generated code and external runtime wiring require separate review'],
  retirementsAuthorized: [], migrationAcceptance: 'Every required behavior needs adapter and end-to-end proof before retirement; no absence-based deletion.' };
const output = path.join(base, 'CAPABILITY_PRESERVATION_MAP.json');
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, capabilities: capabilities.length, edges: edges.length, unresolved: unresolved.length }));
