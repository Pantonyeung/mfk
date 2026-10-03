import {describe,expect,it} from 'vitest';
import {projectPrintSlip,type PrintSlipSourceLine} from './print-slip-projection.ts';

const categories=[{id:'riceball',name:'飯團'},{id:'rice',name:'飯餐'},{id:'drink',name:'飲品'}];
const line=(lineId:string,productId:string,categoryId:string,quantity:number,extra:Partial<PrintSlipSourceLine>={}):PrintSlipSourceLine=>({lineId,productId,productName:productId,categoryId,quantity,role:'PHYSICAL_ITEM',variantIdentity:'standard',configuration:{options:[],temperature:'normal',omissions:[],notes:''},isDrink:categoryId==='drink',...extra});
const scrambled=()=>[line('l1','豬扒肉燥飯','rice',1),line('l2','鹹蛋黃飯團','riceball',2),line('l3','手打檸檬茶','drink',2),line('l4','豬扒肉燥飯','rice',2),line('l5','吞拿魚飯團','riceball',1)];

describe('production and packing category/quantity projection',()=>{
  it('groups both detailed slips by canonical category order regardless entry order without changing line identity',()=>{
    for(const kind of ['PRODUCTION','PACKING'] as const){
      const lines=scrambled();
      const projected=projectPrintSlip({kind,categories,lines,quantitySummaryEnabled:true});
      expect(projected.groups.map(g=>g.categoryId)).toEqual(['riceball','rice','drink']);
      expect(projected.groups.flatMap(g=>g.lines.map(l=>l.lineId))).toEqual(['l2','l5','l1','l4','l3']);
      expect(projected.sourceLines).toEqual(lines);
      expect(projected.sourceLines).not.toBe(lines);
    }
  });

  it('gives packing category counts and production exact product counts with separate variant detail',()=>{
    const lines=scrambled();
    const packing=projectPrintSlip({kind:'PACKING',categories,lines,quantitySummaryEnabled:true});
    expect(packing.summary).toMatchObject({kind:'CATEGORY',categories:[{categoryId:'riceball',quantity:3},{categoryId:'rice',quantity:3},{categoryId:'drink',quantity:2}],drinksQuantity:2});
    const production=projectPrintSlip({kind:'PRODUCTION',categories,lines,quantitySummaryEnabled:true});
    expect(production.summary?.kind).toBe('PRODUCT');
    if(production.summary?.kind!=='PRODUCT')throw new Error('test setup');
    expect(production.summary.products.map(p=>[p.productId,p.quantity])).toEqual([['鹹蛋黃飯團',2],['吞拿魚飯團',1],['豬扒肉燥飯',3],['手打檸檬茶',2]]);
    expect(production.summary.products.find(p=>p.productId==='豬扒肉燥飯')?.variants[0].sourceLineIds).toEqual(['l1','l4']);
  });

  it('never merges variants by display name and preserves options, temperature, omissions and notes exactly',()=>{
    const lines=[line('a','drink-1','drink',1,{productName:'同名',variantIdentity:'hot',configuration:{temperature:'HOT',notes:' 少甜 ',omissions:['ice'],options:[{id:'sweet',value:'less'}]}}),line('b','drink-1','drink',2,{productName:'同名',variantIdentity:'cold',configuration:{temperature:'COLD',notes:'',omissions:[],options:[]}}),line('c','drink-2','drink',1,{productName:'同名'})];
    const result=projectPrintSlip({kind:'PRODUCTION',categories,lines,quantitySummaryEnabled:true});
    if(result.summary?.kind!=='PRODUCT')throw new Error('test setup');
    expect(result.summary.products).toHaveLength(2);
    expect(result.summary.products[0].variants.map(v=>[v.variantIdentity,v.quantity])).toEqual([['hot',1],['cold',2]]);
    expect(result.groups[0].lines[0].configuration).toEqual(lines[0].configuration);
    const inconsistent=[lines[0],{...lines[1],variantIdentity:'hot'}];
    expect(()=>projectPrintSlip({kind:'PRODUCTION',categories,lines:inconsistent,quantitySummaryEnabled:true})).toThrow('PRINT_SLIP_VARIANT_IDENTITY_CONFLICT');
  });

  it('uses explicit physical roles and effective quantities so combo parents and financial rows do not double count',()=>{
    const lines=[line('combo','combo','rice',2,{role:'COMBO_PARENT'}),line('food','food','rice',6,{parentLineId:'combo'}),line('drinks','tea','drink',2,{parentLineId:'combo'}),line('fee','delivery-fee','rice',1,{role:'NON_PHYSICAL'}),line('discount','discount','rice',1,{role:'NON_PHYSICAL'})];
    const result=projectPrintSlip({kind:'PACKING',categories,lines,quantitySummaryEnabled:true});
    expect(result.groups.flatMap(g=>g.lines.map(l=>l.lineId))).toEqual(['food','drinks']);
    expect(result.sourceLines.map(l=>l.lineId)).toEqual(['combo','food','drinks','fee','discount']);
    expect(result.excludedLineIds).toEqual(['combo','fee','discount']);
    expect(result.summary).toMatchObject({kind:'CATEGORY',categories:[{categoryId:'rice',quantity:6},{categoryId:'drink',quantity:2}]});
    expect(()=>projectPrintSlip({kind:'PACKING',categories,lines:[{...lines[1],role:undefined} as any],quantitySummaryEnabled:true})).toThrow('PRINT_SLIP_PHYSICAL_ROLE_REQUIRED');
    expect(()=>projectPrintSlip({kind:'PRODUCTION',categories,lines:[{...lines[1],variantIdentity:undefined} as any],quantitySummaryEnabled:true})).toThrow('PRINT_SLIP_VARIANT_ID_REQUIRED');
    expect(()=>projectPrintSlip({kind:'PACKING',categories,lines:[lines[0],{...lines[1],role:['PHYSICAL_ITEM']} as any],quantitySummaryEnabled:true})).toThrow('PRINT_SLIP_PHYSICAL_ROLE_REQUIRED');
  });

  it('retains unknown categories, freezes each job presentation and supports summary off without dropping details',()=>{
    const lines=[line('unknown','other','not-in-catalog',2),...scrambled()];
    const result=projectPrintSlip({kind:'PACKING',categories,lines,quantitySummaryEnabled:false});
    expect(result.groups.at(-1)).toMatchObject({categoryId:'not-in-catalog',categoryName:'未分類',unknownCategory:true});
    expect(result.groups.flatMap(g=>g.lines)).toHaveLength(lines.length);
    expect(result.summary).toBeNull();
    expect(result.quantitySummaryEnabled).toBe(false);
    (lines[0] as {productName:string}).productName='Renamed later';
    categories[0].name='Renamed category later';
    expect(result.sourceLines[0].productName).toBe('other');
    expect(result.groups[0].categoryName).toBe('飯團');
    expect(Object.isFrozen(result.groups[0].lines[0].configuration)).toBe(true);
    categories[0].name='飯團';
  });
});
