import {describe,expect,it} from 'vitest';
import {formalProductEditBaseline,saveFormalProductOptions} from './formal-product-options.ts';
import {patchFormalModifierOptionPrice} from './formal-catalog.ts';
import {readFormalOptionCenter,replaceFormalOptionSet} from './formal-option-center.ts';

function fixture(){
  const sets=[{id:'g1',name:'Size',selection:'SINGLE',min:1,max:1,required:true,forceShow:true,allowQuantities:false,active:true,extension:null,options:[
    {id:'o1',code:'S',name:'Small',priceAdjustment:'0.00',active:true,position:20,defaultSelected:false,extension:{keep:1}},
    {id:'o2',code:'L',name:'Large',priceAdjustment:'2.50',active:true,position:10,defaultSelected:true},
  ]},{id:'g2',name:'Extras',selection:'MULTI',min:0,max:2,required:false,forceShow:false,allowQuantities:false,active:true,options:[
    {id:'o3',code:'X',name:'Extra',priceAdjustment:'-1.00',active:true,position:10},
    {id:'o4',code:'Y',name:'Other',priceAdjustment:'3.00',active:false,position:20},
  ]}];
  return {other:{keep:true},catalog:{categories:[{id:'cat',name:'Food',active:true,position:10}],products:[
    {id:'p1',productCode:'AUTO-1',name:'Product',categoryId:'cat',basePrice:'12.00',description:'',active:true,modifierGroupIds:['g1'],raw:{keep:true}},
    {id:'p2',name:'Other product',modifierGroupIds:['g2']},
  ],modifierGroups:structuredClone(sets).reverse(),raw:{keep:true}},optionCenter:{sets,productLinks:[
    {productId:'p2',setId:'g2',defaultOptionIds:['o3'],extension:'other'},
    {productId:'p1',setId:'g1',defaultOptionIds:['o2'],extension:{keep:true}},
  ],raw:{keep:true}}} as any;
}
const bindings=(s:any)=>readFormalOptionCenter(s).productLinks.filter(link=>link.productId==='p1').map(({setId,defaultOptionIds})=>({setId,defaultOptionIds}));
const save=(s:any,links=bindings(s),patch:any={},baseline=formalProductEditBaseline(s,'p1'))=>saveFormalProductOptions(s,'p1',patch,links,baseline) as any;

describe('product-local reusable bindings and defaults',()=>{
  it('keeps a no-op byte-for-byte and never mutates its source',()=>{const s=fixture(),copy=structuredClone(s);expect(save(s)).toEqual(s);expect(s).toEqual(copy);});
  it('saves basics, attaches a group and explicit defaults in the one returned snapshot',()=>{
    const s=fixture(),next=save(s,[...bindings(s),{setId:'g2',defaultOptionIds:['o3']}],{name:'Renamed'});
    expect(next.catalog.products[0]).toEqual({...s.catalog.products[0],name:'Renamed',modifierGroupIds:['g1','g2']});
    expect(next.optionCenter.productLinks).toEqual([...s.optionCenter.productLinks,{productId:'p1',setId:'g2',defaultOptionIds:['o3']}]);
    expect(next.optionCenter.sets).toEqual(s.optionCenter.sets);expect(next.catalog.modifierGroups).toEqual(s.catalog.modifierGroups);
    expect(next.other).toEqual(s.other);expect(s.catalog.products[0].name).toBe('Product');
  });
  it('detaches only the requested product binding and retains reusable definitions and other links',()=>{
    const s=fixture(),next=save(s,[]);expect(next.catalog.products[0].modifierGroupIds).toEqual([]);
    expect(next.optionCenter.productLinks).toEqual([s.optionCenter.productLinks[0]]);expect(next.optionCenter.sets).toEqual(s.optionCenter.sets);
  });
  it('selects or explicitly clears defaults without recommendations or first-option fallback',()=>{
    const s=fixture(),selected=save(s,[{setId:'g1',defaultOptionIds:['o1']}]);
    expect(selected.optionCenter.productLinks[1]).toEqual({...s.optionCenter.productLinks[1],defaultOptionIds:['o1']});
    expect(save(selected,[{setId:'g1',defaultOptionIds:[]}]).optionCenter.productLinks[1].defaultOptionIds).toEqual([]);
  });
  it('preserves default identity through central rename/reorder and later Pricing edits',()=>{
    const s=save(fixture(),[{setId:'g1',defaultOptionIds:['o1']}]);
    const group=readFormalOptionCenter(s).sets[0];group.name='New';group.options=group.options.reverse().map((option,i)=>({...option,name:'Renamed '+option.id,position:(i+1)*10}));
    const renamed=replaceFormalOptionSet(s,group,['p1']);
    const priced=patchFormalModifierOptionPrice(renamed,'g1','o1','9.75') as any;
    expect(bindings(priced)).toEqual([{setId:'g1',defaultOptionIds:['o1']}]);
    const next=save(priced,bindings(priced),{description:'Edited'});
    expect(next.optionCenter.sets[0].options.find((o:any)=>o.id==='o1').priceAdjustment).toBe('9.75');
    expect(next.optionCenter.productLinks[1].extension).toEqual({keep:true});
  });
  it('keeps legacy option absence and global defaults unchanged during a basics-only edit',()=>{
    const s=fixture();delete s.optionCenter;const next=save(s,bindings(s),{name:'Basic only'});
    expect(Object.hasOwn(next,'optionCenter')).toBe(false);expect(next.catalog.modifierGroups).toEqual(s.catalog.modifierGroups);
  });
  it('keeps absent options and product mirror absent during basic save',()=>{
    const s=fixture();delete s.optionCenter;delete s.catalog.modifierGroups;for(const p of s.catalog.products)delete p.modifierGroupIds;
    const next=save(s,[],{name:'Basic only'});expect(Object.hasOwn(next,'optionCenter')).toBe(false);expect(Object.hasOwn(next.catalog.products[0],'modifierGroupIds')).toBe(false);
  });
  it('retains raw optional fields, unrelated interleaving and mirror group order on changed defaults',()=>{
    const s=fixture();delete s.catalog.products[0].modifierGroupIds;delete s.optionCenter.sets[0].forceShow;
    delete s.catalog.modifierGroups[1].forceShow;
    const next=save(s,[{setId:'g1',defaultOptionIds:['o1']}]);
    expect(Object.hasOwn(next.catalog.products[0],'modifierGroupIds')).toBe(false);
    expect(next.catalog.modifierGroups.map((g:any)=>g.id)).toEqual(['g2','g1']);
    expect(next.optionCenter.sets).toEqual(s.optionCenter.sets);expect(next.optionCenter.productLinks[0]).toEqual(s.optionCenter.productLinks[0]);
  });
  it('preserves existing product mirror ordering when only defaults change',()=>{
    const s=fixture();s.catalog.products[0].modifierGroupIds=['g2','g1'];s.optionCenter.productLinks.push({productId:'p1',setId:'g2',defaultOptionIds:[]});
    const next=save(s,[{setId:'g1',defaultOptionIds:[]},{setId:'g2',defaultOptionIds:['o3']}]);expect(next.catalog.products[0].modifierGroupIds).toEqual(['g2','g1']);
  });
  it.each([
    [{setId:'missing',defaultOptionIds:[]}],
    [{setId:'g1',defaultOptionIds:['foreign']}],
    [{setId:'g1',defaultOptionIds:['o3']}],
    [{setId:'g1',defaultOptionIds:['o1','o2']}],
    [{setId:'g1',defaultOptionIds:['o1','o1']}],
    [{setId:'g1',defaultOptionIds:[]},{setId:'g1',defaultOptionIds:[]}],
    [{setId:'g2',defaultOptionIds:['o4']}],
  ])('blocks invalid, foreign, inactive, duplicate and excessive defaults: %j',links=>{
    const s=fixture(),copy=structuredClone(s);expect(()=>save(s,links)).toThrow();expect(s).toEqual(copy);
  });
  it('blocks inactive group attachment but preserves and permits detaching existing inactive links',()=>{
    const s=fixture();s.optionCenter.sets[1].active=false;s.catalog.modifierGroups[0].active=false;
    expect(()=>save(s,[...bindings(s),{setId:'g2',defaultOptionIds:[]}])).toThrow('FORMAL_PRODUCT_OPTION_UNAVAILABLE');
    s.optionCenter.sets[0].active=false;s.catalog.modifierGroups[1].active=false;expect(save(s)).toEqual(s);expect(save(s,[]).catalog.products[0].modifierGroupIds).toEqual([]);
  });
  it('does not enable quantity semantics, and preserves existing raw imported quantities during basic edits',()=>{
    const s=fixture();s.optionCenter.sets[1].allowQuantities=true;s.catalog.modifierGroups[0].allowQuantities=true;
    expect(()=>save(s,[...bindings(s),{setId:'g2',defaultOptionIds:[]}])).toThrow('FORMAL_PRODUCT_OPTION_QUANTITIES_UNSUPPORTED');
    s.catalog.products[0].modifierGroupIds.push('g2');s.optionCenter.productLinks.push({productId:'p1',setId:'g2',defaultOptionIds:['o3'],quantityExtension:{o3:2}});
    const next=save(s,bindings(s),{name:'Retained'});expect(next.optionCenter).toEqual(s.optionCenter);
    expect(()=>save(s,[{setId:'g1',defaultOptionIds:['o2']},{setId:'g2',defaultOptionIds:[]}])).toThrow('FORMAL_PRODUCT_OPTION_QUANTITIES_UNSUPPORTED');
  });
  it('blocks malformed raw source rather than reading a filtered partial view',()=>{
    const s=fixture();s.optionCenter.productLinks.push({productId:'missing',setId:'g1',defaultOptionIds:['o1']});
    expect(()=>save(s,[])).toThrow('/snapshot/optionCenter/productLinks/2/productId');
  });
  it.each(['price','product','defaults','rules','unknown'])('blocks stale edits after a relevant %s update',kind=>{
    const s=fixture(),baseline=formalProductEditBaseline(s,'p1');
    if(kind==='price'){s.optionCenter.sets[0].options[0].priceAdjustment='8.00';s.catalog.modifierGroups[1].options[0].priceAdjustment='8.00';}
    if(kind==='product')s.catalog.products[0].name='Concurrent';
    if(kind==='defaults')s.optionCenter.productLinks[1].defaultOptionIds=['o1'];
    if(kind==='rules')s.optionCenter.sets[0].name='Concurrent';
    if(kind==='unknown')s.optionCenter.productLinks[1].extension={updated:true};
    const copy=structuredClone(s);expect(()=>save(s,bindings(s),{name:'My old form'},baseline)).toThrow('FORMAL_PRODUCT_EDIT_STALE');expect(s).toEqual(copy);
  });
  it('merges onto current unrelated product/domain updates without overwriting them',()=>{
    const s=fixture(),baseline=formalProductEditBaseline(s,'p1');s.catalog.products[1].name='New other';s.other.new=true;
    const next=save(s,[{setId:'g1',defaultOptionIds:[]}],{name:'Mine'},baseline);expect(next.catalog.products[1].name).toBe('New other');expect(next.other.new).toBe(true);
  });
  it('refuses missing product identity without generating placeholders',()=>{
    const s=fixture();expect(()=>saveFormalProductOptions(s,'missing',{},[],formalProductEditBaseline(s,'missing'))).toThrow('FORMAL_PRODUCT_NOT_FOUND');expect(s.catalog.products).toHaveLength(2);
  });
});
