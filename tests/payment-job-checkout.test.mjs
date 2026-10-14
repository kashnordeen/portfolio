import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { handlePayment } from '../server/payments/handler.ts';
import { loadConfig } from '../server/payments/config.ts';
import { sha256 } from '../server/payments/security.ts';
import { publishPending } from '../server/payments/job-queue.ts';

const environment = { PHONEPE_ENV:'production',VERCEL_ENV:'production',PAYMENT_SITE_ORIGIN:'https://kkarn.vercel.app',
  DATABASE_URL:'postgres://portfolio_payments_api:fixture@localhost/test',PHONEPE_CLIENT_ID:'fixture',PHONEPE_CLIENT_SECRET:'fixture',
  PHONEPE_CLIENT_VERSION:'1',PHONEPE_MERCHANT_ID:'MID_FIXTURE',PHONEPE_WEBHOOK_USERNAME:'fixture-user',PHONEPE_WEBHOOK_PASSWORD:'fixture-password',
  PAYMENT_SESSION_SECRET:'s'.repeat(32),PAYMENT_RECONCILIATION_SECRET:'r'.repeat(32),PROJECT_MIN_PAISE:'20000',PROJECT_MAX_PAISE:'5000000',
  PAYMENTS_ENABLED:'true',PAYMENT_RELEASE_APPROVED:'true',PAYMENT_JOBS_ENABLED:'true',QSTASH_TOKEN:'fixture',
  QSTASH_CURRENT_SIGNING_KEY:'fixture-current',QSTASH_NEXT_SIGNING_KEY:'fixture-next' };
const order = { id:randomUUID(),merchant_order_id:'KK_FIXTURE',state:'CREATED',expires_at:null,checkout_url:null };
const job = {id:randomUUID(),orderId:order.id,generation:1,dueAt:new Date(Date.now()+25000),environment:'production'};
function fixture() {
  const calls = [];
  let pending = [job];
  const store = { rate:async()=>{},reserve:async()=>{calls.push('reserve');return{order,job,initiate:true};},
    pendingJobs:async()=>pending,hasUnpublished:async()=>pending.length>0,published:async()=>{calls.push('accepted');pending=[];},publicationFailed:async()=>{},
    claimCheckout:async()=>{calls.push('claim');return order;},checkout:async()=>calls.push('checkout'),
    recordEvent:async()=>{calls.push('event');return order.id;} };
  const queue = { publish:async()=>{calls.push('publish');return{messageId:'fixture-receipt'};} };
  const provider = { pay:async()=>{calls.push('pay');return{url:'https://mercury.phonepe.com/transact?fixture',orderId:'OMO_FIXTURE',expires:new Date(Date.now()+1200000)};} };
  const runtime={config:loadConfig(environment),store,queue,provider};
  const run=(route,req)=>handlePayment(route,req,()=>runtime);
  return{calls,store,queue,provider,runtime,run};
}
const input={purpose:'project',name:'Fixture',email:'fixture@example.test',reference:'TEST',amount:'200'};
const request=(body=input,headers={})=>new Request('https://kkarn.vercel.app/api/payments/orders',{method:'POST',
  headers:{'Content-Type':'application/json',origin:'https://kkarn.vercel.app','idempotency-key':randomUUID(),...headers},body:JSON.stringify(body)});

test('missing queue readiness disables advertised checkout even with release flags',()=>{
  assert.equal(loadConfig({...environment,QSTASH_TOKEN:''}).projectEnabled,false);
  assert.equal(loadConfig({...environment,PAYMENT_JOBS_ENABLED:'false'}).projectEnabled,false);
});
test('reservation, accepted publication and atomic initiation claim precede pay',async()=>{
  const f=fixture(); const response=await f.run('orders',request()); assert.equal(response.status,201);
  for(const [a,b] of [['reserve','publish'],['publish','accepted'],['accepted','claim'],['claim','pay']]) assert.ok(f.calls.indexOf(a)<f.calls.indexOf(b));
});
test('queue refusal never reaches pay and lost acknowledgement preserves the existing request',async()=>{
  const f=fixture(); f.queue.publish=async()=>{throw new Error('PRIVATE_QUEUE_ERROR');};
  const response=await f.run('orders',request()); assert.equal(response.status,503); assert.ok(!f.calls.includes('pay'));
  assert.ok(!JSON.stringify(await response.json()).includes('PRIVATE_QUEUE_ERROR'));
  f.store.reserve=async()=>({order,job,initiate:false});
  assert.equal((await f.run('orders',request())).status,409); assert.ok(!f.calls.includes('pay'));
});
test('losing atomic claim and provider timeout cannot cause automatic reinitiation',async()=>{
  const f=fixture(); f.store.claimCheckout=async()=>null;
  assert.equal((await f.run('orders',request())).status,409); assert.ok(!f.calls.includes('pay'));
  const g=fixture(); g.provider.pay=async()=>{g.calls.push('pay');throw new Error('timeout');};
  assert.equal((await g.run('orders',request())).status,202);
  g.store.reserve=async()=>({order,job:null,initiate:false});
  assert.equal((await g.run('orders',request())).status,409); assert.equal(g.calls.filter(x=>x==='pay').length,1);
});
test('webhook durable recording survives a queue outage without claiming payment success',async()=>{
  const f=fixture(); f.queue.publish=async()=>{throw new Error('offline');};
  const event={event:'checkout.order.completed',payload:{merchantId:'MID_FIXTURE',merchantOrderId:'KK_FIXTURE',orderId:'OMO_FIXTURE',state:'COMPLETED',amount:20000}};
  const response=await f.run('webhook',request(event,{authorization:sha256('fixture-user:fixture-password')}));
  assert.equal(response.status,200); assert.deepEqual(await response.json(),{received:true});
  assert.ok(f.calls.includes('event')); assert.ok(!f.calls.includes('pay'));
});
test('successor publication failure is durable and uses a fixed bounded batch',async()=>{
  let limit,failed=0;
  const store={pendingJobs:async(_id,n)=>{limit=n;return[job];},hasUnpublished:async()=>true,published:async()=>assert.fail('not accepted'),publicationFailed:async()=>failed++};
  await assert.rejects(publishPending(store,{publish:async()=>{throw new Error('offline');}},order.id));
  assert.equal(limit,3); assert.equal(failed,1);
});
test('a backed-off unpublished successor must not be mistaken for completed publication',async()=>{
  const store={pendingJobs:async()=>[],hasUnpublished:async()=>true,published:async()=>{},publicationFailed:async()=>{}};
  await assert.rejects(publishPending(store,{publish:async()=>assert.fail('not due')},order.id));
});
