import {useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router';
import {STORE_SETTINGS_DOMAIN_LABELS,STORE_SETTINGS_ROUTES,canonicalPublishTargetForError,migrateLegacyWhatsAppTemplate,validateAllStoreSettingsDomains,validateStoreSettingsDomain,type StoreSettingsDomain,type StoreSettingsFieldError} from './admin-store-settings-domain.ts';
import type {StaffPinVerifier} from '../../contracts/staff-auth-v1.ts';
import {useAdminDraft} from './admin-draft.tsx';
import {appendAdminAudit,readActiveAdminRelease,usePersistentAdminState,writeAdminStored} from './admin-local-store.ts';
import {saveAdminConfig} from './admin-config-save.ts';
import {readFreshDiningOccupancy,uploadAdminPaymentQr} from './admin-sync-client.ts';
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
const hkTime=(value:string)=>new Date(value).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false});

export function keetaActionErrorText(error:string){
  const code=error.trim();
  return code?'Keeta 操作未完成：'+code:'';
}

export interface AvailabilityRule{readonly sellable:boolean;readonly reason:string;readonly updatedAt:string}
export function AvailabilityWorkspace(){
  const {draft,updateKeetaMappings}=useAdminDraft();
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
  const [selectedPrinterId,setSelectedPrinterId]=useState<string|null>(null);
  const add=()=>setPrinters(rows=>{
    const row:LogicalPrinterDraft={id:'logical-'+Date.now().toString(36),name:'新打印用途',type:'RECEIPT',model:'80mm 熱敏',widthMm:80,active:true,capabilities:['RECEIPT']};
    appendAdminAudit({action:'新增 打印用途',target:row.id,after:row});setSelectedPrinterId(row.id);return [...rows,row];
  });
  const patch=(id:string,change:Partial<LogicalPrinterDraft>)=>setPrinters(rows=>rows.map(row=>{if(row.id!==id)return row;const after={...row,...change};appendAdminAudit({action:'修改 打印用途',target:id,before:row,after});return after;}));
  const remove=(id:string)=>setPrinters(rows=>{appendAdminAudit({action:'刪除 打印用途',target:id});return rows.filter(row=>row.id!==id);});
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>唯一打印用途清單</small><h1>打印中心</h1><p>Admin 定義唯一打印用途、規格同能力。實際 IP／USB／實體設備日後只由 SMT 配對，唔會喺兩邊建立第二套名稱。</p></div><div className="admin-editor-actions"><button className="secondary" onClick={add}>新增打印用途</button></div></header>
    {selectedPrinterId===null?<div className="admin-settings-home" aria-label="打印用途">{printers.map(row=><button type="button" className="admin-settings-link" key={row.id} onClick={()=>setSelectedPrinterId(row.id)}><span><b>{row.name}</b><small>{row.type} · {row.model} · {row.active?'啟用':'停用'}</small></span><strong aria-hidden="true">›</strong></button>)}</div>:<div className="admin-editor-list">{printers.filter(row=>row.id===selectedPrinterId).map(row=><article className="admin-policy-card" key={row.id}>
      <button type="button" className="admin-back-button" onClick={()=>setSelectedPrinterId(null)}>‹ 打印用途</button>
      <header><h2>{row.name}</h2><small>{row.id}</small></header>
      <label><span>名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})}/></label>
      <label><span>票種</span><select value={row.type} onChange={event=>{const type=event.target.value as LogicalPrinterDraft['type'];patch(row.id,{type,capabilities:[type]})}}><option value="RECEIPT">收據</option><option value="PRODUCTION">製作單</option><option value="PACKING">包裝單</option><option value="LABEL">標籤</option></select></label>
      <label><span>打印規格</span><input value={row.model} onChange={event=>patch(row.id,{model:event.target.value})}/></label>
      <label><span>紙寬／標籤寬 mm</span><input type="number" min={20} max={120} value={row.widthMm} onChange={event=>patch(row.id,{widthMm:Number(event.target.value)||80})}/></label>
      <Toggle checked={row.active} onChange={active=>patch(row.id,{active})} label={row.active?'啟用':'停用'}/>
      <button type="button" onClick={()=>{remove(row.id);setSelectedPrinterId(null)}}>刪除</button>
    </article>)}</div>}
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
  const [selectedTemplate,setSelectedTemplate]=useState<'receipt'|'production'|'packing'|'label'|'semantics'|null>(null);
  const patch=(change:Partial<PrintTemplateSet>)=>setTemplates(current=>{const after={...current,...change};appendAdminAudit({action:'修改打印模板',target:'打印模板中心'});return after;});
  return <section className="admin-editor-page">
    <PolicyHeader title="打印模板中心" description="管理收據、製作單、打包單同 Label 嘅正式輸出內容。製作單回答要整乜／點整；打包單回答全單齊唔齊。"/>
    {selectedTemplate===null?<div className="admin-settings-home" aria-label="打印模板">{([['receipt','收據'],['production','製作單'],['packing','打包單'],['label','標籤']] as const).map(([key,title])=><button type="button" className="admin-settings-link" key={key} onClick={()=>setSelectedTemplate(key)}><span><b>{title}</b><small>編輯{title}模板內容</small></span><strong aria-hidden="true">›</strong></button>)}<button type="button" className="admin-settings-link" onClick={()=>setSelectedTemplate('semantics')}><span><b>輸出語義</b><small>套餐關係、食品／飲品件數</small></span><strong aria-hidden="true">›</strong></button></div>:<div className="admin-policy-grid two">
      <article className="admin-policy-card"><button type="button" className="admin-back-button" onClick={()=>setSelectedTemplate(null)}>‹ 打印模板中心</button>{selectedTemplate==='semantics'?<><h2>輸出語義</h2><Toggle checked={templates.showComboRelationship} onChange={showComboRelationship=>patch({showComboRelationship})} label="保留套餐與 child 關係"/><Toggle checked={templates.separateFoodDrinkCount} onChange={separateFoodDrinkCount=>patch({separateFoodDrinkCount})} label="食品／飲品總件數分開"/></>:([['receipt','收據'],['production','製作單'],['packing','打包單'],['label','標籤']] as const).filter(([key])=>key===selectedTemplate).map(([key,title])=><div key={key}><h2>{title}</h2><label><span>{title}模板內容</span><textarea value={templates[key]} onChange={event=>patch({[key]:event.target.value})} rows={8}/></label></div>)}</article>
    </div>}
  </section>;
}

type StoreDay='MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN';
type DiningTableVersionStatus='PLANNED'|'ACTIVE'|'SUPERSEDED';
interface DiningTableVersion{readonly versionId:string;readonly label:string;readonly requestedAt:string;readonly requestedBy:string;readonly sourceRevision:number;readonly status:DiningTableVersionStatus;readonly effectiveAt?:string;readonly activationEvidence?:{readonly observedAt:string;readonly runtimeRevision:number}}
interface DiningTableConfig{readonly id:string;readonly name:string;readonly active:boolean;readonly sortOrder:number;readonly versions?:readonly DiningTableVersion[];readonly retirementStatus?:'PLANNED_RETIREMENT'|'RETIRED';readonly retirementEvidence?:{readonly observedAt:string;readonly runtimeRevision:number}}
interface CustomerPaymentChannelConfig{readonly id:string;readonly name:string;readonly enabled:boolean;readonly qrImageUrl:string;readonly sortOrder:number}
interface StoreSettings{
  storeName:string;storeCode:string;currency:string;timezone:string;
  lateArrivalMinutes:number;fulfillmentMinutes:number;archiveHours:number;diningOverdueMinutes:number;
  reminderAfterMinutes:number;reminderIntervalMinutes:number;repeatReminder:boolean;timeoutPriority:'NORMAL'|'HIGH'|'URGENT';
  dineInEnabled:boolean;takeawayEnabled:boolean;
  diningTables:DiningTableConfig[];
  customerPaymentChannels:CustomerPaymentChannelConfig[];
  customerWhatsAppEnabled:boolean;
  customerWhatsAppNumber:string;
  customerWhatsAppTemplate:string;
  customerWhatsAppTemplateInitialized?:boolean;
  weeklyHours:Record<StoreDay,{closed:boolean;opensAt:string;closesAt:string}>;
  paymentRefs:string[];printRefs:string[];channelRefs:string[];
}
const STORE_DAYS:readonly {id:StoreDay;label:string}[]=[
  {id:'MON',label:'星期一'},{id:'TUE',label:'星期二'},{id:'WED',label:'星期三'},
  {id:'THU',label:'星期四'},{id:'FRI',label:'星期五'},{id:'SAT',label:'星期六'},{id:'SUN',label:'星期日'},
];
const DEFAULT_CUSTOMER_WHATSAPP_TEMPLATE='你好，我想經 WhatsApp 落單。\n姓名：{name}\n電話：{phone}\n餐點：\n{items}\n總額：{total}\n網上自動接單暫時未能連接，請人工確認。';
const DEFAULT_CUSTOMER_PAYMENT_CHANNELS:CustomerPaymentChannelConfig[]=[
  {id:'ALIPAY',name:'AlipayHK',enabled:true,qrImageUrl:'',sortOrder:1},
  {id:'WECHAT',name:'WeChat Pay HK',enabled:true,qrImageUrl:'',sortOrder:2},
  {id:'FPS',name:'轉數快',enabled:true,qrImageUrl:'',sortOrder:3},
  {id:'PAYME',name:'PayMe',enabled:true,qrImageUrl:'',sortOrder:4},
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

export function StoreSettingsWorkspace({domain='home'}:{domain?:StoreSettingsDomain}){
  const {draft,markClean}=useAdminDraft();
  const [config,setConfig]=usePersistentAdminState<StoreSettings>('store-settings.v1',{
    storeName:'磨飯',storeCode:'MF01',currency:'HKD',timezone:'Asia/Hong_Kong',
    lateArrivalMinutes:15,fulfillmentMinutes:20,archiveHours:24,diningOverdueMinutes:35,
    reminderAfterMinutes:5,reminderIntervalMinutes:5,repeatReminder:true,timeoutPriority:'HIGH',
    dineInEnabled:true,takeawayEnabled:true,diningTables:[],customerPaymentChannels:DEFAULT_CUSTOMER_PAYMENT_CHANNELS,
    customerWhatsAppEnabled:true,
    customerWhatsAppNumber:'',
    customerWhatsAppTemplate:DEFAULT_CUSTOMER_WHATSAPP_TEMPLATE,
    customerWhatsAppTemplateInitialized:true,
    weeklyHours:DEFAULT_WEEKLY_HOURS,
    paymentRefs:['CASH'],printRefs:['RECEIPT','PRODUCTION','PACKING','LABEL'],channelRefs:[],
  });
  const [saveMessage,setSaveMessage]=useState('');
  const [saveErrors,setSaveErrors]=useState<readonly StoreSettingsFieldError[]>([]);
  const [publishBlockers,setPublishBlockers]=useState<readonly {label:string;path:string;message:string}[]>([]);
  const errorSummaryRef=useRef<HTMLDivElement>(null);
  const [renameDrafts,setRenameDrafts]=useState<Record<string,string>>({});
  const [renameMessages,setRenameMessages]=useState<Record<string,string>>({});
  const patch=(change:Partial<StoreSettings>)=>setConfig(current=>{const after={...current,...change};appendAdminAudit({action:'修改門店設定',target:current.storeCode,before:current,after});return after;});
  useEffect(()=>{
    const migration=migrateLegacyWhatsAppTemplate({
      value:config.customerWhatsAppTemplate,
      initialized:config.customerWhatsAppTemplateInitialized,
      defaultValue:DEFAULT_CUSTOMER_WHATSAPP_TEMPLATE,
    });
    if(migration.migrated||config.customerWhatsAppTemplateInitialized!==true){
      patch({customerWhatsAppTemplate:migration.value,customerWhatsAppTemplateInitialized:true});
    }
  // legacy records have no initialized marker; once marked, an intentional clear remains empty
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const patchDay=(day:StoreDay,change:Partial<StoreSettings['weeklyHours'][StoreDay]>)=>patch({weeklyHours:{...config.weeklyHours,[day]:{...config.weeklyHours[day],...change}}});
  const refs=(value:string)=>value.split(',').map(item=>item.trim()).filter(Boolean);
  const diningTables=(config.diningTables??[]).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const paymentChannels=(config.customerPaymentChannels??DEFAULT_CUSTOMER_PAYMENT_CHANNELS).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const [paymentUploadState,setPaymentUploadState]=useState<Record<string,string>>({});
  const [selectedPaymentId,setSelectedPaymentId]=useState<string|null>(null);
  const patchPaymentChannel=(id:string,change:Partial<CustomerPaymentChannelConfig>)=>patch({customerPaymentChannels:paymentChannels.map(row=>row.id===id?{...row,...change}:row)});
  const addPaymentChannel=()=>{
    const used=new Set(paymentChannels.map(row=>row.id));
    let n=paymentChannels.length+1;
    let id='PAY-'+String(n).padStart(2,'0');
    while(used.has(id)){n++;id='PAY-'+String(n).padStart(2,'0')}
    patch({customerPaymentChannels:[...paymentChannels,{id,name:'新付款方式',enabled:false,qrImageUrl:'',sortOrder:paymentChannels.length+1}]});setSelectedPaymentId(id);
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
  const nextTableId=()=>{const retired=readAdminStored<string[]>('dining-table-id-ledger.v1',[]);const used=new Set([...retired,...diningTables.map(row=>row.id)]);let n=Math.max(0,...[...used].map(id=>Number(id.replace(/\D/g,''))||0))+1;while(used.has('T'+String(n).padStart(4,'0')))n++;return 'T'+String(n).padStart(4,'0');};
  const addTable=()=>{const id=nextTableId(),at=new Date().toISOString();patch({diningTables:[...diningTables,{id,name:'新枱',active:true,sortOrder:diningTables.length+1,versions:[{versionId:'V1',label:'新枱',requestedAt:at,requestedBy:'ADMIN',sourceRevision:activeRelease?.version??0,status:'ACTIVE',effectiveAt:at}]}]});};
  const requestRename=(id:string,newLabel:string)=>{
    const label=newLabel.trim();
    const visibleRow=diningTables.find(item=>item.id===id);
    if(!visibleRow){setRenameMessages(current=>({...current,[id]:'未能改名。'}));return;}
    if(!label){setRenameMessages(current=>({...current,[id]:'請先輸入新名稱。'}));return;}
    if(label===visibleRow.name){setRenameMessages(current=>({...current,[id]:'新名稱與目前名稱相同。'}));return;}
    setConfig(current=>{
      const rows=[...(current.diningTables??[])];
      const index=rows.findIndex(item=>item.id===id);
      if(index<0)return current;
      const row=rows[index],versions=[...(row.versions??[])];
      const at=new Date().toISOString();
      const versionId='V'+String(versions.length+1);
      const activeVersion:DiningTableVersion={versionId,label,requestedAt:at,requestedBy:'ADMIN',sourceRevision:activeRelease?.version??0,status:'ACTIVE',effectiveAt:at};
      rows[index]={...row,name:label,versions:[...versions.map(item=>item.status==='ACTIVE'?{...item,status:'SUPERSEDED' as const}:item.status==='PLANNED'?{...item,status:'SUPERSEDED' as const}:item),activeVersion]};
      appendAdminAudit({action:'修改堂食枱名稱',target:id,before:row,after:{versionId,label,status:'ACTIVE'}});
      return {...current,diningTables:rows};
    });
    setRenameDrafts(current=>({...current,[id]:''}));
    setRenameMessages(current=>({...current,[id]:'名稱已更新至本頁草稿；正式發佈後 SMT／SMM 會使用新名稱。'}));
  };
  const requestRetirement=(id:string)=>patchTable(id,{retirementStatus:'PLANNED_RETIREMENT'});
  const cancelRetirement=(id:string)=>patchTable(id,{retirementStatus:undefined});
  const setTemporaryAvailability=(id:string,active:boolean)=>{const row=diningTables.find(item=>item.id===id);if(!row||row.retirementStatus==='RETIRED')return;patchTable(id,{active,retirementStatus:row.retirementStatus});};
  const activatePending=async(id:string)=>{const row=diningTables.find(item=>item.id===id);if(!row||row.retirementStatus!=='PLANNED_RETIREMENT')return;const evidence=await readFreshDiningOccupancy(id);if(!evidence||evidence.activeSessionCount!==0){setSaveMessage('未能退休：枱仍有人使用，或者佔用讀回未能證明為最新。');return;}writeAdminStored('dining-table-id-ledger.v1',[...new Set([...readAdminStored<string[]>('dining-table-id-ledger.v1',[]),id])]);patchTable(id,{active:false,retirementStatus:'RETIRED',retirementEvidence:{observedAt:evidence.observedAt,runtimeRevision:evidence.runtimeRevision}});appendAdminAudit({action:'堂食枱退休生效',target:id,after:{observedAt:evidence.observedAt,runtimeRevision:evidence.runtimeRevision}});};
  const validationInput=()=>({
    diningOverdueMinutes:config.diningOverdueMinutes,
    customerWhatsAppEnabled:config.customerWhatsAppEnabled!==false,
    customerWhatsAppNumber:config.customerWhatsAppNumber??'',
    customerWhatsAppTemplate:config.customerWhatsAppTemplate??'',
    diningTables,
    paymentChannels,
  });
  const focusFirstError=(errors:readonly StoreSettingsFieldError[])=>{
    if(!errors.length)return;
    requestAnimationFrame(()=>{
      const node=document.getElementById(errors[0]!.fieldId) as HTMLElement|null;
      node?.scrollIntoView({behavior:'smooth',block:'center'});
      node?.focus({preventScroll:true});
    });
  };
  const saveStoreSettings=()=>{
    const errors=validateStoreSettingsDomain(domain,validationInput());
    if(errors.length){setSaveErrors(errors);setPublishBlockers([]);setSaveMessage('未能儲存本頁設定；請修正標示欄位。');focusFirstError(errors);return;}
    writeAdminStored('store-settings.v1',config);
    setSaveErrors([]);
    setSaveMessage('已儲存本頁設定草稿；未建立正式版本。');
  };
  const publishStoreSettings=()=>{
    const currentErrors=validateStoreSettingsDomain(domain,validationInput());
    if(currentErrors.length){setSaveErrors(currentErrors);setPublishBlockers([]);setSaveMessage('未能發佈；請修正標示欄位。');focusFirstError(currentErrors);return;}
    writeAdminStored('store-settings.v1',config);
    const crossDomain=validateAllStoreSettingsDomains(validationInput()).filter(error=>error.domain!==domain);
    if(crossDomain.length){
      setSaveErrors([]);
      setPublishBlockers(crossDomain.map(error=>({label:STORE_SETTINGS_DOMAIN_LABELS[error.domain],path:STORE_SETTINGS_ROUTES[error.domain],message:error.message})));
      setSaveMessage('無法正式發佈：其他設定項目仍有需要處理。');
      errorSummaryRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const result=saveAdminConfig(draft);
    if(!result.ok){
      setSaveErrors([]);
      setPublishBlockers(result.errors.map(message=>({...canonicalPublishTargetForError(message),message})));
      setSaveMessage('無法正式發佈：Canonical Config 仍有需要處理。');
      errorSummaryRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    markClean();
    setSaveErrors([]);
    setPublishBlockers([]);
    setSaveMessage('已建立正式發佈：'+hkTime(result.release.createdAt)+'（香港時間）；已排入 Admin → SMT／SMM 自動同步。');
  };
  const fieldError=(id:string)=>saveErrors.find(error=>error.fieldId===id)?.message;
  const fieldProps=(id:string)=>({id,'aria-invalid':Boolean(fieldError(id))||undefined,'aria-describedby':fieldError(id)?id+'-error':undefined});
  const FieldError=({id}:{id:string})=>fieldError(id)?<small id={id+'-error'} className="admin-field-error">{fieldError(id)}</small>:null;
  const activeRelease=readActiveAdminRelease();


  return <section className="admin-editor-page">
    <header className="admin-editor-head">
      <div><small>{activeRelease?'本機保存 '+hkTime(activeRelease.createdAt):'未有正式發佈'} · 門店設定</small><h1>門店設定</h1><p>本機修改會自動保存草稿；只有撳「保存並發佈」先建立正式版本，並送去 SMT／SMM。</p>{saveMessage?<span>{saveMessage}</span>:null}</div>
      <div className="admin-editor-actions"><button className="primary" type="button" onClick={saveStoreSettings}>儲存本頁設定</button><button className="primary" type="button" onClick={publishStoreSettings}>正式保存並發佈</button></div>
    </header>
    {publishBlockers.length?<div ref={errorSummaryRef} className="admin-validation is-error" role="alert" tabIndex={-1}><b>無法正式發佈</b><ul>{publishBlockers.map((error,index)=><li key={index}><b>{error.label}</b> → {error.message} <Link to={error.path}>前往設定</Link></li>)}</ul></div>:null}
    {saveErrors.length?<div ref={errorSummaryRef} className="admin-validation is-error" role="alert" tabIndex={-1}><b>有 {saveErrors.length} 項需要處理</b><ul>{saveErrors.map((error,index)=><li key={index}><button type="button" className="admin-error-link" onClick={()=>{const node=document.getElementById(error.fieldId);node?.scrollIntoView({behavior:'smooth',block:'center'});node?.focus();}}>{error.message}</button></li>)}</ul></div>:null}
    {domain==='home'?<div className="admin-settings-home" aria-label="門店設定項目">
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.basic}><span><b>基本資料</b><small>門店名稱、代碼、貨幣、時區</small></span><strong aria-hidden="true">›</strong></Link>
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.service}><span><b>服務模式</b><small>堂食／外賣</small></span><strong aria-hidden="true">›</strong></Link>
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.tables}><span><b>堂食枱號</b><small>枱號、改名、排序、停用</small></span><strong aria-hidden="true">›</strong></Link>
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.hours}><span><b>營業時間</b><small>七日營業時間</small></span><strong aria-hidden="true">›</strong></Link>
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.timing}><span><b>營運計時</b><small>遲到、出餐、堂食超時、封存</small></span><strong aria-hidden="true">›</strong></Link>
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.reminders}><span><b>訂單提醒</b><small>Pending Order 提醒</small></span><strong aria-hidden="true">›</strong></Link>
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.whatsapp}><span><b>WhatsApp 備援</b><small>電話及訊息模板</small></span><strong aria-hidden="true">›</strong></Link>
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.payments}><span><b>電子支付</b><small>付款方式、名稱、啟用及排序</small></span><strong aria-hidden="true">›</strong></Link>
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.qr}><span><b>QR Code</b><small>付款 QR 管理及預覽</small></span><strong aria-hidden="true">›</strong></Link>
      <Link className="admin-settings-link" to={STORE_SETTINGS_ROUTES.references}><span><b>其他門店設定</b><small>系統引用</small></span><strong aria-hidden="true">›</strong></Link>
    </div>:null}
    {domain!=='home'?<nav className="admin-settings-breadcrumb" aria-label="門店設定返回"><Link to={STORE_SETTINGS_ROUTES.home}>‹ 門店設定</Link></nav>:null}
    {domain==='basic'?<div className="admin-policy-grid two"><article className="admin-policy-card"><h2>基本資料</h2><label><span>門店顯示名稱</span><input value={config.storeName} onChange={event=>patch({storeName:event.target.value})}/></label><label><span>門店代碼</span><input value={config.storeCode} onChange={event=>patch({storeCode:event.target.value})}/></label><label><span>貨幣</span><select value={config.currency} onChange={event=>patch({currency:event.target.value})}><option value="HKD">HKD</option></select></label><label><span>時區</span><input value={config.timezone} onChange={event=>patch({timezone:event.target.value})}/></label></article></div>:null}
    {domain==='service'?<div className="admin-policy-grid two"><article className="admin-policy-card"><h2>服務模式</h2><Toggle checked={config.dineInEnabled} onChange={dineInEnabled=>patch({dineInEnabled})} label="堂食"/><Toggle checked={config.takeawayEnabled} onChange={takeawayEnabled=>patch({takeawayEnabled})} label="外賣"/></article></div>:null}
    {domain==='tables'?<div className="admin-policy-grid two"><article className="admin-policy-card"><header><div><h2>堂食枱號</h2><small>由 Admin 發佈，SMT／SMM 共用同一份枱號同名稱。</small></div><button type="button" onClick={addTable}>新增枱</button></header>
        <div className="admin-editor-list">{diningTables.map((row,index)=><div className="admin-policy-row" key={row.id}>
          <b>{row.id}</b>
          <label><span>目前名稱</span><input value={row.name} readOnly/></label>
          <label><span>新名稱</span><input value={renameDrafts[row.id]??''} onChange={event=>setRenameDrafts(current=>({...current,[row.id]:event.target.value}))} placeholder="輸入新名稱"/></label>
          <button type="button" onClick={()=>requestRename(row.id,renameDrafts[row.id]??'')}>更新名稱</button>
          {renameMessages[row.id]?<small role="status">{renameMessages[row.id]}</small>:null}
          <label><span>排序</span><input type="number" min={1} value={row.sortOrder} onChange={event=>patchTable(row.id,{sortOrder:Number(event.target.value)||index+1})}/></label>
          <span>{row.retirementStatus==='RETIRED'?'RETIRED':row.retirementStatus==='PLANNED_RETIREMENT'?'PLANNED_RETIREMENT':row.active?'ACTIVE':'INACTIVE'}</span>
          {row.retirementStatus!=='RETIRED'?<Toggle checked={row.active} onChange={active=>setTemporaryAvailability(row.id,active)} label={row.active?'可使用':'暫停使用'}/>:null}
          {row.retirementStatus==='PLANNED_RETIREMENT'?<><button type="button" onClick={()=>cancelRetirement(row.id)}>取消退休</button><button type="button" onClick={()=>void activatePending(row.id)}>檢查並永久退休</button></>:row.retirementStatus!=='RETIRED'?<button type="button" onClick={()=>requestRetirement(row.id)}>安排永久退休</button>:null}
        </div>)}</div>
      </article></div>:null}
    {domain==='whatsapp'?<div className="admin-policy-grid two"><article className="admin-policy-card"><h2>Customer WhatsApp 備援</h2>
        <Toggle checked={config.customerWhatsAppEnabled!==false} onChange={customerWhatsAppEnabled=>patch({customerWhatsAppEnabled})} label={config.customerWhatsAppEnabled!==false?'啟用':'停用'}/>
        <label><span>公司 WhatsApp 電話</span><input {...fieldProps('customer-whatsapp-number')} className={fieldError('customer-whatsapp-number')?'admin-field-invalid':undefined} inputMode="tel" value={config.customerWhatsAppNumber??''} onChange={event=>patch({customerWhatsAppNumber:event.target.value})} placeholder="例如 85291234567"/><FieldError id="customer-whatsapp-number"/></label>
        <label><span>訊息模板</span><textarea {...fieldProps('customer-whatsapp-template')} className={fieldError('customer-whatsapp-template')?'admin-field-invalid':undefined} rows={8} value={config.customerWhatsAppTemplate??''} onChange={event=>patch({customerWhatsAppTemplate:event.target.value,customerWhatsAppTemplateInitialized:true})}/><FieldError id="customer-whatsapp-template"/></label>
        <small>可用：{'{name}'}、{'{phone}'}、{'{items}'}、{'{total}'}、{'{submissionId}'}。系統只會喺 Customer 無法連接 SMT 接單後，由客人主動撳掣先開 WhatsApp；唔會自動傳送。</small>
      </article></div>:null}
    {domain==='qr'?<div className="admin-policy-grid two"><article className="admin-policy-card"><header><div><h2>QR Code</h2><small>重用電子支付嘅 customerPaymentChannels / qrImageUrl；唔建立第二 QR Store。</small></div></header>
      <div className="admin-editor-list">{paymentChannels.map(row=><div className="admin-policy-row" key={row.id}>
        <div><b>{row.name}</b><small>{row.id} · {row.enabled?'啟用':'停用'}</small></div>
        <label><span>付款 QR 圖</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)void uploadPaymentQr(row.id,file)}}/></label>
        {row.qrImageUrl?<div><img src={row.qrImageUrl} alt={row.name+' QR'} style={{width:96,height:96,objectFit:'contain',borderRadius:10,border:'1px solid rgba(0,0,0,.12)'}}/><button type="button" onClick={()=>patchPaymentChannel(row.id,{qrImageUrl:''})}>移除圖片</button></div>:<span>未有付款 QR</span>}
        <small>{paymentUploadState[row.id]??''}</small>
      </div>)}</div>
      <p>上載沿用現有 Admin Worker → Private R2；正式資料仍由同一 customerPaymentChannels 隨 Canonical Publish 發佈。</p>
    </article></div>:null}
    {domain==='payments'?<div className="admin-policy-grid two"><article className="admin-policy-card"><header><div><h2>客戶電子支付</h2><small>先揀付款方式；再進入單一設定。Customer 只讀已發佈版本。</small></div><button type="button" onClick={addPaymentChannel}>新增付款方式</button></header>
        {selectedPaymentId===null?<div className="admin-settings-home">{paymentChannels.map(row=><button type="button" className="admin-settings-link" key={row.id} onClick={()=>setSelectedPaymentId(row.id)}><span><b>{row.name}</b><small>{row.enabled?'啟用':'停用'} · {row.qrImageUrl?'已有 QR':'未有 QR'}</small></span><strong aria-hidden="true">›</strong></button>)}</div>:paymentChannels.filter(row=>row.id===selectedPaymentId).map((row,index)=><div className="admin-payment-detail" key={row.id}>
          <button type="button" className="admin-back-button" onClick={()=>setSelectedPaymentId(null)}>‹ 電子支付</button>
          <b>{row.id}</b>
          <label><span>顯示名稱 <b className="admin-required">必填</b></span><input {...fieldProps('payment-'+row.id+'-name')} className={fieldError('payment-'+row.id+'-name')?'admin-field-invalid':undefined} value={row.name} onChange={event=>patchPaymentChannel(row.id,{name:event.target.value})} placeholder="例如 AlipayHK"/><FieldError id={'payment-'+row.id+'-name'}/></label>
          <Toggle checked={row.enabled} onChange={enabled=>patchPaymentChannel(row.id,{enabled})} label={row.enabled?'啟用':'停用'}/>
          <label><span>排序</span><input type="number" min={1} value={row.sortOrder} onChange={event=>patchPaymentChannel(row.id,{sortOrder:Number(event.target.value)||index+1})}/></label>
          <button type="button" onClick={()=>{removePaymentChannel(row.id);setSelectedPaymentId(null)}}>刪除付款方式</button>
        </div>)}
        <p>付款 QR 已移到獨立「QR Code」設定頁；付款方式身份、啟用狀態同排序仍由同一 customerPaymentChannels 管理。</p>
      </article></div>:null}
    {domain==='references'?<div className="admin-policy-grid two"><article className="admin-policy-card"><h2>系統引用</h2><label><span>付款方式 refs</span><input value={config.paymentRefs.join(', ')} onChange={event=>patch({paymentRefs:refs(event.target.value)})} placeholder="例如 CASH, OCTOPUS"/></label><label><span>打印路由 refs</span><input value={config.printRefs.join(', ')} onChange={event=>patch({printRefs:refs(event.target.value)})} placeholder="例如 RECEIPT, KITCHEN"/></label><label><span>渠道 refs</span><input value={config.channelRefs.join(', ')} onChange={event=>patch({channelRefs:refs(event.target.value)})} placeholder="例如 KEETA"/></label></article></div>:null}
    {domain==='timing'?<div className="admin-policy-grid two"><article className="admin-policy-card"><h2>營運計時</h2><label><span>遲到界線（分鐘）</span><input type="number" min={0} value={config.lateArrivalMinutes} onChange={event=>patch({lateArrivalMinutes:Number(event.target.value)||0})}/></label><label><span>出餐計時（分鐘）</span><input type="number" min={0} value={config.fulfillmentMinutes} onChange={event=>patch({fulfillmentMinutes:Number(event.target.value)||0})}/></label><label><span>堂食超時變紅（分鐘） <b className="admin-required">必填</b></span><input {...fieldProps('dining-overdue-minutes')} className={fieldError('dining-overdue-minutes')?'admin-field-invalid':undefined} type="number" min={1} value={config.diningOverdueMinutes??35} onChange={event=>patch({diningOverdueMinutes:Math.max(1,Math.floor(Number(event.target.value)||35))})}/><FieldError id="dining-overdue-minutes"/></label><small>堂食枱由開始時間計；超過此分鐘數先標紅。35 分鐘只係預設值。</small><label><span>封存時間（小時）</span><input type="number" min={1} value={config.archiveHours} onChange={event=>patch({archiveHours:Number(event.target.value)||1})}/></label></article></div>:null}
    {domain==='reminders'?<div className="admin-policy-grid two"><article className="admin-policy-card"><h2>Pending Order 提醒</h2><label><span>幾多分鐘後提醒</span><input type="number" min={0} value={config.reminderAfterMinutes} onChange={event=>patch({reminderAfterMinutes:Number(event.target.value)||0})}/></label><label><span>提醒間隔（分鐘）</span><input type="number" min={1} value={config.reminderIntervalMinutes} onChange={event=>patch({reminderIntervalMinutes:Number(event.target.value)||1})}/></label><Toggle checked={config.repeatReminder} onChange={repeatReminder=>patch({repeatReminder})} label="重複提醒"/><label><span>Timeout 提示優先級</span><select value={config.timeoutPriority} onChange={event=>patch({timeoutPriority:event.target.value as StoreSettings['timeoutPriority']})}><option value="NORMAL">一般</option><option value="HIGH">高</option><option value="URGENT">緊急</option></select></label><small>Timeout 唔會自動接受／拒絕訂單。</small></article></div>:null}
    {domain==='hours'?    <section className="admin-rule-card"><h2>七日營業時間</h2><div className="admin-editor-list">{STORE_DAYS.map(day=>{const row=config.weeklyHours[day.id]??DEFAULT_WEEKLY_HOURS[day.id];return <article className="admin-policy-row" key={day.id}><b>{day.label}</b><select value={row.closed?'CLOSED':'OPEN'} onChange={event=>patchDay(day.id,{closed:event.target.value==='CLOSED'})}><option value="OPEN">營業</option><option value="CLOSED">休息</option></select>{row.closed?<span>休息</span>:<><label><span>開門</span><input type="time" value={row.opensAt} onChange={event=>patchDay(day.id,{opensAt:event.target.value})}/></label><label><span>關門</span><input type="time" value={row.closesAt} onChange={event=>patchDay(day.id,{closesAt:event.target.value})}/></label></>}</article>})}</div></section>:null}
  </section>;
}

interface StaffDraft{
  readonly id:string;readonly loginId:string;readonly name:string;readonly role:'STAFF'|'MANAGER'|'OWNER'|'VIEWER';readonly pin:string;
  readonly pinVerifier?:StaffPinVerifier;
  readonly scope:'STORE'|'MULTI_STORE'|'REPORT_ONLY';readonly adminLogin:boolean;readonly active:boolean;readonly permissions:readonly string[];
}
function migrateStaffDraft(row:StaffDraft):StaffDraft{
  const name=String(row.name??'').trim();
  const loginId=String(row.loginId??'').trim()||(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)?name:String(row.id??'').trim());
  return {...row,loginId,pin:String(row.pin??'')};
}
const PERMISSIONS=[['ORDER_REVIEW','查看訂單'],['ORDER_CORRECTION','更正訂單／付款'],['ADMIN_CONFIG','修改後台設定'],['PUBLISH_CONFIG','建立設定版本'],['REPORT_VIEW','查看報表'],['REPORT_EXPORT','匯出報表'],['STAFF_MANAGE','管理員工']] as const;
export function StaffWorkspace(){
  const {draft,markClean}=useAdminDraft();
  const [staff,setStaff]=usePersistentAdminState<StaffDraft[]>('staff.v1',[]);
  const [saveMessage,setSaveMessage]=useState('');
  const [saveErrors,setSaveErrors]=useState<readonly string[]>([]);
  const [selectedStaffId,setSelectedStaffId]=useState<string|null>(null);
  useEffect(()=>{
    if(staff.some(row=>!String(row.loginId??'').trim()))setStaff(rows=>rows.map(row=>migrateStaffDraft(row)));
  },[]);
  const add=()=>setStaff(rows=>{const row:StaffDraft={id:'staff-'+Date.now().toString(36),loginId:'',name:'',role:'STAFF',pin:'',scope:'STORE',adminLogin:false,active:true,permissions:['ORDER_REVIEW']};appendAdminAudit({action:'新增員工',target:row.id});setSelectedStaffId(row.id);return [...rows,row];});
  const patch=(id:string,change:Partial<StaffDraft>)=>setStaff(rows=>rows.map(row=>{if(row.id!==id)return row;const after={...row,...change};appendAdminAudit({action:'修改員工／權限',target:id,before:{...row,pin:row.pin?'***':'',pinVerifier:row.pinVerifier?'PRESENT':undefined},after:{...after,pin:after.pin?'***':'',pinVerifier:after.pinVerifier?'PRESENT':undefined}});return after;}));
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
    setSaveMessage('已建立正式發佈：'+hkTime(result.release.createdAt)+'（香港時間）；已排入 Admin → SMT 自動同步。');
  };
  const activeRelease=readActiveAdminRelease();
  return <section className="admin-editor-page">
    <header className="admin-editor-head"><div><small>{activeRelease?'本機保存 '+hkTime(activeRelease.createdAt):'未有正式發佈'} · 人員／角色／權限</small><h1>員工／權限</h1><p>登入編號係人手輸入嘅帳號；Internal Staff ID 只供系統識別。PIN 只會轉成驗證器發布，唔會將明文 PIN 發布出去。</p>{saveMessage?<span>{saveMessage}</span>:null}</div><div className="admin-editor-actions"><button className="secondary" onClick={add}>新增員工</button><button className="primary" onClick={saveStaff}>保存人員設定</button></div></header>
    {saveErrors.length?<div className="admin-validation is-error" role="alert"><b>有 {saveErrors.length} 項需要處理</b><ul>{saveErrors.map((error,index)=><li key={index}>{error}</li>)}</ul></div>:null}
    {staff.length===0?<div className="admin-empty-state"><b>未有員工資料</b><p>新增員工後設定角色、PIN、權限範圍同權限。</p><button onClick={add}>新增員工</button></div>:selectedStaffId===null?<div className="admin-settings-home" aria-label="員工列表">{staff.map(row=><button type="button" className="admin-settings-link" key={row.id} onClick={()=>setSelectedStaffId(row.id)}><span><b>{row.name||row.loginId||'未命名員工'}</b><small>{row.loginId?'登入編號 '+row.loginId:'未設定登入編號'} · {row.active?'啟用':'停用'}</small></span><strong aria-hidden="true">›</strong></button>)}</div>:<div className="admin-editor-grid">{staff.filter(row=>row.id===selectedStaffId).map(row=><article className="admin-policy-card" key={row.id}>
      <button type="button" className="admin-back-button" onClick={()=>setSelectedStaffId(null)}>‹ 員工列表</button>
      <header><h2>{row.name||row.loginId||'未命名員工'}</h2><small>{row.loginId?'登入編號 '+row.loginId:'未設定登入編號'}</small></header>
      <label><span>登入編號</span><input autoComplete="username" value={row.loginId??''} onChange={event=>patch(row.id,{loginId:event.target.value.replace(/[^A-Za-z0-9._-]/g,'').slice(0,64)})} placeholder="例如 1111"/></label>
      <label><span>員工名稱</span><input value={row.name} onChange={event=>patch(row.id,{name:event.target.value})}/></label>
      <label><span>角色</span><select value={row.role} onChange={event=>patch(row.id,{role:event.target.value as StaffDraft['role']})}><option value="STAFF">員工</option><option value="MANAGER">經理</option><option value="OWNER">老闆</option><option value="VIEWER">只讀人員</option></select></label>
      <label><span>PIN（4–8 位）</span><input type="password" inputMode="numeric" autoComplete="new-password" value={row.pin} onChange={event=>patch(row.id,{pin:event.target.value.replace(/\D/g,'').slice(0,8)})} placeholder={row.pinVerifier?'留空＝保留現有 PIN':'4–8 位數字'}/></label>
      <label><span>權限範圍</span><select value={row.scope} onChange={event=>patch(row.id,{scope:event.target.value as StaffDraft['scope']})}><option value="STORE">單店</option><option value="MULTI_STORE">多店</option><option value="REPORT_ONLY">只看報表</option></select></label>
      <div className="admin-check-grid">{PERMISSIONS.map(([id,label])=><label key={id}><input type="checkbox" checked={row.permissions.includes(id)} onChange={event=>togglePermission(row,id,event.target.checked)}/><span>{label}</span></label>)}</div>
      <Toggle checked={row.adminLogin} onChange={adminLogin=>patch(row.id,{adminLogin})} label="允許後台登入"/>
      <Toggle checked={row.active} onChange={active=>patch(row.id,{active})} label={row.active?'啟用':'停用'}/>
      <button type="button" onClick={()=>{remove(row);setSelectedStaffId(null)}}>移除</button>
    </article>)}</div>}
  </section>;
}

interface ChannelConfig{enabled:boolean;autoAccept:boolean;syncSellability:boolean;commissionPct:string;displayName:string;lateCutoffMinutes:number}
interface MappingComponent{canonicalProductId:string;quantity:number}
interface MappingRow{providerItemId:string;channelName?:string;components:readonly MappingComponent[];optionGroupId?:string;status:'MAPPED'|'PENDING'|'IGNORED'}
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
  const mappings:MappingRow[]=(draft.channelMappings?.keeta??[]).map(row=>({providerItemId:row.skuOpenItemCode||row.spuOpenItemCode||row.providerSkuId||row.providerSpuId||row.mappingId,channelName:row.channelName,components:row.components,status:'MAPPED'}));
  const [providerItemId,setProviderItemId]=useState('');
  const [productId,setProductId]=useState('');
  const [mappingComponents,setMappingComponents]=useState<MappingComponent[]>([]);
  const [channelName,setChannelName]=useState('');
  const patch=(change:Partial<ChannelConfig>)=>setConfig(current=>{const after={...current,...change};appendAdminAudit({action:'修改平台設定',target:'Keeta',before:current,after});return after;});
  const addMappingComponent=()=>{if(!productId)return;setMappingComponents(rows=>[...rows,{canonicalProductId:productId,quantity:1}]);setProductId('');};
  const addMapping=()=>{if(!providerItemId.trim()||!mappingComponents.length)return;(()=>{const row:MappingRow={providerItemId:providerItemId.trim(),channelName:channelName.trim(),components:Object.freeze([...mappingComponents]),status:'MAPPED'};const next=[...(draft.channelMappings?.keeta??[]).filter(item=>(item.skuOpenItemCode||item.spuOpenItemCode||item.providerSkuId||item.providerSpuId)!==row.providerItemId),{mappingId:'keeta:'+row.providerItemId,enabled:true,skuOpenItemCode:row.providerItemId,channelName:row.channelName,components:row.components,optionMappings:[]}];updateKeetaMappings(next);appendAdminAudit({action:'新增 Keeta 渠道商品對應',target:row.providerItemId,after:row});})();setProviderItemId('');setChannelName('');setMappingComponents([]);};
  const failures=mappings.filter(row=>row.status==='PENDING');
  const title=mode==='overview'?'平台管理':mode==='mapping'?'商品映射管理':mode==='failures'?'匹配失敗明細':mode==='accept'?'接單／自動接單':mode==='sync'?'售罄／供應同步':'實收估算設定';
  const description=mode==='overview'?'查看 Keeta 連線、授權、Webhook 同整體平台狀態。'
    :mode==='mapping'?'管理 Keeta 商品 ID 同磨飯商品嘅對應。'
    :mode==='failures'?'只處理尚未完成嘅商品匹配。'
    :mode==='accept'?'管理 Keeta 新單入口、自動接單同遲到界線。'
    :mode==='sync'?'管理菜單、售罄供應同門店營業狀態同步。'
    :'查看 Provider commercial evidence，同設定實收估算參數。';
  return <section className="admin-editor-page">
    <PolicyHeader title={title} description={description}/>
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
            <p><span>Mapping</span><b>{row.mappingState}</b></p>
            <p><span>SMT ACK</span><b>{row.ackState}</b></p>
            <p><span>Commercial</span><b>{row.commercialState??'未有'}</b></p>
            <p><span>Provider Confirm</span><b>{row.providerConfirmState??'未執行'}</b></p>
            <p><span>Provider Ready</span><b>{row.providerReadyState??'未執行'}</b></p>
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
    {(mode==='overview'||mode==='accept'||mode==='sync'||mode==='estimate')?<div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>Keeta 平台設定</h2><label><span>顯示名稱</span><input value={config.displayName} onChange={event=>patch({displayName:event.target.value})}/></label>{mode==='overview'?<Toggle checked={config.enabled} onChange={enabled=>patch({enabled})} label="啟用平台設定"/>:null}{mode==='accept'?<><Toggle checked={config.autoAccept} onChange={autoAccept=>patch({autoAccept})} label="正常單自動接單"/><label><span>遲到訂單界線（分鐘）</span><input type="number" min={0} value={config.lateCutoffMinutes} onChange={event=>patch({lateCutoffMinutes:Number(event.target.value)||0})}/></label></>:null}{mode==='sync'?<Toggle checked={config.syncSellability} onChange={syncSellability=>patch({syncSellability})} label="同步售罄／供應"/>:null}{mode==='estimate'?<label><span>佣金估算 %</span><input inputMode="decimal" value={config.commissionPct} onChange={event=>patch({commissionPct:event.target.value})}/></label>:null}</article>
    </div>:null}
    {(mode==='mapping'||mode==='failures')?<div className="admin-policy-grid two">
      <article className="admin-policy-card"><h2>{mode==='failures'?'未完成對應':'商品對應'}</h2>
        {mode==='failures'
          ?(failures.length?<div>{failures.map(row=><p key={row.providerItemId}>{row.providerItemId} · 待處理</p>)}</div>:<div className="admin-read-empty">目前冇待處理映射。</div>)
          :<><div className="admin-callout compact">Keeta 商品 ID 只係渠道 Alias；右邊必須對應磨飯實際製作商品。二人餐／多人餐可以加入多個磨飯商品，廚房、Packing 同 Label 會使用呢個 Breakdown，而唔係用 Keeta 商品名代替製作內容。</div><label><span>Keeta 商品／SKU ID</span><input value={providerItemId} onChange={event=>setProviderItemId(event.target.value)} placeholder="例如 1234"/></label><label><span>Keeta 顯示名稱</span><input value={channelName} onChange={event=>setChannelName(event.target.value)} placeholder="例如 二人套餐"/></label><label><span>加入磨飯製作商品</span><select value={productId} onChange={event=>setProductId(event.target.value)}><option value="">請選擇</option>{draft.products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label><button type="button" className="secondary" disabled={!productId} onClick={addMappingComponent}>加入製作內容</button>{mappingComponents.length?<div className="admin-readback-proof">{mappingComponents.map((component,index)=><p key={index}><span>#{index+1}</span><b>{draft.products.find(product=>product.id===component.canonicalProductId)?.name??component.canonicalProductId} × {component.quantity}</b></p>)}</div>:<div className="admin-read-empty">未加入磨飯製作商品。</div>}<button type="button" disabled={!providerItemId.trim()||!mappingComponents.length} onClick={addMapping}>保存 Keeta 對應</button><div className="admin-readback-proof">{mappings.slice(0,20).map(row=><p key={row.providerItemId}><span>{row.providerItemId}{row.channelName?' · '+row.channelName:''}</span><b>{row.components.map(component=>(draft.products.find(product=>product.id===component.canonicalProductId)?.name??component.canonicalProductId)+' × '+component.quantity).join(' + ')}</b></p>)}</div></>}
      </article>
    </div>:null}
  </section>;
}
