import {
  MFK_POS_TENDER_POLICY_SCHEMA,validateMfkPosTenderPolicy,nextMfkPosTenderPolicy,
  type MfkPosTenderDefinition,type MfkPosTenderPolicy,
} from '../../contracts/pos-tender-policy-v1.ts';

export function hasFormalPosTenders(snapshot:Record<string,unknown>){
  return Object.prototype.hasOwnProperty.call(snapshot,'posTenders');
}

export function readFormalPosTenders(snapshot:Record<string,unknown>):MfkPosTenderPolicy{
  if(!hasFormalPosTenders(snapshot))throw new Error('POS_TENDER_POLICY_REQUIRED');
  const raw=snapshot.posTenders;
  // The shared validator predates native strict Number and ISO-control checks.
  // Do not coerce browser inputs into a policy the native producer will reject.
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    const policy=raw as Record<string,unknown>;
    if(typeof policy.revision!=='number'||!Number.isSafeInteger(policy.revision)||policy.revision<1){
      throw new Error('POS_TENDER_POLICY_REVISION_INVALID');
    }
  }
  const policy=validateMfkPosTenderPolicy(raw);
  if(policy.tenders.some(row=>/[\u0080-\u009f]/.test(row.label)))throw new Error('POS_TENDER_POLICY_TENDER_LABEL_INVALID');
  return policy;
}

/** Explicit user action only. Reading, saving another domain, and publishing never seed this policy. */
export function createInitialFormalPosTenders(snapshot:Record<string,unknown>):Record<string,unknown>{
  if(hasFormalPosTenders(snapshot))throw new Error('POS_TENDER_POLICY_ALREADY_EXISTS');
  return {...snapshot,posTenders:validateMfkPosTenderPolicy({
    schema:MFK_POS_TENDER_POLICY_SCHEMA,revision:1,tenders:[
      {id:'CASH',label:'現金',enabled:true,kind:'CASH'},
      {id:'ALIPAY',label:'支付寶',enabled:true,kind:'NON_CASH'},
      {id:'WECHAT_PAY',label:'微信支付',enabled:true,kind:'NON_CASH'},
      {id:'FPS',label:'FPS',enabled:true,kind:'NON_CASH'},
      {id:'PAYME',label:'Payme',enabled:true,kind:'NON_CASH'},
    ],
  })};
}

export function assertFormalPosTenderTransition(before:Record<string,unknown>,after:Record<string,unknown>):void{
  const next=readFormalPosTenders(after);
  if(!hasFormalPosTenders(before))return;
  const current=readFormalPosTenders(before);
  if(next.revision<current.revision)throw new Error('POS_TENDER_POLICY_REVISION_ROLLBACK');
  if(next.revision===current.revision&&JSON.stringify(next.tenders)!==JSON.stringify(current.tenders)){
    throw new Error('POS_TENDER_POLICY_REVISION_CONFLICT');
  }
  for(const existing of current.tenders){
    const row=next.tenders.find(row=>row.id===existing.id);
    if(!row)throw new Error('POS_TENDER_POLICY_ID_REMOVAL_FORBIDDEN');
    if(row.kind!==existing.kind)throw new Error('POS_TENDER_POLICY_KIND_IMMUTABLE');
  }
}

export function writeFormalPosTenders(
  snapshot:Record<string,unknown>,expectedRevision:number,tenders:readonly MfkPosTenderDefinition[],
):Record<string,unknown>{
  const current=readFormalPosTenders(snapshot);
  if(expectedRevision!==current.revision)throw new Error('POS_TENDER_POLICY_REVISION_CONFLICT');
  const next=nextMfkPosTenderPolicy(current,tenders);
  const raw=snapshot.posTenders as Record<string,unknown>;
  const existing=new Map((raw.tenders as Record<string,unknown>[]).map(row=>[row.id,row]));
  const result={...snapshot,posTenders:{...raw,...next,tenders:next.tenders.map(row=>({...existing.get(row.id),...row}))}};
  assertFormalPosTenderTransition(snapshot,result);
  return result;
}
