import {describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope,validateMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {validateMfkPosTenderPolicy} from '../../contracts/pos-tender-policy-v1.ts';
import {
  createInitialFormalPosTenders,readFormalPosTenders,writeFormalPosTenders,
  assertFormalPosTenderTransition,
} from './formal-pos-tenders.ts';

const base=()=>({catalog:{products:[]},customerPolicy:{paymentChannels:['OCTOPUS']},paymentRefs:{CARD:'legacy'},future:{keep:true}});
const initial=()=>createInitialFormalPosTenders(base());

describe('Admin V3 formal POS tender policy',()=>{
  it('requires explicit initialization and never derives POS policy from Customer or payment refs',()=>{
    const snapshot=base();
    expect(()=>readFormalPosTenders(snapshot)).toThrow('POS_TENDER_POLICY_REQUIRED');
    expect(snapshot).not.toHaveProperty('posTenders');
    const next=createInitialFormalPosTenders(snapshot);
    expect(readFormalPosTenders(next)).toEqual({schema:'MFK_POS_TENDER_POLICY_V1',revision:1,tenders:[
      {id:'CASH',label:'現金',enabled:true,kind:'CASH'},
      {id:'ALIPAY',label:'支付寶',enabled:true,kind:'NON_CASH'},
      {id:'WECHAT_PAY',label:'微信支付',enabled:true,kind:'NON_CASH'},
      {id:'FPS',label:'FPS',enabled:true,kind:'NON_CASH'},
      {id:'PAYME',label:'Payme',enabled:true,kind:'NON_CASH'},
    ]});
    expect(next.customerPolicy).toBe(snapshot.customerPolicy);
    expect(createInitialFormalPosTenders(snapshot).future).toBe(snapshot.future);
    expect(()=>createInitialFormalPosTenders(next)).toThrow('POS_TENDER_POLICY_ALREADY_EXISTS');
    expect(()=>createInitialFormalPosTenders({...base(),posTenders:null})).toThrow('POS_TENDER_POLICY_ALREADY_EXISTS');
  });

  it('disables selection without deleting stable identifiers or historical facts and preserves unknown fields',()=>{
    const snapshot=initial();
    const policy=readFormalPosTenders(snapshot);
    const historicalPayments=[{tenderId:'ALIPAY',label:'舊名稱',amountMinor:5000}];
    const original={...snapshot,historicalPayments,posTenders:{...policy,futurePolicy:{keep:true},tenders:policy.tenders.map(row=>({...row,futureRow:'preserve'}))}};
    const next=writeFormalPosTenders(original,1,policy.tenders.map(row=>row.id==='ALIPAY'?{...row,enabled:false,label:'支付寶 HK'}:row));
    const accepted=readFormalPosTenders(next);
    expect(accepted.revision).toBe(2);
    expect(accepted.tenders.filter(row=>row.enabled).map(row=>row.id)).not.toContain('ALIPAY');
    expect(accepted.tenders.map(row=>row.id)).toEqual(policy.tenders.map(row=>row.id));
    expect(next.historicalPayments).toBe(historicalPayments);
    expect(next.customerPolicy).toBe(original.customerPolicy);
    expect(next.paymentRefs).toBe(original.paymentRefs);
    expect(next.posTenders).toMatchObject({futurePolicy:{keep:true},tenders:expect.arrayContaining([expect.objectContaining({futureRow:'preserve'})])});
    expect(readFormalPosTenders(original).tenders[1].enabled).toBe(true);
  });

  it('adds only explicit valid unique ids, labels and kinds',()=>{
    const snapshot=initial(), rows=readFormalPosTenders(snapshot).tenders;
    expect(readFormalPosTenders(writeFormalPosTenders(snapshot,1,[...rows,{id:'VOUCHER',label:'禮券',enabled:false,kind:'NON_CASH'}])).tenders).toHaveLength(6);
    expect(()=>writeFormalPosTenders(snapshot,1,[...rows,rows[0]])).toThrow('POS_TENDER_POLICY_TENDER_ID_DUPLICATE');
    expect(()=>writeFormalPosTenders(snapshot,1,[...rows,{id:'bad id',label:'新增',enabled:true,kind:'NON_CASH'}])).toThrow('POS_TENDER_POLICY_TENDER_ID_INVALID');
    expect(()=>writeFormalPosTenders(snapshot,1,[...rows,{id:'NEW',label:'',enabled:true,kind:'NON_CASH'}])).toThrow('POS_TENDER_POLICY_TENDER_LABEL_INVALID');
    expect(()=>writeFormalPosTenders(snapshot,1,[...rows,{id:'NEW',label:'新增',enabled:true,kind:'' as never}])).toThrow('POS_TENDER_POLICY_TENDER_KIND_INVALID');
  });

  it('rejects missing rows or changes to the meaning of an existing id',()=>{
    const snapshot=initial(), rows=readFormalPosTenders(snapshot).tenders;
    expect(()=>writeFormalPosTenders(snapshot,1,rows.slice(1))).toThrow('POS_TENDER_POLICY_ID_REMOVAL_FORBIDDEN');
    expect(()=>writeFormalPosTenders(snapshot,1,rows.map(row=>row.id==='CASH'?{...row,kind:'NON_CASH'}:row))).toThrow('POS_TENDER_POLICY_KIND_IMMUTABLE');
  });

  it('rejects stale editors, backwards revisions, same-revision content changes, and revision exhaustion',()=>{
    const snapshot=initial(), rows=readFormalPosTenders(snapshot).tenders;
    const changed=writeFormalPosTenders(snapshot,1,rows.map(row=>({...row,enabled:false})));
    expect(()=>writeFormalPosTenders(changed,1,rows)).toThrow('POS_TENDER_POLICY_REVISION_CONFLICT');
    expect(()=>assertFormalPosTenderTransition(changed,snapshot)).toThrow('POS_TENDER_POLICY_REVISION_ROLLBACK');
    expect(()=>assertFormalPosTenderTransition(snapshot,{...changed,posTenders:{...readFormalPosTenders(changed),revision:1}})).toThrow('POS_TENDER_POLICY_REVISION_CONFLICT');
    expect(()=>assertFormalPosTenderTransition(snapshot,snapshot)).not.toThrow();
    expect(()=>writeFormalPosTenders({...snapshot,posTenders:{...readFormalPosTenders(snapshot),revision:Number.MAX_SAFE_INTEGER}},Number.MAX_SAFE_INTEGER,rows)).toThrow('POS_TENDER_POLICY_REVISION_EXHAUSTED');
  });

  it.each([NaN,Infinity,-Infinity,0,-1,1.5,'1',true,null,Number.MAX_SAFE_INTEGER+1])('fails closed on invalid revision %s',revision=>{
    expect(()=>readFormalPosTenders({posTenders:{...readFormalPosTenders(initial()),revision}})).toThrow('POS_TENDER_POLICY_REVISION_INVALID');
  });

  it.each([null,[],{}, {schema:'wrong',revision:1,tenders:[]}])('fails closed on malformed policy',posTenders=>{
    expect(()=>readFormalPosTenders({posTenders})).toThrow();
  });

  it('matches native control-character validation and rejects malformed enabled flags',()=>{
    const policy=readFormalPosTenders(initial());
    expect(()=>readFormalPosTenders({posTenders:{...policy,tenders:[{...policy.tenders[0],label:'Cash\u0085'}]}})).toThrow('POS_TENDER_POLICY_TENDER_LABEL_INVALID');
    expect(()=>readFormalPosTenders({posTenders:{...policy,tenders:[{...policy.tenders[0],enabled:'true'}]}})).toThrow('POS_TENDER_POLICY_TENDER_ENABLED_INVALID');
  });

  it('produces a canonical published snapshot with the exact native Admin source contract',()=>{
    // Native FormalAdminConfigProducer.java at f6138d1 accepts snapshot.posTenders,
    // then FormalCheckoutRoomTenderProducer maps CASH/ NON_CASH to the evidence modes below.
    const snapshot=initial();
    const envelope=createMfkAdminConfigEnvelope({storeId:'MF01',revision:7,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'admin-7',snapshot});
    const readback=validateMfkAdminConfigEnvelope(JSON.parse(JSON.stringify(envelope)));
    const policy=validateMfkPosTenderPolicy((readback.snapshot as Record<string,unknown>).posTenders);
    expect(Object.keys(policy).sort()).toEqual(['revision','schema','tenders']);
    expect(policy.tenders.map(row=>Object.keys(row).sort())).toEqual(Array(5).fill(['enabled','id','kind','label']));
    expect(policy.tenders.map(row=>row.kind==='CASH'?'CASH_COUNTED':'STAFF_CONFIRMED')).toEqual(['CASH_COUNTED','STAFF_CONFIRMED','STAFF_CONFIRMED','STAFF_CONFIRMED','STAFF_CONFIRMED']);
    expect(readback.fingerprint).toBe(envelope.fingerprint);
    expect((readback.snapshot as Record<string,unknown>).future).toEqual({keep:true});
  });
});
