import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { handleUatAlert, loadUatAlertConfig } from '../server/payments/uat-alerts.ts';
import { createJobQueue } from '../server/payments/job-queue.ts';
import { loadJobConfig } from '../server/payments/job-config.ts';
import { sandboxTarget, productionTarget } from '../server/payments/targets.ts';

const key='fixture-qstash-signing-not-a-real-key';
const env={PAYMENT_JOBS_ENABLED:'true',PAYMENT_UAT_ALERTS_ENABLED:'true',VERCEL_ENV:'production',
  PHONEPE_ENV:'sandbox',VERCEL_PROJECT_ID:sandboxTarget.projectId,PAYMENT_SITE_ORIGIN:sandboxTarget.origin,
  QSTASH_TOKEN:'fixture',QSTASH_CURRENT_SIGNING_KEY:key,QSTASH_NEXT_SIGNING_KEY:key+'-next',
  VERCEL_AUTOMATION_BYPASS_SECRET:'fixture-bypass'.padEnd(40,'x'),RESEND_API_KEY:'re_fixture_not_a_real_api_key'};
const url=sandboxTarget.origin+'/api/payments/alerts';
const failure={status:503,retried:3,maxRetries:3,method:'POST',url:sandboxTarget.origin+'/api/payments/jobs',
  sourceMessageId:'fixture-message',sourceBody:Buffer.from(JSON.stringify({jobId:randomUUID()})).toString('base64'),
  body:'PRIVATE_RESPONSE',sourceHeader:{secret:'PRIVATE_BYPASS'},callerIP:'PRIVATE_IP'};
const now=()=>new Date('2026-10-16T17:23:45.000Z');
function token(body,{secret=key,sub=url,exp=Math.floor(Date.now()/1000)+60}={}) {
  const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({iss:'Upstash',sub,exp,nbf:0,body:createHash('sha256').update(body).digest('base64url')})).toString('base64url');
  return `${head}.${payload}.${createHmac('sha256',secret).update(`${head}.${payload}`).digest('base64url')}`;
}
const request=(body=JSON.stringify(failure),signature=token(body),target=url)=>new Request(target,
  {method:'POST',headers:{'Content-Type':'application/json','Upstash-Signature':signature},body});
const run=(req,send,overrides={})=>handleUatAlert(req,{env,send,now,...overrides});

test('UAT alerts default off and cannot enable on production, preview, foreign origin or unsafe TLS',()=>{
  assert.equal(loadUatAlertConfig(env).ready,true);
  for(const change of [{PAYMENT_UAT_ALERTS_ENABLED:undefined},{PAYMENT_UAT_ALERTS_ENABLED:'false'},
    {PHONEPE_ENV:'production'},{VERCEL_PROJECT_ID:productionTarget.projectId},{VERCEL_ENV:'preview'},
    {PAYMENT_SITE_ORIGIN:'https://evil.test'},{RESEND_API_KEY:''},{RESEND_API_KEY:'re_unsafe\r\nheader'},
    {NODE_TLS_REJECT_UNAUTHORIZED:'0'},{PAYMENT_JOBS_ENABLED:'false'}]) {
    assert.equal(loadUatAlertConfig({...env,...change}).ready,false);
  }
});

test('unsigned, expired, wrong URL, tampered and oversized callbacks never send email',async()=>{
  let calls=0;const send=async()=>{calls++;return Response.json({id:'fixture'});};
  const raw=JSON.stringify(failure);
  for(const req of [request(raw,''),request(raw,token(raw,{exp:1})),request(raw,token(raw,{sub:url+'/other'})),
    request(raw+' ',token(raw)),request(raw,token(raw),url+'?bypass=private'),request('x'.repeat(65537))]) {
    assert.equal((await run(req,send)).status,401);
  }
  assert.equal(calls,0);
  assert.equal((await run(request(),send,{env:{}})).status,503);
  assert.equal((await run(new Request(url),send)).status,405);
  assert.equal(calls,0);
});

test('signed callbacks must be exhausted failures of the exact UAT payment endpoints',async()=>{
  let calls=0;const send=async()=>{calls++;return Response.json({id:'fixture'});};
  for(const body of [[],null,{...failure,status:200},{...failure,retried:2},{...failure,maxRetries:9},
    {...failure,url:productionTarget.origin+'/api/payments/jobs'},
    {...failure,url:failure.url+'?private=token'},{...failure,method:'GET'},
    {...failure,sourceBody:Buffer.from('{"amount":20000}').toString('base64')}]) {
    assert.equal((await run(request(JSON.stringify(body)),send)).status,400);
  }
  assert.equal(calls,0);
});

test('email contains only fixed UAT category and UTC hour; repeated incidents coalesce without raw payloads',async()=>{
  const calls=[];const send=async(target,options)=>{calls.push({target,options});return Response.json({id:'fixture'});};
  assert.equal((await run(request(),send)).status,200);
  assert.equal((await run(request(JSON.stringify({...failure,sourceMessageId:'different',body:'OTHER_PRIVATE'})),send)).status,200);
  assert.equal(calls.length,2);
  assert.equal(calls[0].target,'https://api.resend.com/emails');
  assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[0].options.headers['Idempotency-Key'],calls[1].options.headers['Idempotency-Key']);
  assert.equal(calls[0].options.body,calls[1].options.body);
  const email=JSON.parse(calls[0].options.body);
  assert.deepEqual(email.to,['kash.nordeen@gmail.com']);
  assert.match(email.text,/VERIFICATION_DELIVERY_EXHAUSTED/);
  assert.match(email.text,/2026-10-16T17:00:00.000Z/);
  for(const value of ['PRIVATE','fixture-message',failure.url,env.QSTASH_TOKEN,env.VERCEL_AUTOMATION_BYPASS_SECRET]) {
    assert.equal(calls[0].options.body.includes(value),false);
  }
  const recovery={...failure,url:sandboxTarget.origin+'/api/payments/recover',sourceBody:Buffer.from('{}').toString('base64'),
    scheduleId:'portfolio-payments-uat-recovery-v1'};
  assert.equal((await run(request(JSON.stringify(recovery)),send)).status,200);
  assert.match(JSON.parse(calls[2].options.body).text,/RECOVERY_DELIVERY_EXHAUSTED/);
  assert.notEqual(calls[0].options.headers['Idempotency-Key'],calls[2].options.headers['Idempotency-Key']);
});

test('provider rejection and transport errors are retryable and never expose credentials or provider bodies',async()=>{
  for(const send of [async()=>new Response('PRIVATE_RESEND_DETAIL',{status:429}),
    async()=>{throw new Error(env.RESEND_API_KEY);},async()=>new Response(null,{status:302})]) {
    const response=await run(request(),send);assert.equal(response.status,503);
    const text=await response.text();assert.doesNotMatch(text,/PRIVATE|re_fixture/);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
});

test('only opted-in sandbox jobs attach fixed alert callback and private header, never production',async()=>{
  for(const [settings,enabled] of [[env,true],[{...env,PAYMENT_UAT_ALERTS_ENABLED:'false'},false],
    [{...env,PHONEPE_ENV:'production',VERCEL_PROJECT_ID:productionTarget.projectId,PAYMENT_SITE_ORIGIN:productionTarget.origin},false]]) {
    let headers;const config=loadJobConfig(settings);
    await createJobQueue(config,{send:async(_url,options)=>{headers=options.headers;return Response.json({messageId:'fixture'});}})
      .publish({id:randomUUID(),orderId:randomUUID(),environment:config.environment,generation:1,dueAt:new Date()});
    assert.equal(headers['Upstash-Failure-Callback'],enabled?url:undefined);
    assert.equal(headers['Upstash-Failure-Callback-Forward-x-vercel-protection-bypass'],enabled?env.VERCEL_AUTOMATION_BYPASS_SECRET:undefined);
  }
});
