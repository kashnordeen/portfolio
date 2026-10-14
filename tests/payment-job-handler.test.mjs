import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHmac,createHash } from 'node:crypto';
import { handleJob, handleRecovery, runJob } from '../server/payments/job-handler.ts';
import { createJobQueue } from '../server/payments/job-queue.ts';
import { loadJobConfig } from '../server/payments/job-config.ts';
const jobId=randomUUID(), orderId=randomUUID(), leaseId=randomUUID();
const job={id:jobId,orderId,generation:1,dueAt:new Date(),environment:'production'};
function fixture() {
  const calls=[]; let pending=[];
  const order={id:orderId,merchant_order_id:'KK_FIXTURE',amount_paise:20000,phonepe_order_id:'OMO_FIXTURE'};
  const store={rate:async()=>calls.push('rate'),cleanupRates:async()=>calls.push('cleanup'),claimJob:async()=>({kind:'READY',order,job,leaseId}),
    finishJob:async(_id,_lease,status)=>{calls.push(['finish',status]);return true;},
    pendingJobs:async(_id,limit)=>{calls.push(['pending',limit]);return pending;},hasUnpublished:async()=>pending.length>0,
    published:async()=>{calls.push('published');pending=[];},publicationFailed:async()=>calls.push('publish-failed')};
  const provider={status:async()=>{calls.push('status');return{state:'COMPLETED',amount:20000,orderId:'OMO_FIXTURE'};},pay:async()=>assert.fail('jobs never charge')};
  const queue={verify:async request=>{calls.push('verify');return request.text();},publish:async()=>({messageId:'fixture-receipt'})};
  const config={environment:'production',jobConfig:{ready:true}};
  const runtime={config,store,provider,queue};
  return{runtime,store,provider,queue,calls,setPending:rows=>{pending=rows;},
    request:body=>new Request('https://kkarn.vercel.app/api/payments/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
    run:request=>handleJob(request,()=>runtime)};
}
test('signature rejection occurs before any database, limiter or provider work',async()=>{
  const f=fixture();f.queue.verify=async()=>{throw new Error('bad signature');};
  const response=await f.run(f.request({jobId}));assert.equal(response.status,401);assert.equal(f.calls.length,0);
});
test('disabled or malformed jobs never reach storage or provider',async()=>{
  const f=fixture();f.runtime.config.jobConfig.ready=false;
  assert.equal((await f.run(f.request({jobId}))).status,503);assert.equal(f.calls.length,0);
  for(const body of [{jobId,amount:1},{jobId:'invalid'},{},[]]) {
    const g=fixture();assert.equal((await g.run(g.request(body))).status,400);
    assert.ok(!g.calls.includes('status'));assert.ok(!g.calls.includes('rate'));
  }
});
test('signed job uses bound order lookup and never trusts an amount in the payload',async()=>{
  const f=fixture();const response=await f.run(f.request({jobId}));assert.equal(response.status,200);
  assert.equal(f.calls.filter(x=>x==='status').length,1);
  assert.deepEqual(f.calls.find(x=>Array.isArray(x)&&x[0]==='finish')[1],{state:'COMPLETED',amount:20000,orderId:'OMO_FIXTURE'});
});
test('old, early, unattempted and terminal callbacks only flush successors, not provider status',async()=>{
  for(const kind of ['STALE','EARLY','UNATTEMPTED','TERMINAL']){
    const f=fixture();f.store.claimJob=async()=>({kind,orderId});f.setPending([job]);
    assert.equal((await f.run(f.request({jobId}))).status,200);
    assert.ok(f.calls.includes('published'));assert.ok(!f.calls.includes('status'));
  }
});
test('lease overlap and lost finish ownership return retryable responses',async()=>{
  const f=fixture();f.store.claimJob=async()=>({kind:'LEASED',orderId});
  assert.equal((await f.run(f.request({jobId}))).status,503);assert.ok(!f.calls.includes('status'));
  const g=fixture();g.store.finishJob=async()=>false;
  assert.equal((await g.run(g.request({jobId}))).status,503);
});
test('status commit followed by publication failure retries only durable successor publication',async()=>{
  const f=fixture();let claimed=false;
  f.store.claimJob=async()=>claimed?{kind:'STALE',orderId}:{kind:'READY',order:{id:orderId,merchant_order_id:'KK_FIXTURE'},job,leaseId};
  f.store.finishJob=async()=>{claimed=true;f.setPending([job]);return true;};
  f.queue.publish=async()=>{throw new Error('PRIVATE_FAILURE');};
  const first=await f.run(f.request({jobId}));assert.equal(first.status,503);
  assert.ok(!JSON.stringify(await first.json()).includes('PRIVATE_FAILURE'));
  f.queue.publish=async()=>({messageId:'fixture-receipt'});
  assert.equal((await f.run(f.request({jobId}))).status,200);
  assert.equal(f.calls.filter(x=>x==='status').length,1);
});
test('provider uncertainty persists pending/review work without claiming paid state',async()=>{
  const f=fixture();f.provider.status=async()=>{throw new Error('PRIVATE_PROVIDER_FAILURE');};
  assert.equal((await f.run(f.request({jobId}))).status,200);
  assert.deepEqual(f.calls.find(x=>Array.isArray(x)&&x[0]==='finish'),['finish',null]);
});
test('signed recovery is bounded and rejects extra data before database work',async()=>{
  const f=fixture();f.setPending([job]);
  assert.equal((await handleRecovery(f.request({}),()=>f.runtime)).status,200);
  assert.deepEqual(f.calls.find(x=>Array.isArray(x)&&x[0]==='pending'),['pending',3]);
  assert.ok(f.calls.includes('cleanup'));
  const g=fixture();assert.equal((await handleRecovery(g.request({url:'https://evil.test'}),()=>g.runtime)).status,400);
  assert.ok(!g.calls.includes('rate'));
});
test('reconciliation continues while checkout is disabled, and terminal jobs cannot charge',async()=>{
  const f=fixture();f.runtime.config.projectEnabled=false;f.runtime.config.communityEnabled=false;
  assert.equal((await runJob(jobId,f.runtime)).state,'ACK');
});
test('real SDK verification protects the endpoint before database and provider access',async()=>{
  const f=fixture(),key='fixture-only-endpoint-signing-key';
  const config=loadJobConfig({PAYMENT_JOBS_ENABLED:'true',PHONEPE_ENV:'production',VERCEL_ENV:'production',
    PAYMENT_SITE_ORIGIN:'https://kkarn.vercel.app',QSTASH_TOKEN:'fixture',QSTASH_CURRENT_SIGNING_KEY:key,QSTASH_NEXT_SIGNING_KEY:key+'-next'});
  f.runtime.config.jobConfig=config;f.runtime.queue=createJobQueue(config);
  const raw=JSON.stringify({jobId});
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({iss:'Upstash',sub:config.jobUrl,exp:Math.floor(Date.now()/1000)+60,
    nbf:0,body:createHash('sha256').update(raw).digest('base64url')})).toString('base64url');
  const signature=`${header}.${payload}.${createHmac('sha256',key).update(`${header}.${payload}`).digest('base64url')}`;
  const make=token=>new Request(config.jobUrl,{method:'POST',headers:{'Content-Type':'application/json','Upstash-Signature':token},body:raw});
  assert.equal((await f.run(make('invalid'))).status,401);assert.equal(f.calls.length,0);
  assert.equal((await f.run(make(signature))).status,200);assert.equal(f.calls.filter(x=>x==='status').length,1);
});
