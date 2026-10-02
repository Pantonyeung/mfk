import {fingerprintMfkSyncValue} from './checkpointed-delta-sync-v1';

export const MFK_CUSTOMER_COMMERCIAL_FRESHNESS_SCHEMA='MFK_CUSTOMER_COMMERCIAL_FRESHNESS_V1' as const;
export const MFK_CUSTOMER_COMMERCIAL_GRANT_SCHEMA='MFK_CUSTOMER_COMMERCIAL_GRANT_V1' as const;
export const MFK_CUSTOMER_COMMERCIAL_PROOF_TTL_MS=5*60*1000;

export interface MfkCustomerCommercialFreshnessProof{
  readonly schema:typeof MFK_CUSTOMER_COMMERCIAL_FRESHNESS_SCHEMA;
  readonly keyId:string;
  readonly storeId:string;
  readonly customerPortSeq:number;
  readonly projectionHash:string;
  readonly canonicalRevision:number;
  readonly canonicalFingerprint:string;
  readonly issuedAt:string;
  readonly expiresAt:string;
  readonly freshnessToken:string;
}

export interface MfkCustomerCommercialGrantLine{
  readonly lineId:string;
  readonly productId:string;
  readonly quantity:number;
  readonly publishedUnitPriceMinor:number;
}

export interface MfkCustomerCommercialGrant{
  readonly schema:typeof MFK_CUSTOMER_COMMERCIAL_GRANT_SCHEMA;
  readonly storeId:string;
  readonly submissionId:string;
  readonly customerPortSeq:number;
  readonly projectionHash:string;
  readonly canonicalRevision:number;
  readonly canonicalFingerprint:string;
  readonly proofExpiresAt:string;
  readonly verifiedAt:string;
  readonly factsHash:string;
  readonly totalMinor:number;
  readonly lines:readonly MfkCustomerCommercialGrantLine[];
}

type Row=Record<string,unknown>;
function row(value:unknown,code:string):Row{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Row;
}
function rows(value:unknown):readonly unknown[]{return Array.isArray(value)?value:[];}
function text(value:unknown,code:string,max=240){
  if(typeof value!=='string')throw new Error(code);
  const out=value.trim();
  if(!out||out.length>max)throw new Error(code);
  return out;
}
function instant(value:unknown,code:string){
  const out=text(value,code,80);
  if(!Number.isFinite(Date.parse(out)))throw new Error(code);
  return out;
}
function uint(value:unknown,code:string){
  const out=Number(value);
  if(!Number.isSafeInteger(out)||out<0)throw new Error(code);
  return out;
}
function signed(value:unknown,code:string){
  const out=Number(value);
  if(!Number.isSafeInteger(out))throw new Error(code);
  return out;
}

export function validateMfkCustomerCommercialFreshnessProof(input:unknown):MfkCustomerCommercialFreshnessProof{
  const value=row(input,'CUSTOMER_COMMERCIAL_PROOF_INVALID');
  if(value.schema!==MFK_CUSTOMER_COMMERCIAL_FRESHNESS_SCHEMA)throw new Error('CUSTOMER_COMMERCIAL_PROOF_SCHEMA_INVALID');
  const proof=Object.freeze({
    schema:MFK_CUSTOMER_COMMERCIAL_FRESHNESS_SCHEMA,
    keyId:text(value.keyId,'CUSTOMER_COMMERCIAL_PROOF_KEY_ID_INVALID',64),
    storeId:text(value.storeId,'CUSTOMER_COMMERCIAL_PROOF_STORE_INVALID',64),
    customerPortSeq:uint(value.customerPortSeq,'CUSTOMER_COMMERCIAL_PROOF_PORT_SEQ_INVALID'),
    projectionHash:text(value.projectionHash,'CUSTOMER_COMMERCIAL_PROOF_HASH_INVALID',180),
    canonicalRevision:uint(value.canonicalRevision,'CUSTOMER_COMMERCIAL_PROOF_REVISION_INVALID'),
    canonicalFingerprint:text(value.canonicalFingerprint,'CUSTOMER_COMMERCIAL_PROOF_FINGERPRINT_INVALID',180),
    issuedAt:instant(value.issuedAt,'CUSTOMER_COMMERCIAL_PROOF_ISSUED_AT_INVALID'),
    expiresAt:instant(value.expiresAt,'CUSTOMER_COMMERCIAL_PROOF_EXPIRES_AT_INVALID'),
    freshnessToken:text(value.freshnessToken,'CUSTOMER_COMMERCIAL_PROOF_TOKEN_INVALID',2048),
  });
  if(Date.parse(proof.expiresAt)-Date.parse(proof.issuedAt)!==MFK_CUSTOMER_COMMERCIAL_PROOF_TTL_MS)throw new Error('CUSTOMER_COMMERCIAL_PROOF_WINDOW_INVALID');
  return proof;
}

export function customerCommercialProofMatches(
  proof:MfkCustomerCommercialFreshnessProof|undefined,
  identity:{readonly storeId:string;readonly customerPortSeq:number;readonly projectionHash:string;readonly canonicalRevision:number;readonly canonicalFingerprint:string},
  nowMs=Date.now(),
){
  return Boolean(proof&&proof.storeId===identity.storeId&&proof.customerPortSeq===identity.customerPortSeq&&proof.projectionHash===identity.projectionHash&&proof.canonicalRevision===identity.canonicalRevision&&proof.canonicalFingerprint===identity.canonicalFingerprint&&Date.parse(proof.expiresAt)>nowMs);
}

function commercialLine(lineValue:unknown,lineIndex:number,projection:Row){
  const line=row(lineValue,'CUSTOMER_COMMERCIAL_LINE_INVALID:'+lineIndex);
  const lineId=text(line.lineId,'CUSTOMER_COMMERCIAL_LINE_ID_INVALID:'+lineIndex,160);
  const productId=text(line.productId,'CUSTOMER_COMMERCIAL_PRODUCT_ID_INVALID:'+lineId,160);
  const menu=row(projection.menu,'CUSTOMER_COMMERCIAL_MENU_INVALID');
  const product=rows(menu.products).map(value=>row(value,'CUSTOMER_COMMERCIAL_PRODUCT_INVALID')).find(value=>String(value.productId)===productId);
  if(!product||product.available!==true)throw new Error('CUSTOMER_COMMERCIAL_PRODUCT_UNAVAILABLE:'+productId);
  if(text(line.productName,'CUSTOMER_COMMERCIAL_PRODUCT_NAME_INVALID:'+lineId,200)!==String(product.name||''))throw new Error('CUSTOMER_COMMERCIAL_PRODUCT_FACT_MISMATCH:'+lineId);
  const quantity=uint(line.quantity,'CUSTOMER_COMMERCIAL_QUANTITY_INVALID:'+lineId);
  if(quantity<1||quantity>99)throw new Error('CUSTOMER_COMMERCIAL_QUANTITY_INVALID:'+lineId);

  const selected=rows(line.selections).map(value=>row(value,'CUSTOMER_COMMERCIAL_OPTION_INVALID:'+lineId));
  const selectedKeys=new Set<string>();
  let optionMinor=0;
  for(const rawGroup of rows(product.optionGroups)){
    const group=row(rawGroup,'CUSTOMER_COMMERCIAL_OPTION_GROUP_INVALID:'+lineId);
    const groupId=String(group.optionGroupId||'');
    const chosen=selected.filter(value=>String(value.optionGroupId||'')===groupId);
    const min=Math.max(group.required===true?1:0,Number(group.minSelections)||0);
    const max=Math.max(min,Number(group.maxSelections)||min);
    if(chosen.length<min||chosen.length>max)throw new Error('CUSTOMER_COMMERCIAL_OPTION_COUNT_INVALID:'+lineId+':'+groupId);
    for(const selection of chosen){
      const optionId=String(selection.optionId||'');
      const key=groupId+'::'+optionId;
      if(selectedKeys.has(key))throw new Error('CUSTOMER_COMMERCIAL_OPTION_DUPLICATE:'+lineId+':'+optionId);
      selectedKeys.add(key);
      const option=rows(group.options).map(value=>row(value,'CUSTOMER_COMMERCIAL_OPTION_INVALID:'+lineId)).find(value=>String(value.optionId||'')===optionId&&value.available===true);
      const adjustment=signed(selection.publishedAdjustmentMinor,'CUSTOMER_COMMERCIAL_OPTION_ADJUSTMENT_INVALID:'+lineId+':'+optionId);
      if(!option||String(selection.optionName||'')!==String(option.name||'')||adjustment!==Number(option.publishedAdjustmentMinor))throw new Error('CUSTOMER_COMMERCIAL_OPTION_FACT_MISMATCH:'+lineId+':'+optionId);
      optionMinor+=adjustment;
    }
  }
  if(selectedKeys.size!==selected.length)throw new Error('CUSTOMER_COMMERCIAL_OPTION_GROUP_UNKNOWN:'+lineId);

  let unitMinor=uint(product.publishedUnitPriceMinor,'CUSTOMER_COMMERCIAL_PRODUCT_PRICE_INVALID:'+productId)+optionMinor;
  if(line.combo!==undefined){
    const comboIntent=row(line.combo,'CUSTOMER_COMMERCIAL_COMBO_INVALID:'+lineId);
    const comboId=text(comboIntent.comboId,'CUSTOMER_COMMERCIAL_COMBO_ID_INVALID:'+lineId,160);
    if(String(product.comboId||'')!==comboId)throw new Error('CUSTOMER_COMMERCIAL_COMBO_BINDING_MISMATCH:'+lineId);
    const combo=rows(menu.combos).map(value=>row(value,'CUSTOMER_COMMERCIAL_COMBO_INVALID:'+lineId)).find(value=>String(value.comboId||'')===comboId);
    const base=uint(comboIntent.publishedBasePriceMinor,'CUSTOMER_COMMERCIAL_COMBO_PRICE_INVALID:'+lineId);
    if(!combo||String(comboIntent.comboName||'')!==String(combo.name||'')||base!==Number(combo.publishedBasePriceMinor))throw new Error('CUSTOMER_COMMERCIAL_COMBO_FACT_MISMATCH:'+lineId);
    const pools=new Map(rows(menu.comboPools).map(value=>{const item=row(value,'CUSTOMER_COMMERCIAL_COMBO_POOL_INVALID:'+lineId);return[String(item.poolId||''),item] as const;}));
    const mainPool=pools.get(String(combo.mainPoolId||''));
    const mainMatches=mainPool&&mainPool.kind==='MAIN_COURSE'?rows(mainPool.groups).flatMap(groupValue=>rows(row(groupValue,'CUSTOMER_COMMERCIAL_COMBO_GROUP_INVALID:'+lineId).subPools)).flatMap(subPoolValue=>rows(row(subPoolValue,'CUSTOMER_COMMERCIAL_COMBO_SUBPOOL_INVALID:'+lineId).choices)).map(choiceValue=>row(choiceValue,'CUSTOMER_COMMERCIAL_COMBO_CHOICE_INVALID:'+lineId)).filter(choice=>choice.choiceType==='PRODUCT'&&choice.productId===productId&&choice.available===true):[];
    if(mainMatches.length!==1)throw new Error('CUSTOMER_COMMERCIAL_COMBO_MAIN_INVALID:'+lineId);
    const comboSelections=rows(comboIntent.selections).map(value=>row(value,'CUSTOMER_COMMERCIAL_COMBO_SELECTION_INVALID:'+lineId));
    const seen=new Set<string>();
    let comboMinor=0;
    for(const poolId of rows(combo.addonPoolIds).map(String)){
      const pool=pools.get(poolId);
      if(!pool||pool.kind!=='ADDON')throw new Error('CUSTOMER_COMMERCIAL_COMBO_POOL_MISSING:'+lineId+':'+poolId);
      for(const groupValue of rows(pool.groups)){
        const group=row(groupValue,'CUSTOMER_COMMERCIAL_COMBO_GROUP_INVALID:'+lineId);
        const groupId=String(group.groupId||'');
        const chosen=comboSelections.filter(value=>String(value.poolId||'')===poolId&&String(value.groupId||'')===groupId);
        const min=pool.addonKind==='DRINK'?0:Math.max(group.required===true?1:0,Number(group.minSelections)||0);
        const max=Math.max(min,Number(group.maxSelections)||min);
        if(chosen.length<min||chosen.length>max)throw new Error('CUSTOMER_COMMERCIAL_COMBO_COUNT_INVALID:'+lineId+':'+groupId);
        for(const selection of chosen){
          const key=[poolId,groupId,selection.subPoolId,selection.choiceId].join('::');
          if(seen.has(key))throw new Error('CUSTOMER_COMMERCIAL_COMBO_DUPLICATE:'+lineId);
          seen.add(key);
          const subPool=rows(group.subPools).map(value=>row(value,'CUSTOMER_COMMERCIAL_COMBO_SUBPOOL_INVALID:'+lineId)).find(value=>String(value.subPoolId||'')===String(selection.subPoolId||''));
          const choice=subPool&&rows(subPool.choices).map(value=>row(value,'CUSTOMER_COMMERCIAL_COMBO_CHOICE_INVALID:'+lineId)).find(value=>String(value.choiceId||'')===String(selection.choiceId||'')&&value.available===true);
          const adjustment=signed(selection.publishedAdjustmentMinor,'CUSTOMER_COMMERCIAL_COMBO_ADJUSTMENT_INVALID:'+lineId);
          if(!choice||selection.choiceType!==choice.choiceType||String(selection.choiceLabel||'')!==String(choice.label||'')||String(selection.productId||'')!==String(choice.productId||'')||adjustment!==Number(subPool!.publishedAdjustmentMinor)+Number(choice.publishedAdjustmentMinor))throw new Error('CUSTOMER_COMMERCIAL_COMBO_SELECTION_FACT_MISMATCH:'+lineId+':'+String(selection.choiceId||''));
          comboMinor+=adjustment;
        }
      }
    }
    if(seen.size!==comboSelections.length)throw new Error('CUSTOMER_COMMERCIAL_COMBO_SELECTION_UNKNOWN:'+lineId);
    unitMinor=base+optionMinor+comboMinor;
  }
  if(!Number.isSafeInteger(unitMinor)||unitMinor<0)throw new Error('CUSTOMER_COMMERCIAL_UNIT_PRICE_INVALID:'+lineId);
  if(uint(line.publishedUnitPriceMinor,'CUSTOMER_COMMERCIAL_UNIT_PRICE_REQUIRED:'+lineId)!==unitMinor)throw new Error('CUSTOMER_COMMERCIAL_UNIT_PRICE_MISMATCH:'+lineId);
  return Object.freeze({lineId,productId,quantity,publishedUnitPriceMinor:unitMinor});
}

export function verifyCustomerCommercialCart(cart:unknown,projection:unknown){
  if(!Array.isArray(cart)||cart.length<1||cart.length>100)throw new Error('CUSTOMER_COMMERCIAL_CART_INVALID');
  const root=row(projection,'CUSTOMER_COMMERCIAL_PROJECTION_INVALID');
  const lines=Object.freeze(cart.map((line,index)=>commercialLine(line,index,root)));
  const totalMinor=lines.reduce((sum,line)=>sum+line.publishedUnitPriceMinor*line.quantity,0);
  if(!Number.isSafeInteger(totalMinor)||totalMinor<0)throw new Error('CUSTOMER_COMMERCIAL_TOTAL_INVALID');
  return Object.freeze({lines,totalMinor,factsHash:fingerprintMfkSyncValue({cart,lines,totalMinor})});
}

export function validateMfkCustomerCommercialGrant(input:unknown):MfkCustomerCommercialGrant{
  const value=row(input,'CUSTOMER_COMMERCIAL_GRANT_INVALID');
  if(value.schema!==MFK_CUSTOMER_COMMERCIAL_GRANT_SCHEMA)throw new Error('CUSTOMER_COMMERCIAL_GRANT_SCHEMA_INVALID');
  const lineValues=rows(value.lines);
  if(lineValues.length<1||lineValues.length>100)throw new Error('CUSTOMER_COMMERCIAL_GRANT_LINES_INVALID');
  const lines=Object.freeze(lineValues.map((raw,index)=>{
    const line=row(raw,'CUSTOMER_COMMERCIAL_GRANT_LINE_INVALID:'+index);
    const quantity=uint(line.quantity,'CUSTOMER_COMMERCIAL_GRANT_QUANTITY_INVALID:'+index);
    if(quantity<1||quantity>99)throw new Error('CUSTOMER_COMMERCIAL_GRANT_QUANTITY_INVALID:'+index);
    return Object.freeze({
      lineId:text(line.lineId,'CUSTOMER_COMMERCIAL_GRANT_LINE_ID_INVALID:'+index,160),
      productId:text(line.productId,'CUSTOMER_COMMERCIAL_GRANT_PRODUCT_ID_INVALID:'+index,160),
      quantity,
      publishedUnitPriceMinor:uint(line.publishedUnitPriceMinor,'CUSTOMER_COMMERCIAL_GRANT_PRICE_INVALID:'+index),
    });
  }));
  const totalMinor=uint(value.totalMinor,'CUSTOMER_COMMERCIAL_GRANT_TOTAL_INVALID');
  if(lines.reduce((sum,line)=>sum+line.quantity*line.publishedUnitPriceMinor,0)!==totalMinor)throw new Error('CUSTOMER_COMMERCIAL_GRANT_TOTAL_MISMATCH');
  return Object.freeze({
    schema:MFK_CUSTOMER_COMMERCIAL_GRANT_SCHEMA,
    storeId:text(value.storeId,'CUSTOMER_COMMERCIAL_GRANT_STORE_INVALID',64),
    submissionId:text(value.submissionId,'CUSTOMER_COMMERCIAL_GRANT_SUBMISSION_INVALID',180),
    customerPortSeq:uint(value.customerPortSeq,'CUSTOMER_COMMERCIAL_GRANT_PORT_SEQ_INVALID'),
    projectionHash:text(value.projectionHash,'CUSTOMER_COMMERCIAL_GRANT_HASH_INVALID',180),
    canonicalRevision:uint(value.canonicalRevision,'CUSTOMER_COMMERCIAL_GRANT_REVISION_INVALID'),
    canonicalFingerprint:text(value.canonicalFingerprint,'CUSTOMER_COMMERCIAL_GRANT_FINGERPRINT_INVALID',180),
    proofExpiresAt:instant(value.proofExpiresAt,'CUSTOMER_COMMERCIAL_GRANT_EXPIRES_INVALID'),
    verifiedAt:instant(value.verifiedAt,'CUSTOMER_COMMERCIAL_GRANT_VERIFIED_INVALID'),
    factsHash:text(value.factsHash,'CUSTOMER_COMMERCIAL_GRANT_FACTS_HASH_INVALID',180),
    totalMinor,
    lines,
  });
}
