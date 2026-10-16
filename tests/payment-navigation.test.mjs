import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const read = path => readFile(new URL(path,import.meta.url),'utf8');
const href='/?payment=project';
function paymentAnchors(source) {
  const file=ts.createSourceFile('component.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const anchors=[];
  const walk=node=>{
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file)==='a' &&
      node.openingElement.attributes.properties.some(property=>ts.isJsxAttribute(property) &&
        property.name.getText(file)==='href' && property.initializer && ts.isStringLiteral(property.initializer) && property.initializer.text===href)) {
      anchors.push(node.getText(file));
    }
    ts.forEachChild(node,walk);
  };
  walk(file);
  return anchors;
}

test('portfolio exposes same-origin project payment links in pricing, desktop/mobile navigation and footer',async()=>{
  const cases=[['../src/components/AboutSection/AboutSection.tsx',1,'Make a project payment'],
    ['../src/components/Header/Header.tsx',2,'Payments'],['../src/components/Footer/Footer.tsx',1,'Payments']];
  for (const [path,count,label] of cases) {
    const anchors=paymentAnchors(await read(path));
    assert.equal(anchors.length,count,path);
    for (const anchor of anchors) {
      assert.ok(anchor.includes(label));
      assert.doesNotMatch(anchor,/preventDefault|handleScrollTo|target=|onMouseEnter/);
    }
  }
});

test('payment navigation reaches the existing portal without submitting a payment or linking to community checkout',async()=>{
  assert.equal(new URL(href,'https://example.test').origin,'https://example.test');
  assert.equal(new URL(href,'https://example.test').searchParams.get('payment'),'project');
  assert.match(await read('../src/App.tsx'),/new URLSearchParams\(window\.location\.search\)\.has\("payment"\)/);
  const about=await read('../src/components/AboutSection/AboutSection.tsx');
  assert.doesNotMatch(about,/startCheckout|provider\.pay|\/?payment=community/);
  const css=await read('../src/components/AboutSection/AboutSection.css');
  assert.match(css,/\.about-payment-link\s*\{[^}]*min-height: 3rem/);
  assert.match(css,/@media \(max-width: 767px\)[\s\S]*\.about-payment \{ flex-direction: column/);
});
