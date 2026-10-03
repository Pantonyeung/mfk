import React from 'react';
import {act,create} from 'react-test-renderer';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {BusinessConfigurationExtractControl} from './formal-publish-history-pages.tsx';
import {V3FormalDraftProvider,useV3FormalDraft,v3FormalDraftQueryKey} from './formal-draft.tsx';
import {AdminShell} from './admin-shell.tsx';
import {prepareV3BusinessConfigurationExtract} from './business-config-extract.ts';
const config=(name:string)=>({catalog:{products:[{id:'p1',name}],combos:[]},optionCenter:{},logicalPrinters:[],printTemplates:{},printRules:{}});
const canonical=(name:string)=>createMfkAdminConfigEnvelope({storeId:'MF01',revision:27,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'admin-distinct',snapshot:config(name)});
async function fixture(){vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(canonical('published live')))));return prepareV3BusinessConfigurationExtract({storeId:'MF01',sessionToken:'fixture-session'});}
function setup(){vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const make=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:local-test'),revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});return {make,revoke};}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('explicit business extract preparation and download',()=>{
  it('prepares only on click and provides a separate download link without clicking it',async()=>{
    const artifact=await fixture(),{make,revoke}=setup(),prepare=vi.fn(async()=>artifact);let tree:ReturnType<typeof create>;
    await act(async()=>{tree=create(React.createElement(BusinessConfigurationExtractControl,{sourceKey:'canonical-27',prepare}));});
    try{
      expect(prepare).not.toHaveBeenCalled();expect(make).not.toHaveBeenCalled();expect(tree!.root.findAllByType('a')).toHaveLength(0);
      await act(async()=>{await tree!.root.findByType('button').props.onClick();});
      expect(prepare).toHaveBeenCalledTimes(1);expect(make).toHaveBeenCalledTimes(1);
      const blob=make.mock.calls[0][0] as Blob;expect(JSON.parse(await blob.text())).toEqual(artifact);
      const anchor=tree!.root.findByType('a');expect(anchor.props.href).toBe('blob:local-test');expect(anchor.props.download).toMatch(/^selected-business-config-MF01-R27-/);expect(anchor.props.onClick).toBeUndefined();
      expect(JSON.stringify(tree!.toJSON())).toContain('admin-distinct');expect(JSON.stringify(tree!.toJSON())).toContain(artifact.source.canonicalFingerprint);
    }finally{await act(async()=>tree!.unmount());}
    expect(revoke).toHaveBeenCalledWith('blob:local-test');
  });
  it('displays an explicit source-omission notice without implying default settings were exported',async()=>{
    const source=canonical('legacy canonical only');
    const active=createMfkAdminConfigEnvelope({...source,snapshot:{catalog:source.snapshot.catalog}});
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(active))));
    const artifact=await prepareV3BusinessConfigurationExtract({storeId:'MF01',sessionToken:'synthetic'});
    setup();const prepare=vi.fn(async()=>artifact);let tree:ReturnType<typeof create>;
    await act(async()=>{tree=create(React.createElement(BusinessConfigurationExtractControl,{sourceKey:'one',prepare}));});
    try{
      await act(async()=>tree!.root.findByType('button').props.onClick());
      const html=JSON.stringify(tree!.toJSON());expect(html).toContain('來源未提供：');
      for(const key of artifact.absentOptionalSections)expect(html).toContain(key);
      expect(html).toContain('不會補入空白或預設設定');expect(tree!.root.findAllByType('a')).toHaveLength(1);
    }finally{await act(async()=>tree!.unmount());}
  });
  it('deduplicates repeated prepare clicks and discards a response after unmount',async()=>{
    const artifact=await fixture(),{make}=setup();let resolve!:(value:typeof artifact)=>void;
    const prepare=vi.fn(()=>new Promise<typeof artifact>(done=>{resolve=done;}));let tree:ReturnType<typeof create>;
    await act(async()=>{tree=create(React.createElement(BusinessConfigurationExtractControl,{sourceKey:'one',prepare}));});
    await act(async()=>{const click=tree!.root.findByType('button').props.onClick;void click();void click();});
    expect(prepare).toHaveBeenCalledTimes(1);
    await act(async()=>tree!.unmount());await act(async()=>resolve(artifact));expect(make).not.toHaveBeenCalled();
  });
  it('invalidates a prepared file when canonical identity changes and cleans up replaced URLs',async()=>{
    const artifact=await fixture(),{make,revoke}=setup(),prepare=vi.fn(async()=>artifact);let tree:ReturnType<typeof create>;
    await act(async()=>{tree=create(React.createElement(BusinessConfigurationExtractControl,{sourceKey:'one',prepare}));});
    try{
      await act(async()=>tree!.root.findByType('button').props.onClick());
      await act(async()=>tree!.root.findByType('button').props.onClick());
      expect(make).toHaveBeenCalledTimes(2);expect(revoke).toHaveBeenCalledWith('blob:local-test');
      await act(async()=>tree!.update(React.createElement(BusinessConfigurationExtractControl,{sourceKey:'two',prepare})));
      expect(tree!.root.findAllByType('a')).toHaveLength(0);
    }finally{await act(async()=>tree!.unmount());}
  });
  it('ignores an in-flight result after the visible canonical identity changes',async()=>{
    const artifact=await fixture(),{make}=setup();let resolve!:(value:typeof artifact)=>void;
    const prepare=vi.fn(()=>new Promise<typeof artifact>(done=>{resolve=done;}));let tree:ReturnType<typeof create>;
    await act(async()=>{tree=create(React.createElement(BusinessConfigurationExtractControl,{sourceKey:'one',prepare}));});
    try{
      await act(async()=>{void tree!.root.findByType('button').props.onClick();});
      await act(async()=>tree!.update(React.createElement(BusinessConfigurationExtractControl,{sourceKey:'two',prepare})));
      await act(async()=>resolve(artifact));expect(make).not.toHaveBeenCalled();expect(tree!.root.findAllByType('a')).toHaveLength(0);
    }finally{await act(async()=>tree!.unmount());}
  });
  it('fails visibly without making a download on provider error',async()=>{
    const {make}=setup(),prepare=vi.fn(async()=>{throw new Error('READ_UNVERIFIED');});let tree:ReturnType<typeof create>;
    await act(async()=>{tree=create(React.createElement(BusinessConfigurationExtractControl,{sourceKey:'one',prepare}));});
    try{await act(async()=>tree!.root.findByType('button').props.onClick());expect(JSON.stringify(tree!.toJSON())).toContain('READ_UNVERIFIED');expect(make).not.toHaveBeenCalled();expect(tree!.root.findAllByType('a')).toHaveLength(0);}
    finally{await act(async()=>tree!.unmount());}
  });
  it('never uses dirty draft or cached canonical data, and never calls a mutation endpoint',async()=>{
    setup();const cached=canonical('old cached canonical'),client=new QueryClient({defaultOptions:{queries:{enabled:false}}});
    client.setQueryData(v3FormalDraftQueryKey('MF01'),{schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',baseFingerprint:cached.fingerprint,basePublishedAt:cached.publishedAt,draftRevision:4,snapshot:config('UNPUBLISHED MUTABLE DRAFT'),updatedAt:cached.publishedAt,updatedByStaffId:'owner'});
    const fetcher=vi.fn(async()=>new Response(JSON.stringify(canonical('fresh canonical only'))));vi.stubGlobal('fetch',fetcher);
    let formal!:ReturnType<typeof useV3FormalDraft>,tree:ReturnType<typeof create>;
    function Probe(){formal=useV3FormalDraft();return null;}
    await act(async()=>{tree=create(React.createElement(QueryClientProvider,{client},React.createElement(V3FormalDraftProvider,{storeId:'MF01',sessionToken:'test-session',canonical:cached},React.createElement(Probe))));});
    try{
      expect(formal.workingSnapshot).toEqual(config('UNPUBLISHED MUTABLE DRAFT'));
      const result=await formal.prepareBusinessConfigurationExtract();expect(result.sections.catalog).toEqual(config('fresh canonical only').catalog);
      expect(fetcher).toHaveBeenCalledTimes(1);const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(url).toContain('/active?');expect(init.method).toBe('GET');expect(init.body).toBeUndefined();
      expect(formal.workingSnapshot).toEqual(config('UNPUBLISHED MUTABLE DRAFT'));
    }finally{await act(async()=>tree!.unmount());client.clear();}
  });
  it('does not offer the canonical export on a preview route',()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const html=renderToStaticMarkup(React.createElement(AdminShell,{storeId:'PREVIEW',displayName:'preview',releaseStatus:null,canonicalState:'fresh',previewMode:true,initialPath:'/admin/publish/versions',onRefresh:()=>{},onDiagnostics:()=>{},onSignOut:()=>{}}));
    expect(html).not.toContain('selected business configuration extract');expect(html).not.toContain('準備商業設定擷取');expect(fetcher).not.toHaveBeenCalled();
  });
});
