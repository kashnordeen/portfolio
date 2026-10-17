import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const aliases = {
  '@/data/portfolio': '../src/data/portfolio.ts',
  '@/lib/organizer-release': '../src/lib/organizer-release.ts',
  '@/lib/utils': '../src/lib/utils.ts',
  '@/components/ui/button': '../src/components/ui/button.tsx',
  '@/components/ui/input': '../src/components/ui/input.tsx',
  '@/components/ui/textarea': '../src/components/ui/textarea.tsx',
};
const modules = new Map();
async function moduleUrl(path) {
  if (modules.has(path)) return modules.get(path);
  let javascript = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const parsed = ts.createSourceFile('component.js', javascript, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const imports = parsed.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text);
  for (const specifier of new Set(imports)) {
    const resolved = aliases[specifier] ? await moduleUrl(aliases[specifier]) : import.meta.resolve(specifier);
    javascript = javascript.replaceAll(JSON.stringify(specifier), JSON.stringify(resolved));
  }
  const url = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
  modules.set(path, url);
  return url;
}
const { policyVisibility, projects, certifications, profile } = await import(await moduleUrl(aliases['@/data/portfolio']));
const render = async (path, name) => renderToStaticMarkup(createElement((await import(await moduleUrl(path)))[name]));
function assertExternalLink(html, href) {
  const anchor = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes(`href="${href}"`));
  assert.ok(anchor, `Missing restored link: ${href}`);
  assert.match(anchor, /target="_blank"/);
  assert.match(anchor, /rel="noopener noreferrer"/);
}

test('all four originally hidden portfolio link groups are enabled', () => {
  assert.deepEqual(policyVisibility, { projectLinks: true, projectDownloads: true, credlyLinks: true, contactSocialLinks: true });
});

test('every project repository and configured website renders as a safe external link', async () => {
  const html = await render('../src/components/ProjectsSection/ProjectsSection.tsx', 'ProjectsSection');
  for (const project of projects) {
    assertExternalLink(html, project.link);
    if (project.website) assertExternalLink(html, project.website);
  }
});

test('desktop downloads restore all three platform menus and six existing assets', async () => {
  const html = await render('../src/components/ProjectsSection/ProjectsSection.tsx', 'ProjectsSection');
  const { fallbackOrganizerRelease } = await import(await moduleUrl(aliases['@/lib/organizer-release']));
  assert.match(html, /Download for your device/);
  for (const platform of ['Windows', 'macOS', 'Linux']) assert.ok(html.includes(platform));
  for (const download of fallbackOrganizerRelease.downloads) assert.ok(html.includes(`href="${download.url}"`));
  assertExternalLink(html, fallbackOrganizerRelease.url);
  assert.match(html, /unsigned Windows installers/);
});

test('both certificate verification links and both contact social links render', async () => {
  const certificates = await render('../src/components/EducationSection/CertificationsSection.tsx', 'CertificationsSection');
  for (const certificate of certifications) assertExternalLink(certificates, certificate.credlyUrl);
  const contact = await render('../src/components/ContactSection/ContactSection.tsx', 'ContactSection');
  assertExternalLink(contact, profile.github);
  assertExternalLink(contact, profile.linkedin);
});
