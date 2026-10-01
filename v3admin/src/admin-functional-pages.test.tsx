import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminShell} from './admin-shell.tsx';
import {
  ChannelPage,
  PermissionsPage,
  PrintExceptionsPage,
  PrintOverviewPage,
  PrintRulesPage,
  PrintTemplatesPage,
  PrintersPage,
  QuickReasonsPage,
  RolesPage,
  SettlementPage,
  StaffPage,
  StoreSettingsPage,
} from './admin-functional-pages.tsx';
import {usePreviewAdmin} from './preview-admin-store.ts';

describe('Admin V3 functional domain wave',()=>{
  it('renders real print registry, templates and rules',()=>{
    expect(renderToStaticMarkup(<PrintOverviewPage/>)).toContain('打印總覽');
    expect(renderToStaticMarkup(<PrintersPage/>)).toContain('邏輯打印機');
    expect(renderToStaticMarkup(<PrintTemplatesPage/>)).toContain('打印模板');
    expect(renderToStaticMarkup(<PrintRulesPage/>)).toContain('打印規則');
    expect(renderToStaticMarkup(<PrintExceptionsPage/>)).toContain('冇正式 safe-retry contract');
    const state=usePreviewAdmin.getState();
    expect(state.printers.length).toBeGreaterThan(0);
    expect(state.templates.length).toBeGreaterThan(0);
    expect(state.printRules.length).toBeGreaterThan(0);
  });

  it('enforces printer reference guard in preview state',()=>{
    const state=usePreviewAdmin.getState();
    expect(state.removePrinter('logical-receipt')).toBe(false);
  });

  it('renders functional staff, roles and permissions',()=>{
    expect(renderToStaticMarkup(<StaffPage/>)).toContain('員工管理');
    expect(renderToStaticMarkup(<RolesPage/>)).toContain('角色管理');
    expect(renderToStaticMarkup(<PermissionsPage/>)).toContain('權限管理');
    expect(usePreviewAdmin.getState().roles.find(role=>role.id==='OWNER')?.permissions.length).toBeGreaterThan(0);
  });

  it('renders functional store settings, hours and quick reasons',()=>{
    expect(renderToStaticMarkup(<StoreSettingsPage mode="settings"/>)).toContain('門店資料');
    expect(renderToStaticMarkup(<StoreSettingsPage mode="hours"/>)).toContain('星期一');
    expect(renderToStaticMarkup(<StoreSettingsPage mode="business-day"/>)).toContain('營業日分界');
    expect(renderToStaticMarkup(<StoreSettingsPage mode="operations"/>)).toContain('首次提醒');
    expect(renderToStaticMarkup(<QuickReasonsPage/>)).toContain('快捷原因');
  });

  it('renders functional Keeta policies and product mapping',()=>{
    expect(renderToStaticMarkup(<ChannelPage mode="accept"/>)).toContain('正常單自動接單');
    expect(renderToStaticMarkup(<ChannelPage mode="sync"/>)).toContain('同步售罄／供應');
    expect(renderToStaticMarkup(<ChannelPage mode="binding"/>)).toContain('Keeta Provider Shop ID');
    expect(renderToStaticMarkup(<ChannelPage mode="mapping"/>)).toContain('新增映射');
    expect(renderToStaticMarkup(<SettlementPage/>)).toContain('Provider commercial evidence');
    expect(usePreviewAdmin.getState().channelMappings.some(item=>item.productIds.length>0)).toBe(true);
  });

  it.each([
    ['/admin/channels/product-mapping','商品映射'],
    ['/admin/channels/settlement','平台對帳'],
    ['/admin/print','打印總覽'],
    ['/admin/print/printers','邏輯打印機'],
    ['/admin/print/templates','打印模板'],
    ['/admin/print/rules','打印規則'],
    ['/admin/print/exceptions','打印狀態／異常'],
    ['/admin/staff','員工管理'],
    ['/admin/roles','角色管理'],
    ['/admin/permissions','權限管理'],
    ['/admin/store/settings','門店資料'],
    ['/admin/store/hours','營業時間'],
    ['/admin/store/quick-reasons','快捷原因'],
  ])('routes %s to a functional preview workspace', (path,title)=>{
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
    expect(html).toContain('Preview');
    expect(html).not.toContain('尚未接駁');
  });
});
