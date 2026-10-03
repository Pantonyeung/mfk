import {describe,expect,it} from 'vitest';
import {catalogProjection} from '../../integrations/v3-linked-test.ts';
import {formalProductEditBaseline,saveFormalProductOptions} from './formal-product-options.ts';
import {inspectFormalOptionReadiness} from './formal-option-readiness.ts';
import {applyLinkedOptionMirrorPlan,planLinkedOptionMirrors} from './linked-option-mirror-plan.ts';

function source():any{
  return {
    catalog:{categories:[{id:'c1',name:'Category',active:true}],products:[
      {id:'p1',name:'Linked',categoryId:'c1',basePrice:'18.00',active:true,modifierGroupIds:[],extra:{keep:false}},
      {id:'p2',name:'Unrelated',categoryId:'c1',basePrice:'18.00',active:true},
    ],modifierGroups:[],combos:[{id:'combo1',basePrice:'038.00'}],extra:{keep:[]}},
    optionCenter:{sets:[{id:'g1',name:'Extras',required:false,selection:'MULTI',min:0,max:2,allowQuantities:false,active:true,options:[
      {id:'o1',code:'A',name:'First',priceAdjustment:'01.00',active:true,position:20,extra:{keep:null}},
      {id:'o2',code:'B',name:'Second',priceAdjustment:'-1.50',active:true,position:10},
    ],extra:{keep:0}}],productLinks:[{productId:'p1',setId:'g1',defaultOptionIds:[],extra:{keep:''}}],extra:{keep:false}},
    logicalPrinters:[{id:'printer1',extra:{keep:0}}],storeSettings:{extra:{keep:null}},
  };
}
function mirrored():any{const s=source();s.catalog.modifierGroups=structuredClone(s.optionCenter.sets);s.catalog.products[0].modifierGroupIds=['g1'];return s;}
function diagnostics(s:any){return planLinkedOptionMirrors(s).diagnostics;}
function expectBlocked(s:any,code:string,path?:string){
  const before=JSON.stringify(s),plan=planLinkedOptionMirrors(s);
  expect(plan.state).toBe('BLOCKED');expect(plan.snapshot).toBeUndefined();expect(plan.changedPaths).toEqual([]);
  expect(plan.diagnostics).toContainEqual(expect.objectContaining({code,...(path?{path}:{})}));
  expect(JSON.stringify(s)).toBe(before);
}
const envelope=(snapshot:any)=>({snapshot,fingerprint:'comparison-only',revision:1,publishedAt:'2026-10-03T00:00:00Z'});

describe('pure linked mirror compatibility planning',()=>{
  it('repairs the live-shaped empty mirrors which block an unrelated price save without editing that price',()=>{
    const input=source(),before=structuredClone(input);
    expect(()=>saveFormalProductOptions(input,'p2',{basePrice:'20.00'},[],formalProductEditBaseline(input,'p2'))).toThrow('OPTION_BINDING_MIRROR_CONFLICT');
    const plan=planLinkedOptionMirrors(input);
    expect(plan.state).toBe('READY');expect(plan.baseline).toBe(JSON.stringify(input));
    expect(plan.summary).toEqual({canonicalSets:1,legacySets:0,bindingConflicts:1});
    expect(plan.changedPaths).toEqual(['/snapshot/catalog/modifierGroups/0','/snapshot/catalog/products/0/modifierGroupIds/0']);
    expect(plan.snapshot).toEqual({...input,catalog:{...input.catalog,modifierGroups:structuredClone(input.optionCenter.sets),products:[{...input.catalog.products[0],modifierGroupIds:['g1']},input.catalog.products[1]]}});
    expect(input).toEqual(before);
    for(const mode of ['EDIT_SOURCE','PUBLISH'] as const)expect(inspectFormalOptionReadiness(plan.snapshot!,mode).filter(i=>i.severity==='ERROR')).toEqual([]);
    const saved=saveFormalProductOptions(plan.snapshot!,'p2',{basePrice:'20.00'},[],formalProductEditBaseline(plan.snapshot!,'p2')) as any;
    expect(saved.catalog.products[1].basePrice).toBe('20.00');expect((plan.snapshot as any).catalog.products[1].basePrice).toBe('18.00');
    expect(catalogProjection(envelope(plan.snapshot))).toEqual(catalogProjection(envelope(input)));
  });
  it('preserves exact raw authority, per-product defaults, all extra fields and existing legacy-only metadata',()=>{
    const input=mirrored();input.optionCenter.productLinks[0].defaultOptionIds=['o2'];
    input.optionCenter.productLinks.push({productId:'p2',setId:'g1',defaultOptionIds:[]});
    input.extension={false:false,zero:0,empty:[],nested:{raw:'01.00'}};
    input.catalog.modifierGroups[0].extra={legacy:'keep'};
    const legacy=input.catalog.modifierGroups[0];legacy.name='Old';legacy.options.reverse();
    legacy.options[0].priceAdjustment='5.00';legacy.options[0].defaultSelected=true;legacy.options[0].position=876;
    const before=JSON.stringify(input.optionCenter),plan=planLinkedOptionMirrors(input),next=plan.snapshot as any;
    expect(plan.state).toBe('READY');expect(JSON.stringify(next.optionCenter)).toBe(before);expect(next.extension).toEqual(input.extension);
    expect(next.catalog.modifierGroups[0].extra).toEqual({legacy:'keep'});
    expect(next.catalog.modifierGroups[0].options.map((o:any)=>o.id)).toEqual(['o2','o1']);
    expect(next.catalog.modifierGroups[0].options[0]).toMatchObject({priceAdjustment:'-1.50',defaultSelected:true,position:876});
    expect(next.catalog.modifierGroups[0].options[1].priceAdjustment).toBe('01.00');
    expect(next.catalog.products[1]).not.toHaveProperty('modifierGroupIds');
    expect(plan.changedPaths).toEqual(['/snapshot/catalog/modifierGroups/0/name','/snapshot/catalog/modifierGroups/0/options/0/priceAdjustment']);
  });
  it('appends missing rows while retaining legacy order and authoritative raw fields',()=>{
    const input=mirrored(),g2=structuredClone(input.optionCenter.sets[0]);g2.id='g2';input.optionCenter.sets.push(g2);
    input.catalog.modifierGroups[0].options.shift();input.catalog.modifierGroups[0].options[0].defaultSelected=true;
    const plan=planLinkedOptionMirrors(input),next=plan.snapshot as any;
    expect(plan.state).toBe('READY');expect(next.catalog.modifierGroups.map((g:any)=>g.id)).toEqual(['g1','g2']);
    expect(next.catalog.modifierGroups[0].options.map((o:any)=>o.id)).toEqual(['o2','o1']);
    expect(next.catalog.modifierGroups[0].options[1]).toEqual(input.optionCenter.sets[0].options[0]);
    expect(plan.changedPaths).toEqual(['/snapshot/catalog/modifierGroups/0/options/1','/snapshot/catalog/modifierGroups/1']);
  });
  it('preserves optional absence versus explicit empty mirrors and empty versus absent authority',()=>{
    const absent=source();delete absent.catalog.modifierGroups;delete absent.catalog.products[0].modifierGroupIds;
    const plan=planLinkedOptionMirrors(absent);expect(plan.state).toBe('UNCHANGED');expect(plan.snapshot).toEqual(absent);
    expect(plan.snapshot!.catalog).not.toHaveProperty('modifierGroups');
    expect(planLinkedOptionMirrors(source()).state).toBe('READY');
    for(const input of [{catalog:{categories:[],products:[]}},{catalog:{categories:[],products:[]},optionCenter:{sets:[],productLinks:[]}}]){
      const result=planLinkedOptionMirrors(input);expect(result.state).toBe('UNCHANGED');expect(result.snapshot).toEqual(input);
    }
    const legacy=mirrored();delete legacy.optionCenter;expectBlocked(legacy,'OPTION_NATIVE_SOURCE_UNBOUND','/snapshot/optionCenter');
  });
  it('keeps membership-equivalent legacy order and adds only missing bindings',()=>{
    const input=mirrored(),g2=structuredClone(input.optionCenter.sets[0]);g2.id='g2';input.optionCenter.sets.push(g2);
    input.catalog.modifierGroups.unshift(structuredClone(g2));input.optionCenter.productLinks.push({productId:'p1',setId:'g2',defaultOptionIds:[]});
    input.catalog.products[0].modifierGroupIds=['g2','g1'];expect(planLinkedOptionMirrors(input).state).toBe('UNCHANGED');
    input.catalog.products[0].modifierGroupIds=['g2'];const plan=planLinkedOptionMirrors(input),next=plan.snapshot as any;
    expect(plan.state).toBe('READY');expect(next.catalog.products[0].modifierGroupIds).toEqual(['g2','g1']);
    expect(next.catalog.modifierGroups.map((g:any)=>g.id)).toEqual(['g2','g1']);
    expect(plan.changedPaths).toEqual(['/snapshot/catalog/products/0/modifierGroupIds/1']);
  });
  it.each(['set','option','binding'])('blocks unmatched legacy %s facts instead of deleting or promoting them',kind=>{
    const input=mirrored();
    if(kind==='set'){const legacy=structuredClone(input.catalog.modifierGroups[0]);legacy.id='legacy-g';input.catalog.modifierGroups.push(legacy);expectBlocked(input,'LINKED_MIRROR_LEGACY_SET_ORPHAN','/snapshot/catalog/modifierGroups/1');}
    if(kind==='option'){input.catalog.modifierGroups[0].options.push({id:'legacy-o',code:'X',name:'Legacy',priceAdjustment:'0.00',active:true});expectBlocked(input,'LINKED_MIRROR_LEGACY_OPTION_ORPHAN','/snapshot/catalog/modifierGroups/0/options/2');}
    if(kind==='binding'){input.optionCenter.productLinks=[];expectBlocked(input,'LINKED_MIRROR_LEGACY_BINDING_ORPHAN','/snapshot/catalog/products/0/modifierGroupIds/0');}
  });
  it('blocks optional field-presence deletion instead of silently dropping forceShow',()=>{
    const input=mirrored();input.catalog.modifierGroups[0].forceShow=false;
    expectBlocked(input,'LINKED_MIRROR_FIELD_PRESENCE_CONFLICT','/snapshot/catalog/modifierGroups/0/forceShow');
  });
  it('adds present authoritative optional fields without synthesizing absent ones',()=>{
    const input=mirrored();input.optionCenter.sets[0].forceShow=false;
    const plan=planLinkedOptionMirrors(input);expect(plan.state).toBe('READY');expect(plan.changedPaths).toEqual(['/snapshot/catalog/modifierGroups/0/forceShow']);
    expect((plan.snapshot as any).catalog.modifierGroups[0].forceShow).toBe(false);
  });
  it.each([
    ['center',(s:any)=>s.optionCenter=null,'OPTION_CENTER_INVALID','/snapshot/optionCenter'],
    ['sets',(s:any)=>s.optionCenter.sets={},'OPTION_ARRAY_REQUIRED','/snapshot/optionCenter/sets'],
    ['links',(s:any)=>s.optionCenter.productLinks=null,'OPTION_ARRAY_REQUIRED','/snapshot/optionCenter/productLinks'],
    ['defaults',(s:any)=>s.optionCenter.productLinks[0].defaultOptionIds=null,'OPTION_IDS_REQUIRED','/snapshot/optionCenter/productLinks/0/defaultOptionIds'],
    ['amount',(s:any)=>s.optionCenter.sets[0].options[0].priceAdjustment='1.000','OPTION_PRICE_INVALID','/snapshot/optionCenter/sets/0/options/0/priceAdjustment'],
    ['quantity',(s:any)=>s.optionCenter.sets[0].allowQuantities=true,'OPTION_QUANTITIES_UNSUPPORTED','/snapshot/optionCenter/sets/0/allowQuantities'],
    ['inactive default',(s:any)=>{s.optionCenter.productLinks[0].defaultOptionIds=['o1'];s.optionCenter.sets[0].options[0].active=false;},'OPTION_DEFAULT_INACTIVE','/snapshot/optionCenter/productLinks/0/defaultOptionIds/0'],
    ['status',(s:any)=>s.optionCenter.sets[0].options[0].priceStatus='PENDING','OPTION_PRICE_NOT_READY','/snapshot/optionCenter/sets/0/options/0/priceStatus'],
    ['duplicate set',(s:any)=>s.optionCenter.sets.push(structuredClone(s.optionCenter.sets[0])),'OPTION_ID_DUPLICATE','/snapshot/optionCenter/sets/1/id'],
    ['duplicate option',(s:any)=>s.optionCenter.sets[0].options.push(structuredClone(s.optionCenter.sets[0].options[0])),'OPTION_ID_DUPLICATE','/snapshot/optionCenter/sets/0/options/2/id'],
    ['duplicate link',(s:any)=>s.optionCenter.productLinks.push(structuredClone(s.optionCenter.productLinks[0])),'OPTION_LINK_DUPLICATE','/snapshot/optionCenter/productLinks/1'],
    ['duplicate product',(s:any)=>s.catalog.products.push(structuredClone(s.catalog.products[0])),'OPTION_ID_DUPLICATE','/snapshot/catalog/products/2/id'],
    ['legacy option list',(s:any)=>s.catalog.modifierGroups[0].options=null,'OPTION_ARRAY_REQUIRED','/snapshot/catalog/modifierGroups/0/options'],
    ['legacy duplicate set',(s:any)=>s.catalog.modifierGroups.push(structuredClone(s.catalog.modifierGroups[0])),'OPTION_ID_DUPLICATE','/snapshot/catalog/modifierGroups/1/id'],
    ['legacy duplicate option',(s:any)=>s.catalog.modifierGroups[0].options.push(structuredClone(s.catalog.modifierGroups[0].options[0])),'OPTION_ID_DUPLICATE','/snapshot/catalog/modifierGroups/0/options/2/id'],
    ['legacy duplicate bindings',(s:any)=>s.catalog.products[0].modifierGroupIds=['g1','g1'],'OPTION_ID_DUPLICATE','/snapshot/catalog/products/0/modifierGroupIds/1'],
    ['legacy malformed bindings',(s:any)=>s.catalog.products[0].modifierGroupIds=null,'OPTION_IDS_REQUIRED','/snapshot/catalog/products/0/modifierGroupIds'],
  ] as const)('blocks malformed or unsupported %s with exact readiness path',(_name,change,code,path)=>{const input=mirrored();change(input);expectBlocked(input,code,path);});
  it('fails closed when a malformed legacy option precedes a valid matched row',()=>{
    const input=mirrored();input.catalog.modifierGroups[0].options.unshift(null);
    expectBlocked(input,'OPTION_OBJECT_REQUIRED','/snapshot/catalog/modifierGroups/0/options/0');
  });
  it('blocks ambiguous duplicate legacy codes even when canonical codes would replace them',()=>{
    const input=mirrored();input.catalog.modifierGroups[0].options[1].code=' a ';
    expectBlocked(input,'OPTION_CODE_DUPLICATE','/snapshot/catalog/modifierGroups/0/options/1/code');
  });
  it('treats an empty present center as authority rather than falling back to legacy sets',()=>{
    const input=mirrored();input.optionCenter={sets:[],productLinks:[]};
    expectBlocked(input,'LINKED_MIRROR_LEGACY_SET_ORPHAN','/snapshot/catalog/modifierGroups/0');
    expect(input.optionCenter).toEqual({sets:[],productLinks:[]});
  });
  it('preserves unsupported legacy-only status instead of overwriting it from authority',()=>{
    const input=mirrored();input.catalog.modifierGroups[0].options[0].priceStatus='PENDING';input.catalog.modifierGroups[0].name='Old';
    expectBlocked(input,'OPTION_PRICE_NOT_READY','/snapshot/catalog/modifierGroups/0/options/0/priceStatus');
  });
  it.each([
    ['option amount',(s:any)=>s.catalog.modifierGroups[0].options[0].priceAdjustment={unmatchedLegacyFact:'preserve-me'},'OPTION_PRICE_INVALID','/snapshot/catalog/modifierGroups/0/options/0/priceAdjustment'],
    ['set name',(s:any)=>s.catalog.modifierGroups[0].name={unmatchedLegacyFact:'preserve-me'},'OPTION_TEXT_INVALID','/snapshot/catalog/modifierGroups/0/name'],
    ['set rule',(s:any)=>s.catalog.modifierGroups[0].required={unmatchedLegacyFact:'preserve-me'},'OPTION_BOOLEAN_INVALID','/snapshot/catalog/modifierGroups/0/required'],
  ] as const)('blocks malformed present legacy %s rather than erasing nested facts',(_name,change,code,path)=>{
    const input=mirrored();change(input);expectBlocked(input,code,path);
  });
  it('can add a missing required mirror scalar field without treating absence as malformed',()=>{
    const input=mirrored();delete input.catalog.modifierGroups[0].options[0].name;
    const plan=planLinkedOptionMirrors(input);expect(plan.state).toBe('READY');expect(plan.changedPaths).toEqual(['/snapshot/catalog/modifierGroups/0/options/0/name']);
  });
  it('reports safe known ID differences and original readiness codes even when the plan is READY',()=>{
    const input=source(),plan=planLinkedOptionMirrors(input);expect(plan.state).toBe('READY');
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({code:'OPTION_MIRROR_CONFLICT',path:'/snapshot/catalog/modifierGroups/0',ids:['g1']}));
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({code:'OPTION_BINDING_MIRROR_CONFLICT',path:'/snapshot/catalog/products/0/modifierGroupIds',ids:['p1','g1']}));
    const partial=mirrored();partial.catalog.modifierGroups[0].options.pop();
    expect(planLinkedOptionMirrors(partial).diagnostics).toContainEqual(expect.objectContaining({code:'OPTION_MIRROR_CONFLICT',path:'/snapshot/catalog/modifierGroups/0/options/1',ids:['g1','o2']}));
    expect(JSON.stringify(plan.diagnostics)).not.toContain('01.00');
  });
  it('does not repair unrelated historical product prices',()=>{
    const input=source();input.catalog.products[1].basePrice='1.000';const plan=planLinkedOptionMirrors(input);
    expect(plan.state).toBe('READY');expect((plan.snapshot as any).catalog.products[1].basePrice).toBe('1.000');
    expect(catalogProjection(envelope(plan.snapshot))).toEqual(catalogProjection(envelope(input)));
    expect(catalogProjection(envelope(plan.snapshot)).products[1].available).toBe(false);
  });
  it('does not expose extension values, unknown keys, or raw money in diagnostics',()=>{
    const input=source();input.optionCenter['secret-looking-key']={value:'PRIVATE-VALUE'};input.optionCenter.sets[0].options[0].priceAdjustment='PRIVATE-MONEY';
    const serialized=JSON.stringify(diagnostics(input));expect(serialized).not.toMatch(/PRIVATE|secret-looking-key|priceAdjustment.*PRIVATE/);
    expect(diagnostics(input)).toContainEqual(expect.objectContaining({code:'OPTION_PRICE_INVALID'}));
  });
  it('is deterministic, does not mutate deeply frozen inputs, and returns a detached candidate',()=>{
    const input=source(),before=structuredClone(input);
    const freeze=(x:any):any=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};freeze(input);
    const first=planLinkedOptionMirrors(input),second=planLinkedOptionMirrors(input);expect(first).toEqual(second);expect(input).toEqual(before);
    (first.snapshot as any).optionCenter.productLinks[0].defaultOptionIds.push('o1');expect(input.optionCenter.productLinks[0].defaultOptionIds).toEqual([]);
  });
  it('applies only a recomputed READY plan and rejects stale, blocked or unchanged inputs',()=>{
    const input=source(),plan=planLinkedOptionMirrors(input),next=applyLinkedOptionMirrorPlan(input,plan.baseline);
    expect(next).toEqual(plan.snapshot);expect(planLinkedOptionMirrors(next).state).toBe('UNCHANGED');
    input.catalog.products[1].basePrice='20.00';expect(()=>applyLinkedOptionMirrorPlan(input,plan.baseline)).toThrow('LINKED_MIRROR_PLAN_STALE');
    const invalid=source();invalid.optionCenter=null;expect(()=>applyLinkedOptionMirrorPlan(invalid,JSON.stringify(invalid))).toThrow('LINKED_MIRROR_PLAN_NOT_READY');
    expect(()=>applyLinkedOptionMirrorPlan(next,JSON.stringify(next))).toThrow('LINKED_MIRROR_PLAN_NOT_READY');
  });
  it.each([undefined,NaN,Infinity,()=>1])('blocks non-JSON facts rather than dropping or coercing them: %s',value=>{
    const input=source();input.extension=value;const plan=planLinkedOptionMirrors(input);expect(plan.state).toBe('BLOCKED');expect(plan.snapshot).toBeUndefined();expect(plan.diagnostics).toContainEqual(expect.objectContaining({code:'LINKED_MIRROR_JSON_INVALID',path:'/snapshot'}));
  });
});
