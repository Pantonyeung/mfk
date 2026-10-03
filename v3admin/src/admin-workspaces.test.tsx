import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminShell} from './admin-shell.tsx';
import {AdminWorkspace,adminWorkspaceCoverage} from './admin-workspaces.tsx';
import {ADMIN_DESTINATIONS} from './navigation.ts';

describe('Admin V3 whole-admin preview coverage',()=>{
  it('covers every current navigation destination including restored table management',()=>{
    const coverage=adminWorkspaceCoverage();
    expect(coverage.total).toBe(55);
    expect(coverage.implemented).toBe(55);
    expect(coverage.missing).toEqual([]);
  });

  it.each([
    ['/admin/overview','營運總覽'],
    ['/admin/orders/open','進行中訂單'],
    ['/admin/catalog/categories','分類管理'],
    ['/admin/catalog/pricing','價格管理'],
    ['/admin/business-day','營業日'],
    ['/admin/channels/product-mapping','商品映射'],
    ['/admin/print/printers','邏輯打印機'],
    ['/admin/devices','裝置狀態'],
    ['/admin/staff','員工管理'],
    ['/admin/reports/sales','銷售'],
    ['/admin/publish','發佈中心'],
    ['/admin/store/settings','門店資料'],
    ['/admin/system/diagnostics','系統診斷'],
  ])('renders implemented public-preview workspace for %s', (path,title)=>{
    const html=renderToStaticMarkup(<AdminWorkspace path={path} previewMode/>);
    expect(html).toContain(title);
    expect(html).toContain('Admin V3 全域公網實作');
    expect(html).not.toContain('尚未接駁');
  });

  it.each([
    ['/admin/catalog/categories','分類管理'],
    ['/admin/catalog/modifiers','選項／口味管理'],
    ['/admin/catalog/combos','套餐管理'],
    ['/admin/catalog/pricing','價格管理'],
    ['/admin/catalog/menu-display','顯示與排序'],
    ['/admin/store/tables','餐桌管理'],
  ])('routes dedicated functional workspace for %s', (path,title)=>{
    const html=renderToStaticMarkup(<AdminShell
      storeId="PREVIEW"
      displayName="介面驗收"
      releaseStatus={<div>UI</div>}
      canonicalState="fresh"
      previewMode
      initialPath={path}
      onRefresh={()=>{}}
      onDiagnostics={()=>{}}
      onSignOut={()=>{}}
    />);
    expect(html).toContain(title);
    expect(html).not.toContain('尚未接駁');
  });

  it('routes all 55 destinations to dedicated functional preview workspaces',()=>{
    expect(ADMIN_DESTINATIONS).toHaveLength(55);
    for(const destination of ADMIN_DESTINATIONS){
      const html=renderToStaticMarkup(<AdminShell
        storeId="PREVIEW"
        displayName="介面驗收"
        releaseStatus={<div>UI</div>}
        canonicalState="fresh"
        previewMode
        initialPath={destination.path}
        onRefresh={()=>{}}
        onDiagnostics={()=>{}}
        onSignOut={()=>{}}
      />);
      expect(html,destination.path).not.toContain('Admin V3 全域公網實作');
      expect(html,destination.path).not.toContain('尚未接駁');
      expect(html,destination.path).toContain(destination.title);
    }
  });

  it('keeps transaction monitoring read-only in Admin preview',()=>{
    const html=renderToStaticMarkup(<AdminWorkspace path="/admin/orders/open" previewMode/>);
    expect(html).toContain('只讀');
    expect(html).not.toContain('確認退款');
    expect(html).not.toContain('取消訂單');
    expect(html).not.toContain('修改付款');
  });
});
