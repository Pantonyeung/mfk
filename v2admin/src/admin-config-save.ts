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

export function validateAdminConfig(catalog:AdminSessionDraft,optionCenter?:OptionSetCenterState){
  const optionState=optionCenter??readOptionSetCenterState(catalog);
  return Object.freeze([
    ...validateAdminDraft(catalog),
    ...validateOptionSetCenter(optionState),
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
    presentation:readAdminStored('presentation.v1',{}),
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
