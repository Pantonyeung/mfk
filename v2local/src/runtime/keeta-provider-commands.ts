import {readSmtDeviceId} from './admin-config-sync.ts';
import type {StoredOrder} from './local-runtime.ts';

const ENDPOINT='https://admin.morefunos.com';
const ATTENTION_KEY='mfk.keeta.provider-command.attention.v1';

export type KeetaProviderCommandAction='CONFIRM'|'READY';
export type KeetaProviderMirrorResult=Readonly<{
  provider:'KEETA';
  action:KeetaProviderCommandAction;
  state:'NOT_APPLICABLE'|'SYNCED'|'IDEMPOTENT'|'ATTENTION';
  code?:string;
}>;

function providerOrderId(order:StoredOrder){
  const ref=String(order.providerRef||'').trim();
  if(!ref.startsWith('KEETA:'))return null;
  const id=ref.slice('KEETA:'.length).trim();
  return id||null;
}
function writeAttention(order:StoredOrder,action:KeetaProviderCommandAction,code:string){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    const rows=Array.isArray(current)?current:[];
    const next=[
      {canonicalOrderId:order.id,providerRef:order.providerRef,action,code,updatedAt:new Date().toISOString()},
      ...rows.filter(row=>!(String(row?.canonicalOrderId)===order.id&&String(row?.action)===action)),
    ].slice(0,200);
    localStorage.setItem(ATTENTION_KEY,JSON.stringify(next));
  }catch{}
}
function clearAttention(order:StoredOrder,action:KeetaProviderCommandAction){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    if(!Array.isArray(current))return;
    localStorage.setItem(ATTENTION_KEY,JSON.stringify(current.filter(row=>!(
      String(row?.canonicalOrderId)===order.id&&String(row?.action)===action
    ))));
  }catch{}
}
export function readKeetaProviderCommandAttention(){
  try{
    const current=JSON.parse(localStorage.getItem(ATTENTION_KEY)||'[]');
    return Object.freeze(Array.isArray(current)?current:[]);
  }catch{return Object.freeze([]);}
}

export async function mirrorKeetaOrderCommand(order:StoredOrder,action:KeetaProviderCommandAction):Promise<KeetaProviderMirrorResult>{
  const id=providerOrderId(order);
  if(!id)return Object.freeze({provider:'KEETA',action,state:'NOT_APPLICABLE'});
  const deviceId=readSmtDeviceId();
  try{
    const response=await fetch(
      ENDPOINT+'/api/keeta/smt/orders/command?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
      {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          providerOrderId:id,
          canonicalOrderId:order.id,
          action,
        }),
      },
    );
    const body=await response.json().catch(()=>({})) as {state?:string;code?:string};
    if(response.ok&&(body.state==='SUCCESS'||body.state==='IDEMPOTENT')){
      clearAttention(order,action);
      return Object.freeze({
        provider:'KEETA',
        action,
        state:body.state==='IDEMPOTENT'?'IDEMPOTENT':'SYNCED',
      });
    }
    const code=body.code||('KEETA_PROVIDER_COMMAND_HTTP_'+response.status);
    writeAttention(order,action,code);
    return Object.freeze({provider:'KEETA',action,state:'ATTENTION',code});
  }catch(error){
    const code=error instanceof Error?error.message:'KEETA_PROVIDER_COMMAND_TRANSPORT_FAILED';
    writeAttention(order,action,code);
    return Object.freeze({provider:'KEETA',action,state:'ATTENTION',code});
  }
}

export async function readKeetaProviderOrder(order:StoredOrder){
  const id=providerOrderId(order);
  if(!id)return Object.freeze({state:'NOT_APPLICABLE'});
  const deviceId=readSmtDeviceId();
  const response=await fetch(
    ENDPOINT+'/api/keeta/smt/orders/readback?storeId=MF01&deviceId='+encodeURIComponent(deviceId),
    {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({providerOrderId:id,canonicalOrderId:order.id}),
    },
  );
  const body=await response.json().catch(()=>({})) as {state?:string;code?:string;readback?:unknown};
  if(!response.ok)throw new Error(body.code||'KEETA_ORDER_READBACK_HTTP_'+response.status);
  return Object.freeze({state:body.state??'OBSERVED',readback:body.readback});
}
