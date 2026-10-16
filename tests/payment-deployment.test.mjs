import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

test('Vercel API compiler emits JavaScript imports for the complete payment module graph', () => {
  const root = process.cwd();
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const entries = readdirSync(path.join(root, 'api/payments'))
    .filter(name => name.endsWith('.ts'))
    .map(name => path.join(root, 'api/payments', name));
  assert.equal(entries.length, 8);
  const program = ts.createProgram(entries, {
    ...parsed.options, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022, skipLibCheck: true,
    noEmit: false, outDir: path.join(root, 'node_modules/.tmp/payment-emit'),
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n') })), []);
  const emitted = new Map();
  const result = program.emit(undefined, (file, content) => emitted.set(file.replaceAll('\\', '/'), content));
  assert.equal(result.emitSkipped, false);
  const javascript = [...emitted].filter(([file]) => file.endsWith('.js'));
  assert.ok(javascript.some(([file]) => file.endsWith('/api/payments/config.js')));
  assert.ok(javascript.some(([file]) => file.endsWith('/api/payments/alerts.js')));
  assert.ok(javascript.some(([file]) => file.endsWith('/server/payments/handler.js')));
  for (const [file, content] of javascript) {
    assert.doesNotMatch(content, /(?:from\s*|import\s*\()["'][.]{1,2}\/[^"']+\.ts["']/, file);
  }
});
