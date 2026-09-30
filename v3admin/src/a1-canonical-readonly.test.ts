import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {deriveV3AdminProofHex,loginV3Admin} from './auth.ts';
import {readV3CanonicalAdminActive,summarizeV3Canonical,v3AdminCanonicalQueryKey} from './canonical.ts';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('V3 Admin A1 authenticated read-only canonical',()=>{
  it('derives the exact backend proof shape without transmitting raw PIN',async()=>{
    const pin='1234';
    const saltHex='11'.repeat(16);
    const proof=await deriveV3AdminProofHex({
      pin,
      loginId:'1111',
      challengeId:'challenge-1',
      nonce:'abc123',
      saltHex,
      iterations:100000,
    });
    expect(proof).toMatch(/^[0-9a-f]{64}$/);
    expect(proof).not.toContain(pin);
  });

  it('login sends only login identity + proof, never the raw PIN',async()=>{
    const seen:Array<{url:string;init:RequestInit|undefined}>=[];

    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      seen.push({url,init});
      if(url.includes('/auth/challenge')){
        return new Response(JSON.stringify({
          challengeId:'challenge-1',
          nonce:'abc123',
          saltHex:'11'.repeat(16),
          iterations:100000,
        }),{status:201,headers:{'content-type':'application/json'}});
      }
      if(url.includes('/auth/verify')){
        return new Response(JSON.stringify({
          ok:true,
          staffId:'staff-1',
          loginId:'1111',
          displayName:'Owner',
          role:'OWNER',
          scope:'STORE',
          permissions:['PUBLISH_CONFIG'],
          sessionToken:'a'.repeat(64),
          expiresAt:'2030-01-01T00:00:00.000Z',
        }),{status:201,headers:{'content-type':'application/json'}});
      }
      throw new Error('UNEXPECTED_FETCH');
    }));

    const session=await loginV3Admin('1111','1234');
    expect(session.sessionToken).toBe('a'.repeat(64));
    expect(seen).toHaveLength(2);

    const challengeBody=String(seen[0]?.init?.body??'');
    const verifyBody=String(seen[1]?.init?.body??'');
    expect(challengeBody).toContain('"loginId":"1111"');
    expect(challengeBody).not.toContain('1234');
    expect(verifyBody).not.toContain('1234');
    expect(JSON.parse(verifyBody).proofHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('canonical query uses session header and shared contract validation',async()=>{
    const envelope=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:9,
      publishedAt:'2026-09-30T07:00:00.000Z',
      adminFingerprint:'fnv1a32:admin-9',
      snapshot:{
        catalog:{
          categories:[{id:'C1'}],
          products:[{id:'P1'},{id:'P2'}],
          modifierGroups:[{id:'M1'}],
          combos:[{id:'K1'}],
        },
      },
    });

    const fetchMock=vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      expect((init?.headers as Record<string,string>)['x-mfk-admin-session']).toBe('s'.repeat(64));
      return new Response(JSON.stringify(envelope),{status:200,headers:{'content-type':'application/json'}});
    });
    vi.stubGlobal('fetch',fetchMock);

    const active=await readV3CanonicalAdminActive('s'.repeat(64));
    expect(active.fingerprint).toBe(envelope.fingerprint);
    expect(v3AdminCanonicalQueryKey).toEqual(['mfk','admin-v3','canonical','active','MF01']);

    const summary=summarizeV3Canonical(active);
    expect(summary).toMatchObject({storeId:'MF01',revision:9,categories:1,products:2,modifierGroups:1,combos:1});
  });

  it('rejects a canonical payload whose fingerprint does not match its content',async()=>{
    const envelope=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:10,
      publishedAt:'2026-09-30T07:10:00.000Z',
      adminFingerprint:'fnv1a32:admin-10',
      snapshot:{catalog:{categories:[],products:[],modifierGroups:[],combos:[]}},
    });
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...envelope,fingerprint:'fnv1a32:00000000'}),{
      status:200,
      headers:{'content-type':'application/json'},
    })));
    await expect(readV3CanonicalAdminActive('s'.repeat(64))).rejects.toThrow('ADMIN_CONFIG_FINGERPRINT_MISMATCH');
  });

  it('A1 source has no persistent auth, mutation, publish or v2 client-state dependency',async()=>{
    const fs=await import('node:fs');
    const files=['App.tsx','auth.ts','canonical.ts','state-authority.ts'];
    for(const path of files){
      const source=fs.readFileSync(new URL('./'+path,import.meta.url),'utf8');
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
      expect(source).not.toContain('../v2admin');
      expect(source).not.toContain('admin-local-store');
      expect(source).not.toContain('admin-sync-client');
      expect(source).not.toContain('useMutation');
      expect(source).not.toContain('/publish');
    }
  });
});
