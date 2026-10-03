import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {createInitialFormalPosTenders} from './formal-pos-tenders.ts';
import {readFormalOptionCenter,replaceFormalOptionSet,writeFormalOptionCenter} from './formal-option-center.ts';
import {publishV3FormalDraft,putV3FormalDraft,V3FormalDraftProvider,v3FormalDraftQueryKey,type V3FormalAdminDraft} from './formal-draft.tsx';
import {FormalPublishPage} from './formal-publish-pages.tsx';
import {inspectFormalOptionReadiness,FORMAL_OPTION_SUPPORT} from './formal-option-readiness.ts';

function source():any{
  const set={id:'g1',name:'Size',selection:'MULTI',min:0,max:2,required:false,forceShow:false,allowQuantities:false,active:true,options:[
    {id:'o1',code:'L',name:'Large',priceAdjustment:'1.00',active:true,position:10,extension:{keep:false}},
    {id:'o2',code:'S',name:'Small',priceAdjustment:'0.00',active:true,position:20},
  ],extension:{keep:0}};
  return createInitialFormalPosTenders({catalog:{products:[{id:'p1',name:'P1',basePrice:'10.00',active:true,modifierGroupIds:['g1']}],modifierGroups:[structuredClone(set)]},optionCenter:{sets:[set],productLinks:[{productId:'p1',setId:'g1',defaultOptionIds:['o1'],extension:{keep:[]}}],extension:{keep:''}},extension:{keep:null}});
}
function context(snapshot:any){
  const canonical=createMfkAdminConfigEnvelope({storeId:'MF01',revision:27,publishedAt:'2026-10-03T00:00:00.000Z',adminFingerprint:'a27',snapshot});
  const draft:V3FormalAdminDraft={schema:'MFK_ADMIN_DRAFT_V1',storeId:'MF01',draftId:'d1',baseFingerprint:canonical.fingerprint,basePublishedAt:canonical.publishedAt,draftRevision:7,snapshot,updatedAt:canonical.publishedAt,updatedByStaffId:'owner'};
  return {storeId:'MF01',sessionToken:'synthetic',canonical,draft};
}
function rename(snapshot:any){
  const center=readFormalOptionCenter(snapshot);
  return replaceFormalOptionSet(snapshot,{...center.sets[0],name:'Renamed'},['p1']);
}
function page(ctx:ReturnType<typeof context>,client:QueryClient){return React.createElement(QueryClientProvider,{client},React.createElement(V3FormalDraftProvider,ctx,React.createElement(FormalPublishPage,{onNavigate:()=>{}})));}
function mockPublish(){const fetcher=vi.fn(async()=>new Response(JSON.stringify({state:'PUBLISHED'})));vi.stubGlobal('fetch',fetcher);return fetcher;}
afterEach(()=>vi.unstubAllGlobals());

describe('option readiness blocks raw-data loss and invalid publication',()=>{
  it.each([
    ['foreign set link',(s:any)=>s.optionCenter.productLinks.push({productId:'p1',setId:'missing',defaultOptionIds:[]}),'/snapshot/optionCenter/productLinks/1/setId'],
    ['blank product link',(s:any)=>s.optionCenter.productLinks.push({productId:'',setId:'g1',defaultOptionIds:[]}),'/snapshot/optionCenter/productLinks/1/productId'],
    ['malformed defaults',(s:any)=>s.optionCenter.productLinks[0].defaultOptionIds='o1','/snapshot/optionCenter/productLinks/0/defaultOptionIds'],
    ['coerced default',(s:any)=>s.optionCenter.productLinks[0].defaultOptionIds=[1],'/snapshot/optionCenter/productLinks/0/defaultOptionIds/0'],
    ['duplicate link',(s:any)=>s.optionCenter.productLinks.push(structuredClone(s.optionCenter.productLinks[0])),'/snapshot/optionCenter/productLinks/1'],
    ['coerced minimum',(s:any)=>s.optionCenter.sets[0].min='0','/snapshot/optionCenter/sets/0/min'],
    ['malformed option',(s:any)=>s.optionCenter.sets[0].options.push({name:'hidden'}),'/snapshot/optionCenter/sets/0/options/2/id'],
    ['malformed present center',(s:any)=>s.optionCenter=null,'/snapshot/optionCenter'],
  ] as const)('blocks %s before a name-only save filters or coerces it',(_name,change,path)=>{
    const input=source();change(input);const before=structuredClone(input);
    expect(()=>rename(input)).toThrow(path);expect(input).toEqual(before);
  });
  it('preserves absent optional fields, raw array order and nested extension data on unrelated rename',()=>{
    const input=source();delete input.optionCenter.sets[0].options[0].position;
    input.optionCenter.sets[0].options.reverse();input.catalog.modifierGroups[0].options.reverse();
    const before=structuredClone(input),expected=structuredClone(input);
    expected.optionCenter.sets[0].name='Renamed';expected.catalog.modifierGroups[0].name='Renamed';
    expect(rename(input)).toEqual(expected);expect(input).toEqual(before);
  });
  it('rejects foreign product references introduced by a writer without mutating source',()=>{
    const input=source(),state=readFormalOptionCenter(input),before=structuredClone(input);
    state.productLinks[0].productId='missing';expect(()=>writeFormalOptionCenter(input,state)).toThrow('/snapshot/optionCenter/productLinks/0/productId');expect(input).toEqual(before);
  });
  it.each(['1.000','1e2','+1.00','90071992547409.92'])('keeps historical %s in draft data but blocks publish before transport',async price=>{
    const input=source();input.optionCenter.sets[0].options[0].priceAdjustment=price;input.catalog.modifierGroups[0].options[0].priceAdjustment=price;
    const renamed=rename(input);expect((renamed as any).optionCenter.sets[0].options[0].priceAdjustment).toBe(price);
    const fetcher=mockPublish();await expect(publishV3FormalDraft(context(renamed))).rejects.toThrow('/snapshot/optionCenter/sets/0/options/0/priceAdjustment');expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ['price mirror',(s:any)=>s.catalog.modifierGroups[0].options[0].priceAdjustment='9.00','/snapshot/catalog/modifierGroups/0/options/0/priceAdjustment'],
    ['binding mirror',(s:any)=>s.catalog.products[0].modifierGroupIds=[],'/snapshot/catalog/products/0/modifierGroupIds'],
    ['duplicate default',(s:any)=>s.optionCenter.productLinks[0].defaultOptionIds=['o1','o1'],'/snapshot/optionCenter/productLinks/0/defaultOptionIds/1'],
    ['inactive default',(s:any)=>s.optionCenter.sets[0].options[0].active=false,'/snapshot/optionCenter/productLinks/0/defaultOptionIds/0'],
    ['foreign default',(s:any)=>s.optionCenter.productLinks[0].defaultOptionIds=['missing'],'/snapshot/optionCenter/productLinks/0/defaultOptionIds/0'],
    ['fractional bound',(s:any)=>s.optionCenter.sets[0].max=1.5,'/snapshot/optionCenter/sets/0/max'],
    ['native bound overflow',(s:any)=>s.optionCenter.sets[0].max=1000,'/snapshot/optionCenter/sets/0/max'],
    ['unsupported quantities',(s:any)=>s.optionCenter.sets[0].allowQuantities=true,'/snapshot/optionCenter/sets/0/allowQuantities'],
    ['unbound legacy options',(s:any)=>delete s.optionCenter,'/snapshot/optionCenter'],
  ] as const)('blocks %s with exact field path before publication',async(_name,change,path)=>{
    const input=source();change(input);const before=structuredClone(input),fetcher=mockPublish();
    await expect(publishV3FormalDraft(context(input))).rejects.toThrow(path);expect(fetcher).not.toHaveBeenCalled();expect(input).toEqual(before);
  });
  it('allows explicit empty defaults for required choices without inventing a default',async()=>{
    const input=source();for(const set of [input.optionCenter.sets[0],input.catalog.modifierGroups[0]]){set.required=true;set.min=1;}
    input.optionCenter.productLinks[0].defaultOptionIds=[];
    const fetcher=mockPublish();await publishV3FormalDraft(context(input));expect(fetcher).toHaveBeenCalledTimes(1);expect(input.optionCenter.productLinks[0].defaultOptionIds).toEqual([]);
  });
  it('preserves the existing publish request and revision CAS after a valid preflight',async()=>{
    const input=source(),before=structuredClone(input),fetcher=mockPublish();await publishV3FormalDraft(context(input));
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({draftId:'d1',expectedDraftRevision:7});expect(input).toEqual(before);
  });
  it('keeps the draft save/repair seam available for unchanged historic invalid money',async()=>{
    const input=source();input.optionCenter.sets[0].options[0].priceAdjustment='1.000';input.catalog.modifierGroups[0].options[0].priceAdjustment='1.000';
    const ctx=context(input),fetcher=vi.fn(async()=>new Response(JSON.stringify(ctx.draft)));vi.stubGlobal('fetch',fetcher);
    await putV3FormalDraft({...ctx,currentDraft:ctx.draft,snapshot:input});expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).snapshot).toEqual(input);
  });
  it('shows source-only field errors and disables the review action for invalid option data',()=>{
    const input=source();input.optionCenter.productLinks[0].defaultOptionIds=['missing'];const ctx=context(input),client=new QueryClient({defaultOptions:{queries:{enabled:false}}});client.setQueryData(v3FormalDraftQueryKey('MF01'),ctx.draft);
    const html=renderToStaticMarkup(page(ctx,client));
    expect(html).toContain('/snapshot/optionCenter/productLinks/0/defaultOptionIds/0');expect(html).toContain('來源資料檢查');expect(html).toMatch(/disabled=""[^>]*>檢查變更影響/);client.clear();
  });
  it('rechecks refreshed invalid draft after review without permitting a publish click',async()=>{
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const input=source(),ctx=context(input),fetcher=mockPublish(),client=new QueryClient({defaultOptions:{queries:{enabled:false}}});client.setQueryData(v3FormalDraftQueryKey('MF01'),ctx.draft);
    let tree:ReturnType<typeof create>;await act(async()=>{tree=create(page(ctx,client));});
    try{
      await act(async()=>tree!.root.findAllByType('button').find(b=>b.children.includes('檢查變更影響'))!.props.onClick());
      const next=structuredClone(input);next.optionCenter.productLinks[0].defaultOptionIds=['missing'];
      await act(async()=>{client.setQueryData(v3FormalDraftQueryKey('MF01'),{...ctx.draft,draftRevision:8,snapshot:next});await new Promise(r=>setTimeout(r,0));});
      expect(tree!.root.findAllByType('button').find(b=>b.children.includes('確認正式發佈'))!.props.disabled).toBe(true);expect(fetcher).not.toHaveBeenCalled();
    }finally{await act(async()=>tree!.unmount());client.clear();}
  });
});

describe('explicit option support and preservation inventory',()=>{
  it('reports unknown fields at escaped paths without inspecting unrelated private domains or mutating data',()=>{
    const input=source();input.optionCenter['a/b~c']={privateValue:'must-not-leak'};input.staff={secret:'must-not-leak'};const before=structuredClone(input);
    const issues=inspectFormalOptionReadiness(input);
    expect(issues.filter(i=>i.severity==='ERROR')).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({path:'/snapshot/optionCenter/a~1b~0c',code:'OPTION_EXTENSION_UNVALIDATED',severity:'WARNING'}));
    expect(JSON.stringify(issues)).not.toContain('must-not-leak');expect(input).toEqual(before);
    expect(FORMAL_OPTION_SUPPORT.extensionPolicy).toBe('PRESERVE_AND_REPORT_UNVALIDATED');
  });
  it.each([
    ['missing min',(s:any)=>delete s.optionCenter.sets[0].min,'/snapshot/optionCenter/sets/0/min'],
    ['null boolean',(s:any)=>s.optionCenter.sets[0].required=null,'/snapshot/optionCenter/sets/0/required'],
    ['array selection',(s:any)=>s.optionCenter.sets[0].selection=['MULTI'],'/snapshot/optionCenter/sets/0/selection'],
    ['negative bound',(s:any)=>s.optionCenter.sets[0].min=-1,'/snapshot/optionCenter/sets/0/min'],
    ['empty option id',(s:any)=>s.optionCenter.sets[0].options[0].id='','/snapshot/optionCenter/sets/0/options/0/id'],
    ['duplicate set',(s:any)=>s.optionCenter.sets.push(structuredClone(s.optionCenter.sets[0])),'/snapshot/optionCenter/sets/1/id'],
    ['duplicate option',(s:any)=>s.optionCenter.sets[0].options.push(structuredClone(s.optionCenter.sets[0].options[0])),'/snapshot/optionCenter/sets/0/options/2/id'],
    ['duplicate code',(s:any)=>s.optionCenter.sets[0].options[1].code=' l ','/snapshot/optionCenter/sets/0/options/1/code'],
    ['foreign product',(s:any)=>s.optionCenter.productLinks[0].productId='missing','/snapshot/optionCenter/productLinks/0/productId'],
    ['duplicate product',(s:any)=>s.catalog.products.push(structuredClone(s.catalog.products[0])),'/snapshot/catalog/products/1/id'],
    ['default over max',(s:any)=>s.optionCenter.sets[0].max=0,'/snapshot/optionCenter/productLinks/0/defaultOptionIds'],
    ['inactive group',(s:any)=>s.optionCenter.sets[0].active=false,'/snapshot/optionCenter/productLinks/0/setId'],
    ['single max',(s:any)=>s.optionCenter.sets[0].selection='SINGLE','/snapshot/optionCenter/sets/0/max'],
    ['required zero',(s:any)=>s.optionCenter.sets[0].required=true,'/snapshot/optionCenter/sets/0/min'],
    ['missing linked source',(s:any)=>delete s.optionCenter,'/snapshot/optionCenter'],
    ['malformed group ids',(s:any)=>s.catalog.products[0].modifierGroupIds=null,'/snapshot/catalog/products/0/modifierGroupIds'],
    ['malformed legacy mirror',(s:any)=>s.catalog.modifierGroups='broken','/snapshot/catalog/modifierGroups'],
  ] as const)('reports %s without normalizing it',(_name,change,path)=>{
    const input=source();change(input);const before=structuredClone(input);
    expect(inspectFormalOptionReadiness(input)).toContainEqual(expect.objectContaining({path,severity:'ERROR'}));expect(input).toEqual(before);
  });
  it('does not require optional option sections for products without bindings',()=>{
    const input={catalog:{products:[{id:'p1',modifierGroupIds:[]}]}};expect(inspectFormalOptionReadiness(input)).toEqual([]);
    expect(inspectFormalOptionReadiness({catalog:{products:[]}})).toEqual([]);
  });
  it('retains missing versus false, zero, empty and unknown fields on a no-op edit',()=>{
    const input=source();delete input.optionCenter.sets[0].forceShow;delete input.catalog.modifierGroups[0].forceShow;
    delete input.optionCenter.sets[0].options[0].position;delete input.catalog.modifierGroups[0].options[0].position;
    input.catalog.products.push({id:'p2',active:false});const before=structuredClone(input);
    expect(writeFormalOptionCenter(input,readFormalOptionCenter(input))).toEqual(before);expect(input).toEqual(before);
  });
  it('keeps binding mirror order on unrelated edits when its membership is unchanged',()=>{
    const input=source();const g2=structuredClone(input.optionCenter.sets[0]);g2.id='g2';input.optionCenter.sets.push(g2);input.catalog.modifierGroups.push(structuredClone(g2));
    input.optionCenter.productLinks.push({productId:'p1',setId:'g2',defaultOptionIds:[]});input.catalog.products[0].modifierGroupIds=['g2','g1'];
    expect((rename(input) as any).catalog.products[0].modifierGroupIds).toEqual(['g2','g1']);
  });
  it('keeps absent optional mirror and empty product collection absent on unrelated edits',()=>{
    const input=source();delete input.catalog.modifierGroups;delete input.catalog.products;input.optionCenter.productLinks=[];
    const center=readFormalOptionCenter(input),next=writeFormalOptionCenter(input,{...center,sets:[{...center.sets[0],name:'Renamed'}]});
    expect(Object.hasOwn((next as any).catalog,'modifierGroups')).toBe(false);expect(Object.hasOwn((next as any).catalog,'products')).toBe(false);
  });
});

describe('compatibility mirror identity preservation',()=>{
  it.each(['extra set','extra option','missing option'])('blocks a name-only edit when the mirror has %s rather than deleting unmatched facts',kind=>{
    const input=source();
    if(kind==='extra set'){const extra=structuredClone(input.catalog.modifierGroups[0]);extra.id='hidden';input.catalog.modifierGroups.push(extra);}
    if(kind==='extra option'){const extra=structuredClone(input.catalog.modifierGroups[0].options[0]);extra.id='hidden';extra.code='H';input.catalog.modifierGroups[0].options.push(extra);}
    if(kind==='missing option')input.catalog.modifierGroups[0].options.pop();
    const before=structuredClone(input);expect(()=>rename(input)).toThrow('/snapshot/catalog/modifierGroups');expect(input).toEqual(before);
  });
});

describe('independent review regressions for native option readiness',()=>{
  it('blocks an unrelated save when a valid legacy binding has no authoritative link',()=>{
    const input=source(),g2=structuredClone(input.optionCenter.sets[0]);g2.id='g2';input.optionCenter.sets.push(g2);input.catalog.modifierGroups.push(structuredClone(g2));input.catalog.products[0].modifierGroupIds.push('g2');
    const before=structuredClone(input);expect(()=>rename(input)).toThrow('/snapshot/catalog/products/0/modifierGroupIds');expect(input).toEqual(before);
  });
  it.each([' leading','trailing ','bad\u0001id','bad\u0085id','x'.repeat(161)])('blocks native-invalid option identity %j before publication without rewriting it',async id=>{
    const input=source();input.optionCenter.sets[0].options[0].id=id;input.catalog.modifierGroups[0].options[0].id=id;input.optionCenter.productLinks[0].defaultOptionIds=[id];const before=structuredClone(input),fetcher=mockPublish();
    await expect(publishV3FormalDraft(context(input))).rejects.toThrow('/snapshot/optionCenter/sets/0/options/0/id');expect(fetcher).not.toHaveBeenCalled();expect(input).toEqual(before);
  });
  it.each(['sets','options','links','defaults','productGroups','products'])('blocks native array limit for %s without truncation',kind=>{
    const input=source();
    if(kind==='sets')for(let n=1;n<=1000;n++){const set=structuredClone(input.optionCenter.sets[0]);set.id='g'+(n+1);input.optionCenter.sets.push(set);input.catalog.modifierGroups.push(structuredClone(set));}
    if(kind==='options')for(let n=2;n<=1000;n++){const option={id:'o'+(n+1),code:'C'+n,name:'Choice',priceAdjustment:'0.00',active:true};input.optionCenter.sets[0].options.push(option);input.catalog.modifierGroups[0].options.push({...option});}
    if(kind==='links')for(let n=1;n<=1000;n++)input.optionCenter.productLinks.push({productId:'p'+(n+1),setId:'g1',defaultOptionIds:[]});
    if(kind==='defaults')input.optionCenter.productLinks[0].defaultOptionIds=Array.from({length:1001},(_,n)=>'o'+n);
    if(kind==='productGroups')input.catalog.products[0].modifierGroupIds=Array.from({length:1001},(_,n)=>'g'+n);
    if(kind==='products')for(let n=1;n<=1000;n++)input.catalog.products.push({id:'p'+(n+1)});
    const before=structuredClone(input);expect(inspectFormalOptionReadiness(input).some(i=>i.code==='OPTION_NATIVE_ARRAY_LIMIT')).toBe(true);expect(input).toEqual(before);
  });
  it.each(['OWNER_VALUE_REQUIRED','PENDING',null])('preserves unsupported priceStatus %s in drafts and blocks publication',async priceStatus=>{
    const input=source();input.optionCenter.sets[0].options[0].priceStatus=priceStatus;input.catalog.modifierGroups[0].options[0].priceStatus=priceStatus;
    const updated=rename(input),fetcher=mockPublish();expect((updated as any).optionCenter.sets[0].options[0].priceStatus).toBe(priceStatus);
    await expect(publishV3FormalDraft(context(updated))).rejects.toThrow('/snapshot/optionCenter/sets/0/options/0/priceStatus');expect(fetcher).not.toHaveBeenCalled();
  });
  it('accepts exact native limits and explicit READY status without changing values',()=>{
    const input=source();const id='x'.repeat(160);input.optionCenter.sets[0].options[0].id=id;input.catalog.modifierGroups[0].options[0].id=id;input.optionCenter.productLinks[0].defaultOptionIds=[id];
    input.optionCenter.sets[0].options[0].priceStatus='READY';input.catalog.modifierGroups[0].options[0].priceStatus='READY';
    for(let n=2;n<1000;n++){const option={id:'o'+(n+1),code:'C'+n,name:'Choice',priceAdjustment:'0.00',active:true};input.optionCenter.sets[0].options.push(option);input.catalog.modifierGroups[0].options.push({...option});}
    expect(inspectFormalOptionReadiness(input).filter(i=>i.severity==='ERROR')).toEqual([]);
  });
});

describe('independent review ordering preservation',()=>{
  it('retains legacy group array order on a no-op or name-only edit',()=>{
    const input=source(),g2=structuredClone(input.optionCenter.sets[0]);g2.id='g2';input.optionCenter.sets.push(g2);input.catalog.modifierGroups.unshift(structuredClone(g2));
    input.optionCenter.productLinks.push({productId:'p1',setId:'g2',defaultOptionIds:[]});input.catalog.products[0].modifierGroupIds.push('g2');const before=structuredClone(input);
    expect(writeFormalOptionCenter(input,readFormalOptionCenter(input))).toEqual(before);expect((rename(input) as any).catalog.modifierGroups.map((g:any)=>g.id)).toEqual(['g2','g1']);
  });
  it('does not synthesize an optional product group mirror for existing authoritative links',()=>{
    const input=source();delete input.catalog.products[0].modifierGroupIds;const before=structuredClone(input);
    expect(writeFormalOptionCenter(input,readFormalOptionCenter(input))).toEqual(before);
  });
});

describe('static option cardinality feasibility',()=>{
  it.each([{min:2,secondActive:false},{min:3,secondActive:true}])('preserves but blocks a linked minimum no selection can satisfy: %j',async({min,secondActive})=>{
    const input=source();for(const set of [input.optionCenter.sets[0],input.catalog.modifierGroups[0]]){set.required=true;set.min=min;set.max=min;set.options[1].active=secondActive;}input.optionCenter.productLinks[0].defaultOptionIds=[];
    const saved=rename(input),fetcher=mockPublish();expect((saved as any).optionCenter.sets[0]).toEqual({...input.optionCenter.sets[0],name:'Renamed'});
    const issues=inspectFormalOptionReadiness(saved);expect(issues).toContainEqual(expect.objectContaining({path:'/snapshot/optionCenter/sets/0/min',code:'OPTION_MIN_UNSATISFIABLE',severity:'ERROR'}));
    expect(issues.some(i=>i.code==='OPTION_SELECTION_REQUIRED')).toBe(false);
    await expect(publishV3FormalDraft(context(saved))).rejects.toThrow('/snapshot/optionCenter/sets/0/min');expect(fetcher).not.toHaveBeenCalled();
  });
  it('retains the empty-default warning when enough active choices satisfy the minimum',()=>{
    const input=source();for(const set of [input.optionCenter.sets[0],input.catalog.modifierGroups[0]]){set.required=true;set.min=2;set.max=2;}input.optionCenter.productLinks[0].defaultOptionIds=[];
    const issues=inspectFormalOptionReadiness(input);expect(issues.filter(i=>i.severity==='ERROR')).toEqual([]);expect(issues).toContainEqual(expect.objectContaining({code:'OPTION_SELECTION_REQUIRED',severity:'WARNING'}));
  });
});

it('shows truthful source-only scope on a clean draft without implying proven server enforcement',()=>{
  const input=source();delete input.optionCenter.extension;delete input.optionCenter.productLinks[0].extension;
  for(const set of [input.optionCenter.sets[0],input.catalog.modifierGroups[0]]){delete set.extension;delete set.options[0].extension;}
  expect(inspectFormalOptionReadiness(input)).toEqual([]);
  const ctx=context(input),client=new QueryClient({defaultOptions:{queries:{enabled:false}}});client.setQueryData(v3FormalDraftQueryKey('MF01'),ctx.draft);
  const html=renderToStaticMarkup(page(ctx,client));
  expect(html).toContain('未證明伺服器驗證');expect(html).not.toContain('server publish-grade validation');expect(html).not.toContain('publish-grade config validation');client.clear();
});
