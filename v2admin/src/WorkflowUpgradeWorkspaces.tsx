import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router';
import {useAdminDraft,validateAdminDraft} from './admin-draft.tsx';
import {appendAdminAudit,readAdminAudit,readAdminReleases,readAdminStored,usePersistentAdminState} from './admin-local-store.ts';
import {AdminResponsiveDataView} from './AdminResponsiveDataView.tsx';
import {createAdminCrossDayRefund,readAdminProjectedDays,readAdminProjectedOrders,readAdminRefundAddenda,readAdminRefunds,refreshAdminProjection} from './admin-projection-client.ts';

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
    if(!printers.length)rows.push({id:'AQ-PRINT',kind:'未建立 打印用途',owner:'打印',state:'待處理',route:'/admin/print'});
    const stale=devices.filter(row=>row.state==='STALE'||row.state==='未確認').length;
    if(stale)rows.push({id:'AQ-DEVICE',kind:stale+' 部裝置狀態未確認',owner:'裝置',state:'未確認',route:'/admin/devices'});
    return rows;
  },[errors.length,dirty,releases.length,mappings,printers.length,devices]);
  const filtered=queue.filter(row=>domain==='ALL'||row.owner===domain);
  return <section className="admin-editor-page">
    <UpgradeHeader title="待處理事項" description="由真實 Admin 狀態聚合需要處理嘅事項，再帶去責任頁；呢度唔直接改正式資料。" kicker="真實 Admin 狀態"/>
    <div className="admin-filterbar"><label><span>範圍</span><select value={domain} onChange={event=>setDomain(event.target.value)}><option value="ALL">全部範圍</option>{['菜單','平台','打印','裝置'].map(item=><option key={item} value={item}>{item}</option>)}</select></label><span>{filtered.length} 項</span></div>
    <AdminResponsiveDataView
      label="待處理事項"
      rows={filtered}
      rowKey={row=>row.id}
      emptyTitle="目前無待處理事項"
      emptyDescription="呢個狀態只代表現有 Admin evidence 無待辦，唔等於所有 runtime 都已驗證。"
      columns={[
        {key:'item',label:'事項',render:row=>row.kind},
        {key:'owner',label:'負責範圍',render:row=>row.owner},
        {key:'state',label:'狀態',render:row=>row.state==='HEALTHY'?'正常':row.state==='DEGRADED'?'需注意':row.state},
        {key:'route',label:'前往頁面',render:row=><Link to={row.route}>前往責任頁</Link>},
        {key:'action',label:'操作',render:()=> <StateChip>只作分流</StateChip>},
      ]}
    />
    <section className="admin-rule-card"><h2>處理原則</h2><p>未有證據唔可以標記已解決；未確認唔等於失敗；真正修復由責任頁完成。</p></section>
  </section>;
}

interface DesiredDeviceProfile{id:string;name:string;profile:'STORE_FRONTLINE'|'MANAGER_MOBILE'|'BACKOFFICE';trusted:boolean;expectedVersion:string}
export function DeviceHealthWorkspace(){
  const [profiles,setProfiles]=usePersistentAdminState<DesiredDeviceProfile[]>('device-profiles.v1',[]);
  const [observed]=usePersistentAdminState<Array<{id:string;name:string;profile:string;trusted:boolean;version:string;state:string;lastSeenAt:string}>>('devices-read.v1',[]);
  const add=()=>setProfiles(rows=>{const row:DesiredDeviceProfile={id:'device-'+Date.now().toString(36),name:'新裝置',profile:'STORE_FRONTLINE',trusted:true,expectedVersion:''};appendAdminAudit({action:'新增裝置預期設定',target:row.id});return [...rows,row];});
  const patch=(id:string,change:Partial<DesiredDeviceProfile>)=>setProfiles(rows=>rows.map(row=>row.id===id?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>預期設定／實際狀態</small><h1>裝置管理</h1><p>管理預期裝置類型、信任同版本；裝置目前狀態只讀實際回傳，唔會用草稿假扮已完成。</p></div><div className="admin-editor-actions"><button onClick={add}>新增裝置設定</button></div></header>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>預期設定</h2>{profiles.length===0?<div className="admin-read-empty">未有裝置預期設定。</div>:profiles.map(row=><div key={row.id} className="admin-sub-editor"><label><span>名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})}/></label><label><span>類型</span><select value={row.profile} onChange={event=>patch(row.id,{profile:event.target.value as DesiredDeviceProfile['profile']})}><option value="STORE_FRONTLINE">門店前線</option><option value="MANAGER_MOBILE">管理人員流動裝置</option><option value="BACKOFFICE">後台工作站</option></select></label><label><span>預期版本</span><input value={row.expectedVersion} onChange={event=>patch(row.id,{expectedVersion:event.target.value})}/></label><label className="admin-toggle"><input type="checkbox" checked={row.trusted} onChange={event=>patch(row.id,{trusted:event.target.checked})}/><span>可信裝置</span></label></div>)}</article>
      <article className="admin-policy-card"><h2>裝置目前狀態</h2>{observed.length===0?<div className="admin-read-empty">目前未有裝置狀態回傳；唔會顯示假「在線」。</div>:observed.map(row=><p key={row.id}><b>{row.name}</b> · {row.version} · {row.state} · {new Date(row.lastSeenAt).toLocaleString('zh-HK')}</p>)}</article>
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
      <article className="admin-policy-card"><h2>版本候選</h2>{rows.length===0?<div className="admin-read-empty">未有版本候選。</div>:rows.map(row=><div className="admin-sub-editor" key={row.id}><label><span>版本</span><input value={row.version} onChange={event=>patch(row.id,{version:event.target.value})}/></label><label><span>SHA-256</span><input value={row.sha256} onChange={event=>patch(row.id,{sha256:event.target.value})}/></label><label><span>渠道</span><select value={row.channel} onChange={event=>patch(row.id,{channel:event.target.value as OtaApproval['channel']})}><option value="candidate">候選</option><option value="stable">穩定</option></select></label><label className="admin-toggle"><input type="checkbox" checked={row.approved} onChange={event=>patch(row.id,{approved:event.target.checked})}/><span>批准版本</span></label><label><span>版本備註</span><textarea value={row.note} onChange={event=>patch(row.id,{note:event.target.value})} placeholder="版本備註"/></label></div>)}</article>
      <article className="admin-policy-card"><h2>裝置目前版本</h2>{runtime.length===0?<div className="admin-read-empty">目前未有裝置版本回傳。</div>:runtime.map(row=><p key={row.deviceId}>{row.deviceId} · {row.version} · {row.state} · {new Date(row.observedAt).toLocaleString('zh-HK')}</p>)}</article>
    </div>
  </section>;
}

interface CashCloseRecord{id:string;businessDate:string;openingMinor:number;countedMinor:number;expectedMinor?:number;note:string;createdAt:string;status:'DRAFT'|'SEALED'}
export function CashCloseRecordWorkspace(){
  const [records,setRecords]=usePersistentAdminState<CashCloseRecord[]>('cash-close.v1',[]);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [opening,setOpening]=useState('');
  const [counted,setCounted]=useState('');
  const [note,setNote]=useState('');
  const save=(sealed:boolean)=>{
    const row:CashCloseRecord={id:'close-'+Date.now().toString(36),businessDate:date,openingMinor:Math.round((Number(opening)||0)*100),countedMinor:Math.round((Number(counted)||0)*100),note,createdAt:new Date().toISOString(),status:sealed?'SEALED':'DRAFT'};
    setRecords(current=>[row,...current]);
    appendAdminAudit({action:sealed?'封存收舖記錄':'保存收舖草稿',target:date,after:row});
    setNote('');
  };
  return <section className="admin-editor-page">
    <UpgradeHeader title="現金／收舖記錄" description="記錄開舖底箱、實點現金、交更備註同封存狀態。只作 record / attention，永遠唔阻止落單、結帳、付款或本機保存。" kicker="只作記錄"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>建立記錄</h2><label><span>營業日</span><input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label><span>開舖現金 HK$</span><input inputMode="decimal" value={opening} onChange={event=>setOpening(event.target.value)}/></label><label><span>實點現金 HK$</span><input inputMode="decimal" value={counted} onChange={event=>setCounted(event.target.value)}/></label><label><span>交更備註</span><textarea value={note} onChange={event=>setNote(event.target.value)}/></label><div className="admin-editor-actions"><button onClick={()=>save(false)}>保存草稿</button><button className="primary" onClick={()=>save(true)}>封存記錄</button></div></article>
      <article className="admin-policy-card"><h2>歷史記錄</h2>{records.length===0?<div className="admin-read-empty">未有收舖記錄。</div>:records.slice(0,20).map(row=><p key={row.id}>{row.businessDate} · 開舖 HK{(row.openingMinor/100).toFixed(2)} · 實點 HK{(row.countedMinor/100).toFixed(2)} · {row.status==='SEALED'?'已封存':'草稿'}</p>)}</article>
    </div>
  </section>;
}

interface AccessPolicy{sessionHours:number;trustedDeviceRequired:boolean;revokeOnRoleChange:boolean;pinMinLength:number}
export function AccessSessionWorkspace(){
  const [policy,setPolicy]=usePersistentAdminState<AccessPolicy>('access-policy.v1',{sessionHours:12,trustedDeviceRequired:false,revokeOnRoleChange:true,pinMinLength:4});
  const [sessions]=usePersistentAdminState<Array<{id:string;staffId:string;device:string;scope:string;lastSeenAt:string;state:string}>>('sessions-read.v1',[]);
  const patch=(change:Partial<AccessPolicy>)=>setPolicy(current=>{const after={...current,...change};appendAdminAudit({action:'修改登入規則',target:'Access Policy',before:current,after});return after;});
  return <section className="admin-editor-page">
    <UpgradeHeader title="登入／權限範圍" description="管理登入時限、PIN 最低要求、可信裝置政策同角色變更後處理；正式權限由系統統一判斷。" kicker="權限治理"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>登入政策</h2><label><span>登入有效小時</span><input type="number" min={1} max={168} value={policy.sessionHours} onChange={event=>patch({sessionHours:Number(event.target.value)||12})}/></label><label><span>PIN 最少位數</span><input type="number" min={4} max={8} value={policy.pinMinLength} onChange={event=>patch({pinMinLength:Number(event.target.value)||4})}/></label><label className="admin-toggle"><input type="checkbox" checked={policy.trustedDeviceRequired} onChange={event=>patch({trustedDeviceRequired:event.target.checked})}/><span>後台登入要求可信裝置</span></label><label className="admin-toggle"><input type="checkbox" checked={policy.revokeOnRoleChange} onChange={event=>patch({revokeOnRoleChange:event.target.checked})}/><span>角色改動後撤銷舊登入</span></label></article>
      <article className="admin-policy-card"><h2>目前登入狀態</h2>{sessions.length===0?<div className="admin-read-empty">未有登入狀態回傳。</div>:sessions.map(row=><p key={row.id}>{row.staffId} · {row.device} · {row.scope} · {row.state} · {new Date(row.lastSeenAt).toLocaleString('zh-HK')}</p>)}</article>
    </div>
  </section>;
}

interface FixedMetricSnapshot{metricVersion:string;completeness:'COMPLETE'|'PARTIAL'|'UNAVAILABLE';freshness:'FRESH'|'STALE'|'UNKNOWN';updatedAt?:string;metrics:Record<string,number|string>}
function FixedReport({title,metrics,storeKey}:{title:string;metrics:readonly string[];storeKey:string}){
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [rows]=usePersistentAdminState<FixedMetricSnapshot[]>(storeKey,[]);
  const latest=rows[0];
  return <section className="admin-editor-page">
    <UpgradeHeader title={title} description="固定可信報表；後台只讀正式報表資料，唔自行重算交易結果。" kicker="固定可信報表"/>
    <div className="admin-filterbar"><label><span>由</span><input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>至</span><input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label></div>
    <div className="admin-kpi-grid">{metrics.map(metric=><article key={metric}><span>{metric}</span><strong>{latest?.metrics[metric]??'—'}</strong><small>{latest?latest.freshness:'未有資料'}</small></article>)}</div>
    <section className="admin-rule-card"><h2>資料狀態</h2><p>版本：{latest?.metricVersion??'—'}　完整度：{latest?.completeness??'UNAVAILABLE'}　更新狀態：{latest?.freshness??'未確認'}　最後更新：{latest?.updatedAt?new Date(latest.updatedAt).toLocaleString('zh-HK'):'—'}</p></section>
  </section>;
}

export const ProductReportWorkspace=()=> <FixedReport title="商品報表" metrics={['銷售件數','銷售額','銷售佔比 %','最高銷量商品']} storeKey="report-products.v1"/>;
export const ChannelReportWorkspace=()=> <FixedReport title="渠道報表" metrics={['訂單','總額','平台資料','異常']} storeKey="report-channels.v1"/>;

const REFUND_METHODS=Object.freeze([
  {id:'CASH',label:'現金'},
  {id:'FPS',label:'FPS／轉數快'},
  {id:'PAYME',label:'PayMe'},
  {id:'ALIPAY',label:'AlipayHK'},
  {id:'WECHAT',label:'WeChat Pay HK'},
] as const);
function defaultRefundMethod(label:string){
  const upper=String(label||'').toUpperCase();
  return REFUND_METHODS.find(row=>upper===row.id||upper.includes(row.id))?.id??'';
}
export function RefundReportWorkspace(){
  const [revision,setRevision]=useState(0);
  const [query,setQuery]=useState('');
  const [orderId,setOrderId]=useState('');
  const [lineId,setLineId]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [amount,setAmount]=useState('');
  const [method,setMethod]=useState('');
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{void refreshAdminProjection().then(()=>setRevision(value=>value+1));},[]);
  void revision;
  const orders=readAdminProjectedOrders();
  const days=readAdminProjectedDays();
  const refunds=readAdminRefunds();
  const addenda=readAdminRefundAddenda();
  const closedDates=new Set(days.filter(row=>Boolean(row.dayClose)).map(row=>row.date));
  const eligible=orders.filter(order=>
    closedDates.has(order.businessDate)&&
    !/^Keeta\b|^Foodpanda\b|^第三方/.test(String(order.sourceLabel||''))&&
    (!query||[order.orderId,order.display,order.sourceLabel].join(' ').toLowerCase().includes(query.toLowerCase()))
  );
  const selected=orders.find(row=>row.orderId===orderId);
  const selectedLine=selected?.items.find(row=>row.id===lineId);
  const lineMaxMinor=selectedLine?selectedLine.unitMinor*Math.max(1,quantity):0;
  const refresh=async()=>{await refreshAdminProjection();setRevision(value=>value+1);};
  const chooseOrder=(id:string)=>{
    const order=orders.find(row=>row.orderId===id);
    setOrderId(id);
    const line=order?.items[0];
    setLineId(line?.id??'');
    setQuantity(1);
    setAmount(line?String((line.unitMinor/100).toFixed(2)):'');
    setMethod(defaultRefundMethod(order?.paymentLabel??''));
    setNote('');
    setMessage('');
  };
  const chooseLine=(id:string)=>{
    const line=selected?.items.find(row=>row.id===id);
    setLineId(id);
    setQuantity(1);
    setAmount(line?String((line.unitMinor/100).toFixed(2)):'');
  };
  const submit=async()=>{
    if(!selected||!selectedLine||busy)return;
    const amountMinor=Math.round(Number(amount||0)*100);
    if(amountMinor<=0){setMessage('請輸入退款金額。');return;}
    if(!method){setMessage('請選擇實際退款方式。');return;}
    setBusy(true);setMessage('');
    try{
      const result=await createAdminCrossDayRefund({
        orderId:selected.orderId,
        lineId:selectedLine.id,
        quantity,
        amountMinor,
        method,
        note:note.trim()||undefined,
      });
      setMessage('退款已建立：原日結 '+result.addendum.versionLabel+' 附帶記錄；實際退款日 '+result.refund.executionBusinessDate+' 記 Money Out。');
      await refresh();
    }catch(error){
      setMessage(error instanceof Error?error.message:'ADMIN_REFUND_FAILED');
    }finally{setBusy(false);}
  };
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>ADMIN-ONLY CROSS-DAY REFUND</small><h1>退款報表／跨日退款</h1><p>已日結嘅舊單只可以喺 Admin 退款。原 Day Close 1.0 永遠唔重寫；每筆跨日退款建立 1.x 附帶記錄，同時喺實際退款日記真正 Money Out。</p></div><div className="admin-editor-actions"><button type="button" onClick={()=>void refresh()}>更新 Projection</button></div></header>
    <div className="admin-callout compact">同一 refundId 只會計一次：原銷售日 1.x 係 non-posting reference；實際退款日先影響當日退款、現金／Settlement 同期間總數。</div>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card">
        <h2>建立跨日／已日結退款</h2>
        <label><span>搜尋舊單</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Order／取餐號／來源"/></label>
        <label><span>訂單</span><select value={orderId} onChange={event=>chooseOrder(event.target.value)}><option value="">請選擇已日結訂單</option>{eligible.slice(0,200).map(order=><option key={order.orderId} value={order.orderId}>{order.businessDate} · {order.display} · {order.sourceLabel} · HK${(order.totalMinor/100).toFixed(2)}</option>)}</select></label>
        {selected?<><div className="admin-callout compact">原銷售日：{selected.businessDate}　付款：{selected.paymentLabel}　原額：HK${(selected.totalMinor/100).toFixed(2)}</div>
        <label><span>退款商品</span><select value={lineId} onChange={event=>chooseLine(event.target.value)}><option value="">請選擇</option>{selected.items.map(line=><option key={line.id} value={line.id}>{line.name} · {line.qty}件 · HK${(line.unitMinor/100).toFixed(2)}/件</option>)}</select></label>
        <label><span>數量 Reference</span><input inputMode="numeric" min={1} max={selectedLine?.qty??1} value={quantity} onChange={event=>{
          const next=Math.max(1,Math.min(selectedLine?.qty??1,Math.floor(Number(event.target.value)||1)));
          setQuantity(next);
          if(selectedLine)setAmount(String((selectedLine.unitMinor*next/100).toFixed(2)));
        }}/></label>
        <label><span>實際退款 HK$</span><input inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value.replace(/[^0-9.]/g,''))}/><small>呢個 item / qty 今次上限 HK${(lineMaxMinor/100).toFixed(2)}；後端仍會再扣已退款額做 fail-closed 驗證。</small></label>
        <label><span>實際退款方式</span><select value={method} onChange={event=>setMethod(event.target.value)}><option value="">請選擇</option>{REFUND_METHODS.map(row=><option key={row.id} value={row.id}>{row.label}{row.id===defaultRefundMethod(selected.paymentLabel)?'（原路）':''}</option>)}</select></label>
        <label><span>原因／備註</span><textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="例如：產品退款／客戶要求"/></label>
        <div className="admin-editor-actions"><button className="primary" type="button" disabled={!selectedLine||!method||!amount||busy} onClick={()=>void submit()}>{busy?'處理中…':'確認跨日退款'}</button></div></>:null}
        {message?<p role="status">{message}</p>:null}
      </article>
      <article className="admin-policy-card">
        <h2>Day Close 附帶版本</h2>
        {addenda.length===0?<div className="admin-read-empty">未有跨日退款附帶記錄。</div>:addenda.slice(0,30).map(row=><p key={row.id}><b>{row.businessDate} · v{row.versionLabel}</b><br/><span>{row.display} · 原單 {new Date(row.originalCreatedAt).toLocaleString('zh-HK')} · 實際退款 {new Date(row.executionAt).toLocaleString('zh-HK')}</span><br/><strong>-HK${(row.amountMinor/100).toFixed(2)} · {row.method}</strong><br/><small>NON-POSTING REFERENCE · refundId {row.refundId}</small></p>)}
      </article>
    </div>
    <section className="admin-read-card">
      <header><h2>實際退款流水</h2><span>{refunds.length}</span></header>
      {refunds.length===0?<div className="admin-read-empty">未有 Admin 跨日退款。</div>:<AdminResponsiveDataView
        label="跨日退款"
        rows={refunds}
        rowKey={row=>row.refundId}
        emptyTitle="未有退款"
        columns={[
          {key:'time',label:'實際退款時間',render:row=>new Date(row.executionAt).toLocaleString('zh-HK')},
          {key:'original',label:'原銷售日',render:row=>row.originalBusinessDate+' · '+row.display},
          {key:'item',label:'商品',render:row=>row.lines.map(line=>line.itemName+' ×'+line.quantity).join('、')},
          {key:'amount',label:'退款',numeric:true,render:row=>'HK

interface ExportPolicy{scope:'REPORT_CURRENT_FILTER'|'STORE_DAY'|'AUDIT_RANGE';includePii:boolean;requireOwnerApproval:boolean;retentionDays:number}
export function ExportGovernanceWorkspace(){
  const [policy,setPolicy]=usePersistentAdminState<ExportPolicy>('export-policy.v1',{scope:'REPORT_CURRENT_FILTER',includePii:false,requireOwnerApproval:true,retentionDays:30});
  const audit=readAdminAudit();
  const patch=(change:Partial<ExportPolicy>)=>setPolicy(current=>{const after={...current,...change};appendAdminAudit({action:'修改匯出治理設定',target:'Export Policy',before:current,after});return after;});
  const exportAudit=()=>{
    const data=JSON.stringify(audit,null,2);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download='mfk-admin-audit-'+new Date().toISOString().slice(0,10)+'.json';anchor.click();URL.revokeObjectURL(url);
    appendAdminAudit({action:'匯出操作記錄',target:'Audit',after:{rows:audit.length}});
  };
  return <section className="admin-editor-page">
    <UpgradeHeader title="匯出治理" description="管理匯出範圍、個人資料、審批同保留日數；每次匯出都要留操作記錄。" kicker="匯出政策"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>匯出規則</h2><label><span>預設範圍</span><select value={policy.scope} onChange={event=>patch({scope:event.target.value as ExportPolicy['scope']})}><option value="REPORT_CURRENT_FILTER">目前報表篩選</option><option value="STORE_DAY">門店／日期</option><option value="AUDIT_RANGE">操作記錄範圍</option></select></label><label className="admin-toggle"><input type="checkbox" checked={policy.includePii} onChange={event=>patch({includePii:event.target.checked})}/><span>允許個人資料欄位</span></label><label className="admin-toggle"><input type="checkbox" checked={policy.requireOwnerApproval} onChange={event=>patch({requireOwnerApproval:event.target.checked})}/><span>敏感匯出需要 Owner 批准</span></label><label><span>匯出檔保留日數</span><input type="number" min={1} value={policy.retentionDays} onChange={event=>patch({retentionDays:Number(event.target.value)||30})}/></label></article>
      <article className="admin-policy-card"><h2>目前可匯出資料</h2><p>後台操作記錄：{audit.length} 筆</p><button type="button" onClick={exportAudit}>匯出操作記錄 JSON</button><small>未有正式報表資料就唔會輸出假資料。</small></article>
    </div>
  </section>;
}

interface DiagnosticFinding{id:string;domain:string;state:'HEALTHY'|'DEGRADED'|'UNKNOWN';updatedAt:string;pendingCount:number;lastError?:string;recovery?:string;evidenceRef?:string}
export function DiagnosticsWorkspace(){
  const [findings]=usePersistentAdminState<DiagnosticFinding[]>('diagnostics-read.v1',[]);
  const unknown=findings.filter(row=>row.state==='UNKNOWN').length;
  const degraded=findings.filter(row=>row.state==='DEGRADED').length;
  return <section className="admin-editor-page">
    <UpgradeHeader title="系統狀態" description="系統狀態顯示功能範圍、目前狀態、資料新鮮度、待處理數量、最後錯誤、安全修復方法同回傳證據。冇證據唔會硬判根因。" kicker="診斷證據"/>
    <div className="admin-kpi-grid"><article><span>健康</span><strong>{findings.filter(row=>row.state==='HEALTHY').length}</strong><small>已確認</small></article><article><span>需注意</span><strong>{degraded}</strong><small>需要跟進</small></article><article><span>未確認</span><strong>{unknown}</strong><small>等待資料</small></article><article><span>總項目</span><strong>{findings.length}</strong><small>系統狀態</small></article></div>
    <AdminResponsiveDataView
      label="系統狀態"
      rows={findings}
      rowKey={row=>row.id}
      emptyTitle="未有系統狀態回傳"
      emptyDescription="未有正式回傳，所以唔會用假綠燈代替健康證據。"
      columns={[
        {key:'domain',label:'範圍',render:(row:DiagnosticFinding)=>row.domain},
        {key:'state',label:'狀態',render:(row:DiagnosticFinding)=>row.state},
        {key:'pending',label:'待處理',numeric:true,render:(row:DiagnosticFinding)=>row.pendingCount},
        {key:'error',label:'最後錯誤',render:(row:DiagnosticFinding)=>row.lastError||'—'},
        {key:'evidence',label:'證據',render:(row:DiagnosticFinding)=>row.evidenceRef||'—'},
      ]}
    />
  </section>;
}

interface IntegrationGovernance{provider:string;credentialRef:string;scope:string;webhookPath:string;signaturePolicy:string;schemaVersion:string;replayWindowMinutes:number;active:boolean}
export function IntegrationsGovernanceWorkspace(){
  const [rows,setRows]=usePersistentAdminState<IntegrationGovernance[]>('integrations-governance.v1',[]);
  const add=()=>setRows(current=>[...current,{provider:'',credentialRef:'',scope:'',webhookPath:'',signaturePolicy:'',schemaVersion:'',replayWindowMinutes:5,active:false}]);
  const patch=(index:number,change:Partial<IntegrationGovernance>)=>setRows(current=>current.map((row,i)=>i===index?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>治理設定</small><h1>外部連接</h1><p>管理憑證引用名稱、權限範圍、接收路徑、簽章驗證、資料格式版本同防重放時限。永遠唔保存秘密值。</p></div><div className="admin-editor-actions"><button onClick={add}>新增連接設定</button></div></header>
    {rows.length===0?<div className="admin-read-empty">未有外部連接治理設定。</div>:<div className="admin-editor-grid">{rows.map((row,index)=><article className="admin-policy-card" key={index}>
      <label><span>平台</span><input value={row.provider} onChange={event=>patch(index,{provider:event.target.value})}/></label>
      <label><span>憑證引用名稱</span><input value={row.credentialRef} onChange={event=>patch(index,{credentialRef:event.target.value})} placeholder="只填引用名稱，唔填秘密值"/></label>
      <label><span>權限範圍</span><input value={row.scope} onChange={event=>patch(index,{scope:event.target.value})}/></label>
      <label><span>接收路徑</span><input value={row.webhookPath} onChange={event=>patch(index,{webhookPath:event.target.value})}/></label>
      <label><span>簽章驗證規則</span><input value={row.signaturePolicy} onChange={event=>patch(index,{signaturePolicy:event.target.value})}/></label>
      <label><span>資料格式版本</span><input value={row.schemaVersion} onChange={event=>patch(index,{schemaVersion:event.target.value})}/></label>
      <label><span>防重放時限（分鐘）</span><input type="number" min={1} value={row.replayWindowMinutes} onChange={event=>patch(index,{replayWindowMinutes:Number(event.target.value)||5})}/></label>
      <label className="admin-toggle"><input type="checkbox" checked={row.active} onChange={event=>patch(index,{active:event.target.checked})}/><span>{row.active?'啟用設定':'停用設定'}</span></label>
    </article>)}</div>}
  </section>;
}

interface EffectiveSettingRow{id:string;label:string;baseValue:string;source:string;securityFloor:string;override:string}
export function EffectiveSettingsWorkspace(){
  const [rows,setRows]=usePersistentAdminState<EffectiveSettingRow[]>('effective-settings.v1',[
    {id:'business-timezone',label:'門店時區',baseValue:'Asia/Hong_Kong',source:'門店設定',securityFloor:'不可空白',override:''},
    {id:'business-day-cutoff',label:'營業日分界',baseValue:'05:00',source:'營業日設定',securityFloor:'只作記錄',override:''},
    {id:'quick-reason-required',label:'快捷原因必填',baseValue:'否',source:'快捷原因政策',securityFloor:'原因不可阻止交易',override:''},
    {id:'capacity-hard-stop',label:'產能強制停止',baseValue:'關',source:'產能設定',securityFloor:'預設不可無聲阻交易',override:''},
  ]);
  const patch=(id:string,override:string)=>setRows(current=>current.map(row=>row.id===id?{...row,override}:row));
  return <section className="admin-editor-page">
    <UpgradeHeader title="進階設定" description="顯示目前生效值、來源、可選覆寫同安全底線；唔建立一個可以跨功能範圍任意覆寫嘅巨型設定頁。" kicker="生效設定"/>
    <AdminResponsiveDataView
      label="進階生效設定"
      rows={rows}
      rowKey={row=>row.id}
      emptyDescription="未有生效設定。"
      columns={[
        {key:'setting',label:'設定項目',render:(row:EffectiveSettingRow)=>row.label},
        {key:'effective',label:'目前生效值',render:(row:EffectiveSettingRow)=>row.override||row.baseValue},
        {key:'source',label:'來源',render:(row:EffectiveSettingRow)=>row.source},
        {key:'floor',label:'安全底線',render:(row:EffectiveSettingRow)=>row.securityFloor},
        {key:'override',label:'覆寫草稿',render:(row:EffectiveSettingRow)=><label className="admin-inline-field"><span className="admin-visually-hidden">{row.label}覆寫草稿</span><input value={row.override} onChange={event=>patch(row.id,event.target.value)} placeholder="可選覆寫"/></label>},
      ]}
    />
  </section>;
}
+(row.amountMinor/100).toFixed(2)},
          {key:'method',label:'方式',render:row=>row.method},
          {key:'addendum',label:'附帶版本',render:row=>'v'+row.addendumVersionLabel},
        ]}
      />}
    </section>
  </section>;
}

interface ExportPolicy{scope:'REPORT_CURRENT_FILTER'|'STORE_DAY'|'AUDIT_RANGE';includePii:boolean;requireOwnerApproval:boolean;retentionDays:number}
export function ExportGovernanceWorkspace(){
  const [policy,setPolicy]=usePersistentAdminState<ExportPolicy>('export-policy.v1',{scope:'REPORT_CURRENT_FILTER',includePii:false,requireOwnerApproval:true,retentionDays:30});
  const audit=readAdminAudit();
  const patch=(change:Partial<ExportPolicy>)=>setPolicy(current=>{const after={...current,...change};appendAdminAudit({action:'修改匯出治理設定',target:'Export Policy',before:current,after});return after;});
  const exportAudit=()=>{
    const data=JSON.stringify(audit,null,2);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download='mfk-admin-audit-'+new Date().toISOString().slice(0,10)+'.json';anchor.click();URL.revokeObjectURL(url);
    appendAdminAudit({action:'匯出操作記錄',target:'Audit',after:{rows:audit.length}});
  };
  return <section className="admin-editor-page">
    <UpgradeHeader title="匯出治理" description="管理匯出範圍、個人資料、審批同保留日數；每次匯出都要留操作記錄。" kicker="匯出政策"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>匯出規則</h2><label><span>預設範圍</span><select value={policy.scope} onChange={event=>patch({scope:event.target.value as ExportPolicy['scope']})}><option value="REPORT_CURRENT_FILTER">目前報表篩選</option><option value="STORE_DAY">門店／日期</option><option value="AUDIT_RANGE">操作記錄範圍</option></select></label><label className="admin-toggle"><input type="checkbox" checked={policy.includePii} onChange={event=>patch({includePii:event.target.checked})}/><span>允許個人資料欄位</span></label><label className="admin-toggle"><input type="checkbox" checked={policy.requireOwnerApproval} onChange={event=>patch({requireOwnerApproval:event.target.checked})}/><span>敏感匯出需要 Owner 批准</span></label><label><span>匯出檔保留日數</span><input type="number" min={1} value={policy.retentionDays} onChange={event=>patch({retentionDays:Number(event.target.value)||30})}/></label></article>
      <article className="admin-policy-card"><h2>目前可匯出資料</h2><p>後台操作記錄：{audit.length} 筆</p><button type="button" onClick={exportAudit}>匯出操作記錄 JSON</button><small>未有正式報表資料就唔會輸出假資料。</small></article>
    </div>
  </section>;
}

interface DiagnosticFinding{id:string;domain:string;state:'HEALTHY'|'DEGRADED'|'UNKNOWN';updatedAt:string;pendingCount:number;lastError?:string;recovery?:string;evidenceRef?:string}
export function DiagnosticsWorkspace(){
  const [findings]=usePersistentAdminState<DiagnosticFinding[]>('diagnostics-read.v1',[]);
  const unknown=findings.filter(row=>row.state==='UNKNOWN').length;
  const degraded=findings.filter(row=>row.state==='DEGRADED').length;
  return <section className="admin-editor-page">
    <UpgradeHeader title="系統狀態" description="系統狀態顯示功能範圍、目前狀態、資料新鮮度、待處理數量、最後錯誤、安全修復方法同回傳證據。冇證據唔會硬判根因。" kicker="診斷證據"/>
    <div className="admin-kpi-grid"><article><span>健康</span><strong>{findings.filter(row=>row.state==='HEALTHY').length}</strong><small>已確認</small></article><article><span>需注意</span><strong>{degraded}</strong><small>需要跟進</small></article><article><span>未確認</span><strong>{unknown}</strong><small>等待資料</small></article><article><span>總項目</span><strong>{findings.length}</strong><small>系統狀態</small></article></div>
    <AdminResponsiveDataView
      label="系統狀態"
      rows={findings}
      rowKey={row=>row.id}
      emptyTitle="未有系統狀態回傳"
      emptyDescription="未有正式回傳，所以唔會用假綠燈代替健康證據。"
      columns={[
        {key:'domain',label:'範圍',render:(row:DiagnosticFinding)=>row.domain},
        {key:'state',label:'狀態',render:(row:DiagnosticFinding)=>row.state},
        {key:'pending',label:'待處理',numeric:true,render:(row:DiagnosticFinding)=>row.pendingCount},
        {key:'error',label:'最後錯誤',render:(row:DiagnosticFinding)=>row.lastError||'—'},
        {key:'evidence',label:'證據',render:(row:DiagnosticFinding)=>row.evidenceRef||'—'},
      ]}
    />
  </section>;
}

interface IntegrationGovernance{provider:string;credentialRef:string;scope:string;webhookPath:string;signaturePolicy:string;schemaVersion:string;replayWindowMinutes:number;active:boolean}
export function IntegrationsGovernanceWorkspace(){
  const [rows,setRows]=usePersistentAdminState<IntegrationGovernance[]>('integrations-governance.v1',[]);
  const add=()=>setRows(current=>[...current,{provider:'',credentialRef:'',scope:'',webhookPath:'',signaturePolicy:'',schemaVersion:'',replayWindowMinutes:5,active:false}]);
  const patch=(index:number,change:Partial<IntegrationGovernance>)=>setRows(current=>current.map((row,i)=>i===index?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>治理設定</small><h1>外部連接</h1><p>管理憑證引用名稱、權限範圍、接收路徑、簽章驗證、資料格式版本同防重放時限。永遠唔保存秘密值。</p></div><div className="admin-editor-actions"><button onClick={add}>新增連接設定</button></div></header>
    {rows.length===0?<div className="admin-read-empty">未有外部連接治理設定。</div>:<div className="admin-editor-grid">{rows.map((row,index)=><article className="admin-policy-card" key={index}>
      <label><span>平台</span><input value={row.provider} onChange={event=>patch(index,{provider:event.target.value})}/></label>
      <label><span>憑證引用名稱</span><input value={row.credentialRef} onChange={event=>patch(index,{credentialRef:event.target.value})} placeholder="只填引用名稱，唔填秘密值"/></label>
      <label><span>權限範圍</span><input value={row.scope} onChange={event=>patch(index,{scope:event.target.value})}/></label>
      <label><span>接收路徑</span><input value={row.webhookPath} onChange={event=>patch(index,{webhookPath:event.target.value})}/></label>
      <label><span>簽章驗證規則</span><input value={row.signaturePolicy} onChange={event=>patch(index,{signaturePolicy:event.target.value})}/></label>
      <label><span>資料格式版本</span><input value={row.schemaVersion} onChange={event=>patch(index,{schemaVersion:event.target.value})}/></label>
      <label><span>防重放時限（分鐘）</span><input type="number" min={1} value={row.replayWindowMinutes} onChange={event=>patch(index,{replayWindowMinutes:Number(event.target.value)||5})}/></label>
      <label className="admin-toggle"><input type="checkbox" checked={row.active} onChange={event=>patch(index,{active:event.target.checked})}/><span>{row.active?'啟用設定':'停用設定'}</span></label>
    </article>)}</div>}
  </section>;
}

interface EffectiveSettingRow{id:string;label:string;baseValue:string;source:string;securityFloor:string;override:string}
export function EffectiveSettingsWorkspace(){
  const [rows,setRows]=usePersistentAdminState<EffectiveSettingRow[]>('effective-settings.v1',[
    {id:'business-timezone',label:'門店時區',baseValue:'Asia/Hong_Kong',source:'門店設定',securityFloor:'不可空白',override:''},
    {id:'business-day-cutoff',label:'營業日分界',baseValue:'05:00',source:'營業日設定',securityFloor:'只作記錄',override:''},
    {id:'quick-reason-required',label:'快捷原因必填',baseValue:'否',source:'快捷原因政策',securityFloor:'原因不可阻止交易',override:''},
    {id:'capacity-hard-stop',label:'產能強制停止',baseValue:'關',source:'產能設定',securityFloor:'預設不可無聲阻交易',override:''},
  ]);
  const patch=(id:string,override:string)=>setRows(current=>current.map(row=>row.id===id?{...row,override}:row));
  return <section className="admin-editor-page">
    <UpgradeHeader title="進階設定" description="顯示目前生效值、來源、可選覆寫同安全底線；唔建立一個可以跨功能範圍任意覆寫嘅巨型設定頁。" kicker="生效設定"/>
    <AdminResponsiveDataView
      label="進階生效設定"
      rows={rows}
      rowKey={row=>row.id}
      emptyDescription="未有生效設定。"
      columns={[
        {key:'setting',label:'設定項目',render:(row:EffectiveSettingRow)=>row.label},
        {key:'effective',label:'目前生效值',render:(row:EffectiveSettingRow)=>row.override||row.baseValue},
        {key:'source',label:'來源',render:(row:EffectiveSettingRow)=>row.source},
        {key:'floor',label:'安全底線',render:(row:EffectiveSettingRow)=>row.securityFloor},
        {key:'override',label:'覆寫草稿',render:(row:EffectiveSettingRow)=><label className="admin-inline-field"><span className="admin-visually-hidden">{row.label}覆寫草稿</span><input value={row.override} onChange={event=>patch(row.id,event.target.value)} placeholder="可選覆寫"/></label>},
      ]}
    />
  </section>;
}
