import test from 'node:test';
import assert from 'node:assert/strict';
import { createUatAlertOperations, uatAlertTarget as target } from '../scripts/uat-alert-operations.mjs';
const secrets={qstashToken:'fixture-token-not-real'.padEnd(64,'x'),bypassKey:'fixture'.padEnd(32,'x')};
function fixture(change={}) {
  let schedule={scheduleId:target.schedule,destination:target.origin+'/api/payments/recover',cron:'*/5 * * * *',
    method:'POST',retries:3,isPaused:true,body:'{}',failureCallback:target.origin+'/api/payments/alerts',
    header:{'X-Vercel-Protection-Bypass':[secrets.bypassKey]},...change};
  const calls=[];
  const send=async(url,options)=>{
    calls.push({url,options});assert.equal(options.redirect,'error');assert.ok(options.signal);
    if(url===target.origin+'/api/payments/jobs')return Response.json({error:{code:'401'}},{status:401});
    assert.ok(url.startsWith(target.queue+'/v2/'));
    assert.equal(options.headers.Authorization,`Bearer ${secrets.qstashToken}`);
    if(options.method==='GET')return Response.json(schedule);
    if(url.includes('/v2/publish/'))return Response.json({messageId:'fixture-'+calls.length});
    if(url.endsWith('/resume')){schedule.isPaused=false;return new Response(null,{status:200});}
    if(url.endsWith('/pause')){schedule.isPaused=true;return new Response(null,{status:200});}
    return Response.json({scheduleId:target.schedule});
  };
  return {calls,send};
}
test('private UAT preparation publishes only two bounded checks and never changes or resumes a schedule',async()=>{
  const f=fixture();const result=await createUatAlertOperations(secrets,{send:f.send}).prepare();
  assert.equal(result.schedulePaused,true);
  const publishes=f.calls.filter(c=>c.url.includes('/publish/'));assert.equal(publishes.length,2);
  assert.deepEqual(JSON.parse(publishes[0].options.body),{});
  assert.equal(publishes[1].options.headers['Upstash-Forward-x-vercel-protection-bypass'],undefined);
  assert.equal(publishes[1].options.headers['Upstash-Failure-Callback-Forward-x-vercel-protection-bypass'],secrets.bypassKey);
  assert.equal(publishes[1].options.headers['Upstash-Failure-Callback'],target.origin+'/api/payments/alerts');
  assert.equal(f.calls.some(c=>c.options.method==='POST'&&c.url.includes('/schedules/')),false);
});
test('foreign, active, mismatched-key, wrong-body and wrong-cadence schedules fail before any publication',async()=>{
  for(const change of [{destination:'https://kkarn.vercel.app/api/payments/recover'},{isPaused:false},
    {header:{'x-vercel-protection-bypass':['wrong']}},{body:'{"private":"value"}'},{cron:'* * * * *'},
    {scheduleId:'other'},{failureCallback:'https://evil.test'},{retries:5}]) {
    const f=fixture(change);await assert.rejects(createUatAlertOperations(secrets,{send:f.send}).prepare());
    assert.equal(f.calls.length,1);
  }
});
test('explicit operator verification is required before updating and resuming the same UAT schedule',async()=>{
  const f=fixture(),ops=createUatAlertOperations(secrets,{send:f.send});
  await assert.rejects(ops.apply(false));assert.equal(f.calls.length,0);
  assert.deepEqual(await ops.apply(true),{ok:true,scheduleConfigured:true,schedulePaused:false});
  const update=f.calls.find(c=>c.options.headers['Upstash-Schedule-Id']);
  assert.equal(update.options.headers['Upstash-Schedule-Id'],target.schedule);
  assert.equal(update.options.headers['Upstash-Failure-Callback-Forward-x-vercel-protection-bypass'],secrets.bypassKey);
  assert.equal(f.calls.some(c=>/kkarn\.vercel\.app/.test(c.url)),false);
});
test('invalid credentials and redirecting schedule responses cannot leak tokens to another destination',async()=>{
  assert.throws(()=>createUatAlertOperations({...secrets,qstashToken:'bad\r\nkey'}));
  assert.throws(()=>createUatAlertOperations({...secrets,bypassKey:'short'}));
  let calls=0;const ops=createUatAlertOperations(secrets,{send:async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://evil.test'}});}});
  await assert.rejects(ops.prepare());assert.equal(calls,1);
});

test('preparation refuses an unprotected application endpoint and creates no messages',async()=>{
  const f=fixture();const send=async(url,options)=>url.startsWith(target.origin)?
    Response.json({error:'Invalid scheduler authentication.'},{status:401}):f.send(url,options);
  await assert.rejects(createUatAlertOperations(secrets,{send}).prepare());
  assert.equal(f.calls.some(c=>c.url.includes('/publish/')),false);
});

test('failed apply attempts to pause and returns only a fixed failure category',async()=>{
  const f=fixture();const send=async(url,options)=>{
    if(url.endsWith('/resume'))throw Error('PRIVATE_TRANSPORT_DETAIL');
    return f.send(url,options);
  };
  await assert.rejects(createUatAlertOperations(secrets,{send}).apply(true),
    error=>error.message==='UAT_OPERATION_FAILED_CHECK_PAUSED_SCHEDULE');
  assert.ok(f.calls.some(c=>c.url.endsWith('/pause')));
});
