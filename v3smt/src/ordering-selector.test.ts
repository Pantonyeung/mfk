import {describe,expect,it} from 'vitest';

import {selectMfpOrderingCatalog} from './ordering-selector.ts';
import {
  fingerprintMfpSyncValue,
  projectionHashForMfpSyncEntities,
  type MfpSyncActiveProjection,
  type MfpSyncEntity,
} from './sync-port.ts';

const price=(factId:string,amountMinor:number)=>({factId,amountMinor,currency:'HKD',revision:'MENU-7'});
const entity=(entityType:string,entityId:string,payload:Record<string,unknown>):MfpSyncEntity=>({
  entityType,entityId,entityRevision:1,payload,payloadHash:fingerprintMfpSyncValue(payload),
});

function projection(...rows:MfpSyncEntity[]):MfpSyncActiveProjection{
  const entities=Object.freeze(Object.fromEntries(rows.map(row=>[`${row.entityType}:${row.entityId}`,row])));
  return Object.freeze({
    storeId:'MF01',port:'SMT',schemaVersion:1,appliedSeq:7,checkpointSeq:6,
    projectionHash:projectionHashForMfpSyncEntities(entities),entities,
    appliedAt:'2026-10-02T06:00:00.000Z',
  });
}

const category=(id:string,label:string,position:number,active=true)=>entity('CATEGORY',id,{label,position,active});
const optionSet=entity('OPTION_SET','sauce',{
  name:'醬汁',active:true,required:true,selection:'SINGLE',min:1,max:1,
  options:[
    {id:'normal',name:'正常',active:true,sellable:true,position:10,priceAdjustment:price('O:NORMAL',0)},
    {id:'less',name:'少醬',active:true,sellable:true,position:20,priceAdjustment:price('O:LESS',-100)},
  ],
});
const product=(id:string,categoryId='rice',active=true)=>entity('PRODUCT',id,{
  categoryId,name:id==='P1'?'招牌飯糰':'飲品',description:'即叫即製',imageUrl:'https://img.example/'+id+'.webp',
  active,sellable:true,priceReady:true,publishedUnitPrice:price(id+':BASE',3800),
  serviceModeAdjustments:{takeaway:price(id+':TAKEAWAY',100)},
  optionSets:[{optionSetId:'sauce',defaultOptionIds:['normal']}],
});

describe('MFP V3 A4 active-projection ordering selector',()=>{
  it('reads only the supplied A3 active projection and orders categories deterministically',()=>{
    const catalog=selectMfpOrderingCatalog(projection(
      category('drink','飲品',20),category('rice','飯糰',10),optionSet,product('P1'),
    ));
    expect(catalog?.source).toMatchObject({storeId:'MF01',appliedSeq:7,projectionHash:expect.any(String)});
    expect(catalog?.categories.map(row=>row.id)).toEqual(['rice','drink']);
    expect(catalog?.products[0]).toMatchObject({
      productId:'P1',name:'招牌飯糰',priceReady:true,sellable:true,imageUrl:'https://img.example/P1.webp',
      optionSets:[{id:'sauce',options:[{id:'normal',defaultSelected:true},{id:'less',defaultSelected:false}]}],
    });
  });

  it('excludes inactive products and products whose category is inactive or missing',()=>{
    const catalog=selectMfpOrderingCatalog(projection(
      category('rice','飯糰',10),category('hidden','隱藏',20,false),optionSet,
      product('P1','rice',false),product('P2','hidden'),product('P3','missing'),
    ));
    expect(catalog?.products).toEqual([]);
  });

  it('fails price facts closed instead of inventing a fallback price',()=>{
    const invalid=entity('PRODUCT','P1',{
      categoryId:'rice',name:'招牌飯糰',active:true,sellable:true,priceReady:true,
      publishedUnitPrice:{factId:'P1:BASE',amountMinor:'38.00',currency:'HKD',revision:'MENU-7'},
      optionSets:[],
    });
    const catalog=selectMfpOrderingCatalog(projection(category('rice','飯糰',10),invalid));
    expect(catalog?.products[0]).toMatchObject({priceReady:false,publishedUnitPrice:null});
  });

  it('returns no catalog and therefore no fake products when the active projection is missing',()=>{
    expect(selectMfpOrderingCatalog(null)).toBeNull();
  });
});
