export type StoreSettingsDomain =
  |'home'|'basic'|'service'|'tables'|'hours'|'timing'|'reminders'|'whatsapp'|'payments'|'qr'|'references';

export const STORE_SETTINGS_ROUTES = Object.freeze({
  home:'/admin/store/settings',
  basic:'/admin/store/settings/basic',
  service:'/admin/store/settings/service',
  tables:'/admin/store/settings/tables',
  hours:'/admin/store/settings/hours',
  timing:'/admin/store/settings/timing',
  reminders:'/admin/store/settings/reminders',
  whatsapp:'/admin/store/settings/whatsapp',
  payments:'/admin/store/settings/payments',
  qr:'/admin/store/settings/qr',
  references:'/admin/store/settings/references',
} satisfies Record<StoreSettingsDomain,string>);

export function resolveStoreSettingsDomain(pathname:string):StoreSettingsDomain{
  const suffix=pathname.replace(/^\/admin\/store\/settings\/?/,'').split('/')[0]??'';
  return (['basic','service','tables','hours','timing','reminders','whatsapp','payments','qr','references'] as const).includes(suffix as any)
    ? suffix as Exclude<StoreSettingsDomain,'home'>
    :'home';
}

export interface StoreSettingsValidationInput{
  diningOverdueMinutes:number;
  customerWhatsAppEnabled:boolean;
  customerWhatsAppNumber:string;
  customerWhatsAppTemplate:string;
  diningTables:readonly {id:string;name:string}[];
  paymentChannels:readonly {id:string;name:string}[];
}

export interface StoreSettingsFieldError{fieldId:string;message:string}
export interface StoreSettingsDomainError extends StoreSettingsFieldError{domain:Exclude<StoreSettingsDomain,'home'>}

export function validateStoreSettingsDomain(domain:StoreSettingsDomain,input:StoreSettingsValidationInput):readonly StoreSettingsFieldError[]{
  const errors:StoreSettingsFieldError[]=[];
  if(domain==='tables'){
    const ids=new Set<string>();
    input.diningTables.forEach((row,index)=>{
      if(!row.id.trim())errors.push({fieldId:'table-'+index+'-id',message:'堂食枱缺少內部 ID'});
      else if(ids.has(row.id))errors.push({fieldId:'table-'+index+'-id',message:'堂食枱 ID 重複：'+row.id});
      else ids.add(row.id);
      if(!row.name.trim())errors.push({fieldId:'table-'+index+'-name',message:'必須填寫顯示名稱'});
    });
  }
  if(domain==='timing'&&(!Number.isFinite(Number(input.diningOverdueMinutes))||Number(input.diningOverdueMinutes)<1)){
    errors.push({fieldId:'dining-overdue-minutes',message:'堂食超時必須至少 1 分鐘'});
  }
  if(domain==='whatsapp'&&input.customerWhatsAppEnabled){
    const digits=input.customerWhatsAppNumber.replace(/\D/g,'');
    if(digits&&(digits.length<8||digits.length>15))errors.push({fieldId:'customer-whatsapp-number',message:'電話格式錯誤'});
    if(digits&&!input.customerWhatsAppTemplate.trim())errors.push({fieldId:'customer-whatsapp-template',message:'訊息模板未填'});
  }
  if(domain==='payments'){
    const ids=new Set<string>();
    input.paymentChannels.forEach((row,index)=>{
      if(!row.id.trim())errors.push({fieldId:'payment-'+index+'-id',message:'付款方式缺少 ID'});
      else if(ids.has(row.id))errors.push({fieldId:'payment-'+index+'-id',message:'付款方式 ID 重複：'+row.id});
      else ids.add(row.id);
      if(!row.name.trim())errors.push({fieldId:'payment-'+row.id+'-name',message:'必須填寫顯示名稱'});
    });
  }
  return errors;
}

export function validateAllStoreSettingsDomains(input:StoreSettingsValidationInput):readonly StoreSettingsDomainError[]{
  const domains:readonly Exclude<StoreSettingsDomain,'home'>[]=['basic','service','tables','hours','timing','reminders','whatsapp','payments','qr','references'];
  return domains.flatMap(domain=>validateStoreSettingsDomain(domain,input).map(error=>({...error,domain})));
}

export const STORE_SETTINGS_DOMAIN_LABELS:Readonly<Record<Exclude<StoreSettingsDomain,'home'>,string>>=Object.freeze({
  basic:'基本資料',service:'服務模式',tables:'堂食枱號',hours:'營業時間',timing:'營運計時',
  reminders:'訂單提醒',whatsapp:'WhatsApp 備援',payments:'電子支付',qr:'QR Code',references:'其他門店設定',
});

export interface WhatsAppTemplateMigrationInput{
  value:string|undefined|null;
  initialized:boolean|undefined;
  defaultValue:string;
}
export function migrateLegacyWhatsAppTemplate(input:WhatsAppTemplateMigrationInput){
  const value=input.value??'';
  if(input.initialized===true)return {value,initialized:true,migrated:false};
  if(value.trim())return {value,initialized:true,migrated:false};
  return {value:input.defaultValue,initialized:true,migrated:true};
}

export interface CanonicalPublishTarget{label:string;path:string}
export function canonicalPublishTargetForError(message:string):CanonicalPublishTarget{
  if(/^員工|^Internal Staff ID|^登入編號/.test(message))return {label:'員工／權限',path:'/admin/staff'};
  if(/^分類/.test(message))return {label:'分類',path:'/admin/catalog/categories'};
  if(/^商品|^Product Code|^停用商品/.test(message))return {label:'商品資料',path:'/admin/catalog/products'};
  if(/^選項|^必選組|^單選組/.test(message))return {label:'選項中心',path:'/admin/catalog/modifiers'};
  if(/^套餐/.test(message))return {label:'套餐',path:'/admin/catalog/combos'};
  return {label:'版本與同步',path:'/admin/publish'};
}
