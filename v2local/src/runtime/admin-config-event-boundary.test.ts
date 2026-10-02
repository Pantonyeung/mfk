import {readFileSync} from 'node:fs';
import {beforeEach,describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {
  SMT_ADMIN_CONFIG_LKG_KEY,
  SMT_ADMIN_CONFIG_STATUS_KEY,
  applyAdminConfigEnvelope,
  subscribeSmtAdminConfig,
  subscribeSmtAdminSyncStatus,
} from './admin-config-sync.ts';

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{
    configurable:true,
    value:{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,String(value));},
      removeItem:(key:string)=>{values.delete(key);},
      clear:()=>values.clear(),
      key:(index:number)=>[...values.keys()][index]??null,
      get length(){return values.size;},
    },
  });
}

function envelope(revision:number){
  return createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision,
    publishedAt:'2026-10-02T02:20:0'+revision+'.000Z',
    adminFingerprint:'admin-'+revision,
    snapshot:{catalog:{products:[{id:'p'+revision}]}},
  });
}

describe('SMT Admin config event boundary',()=>{
  beforeEach(()=>{
    installStorage();
    localStorage.removeItem(SMT_ADMIN_CONFIG_LKG_KEY);
    localStorage.removeItem(SMT_ADMIN_CONFIG_STATUS_KEY);
  });

  it('does not fan status-only updates into canonical config subscribers',()=>{
    let configEvents=0;
    let statusEvents=0;
    const offConfig=subscribeSmtAdminConfig(()=>{configEvents+=1;});
    const offStatus=subscribeSmtAdminSyncStatus(()=>{statusEvents+=1;});
    try{
      const r1=envelope(1);
      expect(applyAdminConfigEnvelope(r1).disposition).toBe('APPLIED');
      expect(configEvents).toBe(1);
      expect(statusEvents).toBe(1);

      expect(applyAdminConfigEnvelope(r1).disposition).toBe('IDEMPOTENT');
      expect(configEvents).toBe(1);
      expect(statusEvents).toBe(2);

      expect(applyAdminConfigEnvelope(envelope(2)).disposition).toBe('APPLIED');
      expect(configEvents).toBe(2);
      expect(statusEvents).toBe(3);
    }finally{
      offConfig();
      offStatus();
    }
  });

  it('keeps WebSocket status/readback events from waking business consumers',()=>{
    const sync=readFileSync(new URL('./admin-config-sync.ts',import.meta.url),'utf8');
    const customer=readFileSync(new URL('./customer-cloud-intake.ts',import.meta.url),'utf8');
    const keeta=readFileSync(new URL('./keeta-order-intake.ts',import.meta.url),'utf8');
    const outbox=readFileSync(new URL('./projection-outbox.ts',import.meta.url),'utf8');

    expect(sync).toContain('function emitConfig()');
    expect(sync).toContain('function emitStatus()');
    expect(sync).toContain('emitStatus();');
    expect(sync).not.toMatch(/function setStatus[\s\S]{0,180}emitConfig\(\)/);
    expect(sync).toContain('Legacy config doorbell is diagnostics-only');
    expect(sync).toContain('if(!deltaSyncInFlight&&incomingHeadSeq>(bundle?.appliedSeq??-1))');
    expect(sync).not.toMatch(/socket\.addEventListener\('open',[\s\S]{0,180}reconcileSmtCheckpointedSync/);

    for(const source of [customer,keeta,outbox]){
      expect(source).toContain('subscribeSmtAdminConfig');
      expect(source).not.toContain('subscribeSmtAdminSyncStatus');
    }
  });
});
