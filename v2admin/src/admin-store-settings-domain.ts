export type StoreSettingsDomain =
  |'home'|'basic'|'service'|'tables'|'hours'|'timing'|'reminders'|'whatsapp'|'payments'|'references';

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
  references:'/admin/store/settings/references',
} satisfies Record<StoreSettingsDomain,string>);

export function resolveStoreSettingsDomain(pathname:string):StoreSettingsDomain{
  const suffix=pathname.replace(/^\/admin\/store\/settings\/?/,'').split('/')[0]??'';
  return (['basic','service','tables','hours','timing','reminders','whatsapp','payments','references'] as const).includes(suffix as any)
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
    errors.push({fieldId:'dining-overdue-minutes',message:'必須至少 1 分鐘'});
  }
  if(domain==='whatsapp'&&input.customerWhatsAppEnabled){
    const digits=input.customerWhatsAppNumber.replace(/\D/g,'');
    if(digits&&(digits.length<8||digits.length>15))errors.push({fieldId:'customer-whatsapp-number',message:'電話格式錯誤'});
    if(digits&&!input.customerWhatsAppTemplate.trim())errors.push({fieldId:'customer-whatsapp-template',message:'已啟用 WhatsApp 備援時必須填寫訊息模板'});
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
