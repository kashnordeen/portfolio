import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
test('public project policies are readable standalone pages with approved contact and local navigation', async () => {
  for (const name of ['terms', 'refunds', 'privacy']) {
    const html = await read(`public/policies/${name}.html`);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /name="viewport"/);
    assert.equal((html.match(/<h1>/g) ?? []).length, 1);
    assert.match(html, /Keshav Kumar Karn/);
    assert.match(html, /mailto:kash\.nordeen@gmail\.com/);
    assert.match(html, /href="\/\?payment=project"/);
    assert.match(html, /href="\/policies\/policies.css"/);
    assert.doesNotMatch(html, /<script|UNPUBLISHED|OWNER-REVIEW|TODO|\[INSERT|API_KEY|CLIENT_SECRET/);
  }
});
test('refund and privacy pages preserve agreed timelines and avoid invented automatic deletion or bank-credit guarantees', async () => {
  const refund = await read('public/policies/refunds.html');
  assert.match(refund, /48 hours/); assert.match(refund, /5 business days/);
  assert.match(refund, /without deducting gateway or administration fees/);
  assert.match(refund, /unused/); assert.match(refund, /no guaranteed credit date/);
  const privacy = await read('public/policies/privacy.html');
  for (const provider of ['PhonePe', 'Supabase', 'Vercel', 'QStash', 'Web3Forms']) assert.ok(privacy.includes(provider));
  assert.match(privacy, /not currently run automatic deletion/);
  assert.match(privacy, /access, correction or deletion/);
  assert.match(privacy, /retention/);
});
test('checkout and portfolio expose the approved policy pages without changing payment release gates', async () => {
  for (const file of ['src/components/PaymentPortal/PaymentPortal.tsx', 'src/components/Footer/Footer.tsx']) {
    const text = await read(file);
    for (const name of ['terms', 'refunds', 'privacy']) assert.ok(text.includes(`/policies/${name}.html`), `${file}: ${name}`);
  }
});
