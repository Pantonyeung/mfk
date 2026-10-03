import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminShell} from './admin-shell.tsx';
import {AuditPage,DiagnosticsPage,EffectiveSettingsPage,IntegrationsPage,TodayPage} from './admin-system-pages.tsx';

describe('Admin V3 today/system functional wave',()=>{
  it('renders Today home and action queue from shared preview state',()=>{
    const overview=renderToStaticMarkup(<TodayPage mode="overview"/>);
    const queue=renderToStaticMarkup(<TodayPage mode="queue"/>);
    expect(overview).toContain('今日有效營業額');
    expect(overview).toContain('未發佈變更');
    expect(queue).toContain('Action Queue');
    expect(queue).toContain('前往責任頁');
  });

  it('renders audit diagnostics integrations and effective settings',()=>{
    expect(renderToStaticMarkup(<AuditPage/>)).toContain('Immutable-style');
    expect(renderToStaticMarkup(<DiagnosticsPage/>)).toContain('第一個異常點');
    expect(renderToStaticMarkup(<IntegrationsPage/>)).toContain('SMT Store Kernel');
    expect(renderToStaticMarkup(<EffectiveSettingsPage/>)).toContain('前往原設定頁');
  });

  it.each([
    ['/admin/overview','營運總覽'],
    ['/admin/action-queue','待處理事項'],
    ['/admin/system/audit','操作記錄'],
    ['/admin/system/diagnostics','系統診斷'],
    ['/admin/system/integrations','系統整合'],
    ['/admin/system/advanced','進階／實際生效設定'],
  ])('routes %s to functional workspace',(path,title)=>{
    const html=renderToStaticMarkup(<AdminShell storeId="PREVIEW" displayName="介面驗收" releaseStatus={<div>UI</div>} canonicalState="fresh" previewMode initialPath={path} onRefresh={()=>{}} onDiagnostics={()=>{}} onSignOut={()=>{}}/>);
    expect(html).toContain(title);
    expect(html).not.toContain('尚未接駁');
  });
});
