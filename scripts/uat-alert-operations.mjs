// HUMAN-RUN ONLY via private-uat-alert-setup.ps1. Never pass credentials as CLI arguments.
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const uatAlertTarget = Object.freeze({
  queue:'https://qstash-us-east-1.upstash.io',
  origin:'https://portfolio-payments-uat-kashnordeens-projects.vercel.app',
  schedule:'portfolio-payments-uat-recovery-v1',
});
const fail = () => { throw new Error('UAT_OPERATION_REFUSED'); };
async function jsonBody(response) {
  const reader=response.body?.getReader(); if(!reader) return {};
  try {
    const chunks=[];let length=0;
    for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536)fail();chunks.push(Buffer.from(value));}
    const text=Buffer.concat(chunks).toString('utf8');return text?JSON.parse(text):{};
  } finally {void reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function createUatAlertOperations({qstashToken,bypassKey},{send=fetch}={}) {
  if(typeof qstashToken!=='string'||! /^[\x21-\x7e]{32,4096}$/.test(qstashToken)||
    typeof bypassKey!=='string'||! /^[A-Za-z0-9]{32}$/.test(bypassKey))fail();
  const {queue,origin,schedule}=uatAlertTarget;
  const recover=origin+'/api/payments/recover', jobs=origin+'/api/payments/jobs', alerts=origin+'/api/payments/alerts';
  async function api(route,{method='GET',headers={},body,read=true}={}) {
    const response=await send(queue+route,{method,redirect:'error',credentials:'omit',signal:AbortSignal.timeout(8000),
      headers:{Authorization:`Bearer ${qstashToken}`,...headers},...(body===undefined?{}:{body})});
    if(!response.ok||response.redirected){void response.body?.cancel().catch(()=>{});fail();}
    if(!read){void response.body?.cancel().catch(()=>{});return {};}
    return jsonBody(response);
  }
  const getSchedule=()=>api('/v2/schedules/'+schedule);
  function checkSchedule(value,paused) {
    const header=value.header??{};
    const matching=Object.entries(header).filter(([key])=>key.toLowerCase()==='x-vercel-protection-bypass');
    const key=matching.length===1?(Array.isArray(matching[0][1])?matching[0][1][0]:matching[0][1]):null;
    let original;try{original=JSON.parse(value.body);}catch{try{original=JSON.parse(Buffer.from(value.body??'','base64').toString('utf8'));}catch{fail();}}
    if(value.scheduleId!==schedule||value.destination!==recover||value.cron!=='*/5 * * * *'||value.method!=='POST'||
      value.retries!==3||value.isPaused!==paused||value.failureCallback!==alerts||key!==bypassKey||
      !original||typeof original!=='object'||Array.isArray(original)||Object.keys(original).length)fail();
  }
  async function publish(destination,body,headers) {
    const receipt=await api('/v2/publish/'+destination,{method:'POST',headers:{'Content-Type':'application/json',
      'Upstash-Method':'POST','Upstash-Retries':'3','Upstash-Timeout':'60s',...headers},body:JSON.stringify(body)});
    if(typeof receipt.messageId!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(receipt.messageId))fail();
    return receipt.messageId;
  }
  return {
    async prepare() {
      checkSchedule(await getSchedule(),true);
      // Confirm the intentional failure stops at Vercel, before the payment handler/database.
      const probe=await send(jobs,{method:'POST',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(8000),
        headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:randomUUID()})});
      if(![401,403].includes(probe.status)) {void probe.body?.cancel().catch(()=>{});fail();}
      const platform=await jsonBody(probe);
      if(!['401','403'].includes(String(platform.error?.code)))fail();
      const recoveryMessageId=await publish(recover,{}, {'Upstash-Forward-x-vercel-protection-bypass':bypassKey,
        'Upstash-Label':'portfolio-uat-alert-acceptance-control'});
      const failureMessageId=await publish(jobs,{jobId:randomUUID()}, {
        'Upstash-Failure-Callback':alerts,
        'Upstash-Failure-Callback-Forward-x-vercel-protection-bypass':bypassKey,
        'Upstash-Failure-Callback-Forward-Content-Type':'application/json',
        'Upstash-Label':'portfolio-uat-alert-acceptance-failure'});
      // No cron/header/schedule mutation in this phase. The failure intentionally omits the normal bypass.
      return {ok:true,recoveryMessageId,failureMessageId,schedulePaused:true};
    },
    async apply(operatorVerified) {
      if(operatorVerified!==true)fail();
      checkSchedule(await getSchedule(),true);
      try {
        const receipt=await api('/v2/schedules/'+recover,{method:'POST',headers:{
          'Content-Type':'application/json','Upstash-Method':'POST','Upstash-Cron':'*/5 * * * *',
          'Upstash-Schedule-Id':schedule,'Upstash-Retries':'3','Upstash-Timeout':'60s',
          'Upstash-Forward-x-vercel-protection-bypass':bypassKey,'Upstash-Failure-Callback':alerts,
          'Upstash-Failure-Callback-Forward-x-vercel-protection-bypass':bypassKey,
          'Upstash-Failure-Callback-Forward-Content-Type':'application/json'},body:'{}'});
        if(receipt.scheduleId!==schedule)fail();
        await api('/v2/schedules/'+schedule+'/resume',{method:'POST',read:false});
        checkSchedule(await getSchedule(),false);
        return {ok:true,scheduleConfigured:true,schedulePaused:false};
      } catch {
        // Best effort only: an outage can prevent re-pausing. Never promise a pause on failure.
        try{await api('/v2/schedules/'+schedule+'/pause',{method:'POST',read:false});}catch{/* Check pause manually on an outage. */}
        throw new Error('UAT_OPERATION_FAILED_CHECK_PAUSED_SCHEDULE');
      }
    },
  };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let packet;
  try {
    let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>16384)fail();}
    packet=JSON.parse(raw);raw='';
    const operations=createUatAlertOperations(packet);
    const result=packet.operation==='prepare'?await operations.prepare():
      packet.operation==='apply'?await operations.apply(packet.operatorVerified):fail();
    process.stdout.write(JSON.stringify(result)+'\n');
  } catch {
    // Never print an Error, response body, packet, token, header or callback URL.
    process.stdout.write('{"ok":false,"code":"UAT_OPERATION_FAILED_CHECK_PAUSED_SCHEDULE"}\n');
    process.exitCode=1;
  } finally {packet=null;}
}
