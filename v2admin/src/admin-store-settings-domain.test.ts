import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {canonicalPublishTargetForError,migrateLegacyWhatsAppTemplate,resolveStoreSettingsDomain,validateAllStoreSettingsDomains,validateStoreSettingsDomain} from './admin-store-settings-domain.ts';

const base={diningOverdueMinutes:35,customerWhatsAppEnabled:true,customerWhatsAppNumber:'85291234567',customerWhatsAppTemplate:'預設',diningTables:[],paymentChannels:[]};

describe('Admin Store Settings domain UX',()=>{
  it('maps settings child routes including the independent QR domain',()=>{
    expect(resolveStoreSettingsDomain('/admin/store/settings')).toBe('home');
    expect(resolveStoreSettingsDomain('/admin/store/settings/tables')).toBe('tables');
    expect(resolveStoreSettingsDomain('/admin/store/settings/payments/PAYME')).toBe('payments');
    expect(resolveStoreSettingsDomain('/admin/store/settings/qr')).toBe('qr');
  });
  it('validates only the active domain',()=>{
    const broken={...base,diningOverdueMinutes:0,customerWhatsAppNumber:'123',customerWhatsAppTemplate:''};
    expect(validateStoreSettingsDomain('tables',broken)).toEqual([]);
    expect(validateStoreSettingsDomain('hours',broken)).toEqual([]);
    expect(validateStoreSettingsDomain('timing',broken)).toEqual([{fieldId:'dining-overdue-minutes',message:'堂食超時必須至少 1 分鐘'}]);
  });
  it('migrates only uninitialized legacy empty WhatsApp templates',()=>{
    expect(migrateLegacyWhatsAppTemplate({value:'',initialized:undefined,defaultValue:'DEFAULT'})).toEqual({value:'DEFAULT',initialized:true,migrated:true});
    expect(migrateLegacyWhatsAppTemplate({value:'   ',initialized:false,defaultValue:'DEFAULT'})).toEqual({value:'DEFAULT',initialized:true,migrated:true});
  });
  it('preserves an intentional user-cleared WhatsApp template once initialized',()=>{
    expect(migrateLegacyWhatsAppTemplate({value:'',initialized:true,defaultValue:'DEFAULT'})).toEqual({value:'',initialized:true,migrated:false});
  });
  it('reports cross-domain canonical blockers with their real domain',()=>{
    const errors=validateAllStoreSettingsDomains({...base,diningOverdueMinutes:0,customerWhatsAppTemplate:''});
    expect(errors).toEqual(expect.arrayContaining([
      {domain:'timing',fieldId:'dining-overdue-minutes',message:'堂食超時必須至少 1 分鐘'},
      {domain:'whatsapp',fieldId:'customer-whatsapp-template',message:'訊息模板未填'},
    ]));
  });
  it('maps non-store canonical errors to navigable settings',()=>{
    expect(canonicalPublishTargetForError('員工 A 未填名稱')).toEqual({label:'員工／權限',path:'/admin/staff'});
    expect(canonicalPublishTargetForError('商品 P1 未填價格')).toEqual({label:'商品資料',path:'/admin/catalog/products'});
  });
  it('reuses the existing payment channel and upload authority for QR',()=>{
    const source=readFileSync(new URL('./PolicyWorkspaces.tsx',import.meta.url),'utf8');
    expect(source).toContain("domain==='qr'");
    expect(source).toContain('customerPaymentChannels');
    expect(source).toContain('uploadAdminPaymentQr');
    expect(source).not.toContain("qr-code.v1");
  });
  it('keeps current-domain inline focus and cross-domain navigation contracts',()=>{
    const source=readFileSync(new URL('./PolicyWorkspaces.tsx',import.meta.url),'utf8');
    expect(source).toContain("node?.scrollIntoView({behavior:'smooth',block:'center'})");
    expect(source).toContain("node?.focus({preventScroll:true})");
    expect(source).toContain('publishBlockers.map');
    expect(source).toContain('前往設定');
  });
});
