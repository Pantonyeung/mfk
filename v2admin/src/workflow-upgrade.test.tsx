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
    expect(today).toContain('每日營運入口');
    expect(today).toContain('待處理事項');
    expect(today).toContain('異常或未確認狀態唔會自動阻止交易');

    const queue=render('/admin/action-queue');
    expect(queue).toContain('待處理事項');
    expect(queue).toContain('只作引導');
    expect(queue).toContain('唔會直接改動正式資料');
  });

  it('completes publish governance shape without wiring',()=>{
    const html=render('/admin/publish');
    for(const marker of ['確認影響範圍','門店目前版本','核對結果','建立新版還原','尚未可發布']){
      expect(html).toContain(marker);
    }
  });

  it('adds device, OTA and access governance surfaces',()=>{
    expect(render('/admin/devices')).toContain('設定差異');
    expect(render('/admin/ota')).toContain('裝置目前版本');
    const access=render('/admin/access');
    expect(access).toContain('登入碼');
    expect(access).toContain('可信裝置');
    expect(access).toContain('登出其他登入尚未開放');
  });

  it('keeps business day and cash close record-only and non-blocking',()=>{
    const day=render('/admin/business-day');
    expect(day).toContain('只作記錄；永不阻交易');
    const cash=render('/admin/cash-close');
    expect(cash).toContain('永遠唔會阻止落單、結帳、付款或本機保存');
    expect(cash).toContain('只作記錄');
  });

  it('adds fixed P0 report and governance shapes',()=>{
    expect(render('/admin/reports/products')).toContain('商品報表');
    expect(render('/admin/reports/channels')).toContain('渠道報表');
    expect(render('/admin/reports/refunds')).toContain('退款報表');
    expect(render('/admin/reports/export')).toContain('匯出功能會受權限、資料範圍同私隱規則限制');
  });

  it('adds diagnostics, integrations and effective settings without live execution',()=>{
    expect(render('/admin/system/diagnostics')).toContain('未確認原因之前');
    expect(render('/admin/system/integrations')).toContain('傳送狀態');
    expect(render('/admin/system/advanced')).toContain('目前生效值');
  });

  it('keeps operator-facing routes free of engineering protocol copy',()=>{
    const paths=[
      '/admin/catalog/products',
      '/admin/publish',
      '/admin/overview',
      '/admin/print',
      '/admin/access',
      '/admin/ota',
      '/admin/system/diagnostics',
      '/admin/system/integrations',
    ];
    const forbidden=/NOT_WIRED|MIGRATION_ONLY|SOURCE_INTENT|TARGET_OBSERVED|Transport Bundle|Readback Receipt|ADMIN CONNECTION|HUMAN CONTROLLED|Domain adapters|OWNER → ADMIN → SMT|MFK Admin|Truth Owner|Live Mutation|Validate|Impact Preview|Expected SMT|Human Compare|Governance Boundary|NO CLOUD|NO HTTP|NO POLLING|canonical|mutation authority|root cause/i;
    for(const path of paths){
      const html=render(path);
      const visible=html.replace(/<[^>]*>/g,' ');
      expect(visible,path).not.toMatch(forbidden);
    }
  });
});
