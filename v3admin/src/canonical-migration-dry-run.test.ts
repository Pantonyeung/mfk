import {describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {inspectCanonicalMigration} from './canonical-migration-dry-run.ts';

// Synthetic extension of formal-option-center.test.ts and formal-catalog.test.ts, NOT live store data.
function snapshot():Record<string,any>{return {
  untouched:{'a/b~c':{keep:true}},
  catalog:{
    categories:[{id:'cat-a',name:'A',position:10,active:true,extra:'keep-a'}],
    products:[{id:'p1',name:'P1',productCode:'P1',categoryId:'cat-a',basePrice:'010.00',takeawayAdjustment:'-1.50',takeawaySurchargeEnabled:true,active:true,modifierGroupIds:['set-a'],extra:'keep-p1'}],
    modifierGroups:[{id:'set-a',name:'Size',required:false,forceShow:false,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,extra:'keep-set',options:[{id:'o1',code:'S',name:'Small',priceAdjustment:'0.00',active:true,defaultSelected:true,extra:'keep-o1'}]}],
    combos:[{id:'c1',name:'Combo',basePrice:'50.00',takeawayAdjustment:'2.00',active:true,sections:[{id:'section-1',choices:[{id:'choice-1',productId:'p1',priceAdjustment:'3.25'}]}],extra:'keep-c1'}],
    unknownCatalogField:{keep:true},
  },
  logicalPrinters:[{id:'kitchen',extra:'keep-printer'}],printRules:{routes:[{productId:'p1',printerId:'kitchen'}]},
  pricingPromotions:[{id:'promotion-1',amount:'2.50'}],storeSettings:{currency:'HKD'},
};}
function observation(data=snapshot(),revision=17){return {mode:'canonical' as const,endpoint:'https://canonical.example/api/admin-browser/active?storeId=MF01',envelope:createMfkAdminConfigEnvelope({storeId:'MF01',revision,publishedAt:'2026-10-01T04:00:00.000Z',adminFingerprint:'fixture-only',snapshot:data})};}
function inspect(data=snapshot()){const source=observation(data);return inspectCanonicalMigration({source,target:structuredClone(source)});}
function deepFreeze(value:any):any{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}

describe('non-mutating canonical migration dry run',()=>{
  it('classifies identical canonical observations as no copy required and records exact identity',()=>{
    const source=observation();const result=inspectCanonicalMigration({source,target:structuredClone(source)});
    expect(result.classification).toBe('NO_COPY_REQUIRED');
    expect(result.sourceIdentity).toMatchObject({storeId:'MF01',revision:17,publishedAt:source.envelope.publishedAt,fingerprint:source.envelope.fingerprint,endpoint:source.endpoint});
    expect(result.canonicalDiff).toEqual([]);expect(result.writePerformed).toBe(false);
  });
  it('adds only optionCenter in memory while preserving all IDs, prices, service adjustments, combos, print routes and unknown fields',()=>{
    const source=observation();const before=structuredClone(source);
    const result=inspectCanonicalMigration({source:deepFreeze(source),target:deepFreeze(structuredClone(source))});
    expect(result.projection.status).toBe('ADDITIVE_OPTION_CENTER');
    const proposed=result.projection.proposedSnapshot!;const {optionCenter,...originalFields}=proposed;
    expect(originalFields).toEqual(before.envelope.snapshot);
    expect(optionCenter).toMatchObject({sets:[{id:'set-a',extra:'keep-set',options:[{id:'o1',code:'S',priceAdjustment:'0.00',defaultSelected:true,extra:'keep-o1'}]}],productLinks:[{productId:'p1',setId:'set-a',defaultOptionIds:['o1']}]});
    expect(result.projection.diff.map(change=>change.path)).toEqual(['/optionCenter']);
    expect(source).toEqual(before);expect(proposed).not.toBe(source.envelope.snapshot);
    expect((proposed.catalog as any).products[0].basePrice).toBe('010.00');
  });
  it('is deterministic and idempotent when inspected again with an existing optionCenter',()=>{
    const first=inspect();expect(inspect()).toEqual(first);
    const second=inspect(first.projection.proposedSnapshot!);
    expect(second.projection.status).toBe('NO_CHANGE');expect(second.projection.diff).toEqual([]);
    expect(second.projection.proposedSnapshot).toEqual(first.projection.proposedSnapshot);
  });
  it('preserves existing per-product defaults and unknown center fields without remirroring catalog',()=>{
    const data=inspect().projection.proposedSnapshot! as any;
    data.optionCenter.productLinks[0].defaultOptionIds=[];
    data.optionCenter.productLinks[0].unknownLink={keep:true};data.optionCenter.unknownCenter={keep:true};
    const result=inspect(data);expect(result.projection.status).toBe('NO_CHANGE');expect(result.projection.proposedSnapshot).toEqual(data);
  });
  it('reports escaped field paths and exact facts but never chooses a conflicting target',()=>{
    const target=snapshot();target.catalog.products[0].basePrice='11.00';target.untouched['a/b~c'].keep=false;
    const result=inspectCanonicalMigration({source:observation(),target:observation(target)});
    expect(result.classification).toBe('CANONICAL_DIFF_REVIEW_REQUIRED');
    expect(result.canonicalDiff).toContainEqual({path:'/snapshot/catalog/products/0/basePrice',kind:'changed',before:'010.00',after:'11.00'});
    expect(result.canonicalDiff).toContainEqual({path:'/snapshot/untouched/a~1b~0c/keep',kind:'changed',before:true,after:false});
    expect(result.projection.proposedSnapshot).toBeNull();
  });
  it('does not use revision or timestamp as permission to overwrite',()=>{
    const result=inspectCanonicalMigration({source:observation(),target:observation(snapshot(),18)});
    expect(result.classification).toBe('CANONICAL_DIFF_REVIEW_REQUIRED');expect(result.projection.proposedSnapshot).toBeNull();
  });
  it.each(['preview','unverified'] as const)('does not mistake %s data for canonical data',mode=>{
    const result=inspectCanonicalMigration({source:observation(),target:{mode}});
    expect(result.classification).toBe(mode==='preview'?'PREVIEW_NOT_CANONICAL':'IDENTITY_UNVERIFIED');expect(result.projection.proposedSnapshot).toBeNull();
  });
  it.each(['missing','different','wrong-store','invalid-fingerprint'])('blocks partial or mismatched target evidence: %s',kind=>{
    const source=observation();const target:any=structuredClone(source);
    if(kind==='missing')delete target.endpoint;
    if(kind==='different')target.endpoint='https://other.example/api/admin-browser/active?storeId=MF01';
    if(kind==='wrong-store')target.envelope=createMfkAdminConfigEnvelope({...source.envelope,storeId:'MF02'});
    if(kind==='invalid-fingerprint')target.envelope.fingerprint='bad';
    const result=inspectCanonicalMigration({source,target});
    expect(result.classification).not.toBe('NO_COPY_REQUIRED');expect(result.projection.proposedSnapshot).toBeNull();expect(result.writePerformed).toBe(false);
  });
  it.each(['missing-price','missing-default','invalid-default','duplicate-option','dangling-set','duplicate-product','invalid-min','unsupported-center','multiple-defaults','infinite-price','overflow-price','scientific-price','fractional-bounds','fractional-position','unsafe-position','overflow-minor-units','sub-cent','unsafe-minor-units','extreme-cent-drift'])('blocks ambiguous source mappings: %s',kind=>{
    const data=snapshot();const group=data.catalog.modifierGroups[0];
    if(kind==='missing-price')delete group.options[0].priceAdjustment;
    if(kind==='missing-default')delete group.options[0].defaultSelected;
    if(kind==='invalid-default')group.options[0].defaultSelected='yes';
    if(kind==='duplicate-option')group.options.push({...group.options[0]});
    if(kind==='dangling-set')data.catalog.products[0].modifierGroupIds=['absent'];
    if(kind==='duplicate-product')data.catalog.products.push({...data.catalog.products[0]});
    if(kind==='invalid-min')group.min=-1;
    if(kind==='unsupported-center')data.optionCenter={options:[],groups:[],productLinks:[]};
    if(kind==='multiple-defaults')group.options.push({...group.options[0],id:'o2',code:'L'});
    if(kind==='infinite-price')group.options[0].priceAdjustment='Infinity';
    if(kind==='overflow-price')group.options[0].priceAdjustment='1e999';
    if(kind==='scientific-price')group.options[0].priceAdjustment='1e2';
    if(kind==='fractional-bounds'){group.selection='MULTI';group.min=0.5;group.max=1.5;}
    if(kind==='fractional-position')group.options[0].position=1.5;
    if(kind==='unsafe-position')group.options[0].position=Number.MAX_SAFE_INTEGER+1;
    if(kind==='overflow-minor-units')group.options[0].priceAdjustment='1'+'0'.repeat(308);
    if(kind==='sub-cent')group.options[0].priceAdjustment='0.001';
    if(kind==='unsafe-minor-units')group.options[0].priceAdjustment='9007199254740992.00';
    if(kind==='extreme-cent-drift')group.options[0].priceAdjustment='90071992547409.90';
    const before=structuredClone(data);const result=inspect(data);
    expect(result.projection.status).toBe('BLOCKED');expect(result.projection.issues.length).toBeGreaterThan(0);
    expect(result.projection.proposedSnapshot).toBeNull();expect(data).toEqual(before);
  });
  it.each(['price','position'])('also blocks unsupported %s in an existing canonical optionCenter',kind=>{
    const data=inspect().projection.proposedSnapshot! as any;
    if(kind==='price')data.optionCenter.sets[0].options[0].priceAdjustment='0.001';
    else data.optionCenter.sets[0].options[0].position=1.5;
    const result=inspect(data);expect(result.projection.status).toBe('BLOCKED');
    expect(result.projection.proposedSnapshot).toBeNull();
  });
  it.each(['010.00','0.29','1.000','-2.50'])('retains representable source price string %s exactly',price=>{
    const data=snapshot();data.catalog.modifierGroups[0].options[0].priceAdjustment=price;
    const result=inspect(data);expect(result.projection.status).toBe('ADDITIVE_OPTION_CENTER');
    expect((result.projection.proposedSnapshot as any).optionCenter.sets[0].options[0].priceAdjustment).toBe(price);
  });
  it('makes no service call and offers no partial proposal after failed target validation',()=>{
    const network=vi.fn(()=>{throw new Error('unexpected IO');});vi.stubGlobal('fetch',network);
    try{const source=deepFreeze(observation());const before=structuredClone(source);
      const result=inspectCanonicalMigration({source,target:{mode:'canonical',endpoint:source.endpoint,envelope:{}}});
      expect(result.classification).toBe('INVALID_CANONICAL');expect(result.projection.proposedSnapshot).toBeNull();
      expect(source).toEqual(before);expect(network).not.toHaveBeenCalled();
    }finally{vi.unstubAllGlobals();}
  });
});
