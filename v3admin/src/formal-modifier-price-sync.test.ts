import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FormalModifiersPage} from './formal-modifiers-page.tsx';
import {FormalPricingPage} from './formal-catalog-pages.tsx';
import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {readV3CanonicalAdminActive} from './canonical.ts';
import {patchFormalModifierOptionPrice,readFormalCatalogPricing} from './formal-catalog.ts';
import {readFormalOptionCenter,replaceFormalOptionSet,validateFormalOptionCenter,formalOptionSetEditBaseline} from './formal-option-center.ts';
import {putV3FormalDraft,publishV3FormalDraft,V3FormalDraftProvider,useV3FormalDraft,v3FormalDraftQueryKey,type V3FormalAdminDraft} from './formal-draft.tsx';
import {createInitialFormalPosTenders} from './formal-pos-tenders.ts';

function source(){
  const target={id:'g1',name:'Size',required:false,forceShow:false,selection:'MULTI',min:0,max:2,allowQuantities:false,active:true,options:[
    {id:'o1',code:'L',name:'Large',priceAdjustment:'5.00',active:true,position:10,defaultSelected:false,unknownOption:{keep:true}},
    {id:'o2',code:'S',name:'Small',priceAdjustment:'-1.00',active:true,position:20,defaultSelected:true,unknownOption:{keep:'other'}},
  ],unknownSet:{keep:true}};
  const other={...structuredClone(target),id:'g2',name:'Other',options:[{id:'o3',code:'O',name:'Other',priceAdjustment:'2.00',active:true,position:10,defaultSelected:false,unknownOption:{keep:'unrelated'}}]};
  return createInitialFormalPosTenders({
    catalog:{products:[{id:'p1',basePrice:'10.00',modifierGroupIds:['g1','g2']}],modifierGroups:[structuredClone(target),structuredClone(other)],combos:[{id:'combo1',basePrice:'20.00'}],unknownCatalog:true},
    optionCenter:{sets:[structuredClone(target),structuredClone(other)],productLinks:[{productId:'p1',setId:'g1',defaultOptionIds:['o2'],unknownLink:{keep:true}},{productId:'p1',setId:'g2',defaultOptionIds:[]}],unknownCenter:true},
    printRules:{p1:{production:true}},unknownSnapshot:{keep:true},
  });
}
const active=(snapshot:Record<string,unknown>)=>createMfkAdminConfigEnvelope({storeId:'MF01',revision:27,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'admin-27',snapshot});
const optionPrice=(snapshot:any)=>snapshot.optionCenter.sets[0].options[0].priceAdjustment;
const catalogPrice=(snapshot:any)=>snapshot.catalog.modifierGroups[0].options[0].priceAdjustment;
afterEach(()=>vi.unstubAllGlobals());

describe('formal modifier pricing keeps the canonical option copy coherent',()=>{
  it('atomically changes only the matched raw option prices in both existing copies',()=>{
    const before=source(),immutable=structuredClone(before),expected=structuredClone(before) as any;
    expected.catalog.modifierGroups[0].options[0].priceAdjustment='6.50';expected.optionCenter.sets[0].options[0].priceAdjustment='6.50';
    expect(patchFormalModifierOptionPrice(before,'g1','o1','6.50')).toEqual(expected);expect(before).toEqual(immutable);
  });
  it('retains the new price through later option editing without losing choices, defaults, IDs or unknown fields',()=>{
    const changed=patchFormalModifierOptionPrice(source(),'g1','o1','6.50');
    const center=readFormalOptionCenter(changed);expect(center.sets[0].options[0].priceAdjustment).toBe('6.50');
    const next=replaceFormalOptionSet(changed,{...center.sets[0],name:'New display name'},['p1']) as any;
    const expected=structuredClone(changed) as any;expected.catalog.modifierGroups[0].name='New display name';expected.optionCenter.sets[0].name='New display name';
    expect(next).toEqual(expected);expect(optionPrice(next)).toBe('6.50');expect(catalogPrice(next)).toBe('6.50');
  });
  it('reads canonical optionCenter pricing when an existing legacy mirror disagrees',()=>{
    const input=source() as any;input.catalog.modifierGroups[0].options[0].priceAdjustment='99.00';
    expect(readFormalCatalogPricing(input).modifierGroups[0].options[0].priceAdjustment).toBe('5.00');
  });
  it('preserves a legitimately absent optionCenter and legacy default facts without creating a new authority',()=>{
    const input=source() as any;delete input.optionCenter;
    const changed=patchFormalModifierOptionPrice(input,'g1','o1','6.50');expect(Object.hasOwn(changed,'optionCenter')).toBe(false);
    expect(readFormalOptionCenter(changed).sets[0].options[0].priceAdjustment).toBe('6.50');
    expect(readFormalOptionCenter(changed).productLinks[0].defaultOptionIds).toEqual(['o2']);
  });
  it.each(['',' ','NaN','Infinity','1e2','0.001','+1.00','90071992547409.92','100000000000000','1.2.3'])('rejects a modifier price the native exact-minor contract cannot represent: %s',price=>{
    const input=source(),before=structuredClone(input);expect(()=>patchFormalModifierOptionPrice(input,'g1','o1',price)).toThrow();expect(input).toEqual(before);
  });
  it('retains historical exact source representation while validating newly entered native prices',()=>{
    const input=source() as any;input.catalog.modifierGroups[0].options[0].priceAdjustment='1.000';input.optionCenter.sets[0].options[0].priceAdjustment='1.000';
    expect(validateFormalOptionCenter(readFormalOptionCenter(input))).toEqual([]);
    const next=patchFormalModifierOptionPrice(input,'g1','o1','6.50');expect(optionPrice(next)).toBe('6.50');expect(catalogPrice(next)).toBe('6.50');
    expect(input.optionCenter.sets[0].options[0].priceAdjustment).toBe('1.000');
  });
  it.each(['',' ','NaN','Infinity','-Infinity','1.2.3'])('retains finite-number option-editor validation for %s',price=>{
    const center=readFormalOptionCenter(source());center.sets[0].options[0].priceAdjustment=price;expect(validateFormalOptionCenter(center).length).toBeGreaterThan(0);
  });
  it('preserves unchanged historical prices during name edits but rejects new incompatible option prices',()=>{
    const input=source() as any;input.catalog.modifierGroups[0].options[0].priceAdjustment='1.000';input.optionCenter.sets[0].options[0].priceAdjustment='1.000';
    const state=readFormalOptionCenter(input),preserved=replaceFormalOptionSet(input,{...state.sets[0],name:'Preserved legacy'},['p1']);
    expect(optionPrice(preserved)).toBe('1.000');expect(catalogPrice(preserved)).toBe('1.000');
    const fresh=source(),edited=readFormalOptionCenter(fresh).sets[0];edited.options[0].priceAdjustment='1.000';
    expect(()=>replaceFormalOptionSet(fresh,edited,['p1'])).toThrow('FORMAL_MODIFIER_PRICE_INVALID');
    const added=readFormalOptionCenter(fresh).sets[0];added.options.push({...added.options[0],id:'new-option',code:'NEW',priceAdjustment:'0.001'});
    expect(()=>replaceFormalOptionSet(fresh,added,['p1'])).toThrow('FORMAL_MODIFIER_PRICE_INVALID');
  });
  it('visibly marks preserved incompatible prices and blocks publication before transport',async()=>{
    const input=source() as any;input.catalog.modifierGroups[0].options[0].priceAdjustment='1.000';input.optionCenter.sets[0].options[0].priceAdjustment='1.000';
    const canonical=active(input),client=new QueryClient({defaultOptions:{queries:{enabled:false}}});
    const html=renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(V3FormalDraftProvider,{storeId:'MF01',sessionToken:'synthetic',canonical},React.createElement(FormalPricingPage))));
    expect(html).toContain('歷史選項價格未符合原生報價格式');expect(html).toContain('保留不等於可報價');client.clear();
    const draft:V3FormalAdminDraft={schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,draftRevision:1,snapshot:input,updatedAt:canonical.publishedAt,updatedByStaffId:'owner'};
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({state:'PUBLISHED'})));vi.stubGlobal('fetch',fetcher);
    await expect(publishV3FormalDraft({storeId:'MF01',sessionToken:'synthetic',canonical,draft})).rejects.toThrow('/snapshot/optionCenter/sets/0/options/0/priceAdjustment');
    expect(fetcher).not.toHaveBeenCalled(); // Source guard only; no live server/native claim.
  });
  it.each(['0','0.00','-1.25','1.2','90071992547409.91','-90071992547409.91'])('preserves supported exact signed price %s without rounding or new policy',price=>{
    const result=patchFormalModifierOptionPrice(source(),'g1','o1',price);expect(optionPrice(result)).toBe(price);expect(catalogPrice(result)).toBe(price);
  });
  it.each([
    null,{}, {sets:null,productLinks:[]}, {sets:[],productLinks:[]},
    {sets:[{id:'g1',options:[]}],productLinks:[]},
    {sets:[{id:'g1',options:[{id:'o1',priceAdjustment:'5.00'}]},{id:'g1',options:[{id:'o1',priceAdjustment:'5.00'}]}],productLinks:[]},
    {sets:[{id:'g1',options:[{id:'o1',priceAdjustment:'5.00'},{id:'o1',priceAdjustment:'5.00'}]}],productLinks:[]},
  ])('rejects malformed/missing/ambiguous existing option-center targets without mutating the legacy copy',optionCenter=>{
    const input={...source(),optionCenter},before=structuredClone(input);expect(()=>patchFormalModifierOptionPrice(input,'g1','o1','6.50')).toThrow();expect(input).toEqual(before);
  });
  it('scopes duplicate option IDs to the selected set, never another set',()=>{
    const input=source() as any;input.catalog.modifierGroups[1].options[0].id='o1';input.optionCenter.sets[1].options[0].id='o1';
    const result=patchFormalModifierOptionPrice(input,'g1','o1','6.50') as any;
    expect(result.catalog.modifierGroups[1]).toEqual(input.catalog.modifierGroups[1]);expect(result.optionCenter.sets[1]).toEqual(input.optionCenter.sets[1]);
    expect(optionPrice(result)).toBe('6.50');expect(catalogPrice(result)).toBe('6.50');
  });
  it.each(['missing-catalog','malformed-groups','duplicate-group','duplicate-option','missing-target-price'])('rejects malformed legacy target %s without partial changes',kind=>{
    const input=source() as any;
    if(kind==='missing-catalog')delete input.catalog;
    if(kind==='malformed-groups')input.catalog.modifierGroups=null;
    if(kind==='duplicate-group')input.catalog.modifierGroups.push(structuredClone(input.catalog.modifierGroups[0]));
    if(kind==='duplicate-option')input.catalog.modifierGroups[0].options.push(structuredClone(input.catalog.modifierGroups[0].options[0]));
    if(kind==='missing-target-price')delete input.catalog.modifierGroups[0].options[0].priceAdjustment;
    const before=structuredClone(input);expect(()=>patchFormalModifierOptionPrice(input,'g1','o1','6.50')).toThrow();expect(input).toEqual(before);
  });
  it('does not fall back to stale legacy prices for malformed-present optionCenter',()=>{
    expect(readFormalCatalogPricing({...source(),optionCenter:null}).modifierGroups).toEqual([]);
    expect(readFormalCatalogPricing({...source(),optionCenter:{sets:'broken'}}).modifierGroups).toEqual([]);
  });
  it('captures both synchronized copies with their original optimistic revision during a concurrent refetch',async()=>{
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    const snapshot=source(),canonical=active(snapshot),client=new QueryClient({defaultOptions:{queries:{enabled:false}}});
    const current={schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,draftRevision:3,snapshot,updatedAt:canonical.publishedAt,updatedByStaffId:'owner'};
    const newer={...current,draftRevision:4,snapshot:patchFormalModifierOptionPrice(snapshot,'g1','o1','7.00')};
    client.setQueryData(v3FormalDraftQueryKey('MF01'),current);
    let formal!:ReturnType<typeof useV3FormalDraft>,tree:ReturnType<typeof create>;
    function Probe(){formal=useV3FormalDraft();return null;}
    await act(async()=>{tree=create(React.createElement(QueryClientProvider,{client},React.createElement(V3FormalDraftProvider,{storeId:'MF01',sessionToken:'synthetic',canonical},React.createElement(Probe))));});
    let request:any=null;
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init:RequestInit)=>{
      request=JSON.parse(String(init.body));return new Response(JSON.stringify({code:'ADMIN_DRAFT_REVISION_CONFLICT'}),{status:409});
    }));
    try{
      await act(async()=>{
        const pending=formal.mutateSnapshot(value=>patchFormalModifierOptionPrice(value,'g1','o1','6.50'));
        client.setQueryData(v3FormalDraftQueryKey('MF01'),newer);
        await expect(pending).rejects.toMatchObject({code:'ADMIN_DRAFT_REVISION_CONFLICT'});
      });
      expect(request.expectedDraftRevision).toBe(3);expect(optionPrice(request.snapshot)).toBe('6.50');expect(catalogPrice(request.snapshot)).toBe('6.50');
      expect(client.getQueryData(v3FormalDraftQueryKey('MF01'))).toEqual(newer);
    }finally{await act(async()=>tree!.unmount());client.clear();}
  });
  it('rejects stale set/link edit baselines without blocking unrelated-set updates',()=>{
    const original=source(),baseline=formalOptionSetEditBaseline(original,'g1'),draft={...readFormalOptionCenter(original).sets[0],name:'Name only'};
    const newer=patchFormalModifierOptionPrice(original,'g1','o1','6.50');
    expect(()=>replaceFormalOptionSet(newer,draft,['p1'],baseline)).toThrow('FORMAL_OPTION_SET_STALE');
    const changedLinks=structuredClone(original) as any;changedLinks.optionCenter.productLinks[0].defaultOptionIds=['o1'];
    expect(()=>replaceFormalOptionSet(changedLinks,draft,['p1'],baseline)).toThrow('FORMAL_OPTION_SET_STALE');
    const unrelated=patchFormalModifierOptionPrice(original,'g2','o3','3.00');
    expect(()=>replaceFormalOptionSet(unrelated,draft,['p1'],baseline)).not.toThrow();
  });
  it('blocks an already-open stale modifier form after cache refresh before save, without sending a PUT',async()=>{
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    const snapshot=source(),canonical=active(snapshot),client=new QueryClient({defaultOptions:{queries:{enabled:false}}});
    const current={schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,draftRevision:3,snapshot,updatedAt:canonical.publishedAt,updatedByStaffId:'owner'};
    const newer={...current,draftRevision:4,snapshot:patchFormalModifierOptionPrice(snapshot,'g1','o1','6.50')};
    client.setQueryData(v3FormalDraftQueryKey('MF01'),current);
    const fetcher=vi.fn(async(_url:RequestInfo|URL,init:RequestInit)=>new Response(JSON.stringify({...newer,draftRevision:5,snapshot:JSON.parse(String(init.body)).snapshot})));vi.stubGlobal('fetch',fetcher);
    let tree:ReturnType<typeof create>;
    await act(async()=>{tree=create(React.createElement(QueryClientProvider,{client},React.createElement(V3FormalDraftProvider,{storeId:'MF01',sessionToken:'synthetic',canonical},React.createElement(FormalModifiersPage))));});
    try{
      await act(async()=>tree!.root.findAllByType('button').find(button=>button.findAllByType('strong').some(label=>label.children.includes('Size')))!.props.onClick());
      await act(async()=>{client.setQueryData(v3FormalDraftQueryKey('MF01'),newer);await new Promise(resolve=>setTimeout(resolve,0));});
      await act(async()=>tree!.root.findByProps({role:'dialog'}).findAllByType('input').find(input=>input.props.value==='Size')!.props.onChange({target:{value:'Name only'}}));
      await act(async()=>{tree!.root.findByProps({role:'dialog'}).findAllByType('button').find(button=>button.children.includes('儲存正式草稿'))!.props.onClick();await new Promise(resolve=>setTimeout(resolve,0));});
      expect(fetcher).not.toHaveBeenCalled();expect(client.getQueryData(v3FormalDraftQueryKey('MF01'))).toEqual(newer);
      expect(JSON.stringify(tree!.toJSON())).toContain('關閉並重新開啟後再儲存');
    }finally{await act(async()=>tree!.unmount());client.clear();}
  });
  it.each([false,true])('refreshes pristine pricing inputs or blocks a dirty stale option-price save (dirty=%s)',async dirty=>{
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    const snapshot=source(),canonical=active(snapshot),client=new QueryClient({defaultOptions:{queries:{enabled:false}}});
    const current={schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,draftRevision:3,snapshot,updatedAt:canonical.publishedAt,updatedByStaffId:'owner'};
    const newer={...current,draftRevision:4,snapshot:patchFormalModifierOptionPrice(snapshot,'g1','o1','6.50')};
    client.setQueryData(v3FormalDraftQueryKey('MF01'),current);
    const fetcher=vi.fn(async(_url:RequestInfo|URL,init:RequestInit)=>new Response(JSON.stringify({...newer,draftRevision:5,snapshot:JSON.parse(String(init.body)).snapshot})));vi.stubGlobal('fetch',fetcher);
    let tree:ReturnType<typeof create>;
    await act(async()=>{tree=create(React.createElement(QueryClientProvider,{client},React.createElement(V3FormalDraftProvider,{storeId:'MF01',sessionToken:'synthetic',canonical},React.createElement(FormalPricingPage))));});
    try{
      await act(async()=>tree!.root.findAllByType('button').find(button=>button.children.includes('選項價格'))!.props.onClick());
      if(dirty)await act(async()=>tree!.root.findAllByType('article')[0].findByType('input').props.onChange({target:{value:'8.00'}}));
      await act(async()=>{client.setQueryData(v3FormalDraftQueryKey('MF01'),newer);await new Promise(resolve=>setTimeout(resolve,0));});
      const priceRow=tree!.root.findAllByType('article')[0];
      if(dirty){
        await act(async()=>{priceRow.findByType('button').props.onClick();await new Promise(resolve=>setTimeout(resolve,0));});
        expect(JSON.stringify(tree!.toJSON())).toContain('價格已被更新');
      }else expect(priceRow.findByType('input').props.value).toBe('6.50');
      expect(fetcher).not.toHaveBeenCalled();expect(client.getQueryData(v3FormalDraftQueryKey('MF01'))).toEqual(newer);
    }finally{await act(async()=>tree!.unmount());client.clear();}
  });
  it('keeps both prices through the existing revision-guarded draft save, later option edit, publish and canonical readback',async()=>{
    const canonical=active(source());let serverDraft:V3FormalAdminDraft|null=null,published=canonical;
    const requests:{url:string;method:string;body:Record<string,any>|null}[]=[];
    vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init:RequestInit)=>{
      const request={url:String(url),method:init.method??'GET',body:init.body?JSON.parse(String(init.body)):null};requests.push(request);
      if(request.method==='PUT'){
        if(serverDraft&&request.body!.expectedDraftRevision!==serverDraft.draftRevision)return new Response(JSON.stringify({code:'ADMIN_DRAFT_REVISION_CONFLICT'}),{status:409});
        serverDraft={schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,draftRevision:(serverDraft?.draftRevision??0)+1,snapshot:request.body!.snapshot,updatedAt:'2026-10-03T01:00:00.000Z',updatedByStaffId:'owner'};
        return new Response(JSON.stringify(serverDraft));
      }
      if(request.method==='POST'){
        if(request.body!.expectedDraftRevision!==serverDraft!.draftRevision)return new Response(JSON.stringify({code:'ADMIN_DRAFT_REVISION_CONFLICT'}),{status:409});
        published=createMfkAdminConfigEnvelope({storeId:'MF01',revision:28,publishedAt:'2026-10-03T01:00:00.000Z',adminFingerprint:'admin-28',snapshot:serverDraft!.snapshot});return new Response(JSON.stringify({state:'PUBLISHED'}));
      }
      return new Response(JSON.stringify(published));
    }));
    const first=await putV3FormalDraft({storeId:'MF01',sessionToken:'synthetic',canonical,currentDraft:null,snapshot:patchFormalModifierOptionPrice(canonical.snapshot as Record<string,unknown>,'g1','o1','6.50')});
    const center=readFormalOptionCenter(first.snapshot);
    const second=await putV3FormalDraft({storeId:'MF01',sessionToken:'synthetic',canonical,currentDraft:first,snapshot:replaceFormalOptionSet(first.snapshot,{...center.sets[0],name:'Renamed'},['p1'])});
    await expect(putV3FormalDraft({storeId:'MF01',sessionToken:'synthetic',canonical,currentDraft:first,snapshot:first.snapshot})).rejects.toMatchObject({code:'ADMIN_DRAFT_REVISION_CONFLICT'});
    await publishV3FormalDraft({storeId:'MF01',sessionToken:'synthetic',canonical,draft:second});
    const readback=await readV3CanonicalAdminActive({storeId:'MF01',sessionToken:'synthetic'});
    expect(optionPrice(readback.snapshot)).toBe('6.50');expect(catalogPrice(readback.snapshot)).toBe('6.50');expect(readback.revision).toBe(28);
    expect(readback.snapshot).toEqual(second.snapshot);expect(requests[1].body!.expectedDraftRevision).toBe(1);expect(requests[3].body!.expectedDraftRevision).toBe(2);
    expect(requests.map(x=>x.method)).toEqual(['PUT','PUT','PUT','POST','GET']);
  });
});
