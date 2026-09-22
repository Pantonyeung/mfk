import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {describe,expect,it} from 'vitest';
import {MfkAdminApp} from './App.tsx';

const render=(path:string)=>renderToStaticMarkup(
  <MemoryRouter initialEntries={[path]}>
    <MfkAdminApp/>
  </MemoryRouter>,
);

describe('MFK Admin complete operational workflows',()=>{
  it('makes Today a useful operating entry and routes real action items',()=>{
    const today=render('/admin/overview');
    expect(today).toContain('每日營運入口');
    expect(today).toContain('營運準備');
    expect(today).toContain('未保存變更');
    expect(today).toContain('最近操作');

    const queue=render('/admin/action-queue');
    expect(queue).toContain('待處理事項');
    expect(queue).toContain('真實 Admin 狀態');
    expect(queue).toContain('未有證據唔可以標記已解決');
  });

  it('uses Save as the immutable active-version boundary',()=>{
    const html=render('/admin/publish');
    for(const marker of ['設定版本歷史','保存','目前版本','版本總數','版本歷史','還原']){
      expect(html).toContain(marker);
    }
    for(const retired of ['待發布變更','確認影響範圍','建立正式設定版本','建立並下載發布檔案','匯入門店回傳','建立新草稿']){
      expect(html).not.toContain(retired);
    }
  });

  it('provides device, OTA and access governance with desired-vs-observed separation',()=>{
    const devices=render('/admin/devices');
    expect(devices).toContain('預期設定／實際狀態');
    expect(devices).toContain('預期設定');
    expect(devices).toContain('裝置目前狀態');

    const ota=render('/admin/ota');
    expect(ota).toContain('版本候選');
    expect(ota).toContain('裝置目前版本');
    expect(ota).toContain('新增版本候選');

    const access=render('/admin/access');
    expect(access).toContain('登入／權限範圍');
    expect(access).toContain('PIN 最少位數');
    expect(access).toContain('可信裝置');
  });

  it('keeps business day and cash close record-only and non-blocking',()=>{
    const day=render('/admin/business-day');
    expect(day).toContain('永遠唔會阻止新交易');
    expect(day).toContain('日結後修改權限');
    const cash=render('/admin/cash-close');
    expect(cash).toContain('永遠唔阻止落單、結帳、付款或本機保存');
    expect(cash).toContain('封存記錄');
  });

  it('provides fixed trusted reports and governed export without fake metrics',()=>{
    expect(render('/admin/reports/products')).toContain('商品報表');
    expect(render('/admin/reports/channels')).toContain('渠道報表');
    expect(render('/admin/reports/refunds')).toContain('退款報表');
    const exp=render('/admin/reports/export');
    expect(exp).toContain('匯出治理');
    expect(exp).toContain('敏感匯出需要 Owner 批准');
    expect(exp).toContain('未有正式報表資料就唔會輸出假資料');
  });

  it('provides diagnostics, integrations and effective settings without fake health',()=>{
    const diagnostics=render('/admin/system/diagnostics');
    expect(diagnostics).toContain('冇證據唔會硬判根因');
    expect(diagnostics).toContain('唔會用假綠燈代替健康證據');
    const integrations=render('/admin/system/integrations');
    expect(integrations).toContain('憑證引用名稱');
    expect(integrations).toContain('防重放時限');
    const settings=render('/admin/system/advanced');
    expect(settings).toContain('目前生效值');
    expect(settings).toContain('安全底線');
  });

  it('keeps operator-facing routes free of superseded engineering transport language',()=>{
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
    const forbidden=/NOT_WIRED|MIGRATION_ONLY|SOURCE_INTENT|TARGET_OBSERVED|Transport Bundle|Readback Receipt|ADMIN CONNECTION|HUMAN CONTROLLED|Domain adapters|OWNER → ADMIN → SMT|Live Mutation|Impact Preview|Expected SMT|Human Compare|Governance Boundary|NO CLOUD|NO HTTP|NO POLLING/i;
    for(const path of paths){
      const html=render(path);
      const visible=html.replace(/<[^>]*>/g,' ');
      expect(visible,path).not.toMatch(forbidden);
    }
  });

  it('exposes the existing Keeta test-token import without persisting token material in Admin state',()=>{
    const channels=render('/admin/channels');
    expect(channels).toContain('已有 Keeta 測試 Token');
    expect(channels).toContain('授權管理');
    expect(channels).toContain('查看 Token');
    expect(channels).toContain('匯入現有測試 Token');
    expect(channels).toContain('唔會寫入 Admin draft、localStorage 或操作記錄');
  });

});
