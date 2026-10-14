import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadJobConfig } from '../server/payments/job-config.ts';
import { handleRecovery, handleJob } from '../server/payments/job-handler.ts';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
test('all committed payment and worker templates remain disabled and credential-free',async()=>{
  const template=await read('../.env.example');
  for(const flag of ['PAYMENTS_ENABLED','PAYMENT_RELEASE_APPROVED','COMMUNITY_PAYMENTS_ENABLED','PAYMENT_JOBS_ENABLED']) assert.match(template,new RegExp(`^${flag}=false$`,'m'));
  for(const name of ['QSTASH_TOKEN','QSTASH_CURRENT_SIGNING_KEY','QSTASH_NEXT_SIGNING_KEY']) assert.match(template,new RegExp(`^${name}=$`,'m'));
  assert.match(await read('../workers/.env.example'),/^RECONCILIATION_WORKER_ENABLED=false$/m);
  assert.equal(loadJobConfig({PAYMENT_JOBS_ENABLED:'true',NODE_TLS_REJECT_UNAUTHORIZED:'0'}).ready,false);
});
test('method rejection and disabled production entrypoint never construct a payment runtime',async()=>{
  assert.equal((await handleJob(new Request('https://kkarn.vercel.app/api/payments/jobs'),()=>assert.fail('no runtime'))).status,405);
  assert.equal((await handleRecovery(new Request('https://kkarn.vercel.app/api/payments/recover'),()=>assert.fail('no runtime'))).status,405);
});
test('recovery quota failure keeps durable work retryable and never marks it paid',async()=>{
  const job={id:'9abff278-ff6f-4c28-a175-f5d58138cd25'};
  let failed=0,published=0;
  const runtime={config:{environment:'production',jobConfig:{ready:true}},
    queue:{verify:async()=> '{}',publish:async()=>{throw new Error('PRIVATE_QUOTA_ERROR');}},
    store:{rate:async()=>{},cleanupRates:async()=>{},pendingJobs:async()=>[job],hasUnpublished:async()=>true,
      published:async()=>published++,publicationFailed:async()=>failed++},provider:{pay:async()=>assert.fail('no charge')}};
  const response=await handleRecovery(new Request('https://kkarn.vercel.app/api/payments/recover',{method:'POST'}),()=>runtime);
  assert.equal(response.status,503);assert.equal(published,0);assert.equal(failed,1);
  assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE_QUOTA_ERROR'));
});
