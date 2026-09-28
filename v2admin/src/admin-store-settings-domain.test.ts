import {describe,expect,it} from 'vitest';
import {resolveStoreSettingsDomain,validateStoreSettingsDomain} from './admin-store-settings-domain.ts';

const base={diningOverdueMinutes:35,customerWhatsAppEnabled:true,customerWhatsAppNumber:'',customerWhatsAppTemplate:'預設',diningTables:[],paymentChannels:[]};

describe('Admin Store Settings domain UX',()=>{
  it('maps settings child routes without changing the store settings authority',()=>{
    expect(resolveStoreSettingsDomain('/admin/store/settings')).toBe('home');
    expect(resolveStoreSettingsDomain('/admin/store/settings/tables')).toBe('tables');
    expect(resolveStoreSettingsDomain('/admin/store/settings/payments/PAYME')).toBe('payments');
  });
  it('validates only the active domain',()=>{
    const broken={...base,diningOverdueMinutes:0,customerWhatsAppNumber:'123',customerWhatsAppTemplate:''};
    expect(validateStoreSettingsDomain('tables',broken)).toEqual([]);
    expect(validateStoreSettingsDomain('hours',broken)).toEqual([]);
    expect(validateStoreSettingsDomain('timing',broken)).toEqual([{fieldId:'dining-overdue-minutes',message:'必須至少 1 分鐘'}]);
  });
});
