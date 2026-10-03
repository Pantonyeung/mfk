import {beforeEach,describe,expect,it} from 'vitest';
import {
  DEFAULT_MFK_POS_TENDER_POLICY,
  nextMfkPosTenderPolicy,
  validateMfkPosTenderPolicy,
} from '../../contracts/pos-tender-policy-v1.ts';
import {collectAdminSnapshot,saveAdminConfig} from './admin-config-save.ts';
import {hydrateAdminFromCanonical} from './admin-browser-session.ts';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {LEGACY_MF01_ADMIN_DRAFT} from './admin-menu-seed-mf01-v2.ts';
import {migrateLegacyDraftToOptionSetCenter} from './admin-option-set-center.ts';
import type {AdminSessionDraft} from './admin-draft.tsx';

function installStorage(){
  const values=new Map<string,string>();
  const localStorage={
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{values.set(key,String(value));},
    removeItem:(key:string)=>{values.delete(key);},
    clear:()=>values.clear(),
    key:(index:number)=>[...values.keys()][index]??null,
    get length(){return values.size;},
  };
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:localStorage});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage,dispatchEvent:()=>true}});
}

describe('canonical POS tender publication',()=>{
  beforeEach(()=>installStorage());

  it('ships only the five Owner-authorized initial tenders with stable ids',()=>{
    expect(DEFAULT_MFK_POS_TENDER_POLICY).toEqual({
      schema:'MFK_POS_TENDER_POLICY_V1',
      revision:1,
      tenders:[
        {id:'CASH',label:'Cash',enabled:true,kind:'CASH'},
        {id:'ALIPAY',label:'Alipay',enabled:true,kind:'NON_CASH'},
        {id:'WECHAT_PAY',label:'WeChat Pay',enabled:true,kind:'NON_CASH'},
        {id:'FPS',label:'FPS',enabled:true,kind:'NON_CASH'},
        {id:'PAYME',label:'PayMe',enabled:true,kind:'NON_CASH'},
      ],
    });
    expect(DEFAULT_MFK_POS_TENDER_POLICY.tenders.map(row=>row.id)).not.toContain('OCTOPUS');
    expect(DEFAULT_MFK_POS_TENDER_POLICY.tenders.map(row=>row.id)).not.toContain('CARD');
  });

  it('rejects duplicate or malformed stable ids and unsupported kinds',()=>{
    expect(()=>validateMfkPosTenderPolicy({
      schema:'MFK_POS_TENDER_POLICY_V1',revision:2,tenders:[
        {id:'CASH',label:'Cash',enabled:true,kind:'CASH'},
        {id:'CASH',label:'Duplicate',enabled:false,kind:'NON_CASH'},
      ],
    })).toThrow('POS_TENDER_POLICY_TENDER_ID_DUPLICATE');
    expect(()=>validateMfkPosTenderPolicy({
      schema:'MFK_POS_TENDER_POLICY_V1',revision:2,tenders:[
        {id:'credit card',label:'Credit card',enabled:true,kind:'CARD'},
      ],
    })).toThrow('POS_TENDER_POLICY_TENDER_ID_INVALID');
  });

  it('increments policy revision when Admin removes or disables a tender',()=>{
    const next=nextMfkPosTenderPolicy(DEFAULT_MFK_POS_TENDER_POLICY,[
      {id:'CASH',label:'Cash',enabled:true,kind:'CASH'},
      {id:'ALIPAY',label:'Alipay',enabled:false,kind:'NON_CASH'},
      {id:'FPS',label:'FPS',enabled:true,kind:'NON_CASH'},
      {id:'PAYME',label:'PayMe',enabled:true,kind:'NON_CASH'},
    ]);
    expect(next.revision).toBe(2);
    expect(next.tenders.find(row=>row.id==='ALIPAY')?.enabled).toBe(false);
    expect(next.tenders.some(row=>row.id==='WECHAT_PAY')).toBe(false);
  });

  it('publishes the canonical policy independently from customer channels and legacy payment refs',()=>{
    localStorage.setItem('mfk.admin.channel-policy.customer.v1',JSON.stringify({enabled:true,paymentChannels:['OCTOPUS']}));
    const catalog=LEGACY_MF01_ADMIN_DRAFT as unknown as AdminSessionDraft;
    const snapshot=collectAdminSnapshot(catalog,migrateLegacyDraftToOptionSetCenter(catalog)) as Record<string,unknown>;
    expect(snapshot.posTenders).toEqual(DEFAULT_MFK_POS_TENDER_POLICY);
    expect((snapshot.posTenders as typeof DEFAULT_MFK_POS_TENDER_POLICY).tenders.map(row=>row.id)).not.toContain('OCTOPUS');
  });

  it('hydrates a canonical policy for later Admin edits without changing its revision',()=>{
    const policy=nextMfkPosTenderPolicy(DEFAULT_MFK_POS_TENDER_POLICY,[
      ...DEFAULT_MFK_POS_TENDER_POLICY.tenders.map(row=>row.id==='PAYME'?{...row,enabled:false}:row),
    ]);
    const envelope=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:9,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'admin-9',
      snapshot:{catalog:{products:[]},posTenders:policy},
    });
    hydrateAdminFromCanonical(envelope);
    expect(JSON.parse(localStorage.getItem('mfk.admin.pos-tenders.v1')||'null')).toEqual(policy);
  });

  it('blocks malformed local policy from publication',()=>{
    localStorage.setItem('mfk.admin.pos-tenders.v1',JSON.stringify({
      schema:'MFK_POS_TENDER_POLICY_V1',revision:1,tenders:[
        {id:'CASH',label:'Cash',enabled:true,kind:'CASH'},
        {id:'CASH',label:'Again',enabled:true,kind:'CASH'},
      ],
    }));
    const catalog=LEGACY_MF01_ADMIN_DRAFT as unknown as AdminSessionDraft;
    const result=saveAdminConfig(catalog,migrateLegacyDraftToOptionSetCenter(catalog));
    expect(result.ok).toBe(false);
    if(!result.ok)expect(result.errors).toContain('POS_TENDER_POLICY_TENDER_ID_DUPLICATE');
    expect(localStorage.getItem('mfk.admin.releases.v1')).toBeNull();
  });

  it('rejects malformed canonical policy before partially hydrating Admin storage',()=>{
    const envelope=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:9,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'admin-9',
      snapshot:{
        catalog:{products:[{id:'MUST_NOT_WRITE'}]},
        posTenders:{schema:'MFK_POS_TENDER_POLICY_V1',revision:1,tenders:[
          {id:'cash',label:'Cash',enabled:true,kind:'CASH'},
        ]},
      },
    });
    expect(()=>hydrateAdminFromCanonical(envelope)).toThrow('POS_TENDER_POLICY_TENDER_ID_INVALID');
    expect(localStorage.getItem('mfk.admin.catalog-draft.v2')).toBeNull();
    expect(localStorage.getItem('mfk.admin.pos-tenders.v1')).toBeNull();
  });
});
