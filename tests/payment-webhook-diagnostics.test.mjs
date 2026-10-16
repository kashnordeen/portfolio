import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnoseUatWebhook, logUatNotificationShape, isDisabledUatValidationProbe } from '../server/payments/webhook-diagnostics.ts';
import { sandboxTarget } from '../server/payments/targets.ts';

const env = { PAYMENT_UAT_DIAGNOSTICS:'true', PHONEPE_ENV:'sandbox', VERCEL_ENV:'production',
  VERCEL_PROJECT_ID:sandboxTarget.projectId, PAYMENT_SITE_ORIGIN:sandboxTarget.origin,
  PAYMENTS_ENABLED:'false', PAYMENT_RELEASE_APPROVED:'false', COMMUNITY_PAYMENTS_ENABLED:'false', PAYMENT_JOBS_ENABLED:'false' };
const request = authorization => new Request('https://example.test/webhook?secret=PRIVATE_URL', {
  method:'POST', headers:authorization ? {authorization} : {}, body:'PRIVATE_PAYLOAD' });

test('UAT diagnostics refuse every other target and any enabled or missing release flag',async()=>{
  for(const change of [{PAYMENT_UAT_DIAGNOSTICS:undefined},{PHONEPE_ENV:'production'},
    {VERCEL_ENV:'preview'},{VERCEL_PROJECT_ID:'live'},{PAYMENT_SITE_ORIGIN:'https://kkarn.vercel.app'},
    ...['PAYMENTS_ENABLED','PAYMENT_RELEASE_APPROVED','COMMUNITY_PAYMENTS_ENABLED','PAYMENT_JOBS_ENABLED']
      .flatMap(key=>[{[key]:'true'},{[key]:undefined}])]) {
    const logs=[], response=Response.json({error:'Webhook authentication failed.'},{status:401});
    assert.equal(await diagnoseUatWebhook(request('PRIVATE_HEADER'),async()=>response,{...env,...change},x=>logs.push(x)),response);
    assert.deepEqual(logs,[]);
  }
});

test('UAT diagnostics distinguish authentication, merchant and service rejection without changing responses',async()=>{
  for(const [error,code,status] of [['Webhook authentication failed.','AUTHENTICATION_FAILED',401],
    ['Payment notification merchant does not match.','MERCHANT_MISMATCH',401],
    ['Unsupported payment notification.','UNSUPPORTED_NOTIFICATION',400],
    ['Payment service is not configured.','CONFIGURATION_FAILED',503],
    ['Payment service is temporarily unavailable.','SERVICE_UNAVAILABLE',503],
    ['PRIVATE_BODY_ERROR','OTHER_REJECTION',503],['__proto__','OTHER_REJECTION',503],['constructor','OTHER_REJECTION',503]]) {
    const logs=[],response=Response.json({error,requestId:'PRIVATE_BODY_FIELD'},{status});
    assert.equal(await diagnoseUatWebhook(request('a'.repeat(64)),async()=>response,env,x=>logs.push(x)),response);
    assert.deepEqual(JSON.parse(logs[0]),{event:'UAT_WEBHOOK_DIAGNOSTIC',code,status,headerKind:'SHA256'});
    assert.deepEqual(await response.json(),{error,requestId:'PRIVATE_BODY_FIELD'});
    assert.doesNotMatch(logs.join(''),/PRIVATE|https:|a{64}/);
  }
});

test('UAT diagnostics log only header format and preserve accepted responses, thrown errors and logger failures',async()=>{
  for(const [header,kind] of [[undefined,'MISSING'],['Bearer PRIVATE','BEARER'],['Basic PRIVATE','BASIC'],['PRIVATE','OTHER']]) {
    const logs=[],response=Response.json({received:true});
    assert.equal(await diagnoseUatWebhook(request(header),async()=>response,env,x=>logs.push(x)),response);
    assert.deepEqual(JSON.parse(logs[0]),{event:'UAT_WEBHOOK_DIAGNOSTIC',code:'ACCEPTED',status:200,headerKind:kind});
  }
  const logs=[],error=new Error('PRIVATE_THROWN_ERROR');
  await assert.rejects(diagnoseUatWebhook(request(),async()=>{throw error;},env,x=>logs.push(x)),e=>e===error);
  assert.equal(JSON.parse(logs[0]).code,'HANDLER_THROWN');
  assert.doesNotMatch(logs.join(''),/PRIVATE/);
  const response=Response.json({received:true});
  assert.equal(await diagnoseUatWebhook(request(),async()=>response,env,()=>{throw Error('logger offline');}),response);
});

test('notification shape diagnostics emit only fixed classes and validity booleans, never field values',()=>{
  const logs=[];
  logUatNotificationShape({event:'checkout.order.completed',payload:{state:'COMPLETED',
    merchantId:'PRIVATE_MERCHANT',merchantOrderId:'PRIVATE.ORDER',orderId:'PRIVATE_ORDER',
    amount:'PRIVATE_AMOUNT',email:'PRIVATE_EMAIL'}},env,x=>logs.push(x));
  assert.deepEqual(JSON.parse(logs[0]),{event:'UAT_WEBHOOK_SHAPE',eventClass:'CHECKOUT_COMPLETED',
    payloadObject:true,stateMatchesEvent:true,merchantOrderIdValid:false,orderIdValid:true,
    amountSafeInteger:false,amountIsString:true,merchantIdPresent:true,legacyTypeRecognized:false});
  assert.doesNotMatch(logs.join(''),/PRIVATE/);
  for(const [event,eventClass] of [[undefined,'MISSING'],['checkout.order.failed','CHECKOUT_FAILED'],
    ['pg.order.completed','LEGACY_COMPLETED'],['pg.order.failed','LEGACY_FAILED'],['PRIVATE_EVENT','OTHER']]) {
    const result=[];logUatNotificationShape({event,payload:null},env,x=>result.push(x));
    const shape=JSON.parse(result[0]);assert.equal(shape.eventClass,eventClass);
    assert.equal(shape.payloadObject,false);
    for(const [key,value] of Object.entries(shape)) if(!['event','eventClass'].includes(key)) assert.equal(typeof value,'boolean');
    assert.doesNotMatch(result.join(''),/PRIVATE/);
  }
  logUatNotificationShape({},env,()=>{throw Error('logger unavailable');});
});

test('notification shape diagnostics are inert outside disabled UAT',()=>{
  for(const change of [{PAYMENT_UAT_DIAGNOSTICS:'false'},{PHONEPE_ENV:'production'},
    {VERCEL_PROJECT_ID:'live'},{PAYMENTS_ENABLED:'true'},{PAYMENT_JOBS_ENABLED:'true'}]) {
    const logs=[];logUatNotificationShape({event:'PRIVATE_EVENT'},{...env,...change},x=>logs.push(x));
    assert.deepEqual(logs,[]);
  }
});

test('read-only validation probe requires explicit opt-in, disabled UAT and an exactly empty object',()=>{
  const probeEnv={...env,PAYMENT_UAT_VALIDATION_PROBE:'true'};
  assert.equal(isDisabledUatValidationProbe({},probeEnv),true);
  for(const body of [null,[],0,'',new Date(),{event:'checkout.order.completed'},{payload:{}},{type:'UNKNOWN'},{test:true},
    JSON.parse('{"__proto__":{}}')]) assert.equal(isDisabledUatValidationProbe(body,probeEnv),false);
  for(const change of [{PAYMENT_UAT_VALIDATION_PROBE:undefined},{PHONEPE_ENV:'production'},
    {VERCEL_ENV:'preview'},{VERCEL_PROJECT_ID:'live'},{PAYMENT_SITE_ORIGIN:'https://kkarn.vercel.app'},
    ...['PAYMENTS_ENABLED','PAYMENT_RELEASE_APPROVED','COMMUNITY_PAYMENTS_ENABLED','PAYMENT_JOBS_ENABLED']
      .flatMap(key=>[{[key]:'true'},{[key]:undefined}])]) {
    assert.equal(isDisabledUatValidationProbe({},{...probeEnv,...change}),false);
  }
});

test('diagnostics distinguish a connectivity probe from an accepted payment event',async()=>{
  const logs=[],response=Response.json({received:true,validationOnly:true});
  assert.equal(await diagnoseUatWebhook(request('a'.repeat(64)),async()=>response,env,x=>logs.push(x)),response);
  assert.equal(JSON.parse(logs[0]).code,'VALIDATION_PROBE');
});
