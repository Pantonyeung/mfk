import React from 'react';
import {act,create} from 'react-test-renderer';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {V3FormalDraftProvider,useV3FormalDraft,v3FormalDraftQueryKey} from './formal-draft.tsx';
import {createInitialFormalPosTenders,readFormalPosTenders,writeFormalPosTenders} from './formal-pos-tenders.ts';

afterEach(()=>vi.unstubAllGlobals());

describe('formal draft optimistic-lock integrity',()=>{
  it('never pairs an old snapshot with a newer lock if refetch updates cache before the async mutation runs',async()=>{
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    const snapshot=createInitialFormalPosTenders({catalog:{products:[]},unknownDomain:{value:'old'}});
    const canonical=createMfkAdminConfigEnvelope({storeId:'MF01',revision:7,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'admin-7',snapshot});
    const current={schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d',baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,draftRevision:3,snapshot,updatedAt:canonical.publishedAt,updatedByStaffId:'owner'};
    const newer={...current,draftRevision:4,snapshot:{...snapshot,unknownDomain:{value:'new concurrent server data'}}};
    const client=new QueryClient({defaultOptions:{queries:{enabled:false}}});
    client.setQueryData(v3FormalDraftQueryKey('MF01'),current);
    let formal:ReturnType<typeof useV3FormalDraft>;
    function Probe(){formal=useV3FormalDraft();return null;}
    let renderer:ReturnType<typeof create>;
    await act(async()=>{renderer=create(React.createElement(QueryClientProvider,{client},React.createElement(V3FormalDraftProvider,{canonical,storeId:'MF01',sessionToken:'test'},React.createElement(Probe))));});
    let request:Record<string,any>|null=null;
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init:RequestInit)=>{
      request=JSON.parse(String(init.body));
      // The real server has draft 4 already; it only accepts expectedDraftRevision 4.
      if(request!.expectedDraftRevision!==4)return new Response(JSON.stringify({code:'ADMIN_DRAFT_REVISION_CONFLICT'}),{status:409});
      return new Response(JSON.stringify({...newer,draftRevision:5,snapshot:request!.snapshot}),{status:200});
    }));
    try{
      await act(async()=>{
        const saving=formal!.mutateSnapshot(value=>writeFormalPosTenders(value,1,readFormalPosTenders(value).tenders.map(row=>({...row,enabled:false}))));
        client.setQueryData(v3FormalDraftQueryKey('MF01'),newer);
        await expect(saving).rejects.toMatchObject({code:'ADMIN_DRAFT_REVISION_CONFLICT'});
      });
      expect(request!.expectedDraftRevision).toBe(3);
      expect(request!.snapshot.unknownDomain.value).toBe('old');
      expect(client.getQueryData(v3FormalDraftQueryKey('MF01'))).toEqual(newer);
    }finally{
      await act(async()=>renderer!.unmount());client.clear();
    }
  });
});
