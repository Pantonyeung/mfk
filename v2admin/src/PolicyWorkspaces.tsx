import {useState} from 'react';
import {useAdminDraft} from './admin-draft.tsx';

function PolicyHeader({title,description}:{title:string;description:string}){
  return <header className="admin-editor-head">
    <div><small>未發布設定</small><h1>{title}</h1><p>{description}</p></div>
    <div className="admin-editor-actions">
      <button type="button" className="primary" disabled title="部分功能尚未啟用">尚未可發布</button>
    </div>
  </header>;
}

export function AvailabilityWorkspace(){
  const {draft}=useAdminDraft();
  const [state,setState]=useState<Record<string,{sellable:boolean;reason:string}>>({});
  return <section className="admin-editor-page">
    <PolicyHeader title="售罄／供應" description="呢度只管理供應設定草稿。相關功能未啟用前，所有改動只會留喺目前草稿。"/>
    {draft.products.length===0?<div className="admin-empty-state"><b>未有商品草稿</b><p>商品資料建立後，呢度會列出可售政策控制。</p></div>:<div className="admin-editor-list">
      {draft.products.map(product=>{
        const current=state[product.id]??{sellable:true,reason:''};
        return <article className="admin-policy-row" key={product.id}>
          <div><b>{product.name||product.id}</b><small>{product.id}</small></div>
          <label className="admin-toggle"><input type="checkbox" checked={current.sellable} onChange={event=>setState(value=>({...value,[product.id]:{...current,sellable:event.target.checked}}))}/><span>{current.sellable?'可售':'停售'}</span></label>
          <input value={current.reason} onChange={event=>setState(value=>({...value,[product.id]:{...current,reason:event.target.value}}))} placeholder="原因／備註（非必填）"/>
          <span className="admin-not-wired-chip">尚未啟用</span>
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
    <PolicyHeader title="營業日／交更" description="設定營業日規則。呢啲設定只用作記錄同報表，唔會阻止交易。"/>
    <div className="admin-policy-grid">
      <article className="admin-policy-card"><h2>營業日分界</h2><label><span>每日分界時間</span><input type="time" value={cutoff} onChange={event=>setCutoff(event.target.value)}/></label><small>只用作記錄、報表分類同收舖記錄。</small></article>
      <article className="admin-policy-card"><h2>交易行為</h2><label className="admin-toggle"><input type="checkbox" checked={recordOnly} onChange={event=>setRecordOnly(event.target.checked)}/><span>只作記錄；永不阻交易</span></label><label className="admin-toggle"><input type="checkbox" checked={allowPostCloseCorrection} onChange={event=>setAllowPostCloseCorrection(event.target.checked)}/><span>允許授權人員日結後修正</span></label></article>
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
    <header className="admin-editor-head"><div><small>打印設定尚未啟用</small><h1>打印中心</h1><p>呢度只設定打印用途同分流規則；實際連接方式同打印由門店裝置處理。</p></div><div className="admin-editor-actions"><button className="secondary" onClick={add}>新增打印用途</button><button className="publish" disabled>尚未可發布</button></div></header>
    {printers.length===0?<div className="admin-empty-state"><b>未有打印用途</b><p>先建立打印用途，之後再由門店綁定實體打印機。</p><button onClick={add}>新增打印用途</button></div>:<div className="admin-editor-list">{printers.map(row=><article className="admin-policy-row printer-row" key={row.id}>
      <div><b>{row.name||'未命名打印機'}</b><small>{row.id}</small></div>
      <input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})} placeholder="例如：廚房製作單機"/>
      <select value={row.type} onChange={event=>patch(row.id,{type:event.target.value as LogicalPrinterDraft['type']})}><option value="RECEIPT">收據</option><option value="PRODUCTION">製作單</option><option value="PACKING">包裝單</option><option value="LABEL">標籤</option></select>
      <label className="admin-toggle"><input type="checkbox" checked={row.active} onChange={event=>patch(row.id,{active:event.target.checked})}/><span>{row.active?'啟用':'停用'}</span></label>
    </article>)}</div>}
  </section>;
}

export function PrintTemplatesWorkspace(){
  const [receipt,setReceipt]=useState('顯示店名、訂單、商品、總額、付款方式');
  const [production,setProduction]=useState('顯示商品、選項、備註');
  const [packing,setPacking]=useState('顯示全單商品、件數、訂單編號');
  const [label,setLabel]=useState('顯示商品、選項、訂單／取餐參考');
  return <section className="admin-editor-page">
    <PolicyHeader title="打印模板中心" description="只設定打印內容；實際打印會由門店裝置處理。"/>
    <div className="admin-policy-grid two">
      {[['收據',receipt,setReceipt],['製作單',production,setProduction],['包裝單',packing,setPacking],['標籤',label,setLabel]].map(([title,value,setter])=><article className="admin-policy-card" key={title as string}><h2>{title as string}</h2><textarea value={value as string} onChange={event=>(setter as (value:string)=>void)(event.target.value)} rows={5}/><span className="admin-not-wired-chip">模板設定尚未啟用</span></article>)}
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
    <PolicyHeader title="門店設定" description="集中整理門店設定。相關功能未啟用前只係未發布草稿。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>基本資料</h2><label><span>門店顯示名稱</span><input value={storeName} onChange={event=>setStoreName(event.target.value)} placeholder="門店名稱"/></label><label><span>貨幣</span><select value={currency} onChange={event=>setCurrency(event.target.value)}><option value="HKD">HKD</option></select></label><label><span>時區</span><input value={timezone} onChange={event=>setTimezone(event.target.value)}/></label></article>
      <article className="admin-policy-card"><h2>營運時間規則</h2><label><span>遲到界線（分鐘）</span><input inputMode="numeric" value={lateArrivalMinutes} onChange={event=>setLateArrivalMinutes(event.target.value)}/></label><label><span>出餐計時（分鐘）</span><input inputMode="numeric" value={fulfillmentMinutes} onChange={event=>setFulfillmentMinutes(event.target.value)}/></label><label><span>封存時間（小時）</span><input inputMode="numeric" value={archiveHours} onChange={event=>setArchiveHours(event.target.value)}/></label></article>
    </div>
  </section>;
}

interface StaffDraft{
  readonly id:string;
  readonly name:string;
  readonly role:string;
  readonly pin:string;
  readonly scope:string;
  readonly adminLogin:boolean;
  readonly active:boolean;
  readonly permissions:readonly string[];
}
export function StaffWorkspace(){
  const [staff,setStaff]=useState<readonly StaffDraft[]>([]);
  const add=()=>setStaff(rows=>[...rows,{
    id:'staff-'+String(rows.length+1).padStart(3,'0'),
    name:'',role:'STAFF',pin:'',scope:'STORE',adminLogin:false,active:true,permissions:['ORDER_REVIEW'],
  }]);
  const patch=(id:string,change:Partial<StaffDraft>)=>setStaff(rows=>rows.map(row=>row.id===id?{...row,...change}:row));
  const togglePermission=(row:StaffDraft,permission:string,checked:boolean)=>patch(row.id,{
    permissions:checked?[...new Set([...row.permissions,permission])]:row.permissions.filter(item=>item!==permission),
  });
  return <section className="admin-editor-page">
    <header className="admin-editor-head">
      <div><small>人員權限尚未啟用</small><h1>員工／權限</h1><p>設定員工、角色、登入碼、權限範圍。正式權限判斷會由系統統一處理。</p></div>
      <div className="admin-editor-actions"><button className="secondary" onClick={add}>新增員工</button><button className="publish" disabled>尚未可發布</button></div>
    </header>
    {staff.length===0?<div className="admin-empty-state"><b>未有員工草稿</b><p>新增員工後設定角色、登入碼、權限範圍同後台登入資格。</p><button onClick={add}>新增員工</button></div>:<div className="admin-editor-list">{staff.map(row=><article className="admin-policy-card" key={row.id}>
      <h2>{row.name||row.id}</h2>
      <label><span>員工名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})} placeholder="員工名稱"/></label>
      <label><span>角色</span><select value={row.role} onChange={event=>patch(row.id,{role:event.target.value})}><option value="STAFF">員工</option><option value="MANAGER">經理</option><option value="OWNER">老闆</option><option value="VIEWER">只讀人員</option></select></label>
      <label><span>登入碼草稿</span><input inputMode="numeric" value={row.pin} onChange={event=>patch(row.id,{pin:event.target.value.replace(/\D/g,'').slice(0,8)})} placeholder="4–8 digits"/></label>
      <label><span>權限範圍</span><select value={row.scope} onChange={event=>patch(row.id,{scope:event.target.value})}><option value="STORE">單店</option><option value="MULTI_STORE">多店</option><option value="REPORT_ONLY">只看報表</option></select></label>
      <div>
        <b>權限草稿</b>
        {['ORDER_REVIEW','ADMIN_CONFIG','REPORT_VIEW'].map(permission=><label className="admin-toggle" key={permission}><input type="checkbox" checked={row.permissions.includes(permission)} onChange={event=>togglePermission(row,permission,event.target.checked)}/><span>{permission}</span></label>)}
      </div>
      <label className="admin-toggle"><input type="checkbox" checked={row.adminLogin} onChange={event=>patch(row.id,{adminLogin:event.target.checked})}/><span>後台登入</span></label>
      <label className="admin-toggle"><input type="checkbox" checked={row.active} onChange={event=>patch(row.id,{active:event.target.checked})}/><span>{row.active?'啟用':'停用'}</span></label>
      <span className="admin-not-wired-chip">未發布草稿</span>
    </article>)}</div>}
  </section>;
}

export function ChannelsWorkspace({mode}:{mode:'overview'|'mapping'|'failures'|'accept'|'sync'|'estimate'}){
  const [enabled,setEnabled]=useState(false);
  const [autoAccept,setAutoAccept]=useState(false);
  const [syncSellability,setSyncSellability]=useState(false);
  const [commission,setCommission]=useState('');
  const title=mode==='overview'?'平台管理':mode==='mapping'?'商品映射管理':mode==='failures'?'匹配失敗明細':mode==='accept'?'接單／自動接單':mode==='sync'?'售罄／供應同步':'實收估算設定';
  return <section className="admin-editor-page">
    <PolicyHeader title={title} description="平台設定目前只係草稿；相關連接未啟用前，唔會向任何平台發送操作。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>平台設定</h2><label className="admin-toggle"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/><span>啟用平台設定</span></label><label className="admin-toggle"><input type="checkbox" checked={autoAccept} onChange={event=>setAutoAccept(event.target.checked)}/><span>一般訂單自動接單規則</span></label><label className="admin-toggle"><input type="checkbox" checked={syncSellability} onChange={event=>setSyncSellability(event.target.checked)}/><span>同步供應狀態規則</span></label></article>
      <article className="admin-policy-card"><h2>{mode==='failures'?'對應失敗':'估算／商品對應'}</h2>{mode==='failures'?<div className="admin-read-empty">商品對應失敗資料尚未啟用</div>:<><label><span>佣金估算 %</span><input inputMode="decimal" value={commission} onChange={event=>setCommission(event.target.value)} placeholder="例如 30"/></label><label><span>平台商品對應</span><input disabled placeholder="等待相關功能啟用"/></label></>}<span className="admin-not-wired-chip">唔會向平台發送操作</span></article>
    </div>
  </section>;
}
