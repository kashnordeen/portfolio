import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('target verification script runs as the restricted role in embedded PostgreSQL and rolls fixtures back', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    for (const file of ['payment-orders.sql','payment-backend.sql','payment-jobs.sql']) {
      await db.exec(await readFile(new URL(`../database/${file}`, import.meta.url),'utf8'));
    }
    const results = await db.exec(await readFile(new URL('../database/check-payment-jobs-target.sql', import.meta.url),'utf8'));
    assert.deepEqual(results.at(-1).rows[0].target_check,{rolled_back:true,orders:0,jobs:0,events:0,fulfilments:0});
  } finally { await db.close(); }
});
