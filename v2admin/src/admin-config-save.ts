import {validateAdminDraft,type AdminSessionDraft} from './admin-draft.tsx';
import {createAdminRelease,readAdminStored,writeAdminStored,type AdminRelease} from './admin-local-store.ts';
import {OPTION_SET_CENTER_STORAGE_KEYS,readOptionSetCenterState,validateOptionSetCenter,type OptionSetCenterState} from './admin-option-set-center.ts';
import {DEFAULT_PRICING_PROMOTIONS,RICEBALL_DRINK_PROMOTION_STORAGE_KEY} from './admin-pricing-promotion-seed-r1.ts';
import {
  DEFAULT_MFK_POS_TENDER_POLICY,
  validateMfkPosTenderPolicy,
  type MfkPosTenderPolicy,
} from '../../contracts/pos-tender-policy-v1.ts';

export interface AdminSaveSuccess{
  readonly ok:true;
  readonly release:AdminRelease;
  readonly errors:readonly [];
}

export interface AdminSaveFailure{
  readonly ok:false;
  readonly errors:readonly string[];
}

export type AdminSaveResult=AdminSaveSuccess|AdminSaveFailure;

function validateStaffConfig(){
  const rows=readAdminStored<Array<{id?:string;loginId?:string;name?:string;pin?:string;pinVerifier?:unknown;active?:boolean;permissions?:unknown}>>('staff.v1',[]);
  const errors:string[]=[];
  const ids=new Set<string>();
  const loginIds=new Set<string>();
  for(const row of rows){
    const id=String(row.id??'').trim();
    const loginId=String(row.loginId??'').trim();
    const name=String(row.name??'').trim();
    const pin=String(row.pin??'').replace(/\D/g,'');
    const verifier=row.pinVerifier&&typeof row.pinVerifier==='object'&&!Array.isArray(row.pinVerifier)?row.pinVerifier as Record<string,unknown>:null;
    const verifierReady=Boolean(
      verifier&&
      verifier.algorithm==='PBKDF2-SHA256'&&
      Number.isSafeInteger(Number(verifier.iterations))&&Number(verifier.iterations)>=100000&&
      /^[0-9a-f]+$/i.test(String(verifier.saltHex??''))&&
      /^[0-9a-f]{64}$/i.test(String(verifier.hashHex??''))
    );
    if(!id)errors.push('員工缺少 Internal Staff ID');
    else if(ids.has(id))errors.push('Internal Staff ID 重複：'+id);
    else ids.add(id);
    if(!loginId)errors.push('員工 '+(name||id||'未命名')+' 未填登入編號');
    else if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(loginId))errors.push('登入編號格式錯誤：'+loginId);
    else if(loginIds.has(loginId))errors.push('登入編號重複：'+loginId);
    else loginIds.add(loginId);
    if(!name)errors.push('員工 '+(loginId||id||'未命名')+' 未填名稱');
    if(row.active!==false&&!((pin.length>=4&&pin.length<=8)||verifierReady))errors.push('員工 '+(name||loginId||id||'未命名')+' PIN 必須為 4–8 位數字，或保留已發布驗證器');
    if(!Array.isArray(row.permissions))errors.push('員工 '+(name||loginId||id||'未命名')+' 權限資料格式錯誤');
  }
  return errors;
}

function validateKeetaMappings(catalog:AdminSessionDraft){
  const mappings=readAdminStored<any[]>('channel-mapping.keeta.v1',[]);
  const productIds=new Set(catalog.products.map(product=>product.id));
  const errors:string[]=[];
  for(const mapping of mappings){
    if(mapping?.status==='IGNORED')continue;
    const providerId=String(mapping?.providerItemId??'').trim();
    const components=Array.isArray(mapping?.components)?mapping.components:[];
    if(!providerId)errors.push('Keeta mapping missing provider item id');
    if(!components.length)errors.push('Keeta '+providerId+' mapping missing production components');
    for(const component of components){
      const productId=String(component?.canonicalProductId??'').trim();
      if(!productIds.has(productId))errors.push('Keeta '+providerId+' mapping references missing product '+productId);
      if(!Number.isSafeInteger(component?.quantity)||component.quantity<1)errors.push('Keeta '+providerId+' mapping quantity invalid '+productId);
    }
  }
  return errors;
}

function readPosTenderPolicy():MfkPosTenderPolicy{
  return validateMfkPosTenderPolicy(
    readAdminStored('pos-tenders.v1',DEFAULT_MFK_POS_TENDER_POLICY),
  );
}

function validatePosTenderPolicy(){
  try{readPosTenderPolicy();return [] as string[];}
  catch(error){return [error instanceof Error?error.message:'POS_TENDER_POLICY_INVALID'];}
}

export function validateAdminConfig(catalog:AdminSessionDraft,optionCenter?:OptionSetCenterState){
  const optionState=optionCenter??readOptionSetCenterState(catalog);
  return Object.freeze([
    ...validateAdminDraft(catalog),
    ...validateOptionSetCenter(optionState),
    ...validateStaffConfig(),
    ...validateKeetaMappings(catalog),
    ...validatePosTenderPolicy(),
  ]);
}

export function collectAdminSnapshot(catalog:AdminSessionDraft,optionCenter?:OptionSetCenterState){
  const optionState=optionCenter??readOptionSetCenterState(catalog);
  return {
    catalog,
    optionCenter:optionState,
    availability:readAdminStored('availability.v1',{}),
    businessDay:readAdminStored('business-day.v1',{}),
    logicalPrinters:readAdminStored('logical-printers.v1',[]),
    printTemplates:readAdminStored('print-templates.v1',{}),
    printRules:readAdminStored('print-rules.v1',{}),
    productMedia:readAdminStored('product-media.v1',{}),
    storeSettings:readAdminStored('store-settings.v1',{}),
    quickReasons:readAdminStored('quick-reasons.v1',[]),
    staff:readAdminStored('staff.v1',[]),
    channelPolicy:readAdminStored('channel-policy.keeta.v1',{}),
    customerChannelPolicy:readAdminStored('channel-policy.customer.v1',{enabled:false}),
    posTenders:readPosTenderPolicy(),
    channelMapping:readAdminStored('channel-mapping.keeta.v1',[]),
    capacity:readAdminStored('capacity.v1',{}),
    presentation:Object.freeze({
      customer:readAdminStored('presentation.customer.v1',{}),
      owner:readAdminStored('presentation.owner.v1',{}),
      frontline:readAdminStored('presentation.frontline.v1',{}),
    }),
    inventory:readAdminStored('inventory-lite.v1',[]),
    loyalty:readAdminStored('loyalty.v1',{}),
    coupons:readAdminStored('coupons.v1',[]),
    pricingPromotions:readAdminStored(RICEBALL_DRINK_PROMOTION_STORAGE_KEY,DEFAULT_PRICING_PROMOTIONS),
    announcements:readAdminStored('announcements.v1',[]),
  };
}

export function saveAdminConfig(catalog:AdminSessionDraft,optionCenter?:OptionSetCenterState,reason?:string):AdminSaveResult{
  const optionState=optionCenter??readOptionSetCenterState(catalog);
  const errors=validateAdminConfig(catalog,optionState);
  if(errors.length)return {ok:false,errors};

  // Persist the exact Option Set state being committed before snapshot/readback.
  writeAdminStored(OPTION_SET_CENTER_STORAGE_KEYS.sets,optionState.sets);
  writeAdminStored(OPTION_SET_CENTER_STORAGE_KEYS.productLinks,optionState.productLinks);

  const release=createAdminRelease(collectAdminSnapshot(catalog,optionState),reason);
  return {ok:true,release,errors:[]};
}
