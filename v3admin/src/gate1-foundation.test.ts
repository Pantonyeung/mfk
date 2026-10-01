import {afterEach,describe,expect,it,vi} from 'vitest';
import {QueryClient} from '@tanstack/react-query';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {readV3CanonicalAdminActive,v3AdminCanonicalQueryKey} from './canonical.ts';
import {releaseIdentityMatches,releaseVerificationMatches,V3_RELEASE_REFETCH_INTERVAL_MS} from './release.ts';
import {V3_ADMIN_STATE_AUTHORITY,V3_DATA_REFETCH_INTERVAL_MS,resetV3AdminServerQueries} from './state-authority.ts';

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
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      expect(init?.cache).toBe('no-store');
      return new Response(JSON.stringify(envelope),{status:200,headers:{'content-type':'application/json'}});
    }));
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

  it('rejects a valid canonical envelope for another store',async()=>{
    const envelope=createMfkAdminConfigEnvelope({
      storeId:'MF02',
      revision:9,
      publishedAt:'2026-09-30T14:10:00.000Z',
      adminFingerprint:'fnv1a32:admin',
      snapshot:{catalog:{categories:[],products:[],modifierGroups:[],combos:[]}},
    });
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(envelope),{status:200,headers:{'content-type':'application/json'}})));
    await expect(readV3CanonicalAdminActive({storeId:'MF01',sessionToken:'s'.repeat(64)})).rejects.toThrow('V3_ADMIN_CANONICAL_STORE_MISMATCH');
  });

  it('separates loaded client release from serving release identity',()=>{
    const same={releaseId:'r1',sourceSha:'a'.repeat(40),buildTime:'2026-09-30T14:00:00.000Z'};
    expect(releaseIdentityMatches(same,same)).toBe(true);
    expect(releaseIdentityMatches(same,{...same,releaseId:'r2'})).toBe(false);
    expect(releaseIdentityMatches(same,{...same,buildTime:'2026-09-30T14:01:00.000Z'})).toBe(false);
  });

  it('fails closed while serving release verification is not current',()=>{
    const same={releaseId:'r1',sourceSha:'a'.repeat(40),buildTime:'2026-09-30T14:00:00.000Z'};
    expect(releaseVerificationMatches(same,same,true)).toBe(true);
    expect(releaseVerificationMatches(same,same,false)).toBeNull();
    expect(releaseVerificationMatches(same,undefined,true)).toBeNull();
    expect(V3_RELEASE_REFETCH_INTERVAL_MS).toBeGreaterThan(0);
  });

  it('sets a bounded automatic server revalidation interval',()=>{
    expect(V3_DATA_REFETCH_INTERVAL_MS).toBe(60_000);
  });

  it('can clear only the in-memory V3 query cache and force active queries back to server truth',async()=>{
    const client=new QueryClient();
    const key=['mfk','admin-v3','canonical','active','MF01'] as const;
    client.setQueryData(key,{revision:1,source:'stale'});
    expect(client.getQueryData(key)).toEqual({revision:1,source:'stale'});
    await resetV3AdminServerQueries(client);
    expect(client.getQueryData(key)).toBeUndefined();
  });

  it('does not enable a durable outbox by default',()=>{
    expect(V3_ADMIN_STATE_AUTHORITY.outbox).toContain('CONDITIONAL_DEXIE_ONLY');
    expect(V3_ADMIN_STATE_AUTHORITY.v2LocalStorageRead).toBe(false);
    expect(V3_ADMIN_STATE_AUTHORITY.derivedServerStatusPersisted).toBe(false);
  });
});
