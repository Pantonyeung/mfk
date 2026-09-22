import {useMemo,useState} from 'react';
import {useAdminDraft,validateAdminDraft} from './admin-draft.tsx';
import {appendAdminAudit,readAdminAudit,readAdminReleases,readAdminStored,usePersistentAdminState} from './admin-local-store.ts';

function UpgradeHeader({title,description,kicker='功能尚未啟用'}:{title:string;description:string;kicker?:string}){
  return <header className="admin-editor-head">
    <div><small>{kicker}</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions"><button type="button" disabled>即時讀寫尚未開放</button></div>
  </header>;
}

const StateChip=({children}:{children:string})=><span className="admin-not-wired-chip">{children}</span>;

export function ActionQueueWorkspace(){
  const [domain,setDomain]=useState('ALL');
  const [state,setState]=useState('OPEN');
  const sample=useMemo(()=>[
    {id:'AQ-DEMO-001',kind:'發布資料不一致',owner:'後台設定',state:'未確認',route:'/admin/publish'},
    {id:'AQ-DEMO-002',kind:'平台商品對應',owner:'Channel',state:'部分完成',route:'/admin/channels/mapping-failure'},
    {id:'AQ-DEMO-003',kind:'打印機狀態',owner:'裝置／打印',state:'資料過期',route:'/admin/devices'},
  ],[]);
  return <section className="admin-editor-page">
    <UpgradeHeader title="待處理事項" description="集中顯示需要處理嘅事項，並帶你去相應頁面；呢度唔會直接改動正式資料。"/>
    <div className="admin-filterbar">
      <select value={domain} onChange={event=>setDomain(event.target.value)}><option value="ALL">全部範圍</option><option value="CONFIG">設定</option><option value="CHANNEL">平台</option><option value="DEVICE">裝置／打印</option><option value="ORDER">訂單</option></select>
      <select value={state} onChange={event=>setState(event.target.value)}><option value="OPEN">待處理</option><option value="未確認">未確認</option><option value="部分完成">部分完成</option><option value="資料過期">資料過期</option></select>
      <button type="button" disabled>重新整理尚未開放</button>
    </div>
    <section className="admin-read-table">
      <header><span>事項</span><span>負責範圍</span><span>狀態</span><span>前往頁面</span><span>操作權限</span></header>
      {sample.map(row=><div className="admin-policy-row" key={row.id}><span>{row.kind}<small>{row.id}</small></span><span>{row.owner}</span><span>{row.state}</span><a href={row.route}>前往責任頁</a><StateChip>只作引導</StateChip></div>)}
    </section>
    <section className="admin-rule-card"><h2>處理原則</h2><p>未收到正式回傳之前，一律保持「未確認」、「部分完成」或「資料過期」；唔可以喺呢度自行標記完成。</p></section>
  </section>;
}

export function DeviceHealthWorkspace(){
  const [profile,setProfile]=useState('門店前線');
  return <section className="admin-editor-page">
    <UpgradeHeader title="裝置管理" description="顯示裝置設定、信任狀態、版本同設定差異；目前只提供管理介面。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>預期設定</h2><label><span>裝置類型</span><select value={profile} onChange={e=>setProfile(e.target.value)}><option>門店前線</option><option>管理人員流動裝置</option><option>後台工作站</option></select></label><StateChip>未發布草稿</StateChip></article>
      <article className="admin-policy-card"><h2>裝置目前狀態</h2><div className="admin-read-empty">裝置狀態尚未啟用</div></article>
      <article className="admin-policy-card"><h2>設定差異</h2><p>比較預期同實際版本、裝置類型同信任狀態。</p><StateChip>需要裝置回傳</StateChip></article>
      <article className="admin-policy-card"><h2>信任／移除</h2><button disabled>移除裝置尚未開放</button><small>正式移除會由權限系統處理。</small></article>
    </div>
  </section>;
}

export function OtaWorkspace(){
  return <section className="admin-editor-page">
    <UpgradeHeader title="版本更新" description="管理已批准版本、安裝狀態同還原記錄；目前唔會直接執行安裝。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>已批准版本</h2><label><span>版本</span><input placeholder="例如 1.0.7"/></label><label><span>版本驗證碼</span><input placeholder="版本驗證碼"/></label><StateChip>只保存草稿</StateChip></article>
      <article className="admin-policy-card"><h2>安裝</h2><button disabled>安裝尚未開放</button><small>相關安裝功能尚未啟用。</small></article>
      <article className="admin-policy-card"><h2>裝置目前版本</h2><div className="admin-read-empty">版本回傳尚未啟用</div></article>
      <article className="admin-policy-card"><h2>還原</h2><button disabled>還原尚未開放</button><small>只會喺版本不一致或安裝失敗後提供還原。</small></article>
    </div>
  </section>;
}

export function CashCloseRecordWorkspace(){
  const [opening,setOpening]=useState('');
  const [counted,setCounted]=useState('');
  const [note,setNote]=useState('');
  return <section className="admin-editor-page">
    <UpgradeHeader title="現金／收舖記錄" description="只做現金同收舖記錄；同營業日一樣只作提示同交接，永遠唔會阻止落單、結帳、付款或本機保存。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>開舖記錄</h2><label><span>開舖現金</span><input inputMode="decimal" value={opening} onChange={e=>setOpening(e.target.value)} placeholder="0.00"/></label><StateChip>只作記錄</StateChip></article>
      <article className="admin-policy-card"><h2>收舖預覽</h2><div className="admin-read-empty">預期現金資料尚未啟用</div><small>任何差異或待處理事項只會提示，唔會阻止交易。</small></article>
      <article className="admin-policy-card"><h2>點算／交更草稿</h2><label><span>點算現金</span><input inputMode="decimal" value={counted} onChange={e=>setCounted(e.target.value)} placeholder="0.00"/></label><label><span>備註</span><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="交更備註"/></label><StateChip>只保存今次草稿</StateChip></article>
      <article className="admin-policy-card"><h2>收舖記錄</h2><button disabled>保存收舖記錄尚未開放</button><small>唔會停止門店交易。</small></article>
    </div>
  </section>;
}

export function AccessSessionWorkspace(){
  const [scope,setScope]=useState('STORE');
  const [pin,setPin]=useState('');
  return <section className="admin-editor-page">
    <UpgradeHeader title="登入／權限範圍" description="管理後台登入、登入碼、權限範圍、登入狀態同可信裝置；正式權限由系統統一處理。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>登入碼草稿</h2><label><span>登入碼</span><input inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))} placeholder="4–8 digits"/></label><StateChip>未保存</StateChip></article>
      <article className="admin-policy-card"><h2>權限範圍</h2><label><span>範圍</span><select value={scope} onChange={e=>setScope(e.target.value)}><option value="STORE">單店</option><option value="MULTI_STORE">多店</option><option value="REPORT_ONLY">只看報表</option></select></label><div className="admin-read-empty">權限資料尚未啟用</div></article>
      <article className="admin-policy-card"><h2>後台登入狀態</h2><div className="admin-read-empty">登入狀態尚未啟用</div><button disabled>登出其他登入尚未開放</button></article>
      <article className="admin-policy-card"><h2>可信裝置</h2><div className="admin-read-empty">可信裝置資料尚未啟用</div><button disabled>移除裝置尚未開放</button></article>
    </div>
  </section>;
}

function FixedReport({title,metrics}:{title:string;metrics:readonly string[]}){
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  return <section className="admin-editor-page">
    <UpgradeHeader title={title} description="固定可信報表只讀取正式資料，後台唔會自行重算交易結果。"/>
    <div className="admin-filterbar"><label><span>由</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button disabled>讀取未接駁</button></div>
    <div className="admin-kpi-grid">{metrics.map(metric=><article key={metric}><span>{metric}</span><strong>—</strong><small>尚未啟用</small></article>)}</div>
    <section className="admin-rule-card"><h2>資料狀態</h2><p>資料版本：—　完整度：未提供　更新狀態：未確認</p><StateChip>只供查看</StateChip></section>
  </section>;
}

export const ProductReportWorkspace=()=> <FixedReport title="商品報表" metrics={['Units','Sales','銷售佔比 %','最高銷量商品']}/>;
export const ChannelReportWorkspace=()=> <FixedReport title="渠道報表" metrics={['Orders','Gross','平台資料','Exceptions']}/>;
export const RefundReportWorkspace=()=> <FixedReport title="退款報表" metrics={['申請','已批准','已拒絕','未確認']}/>;

export function ExportGovernanceWorkspace(){
  const [scope,setScope]=useState('REPORT_CURRENT_FILTER');
  const [includePii,setIncludePii]=useState(false);
  return <section className="admin-editor-page">
    <UpgradeHeader title="匯出治理" description="匯出功能會受權限、資料範圍同私隱規則限制；目前匯出服務尚未啟用。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>匯出範圍</h2><label><span>範圍</span><select value={scope} onChange={e=>setScope(e.target.value)}><option value="REPORT_CURRENT_FILTER">目前報表篩選</option><option value="STORE_DAY">門店／日期</option><option value="AUDIT_RANGE">操作記錄範圍</option></select></label><label className="admin-toggle"><input type="checkbox" checked={includePii} onChange={e=>setIncludePii(e.target.checked)}/><span>包含個人資料欄位</span></label></article>
      <article className="admin-policy-card"><h2>記錄</h2><div className="admin-read-empty">匯出權限同記錄尚未啟用</div><button disabled>匯出尚未開放</button></article>
    </div>
  </section>;
}

export function DiagnosticsWorkspace(){
  return <section className="admin-editor-page">
    <UpgradeHeader title="系統狀態" description="顯示系統異常、相關記錄同修復證據。未確認原因之前會保持「未確認」，呢度唔會直接改動正式資料。"/>
    <div className="admin-kpi-grid"><article><span>健康狀態</span><strong>—</strong><small>未確認</small></article><article><span>第一個異常</span><strong>—</strong><small>尚未啟用</small></article><article><span>修復證據</span><strong>—</strong><small>尚未啟用</small></article><article><span>記錄編號</span><strong>—</strong><small>尚未啟用</small></article></div>
    <section className="admin-read-table"><header><span>發現</span><span>範圍</span><span>狀態</span><span>記錄</span><span>操作</span></header><div className="admin-read-empty">系統狀態資料尚未啟用</div></section>
  </section>;
}

export function IntegrationsGovernanceWorkspace(){
  return <section className="admin-editor-page">
    <UpgradeHeader title="外部連接" description="只顯示外部連接所需設定同狀態；目前唔會連接任何平台。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>連接憑證狀態</h2><div className="admin-read-empty">連接憑證資料尚未啟用</div><small>唔會喺畫面顯示或保存秘密資料。</small></article>
      <article className="admin-policy-card"><h2>接收安全設定</h2><div className="admin-read-empty">接收安全資料尚未啟用</div></article>
      <article className="admin-policy-card"><h2>資料格式</h2><div className="admin-read-empty">平台資料格式尚未啟用</div></article>
      <article className="admin-policy-card"><h2>傳送狀態</h2><div className="admin-read-empty">傳送狀態尚未啟用</div></article>
    </div>
  </section>;
}

export function EffectiveSettingsWorkspace(){
  const [override,setOverride]=useState('');
  return <section className="admin-editor-page">
    <UpgradeHeader title="進階設定" description="顯示目前生效值、來源同可選覆寫；只提供設定介面。"/>
    <section className="admin-read-table"><header><span>設定項目</span><span>目前生效值</span><span>來源</span><span>最低限制</span><span>覆寫草稿</span></header>
      <div className="admin-policy-row"><span>範例規則</span><span>—</span><span>尚未啟用</span><span>安全底線</span><input value={override} onChange={e=>setOverride(e.target.value)} placeholder="可選覆寫"/></div>
    </section>
    <div className="admin-editor-actions"><button disabled>發布設定尚未開放</button></div>
  </section>;
}
