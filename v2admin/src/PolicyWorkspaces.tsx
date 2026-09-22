import {useMemo,useState} from 'react';
import {useAdminDraft} from './admin-draft.tsx';
import {appendAdminAudit,usePersistentAdminState} from './admin-local-store.ts';

function PolicyHeader({title,description,badge='已自動保存設定'}:{title:string;description:string;badge?:string}){
  return <header className="admin-editor-head">
    <div><small>{badge}</small><h1>{title}</h1><p>{description}</p></div>
  </header>;
}
const Toggle=({checked,onChange,label}:{checked:boolean;onChange:(next:boolean)=>void;label:string})=><label className="admin-toggle"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><span>{label}</span></label>;

export interface AvailabilityRule{readonly sellable:boolean;readonly reason:string;readonly updatedAt:string}
export function AvailabilityWorkspace(){
  const {draft}=useAdminDraft();
  const [state,setState]=usePersistentAdminState<Record<string,AvailabilityRule>>('availability.v1',{});
  const patch=(id:string,change:Partial<AvailabilityRule>)=>{
    setState(current=>{
      const before=current[id]??{sellable:true,reason:'',updatedAt:''};
      const after={...before,...change,updatedAt:new Date().toISOString()};
      appendAdminAudit({action:'修改商品供應狀態設定',target:id,before,after});
      return {...current,[id]:after};
    });
  };
  const [query,setQuery]=useState('');
  const rows=useMemo(()=>draft.products.filter(product=>product.name.toLowerCase().includes(query.trim().toLowerCase())),[draft.products,query]);
  return <section className="admin-editor-page">
    <PolicyHeader title="售罄／供應" description="管理商品可售狀態、停售原因同恢復設定。呢度係正式後台設定草稿；正式可售狀態由系統統一執行。"/>
    <div className="admin-filterbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品"/><span>{rows.length} 件商品</span></div>
    <div className="admin-editor-list">{rows.map(product=>{
      const current=state[product.id]??{sellable:true,reason:'',updatedAt:''};
      return <article className="admin-policy-row" key={product.id}>
        <div><b>{product.name}</b><small>{product.productCode??product.id}</small></div>
        <Toggle checked={current.sellable} onChange={sellable=>patch(product.id,{sellable})} label={current.sellable?'可售':'停售'}/>
        <input value={current.reason} onChange={event=>patch(product.id,{reason:event.target.value})} placeholder="原因／備註（非必填）"/>
        <small>{current.updatedAt?new Date(current.updatedAt).toLocaleString('zh-HK'):'未修改'}</small>
      </article>;
    })}</div>
  </section>;
}

interface BusinessDayConfig{
  cutoff:string;
  postCloseCorrectionRoles:string[];
  cashTolerance:string;
  requireCloseApproval:boolean;
}
export function BusinessDayWorkspace(){
  const [config,setConfig]=usePersistentAdminState<BusinessDayConfig>('business-day.v1',{
    cutoff:'05:00',postCloseCorrectionRoles:['OWNER','MANAGER'],cashTolerance:'0.00',requireCloseApproval:true,
  });
  const patch=(change:Partial<BusinessDayConfig>)=>setConfig(current=>{const after={...current,...change};appendAdminAudit({action:'修改營業日設定',target:'營業日／交更',before:current,after});return after;});
  const toggleRole=(role:string,checked:boolean)=>patch({postCloseCorrectionRoles:checked?[...new Set([...config.postCloseCorrectionRoles,role])]:config.postCloseCorrectionRoles.filter(item=>item!==role)});
  return <section className="admin-editor-page">
    <PolicyHeader title="營業日／交更" description="營業日只負責記錄、報表分類同收舖歷史，永遠唔會阻止新交易。"/>
    <div className="admin-policy-grid">
      <article className="admin-policy-card"><h2>營業日分界</h2><label><span>每日分界時間</span><input type="time" value={config.cutoff} onChange={event=>patch({cutoff:event.target.value})}/></label><small>例如 05:00 代表凌晨五點先轉新營業日。</small></article>
      <article className="admin-policy-card"><h2>日結後修改權限</h2>{['STAFF','MANAGER','OWNER'].map(role=><Toggle key={role} checked={config.postCloseCorrectionRoles.includes(role)} onChange={checked=>toggleRole(role,checked)} label={role==='STAFF'?'員工':role==='MANAGER'?'經理':'老闆'}/>)}</article>
      <article className="admin-policy-card"><h2>收舖差額</h2><label><span>現金容許差額 HK$</span><input inputMode="decimal" value={config.cashTolerance} onChange={event=>patch({cashTolerance:event.target.value})}/></label><Toggle checked={config.requireCloseApproval} onChange={requireCloseApproval=>patch({requireCloseApproval})} label="超出差額需要授權"/><span className="admin-not-wired-chip">永不阻交易</span></article>
    </div>
  </section>;
}

interface LogicalPrinterDraft{
  readonly id:string;
  readonly name:string;
  readonly type:'RECEIPT'|'PRODUCTION'|'PACKING'|'LABEL';
  readonly model:string;
  readonly widthMm:number;
  readonly active:boolean;
  readonly capabilities:readonly string[];
}
export function PrintCenterWorkspace(){
  const [printers,setPrinters]=usePersistentAdminState<LogicalPrinterDraft[]>('logical-printers.v1',[
    {id:'logical-receipt',name:'收據機',type:'RECEIPT',model:'80mm 熱敏',widthMm:80,active:true,capabilities:['RECEIPT']},
    {id:'logical-production',name:'廚房製作單機',type:'PRODUCTION',model:'80mm 熱敏',widthMm:80,active:true,capabilities:['PRODUCTION']},
    {id:'logical-packing',name:'打包單機',type:'PACKING',model:'80mm 熱敏',widthMm:80,active:true,capabilities:['PACKING']},
    {id:'logical-riceball-label',name:'飯糰 Label',type:'LABEL',model:'50×40 Label',widthMm:50,active:true,capabilities:['LABEL']},
    {id:'logical-takeaway-label',name:'外賣 Label',type:'LABEL',model:'50×40 Label',widthMm:50,active:true,capabilities:['LABEL']},
  ]);
  const add=()=>setPrinters(rows=>{
    const row:LogicalPrinterDraft={id:'logical-'+Date.now().toString(36),name:'新打印用途',type:'RECEIPT',model:'80mm 熱敏',widthMm:80,active:true,capabilities:['RECEIPT']};
    appendAdminAudit({action:'新增 打印用途',target:row.id,after:row});return [...rows,row];
  });
  const patch=(id:string,change:Partial<LogicalPrinterDraft>)=>setPrinters(rows=>rows.map(row=>{if(row.id!==id)return row;const after={...row,...change};appendAdminAudit({action:'修改 打印用途',target:id,before:row,after});return after;}));
  const remove=(id:string)=>setPrinters(rows=>{appendAdminAudit({action:'刪除 打印用途',target:id});return rows.filter(row=>row.id!==id);});
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>唯一打印用途清單</small><h1>打印中心</h1><p>Admin 定義唯一打印用途、規格同能力。實際 IP／USB／實體設備日後只由 SMT 配對，唔會喺兩邊建立第二套名稱。</p></div><div className="admin-editor-actions"><button className="secondary" onClick={add}>新增打印用途</button></div></header>
    <div className="admin-editor-list">{printers.map(row=><article className="admin-policy-card" key={row.id}>
      <header><h2>{row.name}</h2><small>{row.id}</small></header>
      <label><span>名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})}/></label>
      <label><span>票種</span><select value={row.type} onChange={event=>{const type=event.target.value as LogicalPrinterDraft['type'];patch(row.id,{type,capabilities:[type]})}}><option value="RECEIPT">收據</option><option value="PRODUCTION">製作單</option><option value="PACKING">包裝單</option><option value="LABEL">標籤</option></select></label>
      <label><span>打印規格</span><input value={row.model} onChange={event=>patch(row.id,{model:event.target.value})}/></label>
      <label><span>紙寬／標籤寬 mm</span><input type="number" min={20} max={120} value={row.widthMm} onChange={event=>patch(row.id,{widthMm:Number(event.target.value)||80})}/></label>
      <Toggle checked={row.active} onChange={active=>patch(row.id,{active})} label={row.active?'啟用':'停用'}/>
      <button type="button" onClick={()=>remove(row.id)}>刪除</button>
    </article>)}</div>
  </section>;
}

interface PrintTemplateSet{receipt:string;production:string;packing:string;label:string;showComboRelationship:boolean;separateFoodDrinkCount:boolean}
export function PrintTemplatesWorkspace(){
  const [templates,setTemplates]=usePersistentAdminState<PrintTemplateSet>('print-templates.v1',{
    receipt:'店名\n訂單編號\n商品明細\n總額\n付款方式',
    production:'訂單編號\n要整乜／點整\n選項／備註',
    packing:'訂單編號\n全單商品／件數\n包裝核對',
    label:'商品名稱\n選項\n訂單／取餐參考\n件數',
    showComboRelationship:true,separateFoodDrinkCount:true,
  });
  const patch=(change:Partial<PrintTemplateSet>)=>setTemplates(current=>{const after={...current,...change};appendAdminAudit({action:'修改打印模板',target:'打印模板中心'});return after;});
  return <section className="admin-editor-page">
    <PolicyHeader title="打印模板中心" description="管理收據、製作單、打包單同 Label 嘅正式輸出內容。製作單回答要整乜／點整；打包單回答全單齊唔齊。"/>
    <div className="admin-policy-grid two">
      {([['receipt','收據'],['production','製作單'],['packing','打包單'],['label','標籤']] as const).map(([key,title])=><article className="admin-policy-card" key={key}><h2>{title}</h2><textarea value={templates[key]} onChange={event=>patch({[key]:event.target.value})} rows={8}/></article>)}
      <article className="admin-policy-card"><h2>輸出語義</h2><Toggle checked={templates.showComboRelationship} onChange={showComboRelationship=>patch({showComboRelationship})} label="保留套餐與 child 關係"/><Toggle checked={templates.separateFoodDrinkCount} onChange={separateFoodDrinkCount=>patch({separateFoodDrinkCount})} label="食品／飲品總件數分開"/></article>
    </div>
  </section>;
}

type StoreDay='MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN';
interface StoreSettings{
  storeName:string;storeCode:string;currency:string;timezone:string;
  lateArrivalMinutes:number;fulfillmentMinutes:number;archiveHours:number;
  reminderAfterMinutes:number;reminderIntervalMinutes:number;repeatReminder:boolean;timeoutPriority:'NORMAL'|'HIGH'|'URGENT';
  dineInEnabled:boolean;takeawayEnabled:boolean;
  weeklyHours:Record<StoreDay,{closed:boolean;opensAt:string;closesAt:string}>;
  paymentRefs:string[];printRefs:string[];channelRefs:string[];
}
const STORE_DAYS:readonly {id:StoreDay;label:string}[]=[
  {id:'MON',label:'星期一'},{id:'TUE',label:'星期二'},{id:'WED',label:'星期三'},
  {id:'THU',label:'星期四'},{id:'FRI',label:'星期五'},{id:'SAT',label:'星期六'},{id:'SUN',label:'星期日'},
];
const DEFAULT_WEEKLY_HOURS=Object.freeze({
  MON:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  TUE:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  WED:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  THU:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  FRI:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  SAT:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  SUN:{closed:false,opensAt:'11:00',closesAt:'20:00'},
}) as StoreSettings['weeklyHours'];

export function StoreSettingsWorkspace(){
  const [config,setConfig]=usePersistentAdminState<StoreSettings>('store-settings.v1',{
    storeName:'磨飯',storeCode:'MF01',currency:'HKD',timezone:'Asia/Hong_Kong',
    lateArrivalMinutes:15,fulfillmentMinutes:20,archiveHours:24,
    reminderAfterMinutes:5,reminderIntervalMinutes:5,repeatReminder:true,timeoutPriority:'HIGH',
    dineInEnabled:true,takeawayEnabled:true,weeklyHours:DEFAULT_WEEKLY_HOURS,
    paymentRefs:['CASH'],printRefs:['RECEIPT','PRODUCTION','PACKING','LABEL'],channelRefs:[],
  });
  const patch=(change:Partial<StoreSettings>)=>setConfig(current=>{const after={...current,...change};appendAdminAudit({action:'修改門店設定',target:current.storeCode,before:current,after});return after;});
  const patchDay=(day:StoreDay,change:Partial<StoreSettings['weeklyHours'][StoreDay]>)=>patch({weeklyHours:{...config.weeklyHours,[day]:{...config.weeklyHours[day],...change}}});
  const refs=(value:string)=>value.split(',').map(item=>item.trim()).filter(Boolean);

  return <section className="admin-editor-page">
    <PolicyHeader title="門店設定" description="管理門店身份、七日營業時間、服務模式、系統引用、營運計時同 Pending Order 提醒規則。Timeout 只改提示優先級，唔會自動接單或拒單。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>基本資料</h2><label><span>門店顯示名稱</span><input value={config.storeName} onChange={event=>patch({storeName:event.target.value})}/></label><label><span>門店代碼</span><input value={config.storeCode} onChange={event=>patch({storeCode:event.target.value})}/></label><label><span>貨幣</span><select value={config.currency} onChange={event=>patch({currency:event.target.value})}><option value="HKD">HKD</option></select></label><label><span>時區</span><input value={config.timezone} onChange={event=>patch({timezone:event.target.value})}/></label></article>
      <article className="admin-policy-card"><h2>服務模式</h2><Toggle checked={config.dineInEnabled} onChange={dineInEnabled=>patch({dineInEnabled})} label="堂食"/><Toggle checked={config.takeawayEnabled} onChange={takeawayEnabled=>patch({takeawayEnabled})} label="外賣"/></article>
      <article className="admin-policy-card"><h2>系統引用</h2><label><span>付款方式 refs</span><input value={config.paymentRefs.join(', ')} onChange={event=>patch({paymentRefs:refs(event.target.value)})} placeholder="例如 CASH, OCTOPUS"/></label><label><span>打印路由 refs</span><input value={config.printRefs.join(', ')} onChange={event=>patch({printRefs:refs(event.target.value)})} placeholder="例如 RECEIPT, KITCHEN"/></label><label><span>渠道 refs</span><input value={config.channelRefs.join(', ')} onChange={event=>patch({channelRefs:refs(event.target.value)})} placeholder="例如 KEETA"/></label></article>
      <article className="admin-policy-card"><h2>營運計時</h2><label><span>遲到界線（分鐘）</span><input type="number" min={0} value={config.lateArrivalMinutes} onChange={event=>patch({lateArrivalMinutes:Number(event.target.value)||0})}/></label><label><span>出餐計時（分鐘）</span><input type="number" min={0} value={config.fulfillmentMinutes} onChange={event=>patch({fulfillmentMinutes:Number(event.target.value)||0})}/></label><label><span>封存時間（小時）</span><input type="number" min={1} value={config.archiveHours} onChange={event=>patch({archiveHours:Number(event.target.value)||1})}/></label></article>
      <article className="admin-policy-card"><h2>Pending Order 提醒</h2><label><span>幾多分鐘後提醒</span><input type="number" min={0} value={config.reminderAfterMinutes} onChange={event=>patch({reminderAfterMinutes:Number(event.target.value)||0})}/></label><label><span>提醒間隔（分鐘）</span><input type="number" min={1} value={config.reminderIntervalMinutes} onChange={event=>patch({reminderIntervalMinutes:Number(event.target.value)||1})}/></label><Toggle checked={config.repeatReminder} onChange={repeatReminder=>patch({repeatReminder})} label="重複提醒"/><label><span>Timeout 提示優先級</span><select value={config.timeoutPriority} onChange={event=>patch({timeoutPriority:event.target.value as StoreSettings['timeoutPriority']})}><option value="NORMAL">一般</option><option value="HIGH">高</option><option value="URGENT">緊急</option></select></label><small>Timeout 唔會自動接受／拒絕訂單。</small></article>
    </div>
    <section className="admin-rule-card"><h2>七日營業時間</h2><div className="admin-editor-list">{STORE_DAYS.map(day=>{const row=config.weeklyHours[day.id]??DEFAULT_WEEKLY_HOURS[day.id];return <article className="admin-policy-row" key={day.id}><b>{day.label}</b><select value={row.closed?'CLOSED':'OPEN'} onChange={event=>patchDay(day.id,{closed:event.target.value==='CLOSED'})}><option value="OPEN">營業</option><option value="CLOSED">休息</option></select>{row.closed?<span>休息</span>:<><label><span>開門</span><input type="time" value={row.opensAt} onChange={event=>patchDay(day.id,{opensAt:event.target.value})}/></label><label><span>關門</span><input type="time" value={row.closesAt} onChange={event=>patchDay(day.id,{closesAt:event.target.value})}/></label></>}</article>})}</div></section>
  </section>;
}

interface StaffDraft{
  readonly id:string;readonly name:string;readonly role:'STAFF'|'MANAGER'|'OWNER'|'VIEWER';readonly pin:string;
  readonly scope:'STORE'|'MULTI_STORE'|'REPORT_ONLY';readonly adminLogin:boolean;readonly active:boolean;readonly permissions:readonly string[];
}
const PERMISSIONS=[['ORDER_REVIEW','查看訂單'],['ORDER_CORRECTION','更正訂單／付款'],['ADMIN_CONFIG','修改後台設定'],['PUBLISH_CONFIG','建立設定版本'],['REPORT_VIEW','查看報表'],['REPORT_EXPORT','匯出報表'],['STAFF_MANAGE','管理員工']] as const;
export function StaffWorkspace(){
  const [staff,setStaff]=usePersistentAdminState<StaffDraft[]>('staff.v1',[]);
  const add=()=>setStaff(rows=>{const row:StaffDraft={id:'staff-'+Date.now().toString(36),name:'',role:'STAFF',pin:'',scope:'STORE',adminLogin:false,active:true,permissions:['ORDER_REVIEW']};appendAdminAudit({action:'新增員工',target:row.id});return [...rows,row];});
  const patch=(id:string,change:Partial<StaffDraft>)=>setStaff(rows=>rows.map(row=>{if(row.id!==id)return row;const after={...row,...change};appendAdminAudit({action:'修改員工／權限',target:id,before:{...row,pin:row.pin?'***':''},after:{...after,pin:after.pin?'***':''}});return after;}));
  const remove=(id:string)=>setStaff(rows=>{appendAdminAudit({action:'停用並移除員工草稿',target:id});return rows.filter(row=>row.id!==id);});
  const togglePermission=(row:StaffDraft,permission:string,checked:boolean)=>patch(row.id,{permissions:checked?[...new Set([...row.permissions,permission])]:row.permissions.filter(item=>item!==permission)});
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>人員／角色／權限</small><h1>員工／權限</h1><p>管理員工、角色、PIN、權限範圍同後台登入資格。畫面隱藏唔代表有權限；正式權限仍然由系統統一判斷。</p></div><div className="admin-editor-actions"><button className="secondary" onClick={add}>新增員工</button></div></header>
    {staff.length===0?<div className="admin-empty-state"><b>未有員工資料</b><p>新增員工後設定角色、PIN、權限範圍同權限。</p><button onClick={add}>新增員工</button></div>:<div className="admin-editor-grid">{staff.map(row=><article className="admin-policy-card" key={row.id}>
      <header><h2>{row.name||'未命名員工'}</h2><small>{row.id}</small></header>
      <label><span>員工名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})}/></label>
      <label><span>角色</span><select value={row.role} onChange={event=>patch(row.id,{role:event.target.value as StaffDraft['role']})}><option value="STAFF">員工</option><option value="MANAGER">經理</option><option value="OWNER">老闆</option><option value="VIEWER">只讀人員</option></select></label>
      <label><span>PIN（4–8 位）</span><input type="password" inputMode="numeric" value={row.pin} onChange={event=>patch(row.id,{pin:event.target.value.replace(/\D/g,'').slice(0,8)})}/></label>
      <label><span>權限範圍</span><select value={row.scope} onChange={event=>patch(row.id,{scope:event.target.value as StaffDraft['scope']})}><option value="STORE">單店</option><option value="MULTI_STORE">多店</option><option value="REPORT_ONLY">只看報表</option></select></label>
      <div className="admin-check-grid">{PERMISSIONS.map(([id,label])=><label key={id}><input type="checkbox" checked={row.permissions.includes(id)} onChange={event=>togglePermission(row,id,event.target.checked)}/><span>{label}</span></label>)}</div>
      <Toggle checked={row.adminLogin} onChange={adminLogin=>patch(row.id,{adminLogin})} label="允許後台登入"/>
      <Toggle checked={row.active} onChange={active=>patch(row.id,{active})} label={row.active?'啟用':'停用'}/>
      <button type="button" onClick={()=>remove(row.id)}>移除</button>
    </article>)}</div>}
  </section>;
}

interface ChannelConfig{enabled:boolean;autoAccept:boolean;syncSellability:boolean;commissionPct:string;displayName:string;lateCutoffMinutes:number}
interface MappingRow{providerItemId:string;productId:string;optionGroupId?:string;status:'MAPPED'|'PENDING'|'IGNORED'}
export function ChannelsWorkspace({mode}:{mode:'overview'|'mapping'|'failures'|'accept'|'sync'|'estimate'}){
  const {draft}=useAdminDraft();
  const [config,setConfig]=usePersistentAdminState<ChannelConfig>('channel-policy.keeta.v1',{enabled:false,autoAccept:false,syncSellability:false,commissionPct:'',displayName:'Keeta',lateCutoffMinutes:15});
  const [mappings,setMappings]=usePersistentAdminState<MappingRow[]>('channel-mapping.keeta.v1',[]);
  const [providerItemId,setProviderItemId]=useState('');
  const [productId,setProductId]=useState('');
  const patch=(change:Partial<ChannelConfig>)=>setConfig(current=>{const after={...current,...change};appendAdminAudit({action:'修改平台設定',target:'Keeta',before:current,after});return after;});
  const addMapping=()=>{if(!providerItemId.trim()||!productId)return;setMappings(rows=>{const row:MappingRow={providerItemId:providerItemId.trim(),productId,status:'MAPPED'};appendAdminAudit({action:'新增平台商品對應',target:row.providerItemId,after:row});return [...rows.filter(item=>item.providerItemId!==row.providerItemId),row];});setProviderItemId('');setProductId('');};
  const failures=mappings.filter(row=>row.status==='PENDING');
  const title=mode==='overview'?'平台管理':mode==='mapping'?'商品映射管理':mode==='failures'?'匹配失敗明細':mode==='accept'?'接單／自動接單':mode==='sync'?'售罄／供應同步':'實收估算設定';
  return <section className="admin-editor-page">
    <PolicyHeader title={title} description="管理平台顯示名稱、接單、供應同步、佣金估算同商品對應。未有正式平台回傳之前，唔會顯示已套用。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>Keeta 平台設定</h2><label><span>顯示名稱</span><input value={config.displayName} onChange={event=>patch({displayName:event.target.value})}/></label><Toggle checked={config.enabled} onChange={enabled=>patch({enabled})} label="啟用平台設定"/><Toggle checked={config.autoAccept} onChange={autoAccept=>patch({autoAccept})} label="正常單自動接單"/><Toggle checked={config.syncSellability} onChange={syncSellability=>patch({syncSellability})} label="同步售罄／供應"/><label><span>遲到訂單界線（分鐘）</span><input type="number" min={0} value={config.lateCutoffMinutes} onChange={event=>patch({lateCutoffMinutes:Number(event.target.value)||0})}/></label><label><span>佣金估算 %</span><input inputMode="decimal" value={config.commissionPct} onChange={event=>patch({commissionPct:event.target.value})}/></label></article>
      <article className="admin-policy-card"><h2>{mode==='failures'?'未完成對應':'商品對應'}</h2>
        {mode==='failures'
          ?(failures.length?<div>{failures.map(row=><p key={row.providerItemId}>{row.providerItemId} · 待處理</p>)}</div>:<div className="admin-read-empty">目前冇待處理映射。</div>)
          :<><label><span>平台商品 ID</span><input value={providerItemId} onChange={event=>setProviderItemId(event.target.value)}/></label><label><span>磨飯商品</span><select value={productId} onChange={event=>setProductId(event.target.value)}><option value="">請選擇</option>{draft.products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label><button type="button" onClick={addMapping}>保存對應</button><div className="admin-readback-proof">{mappings.slice(0,20).map(row=><p key={row.providerItemId}><span>{row.providerItemId}</span><b>{draft.products.find(product=>product.id===row.productId)?.name??row.productId}</b></p>)}</div></>}
      </article>
    </div>
  </section>;
}
