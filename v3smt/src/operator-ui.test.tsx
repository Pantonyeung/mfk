import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
import {MfpUnavailableState} from './operator-ui.tsx';
import {MfpMoreWorkspace,MfpOperationsNavigation} from './order-operations-workspace.tsx';

// Catches dead-end screens that omit the operator's recovery action.
describe('Operator navigation and recovery',()=>{
  it('keeps unavailable details secondary and gives a connection-check action',()=>{
    const html=renderToStaticMarkup(<MfpUnavailableState title="訂單未連接" description="請檢查門店連線" code="BINDING_UNAVAILABLE" onCheckConnection={()=>{}}/>);
    expect(html).toContain('訂單未連接');
    expect(html).toContain('檢查連線');
    expect(html).toContain('<details>');
    expect(html).toContain('技術資料');
    expect(html).not.toContain('重新讀取');
  });
  it('offers retry only when a real retry action is supplied',()=>{
    const html=renderToStaticMarkup(<MfpUnavailableState title="菜單未連接" description="請重試" onRetry={()=>{}}/>);
    expect(html).toContain('重新讀取');
    expect(html).not.toContain('檢查連線');
  });
  it.each(['MFP_PAD','MFP_MOBILE'] as const)('has five operator destinations and no Home or Cart on %s',surface=>{
    const html=renderToStaticMarkup(<MfpOperationsNavigation surface={surface} active="PENDING" onNavigate={vi.fn()}/>);
    expect(html.match(/<button\b/g)).toHaveLength(5);
    for(const label of ['待處理','點單','訂單','堂食','設定'])expect(html).toContain(label);
    expect(html).not.toContain('首頁');expect(html).not.toContain('購物車');
  });
  it('makes unbound Money tools explicitly unavailable while retaining availability settings',()=>{
    const html=renderToStaticMarkup(<MfpMoreWorkspace onTool={vi.fn()}/>);
    for(const name of ['日結','報表'])expect(html).toMatch(new RegExp(`<button[^>]*disabled[^>]*><b>${name}</b><small>尚未接駁`));
    expect(html).toContain('售罄與產能');expect(html).toContain('連線檢查');
    expect(html).not.toContain('HK$0.00');
  });
});
