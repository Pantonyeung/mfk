import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Wave 2 remaining FINAL screens are dedicated routes and no longer generic ToolDrawer implementations',()=>{
  const app=read('src/App.tsx');
  for(const route of ["'/devices'","'/reports'","'/manager-log'","'/checklist'","'/handoff'","'/activity'","'/settings-summary'"]){
    assert.match(app,new RegExp(route.replace('/','\\/')));
  }
  for(const component of ['DeviceHealthPage','ReportsPage','ManagerLogPage','ActivityAuditPage','MoreHubPage','SettingsSummaryPage']){
    assert.match(app,new RegExp('<'+component+'\\b'));
  }
  for(const legacy of ["tool==='devices'","tool==='reports'","tool==='manager'","tool==='activity'","function ManagerWorkspace","<MorePage "]){
    assert.equal(app.includes(legacy),false,'legacy formal screen remained: '+legacy);
  }
});

test('Device screen follows source hierarchy and stays safe when remote device authority is unavailable',()=>{
  const wave2=read('src/source-fidelity-wave2.tsx');
  for(const marker of ['設備狀態','設備詳情','全部','正常','異常','目前狀態','受影響範圍','裝置紀錄']){
    assert.match(wave2,new RegExp(marker));
  }
  assert.match(wave2,/data-safe-unavailable="true"/);
  assert.match(wave2,/遠端診斷暫未開放/);
  assert.match(wave2,/舊打印工作.*唔會.*自動重印/);
  assert.doesNotMatch(wave2,/reprintOrderJobs|commandDevice|testPrint|rebindDevice/);
});

test('Reports screen exposes exactly the fixed R1-R8 family and never creates a BI builder',()=>{
  const wave2=read('src/source-fidelity-wave2.tsx');
  for(const id of ['R1','R2','R3','R4','R5','R6','R7','R8'])assert.match(wave2,new RegExp("id:'"+id+"'"));
  for(const title of ['今日營業','時段分析','商品表現','渠道表現','付款方式','交易調整','員工與工時','營運健康']){
    assert.match(wave2,new RegExp(title));
  }
  assert.match(wave2,/唔提供自由報表編輯器/);
  assert.doesNotMatch(wave2,/customReportBuilder|freeSql|executeReport/);
});

test('Manager Log, Checklist and Handoff never promote local drafts into shared truth',()=>{
  const wave2=read('src/source-fidelity-wave2.tsx');
  const app=read('src/App.tsx');
  for(const route of ["'manager-log'","'checklist'","'handoff'"])assert.match(app,new RegExp(route));
  assert.match(wave2,/正式共享日誌未連接/);
  assert.match(wave2,/新增與回覆暫未開放/);
  assert.match(wave2,/清單操作暫未開放/);
  assert.match(wave2,/交接確認暫未開放/);
  assert.doesNotMatch(wave2,/managerNote|handoffNote|setChecklist|writeOwnerLocalWorkspace/);
  assert.equal(app.includes('function ManagerWorkspace'),false);
});

test('Activity screen is human-readable and keeps machine identifiers out of the first layer',()=>{
  const wave2=read('src/source-fidelity-wave2.tsx');
  for(const marker of ['活動紀錄','全部','重要','系統','篩選','操作人','批核人','時間','結果','對象','備註']){
    assert.match(wave2,new RegExp(marker));
  }
  assert.match(wave2,/技術細節留喺診斷頁/);
  assert.doesNotMatch(wave2,/>{[^}]*correlationId[^}]*}</);
  assert.doesNotMatch(wave2,/>{[^}]*incidentId[^}]*}</);
  assert.doesNotMatch(wave2,/>{[^}]*activityId[^}]*}</);
});

test('More hub follows four source groups and uses final-art slots instead of invented mascots',()=>{
  const wave2=read('src/source-fidelity-wave2.tsx');
  for(const group of ['營運管理','數據分析','店長管理','設定與支援'])assert.match(wave2,new RegExp(group));
  for(const label of ['商品供應','渠道','員工','設備／打印','報表','經理日誌','檢查清單','交接摘要','活動紀錄','設定摘要','前往 Admin']){
    assert.match(wave2,new RegExp(label));
  }
  assert.match(wave2,/data-final-art-slot=/);
  assert.doesNotMatch(wave2,/mascot|character|generatedIp|drawMascot/i);
});

test('Wave 2 normal Owner copy contains zero blocked engineering vocabulary',()=>{
  const sources=[read('src/App.tsx'),read('src/source-fidelity-wave2.tsx')];
  const visible=[];
  for(const source of sources){
    for(const match of source.matchAll(/>([^<>{}\n][^<>{}]*)</g))visible.push(match[1].trim());
    for(const match of source.matchAll(/(?:placeholder|label|title|detail|subtitle|empty|aria-label)="([^"]+)"/g))visible.push(match[1].trim());
    for(const match of source.matchAll(/setNotice\('([^']+)'\)/g))visible.push(match[1].trim());
  }
  const joined=visible.filter(Boolean).join('\n').toLowerCase();
  for(const term of ['canonical','readback','projection','correlation','command seam','oa-','raw engineering','uuid']){
    assert.equal(joined.includes(term),false,'engineering copy leaked: '+term);
  }
});

test('Wave 2 remains touch-safe and responsive down to 360px',()=>{
  const css=read('src/styles.css');
  assert.match(css,/OWNER FINAL SOURCE FIDELITY WAVE2/);
  assert.match(css,/\.wave2-back\{[\s\S]*width:44px;height:44px/);
  assert.match(css,/\.wave2-filter-tabs button,[\s\S]*min-height:44px/);
  assert.match(css,/@media\(max-width:380px\)/);
  assert.match(css,/@media\(max-width:360px\)/);
  for(const selector of ['device-row','report-card','manager-segmented','activity-row','more-group-list']){
    assert.match(css,new RegExp(selector));
  }
});
