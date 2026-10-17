import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('optional reference migration accepts null while preserving limits, immutable terms and paid-state integrity', async () => {
  const db = new PGlite();
  try {
    await db.exec(await read('../database/payment-orders.sql'));
    const migration = await read('../database/optional-project-reference.sql');
    await db.exec(migration);
    await db.exec(migration); // Re-running cannot drop another constraint.
    const insert = (reference, state = 'CREATED') => db.query(`INSERT INTO private_payments.orders
      (id,idempotency_key,merchant_order_id,purpose,customer_name,customer_email,project_reference,
       amount_paise,environment,session_token_hash,state)
      VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid()::text,'project','Fixture',
       'fixture@example.test',$1,20000,'production',repeat('a',64),$2) RETURNING id,project_reference`, [reference,state]);
    const { rows: [order] } = await insert(null);
    assert.equal(order.project_reference, null);
    await insert('INV-1');
    for (const reference of ['', 'x'.repeat(121)]) await assert.rejects(insert(reference));
    await assert.rejects(insert(null, 'COMPLETED'));
    await assert.rejects(db.query('UPDATE private_payments.orders SET project_reference=$1 WHERE id=$2', ['OTHER',order.id]));
    const { rows: [security] } = await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='private_payments.orders'::regclass");
    assert.equal(security.relrowsecurity, true);
  } finally { await db.close(); }
});
