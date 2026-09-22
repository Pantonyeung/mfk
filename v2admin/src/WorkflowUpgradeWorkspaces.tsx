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
  const {draft,dirty}=useAdminDraft();
  const [domain,setDomain]=useState('ALL');
  const errors=validateAdminDraft(draft);
  const releases=readAdminReleases();
  const mappings=readAdminStored<Array<{providerItemId:string;status:string}>>('channel-mapping.keeta.v1',[]);
  const printers=readAdminStored<Array<{id:string;name:string;active:boolean}>>('logical-printers.v1',[]);
  const devices=readAdminStored<Array<{id:string;state:string;lastSeenAt?:string}>>('devices-read.v1',[]);
  const queue=useMemo(()=>{
    const rows:{id:string;kind:string;owner:string;state:string;route:string}[]=[];
    if(errors.length)rows.push({id:'AQ-CATALOG',kind:'菜單資料有 '+errors.length+' 項問題',owner:'菜單',state:'待處理',route:'/admin/catalog/products'});
    if(dirty)rows.push({id:'AQ-PUBLISH',kind:'有未建立設定版本嘅變更',owner:'菜單',state:'待處理',route:'/admin/publish'});
    if(!releases.length)rows.push({id:'AQ-RELEASE',kind:'未有正式設定版本',owner:'菜單',state:'待處理',route:'/admin/publish'});
    const pendingMappings=mappings.filter(row=>row.status==='PENDING').length;
    if(pendingMappings)rows.push({id:'AQ-MAPPING',kind:pendingMappings+' 個平台商品待對應',owner:'平台',state:'待處理',route:'/admin/channels/mapping-failure'});
    if(!printers.length)rows.push({id:'AQ-PRINT',kind:'未建立 Logical Printer',owner:'打印',state:'待處理',route:'/admin/print'});
    const stale=devices.filter(row=>row.state==='STALE'||row.state==='UNKNOWN').length;
    if(stale)rows.push({id:'AQ-DEVICE',kind:stale+' 部裝置狀態未確認',owner:'裝置',state:'未確認',route:'/admin/devices'});
    return rows;
  },[errors.length,dirty,releases.length,mappings,printers.length,devices]);
  const filtered=queue.filter(row=>domain==='ALL'||row.owner===domain);
  return <section className="admin-editor-page">
    <UpgradeHeader title="待處理事項" description="由真實 Admin 狀態聚合需要處理嘅事項，再帶去責任頁；呢度唔直接改正式資料。" kicker="真實 Admin 狀態"/>
    <div className="admin-filterbar"><select value={domain} onChange={event=>setDomain(event.target.value)}><option value="ALL">全部範圍</option>{['菜單','平台','打印','裝置'].map(item=><option key={item} value={item}>{item}</option>)}</select><span>{filtered.length} 項</span></div>
    {filtered.length===0?<div className="admin-read-empty">目前冇 Admin 端待處理事項。</div>:<section className="admin-read-table"><header><span>事項</span><span>負責範圍</span><span>狀態</span><span>前往頁面</span><span>操作</span></header>{filtered.map(row=><article key={row.id}><span>{row.kind}</span><span>{row.owner}</span><span>{row.state}</span><a href={row.route}>前往責任頁</a><StateChip>只作分流</StateChip></article>)}</section>}
    <section className="admin-rule-card"><h2>處理原則</h2><p>未有證據唔可以標記已解決；Unknown 唔等於 Failed；真正修復由責任頁完成。</p></section>
  </section>;
}

interface DesiredDeviceProfile{id:string;name:string;profile:'STORE_FRONTLINE'|'MANAGER_MOBILE'|'BACKOFFICE';trusted:boolean;expectedVersion:string}
export function DeviceHealthWorkspace(){
  const [profiles,setProfiles]=usePersistentAdminState<DesiredDeviceProfile[]>('device-profiles.v1',[]);
  const [observed]=usePersistentAdminState<Array<{id:string;name:string;profile:string;trusted:boolean;version:string;state:string;lastSeenAt:string}>>('devices-read.v1',[]);
  const add=()=>setProfiles(rows=>{const row:DesiredDeviceProfile={id:'device-'+Date.now().toString(36),name:'新裝置',profile:'STORE_FRONTLINE',trusted:true,expectedVersion:''};appendAdminAudit({action:'新增裝置預期設定',target:row.id});return [...rows,row];});
  const patch=(id:string,change:Partial<DesiredDeviceProfile>)=>setProfiles(rows=>rows.map(row=>row.id===id?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>Desired vs Observed</small><h1>裝置管理</h1><p>管理預期 Profile、信任同版本；裝置目前狀態只讀實際 readback，唔會用草稿假扮已完成。</p></div><div className="admin-editor-actions"><button onClick={add}>新增裝置設定</button></div></header>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>預期設定</h2>{profiles.length===0?<div className="admin-read-empty">未有裝置預期設定。</div>:profiles.map(row=><div key={row.id} className="admin-sub-editor"><label><span>名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})}/></label><label><span>類型</span><select value={row.profile} onChange={event=>patch(row.id,{profile:event.target.value as DesiredDeviceProfile['profile']})}><option value="STORE_FRONTLINE">門店前線</option><option value="MANAGER_MOBILE">管理人員流動裝置</option><option value="BACKOFFICE">後台工作站</option></select></label><label><span>預期版本</span><input value={row.expectedVersion} onChange={event=>patch(row.id,{expectedVersion:event.target.value})}/></label><label className="admin-toggle"><input type="checkbox" checked={row.trusted} onChange={event=>patch(row.id,{trusted:event.target.checked})}/><span>可信裝置</span></label></div>)}</article>
      <article className="admin-policy-card"><h2>裝置目前狀態</h2>{observed.length===0?<div className="admin-read-empty">目前未有裝置 readback；唔會顯示假 Online。</div>:observed.map(row=><p key={row.id}><b>{row.name}</b> · {row.version} · {row.state} · {new Date(row.lastSeenAt).toLocaleString('zh-HK')}</p>)}</article>
    </div>
  </section>;
}

interface OtaApproval{id:string;version:string;sha256:string;channel:'stable'|'candidate';approved:boolean;note:string}
export function OtaWorkspace(){
  const [rows,setRows]=usePersistentAdminState<OtaApproval[]>('ota-approvals.v1',[]);
  const [runtime]=usePersistentAdminState<Array<{deviceId:string;version:string;observedAt:string;state:string}>>('ota-runtime-read.v1',[]);
  const add=()=>setRows(current=>[...current,{id:'ota-'+Date.now().toString(36),version:'',sha256:'',channel:'candidate',approved:false,note:''}]);
  const patch=(id:string,change:Partial<OtaApproval>)=>setRows(current=>current.map(row=>row.id===id?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>版本治理</small><h1>版本更新</h1><p>Admin 管 approved artifact、渠道同批准狀態；Observed Runtime 只讀裝置回傳，填咗版本號唔等於已安裝。</p></div><div className="admin-editor-actions"><button onClick={add}>新增版本候選</button></div></header>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>版本候選</h2>{rows.length===0?<div className="admin-read-empty">未有版本候選。</div>:rows.map(row=><div className="admin-sub-editor" key={row.id}><label><span>版本</span><input value={row.version} onChange={event=>patch(row.id,{version:event.target.value})}/></label><label><span>SHA-256</span><input value={row.sha256} onChange={event=>patch(row.id,{sha256:event.target.value})}/></label><label><span>渠道</span><select value={row.channel} onChange={event=>patch(row.id,{channel:event.target.value as OtaApproval['channel']})}><option value="candidate">候選</option><option value="stable">穩定</option></select></label><label className="admin-toggle"><input type="checkbox" checked={row.approved} onChange={event=>patch(row.id,{approved:event.target.checked})}/><span>批准版本</span></label><textarea value={row.note} onChange={event=>patch(row.id,{note:event.target.value})} placeholder="版本備註"/></div>)}</article>
      <article className="admin-policy-card"><h2>裝置目前版本</h2>{runtime.length===0?<div className="admin-read-empty">目前未有 Runtime readback。</div>:runtime.map(row=><p key={row.deviceId}>{row.deviceId} · {row.version} · {row.state} · {new Date(row.observedAt).toLocaleString('zh-HK')}</p>)}</article>
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
