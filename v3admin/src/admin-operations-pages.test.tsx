import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminShell} from './admin-shell.tsx';
import {AccessPage,BusinessDayPage,CapacityPage,CashClosePage,DevicesPage,OtaPage,PublishFlowPage} from './admin-operations-pages.tsx';
import {usePreviewAdmin} from './preview-admin-store.ts';

describe('Admin V3 operations/governance functional wave',()=>{
  it('renders operational workflows with real preview state',()=>{
    expect(renderToStaticMarkup(<BusinessDayPage/>)).toContain('營業日');
    expect(renderToStaticMarkup(<CashClosePage/>)).toContain('系統預計現金');
    expect(renderToStaticMarkup(<CapacityPage/>)).toContain('飯糰每日產能');
    expect(usePreviewAdmin.getState().capacityPools.length).toBeGreaterThan(0);
  });

  it('renders devices and approved OTA governance without production mutation',()=>{
    expect(renderToStaticMarkup(<DevicesPage/>)).toContain('SMT-01');
    expect(renderToStaticMarkup(<OtaPage/>)).toContain('候選版本');
    expect(renderToStaticMarkup(<OtaPage/>)).toContain('Preview 唔會向真機 OTA');
  });

  it('renders session and trusted-device governance',()=>{
    const html=renderToStaticMarkup(<AccessPage/>);
    expect(html).toContain('撤銷登入工作階段');
    expect(html).toContain('受信任裝置');
  });

  it('renders five-stage publish workflow',()=>{
    const html=renderToStaticMarkup(<PublishFlowPage mode="publish"/>);
    expect(html).toContain('Draft → Validate → Impact → Publish → Readback');
    expect(html).toContain('檢查完整性');
    expect(html).toContain('草稿');
    expect(html).toContain('回讀確認完成');
  });

  it.each([
    ['/admin/business-day','營業日'],
    ['/admin/cash-close','現金／收舖'],
    ['/admin/operations/capacity','產能／原料額度'],
    ['/admin/devices','裝置狀態'],
    ['/admin/ota','OTA／版本'],
    ['/admin/access','登入／工作階段／受信任裝置'],
    ['/admin/publish/pending','未發佈變更'],
    ['/admin/publish','發佈中心'],
    ['/admin/publish/versions','版本／回讀確認'],
    ['/admin/publish/rollback','回復版本'],
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
    expect(html).not.toContain('尚未接駁');
  });
});
