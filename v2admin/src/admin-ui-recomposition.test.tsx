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

  it('keeps each page and nested product editors collapsed until requested',()=>{
    const page=render('/admin/catalog/products');
    expect(page).toContain('class="mfk-admin-focus-workspace"');
    expect(page).not.toContain('class="mfk-admin-focus-workspace" open=""');
    expect(page).not.toContain('class="admin-product-section" open=""');
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
