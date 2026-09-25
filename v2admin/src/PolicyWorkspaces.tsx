import {useEffect,useMemo,useState} from 'react';
import {useAdminDraft} from './admin-draft.tsx';
import {appendAdminAudit,readActiveAdminRelease,usePersistentAdminState,writeAdminStored} from './admin-local-store.ts';
import {saveAdminConfig} from './admin-config-save.ts';
import {uploadAdminPaymentQr} from './admin-sync-client.ts';
import {
  beginKeetaOAuth,
  checkKeetaTokenReadiness,
  importKeetaTestToken,
  previewKeetaMenu,
  previewKeetaSellability,
  previewKeetaStoreHours,
  readKeetaCommercialRows,
  readKeetaOrderIntakeRows,
  refreshKeetaCommercial,
  readKeetaLiveStatus,
  readKeetaMenuStatus,
  readKeetaSellabilityStatus,
  readKeetaStore,
  readKeetaStoreStatus,
  restKeetaStore,
  openKeetaStore,
  syncKeetaMenu,
  syncKeetaSellability,
  syncKeetaStoreHours,
  type KeetaCommercialRow,
  type KeetaOrderIntakeRow,
  type KeetaLiveStatus,
  type KeetaMenuPreview,
  type KeetaMenuStatus,
  type KeetaSellabilityPreview,
  type KeetaSellabilityStatus,
  type KeetaStorePreview,
  type KeetaStoreStatus,
} from './keeta-live-client.ts';

function PolicyHeader({title,description,badge='本機設定自動保存'}:{title:string;description:string;badge?:string}){
  return <header className="admin-editor-head">
    <div><small>{badge}</small><h1>{title}</h1><p>{description}</p></div>
  </header>;
}
const Toggle=({checked,onChange,label}:{checked:boolean;onChange:(next:boolean)=>void;label:string})=><label className="admin-toggle"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><span>{label}</span></label>;

export function keetaActionErrorText(error:string){
  const code=error.trim();
  return code?'Keeta 操作未完成：'+code:'';
}

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
      {([['receipt','收據'],['production','製作單'],['packing','打包單'],['label','標籤']] as const).map(([key,title])=><article className="admin-policy-card" key={key}><h2>{title}</h2><label><span>{title}模板內容</span><textarea value={templates[key]} onChange={event=>patch({[key]:event.target.value})} rows={8}/></label></article>)}
      <article className="admin-policy-card"><h2>輸出語義</h2><Toggle checked={templates.showComboRelationship} onChange={showComboRelationship=>patch({showComboRelationship})} label="保留套餐與 child 關係"/><Toggle checked={templates.separateFoodDrinkCount} onChange={separateFoodDrinkCount=>patch({separateFoodDrinkCount})} label="食品／飲品總件數分開"/></article>
    </div>
  </section>;
}

type StoreDay='MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN';
interface DiningTableConfig{readonly id:string;readonly name:string;readonly active:boolean;readonly sortOrder:number}
interface CustomerPaymentChannelConfig{readonly id:string;readonly name:string;readonly enabled:boolean;readonly qrImageUrl:string;readonly sortOrder:number}
interface StoreSettings{
  storeName:string;storeCode:string;currency:string;timezone:string;
  lateArrivalMinutes:number;fulfillmentMinutes:number;archiveHours:number;
  reminderAfterMinutes:number;reminderIntervalMinutes:number;repeatReminder:boolean;timeoutPriority:'NORMAL'|'HIGH'|'URGENT';
  dineInEnabled:boolean;takeawayEnabled:boolean;
  diningTables:DiningTableConfig[];
  customerPaymentChannels:CustomerPaymentChannelConfig[];
  weeklyHours:Record<StoreDay,{closed:boolean;opensAt:string;closesAt:string}>;
  paymentRefs:string[];printRefs:string[];channelRefs:string[];
}
const STORE_DAYS:readonly {id:StoreDay;label:string}[]=[
  {id:'MON',label:'星期一'},{id:'TUE',label:'星期二'},{id:'WED',label:'星期三'},
  {id:'THU',label:'星期四'},{id:'FRI',label:'星期五'},{id:'SAT',label:'星期六'},{id:'SUN',label:'星期日'},
];
const DEFAULT_CUSTOMER_PAYMENT_CHANNELS:CustomerPaymentChannelConfig[]=[
  {id:'ALIPAY',name:'AlipayHK',enabled:true,qrImageUrl:'',sortOrder:1},
  {id:'WECHAT',name:'WeChat Pay HK',enabled:true,qrImageUrl:'',sortOrder:2},
  {id:'FPS',name:'轉數快',enabled:true,qrImageUrl:'',sortOrder:3},
  {id:'PAYME',name:'PayMe',enabled:true,qrImageUrl:'',sortOrder:4},
];
const DEFAULT_DINING_TABLES:DiningTableConfig[]=Array.from({length:9},(_,index)=>({
  id:'T'+String(index+1).padStart(2,'0'),
  name:String(index+1)+' 號枱',
  active:true,
  sortOrder:index+1,
}));
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
    dineInEnabled:true,takeawayEnabled:true,diningTables:DEFAULT_DINING_TABLES,customerPaymentChannels:DEFAULT_CUSTOMER_PAYMENT_CHANNELS,weeklyHours:DEFAULT_WEEKLY_HOURS,
    paymentRefs:['CASH'],printRefs:['RECEIPT','PRODUCTION','PACKING','LABEL'],channelRefs:[],
  });
  const patch=(change:Partial<StoreSettings>)=>setConfig(current=>{const after={...current,...change};appendAdminAudit({action:'修改門店設定',target:current.storeCode,before:current,after});return after;});
  const patchDay=(day:StoreDay,change:Partial<StoreSettings['weeklyHours'][StoreDay]>)=>patch({weeklyHours:{...config.weeklyHours,[day]:{...config.weeklyHours[day],...change}}});
  const refs=(value:string)=>value.split(',').map(item=>item.trim()).filter(Boolean);
  const diningTables=(config.diningTables??DEFAULT_DINING_TABLES).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const paymentChannels=(config.customerPaymentChannels??DEFAULT_CUSTOMER_PAYMENT_CHANNELS).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const [paymentUploadState,setPaymentUploadState]=useState<Record<string,string>>({});
  const patchPaymentChannel=(id:string,change:Partial<CustomerPaymentChannelConfig>)=>patch({customerPaymentChannels:paymentChannels.map(row=>row.id===id?{...row,...change}:row)});
  const addPaymentChannel=()=>{
    const used=new Set(paymentChannels.map(row=>row.id));
    let n=paymentChannels.length+1;
    let id='PAY-'+String(n).padStart(2,'0');
    while(used.has(id)){n++;id='PAY-'+String(n).padStart(2,'0')}
    patch({customerPaymentChannels:[...paymentChannels,{id,name:'新付款方式',enabled:false,qrImageUrl:'',sortOrder:paymentChannels.length+1}]});
  };
  const removePaymentChannel=(id:string)=>patch({customerPaymentChannels:paymentChannels.filter(row=>row.id!==id)});
  const uploadPaymentQr=async(id:string,file:File)=>{
    setPaymentUploadState(current=>({...current,[id]:'上載中…'}));
    try{
      const uploaded=await uploadAdminPaymentQr(file,id,config.storeCode||'MF01');
      patchPaymentChannel(id,{qrImageUrl:uploaded.qrImageUrl});
      setPaymentUploadState(current=>({...current,[id]:'已上載'}));
    }catch(error){
      setPaymentUploadState(current=>({...current,[id]:error instanceof Error?error.message:'上載失敗'}));
    }
  };
  const patchTable=(id:string,change:Partial<DiningTableConfig>)=>patch({diningTables:diningTables.map(row=>row.id===id?{...row,...change}:row)});
  const addTable=()=>patch({diningTables:[...diningTables,{
    id:'T'+String(Math.min(99,Math.max(0,...diningTables.map(row=>Number(row.id.replace(/\D/g,''))||0))+1)).padStart(2,'0'),
    name:'新枱',
    active:true,
    sortOrder:diningTables.length+1,
  }]});
  const removeTable=(id:string)=>patch({diningTables:diningTables.filter(row=>row.id!==id)});


  return <section className="admin-editor-page">
    <PolicyHeader title="門店設定" description="管理門店身份、七日營業時間、服務模式、系統引用、營運計時同 Pending Order 提醒規則。Timeout 只改提示優先級，唔會自動接單或拒單。"/>
    <div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>基本資料</h2><label><span>門店顯示名稱</span><input value={config.storeName} onChange={event=>patch({storeName:event.target.value})}/></label><label><span>門店代碼</span><input value={config.storeCode} onChange={event=>patch({storeCode:event.target.value})}/></label><label><span>貨幣</span><select value={config.currency} onChange={event=>patch({currency:event.target.value})}><option value="HKD">HKD</option></select></label><label><span>時區</span><input value={config.timezone} onChange={event=>patch({timezone:event.target.value})}/></label></article>
      <article className="admin-policy-card"><h2>服務模式</h2><Toggle checked={config.dineInEnabled} onChange={dineInEnabled=>patch({dineInEnabled})} label="堂食"/><Toggle checked={config.takeawayEnabled} onChange={takeawayEnabled=>patch({takeawayEnabled})} label="外賣"/></article>
      <article className="admin-policy-card"><header><div><h2>堂食枱號</h2><small>由 Admin 發佈，SMT／SMM 共用同一份枱號同名稱。</small></div><button type="button" onClick={addTable}>新增枱</button></header>
        <div className="admin-editor-list">{diningTables.map((row,index)=><div className="admin-policy-row" key={row.id}>
          <b>{row.id}</b>
          <label><span>顯示名稱</span><input value={row.name} onChange={event=>patchTable(row.id,{name:event.target.value})}/></label>
          <label><span>排序</span><input type="number" min={1} value={row.sortOrder} onChange={event=>patchTable(row.id,{sortOrder:Number(event.target.value)||index+1})}/></label>
          <Toggle checked={row.active} onChange={active=>patchTable(row.id,{active})} label={row.active?'啟用':'停用'}/>
          <button type="button" onClick={()=>removeTable(row.id)}>刪除</button>
        </div>)}</div>
      </article>
      <article className="admin-policy-card"><header><div><h2>客戶電子支付</h2><small>新增、改名、上傳付款 QR、啟用／停用；Customer 只讀已發佈版本。</small></div><button type="button" onClick={addPaymentChannel}>新增付款方式</button></header>
        <div className="admin-editor-list">{paymentChannels.map((row,index)=><div className="admin-policy-row" key={row.id}>
          <b>{row.id}</b>
          <label><span>顯示名稱</span><input value={row.name} onChange={event=>patchPaymentChannel(row.id,{name:event.target.value})} placeholder="例如 AlipayHK"/></label>
          <label><span>付款 QR 圖</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)void uploadPaymentQr(row.id,file)}}/></label>
          {row.qrImageUrl?<div><img src={row.qrImageUrl} alt={row.name+' QR'} style={{width:72,height:72,objectFit:'contain',borderRadius:10,border:'1px solid rgba(0,0,0,.12)'}}/><button type="button" onClick={()=>patchPaymentChannel(row.id,{qrImageUrl:''})}>移除圖片</button></div>:<span>未有付款 QR</span>}
          <small>{paymentUploadState[row.id]??''}</small>
          <label><span>排序</span><input type="number" min={1} value={row.sortOrder} onChange={event=>patchPaymentChannel(row.id,{sortOrder:Number(event.target.value)||index+1})}/></label>
          <Toggle checked={row.enabled} onChange={enabled=>patchPaymentChannel(row.id,{enabled})} label={row.enabled?'啟用':'停用'}/>
          <button type="button" onClick={()=>removePaymentChannel(row.id)}>刪除付款方式</button>
        </div>)}</div>
        <p>付款 QR 會經 Admin Worker 上載到私有 R2；R2 唔開 Public Access。未有 QR 嘅付款方式可以保留設定，但 Customer 唔可以用佢提交電子付款。</p>
      </article>
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
  const {draft,markClean}=useAdminDraft();
  const [staff,setStaff]=usePersistentAdminState<StaffDraft[]>('staff.v1',[]);
  const [saveMessage,setSaveMessage]=useState('');
  const [saveErrors,setSaveErrors]=useState<readonly string[]>([]);
  const add=()=>setStaff(rows=>{const row:StaffDraft={id:'staff-'+Date.now().toString(36),name:'',role:'STAFF',pin:'',scope:'STORE',adminLogin:false,active:true,permissions:['ORDER_REVIEW']};appendAdminAudit({action:'新增員工',target:row.id});return [...rows,row];});
  const patch=(id:string,change:Partial<StaffDraft>)=>setStaff(rows=>rows.map(row=>{if(row.id!==id)return row;const after={...row,...change};appendAdminAudit({action:'修改員工／權限',target:id,before:{...row,pin:row.pin?'***':''},after:{...after,pin:after.pin?'***':''}});return after;}));
  const remove=(row:StaffDraft)=>{
    if(typeof window!=='undefined'&&!window.confirm('確定移除「'+(row.name||row.id)+'」嘅員工草稿？一般停用請使用狀態開關。'))return;
    setStaff(rows=>{appendAdminAudit({action:'停用並移除員工草稿',target:row.id});return rows.filter(item=>item.id!==row.id);});
  };
  const togglePermission=(row:StaffDraft,permission:string,checked:boolean)=>patch(row.id,{permissions:checked?[...new Set([...row.permissions,permission])]:row.permissions.filter(item=>item!==permission)});
  const saveStaff=()=>{
    writeAdminStored('staff.v1',staff);
    const result=saveAdminConfig(draft);
    if(!result.ok){setSaveErrors(result.errors);setSaveMessage('未能保存；請先修正人員資料。');return;}
    markClean();
    setSaveErrors([]);
    setSaveMessage('已保存並啟用 R'+result.release.version+'；已排入 Admin → SMT 自動同步。');
  };
  const activeRelease=readActiveAdminRelease();
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>{activeRelease?'目前 R'+activeRelease.version:'未有保存版本'} · 人員／角色／權限</small><h1>員工／權限</h1><p>管理員工、角色、PIN、權限範圍同後台登入資格。PIN 只會轉成驗證器送到 SMT，唔會將明文 PIN 發布出去。</p>{saveMessage?<span>{saveMessage}</span>:null}</div><div className="admin-editor-actions"><button className="secondary" onClick={add}>新增員工</button><button className="primary" onClick={saveStaff}>保存人員設定</button></div></header>
    {saveErrors.length?<div className="admin-validation is-error" role="alert"><b>有 {saveErrors.length} 項需要處理</b><ul>{saveErrors.map((error,index)=><li key={index}>{error}</li>)}</ul></div>:null}
    {staff.length===0?<div className="admin-empty-state"><b>未有員工資料</b><p>新增員工後設定角色、PIN、權限範圍同權限。</p><button onClick={add}>新增員工</button></div>:<div className="admin-editor-grid">{staff.map(row=><article className="admin-policy-card" key={row.id}>
      <header><h2>{row.name||'未命名員工'}</h2><small>{row.id}</small></header>
      <label><span>員工名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})}/></label>
      <label><span>角色</span><select value={row.role} onChange={event=>patch(row.id,{role:event.target.value as StaffDraft['role']})}><option value="STAFF">員工</option><option value="MANAGER">經理</option><option value="OWNER">老闆</option><option value="VIEWER">只讀人員</option></select></label>
      <label><span>PIN（4–8 位）</span><input type="password" inputMode="numeric" autoComplete="new-password" value={row.pin} onChange={event=>patch(row.id,{pin:event.target.value.replace(/\D/g,'').slice(0,8)})}/></label>
      <label><span>權限範圍</span><select value={row.scope} onChange={event=>patch(row.id,{scope:event.target.value as StaffDraft['scope']})}><option value="STORE">單店</option><option value="MULTI_STORE">多店</option><option value="REPORT_ONLY">只看報表</option></select></label>
      <div className="admin-check-grid">{PERMISSIONS.map(([id,label])=><label key={id}><input type="checkbox" checked={row.permissions.includes(id)} onChange={event=>togglePermission(row,id,event.target.checked)}/><span>{label}</span></label>)}</div>
      <Toggle checked={row.adminLogin} onChange={adminLogin=>patch(row.id,{adminLogin})} label="允許後台登入"/>
      <Toggle checked={row.active} onChange={active=>patch(row.id,{active})} label={row.active?'啟用':'停用'}/>
      <button type="button" onClick={()=>remove(row)}>移除</button>
    </article>)}</div>}
  </section>;
}

interface ChannelConfig{enabled:boolean;autoAccept:boolean;syncSellability:boolean;commissionPct:string;displayName:string;lateCutoffMinutes:number}
interface MappingRow{providerItemId:string;productId:string;optionGroupId?:string;status:'MAPPED'|'PENDING'|'IGNORED'}
export function ChannelsWorkspace({mode}:{mode:'overview'|'mapping'|'failures'|'accept'|'sync'|'estimate'}){
  const {draft}=useAdminDraft();
  const [liveStatus,setLiveStatus]=useState<KeetaLiveStatus|null>(null);
  const [liveError,setLiveError]=useState('');
  const [liveBusy,setLiveBusy]=useState(false);
  const [testTokenJson,setTestTokenJson]=useState('');
  const [menuPreview,setMenuPreview]=useState<KeetaMenuPreview|null>(null);
  const [menuStatus,setMenuStatus]=useState<KeetaMenuStatus|null>(null);
  const [menuBusy,setMenuBusy]=useState(false);
  const [sellabilityPreview,setSellabilityPreview]=useState<KeetaSellabilityPreview|null>(null);
  const [sellabilityStatus,setSellabilityStatus]=useState<KeetaSellabilityStatus|null>(null);
  const [storePreview,setStorePreview]=useState<KeetaStorePreview|null>(null);
  const [storeStatus,setStoreStatus]=useState<KeetaStoreStatus|null>(null);
  const [providerOpsBusy,setProviderOpsBusy]=useState(false);
  const [commercialRows,setCommercialRows]=useState<readonly KeetaCommercialRow[]>([]);
  const [commercialBusy,setCommercialBusy]=useState<string|null>(null);
  const [orderIntakeRows,setOrderIntakeRows]=useState<readonly KeetaOrderIntakeRow[]>([]);
  const [orderIntakePending,setOrderIntakePending]=useState(0);
  const [orderIntakeCommitted,setOrderIntakeCommitted]=useState(0);
  const [orderIntakeLastPull,setOrderIntakeLastPull]=useState<{deviceId:string;observedAt:string;pendingCount:number}|null>(null);
  const [orderIntakeBusy,setOrderIntakeBusy]=useState(false);
  const refreshLive=async()=>{
    try{setLiveStatus(await readKeetaLiveStatus());setLiveError('');}
    catch(error){setLiveError(error instanceof Error?error.message:'KEETA_STATUS_FAILED');}
  };
  const refreshMenu=async()=>{
    setMenuBusy(true);
    try{setMenuStatus(await readKeetaMenuStatus());setLiveError('');}
    catch(error){setLiveError(error instanceof Error?error.message:'KEETA_MENU_STATUS_FAILED');}
    finally{setMenuBusy(false);}
  };
  const refreshProviderOps=async()=>{
    try{
      const [sellability,store]=await Promise.all([readKeetaSellabilityStatus(),readKeetaStoreStatus()]);
      setSellabilityStatus(sellability);
      setStoreStatus(store);
    }catch(error){setLiveError(error instanceof Error?error.message:'KEETA_PROVIDER_OPS_STATUS_FAILED');}
  };
  const refreshCommercialRows=async()=>{
    try{setCommercialRows((await readKeetaCommercialRows()).items);}
    catch(error){setLiveError(error instanceof Error?error.message:'KEETA_COMMERCIAL_READ_FAILED');}
  };
  const refreshOrderIntake=async()=>{
    setOrderIntakeBusy(true);
    try{
      const result=await readKeetaOrderIntakeRows();
      setOrderIntakeRows(result.items);
      setOrderIntakePending(result.pending);
      setOrderIntakeCommitted(result.committed);
      setOrderIntakeLastPull(result.lastSmtPull);
      setLiveError('');
    }catch(error){
      setLiveError(error instanceof Error?error.message:'KEETA_ORDER_INTAKE_READ_FAILED');
    }finally{setOrderIntakeBusy(false);}
  };
  useEffect(()=>{
    if(mode==='overview'||mode==='sync'){
      void refreshLive();
      void refreshMenu();
      void refreshProviderOps();
    }
    if(mode==='estimate'){
      void refreshLive();
      void refreshCommercialRows();
    }
    if(mode==='overview'||mode==='accept'){
      void refreshOrderIntake();
    }
  },[mode]);
  const authorize=async()=>{
    setLiveBusy(true);setLiveError('');
    try{
      const url=await beginKeetaOAuth();
      window.location.assign(url);
    }catch(error){
      setLiveError(error instanceof Error?error.message:'KEETA_OAUTH_BEGIN_FAILED');
      setLiveBusy(false);
    }
  };
  const checkToken=async()=>{
    setLiveBusy(true);setLiveError('');
    try{
      const result=await checkKeetaTokenReadiness();
      if(!result.ok)setLiveError(result.code||'KEETA_TOKEN_UNAVAILABLE');
      await refreshLive();
    }finally{setLiveBusy(false);}
  };
  const importTestToken=async()=>{
    if(!testTokenJson.trim())return;
    setLiveBusy(true);setLiveError('');
    try{
      await importKeetaTestToken(testTokenJson);
      setTestTokenJson('');
      await refreshLive();
    }catch(error){
      setLiveError(error instanceof Error?error.message:'KEETA_TEST_TOKEN_IMPORT_FAILED');
    }finally{setLiveBusy(false);}
  };
  const previewMenu=async()=>{
    setMenuBusy(true);setLiveError('');
    try{
      const preview=await previewKeetaMenu();
      setMenuPreview(preview);
      await refreshMenu();
    }catch(error){
      setMenuPreview(null);
      setLiveError(error instanceof Error?error.message:'KEETA_MENU_PREVIEW_FAILED');
    }finally{setMenuBusy(false);}
  };
  const submitMenu=async()=>{
    setMenuBusy(true);setLiveError('');
    try{
      const preview=await previewKeetaMenu();
      setMenuPreview(preview);
      setMenuStatus(await syncKeetaMenu());
    }catch(error){
      setLiveError(error instanceof Error?error.message:'KEETA_MENU_SYNC_FAILED');
    }finally{setMenuBusy(false);}
  };
  const previewSellability=async()=>{
    setProviderOpsBusy(true);setLiveError('');
    try{setSellabilityPreview(await previewKeetaSellability());await refreshProviderOps();}
    catch(error){setSellabilityPreview(null);setLiveError(error instanceof Error?error.message:'KEETA_SELLABILITY_PREVIEW_FAILED');}
    finally{setProviderOpsBusy(false);}
  };
  const submitSellability=async()=>{
    setProviderOpsBusy(true);setLiveError('');
    try{setSellabilityPreview(await previewKeetaSellability());setSellabilityStatus(await syncKeetaSellability());}
    catch(error){setLiveError(error instanceof Error?error.message:'KEETA_SELLABILITY_SYNC_FAILED');}
    finally{setProviderOpsBusy(false);}
  };
  const previewStore=async()=>{
    setProviderOpsBusy(true);setLiveError('');
    try{setStorePreview(await previewKeetaStoreHours());}
    catch(error){setStorePreview(null);setLiveError(error instanceof Error?error.message:'KEETA_STORE_PREVIEW_FAILED');}
    finally{setProviderOpsBusy(false);}
  };
  const submitStoreHours=async()=>{
    setProviderOpsBusy(true);setLiveError('');
    try{setStorePreview(await previewKeetaStoreHours());setStoreStatus(await syncKeetaStoreHours());}
    catch(error){setLiveError(error instanceof Error?error.message:'KEETA_STORE_HOURS_SYNC_FAILED');}
    finally{setProviderOpsBusy(false);}
  };
  const runStoreOperation=async(action:'REST'|'OPEN')=>{
    setProviderOpsBusy(true);setLiveError('');
    try{
      setStoreStatus(action==='REST'?await restKeetaStore():await openKeetaStore());
      await readKeetaStore();
      await refreshProviderOps();
    }catch(error){setLiveError(error instanceof Error?error.message:'KEETA_STORE_OPERATION_FAILED');}
    finally{setProviderOpsBusy(false);}
  };
  const refreshStoreReadback=async()=>{
    setProviderOpsBusy(true);setLiveError('');
    try{await readKeetaStore();await refreshProviderOps();}
    catch(error){setLiveError(error instanceof Error?error.message:'KEETA_STORE_READBACK_FAILED');}
    finally{setProviderOpsBusy(false);}
  };
  const refreshCommercial=async(providerOrderId:string)=>{
    if(commercialBusy)return;
    setCommercialBusy(providerOrderId);setLiveError('');
    try{await refreshKeetaCommercial(providerOrderId);await refreshCommercialRows();}
    catch(error){setLiveError(error instanceof Error?error.message:'KEETA_COMMERCIAL_REFRESH_FAILED');}
    finally{setCommercialBusy(null);}
  };
  const commercialMoney=(value:number|undefined)=>value===undefined?'—':'HK'+String.fromCharCode(36)+(value/100).toFixed(2);
  const [config,setConfig]=usePersistentAdminState<ChannelConfig>('channel-policy.keeta.v1',{enabled:false,autoAccept:false,syncSellability:false,commissionPct:'',displayName:'Keeta',lateCutoffMinutes:15});
  const [mappings,setMappings]=usePersistentAdminState<MappingRow[]>('channel-mapping.keeta.v1',[]);
  const [providerItemId,setProviderItemId]=useState('');
  const [productId,setProductId]=useState('');
  const patch=(change:Partial<ChannelConfig>)=>setConfig(current=>{const after={...current,...change};appendAdminAudit({action:'修改平台設定',target:'Keeta',before:current,after});return after;});
  const addMapping=()=>{if(!providerItemId.trim()||!productId)return;setMappings(rows=>{const row:MappingRow={providerItemId:providerItemId.trim(),productId,status:'MAPPED'};appendAdminAudit({action:'新增平台商品對應',target:row.providerItemId,after:row});return [...rows.filter(item=>item.providerItemId!==row.providerItemId),row];});setProviderItemId('');setProductId('');};
  const failures=mappings.filter(row=>row.status==='PENDING');
  const title=mode==='overview'?'平台管理':mode==='mapping'?'商品映射管理':mode==='failures'?'匹配失敗明細':mode==='accept'?'接單／自動接單':mode==='sync'?'售罄／供應同步':'實收估算設定';
  return <section className="admin-editor-page">
    <PolicyHeader title={title} description="管理平台顯示名稱、接單、供應同步、佣金估算同商品對應。Live connection 狀態同 Provider business authority 分開顯示，唔會因為連線成功就自動啟動接單。"/>
    {mode==='overview'?<section className="admin-policy-card">
      <header><div><small>KEETA LIVE CONNECTION</small><h2>Keeta 香港連線</h2></div><span className={liveStatus?.oauth.state==='CONNECTED'?'admin-status-good':'admin-not-wired-chip'}>{liveStatus?.oauth.state??'讀取中'}</span></header>
      {liveStatus?<div className="admin-readback-proof">
        <p><span>Canonical Store</span><b>{liveStatus.canonicalStoreId}</b></p>
        <p><span>Provider Shop</span><b>{liveStatus.providerShopId??'未設定'}</b></p>
        <p><span>OAuth</span><b>{liveStatus.oauth.state}</b></p>
        <p><span>Token 到期</span><b>{liveStatus.oauth.expiresAt?new Date(liveStatus.oauth.expiresAt).toLocaleString('zh-HK'):'—'}</b></p>
        <p><span>Token 來源</span><b>{liveStatus.oauth.tokenSource??'—'}</b></p>
        <p><span>Token 自動刷新</span><b>{liveStatus.oauth.autoRefresh?.state??'讀取中'}</b></p>
        <p><span>下次自動刷新</span><b>{liveStatus.oauth.autoRefresh?.nextRefreshAt?new Date(liveStatus.oauth.autoRefresh.nextRefreshAt).toLocaleString('zh-HK'):'—'}</b></p>
        <p><span>最近自動刷新</span><b>{liveStatus.oauth.autoRefresh?.lastSuccessAt?new Date(liveStatus.oauth.autoRefresh.lastSuccessAt).toLocaleString('zh-HK'):'—'}</b></p>
        <p><span>自動刷新錯誤</span><b>{liveStatus.oauth.autoRefresh?.lastError??'—'}</b></p>
        <p><span>Provider Token 驗證</span><b>{liveStatus.oauth.providerValidation?.state??'未有失效紀錄'}</b></p>
        <p><span>最近 OAuth callback</span><b>{liveStatus.oauth.lastCallbackAt?new Date(liveStatus.oauth.lastCallbackAt).toLocaleString('zh-HK'):'—'}</b></p>
        <p><span>Callback 結果</span><b>{liveStatus.oauth.lastCallbackResult??'—'}</b></p>
        <p><span>Callback 錯誤</span><b>{liveStatus.oauth.lastCallbackError??'—'}</b></p>
        <p><span>Callback 方法</span><b>{liveStatus.oauth.lastCallbackMethod??'—'}</b></p>
        <p><span>Callback 參數</span><b>{liveStatus.oauth.lastCallbackParamNames.length?liveStatus.oauth.lastCallbackParamNames.join(', '):'—'}</b></p>
        <p><span>Webhook</span><b>{liveStatus.webhook.callbackUrl}</b></p>
        <p><span>Webhook Accepted</span><b>{liveStatus.webhook.acceptedCount}</b></p>
        <p><span>最近 Event</span><b>{liveStatus.webhook.lastEventId??'—'} / {liveStatus.webhook.lastMessageId??'—'}</b></p>
        <p><span>最近驗簽失敗</span><b>{liveStatus.webhook.lastSignatureFailureAt?new Date(liveStatus.webhook.lastSignatureFailureAt).toLocaleString('zh-HK'):'—'}</b></p>
      </div>:<div className="admin-read-empty">正在讀取 Keeta live runtime 狀態。</div>}
      {liveStatus?.missingConfig.length?<div className="admin-validation is-error"><b>Runtime 尚欠設定</b><ul>{liveStatus.missingConfig.map(item=><li key={item}>{item}</li>)}</ul></div>:null}
      {liveStatus?.knownExternalBlocker?<div className="admin-callout compact">Known external blocker：{liveStatus.knownExternalBlocker}。驗簽會 fail-closed，唔會為咗接通而放鬆。</div>:null}
      {liveError?<div className="admin-validation is-error" role="alert">{liveError}</div>:null}
      <div className="admin-editor-actions">
        <button type="button" className="secondary" disabled={liveBusy} onClick={()=>void refreshLive()}>更新狀態</button>
        <button type="button" className="secondary" disabled={liveBusy||!liveStatus?.oauth.tokenSource} onClick={()=>void checkToken()}>檢查 Token</button>
        <button type="button" className="primary" disabled={liveBusy||!liveStatus?.readyForAuthorization} onClick={()=>void authorize()}>{liveStatus?.oauth.state==='CONNECTED'?'重新授權 Keeta':'開始 Keeta 授權'}</button>
      </div>
      <details className="admin-rule-card">
        <summary><b>測試／救援：手動匯入 Token（正常毋須使用）</b></summary>
        <p>正常情況只需完成一次 OAuth／Token bootstrap；之後會用已保存嘅 refreshToken 自動輪換 accessToken 同 refreshToken。只有 refreshToken 真正失效先需要重新授權。手動匯入只保留俾測試／救援。</p>
        <p>救援位置：Keeta Developers → 應用程式管理 → 磨飯v2 → 授權管理 → 門店數量 → 查看 Token。</p>
        <label>
          <span>Token JSON</span>
          <textarea
            rows={6}
            value={testTokenJson}
            onChange={event=>setTestTokenJson(event.target.value)}
            placeholder='貼上「查看 Token」顯示嘅完整 JSON'
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="admin-editor-actions">
          <button type="button" className="primary" disabled={liveBusy||!testTokenJson.trim()} onClick={()=>void importTestToken()}>匯入現有測試 Token</button>
        </div>
        <small>Token 只會送到 MFK runtime，以現有 encryption key 加密保存；成功後輸入欄會即時清空。呢個輸入唔會寫入 Admin draft、localStorage 或操作記錄。</small>
      </details>
      <small>目前連線層已接通；Provider business commands 會按 Owner 已授權嘅 Keeta Full Integration program 逐 seam 接入。</small>
    </section>:null}
    {(mode==='overview'||mode==='accept')?<section className="admin-policy-card">
      <header>
        <div><small>KEETA ORDER INTAKE</small><h2>Keeta 新單入口／SMT 接收狀態</h2></div>
        <span className={orderIntakePending?'admin-not-wired-chip':'admin-status-good'}>{orderIntakePending} 待 SMT</span>
      </header>
      <p>呢度直接讀 Keeta webhook 已接收嘅訂單入口。PENDING_SMT = Provider 已推送成功，但 SMT 未正式建立 Order；COMMITTED = SMT 已建立同一張 canonical Order。</p>
      <div className="admin-readback-proof">
        <p><span>待 SMT 接收</span><b>{orderIntakePending}</b></p>
        <p><span>已入 SMT</span><b>{orderIntakeCommitted}</b></p>
        <p><span>最近記錄</span><b>{orderIntakeRows.length}</b></p>
        <p><span>SMT 最近拉單</span><b>{orderIntakeLastPull?.observedAt?new Date(orderIntakeLastPull.observedAt).toLocaleString('zh-HK'):'未見'}</b></p>
        <p><span>拉單裝置</span><b>{orderIntakeLastPull?.deviceId||'—'}</b></p>
      </div>
      {orderIntakeRows.length?<div className="admin-editor-list">
        {orderIntakeRows.slice(0,30).map(row=><article className="admin-policy-row" key={row.providerOrderId}>
          <div>
            <b>Keeta {row.providerOrderId}</b>
            <small>Message {row.providerMessageId} · {row.receivedAt?new Date(row.receivedAt).toLocaleString('zh-HK'):'—'}</small>
          </div>
          <div className="admin-readback-proof">
            <p><span>Provider</span><b>{row.state==='PENDING_SMT'?'已收到，待 SMT':'已入 SMT'}</b></p>
            <p><span>Canonical Order</span><b>{row.canonicalOrderId??'—'}</b></p>
            <p><span>Display</span><b>{row.canonicalDisplay??'—'}</b></p>
            <p><span>Committed</span><b>{row.committedAt?new Date(row.committedAt).toLocaleString('zh-HK'):'—'}</b></p>
          </div>
        </article>)}
      </div>:<div className="admin-read-empty">未有 Keeta 1001 訂單入口記錄。</div>}
      <div className="admin-editor-actions">
        <button type="button" className="secondary" disabled={orderIntakeBusy} onClick={()=>void refreshOrderIntake()}>{orderIntakeBusy?'讀取中…':'重新讀取 Keeta 新單'}</button>
      </div>
      {liveError?<div className="admin-validation is-error" role="alert">{liveError}</div>:null}
    </section>:null}
    {(mode==='overview'||mode==='sync')?<section className="admin-policy-card">
      <header>
        <div><small>KEETA FULL MENU SNAPSHOT</small><h2>Keeta 菜單同步</h2></div>
        <span className={menuStatus?.state==='COMPLETED'?'admin-status-good':'admin-not-wired-chip'}>{menuStatus?.state??'讀取中'}</span>
      </header>
      <p>來源固定為已發布 Admin 設定版本；同步係 full snapshot。預檢會先確認分類、商品、Option Set、OpenItemCode 同完整排序，再提交 Keeta 非同步 task。</p>
      {menuPreview?<div className="admin-readback-proof">
        <p><span>Admin Revision</span><b>R{menuPreview.revision}</b></p>
        <p><span>分類</span><b>{menuPreview.summary.categories}</b></p>
        <p><span>商品</span><b>{menuPreview.summary.spus}</b></p>
        <p><span>SKU</span><b>{menuPreview.summary.skus}</b></p>
        <p><span>Option Groups</span><b>{menuPreview.summary.choiceGroups}</b></p>
        <p><span>Options</span><b>{menuPreview.summary.options}</b></p>
        <p><span>Snapshot</span><b>{menuPreview.snapshotFingerprint.slice(0,18)}…</b></p>
      </div>:null}
      {menuStatus&&menuStatus.state!=='NEVER_SYNCED'?<div className="admin-readback-proof">
        <p><span>狀態</span><b>{menuStatus.state}</b></p>
        <p><span>Task ID</span><b>{menuStatus.taskId??'—'}</b></p>
        <p><span>提交時間</span><b>{menuStatus.submittedAt?new Date(menuStatus.submittedAt).toLocaleString('zh-HK'):'—'}</b></p>
        <p><span>1202 Completion</span><b>{menuStatus.completion?new Date(menuStatus.completion.completedAt).toLocaleString('zh-HK'):'—'}</b></p>
        <p><span>1201 Picture Completion</span><b>{menuStatus.pictureCompletion?new Date(menuStatus.pictureCompletion.completedAt).toLocaleString('zh-HK'):'—'}</b></p>
        <p><span>Errors</span><b>{menuStatus.completion?.errors.length??0}</b></p>
      </div>:null}
      <div className="admin-callout compact">Full snapshot 規則：未包含嘅既有 provider OpenItemCode 可能被 Keeta 刪除。呢度用完整已發布 MFK catalog 建 snapshot，唔會由 UI 手工砌半份 payload。</div>
      {liveError?<div className="admin-validation is-error" role="alert">{keetaActionErrorText(liveError)}</div>:null}
      <div className="admin-editor-actions">
        <button type="button" className="secondary" disabled={menuBusy} onClick={()=>void previewMenu()}>{menuBusy?'處理中…':'預檢完整菜單'}</button>
        <button type="button" className="primary" disabled={menuBusy||liveStatus?.oauth.state!=='CONNECTED'} onClick={()=>void submitMenu()}>{menuBusy?'處理中…':'同步完整菜單到 Keeta'}</button>
        <button type="button" className="secondary" disabled={menuBusy} onClick={()=>void refreshMenu()}>{menuBusy?'讀取中…':'更新同步狀態'}</button>
      </div>
    </section>:null}
    {mode==='sync'?<section className="admin-policy-card">
      <header><div><small>KEETA SELLABILITY</small><h2>Keeta 售罄／供應同步</h2></div><span className={sellabilityStatus?.state==='COMPLETED'?'admin-status-good':'admin-not-wired-chip'}>{sellabilityStatus?.state??'未同步'}</span></header>
      <p>來源固定為已發布 MFK Availability + Catalog。SPU OpenItemCode 同完整菜單使用同一套 deterministic identity。</p>
      {sellabilityPreview?<div className="admin-readback-proof">
        <p><span>Admin Revision</span><b>R{sellabilityPreview.revision}</b></p>
        <p><span>同步設定</span><b>{sellabilityPreview.state}</b></p>
        <p><span>商品總數</span><b>{sellabilityPreview.total}</b></p>
        <p><span>可售</span><b>{sellabilityPreview.available}</b></p>
        <p><span>停售</span><b>{sellabilityPreview.unavailable}</b></p>
      </div>:null}
      <div className="admin-callout compact">目前只同步有 canonical product availability 嘅 SPU；Option 獨立售罄要等 MFK 有獨立 option availability truth，唔會由 provider 反推。</div>
      <div className="admin-editor-actions">
        <button type="button" className="secondary" disabled={providerOpsBusy} onClick={()=>void previewSellability()}>預檢供應狀態</button>
        <button type="button" className="primary" disabled={providerOpsBusy||liveStatus?.oauth.state!=='CONNECTED'||!config.syncSellability} onClick={()=>void submitSellability()}>同步售罄到 Keeta</button>
      </div>
    </section>:null}
    {mode==='sync'?<section className="admin-policy-card">
      <header><div><small>KEETA STORE OPS</small><h2>Keeta 營業時間／開關店</h2></div><span className={storeStatus?.state==='AVAILABLE'?'admin-status-good':'admin-not-wired-chip'}>{storeStatus?.state??'未讀取'}</span></header>
      <p>七日營業時間由已發布 Admin 門店設定投影；REST／OPEN 係 Keeta provider 營運動作，唔會改寫 MFK Store identity。</p>
      {storePreview?<div className="admin-readback-proof">
        <p><span>Admin Revision</span><b>R{storePreview.revision}</b></p>
        <p><span>星期資料</span><b>{Object.keys(storePreview.businessHourOfTheWeek).length} / 7</b></p>
      </div>:null}
      <div className="admin-editor-actions">
        <button type="button" className="secondary" disabled={providerOpsBusy} onClick={()=>void previewStore()}>預檢營業時間</button>
        <button type="button" className="primary" disabled={providerOpsBusy||liveStatus?.oauth.state!=='CONNECTED'} onClick={()=>void submitStoreHours()}>同步營業時間</button>
        <button type="button" className="secondary" disabled={providerOpsBusy||liveStatus?.oauth.state!=='CONNECTED'} onClick={()=>void runStoreOperation('REST')}>Keeta 暫停接單</button>
        <button type="button" className="secondary" disabled={providerOpsBusy||liveStatus?.oauth.state!=='CONNECTED'} onClick={()=>void runStoreOperation('OPEN')}>Keeta 恢復接單</button>
        <button type="button" className="secondary" disabled={providerOpsBusy} onClick={()=>void refreshStoreReadback()}>更新 Provider Readback</button>
      </div>
    </section>:null}
    {mode==='estimate'?<section className="admin-policy-card">
      <header><div><small>KEETA COMMERCIAL READBACK</small><h2>Keeta 實收／費用對帳</h2></div><span className="admin-not-wired-chip">{commercialRows.length} 張</span></header>
      <p>呢度顯示 Keeta provider commercial evidence。MFK 訂單金額、付款方式同 Sales authority 唔會因呢啲 provider 數字而被改寫。</p>
      {liveError?<div className="admin-validation is-error" role="alert">{liveError}</div>:null}
      {commercialRows.length?<div className="admin-editor-list">
        {commercialRows.map(row=><article className="admin-policy-row" key={row.providerOrderId}>
          <div>
            <b>{row.canonicalDisplay??row.canonicalOrderId??'未連結'} · Keeta {row.providerOrderCode||row.providerOrderId}</b>
            <small>{row.state} · {row.snapshot.settlementAuthority} · {row.providerConfirmedAt?new Date(row.providerConfirmedAt).toLocaleString('zh-HK'):'Webhook evidence'}</small>
          </div>
          <div className="admin-readback-proof">
            <p><span>商品</span><b>{commercialMoney(row.snapshot.merchandiseSubtotalMinor)}</b></p>
            <p><span>客戶實付</span><b>{commercialMoney(row.snapshot.customerPaidMinor)}</b></p>
            <p><span>配送費</span><b>{commercialMoney(row.snapshot.shippingFeeMinor)}</b></p>
            <p><span>平台費</span><b>{commercialMoney(row.snapshot.customerPlatformFeeMinor)}</b></p>
            <p><span>最低消費補差</span><b>{commercialMoney(row.snapshot.minimumOrderTopUpMinor)}</b></p>
            <p><span>佣金</span><b>{commercialMoney(row.snapshot.merchantCommissionMinor)}</b></p>
            <p><span>活動費</span><b>{commercialMoney(row.snapshot.merchantActivityFeeMinor)}</b></p>
            <p><span>Merchant earnings</span><b>{commercialMoney(row.snapshot.merchantEarningsMinor)}</b></p>
          </div>
          <button type="button" className="secondary" disabled={commercialBusy===row.providerOrderId||!row.canonicalOrderId} onClick={()=>void refreshCommercial(row.providerOrderId)}>{commercialBusy===row.providerOrderId?'讀取中…':'更新 Keeta 對帳'}</button>
        </article>)}
      </div>:<div className="admin-read-empty">未有 Keeta commercial evidence。收到並連結第一張 Keeta 訂單後會自動出現。</div>}
      <div className="admin-editor-actions"><button type="button" className="secondary" disabled={Boolean(commercialBusy)} onClick={()=>void refreshCommercialRows()}>重新讀取列表</button></div>
    </section>:null}
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
