import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {publishV3FormalDraft,putV3FormalDraft,type V3FormalAdminDraft} from './formal-draft.tsx';
import {createInitialFormalPosTenders,readFormalPosTenders,writeFormalPosTenders} from './formal-pos-tenders.ts';

afterEach(()=>vi.unstubAllGlobals());
const initial=()=>createInitialFormalPosTenders({catalog:{products:[]},unrelated:{keep:true}});
const canonical=(snapshot:Record<string,unknown>)=>createMfkAdminConfigEnvelope({storeId:'MF01',revision:7,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'admin-7',snapshot});
const draft=(snapshot:Record<string,unknown>):V3FormalAdminDraft=>({schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'draft-1',baseFingerprint:canonical(initial()).fingerprint,basePublishedAt:'2026-10-03T00:00:00.000Z',draftRevision:3,snapshot,updatedAt:'2026-10-03T01:00:00.000Z',updatedByStaffId:'owner'});

describe('POS tender policy in the existing formal API',()=>{
  it('uses the existing authenticated draft and publication contracts without a second endpoint',async()=>{
    const active=canonical({catalog:{products:[]}}),snapshot=initial();
    const requests:{url:string;init:RequestInit;body:Record<string,unknown>}[]=[];
    const saved=draft(snapshot);
    vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init:RequestInit)=>{
      requests.push({url:String(url),init,body:JSON.parse(String(init.body))});
      return new Response(JSON.stringify(init.method==='PUT'?saved:{state:'PUBLISHED'}),{status:200});
    }));
    const result=await putV3FormalDraft({storeId:'MF01',sessionToken:'test-session',canonical:active,currentDraft:null,snapshot});
    await publishV3FormalDraft({storeId:'MF01',sessionToken:'test-session',canonical:active,draft:result});
    expect(requests.map(row=>row.url)).toEqual(['/api/admin-browser/draft?storeId=MF01','/api/admin-browser/draft/publish?storeId=MF01']);
    expect(requests[0].body).toEqual({baseFingerprint:active.fingerprint,basePublishedAt:active.publishedAt,snapshot});
    expect(requests[1].body).toEqual({draftId:'draft-1',expectedDraftRevision:3});
    expect(requests.every(row=>new Headers(row.init.headers).get('x-mfk-admin-session')==='test-session')).toBe(true);
    expect(requests.every(row=>row.init.credentials==='include')).toBe(true);
  });

  it.each([{}, {posTenders:null}, {posTenders:{schema:'MFK_POS_TENDER_POLICY_V1',revision:Infinity,tenders:[]}}])('blocks missing/malformed publication before fetch',async snapshot=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    await expect(publishV3FormalDraft({storeId:'MF01',sessionToken:'test-session',canonical:canonical({catalog:{products:[]}}),draft:draft(snapshot)})).rejects.toThrow('POS_TENDER_POLICY');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects stale policy content on save and publish instead of overwriting the new revision',async()=>{
    const snapshot=initial(), rows=readFormalPosTenders(snapshot).tenders;
    const latest=writeFormalPosTenders(snapshot,1,rows.map(row=>({...row,enabled:false})));
    const active=canonical(latest),fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    await expect(putV3FormalDraft({storeId:'MF01',sessionToken:'s',canonical:active,currentDraft:null,snapshot})).rejects.toThrow('POS_TENDER_POLICY_REVISION_ROLLBACK');
    await expect(publishV3FormalDraft({storeId:'MF01',sessionToken:'s',canonical:active,draft:draft(snapshot)})).rejects.toThrow('POS_TENDER_POLICY_REVISION_ROLLBACK');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('retains optimistic draft revision and server conflict classification',async()=>{
    const snapshot=initial(),current=draft(snapshot);
    const next=writeFormalPosTenders(snapshot,1,readFormalPosTenders(snapshot).tenders.map(row=>({...row,enabled:false})));
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init:RequestInit)=>{
      expect(JSON.parse(String(init.body)).expectedDraftRevision).toBe(3);
      return new Response(JSON.stringify({code:'ADMIN_DRAFT_REVISION_CONFLICT'}),{status:409});
    }));
    await expect(putV3FormalDraft({storeId:'MF01',sessionToken:'s',canonical:canonical(snapshot),currentDraft:current,snapshot:next})).rejects.toMatchObject({status:409,code:'ADMIN_DRAFT_REVISION_CONFLICT'});
  });
});
