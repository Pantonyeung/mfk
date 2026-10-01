import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {readV3FormalVersions,rollbackV3FormalVersion,V3FormalDraftHttpError} from './formal-draft.tsx';

afterEach(()=>vi.unstubAllGlobals());

function canonical(){
  return createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:9,
    publishedAt:'2026-10-01T08:00:00.000Z',
    adminFingerprint:'admin-current',
    snapshot:{catalog:{categories:[],products:[],modifierGroups:[],combos:[],comboPools:[]}},
  });
}

describe('Admin V3 formal version API',()=>{
  it('reads immutable version metadata with Admin session authority',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toContain('/api/admin-browser/versions?storeId=MF01');
      expect(init?.method).toBe('GET');
      expect(init?.cache).toBe('no-store');
      expect(new Headers(init?.headers).get('x-mfk-admin-session')).toBe('session-token');
      return new Response(JSON.stringify({
        schema:'MFK_ADMIN_VERSION_LIST_V1',
        storeId:'MF01',
        activeFingerprint:'fp-9',
        historyCompleteness:'FORWARD_ONLY',
        versions:[
          {revision:9,publishedAt:'2026-10-01T08:00:00.000Z',fingerprint:'fp-9',adminFingerprint:'admin-9',state:'ACTIVE'},
          {revision:8,publishedAt:'2026-10-01T07:00:00.000Z',fingerprint:'fp-8',adminFingerprint:'admin-8',state:'ARCHIVED'},
        ],
      }),{status:200,headers:{'content-type':'application/json'}});
    }));
    const result=await readV3FormalVersions({storeId:'MF01',sessionToken:'session-token'});
    expect(result.historyCompleteness).toBe('FORWARD_ONLY');
    expect(result.versions.map(version=>version.state)).toEqual(['ACTIVE','ARCHIVED']);
  });

  it('sends rollback intent with exact current canonical guards and never sends a historical snapshot',async()=>{
    const active=canonical();
    const fetchMock=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toContain('/api/admin-browser/versions/rollback?storeId=MF01');
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('x-mfk-admin-session')).toBe('session-token');
      const body=JSON.parse(String(init?.body));
      expect(body).toEqual({
        operationId:'op-1',
        targetFingerprint:'fp-8',
        expectedActiveFingerprint:active.fingerprint,
        expectedActivePublishedAt:active.publishedAt,
        expectedActiveRevision:active.revision,
        reason:'回復到上一個已確認版本',
      });
      expect(body.snapshot).toBeUndefined();
      return new Response(JSON.stringify({
        state:'ROLLED_BACK_AS_NEW_VERSION',
        operationId:'op-1',
        targetFingerprint:'fp-8',
        active:{...active,revision:10,fingerprint:'fp-10'},
      }),{status:200,headers:{'content-type':'application/json'}});
    });
    vi.stubGlobal('fetch',fetchMock);
    const result=await rollbackV3FormalVersion({
      storeId:'MF01',
      sessionToken:'session-token',
      canonical:active,
      targetFingerprint:'fp-8',
      reason:'回復到上一個已確認版本',
      operationId:'op-1',
    });
    expect(result.state).toBe('ROLLED_BACK_AS_NEW_VERSION');
  });

  it('preserves server failure classification for stale rollback guards',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({code:'ADMIN_ROLLBACK_BASE_CONFLICT'}),{status:409,headers:{'content-type':'application/json'}})));
    await expect(rollbackV3FormalVersion({
      storeId:'MF01',
      sessionToken:'session-token',
      canonical:canonical(),
      targetFingerprint:'fp-8',
      reason:'回復',
      operationId:'op-stale',
    })).rejects.toMatchObject<V3FormalDraftHttpError>({status:409,code:'ADMIN_ROLLBACK_BASE_CONFLICT'});
  });

  it('rejects malformed version-list payloads instead of inventing history',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({
      schema:'MFK_ADMIN_VERSION_LIST_V1',
      storeId:'MF01',
      activeFingerprint:'fp-9',
      historyCompleteness:'FORWARD_ONLY',
      versions:[{revision:8,publishedAt:'bad-time',fingerprint:'fp-8',adminFingerprint:'a',state:'ARCHIVED'}],
    }),{status:200,headers:{'content-type':'application/json'}})));
    await expect(readV3FormalVersions({storeId:'MF01',sessionToken:'session-token'})).rejects.toThrow('V3_ADMIN_VERSION_LIST_INVALID');
  });
});
