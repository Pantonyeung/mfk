import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {readV3CanonicalAdminActive,v3AdminCanonicalQueryKey} from './canonical.ts';
import {releaseIdentityMatches} from './release.ts';
import {V3_ADMIN_STATE_AUTHORITY} from './state-authority.ts';

afterEach(()=>vi.unstubAllGlobals());

describe('Admin V3 one-shot Gate 1',()=>{
  it('uses the shared canonical contract validator',async()=>{
    const envelope=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:7,
      publishedAt:'2026-09-30T14:00:00.000Z',
      adminFingerprint:'fnv1a32:admin',
      snapshot:{catalog:{categories:[{id:'C1'}],products:[{id:'P1'}],modifierGroups:[],combos:[]}},
    });
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(envelope),{status:200,headers:{'content-type':'application/json'}})));
    const result=await readV3CanonicalAdminActive({storeId:'MF01',sessionToken:'s'.repeat(64)});
    expect(result.fingerprint).toBe(envelope.fingerprint);
    expect(v3AdminCanonicalQueryKey('MF01')).toEqual(['mfk','admin-v3','canonical','active','MF01']);
  });

  it('rejects envelopes rejected by the controlling shared validator',async()=>{
    const envelope=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:8,
      publishedAt:'2026-09-30T14:05:00.000Z',
      adminFingerprint:'fnv1a32:admin',
      snapshot:{catalog:{categories:[],products:[],modifierGroups:[],combos:[]}},
    });
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...envelope,storeId:'X'.repeat(65)}),{status:200,headers:{'content-type':'application/json'}})));
    await expect(readV3CanonicalAdminActive({storeId:'MF01',sessionToken:'s'.repeat(64)})).rejects.toThrow('ADMIN_CONFIG_STORE_ID_INVALID');
  });

  it('separates loaded client release from serving release identity',()=>{
    const same={releaseId:'r1',sourceSha:'a'.repeat(40),buildTime:'2026-09-30T14:00:00.000Z'};
    expect(releaseIdentityMatches(same,same)).toBe(true);
    expect(releaseIdentityMatches(same,{...same,releaseId:'r2'})).toBe(false);
  });

  it('does not enable a durable outbox by default',()=>{
    expect(V3_ADMIN_STATE_AUTHORITY.outbox).toContain('CONDITIONAL_DEXIE_ONLY');
    expect(V3_ADMIN_STATE_AUTHORITY.v2LocalStorageRead).toBe(false);
    expect(V3_ADMIN_STATE_AUTHORITY.derivedServerStatusPersisted).toBe(false);
  });
});
