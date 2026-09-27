import {
  customerComboPublishedUnitMinor,
  customerStandalonePublishedUnitMinor,
  selectedCustomerComboIntent,
  selectedCustomerOptions,
  validateCustomerComboSelection,
  validateCustomerSelections,
  type CustomerComboDraftSelection,
} from './selection';
import type {
  CustomerCartLine,
  CustomerHistoryProjection,
  CustomerMenuSnapshot,
} from './product-types';

export interface CustomerReorderCopyIssue{
  readonly lineId:string;
  readonly title:string;
  readonly detail:string;
}

export interface CustomerReorderCopyResult{
  readonly cart:readonly CustomerCartLine[];
  readonly issues:readonly CustomerReorderCopyIssue[];
  readonly currentMenuRevision:string;
}

const currentOrdinarySelections=(line:NonNullable<CustomerHistoryProjection['reorderIntent']>[number],menu:CustomerMenuSnapshot)=>{
  const product=menu.products.find(item=>item.productId===line.productId);
  if(!product)return {product:null,state:Object.freeze({}) as Readonly<Record<string,readonly string[]>>,missing:['餐點已不在目前餐牌']};
  const state:Record<string,readonly string[]>={};
  const missing:string[]=[];
  for(const old of line.selections){
    const group=product.optionGroups.find(item=>item.optionGroupId===old.optionGroupId);
    const option=group?.options.find(item=>item.optionId===old.optionId&&item.available);
    if(!group||!option){missing.push('舊選項「'+old.optionName+'」已不可直接使用');continue}
    state[group.optionGroupId]=Object.freeze([...(state[group.optionGroupId]??[]),option.optionId]);
  }
  const validation=validateCustomerSelections(product,state);
  missing.push(...validation.issues);
  return {product,state:Object.freeze(state),missing};
};

export function buildCurrentReorderCart(
  order:CustomerHistoryProjection,
  menu:CustomerMenuSnapshot|null|undefined,
  createLineId:()=>string=()=>crypto.randomUUID(),
  now:()=>string=()=>new Date().toISOString(),
):CustomerReorderCopyResult{
  if(!menu)return Object.freeze({cart:Object.freeze([]),issues:Object.freeze([{lineId:'menu',title:'目前餐牌未讀回',detail:'未有 current catalog 前，唔會用舊餐牌建立新購物車。'}]),currentMenuRevision:''});
  const intent=order.reorderIntent??[];
  const cart:CustomerCartLine[]=[];
  const issues:CustomerReorderCopyIssue[]=[];

  for(const [intentIndex,oldLine] of intent.entries()){
    const lineId=createLineId();
    const ordinary=currentOrdinarySelections(oldLine,menu);
    const product=ordinary.product;
    const lineIssues=[...ordinary.missing];
    const variation=oldLine.selectedVariationId
      ?product?.variations?.find(item=>item.variationId===oldLine.selectedVariationId&&item.available)
      :undefined;
    if(oldLine.selectedVariationId&&!variation)lineIssues.push('舊規格已不可直接使用');

    const selections=product?selectedCustomerOptions(product,ordinary.state):Object.freeze([]);
    let combo:CustomerCartLine['combo'];
    if(oldLine.combo){
      if(!product||product.comboId!==oldLine.combo.comboId){
        lineIssues.push('舊套餐綁定已更新');
      }else{
        const comboState:CustomerComboDraftSelection[]=oldLine.combo.selections.map(selection=>Object.freeze({
          poolId:selection.poolId,
          groupId:selection.groupId,
          subPoolId:selection.subPoolId,
          choiceId:selection.choiceId,
        }));
        const validation=validateCustomerComboSelection(product,menu,Object.freeze(comboState));
        if(!validation.ok){
          lineIssues.push(...validation.issues);
        }else{
          combo=selectedCustomerComboIntent(product,menu,Object.freeze(comboState))??undefined;
          if(!combo)lineIssues.push('套餐資料未能按目前餐牌重建');
        }
      }
    }

    let currentUnitMinor:number|null=null;
    if(product&&product.available&&lineIssues.length===0){
      currentUnitMinor=combo
        ?customerComboPublishedUnitMinor(combo,selections)
        :customerStandalonePublishedUnitMinor(product,selections);
      if(currentUnitMinor===null)lineIssues.push('目前價格資料未完整');
    }else if(product&&!product.available){
      lineIssues.push('餐點目前暫停供應');
    }

    const historicalUnit=order.reorderPriceFacts?.find(fact=>fact.intentIndex===intentIndex)?.historicalPublishedUnitMinor;
    if(
      currentUnitMinor!==null&&
      Number.isSafeInteger(Number(historicalUnit))&&
      Number(historicalUnit)!==currentUnitMinor
    ){
      lineIssues.push('歷史價 HK
    cart.push(Object.freeze({
      lineId,
      productId:oldLine.productId,
      productName:product?.name??oldLine.productName,
      quantity:Math.max(1,Math.floor(Number(oldLine.quantity)||1)),
      ...(variation?{selectedVariationId:variation.variationId,selectedVariationName:variation.name}:oldLine.selectedVariationId?{selectedVariationId:oldLine.selectedVariationId,selectedVariationName:oldLine.selectedVariationName}:{}) ,
      selections:selections.length?selections:Object.freeze(oldLine.selections.map(selection=>Object.freeze({
        optionGroupId:selection.optionGroupId,
        optionId:selection.optionId,
        optionName:selection.optionName,
      }))),
      ...(combo?{combo}:{}),
      createdAt:now(),
      ...(oldLine.note?{note:oldLine.note}:{}),
      ...(attention?{attention}:{}),
      ...(currentUnitMinor!==null?{publishedUnitPriceMinor:currentUnitMinor}:{}),
    }));
    if(attention)issues.push(Object.freeze({lineId,title:'呢一項需要按目前餐牌修正',detail:attention}));
  }

  return Object.freeze({
    cart:Object.freeze(cart),
    issues:Object.freeze(issues),
    currentMenuRevision:menu.revision,
  });
}

export function clearReorderAttention(line:CustomerCartLine):CustomerCartLine{
  const {attention:_attention,...rest}=line;
  return Object.freeze(rest);
}
+(Number(historicalUnit)/100).toFixed(0)+' → 目前 HK
    cart.push(Object.freeze({
      lineId,
      productId:oldLine.productId,
      productName:product?.name??oldLine.productName,
      quantity:Math.max(1,Math.floor(Number(oldLine.quantity)||1)),
      ...(variation?{selectedVariationId:variation.variationId,selectedVariationName:variation.name}:oldLine.selectedVariationId?{selectedVariationId:oldLine.selectedVariationId,selectedVariationName:oldLine.selectedVariationName}:{}) ,
      selections:selections.length?selections:Object.freeze(oldLine.selections.map(selection=>Object.freeze({
        optionGroupId:selection.optionGroupId,
        optionId:selection.optionId,
        optionName:selection.optionName,
      }))),
      ...(combo?{combo}:{}),
      createdAt:now(),
      ...(oldLine.note?{note:oldLine.note}:{}),
      ...(attention?{attention}:{}),
      ...(currentUnitMinor!==null?{publishedUnitPriceMinor:currentUnitMinor}:{}),
    }));
    if(attention)issues.push(Object.freeze({lineId,title:'呢一項需要按目前餐牌修正',detail:attention}));
  }

  return Object.freeze({
    cart:Object.freeze(cart),
    issues:Object.freeze(issues),
    currentMenuRevision:menu.revision,
  });
}

export function clearReorderAttention(line:CustomerCartLine):CustomerCartLine{
  const {attention:_attention,...rest}=line;
  return Object.freeze(rest);
}
+(currentUnitMinor/100).toFixed(0)+'；請確認目前價格');
    }

    const attention=[...new Set(lineIssues)].join('；');
    cart.push(Object.freeze({
      lineId,
      productId:oldLine.productId,
      productName:product?.name??oldLine.productName,
      quantity:Math.max(1,Math.floor(Number(oldLine.quantity)||1)),
      ...(variation?{selectedVariationId:variation.variationId,selectedVariationName:variation.name}:oldLine.selectedVariationId?{selectedVariationId:oldLine.selectedVariationId,selectedVariationName:oldLine.selectedVariationName}:{}) ,
      selections:selections.length?selections:Object.freeze(oldLine.selections.map(selection=>Object.freeze({
        optionGroupId:selection.optionGroupId,
        optionId:selection.optionId,
        optionName:selection.optionName,
      }))),
      ...(combo?{combo}:{}),
      createdAt:now(),
      ...(oldLine.note?{note:oldLine.note}:{}),
      ...(attention?{attention}:{}),
      ...(currentUnitMinor!==null?{publishedUnitPriceMinor:currentUnitMinor}:{}),
    }));
    if(attention)issues.push(Object.freeze({lineId,title:'呢一項需要按目前餐牌修正',detail:attention}));
  }

  return Object.freeze({
    cart:Object.freeze(cart),
    issues:Object.freeze(issues),
    currentMenuRevision:menu.revision,
  });
}

export function clearReorderAttention(line:CustomerCartLine):CustomerCartLine{
  const {attention:_attention,...rest}=line;
  return Object.freeze(rest);
}
