import {describe,expect,it} from 'vitest';
import {buildKeetaSyncEntities,diffMfkSyncEntities} from '../../sync/checkpointed-delta-sync.ts';
import {executeKeetaProviderMutationPlan,planKeetaProviderMutations} from '../keeta-provider-mutation.ts';

const at='2026-10-01T14:00:00.000Z';

function menu(input:{
  categories?:Array<Record<string,unknown>>;
  groups?:Array<Record<string,unknown>>;
  spus?:Array<Record<string,unknown>>;
}={}){
  const categories=input.categories??[{openItemCode:'CAT:1',name:'飯糰',type:0,sourceLanguageType:'zh-HK'}];
  const groups=input.groups??[];
  const spus=input.spus??[{openItemCode:'SPU:1',name:'紫米飯糰',status:1,shopCategoryOpenItemCodeList:['CAT:1'],skuList:[{openItemCode:'SKU:1',price:'48.00',choiceGroupOpenItemCodeList:[]}]}];
  return {
    shopCategoryList:categories,
    choiceGroupList:groups,
    spuList:spus,
    spuSequenceCodeMap:Object.fromEntries(categories.map(category=>[
      String(category.openItemCode),
      spus.filter(spu=>(spu.shopCategoryOpenItemCodeList as string[]).includes(String(category.openItemCode))).map(spu=>String(spu.openItemCode)),
    ])),
  };
}

function planned(before:ReturnType<typeof menu>,after:ReturnType<typeof menu>,startingPortSeq=0){
  const previous=buildKeetaSyncEntities(before);
  const currentEntities=buildKeetaSyncEntities(after);
  const diff=diffMfkSyncEntities({
    storeId:'MF01',port:'KEETA',sourceCommitSeq:22,commitId:'MFK-COMMIT-22',startingPortSeq,
    previous,next:currentEntities,createdAt:at,
  });
  const batch={
    schema:'MFK_SYNC_CHANGE_BATCH_V1',protocol:'MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL_V1',
    storeId:'MF01',port:'KEETA',fromExclusive:startingPortSeq,toInclusive:diff.headSeq,
    headSeq:diff.headSeq,journalFloorSeq:1,changes:diff.changes,observedAt:at,
  };
  return {providerPlan:planKeetaProviderMutations({batch,currentEntities}),currentEntities,batch};
}

function plan(before:ReturnType<typeof menu>,after:ReturnType<typeof menu>,startingPortSeq=0){
  return planned(before,after,startingPortSeq).providerPlan;
}

function memoryStorage(status:Record<string,unknown>){
  const values=new Map<string,unknown>([['provider:mutation:status',status]]);
  return {values,storage:{
    get:async(key:string)=>values.get(key),
    put:async(key:string,value:unknown)=>{values.set(key,value);},
  }};
}

describe('Keeta Provider Minimum Mutation plan',()=>{
  it('maps a single Product price change to one SPU mutation and no Category traffic',()=>{
    const before=menu();
    const after=menu({spus:[{...before.spuList[0],skuList:[{openItemCode:'SKU:1',price:'52.00',choiceGroupOpenItemCodeList:[]}]}]});
    const result=plan(before,after,41);
    expect(result.mutations.map(row=>[row.kind,row.entityId])).toEqual([['SPU_UPSERT','SPU:1']]);
    expect(result.mutations[0]?.providerOperation).toMatchObject({
      readback:'/product/spu/list',create:'/product/spu/batchcreate',update:'/product/spu/batchupdate',
    });
  });

  it('orders a new Category before its new Product',()=>{
    const before=menu();
    const after=menu({
      categories:[...before.shopCategoryList,{openItemCode:'CAT:9',name:'飲品',type:0,sourceLanguageType:'zh-HK'}],
      spus:[...before.spuList,{openItemCode:'SPU:456',name:'檸茶',status:1,shopCategoryOpenItemCodeList:['CAT:9'],skuList:[{openItemCode:'SKU:456',price:'18.00',choiceGroupOpenItemCodeList:[]}]}],
    });
    const mutations=plan(before,after).mutations;
    expect(mutations.findIndex(row=>row.kind==='CATEGORY_UPSERT'&&row.entityId==='CAT:9'))
      .toBeLessThan(mutations.findIndex(row=>row.kind==='SPU_UPSERT'&&row.entityId==='SPU:456'));
  });

  it('does not re-upload Products for a Category name-only change',()=>{
    const before=menu();
    const after=menu({categories:[{...before.shopCategoryList[0],name:'手作飯糰'}],spus:before.spuList});
    const mutations=plan(before,after).mutations;
    expect(mutations.filter(row=>row.kind==='CATEGORY_UPSERT')).toHaveLength(1);
    expect(mutations.some(row=>row.kind==='SPU_UPSERT')).toBe(false);
  });

  it('updates a changed ChoiceGroup and only its dependent SPU',()=>{
    const groups=[{openItemCode:'GRP:size',name:'份量',sourceLanguageType:'zh-HK',minNumber:1,maxNumber:1,choiceGroupSkuList:[{openItemCode:'OPT:small',name:'細',sourceLanguageType:'zh-HK',status:1,price:'0.00'}]}];
    const spus=[
      {openItemCode:'SPU:1',name:'飯糰',status:1,shopCategoryOpenItemCodeList:['CAT:1'],skuList:[{openItemCode:'SKU:1',price:'48.00',choiceGroupOpenItemCodeList:['GRP:size']}]},
      {openItemCode:'SPU:2',name:'檸茶',status:1,shopCategoryOpenItemCodeList:['CAT:1'],skuList:[{openItemCode:'SKU:2',price:'18.00',choiceGroupOpenItemCodeList:[]}]},
    ];
    const before=menu({groups,spus});
    const after=menu({groups:[{...groups[0],name:'選擇份量'}],spus});
    const mutations=plan(before,after).mutations;
    expect(mutations.filter(row=>row.kind==='CHOICE_GROUP_UPSERT').map(row=>row.entityId)).toEqual(['GRP:size']);
    expect(mutations.filter(row=>row.kind==='SPU_UPSERT').map(row=>row.entityId)).toEqual(['SPU:1']);
  });

  it('uses the documented one-item SPU delete operation',()=>{
    const before=menu();
    const after=menu({spus:[]});
    const mutations=plan(before,after).mutations;
    const deletion=mutations.find(row=>row.kind==='SPU_DELETE');
    expect(deletion).toMatchObject({entityId:'SPU:1',providerOperation:{execute:'/product/spu/batchdel'}});
    expect(mutations.some(row=>row.kind==='SPU_SEQUENCE')).toBe(false);
  });

  it('executes Product deletion with one ID and no linked cascade or full-menu traffic',async()=>{
    const before=menu();
    const after=menu({spus:[]});
    const generated=planned(before,after);
    const deletion=generated.providerPlan.mutations.find(row=>row.kind==='SPU_DELETE')!;
    const seq=deletion.sourcePortSeqs[0]!;
    const providerPlan={...generated.providerPlan,sourceFromSeq:seq-1,sourceToSeq:seq,headSeq:seq,mutations:[deletion]};
    const {storage}=memoryStorage({providerAppliedSeq:seq-1});
    const calls:Array<{path:string;params:Readonly<Record<string,unknown>>}>=[];
    const request=async(path:string,params:Readonly<Record<string,unknown>>)=>{
      calls.push({path,params});
      if(path==='/product/spu/list')return {code:0,message:'Success',data:[{...before.spuList[0],id:101}],errorList:[]};
      if(path==='/product/spu/batchdel')return {code:0,message:'Success',data:[101],errorList:[]};
      throw new Error('UNEXPECTED:'+path);
    };
    await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities:generated.currentEntities,providerShopId:9,storage,request});
    expect(calls).toEqual([
      expect.objectContaining({path:'/product/spu/list'}),
      {path:'/product/spu/batchdel',params:{shopId:9,spuIdList:[101],linkedDel:false}},
    ]);
  });

  it('does not sequence a Category after that Category has been deleted',()=>{
    const mutations=plan(menu(),menu({categories:[],spus:[]})).mutations;
    expect(mutations).toEqual(expect.arrayContaining([expect.objectContaining({kind:'CATEGORY_DELETE',entityId:'CAT:1'})]));
    expect(mutations.some(row=>row.kind==='SPU_SEQUENCE'&&row.entityId==='CAT:1')).toBe(false);
  });

  it('is deterministic for duplicate Delta input',()=>{
    const before=menu();
    const after=menu({spus:[{...before.spuList[0],name:'黑米飯糰'}]});
    expect(plan(before,after)).toEqual(plan(before,after));
  });

  it('collapses repeated changes for one entity to its final provider state',()=>{
    const before=menu();
    const after=menu({spus:[]});
    const generated=planned(before,after);
    const deletion=generated.batch.changes.find(change=>change.entityType==='KEETA_SPU')!;
    const previous=Object.values(buildKeetaSyncEntities(before)).find(entity=>entity.entityType==='KEETA_SPU')!;
    const batch={
      ...generated.batch,toInclusive:2,headSeq:2,
      changes:[
        {...deletion,portSeq:1,op:'UPSERT' as const,payload:previous.payload,payloadHash:previous.payloadHash},
        {...deletion,portSeq:2},
      ],
    };
    const result=planKeetaProviderMutations({batch,currentEntities:generated.currentEntities});
    expect(result.mutations).toEqual([expect.objectContaining({kind:'SPU_DELETE',entityId:'SPU:1',sourcePortSeqs:[1,2]})]);
  });

  it('excludes unrelated 299 Products from the provider request when one Product changes',async()=>{
    const spus=Array.from({length:300},(_,index)=>({
      openItemCode:'SPU:'+String(index+1),name:'商品 '+String(index+1),status:1,
      shopCategoryOpenItemCodeList:['CAT:1'],
      skuList:[{openItemCode:'SKU:'+String(index+1),price:'48.00',choiceGroupOpenItemCodeList:[]}],
    }));
    const before=menu({spus});
    const afterSpus=structuredClone(spus);
    afterSpus[122]!.skuList[0]!.price='52.00';
    const after=menu({spus:afterSpus});
    const {providerPlan,currentEntities}=planned(before,after);
    const mutations=providerPlan.mutations.filter(row=>row.kind==='SPU_UPSERT');
    expect(mutations).toHaveLength(1);
    expect(mutations[0]?.entityId).toBe('SPU:123');
    const {storage}=memoryStorage({providerAppliedSeq:0});
    let sent:unknown[]=[];
    const request=async(path:string,params:Readonly<Record<string,unknown>>)=>{
      if(path==='/product/spu/list')return {code:0,message:'Success',data:spus.map((spu,index)=>({...spu,id:index+1})),errorList:[]};
      if(path==='/product/shopcategory/list')return {code:0,message:'Success',data:[{...after.shopCategoryList[0],id:11}],errorList:[]};
      if(path==='/product/choicegroup/list')return {code:0,message:'Success',data:[],errorList:[]};
      if(path==='/product/spu/batchupdate'){sent=params.spuList as unknown[];return {code:0,message:'Success',data:sent,errorList:[]};}
      throw new Error('UNEXPECTED:'+path);
    };
    await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities,providerShopId:9,storage,request});
    expect(sent).toHaveLength(1);
    expect(sent.map(item=>(item as {openItemCode:string}).openItemCode)).toEqual(['SPU:123']);
  });

  it('executes one Product price change through the documented one-SPU update only',async()=>{
    const before=menu();
    const after=menu({spus:[{...before.spuList[0],skuList:[{openItemCode:'SKU:1',price:'52.00',choiceGroupOpenItemCodeList:[]}]}]});
    const {providerPlan,currentEntities}=planned(before,after,41);
    const {values,storage}=memoryStorage({providerAppliedSeq:41});
    const calls:Array<{path:string;params:Record<string,unknown>}>=[];
    const desired=providerPlan.mutations[0]!.payload!;
    const request=async(path:string,params:Readonly<Record<string,unknown>>)=>{
      calls.push({path,params:{...params}});
      if(path==='/product/spu/list')return {code:0,message:'Success',data:[{...before.spuList[0],id:101,skuList:[{...(before.spuList[0]!.skuList as Array<Record<string,unknown>>)[0],id:201}]}],errorList:[]};
      if(path==='/product/shopcategory/list')return {code:0,message:'Success',data:[{...after.shopCategoryList[0],id:11}],errorList:[]};
      if(path==='/product/choicegroup/list')return {code:0,message:'Success',data:[],errorList:[]};
      if(path==='/product/spu/batchupdate'){
        expect([...values.values()].some(row=>(row as {state?:string})?.state==='PENDING')).toBe(true);
        return {code:0,message:'Success',data:[(params.spuList as unknown[])[0]],errorList:[]};
      }
      throw new Error('UNEXPECTED:'+path);
    };
    const status=await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities,providerShopId:9,storage,request});
    expect(status).toMatchObject({providerAppliedSeq:42,behindCount:0,state:'APPLIED'});
    expect(calls.filter(call=>call.path==='/product/spu/batchupdate')).toHaveLength(1);
    expect((calls.find(call=>call.path==='/product/spu/batchupdate')!.params.spuList as unknown[])).toHaveLength(1);
    expect(calls.some(call=>call.path==='/product/menu/sync')).toBe(false);
    expect(JSON.stringify(calls)).toContain(String(desired.openItemCode));
  });

  it('does not resend an already-applied duplicate Delta',async()=>{
    const before=menu();
    const after=menu({spus:[{...before.spuList[0],name:'黑米飯糰'}]});
    const {providerPlan,currentEntities}=planned(before,after,8);
    const {storage}=memoryStorage({providerAppliedSeq:8});
    let writes=0;
    const request=async(path:string,params:Readonly<Record<string,unknown>>)=>{
      if(path==='/product/spu/list')return {code:0,message:'Success',data:[{...before.spuList[0],id:101}],errorList:[]};
      if(path==='/product/shopcategory/list')return {code:0,message:'Success',data:[{...after.shopCategoryList[0],id:11}],errorList:[]};
      if(path==='/product/choicegroup/list')return {code:0,message:'Success',data:[],errorList:[]};
      if(path==='/product/spu/batchupdate'){writes++;return {code:0,message:'Success',data:[(params.spuList as unknown[])[0]],errorList:[]};}
      throw new Error('UNEXPECTED:'+path);
    };
    await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities,providerShopId:9,storage,request});
    await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities,providerShopId:9,storage,request});
    expect(writes).toBe(1);
  });

  it('does not blindly resend the same definitively rejected operation',async()=>{
    const before=menu();
    const after=menu({spus:[{...before.spuList[0],name:'黑米飯糰'}]});
    const {providerPlan,currentEntities}=planned(before,after,8);
    const {storage}=memoryStorage({providerAppliedSeq:8});
    let writes=0;
    const request=async(path:string)=>{
      if(path==='/product/spu/list')return {code:0,message:'Success',data:[{...before.spuList[0],id:101}],errorList:[]};
      if(path==='/product/shopcategory/list')return {code:0,message:'Success',data:[{...after.shopCategoryList[0],id:11}],errorList:[]};
      if(path==='/product/choicegroup/list')return {code:0,message:'Success',data:[],errorList:[]};
      if(path==='/product/spu/batchupdate'){writes++;return {code:0,message:'Success',data:[],errorList:[{code:400,message:'invalid'}]};}
      throw new Error('UNEXPECTED:'+path);
    };
    const rejected=await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities,providerShopId:9,storage,request});
    expect(rejected).toMatchObject({providerAppliedSeq:8,state:'REJECTED'});
    await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities,providerShopId:9,storage,request});
    expect(writes).toBe(1);
  });

  it('banks a timeout as UNKNOWN and performs provider readback before any retry',async()=>{
    const before=menu();
    const after=menu({spus:[{...before.spuList[0],name:'黑米飯糰'}]});
    const {providerPlan,currentEntities}=planned(before,after,14);
    const {storage}=memoryStorage({providerAppliedSeq:14});
    let remoteApplied=false,writes=0;
    const paths:string[]=[];
    const request=async(path:string,params:Readonly<Record<string,unknown>>)=>{
      paths.push(path);
      if(path==='/product/spu/list')return {code:0,message:'Success',data:[{...(remoteApplied?after.spuList[0]:before.spuList[0]),id:101}],errorList:[]};
      if(path==='/product/shopcategory/list')return {code:0,message:'Success',data:[{...after.shopCategoryList[0],id:11}],errorList:[]};
      if(path==='/product/choicegroup/list')return {code:0,message:'Success',data:[],errorList:[]};
      if(path==='/product/spu/batchupdate'){writes++;remoteApplied=true;throw new TypeError('network uncertain');}
      throw new Error('UNEXPECTED:'+path+JSON.stringify(params));
    };
    const unknown=await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities,providerShopId:9,storage,request});
    expect(unknown).toMatchObject({providerAppliedSeq:14,state:'UNKNOWN'});
    const beforeRetry=paths.length;
    const recovered=await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities,providerShopId:9,storage,request});
    expect(paths[beforeRetry]).toBe('/product/spu/list');
    expect(writes).toBe(1);
    expect(recovered).toMatchObject({providerAppliedSeq:15,state:'APPLIED'});
  });

  it('advances ProviderAppliedSeq only through the contiguous fully-applied prefix',async()=>{
    const spus=[
      {openItemCode:'SPU:1',name:'飯糰',status:1,shopCategoryOpenItemCodeList:['CAT:1'],skuList:[{openItemCode:'SKU:1',price:'48.00',choiceGroupOpenItemCodeList:[]}]},
      {openItemCode:'SPU:2',name:'檸茶',status:1,shopCategoryOpenItemCodeList:['CAT:1'],skuList:[{openItemCode:'SKU:2',price:'18.00',choiceGroupOpenItemCodeList:[]}]},
    ];
    const before=menu({spus});
    const after=menu({spus:spus.map((spu,index)=>({...spu,skuList:[{...(spu.skuList[0] as Record<string,unknown>),price:index?'20.00':'50.00'}]}))});
    const {providerPlan,currentEntities}=planned(before,after,330);
    const {storage}=memoryStorage({providerAppliedSeq:330});
    const request=async(path:string,params:Readonly<Record<string,unknown>>)=>{
      if(path==='/product/spu/list')return {code:0,message:'Success',data:spus.map((spu,index)=>({...spu,id:100+index})),errorList:[]};
      if(path==='/product/shopcategory/list')return {code:0,message:'Success',data:[{...after.shopCategoryList[0],id:11}],errorList:[]};
      if(path==='/product/choicegroup/list')return {code:0,message:'Success',data:[],errorList:[]};
      if(path==='/product/spu/batchupdate'){
        const payload=(params.spuList as Array<Record<string,unknown>>)[0]!;
        if(payload.openItemCode==='SPU:2')throw new TypeError('network uncertain');
        return {code:0,message:'Success',data:[payload],errorList:[]};
      }
      throw new Error('UNEXPECTED:'+path);
    };
    const status=await executeKeetaProviderMutationPlan({plan:providerPlan,currentEntities,providerShopId:9,storage,request});
    expect(providerPlan).toMatchObject({sourceFromSeq:330,sourceToSeq:332});
    expect(status).toMatchObject({headSeq:332,providerAppliedSeq:331,behindCount:1,state:'UNKNOWN'});
  });

  it('stops on a journal gap without guessing or calling the provider',async()=>{
    const before=menu();
    const after=menu({spus:[{...before.spuList[0],name:'黑米飯糰'}]});
    const {providerPlan,currentEntities}=planned(before,after,40);
    const {storage}=memoryStorage({providerAppliedSeq:39});
    let calls=0;
    const status=await executeKeetaProviderMutationPlan({
      plan:providerPlan,currentEntities,providerShopId:9,storage,
      request:async()=>{calls++;throw new Error('MUST_NOT_CALL');},
    });
    expect(calls).toBe(0);
    expect(status).toMatchObject({providerAppliedSeq:39,state:'UNKNOWN',error:'KEETA_PROVIDER_JOURNAL_GAP'});
  });
});
