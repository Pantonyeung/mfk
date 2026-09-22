import {validateAdminDraft,type AdminSessionDraft} from './admin-draft.tsx';
import {createAdminRelease,readAdminStored,writeAdminStored,type AdminRelease} from './admin-local-store.ts';
import {OPTION_SET_CENTER_STORAGE_KEYS,readOptionSetCenterState,validateOptionSetCenter,type OptionSetCenterState} from './admin-option-set-center.ts';

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
  const rows=readAdminStored<Array<{id?:string;name?:string;pin?:string;active?:boolean;permissions?:unknown}>>('staff.v1',[]);
  const errors:string[]=[];
  const ids=new Set<string>();
  for(const row of rows){
    const id=String(row.id??'').trim();
    const name=String(row.name??'').trim();
    const pin=String(row.pin??'').replace(/\D/g,'');
    if(!id)errors.push('員工缺少 Staff ID');
    else if(ids.has(id))errors.push('員工 Staff ID 重複：'+id);
    else ids.add(id);
    if(!name)errors.push('員工 '+(id||'未命名')+' 未填名稱');
    if(row.active!==false&&(pin.length<4||pin.length>8))errors.push('員工 '+(name||id||'未命名')+' PIN 必須為 4–8 位數字');
    if(!Array.isArray(row.permissions))errors.push('員工 '+(name||id||'未命名')+' 權限資料格式錯誤');
  }
  return errors;
}

export function validateAdminConfig(catalog:AdminSessionDraft,optionCenter?:OptionSetCenterState){
  const optionState=optionCenter??readOptionSetCenterState(catalog);
  return Object.freeze([
    ...validateAdminDraft(catalog),
    ...validateOptionSetCenter(optionState),
    ...validateStaffConfig(),
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
