import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminShell} from './admin-shell.tsx';
import {OrdersPage,ReportPage} from './admin-read-pages.tsx';

describe('Admin V3 read-model functional wave',()=>{
  it('keeps order workspaces searchable/read-only with detail semantics',()=>{
    const open=renderToStaticMarkup(<OrdersPage mode="open"/>);
    const history=renderToStaticMarkup(<OrdersPage mode="history"/>);
    const exceptions=renderToStaticMarkup(<OrdersPage mode="exceptions"/>);
    expect(open).toContain('進行中訂單');
    expect(open).toContain('只讀 Preview');
    expect(history).toContain('訂單歷史');
    expect(exceptions).toContain('商品映射需要確認');
    expect(open).not.toContain('確認退款');
    expect(open).not.toContain('取消訂單');
  });

  it('renders fixed read-only report surfaces',()=>{
    expect(renderToStaticMarkup(<ReportPage mode="sales"/>)).toContain('有效營業額');
    expect(renderToStaticMarkup(<ReportPage mode="products"/>)).toContain('產品');
    expect(renderToStaticMarkup(<ReportPage mode="channels"/>)).toContain('Keeta');
    expect(renderToStaticMarkup(<ReportPage mode="refunds"/>)).toContain('已退款');
    expect(renderToStaticMarkup(<ReportPage mode="operations"/>)).toContain('打印異常');
    expect(renderToStaticMarkup(<ReportPage mode="export"/>)).toContain('Preview 產生匯出');
  });

  it.each([
    ['/admin/orders/open','進行中訂單'],
    ['/admin/orders/history','訂單歷史'],
    ['/admin/orders/exceptions','訂單異常'],
    ['/admin/reports/sales','銷售'],
    ['/admin/reports/products','產品'],
    ['/admin/reports/channels','渠道'],
    ['/admin/reports/refunds','退款'],
    ['/admin/reports/operations','營運'],
    ['/admin/reports/export','匯出'],
  ])('routes %s to implemented read workspace',(path,title)=>{
    const html=renderToStaticMarkup(<AdminShell storeId="PREVIEW" displayName="介面驗收" releaseStatus={<div>UI</div>} canonicalState="fresh" previewMode initialPath={path} onRefresh={()=>{}} onDiagnostics={()=>{}} onSignOut={()=>{}}/>);
    expect(html).toContain(title);
    expect(html).not.toContain('尚未接駁');
  });
});
