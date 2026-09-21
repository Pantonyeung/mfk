import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {describe,expect,it} from 'vitest';
import {MfkAdminApp} from './App.tsx';

const render=(path:string)=>renderToStaticMarkup(
  <MemoryRouter initialEntries={[path]}>
    <MfkAdminApp/>
  </MemoryRouter>,
);

describe('MFK Admin workflow capability upgrade R1',()=>{
  it('deepens Today and adds a routing-only Action Queue',()=>{
    const today=render('/admin/overview');
    expect(today).toContain('唯一每日入口');
    expect(today).toContain('Action Queue');
    expect(today).toContain('Degraded / Unknown 唔會自動變成 transaction blocker');

    const queue=render('/admin/action-queue');
    expect(queue).toContain('Unified Action Queue');
    expect(queue).toContain('ROUTING ONLY');
    expect(queue).toContain('唔持有 mutation authority');
  });

  it('completes publish governance shape without wiring',()=>{
    const html=render('/admin/publish');
    for(const marker of ['Impact Preview','Expected Base Revision','MATCH / PARTIAL / MISMATCH / UNKNOWN','Rollback as New Revision','Publish 未接駁']){
      expect(html).toContain(marker);
    }
  });

  it('adds device, OTA and access governance surfaces',()=>{
    expect(render('/admin/devices')).toContain('Config Drift');
    expect(render('/admin/ota')).toContain('Observed Runtime');
    const access=render('/admin/access');
    expect(access).toContain('PIN');
    expect(access).toContain('Trusted Device');
    expect(access).toContain('Revoke Session 未接駁');
  });

  it('keeps business day and cash close record-only and non-blocking',()=>{
    const day=render('/admin/business-day');
    expect(day).toContain('Record-only；永不阻交易');
    const cash=render('/admin/cash-close');
    expect(cash).toContain('永遠唔可以阻 Order / Checkout / Payment / Local Commit');
    expect(cash).toContain('RECORD ONLY');
  });

  it('adds fixed P0 report and governance shapes',()=>{
    expect(render('/admin/reports/products')).toContain('商品報表');
    expect(render('/admin/reports/channels')).toContain('渠道報表');
    expect(render('/admin/reports/refunds')).toContain('退款報表');
    expect(render('/admin/reports/export')).toContain('Export 只建立 permission / scope / PII / audit evidence shape');
  });

  it('adds diagnostics, integrations and effective settings without live execution',()=>{
    expect(render('/admin/system/diagnostics')).toContain('root cause');
    expect(render('/admin/system/integrations')).toContain('Delivery / DLQ');
    expect(render('/admin/system/advanced')).toContain('effective value / source / optional override / security floor');
  });
});
