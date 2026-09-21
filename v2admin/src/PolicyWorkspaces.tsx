import {useState} from 'react';
import {useAdminDraft} from './admin-draft.tsx';

function PolicyHeader({title,description}:{title:string;description:string}){
  return <header className="admin-editor-head">
    <div><small>SESSION POLICY DRAFT · NOT_WIRED</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions">
      <button type="button" className="primary" disabled title="Domain Adapter 未接駁">Publish 未接駁</button>
    </div>
  </header>;
}

export function AvailabilityWorkspace(){
  const {draft}=useAdminDraft();
  const [state,setState]=useState<Record<string,{sellable:boolean;reason:string}>>({});
  return <section className="admin-editor-page">
    <PolicyHeader title="售罄／供應" description="呢度只整理 Admin policy 操作形狀。未接 Sellability Domain 前，所有改動只存在目前工作階段。"/>
    {draft.products.length===0?<div className="admin-empty-state"><b>未有 Product Draft</b><p>商品資料建立後，呢度會列出可售政策控制。</p></div>:<div className="admin-editor-list">
      {draft.products.map(product=>{
        const current=state[product.id]??{sellable:true,reason:''};
        return <article className="admin-policy-row" key={product.id}>
          <div><b>{product.name||product.id}</b><small>{product.id}</small></div>
          <label className="admin-toggle"><input type="checkbox" checked={current.sellable} onChange={event=>setState(value=>({...value,[product.id]:{...current,sellable:event.target.checked}}))}/><span>{current.sellable?'可售':'停售'}</span></label>
          <input value={current.reason} onChange={event=>setState(value=>({...value,[product.id]:{...current,reason:event.target.value}}))} placeholder="原因／備註（非必填）"/>
          <span className="admin-not-wired-chip">NOT_WIRED</span>
        </article>;
      })}
    </div>}
  </section>;
}

export function BusinessDayWorkspace(){
  const [cutoff,setCutoff]=useState('05:00');
  const [recordOnly,setRecordOnly]=useState(true);
  const [allowPostCloseCorrection,setAllowPostCloseCorrection]=useState(false);
  return <section className="admin-editor-page">
    <PolicyHeader title="營業日／交更" description="設定 Owner 決定嘅營業日規則。呢啲設定唔可以變成交易 blocker。"/>
    <div className="admin-policy-grid">
      <article className="admin-policy-card"><h2>營業日分界</h2><label><span>每日分界時間</span><input type="time" value={cutoff} onChange={event=>setCutoff(event.target.value)}/></label><small>只作 record / reporting classification / day-close。</small></article>
      <article className="admin-policy-card"><h2>交易行為</h2><label className="admin-toggle"><input type="checkbox" checked={recordOnly} onChange={event=>setRecordOnly(event.target.checked)}/><span>Record-only；永不阻交易</span></label><label className="admin-toggle"><input type="checkbox" checked={allowPostCloseCorrection} onChange={event=>setAllowPostCloseCorrection(event.target.checked)}/><span>允許授權人員日結後修正</span></label></article>
    </div>
  </section>;
}

interface LogicalPrinterDraft{
  readonly id:string;
  readonly name:string;
  readonly type:'RECEIPT'|'PRODUCTION'|'PACKING'|'LABEL';
  readonly active:boolean;
}

export function PrintCenterWorkspace(){
  const [printers,setPrinters]=useState<readonly LogicalPrinterDraft[]>([]);
  const add=()=>setPrinters(rows=>[...rows,{id:'printer-'+String(rows.length+1).padStart(3,'0'),name:'',type:'RECEIPT',active:true}]);
  const patch=(id:string,change:Partial<LogicalPrinterDraft>)=>setPrinters(rows=>rows.map(row=>row.id===id?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>LOGICAL PRINT CONFIG · NOT_WIRED</small><h1>打印中心</h1><p>Admin 只定 Logical Printer、能力同 routing policy；IP／USB／Native execution 唔喺 Admin。</p></div><div className="admin-editor-actions"><button className="secondary" onClick={add}>新增 Logical Printer</button><button className="publish" disabled>Publish 未接駁</button></div></header>
    {printers.length===0?<div className="admin-empty-state"><b>未有 Logical Printer</b><p>建立邏輯目的地後，之後先由 SMT 現場綁實體裝置。</p><button onClick={add}>新增 Logical Printer</button></div>:<div className="admin-editor-list">{printers.map(row=><article className="admin-policy-row printer-row" key={row.id}>
      <div><b>{row.name||'未命名 Printer'}</b><small>{row.id}</small></div>
      <input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})} placeholder="例如：廚房製作單機"/>
      <select value={row.type} onChange={event=>patch(row.id,{type:event.target.value as LogicalPrinterDraft['type']})}><option value="RECEIPT">Receipt</option><option value="PRODUCTION">Production</option><option value="PACKING">Packing</option><option value="LABEL">Label</option></select>
      <label className="admin-toggle"><input type="checkbox" checked={row.active} onChange={event=>patch(row.id,{active:event.target.checked})}/><span>{row.active?'啟用':'停用'}</span></label>
    </article>)}</div>}
  </section>;
}

export function PrintTemplatesWorkspace(){
  const [receipt,setReceipt]=useState('顯示店名、Order、Items、Total、Tender');
  const [production,setProduction]=useState('顯示 Product、Options、Remark');
  const [packing,setPacking]=useState('顯示全單 Items、件數、Order identity');
  const [label,setLabel]=useState('顯示 Product、Options、Order / Pickup reference');
  return <section className="admin-editor-page">
    <PolicyHeader title="打印模板中心" description="只定義輸出內容規則；真正 render / queue / physical execution 留喺 SMT Print authority。"/>
    <div className="admin-policy-grid two">
      {[['Receipt',receipt,setReceipt],['Production',production,setProduction],['Packing',packing,setPacking],['Label',label,setLabel]].map(([title,value,setter])=><article className="admin-policy-card" key={title as string}><h2>{title as string}</h2><textarea value={value as string} onChange={event=>(setter as (value:string)=>void)(event.target.value)} rows={5}/><span className="admin-not-wired-chip">TEMPLATE CONFIG · NOT_WIRED</span></article>)}
    </div>
  </section>;
}

export function StoreSettingsWorkspace(){
  const [storeName,setStoreName]=useState('');
  const [currency,setCurrency]=useState('HKD');
  const [timezone,setTimezone]=useState('Asia/Hong_Kong');
  const [lateArrivalMinutes,setLateArrivalMinutes]=useState('15');
  const [fulfillmentMinutes,setFulfillmentMinutes]=useState('20');
  const [archiveHours,setArchiveHours]=useState('24');
  return <section className="admin-editor-page">
    <PolicyHeader title="門店設定" description="集中整理 Owner 決定嘅 Store policy。未接 Adapter 前只係 Session Draft。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>基本資料</h2><label><span>門店顯示名稱</span><input value={storeName} onChange={event=>setStoreName(event.target.value)} placeholder="門店名稱"/></label><label><span>Currency</span><select value={currency} onChange={event=>setCurrency(event.target.value)}><option value="HKD">HKD</option></select></label><label><span>Timezone</span><input value={timezone} onChange={event=>setTimezone(event.target.value)}/></label></article>
      <article className="admin-policy-card"><h2>營運時間規則</h2><label><span>Late Arrival Cutoff（分鐘）</span><input inputMode="numeric" value={lateArrivalMinutes} onChange={event=>setLateArrivalMinutes(event.target.value)}/></label><label><span>Fulfillment Timer（分鐘）</span><input inputMode="numeric" value={fulfillmentMinutes} onChange={event=>setFulfillmentMinutes(event.target.value)}/></label><label><span>Archive Timer（小時）</span><input inputMode="numeric" value={archiveHours} onChange={event=>setArchiveHours(event.target.value)}/></label></article>
    </div>
  </section>;
}

interface StaffDraft{readonly id:string;readonly name:string;readonly role:string;readonly adminLogin:boolean;readonly active:boolean}
export function StaffWorkspace(){
  const [staff,setStaff]=useState<readonly StaffDraft[]>([]);
  const add=()=>setStaff(rows=>[...rows,{id:'staff-'+String(rows.length+1).padStart(3,'0'),name:'',role:'STAFF',adminLogin:false,active:true}]);
  const patch=(id:string,change:Partial<StaffDraft>)=>setStaff(rows=>rows.map(row=>row.id===id?{...row,...change}:row));
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>AUTH CONFIG · NOT_WIRED</small><h1>員工／權限</h1><p>只整理 Staff / Role / Admin access config。真正授權判斷必須由 MFK Auth authority 執行。</p></div><div className="admin-editor-actions"><button className="secondary" onClick={add}>新增員工</button><button className="publish" disabled>Publish 未接駁</button></div></header>
    {staff.length===0?<div className="admin-empty-state"><b>未有 Staff Draft</b><p>新增員工後設定角色同 Admin login eligibility。</p><button onClick={add}>新增員工</button></div>:<div className="admin-editor-list">{staff.map(row=><article className="admin-policy-row staff-row" key={row.id}>
      <input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})} placeholder="員工名稱"/>
      <select value={row.role} onChange={event=>patch(row.id,{role:event.target.value})}><option value="STAFF">Staff</option><option value="MANAGER">Manager</option><option value="OWNER">Owner</option><option value="VIEWER">Viewer</option></select>
      <label className="admin-toggle"><input type="checkbox" checked={row.adminLogin} onChange={event=>patch(row.id,{adminLogin:event.target.checked})}/><span>Admin Login</span></label>
      <label className="admin-toggle"><input type="checkbox" checked={row.active} onChange={event=>patch(row.id,{active:event.target.checked})}/><span>{row.active?'啟用':'停用'}</span></label>
    </article>)}</div>}
  </section>;
}

export function ChannelsWorkspace({mode}:{mode:'overview'|'mapping'|'accept'|'sync'|'estimate'}){
  const [enabled,setEnabled]=useState(false);
  const [autoAccept,setAutoAccept]=useState(false);
  const [syncSellability,setSyncSellability]=useState(false);
  const [commission,setCommission]=useState('');
  const title=mode==='overview'?'平台管理':mode==='mapping'?'商品映射管理':mode==='accept'?'接單／自動接單':mode==='sync'?'售罄／供應同步':'實收估算設定';
  return <section className="admin-editor-page">
    <PolicyHeader title={title} description="平台相關配置只係 Admin policy 草稿；未接 Channel Adapter 前唔會向任何 Provider 發 command。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>Channel Policy</h2><label className="admin-toggle"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/><span>啟用 Channel config</span></label><label className="admin-toggle"><input type="checkbox" checked={autoAccept} onChange={event=>setAutoAccept(event.target.checked)}/><span>正常單自動 admission policy</span></label><label className="admin-toggle"><input type="checkbox" checked={syncSellability} onChange={event=>setSyncSellability(event.target.checked)}/><span>同步 Sellability policy</span></label></article>
      <article className="admin-policy-card"><h2>Estimate / Mapping</h2><label><span>Commission estimate %</span><input inputMode="decimal" value={commission} onChange={event=>setCommission(event.target.value)} placeholder="例如 30"/></label><label><span>Provider Product Mapping</span><input disabled placeholder="待 Channel / Product Adapter"/></label><span className="admin-not-wired-chip">NO PROVIDER COMMAND</span></article>
    </div>
  </section>;
}
