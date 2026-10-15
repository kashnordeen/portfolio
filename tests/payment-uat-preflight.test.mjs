import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyUatDatabase, uatFailureCode } from '../server/payments/uat-preflight.ts';
import { sandboxTarget } from '../server/payments/targets.ts';

const env = {
  VERCEL_ENV:'production', VERCEL_PROJECT_ID:sandboxTarget.projectId, PHONEPE_ENV:'sandbox',
  PAYMENT_SITE_ORIGIN:sandboxTarget.origin, NODE_TLS_REJECT_UNAUTHORIZED:'1',
  PAYMENTS_ENABLED:'false', PAYMENT_RELEASE_APPROVED:'false', COMMUNITY_PAYMENTS_ENABLED:'false', PAYMENT_JOBS_ENABLED:'false',
  DATABASE_URL:'postgresql://portfolio_payments_uat.ghseaquzqlnpmiltsyqy:fixture@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  PAYMENT_SESSION_SECRET:'s'.repeat(64), PAYMENT_RECONCILIATION_SECRET:'r'.repeat(64),
  PHONEPE_CLIENT_ID:'fixture', PHONEPE_CLIENT_SECRET:'fixture', PHONEPE_CLIENT_VERSION:'1', PHONEPE_MERCHANT_ID:'fixture',
  PHONEPE_WEBHOOK_USERNAME:'fixture', PHONEPE_WEBHOOK_PASSWORD:'fixture', PROJECT_MIN_PAISE:'20000', PROJECT_MAX_PAISE:'5000000',
};
function fixture(overrides={}) {
  const calls=[];
  const query=async()=>[{role_ok:true,session_ok:true,read_only:true,live_access:false,uat_access:true,
    safe_role:true,memberships:0,rls_tables:5,...overrides}];
  const sql={begin:async(options,run)=>{calls.push(options);return run(query);},end:async options=>calls.push(options)};
  return {calls,connect:()=>sql};
}
test('UAT preflight refuses wrong target, active flags, unsafe TLS and unexpected DB destinations before connecting',async()=>{
  for(const change of [{VERCEL_PROJECT_ID:'live'},{VERCEL_ENV:'preview'},{PHONEPE_ENV:'production'},
    {PAYMENT_SITE_ORIGIN:'https://kkarn.vercel.app'},{NODE_TLS_REJECT_UNAUTHORIZED:'0'},
    ...['PAYMENTS_ENABLED','PAYMENT_RELEASE_APPROVED','COMMUNITY_PAYMENTS_ENABLED','PAYMENT_JOBS_ENABLED'].flatMap(key=>[{[key]:'true'},{[key]:undefined}]),
    {DATABASE_URL:env.DATABASE_URL.replace('aws-0-ap-south-1.pooler.supabase.com','evil.example')},
    {DATABASE_URL:env.DATABASE_URL.replace('portfolio_payments_uat.','portfolio_payments_api.')},
    {DATABASE_URL:`${env.DATABASE_URL}?sslmode=disable`}]) {
    let connected=false;
    await assert.rejects(verifyUatDatabase({...env,...change},()=>{connected=true;throw Error('must not connect');}));
    assert.equal(connected,false);
  }
});
test('UAT preflight uses a read-only transaction and always closes its connection',async()=>{
  const f=fixture();
  assert.equal(await verifyUatDatabase(env,f.connect),true);
  assert.deepEqual(f.calls,['read only',{timeout:1}]);
  for(const row of [{role_ok:false},{session_ok:false},{read_only:false},{live_access:true},
    {uat_access:false},{safe_role:false},{memberships:1},{rls_tables:4}]) {
    const bad=fixture(row);await assert.rejects(verifyUatDatabase(env,bad.connect));
    assert.deepEqual(bad.calls,['read only',{timeout:1}]);
  }
});
test('UAT preflight closes failed queries and never exposes arbitrary error text',async()=>{
  let closed=false;
  await assert.rejects(verifyUatDatabase(env,()=>({begin:async()=>{throw Error('private credential');},end:async()=>{closed=true;}})));
  assert.equal(closed,true);
  assert.equal(uatFailureCode({code:'28P01',message:'private credential'}),'AUTH_FAILED');
  assert.equal(uatFailureCode({code:'SELF_SIGNED_CERT_IN_CHAIN',message:'private credential'}),'TLS_FAILED');
  assert.equal(uatFailureCode({code:'private credential',message:'private credential'}),'CHECK_FAILED');
});
