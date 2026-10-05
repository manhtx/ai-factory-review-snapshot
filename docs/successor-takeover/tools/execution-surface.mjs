import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const SCOPE = ['server', 'api', 'scripts', 'src', '.github'];
const ROOT_FILES = ['package.json', 'package-lock.json', 'vite.config.ts', 'vitest.config.ts', 'tsconfig.json', 'eslint.config.js', 'vercel.json', 'index.html'];
const sha = value => createHash('sha256').update(value).digest('hex');
const materialCall = /^(?:appendFile|writeFile|rename|rm|unlink|truncate|mkdir|copyFile|open|exec|execute|run|prepare|transaction|fetch|request|spawn|execFile|fork|kill|sendMessage|createOperation|transition|complete|claim|saveLease)(?:Sync)?$/;

export function captureSurface(root) {
  const paths = [];
  function walk(relative) {
    const full = path.join(root, relative);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error(`SURFACE_SYMLINK_REQUIRES_REVIEW: ${relative}`);
    if (stat.isDirectory()) for (const entry of readdirSync(full).sort()) walk(path.join(relative, entry));
    else if (stat.isFile()) paths.push(relative);
    else throw new Error(`SURFACE_UNKNOWN_FILE_TYPE: ${relative}`);
  }
  for (const dir of SCOPE) if (existsSync(path.join(root, dir))) walk(dir);
  for (const file of ROOT_FILES) if (existsSync(path.join(root, file))) walk(file);
  const files = paths.sort().map(relative => {
    const buffer = readFileSync(path.join(root, relative));
    const text = buffer.toString('utf8');
    const imports = [], calls = [], constructors = [];
    const parsed = /\.(?:[cm]?js|tsx?)$/.test(relative);
    if (parsed) {
      const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
      const visit = node => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          const name = ts.isPropertyAccessExpression(expression) ? expression.name.text : ts.isIdentifier(expression) ? expression.text : null;
          if (name && materialCall.test(name)) calls.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, expression: expression.getText(source) });
          if (expression.kind === ts.SyntaxKind.ImportKeyword || name === 'eval' || name === 'require') calls.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, expression: 'DYNAMIC_OR_MODULE_LOAD' });
        }
        if (ts.isNewExpression(node) && /Ledger|Queue|Store|Supervisor|Lease|Database/.test(node.expression.getText(source))) constructors.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, name: node.expression.getText(source) });
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    return { path: relative, bytes: buffer.length, sha256: sha(buffer), syntax: parsed ? 'AST_SCANNED_EFFECTS_NOT_PROVEN_COMPLETE' : 'OPAQUE_REVIEW_REQUIRED',
      plane: relative.startsWith('server/aiCompany/') ? 'GOVERNANCE' : relative.startsWith('src/') ? 'PRODUCT_CLIENT' : 'REQUIRES_CLASSIFICATION',
      imports, calls, constructors };
  });
  const denominator = { scope: SCOPE, rootFiles: ROOT_FILES, files: files.map(({ path, sha256 }) => ({ path, sha256 })) };
  return { schema: 'successor-takeover.execution-surface.v1', generatedAt: new Date().toISOString(), root: path.resolve(root),
    scope: SCOPE, rootFiles: ROOT_FILES, denominatorSha256: sha(JSON.stringify(denominator)), files,
    claimLimit: 'Bounded source inventory/change detection only. AST effect classification is incomplete; no runtime authority, external entrypoint completeness or writer absence proven.' };
}

export function compareSurface(expected, observed) {
  if (expected.schema !== observed.schema || JSON.stringify(expected.scope) !== JSON.stringify(observed.scope)
    || JSON.stringify(expected.rootFiles) !== JSON.stringify(observed.rootFiles)) throw new Error('SURFACE_DENOMINATOR_CHANGED');
  const old = new Map(expected.files.map(file => [file.path, file.sha256]));
  const current = new Map(observed.files.map(file => [file.path, file.sha256]));
  const added = [...current.keys()].filter(name => !old.has(name));
  const removed = [...old.keys()].filter(name => !current.has(name));
  const changed = [...current.keys()].filter(name => old.has(name) && old.get(name) !== current.get(name));
  return { matches: !added.length && !removed.length && !changed.length, added, removed, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, filename, inputRoot = process.cwd()] = process.argv.slice(2);
  if (!['capture', 'check'].includes(mode) || !filename) throw new Error('Usage: execution-surface.mjs capture|check <file> [root]');
  const observed = captureSurface(path.resolve(inputRoot));
  if (mode === 'capture') {
    const output = path.resolve(filename);
    const relativeOutput = path.relative(observed.root, output);
    if (ROOT_FILES.includes(relativeOutput) || SCOPE.some(dir => relativeOutput === dir || relativeOutput.startsWith(dir + path.sep))) throw new Error('Output overlaps inventoried source');
    writeFileSync(output, JSON.stringify(observed, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ output, files: observed.files.length, effectBearingFiles: observed.files.filter(file => file.calls.length).length, denominatorSha256: observed.denominatorSha256 }));
  } else {
    const result = compareSurface(JSON.parse(readFileSync(filename, 'utf8')), observed);
    console.log(JSON.stringify(result));
    if (!result.matches) process.exitCode = 1;
  }
}
