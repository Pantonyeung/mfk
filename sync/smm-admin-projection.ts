import {validateMfkAdminConfigEnvelope,type MfkAdminConfigEnvelope} from '../contracts/admin-config-sync-v1';
import {projectSyncedCombos,projectSyncedOrderingCatalog} from '../v2local/src/runtime/admin-config-projection';

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function text(value:unknown,max=240){
  const out=String(value??'').trim();
  return out&&out.length<=max?out:'';
}

export function projectAdminEnvelopeToSmmConfig(raw:unknown){
  const envelope:MfkAdminConfigEnvelope=validateMfkAdminConfigEnvelope(raw);
  const takeaway=projectSyncedOrderingCatalog('takeaway',envelope);
  const dineIn=projectSyncedOrderingCatalog('dine-in',envelope);
  const comboData=projectSyncedCombos(envelope);
  const dineById=new Map(dineIn.products.map(item=>[item.id,item] as const));
  const productById=new Map(takeaway.products.map(item=>[item.id,item] as const));
  const comboPoolById=new Map(comboData.pools.map(pool=>[pool.id,pool] as const));
  const uniqueComboIdForProduct=(productId:string)=>{
    const matches=comboData.combos.filter(combo=>{
      if(!combo.mainPoolId)return false;
      const pool=comboPoolById.get(combo.mainPoolId);
      return Boolean(pool&&pool.kind==='MAIN_COURSE'&&pool.groups.some(group=>
        group.subPools.some(subPool=>subPool.choices.some(choice=>
          choice.type==='PRODUCT'&&choice.productId===productId
        ))
      ));
    });
    return matches.length===1?matches[0]!.id:undefined;
  };

  const storeSettings=record(envelope.snapshot.storeSettings);
  const rawTables=Array.isArray(storeSettings.diningTables)?storeSettings.diningTables:[];
  const diningTables=rawTables
    .flatMap((raw,index)=>{
      const item=record(raw);
      const tableId=text(item.id,32);
      const label=text(item.name,80);
      if(!tableId||!label||item.active===false)return [];
      return [{tableId,label,sortOrder:Math.max(1,Math.floor(Number(item.sortOrder)||index+1))}];
    })
    .sort((a,b)=>a.sortOrder-b.sortOrder);

  return Object.freeze({
    menu:Object.freeze({
      revision:String(envelope.revision),
      observedAt:String(envelope.publishedAt),
      categories:Object.freeze(takeaway.categories.map(item=>Object.freeze({
        categoryId:item.id,
        name:item.label,
        sortOrder:item.position,
      }))),
      products:Object.freeze(takeaway.products.map(item=>{
        const dine=dineById.get(item.id);
        const comboId=uniqueComboIdForProduct(item.id);
        return Object.freeze({
          productId:item.id,
          categoryId:item.categoryId,
          name:item.name,
          description:item.description??'',
          ...(item.imageUrl?{imageRef:item.imageUrl}:{}),
          available:item.sellable&&item.priceReady,
          ...(item.priceReady?{
            publishedTakeawayUnitPriceMinor:item.priceMinor,
            publishedDineInUnitPriceMinor:dine?.priceMinor??item.priceMinor,
          }:{}),
          optionGroups:Object.freeze(item.optionSets.map(set=>Object.freeze({
            optionGroupId:set.id,
            name:set.name,
            required:set.required,
            minSelections:set.min,
            maxSelections:set.max,
            options:Object.freeze(set.options.map(option=>Object.freeze({
              optionId:option.id,
              name:option.name,
              available:option.active,
              publishedAdjustmentMinor:option.priceAdjustmentMinor,
            }))),
          }))),
          ...(comboId?{comboId}:{}),
        });
      })),
      combos:Object.freeze(comboData.combos.map(combo=>Object.freeze({
        comboId:combo.id,
        name:combo.name,
        publishedBasePriceMinor:combo.basePriceMinor,
        ...(combo.mainPoolId?{mainPoolId:combo.mainPoolId}:{}),
        addonPoolIds:Object.freeze([...combo.addonPoolIds]),
      }))),
      comboPools:Object.freeze(comboData.pools.map(pool=>Object.freeze({
        poolId:pool.id,
        name:pool.name,
        kind:pool.kind,
        ...(pool.addonKind?{addonKind:pool.addonKind}:{}),
        groups:Object.freeze(pool.groups.map(group=>Object.freeze({
          groupId:group.id,
          name:group.name,
          required:group.required,
          minSelections:group.min,
          maxSelections:group.max,
          subPools:Object.freeze(group.subPools.map(subPool=>Object.freeze({
            subPoolId:subPool.id,
            name:subPool.name,
            publishedAdjustmentMinor:subPool.priceAdjustmentMinor,
            choices:Object.freeze(subPool.choices.map(choice=>{
              const product=choice.productId?productById.get(choice.productId):undefined;
              return Object.freeze({
                choiceId:choice.id,
                choiceType:choice.type,
                ...(choice.productId?{productId:choice.productId}:{}),
                label:choice.type==='PRODUCT'
                  ?(product?.name??choice.label??choice.productId??'未命名商品')
                  :choice.label,
                available:choice.type!=='PRODUCT'||Boolean(
                  product?.sellable&&product.priceReady&&(pool.kind!=='ADDON'||product.optionSets.length===0)
                ),
                publishedAdjustmentMinor:choice.priceAdjustmentMinor,
              });
            })),
          }))),
        }))),
      }))),
    }),
    diningTables:Object.freeze(diningTables),
  });
}
