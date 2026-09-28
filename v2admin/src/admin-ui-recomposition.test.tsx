import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {describe,expect,it} from 'vitest';
import {MfkAdminApp} from './App.tsx';
import {deriveAdminSyncPresentation} from './AdminShell.tsx';
import {AdminResponsiveDataView} from './AdminResponsiveDataView.tsx';

const render=(path:string)=>renderToStaticMarkup(
  <MemoryRouter initialEntries={[path]}><MfkAdminApp/></MemoryRouter>,
);

describe('Admin UI recomposition',()=>{
  it('uses operator-oriented primary navigation while preserving route entry points',()=>{
    const html=render('/admin/catalog/pricing');
    for(const label of ['今日','訂單','菜單','營運','渠道','人員','報表','設定'])expect(html).toContain(label);
    expect(html).toContain('aria-label="手機主要功能"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('版本與同步');
    expect(html).toContain('/admin/publish');
  });

  it('keeps the route workspace visible and progressively reveals nested product editors',()=>{
    const page=render('/admin/catalog/products');
    expect(page).toContain('class="mfk-admin-focus-workspace"');
    expect(page).toContain('class="mfk-admin-focus-header"');
    expect(page).not.toContain('<details class="mfk-admin-focus-workspace"');
    expect(page).not.toContain('商品詳細資料');
  });

  it('bounds the initial pricing editor and names every visible price field',()=>{
    const html=render('/admin/catalog/pricing');
    expect(html).toContain('顯示 1–25 / 203 件商品');
    expect(html).toContain('aria-label="件商品分頁"');
    expect((html.match(/class="admin-table-field"/g)??[]).length).toBe(50);
    expect((html.match(/placeholder="0.00"/g)??[]).length).toBe(50);
  });

  it('renders one semantic data table that can become labelled mobile records',()=>{
    const html=renderToStaticMarkup(<AdminResponsiveDataView
      label="測試訂單"
      rows={[{id:'order-1',state:'READY'}]}
      rowKey={row=>row.id}
      emptyDescription="未有資料"
      columns={[
        {key:'id',label:'訂單',render:row=>row.id},
        {key:'state',label:'狀態',render:row=>row.state},
      ]}
    />);
    expect(html).toContain('<table>');
    expect(html).toContain('<caption class="admin-visually-hidden">測試訂單</caption>');
    expect(html).toContain('data-label="訂單"');
    expect(html).toContain('data-label="狀態"');
  });

  it('turns store settings into a first-level domain chooser instead of one long form',()=>{
    const home=render('/admin/store/settings');
    for(const label of ['基本資料','服務模式','堂食枱號','營業時間','營運計時','訂單提醒','WhatsApp 備援','電子支付'])expect(home).toContain(label);
    expect(home).not.toContain('堂食超時變紅（分鐘）');
    const timing=render('/admin/store/settings/timing');
    expect(timing).toContain('‹ 門店設定');
    expect(timing).toContain('堂食超時變紅（分鐘）');
    expect(timing).not.toContain('Customer WhatsApp 備援');
    const payments=render('/admin/store/settings/payments');
    expect(payments).toContain('AlipayHK');
    expect(payments).not.toContain('付款 QR 圖');
  });

  it('keeps channel routes task-scoped instead of repeating mapping and every policy form',()=>{
    const mapping=render('/admin/channels/product-mapping');
    expect(mapping).toContain('商品對應');
    expect(mapping).not.toContain('正常單自動接單');
    expect(mapping).not.toContain('佣金估算 %');
    const accept=render('/admin/channels/accept-policy');
    expect(accept).toContain('正常單自動接單');
    expect(accept).not.toContain('<h2>商品對應</h2>');
    expect(accept).not.toContain('佣金估算 %');
  });

  it('keeps staff and print templates collapsed until one object is chosen',()=>{
    const staff=render('/admin/staff');
    expect(staff).not.toContain('PIN（4–8 位）');
    const templates=render('/admin/print/templates');
    expect(templates).toContain('收據');
    expect(templates).toContain('製作單');
    expect(templates).not.toContain('<textarea');
  });

  it('keeps inventory mutation forms behind an operation chooser',()=>{
    const inventory=render('/admin/operations/inventory');
    expect(inventory).toContain('記錄數量變動');
    expect(inventory).toContain('新增統計項目');
    expect(inventory).not.toContain('原因／備註（可選）');
    expect(inventory).not.toContain('低庫存提示值（可選）');
  });

  it('keeps presentation forms behind a purpose-first chooser',()=>{
    const customer=render('/admin/presentation/customer-home');
    expect(customer).toContain('自家落單渠道');
    expect(customer).toContain('內容');
    expect(customer).toContain('版面');
    expect(customer).not.toContain('快捷商品 ID（逗號分隔）');
    expect(customer).not.toContain('主標題</span><input');
    const frontline=render('/admin/presentation/frontline-ordering');
    expect(frontline).toContain('內容');
    expect(frontline).toContain('版面');
    expect(frontline).not.toContain('快捷商品 ID（逗號分隔）');
  });

  it('keeps logical printer forms collapsed until one printer is chosen',()=>{
    const printCenter=render('/admin/print');
    expect(printCenter).toContain('收據機');
    expect(printCenter).toContain('廚房製作單機');
    expect(printCenter).not.toContain('紙寬／標籤寬 mm');
  });

  it('only reports SMT success for a matching revision and fingerprint readback',()=>{
    const activeRelease={version:12,createdAt:'2026-09-22T00:00:00.000Z',fingerprint:'fp-12'};
    const published={state:'PUBLISHED' as const,revision:12,fingerprint:'fp-12',updatedAt:'2026-09-22T00:00:01.000Z'};
    const mismatched=deriveAdminSyncPresentation({
      activeRelease,status:published,online:true,
      acks:[{revision:11,fingerprint:'fp-11',deviceId:'SMT-01',appliedAt:'2026-09-22T00:00:02.000Z'}],
    });
    expect(mismatched.tone).toBe('warning');
    expect(mismatched.detail).toContain('等待 matching SMT 回讀');

    const matched=deriveAdminSyncPresentation({
      activeRelease,status:published,online:true,
      acks:[{revision:12,fingerprint:'fp-12',deviceId:'SMT-01',appliedAt:'2026-09-22T00:00:02.000Z'}],
    });
    expect(matched).toEqual({tone:'success',title:'R12',detail:'SMT 已套用 · SMT-01'});
  });
});
