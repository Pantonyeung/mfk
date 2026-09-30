import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {AdminShell} from './admin-shell.tsx';
import {ADMIN_DESTINATIONS,ADMIN_MENU_GROUPS,destinationForPath} from './navigation.ts';
import {
  ConfirmDialog,
  DataTable,
  DraftBar,
  EmptyState,
  FilterBar,
  FormSection,
  MobileRecordCards,
  PageHeader,
  ReadbackPanel,
  SearchField,
  StatusBadge,
  Timeline,
} from './ui.tsx';

const LOCKED_MENU_LABELS=[
  '今日','訂單監察','菜單管理','營運管理','平台／渠道管理','打印管理',
  '裝置管理','人員與權限','報表','發佈與版本','門店設定','系統管理',
];

describe('Admin V3 shell foundation',()=>{
  it('locks the two-step product map at 12 menus and 53 destinations',()=>{
    expect(ADMIN_MENU_GROUPS.map(menu=>menu.label)).toEqual(LOCKED_MENU_LABELS);
    expect(ADMIN_MENU_GROUPS).toHaveLength(12);
    expect(ADMIN_DESTINATIONS).toHaveLength(53);
    expect(new Set(ADMIN_DESTINATIONS.map(destination=>destination.path)).size).toBe(53);
    expect(ADMIN_MENU_GROUPS.every(menu=>menu.destinations.length>0)).toBe(true);
  });

  it('keeps order monitoring read-only and free of transaction mutation actions',()=>{
    const orderPages=ADMIN_DESTINATIONS.filter(destination=>destination.path.startsWith('/admin/orders/'));
    expect(orderPages).toHaveLength(3);
    expect(orderPages.every(destination=>destination.authority==='read-only')).toBe(true);
    expect(orderPages.map(destination=>destination.primaryAction).join(' ')).not.toMatch(/退款|取消訂單|付款方式修正/);
  });

  it('resolves registered routes and fails closed to the overview skeleton',()=>{
    expect(destinationForPath('/admin/catalog/products').title).toBe('產品管理');
    expect(destinationForPath('/not-a-v3-route').path).toBe('/admin/overview');
  });

  it('renders the locked shared component vocabulary without domain data',()=>{
    const columns=[{key:'name',label:'名稱'},{key:'status',label:'狀態'}];
    const rows=[{name:'示例',status:<StatusBadge tone="unknown">結果未明</StatusBadge>}];
    const markup=renderToStaticMarkup(<>
      <PageHeader eyebrow="菜單管理" title="產品管理" description="工作區骨架"/>
      <SearchField value="" onChange={()=>{}} disabled/>
      <FilterBar><button type="button" disabled>篩選</button></FilterBar>
      <DataTable columns={columns} rows={rows} empty={<EmptyState title="目前未有資料"/>}/>
      <MobileRecordCards columns={columns} rows={rows} empty={<EmptyState title="目前未有資料"/>}/>
      <DraftBar count={2} onReview={()=>{}}/>
      <ConfirmDialog open title="確認發佈此版本？" confirmLabel="確認發佈" onConfirm={()=>{}} onClose={()=>{}}/>
      <ReadbackPanel publishedAt="2026-09-30T14:00:00.000Z" cloud="雲端已發佈" target="結果未明"/>
      <FormSection title="基本資料"><label>名稱<input/></label></FormSection>
      <Timeline items={[{title:'草稿已儲存',time:'14:00'}]}/>
    </>);
    expect(markup).toContain('產品管理');
    expect(markup).toContain('<table');
    expect(markup).toContain('<dialog');
    expect(markup).toContain('雲端已發佈');
    expect(markup).toContain('草稿已儲存');
  });

  it('renders the responsive two-step shell without persisted client state',()=>{
    const markup=renderToStaticMarkup(<AdminShell storeId="MF01" displayName="Owner" releaseStatus={<div>版本一致</div>} canonicalState="fresh" onRefresh={()=>{}} onDiagnostics={()=>{}} onSignOut={()=>{}}/>);
    expect(markup).toContain('aria-label="Admin 功能導覽"');
    expect(markup).toContain('營運總覽');
    expect(markup).toContain('業務資料與操作會按垂直切片正式接駁');
    expect(markup).toContain('MF01');
  });
});
