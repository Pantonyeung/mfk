import {useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import {applyLanPrinter,printBytesLan,printTextLan,testLanPrinter,type NativeResult} from '../runtime/native-print.ts';
import {LABEL_TSC_PROFILE,renderTscRasterLabel} from '../runtime/label-bitmap.ts';
import {localRuntime,readLastPrintDiagnostic} from '../runtime/local-runtime.ts';
import {LocalAdminMenuWorkspace} from './LocalAdminMenuWorkspace.tsx';
import {
  applyMfkStorageSnapshot,
  buildLocalReport,
  createLocalBackup,
  commitLocalDayCloseOnce,
  readLocalDayCloses,
  restoreLocalBackup,
  snapshotMfkStorage,
  validateLocalBackup,
  type LocalBackup,
  type LocalDayClose,
} from '../runtime/local-operations.ts';
import {readBusinessCutoff,readCurrentCashOpeningState} from '../runtime/cash-opening.ts';
import {queueDayCloseProjection} from '../runtime/projection-outbox.ts';
import {readSmtPrintConfig} from '../runtime/admin-operational-config.ts';
import {subscribeSmtAdminConfig} from '../runtime/admin-config-sync.ts';
import './more-workspace.css';

export type PrinterBinding={
  id:string;
  routeKey:string;
  name:string;
  model:string;
  role:'顧客小票'|'製作單'|'打包單'|'產品標籤'|'袋標籤';
  host:string;
  port:number;
  capability:'receipt-80mm/kitchen'|'label-58mm';
  encoding:'gb18030'|'big5'|'utf-8';
  logicalPrinterId?:string;
  productIds?:string[];
};

export const PRINTER_BINDING_KEY='mfk.v2local.printers.v5';
const LEGACY_PRINTER_BINDING_KEYS=['mfk.v2local.printers.v4','mfk.v2local.printers.v3','mfk.v2local.printers.v2'] as const;
const RICEBALL_PRODUCT_IDS=['riceball','tuna','pork'];
const TAKEAWAY_PRODUCT_IDS=['bento','curry','wedges','milkTea','lemonTea'];
const FIXED_PRODUCT_LABEL_IDS=new Set(['product-label-1','product-label-2']);

const defaults:PrinterBinding[]=[
  {id:'receipt-1',routeKey:'logical.receipt',logicalPrinterId:'logical-receipt',name:'顧客小票打印機',model:'LAN PRINTER',role:'顧客小票',host:'',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  {id:'production-1',routeKey:'logical.production',logicalPrinterId:'logical-production',name:'製作單打印機',model:'LAN PRINTER',role:'製作單',host:'',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  {id:'packing-1',routeKey:'logical.packing',logicalPrinterId:'logical-packing',name:'打包單打印機',model:'LAN PRINTER',role:'打包單',host:'',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  {id:'product-label-1',routeKey:'logical.product-label.riceball',logicalPrinterId:'logical-riceball-label',name:'飯糰標籤機',model:'LAN LABEL PRINTER',role:'產品標籤',host:'',port:9100,capability:'label-58mm',encoding:'big5',productIds:[...RICEBALL_PRODUCT_IDS]},
  {id:'product-label-2',routeKey:'logical.product-label.takeaway',logicalPrinterId:'logical-takeaway-label',name:'外賣標籤機',model:'LAN LABEL PRINTER',role:'產品標籤',host:'',port:9100,capability:'label-58mm',encoding:'big5',productIds:[...TAKEAWAY_PRODUCT_IDS]},
  {id:'bag-label-1',routeKey:'logical.bag-label',name:'袋標籤打印機',model:'LAN LABEL PRINTER',role:'袋標籤',host:'',port:9100,capability:'label-58mm',encoding:'big5'},
];

type Section='overview'|'printing'|'diagnostics'|'dayclose'|'reports'|'backup'|'admin-menu';

function normalizeStoredRow(old:Record<string,unknown>,fallback?:PrinterBinding,legacy=false):PrinterBinding{
  const capability=(old.capability==='label-58mm'||fallback?.capability==='label-58mm')?'label-58mm':'receipt-80mm/kitchen';
  const role=(typeof old.role==='string'?old.role:fallback?.role) as PrinterBinding['role'];
  const id=String(old.id||fallback?.id||'');
  const routeKey=String(old.routeKey||fallback?.routeKey||'');
  const defaultProductIds=fallback?.productIds??[];
  const productIds=role==='產品標籤'
    ? (Array.isArray(old.productIds)?old.productIds.map(String):[...defaultProductIds])
    : undefined;
  return {
    id,
    routeKey,
    name:typeof old.name==='string'&&old.name.trim()?old.name:String(fallback?.name||'LAN PRINTER'),
    model:typeof old.model==='string'&&old.model.trim()&&!String(old.model).includes('SUNMI')?String(old.model):String(fallback?.model||'LAN PRINTER'),
    role,
    host:typeof old.host==='string'?old.host:String(fallback?.host||''),
    port:Number.isSafeInteger(Number(old.port))&&Number(old.port)>0?Number(old.port):Number(fallback?.port||9100),
    capability,
    encoding:capability==='label-58mm'
      ? (old.encoding==='utf-8'?'utf-8':legacy?'big5':old.encoding==='big5'?'big5':'big5')
      : (old.encoding==='big5'||old.encoding==='utf-8'?old.encoding:'gb18030'),
    logicalPrinterId:typeof old.logicalPrinterId==='string'&&old.logicalPrinterId.trim()?old.logicalPrinterId:String(fallback?.logicalPrinterId||'')||undefined,
    ...(productIds===undefined?{}:{productIds}),
  };
}

function migrateStored(value:unknown,{legacy=false}:{legacy?:boolean}={}):PrinterBinding[]{
  if(!Array.isArray(value))return defaults.map(x=>({...x,productIds:x.productIds?[...x.productIds]:undefined}));
  const stored=value.filter(x=>x&&typeof x==='object') as Record<string,unknown>[];
  const fixed=defaults.map(fallback=>{
    let old=stored.find(x=>String(x.id||'')===fallback.id);
    if(fallback.id==='product-label-2'&&(!old||!String(old.host||'').trim())){
      const bag=stored.find(x=>String(x.role||'')==='袋標籤'&&String(x.host||'').trim());
      if(bag)old={...bag,id:fallback.id,routeKey:fallback.routeKey,name:fallback.name,role:fallback.role,productIds:fallback.productIds};
    }
    if(!old&&fallback.id==='product-label-1')old=stored.find(x=>String(x.role||'')==='產品標籤');
    if(!old&&!fallback.id.startsWith('product-label-'))old=stored.find(x=>String(x.role||'')===fallback.role);
    return old?normalizeStoredRow(old,fallback,legacy):{...fallback,productIds:fallback.productIds?[...fallback.productIds]:undefined};
  });
  const fixedIds=new Set(fixed.map(row=>row.id));
  const extras=stored
    .filter(row=>String(row.role||'')==='產品標籤'&&!fixedIds.has(String(row.id||'')))
    .map(row=>normalizeStoredRow(row,undefined,legacy))
    .filter(row=>row.id&&row.routeKey);
  return [...fixed,...extras];
}

function loadPrinters():PrinterBinding[]{
  try{
    const current=JSON.parse(localStorage.getItem(PRINTER_BINDING_KEY)||'null');
    if(current)return migrateStored(current);
    for(const key of LEGACY_PRINTER_BINDING_KEYS){
      const raw=localStorage.getItem(key);
      if(!raw)continue;
      const migrated=migrateStored(JSON.parse(raw),{legacy:true});
      localStorage.setItem(PRINTER_BINDING_KEY,JSON.stringify(migrated));
      return migrated;
    }
    return defaults.map(x=>({...x,productIds:x.productIds?[...x.productIds]:undefined}));
  }catch{return defaults.map(x=>({...x,productIds:x.productIds?[...x.productIds]:undefined}))}
}
function savePrinters(rows:PrinterBinding[]){localStorage.setItem(PRINTER_BINDING_KEY,JSON.stringify(rows))}
function resultLabel(result:NativeResult|null){return !result?'未測試':result.ok?(result.code||'PASS'):(result.code||'FAIL')}
function money(minor:number){return '$'+(Number(minor||0)/100).toFixed(2)}
function download(name:string,text:string,type='application/json'){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}
function csv(report:ReturnType<typeof buildLocalReport>){
  const rows=[
    ['MFK LOCAL REPORT',report.businessDate],
    ['完成訂單',String(report.completedOrders)],
    ['淨銷售',money(report.netSalesMinor)],
    ['現金銷售',money(report.cashSalesMinor)],
    ['商品件數',String(report.itemUnits)],
    ['平均客單',money(report.averageOrderMinor)],
    [],
    ['商品','數量','銷售'],
    ...report.topProducts.map(row=>[row.name,String(row.quantity),money(row.salesMinor)]),
  ];
  return '\ufeff'+rows.map(row=>row.map(cell=>'"'+String(cell??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
}

function productLabelPurpose(binding:PrinterBinding){
  if(binding.id==='product-label-1')return '飯糰專用';
  if(binding.id==='product-label-2')return '外賣專用';
  return '自訂 Route · 待 Admin 指派商品';
}

function OverviewPanel({onOpen}:{onOpen:(section:Section)=>void}){
  const cutoff=readBusinessCutoff();
  const report=buildLocalReport(localRuntime.orders(),{businessStartHour:cutoff.hour,businessStartMinute:cutoff.minute});
  const printers=loadPrinters();
  const online=printers.filter(printer=>printer.host.trim()).length;
  const lastPrint=readLastPrintDiagnostic();
  const cards=[
    {id:'dayclose' as const,no:'01',icon:'▣',title:'收銀與日結',desc:'現金點算、開工底箱、日結確認與本機紀錄'},
    {id:'reports' as const,no:'02',icon:'↗',title:'報表與分析',desc:'營業額、訂單、商品排行與本機報表'},
    {id:'printing' as const,no:'03',icon:'▤',title:'打印與設備',desc:'打印機設定、路由、測試與標籤綁定'},
    {id:'backup' as const,no:'04',icon:'☁',title:'備份與恢復',desc:'本機備份、校驗、恢復與資料安全'},
    {id:'diagnostics' as const,no:'05',icon:'⚙',title:'顯示與操作／診斷',desc:'Printer Trace、Route、錯誤碼與本機健康狀態'},
    {id:'admin-menu' as const,no:'06',icon:'↻',title:'Admin 同步',desc:'只讀查看 Admin 最新版本、同步狀態同本機 LKG'},
  ];
  return <section className="more-overview">
    <header><div><span>SMT LOCAL OPERATIONS</span><h2>更多功能總覽</h2><p>本地營運控制面板；之後可以再接 Admin 發布設定。</p></div><strong>{new Date().toLocaleString('zh-HK')}</strong></header>
    <div className="more-overview-cards">{cards.map(card=><button key={card.id} type="button" onClick={()=>onOpen(card.id)}>
      <span>{card.no}</span><i>{card.icon}</i><b>{card.title}</b><small>{card.desc}</small><em>進入</em>
    </button>)}</div>
    <div className="more-overview-grid">
      <article><header><b>今日營運</b><span>LOCAL</span></header><div><p><span>完成訂單</span><strong>{report.completedOrders}</strong></p><p><span>淨銷售</span><strong>{money(report.netSalesMinor)}</strong></p><p><span>平均客單</span><strong>{money(report.averageOrderMinor)}</strong></p></div></article>
      <article><header><b>打印設備</b><span>{online}/{printers.length} 已綁定</span></header><div><p><span>最近打印</span><strong>{lastPrint?lastPrint.elapsedMs+' ms':'—'}</strong></p><p><span>成功／計劃</span><strong>{lastPrint?lastPrint.sent+'/'+lastPrint.planned:'—'}</strong></p><p><span>狀態</span><strong>{lastPrint?(lastPrint.failed?'需檢查':'正常'):'待首張'}</strong></p></div></article>
      <article><header><b>系統資訊</b><span>MFK Local</span></header><div><p><span>Runtime</span><strong>LOCAL-FIRST</strong></p><p><span>Native Bridge</span><strong>{window.moreFunNative?'已連接':'未連接'}</strong></p><p><span>資料權威</span><strong>本機交易</strong></p></div></article>
    </div>
  </section>;
}

function PrinterPanel(){
  const [printers,setPrinters]=useState<PrinterBinding[]>(loadPrinters);
  const [configRevision,setConfigRevision]=useState(0);
  useEffect(()=>subscribeSmtAdminConfig(()=>setConfigRevision(value=>value+1)),[]);
  void configRevision;
  const printConfig=readSmtPrintConfig();
  const [selected,setSelected]=useState('receipt-1');
  const [status,setStatus]=useState<Record<string,NativeResult|null>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const current=useMemo(()=>printers.find(x=>x.id===selected)??printers[0],[printers,selected]);
  const logicalType=current?.role==='顧客小票'?'RECEIPT':current?.role==='製作單'?'PRODUCTION':current?.role==='打包單'?'PACKING':current?.role==='產品標籤'?'LABEL':undefined;
  const logicalOptions=logicalType?printConfig.logicalPrinters.filter(row=>row.type===logicalType):[];


  const update=(patch:Partial<PrinterBinding>)=>{
    const next=printers.map(p=>p.id===current.id?{...p,...patch}:p);
    setPrinters(next);
    savePrinters(next);
  };
  const addProductLabel=()=>{
    const suffix=Date.now().toString(36);
    const row:PrinterBinding={
      id:'product-label-custom-'+suffix,
      routeKey:'logical.product-label.custom.'+suffix,
      name:'新增產品標籤機',
      model:'LAN LABEL PRINTER',
      role:'產品標籤',
      host:'',
      port:9100,
      capability:'label-58mm',
      encoding:'big5',
      logicalPrinterId:undefined,
      productIds:[],
    };
    const next=[...printers,row];
    setPrinters(next);
    savePrinters(next);
    setSelected(row.id);
  };
  const removeProductLabel=()=>{
    if(current.role!=='產品標籤'||FIXED_PRODUCT_LABEL_IDS.has(current.id))return;
    const next=printers.filter(row=>row.id!==current.id);
    setPrinters(next);
    savePrinters(next);
    setSelected('product-label-1');
  };
  const input=()=>({
    endpointId:current.id,host:current.host.trim(),port:Number(current.port),
    displayName:current.name,model:current.model,capability:current.capability,encoding:current.encoding,
  });
  const run=async(kind:'save'|'test'|'print')=>{
    if(!current||busy)return;
    setBusy(kind);
    let result:NativeResult;
    try{
      const printer=input();
      if(!printer.host)result={ok:false,code:'LAN_ENDPOINT_HOST_REQUIRED'};
      else if(!Number.isSafeInteger(printer.port)||printer.port<1||printer.port>65535)result={ok:false,code:'LAN_ENDPOINT_PORT_INVALID'};
      else if(kind==='save')result=await applyLanPrinter(printer);
      else if(kind==='test')result=await testLanPrinter(printer);
      else{
        if(current.capability==='label-58mm'){
          const bytes=await renderTscRasterLabel(current.role==='袋標籤'?{
            kind:'bag',
            orderCode:'P0019',
            primaryText:'共 2 件',
            secondaryText:'共 2 件',
          }:{
            kind:'product',
            orderCode:'P0017',
            primaryText:current.name,
            secondaryText:productLabelPurpose(current),
            pieceLabel:'1/2',
          });
          result=await printBytesLan({...printer,bytes});
        }else{
          const payload='\x1b\x40MFK FUSION '+current.role+' TEST\n'+current.name+'\n'+new Date().toISOString()+'\n\n\n';
          result=await printTextLan({...printer,text:payload});
        }
      }
    }catch(error){result={ok:false,code:error instanceof Error?error.message:'PRINT_ACTION_FAILED'}}
    setStatus(s=>({...s,[current.id]:result}));
    setBusy(null);
  };

  return <section className="more-panel">
    <header className="more-section-heading"><div><span>PHYSICAL PRINT ROUTING</span><h2>打印與設備</h2></div><strong>{window.moreFunNative?'Carrier Bridge 已連接':'Native Bridge 未連接'}</strong></header>
    <p className="fusion-note">Admin 定義 Logical Printer 同商品打印規則；SMT 只負責將 Logical Printer 配對到實體 IP／Port。Admin 關閉用途或商品規則後，SMT print plan 會自動停止相應 job。</p>
    <div className="more-tab-row">
      {printers.map(p=><button key={p.id} type="button" className={p.id===current.id?'active':''} onClick={()=>setSelected(p.id)}>{p.role==='產品標籤'?p.name:p.role}</button>)}
      <button type="button" onClick={addProductLabel}>＋ 新增產品 Label</button>
    </div>
    <div className="more-kpis">
      <article><span>Route</span><b>{current.routeKey}</b></article>
      <article><span>實體打印機</span><b>{current.host?current.host+':'+current.port:'未綁定'}</b></article>
      <article><span>結果</span><b>{resultLabel(status[current.id]??null)}</b></article>
    </div>
    <label className="more-field"><span>打印機名稱</span><input value={current.name} onChange={e=>update({name:e.target.value})}/></label>
    {logicalType?<label className="more-field"><span>Admin Logical Printer</span><select value={current.logicalPrinterId??''} onChange={e=>update({logicalPrinterId:e.target.value||undefined})}><option value="">未配對</option>{logicalOptions.map(row=><option key={row.id} value={row.id}>{row.name} · {row.active?'啟用':'停用'}</option>)}</select></label>:null}
    <label className="more-field"><span>Printer IP / Host</span><input inputMode="decimal" placeholder="例如 192.168.1.201" value={current.host} onChange={e=>update({host:e.target.value})}/></label>
    <label className="more-field"><span>Port</span><input inputMode="numeric" value={String(current.port)} onChange={e=>update({port:Number(e.target.value)||0})}/></label>
    <label className="more-field"><span>中文編碼</span><select value={current.encoding} onChange={e=>update({encoding:e.target.value as PrinterBinding['encoding']})}><option value="gb18030">GB18030</option><option value="big5">Big5（標籤預設）</option><option value="utf-8">UTF-8</option></select></label>
    {current.role==='產品標籤'?<div className="fusion-note"><b>本地用途</b>：{productLabelPurpose(current)}。目前只做 SMT 本地實體綁定；自訂 Route 預設唔自動出產品 Label，避免未有 Admin 商品映射前重覆打印。</div>:null}
    {current.capability==='label-58mm'?<div className="fusion-note"><b>Label Profile</b>：{LABEL_TSC_PROFILE.protocol} · {LABEL_TSC_PROFILE.widthMm}×{LABEL_TSC_PROFILE.heightMm} mm · 上偏移 {LABEL_TSC_PROFILE.topOffset} · 左偏移 {LABEL_TSC_PROFILE.leftOffset} · 行間隔 {LABEL_TSC_PROFILE.lineGap} · 中文以 Bitmap 出紙</div>:null}
    <div className="more-tab-row">
      <button type="button" disabled={Boolean(busy)} onClick={()=>void run('test')}>{busy==='test'?'測試中…':'① 測試連線'}</button>
      <button type="button" className="more-primary" disabled={Boolean(busy)} onClick={()=>void run('print')}>{busy==='print'?'出紙中…':'② 測試出紙'}</button>
      <button type="button" disabled={Boolean(busy)} onClick={()=>void run('save')}>{busy==='save'?'保存中…':'③ 保存綁定'}</button>
      {current.role==='產品標籤'&&!FIXED_PRODUCT_LABEL_IDS.has(current.id)?<button type="button" disabled={Boolean(busy)} onClick={removeProductLabel}>刪除此自訂 Label</button>:null}
    </div>
    {status[current.id]?<p role="status"><b>{status[current.id]?.ok?'PASS':'FAIL'}：</b>{resultLabel(status[current.id]??null)}</p>:null}
  </section>;
}

function DiagnosticsPanel(){
  const printers=loadPrinters();
  const lastPrint=readLastPrintDiagnostic();
  const groups=new Map<string,PrinterBinding[]>();
  for(const printer of printers){
    const host=printer.host.trim();
    const key=host?host+':'+printer.port:'UNBOUND:'+printer.id;
    const list=groups.get(key)??[];
    list.push(printer);
    groups.set(key,list);
  }
  const unbound=printers.filter(printer=>!printer.host.trim());
  return <section className="more-panel">
    <header className="more-section-heading"><div><span>LOCAL DIAGNOSTICS</span><h2>診斷中心</h2></div><strong>{window.moreFunNative?'Carrier Bridge 已連接':'Native Bridge 未連接'}</strong></header>
    <div className="more-kpis">
      <article><span>Printer Routes</span><b>{printers.length}</b></article>
      <article><span>未綁定</span><b>{unbound.length}</b></article>
      <article><span>實體設備</span><b>{[...groups.keys()].filter(key=>!key.startsWith('UNBOUND:')).length}</b></article>
      <article><span>最近打印</span><b>{lastPrint?lastPrint.elapsedMs+' ms':'—'}</b></article>
    </div>
    <section className="fusion-list">
      <header><b>打印 Route</b><span>LOCAL STORAGE · v5</span></header>
      {printers.map(printer=><article key={printer.id}>
        <span>{printer.name}<small> · {printer.routeKey}</small></span>
        <b>{printer.host.trim()?printer.host+':'+printer.port:'未綁定'}</b>
        <strong>{printer.role==='產品標籤'?(printer.productIds?.length??0)+' 個商品':'—'}</strong>
      </article>)}
    </section>
    {lastPrint?<section className="fusion-list">
      <header><b>最近一次打印 Trace · {lastPrint.display}</b><span>{lastPrint.sent}/{lastPrint.planned} · {lastPrint.elapsedMs} ms</span></header>
      {lastPrint.physical.map(route=><article key={route.physicalKey}>
        <span>{route.roles.join(' + ')}<small> · {route.bindingIds.join(', ')}</small></span>
        <b>{route.physicalKey}</b>
        <strong>{route.ok?'PASS':'FAIL'} · {route.planned} jobs · {route.elapsedMs} ms · {route.code}</strong>
      </article>)}
    </section>:<p className="fusion-note">未有最近打印 Trace。下一張單打印後，會記錄每部實體 Printer 嘅 jobs、耗時同錯誤碼。</p>}
    <p className="fusion-note">同一實體 IP / Port 嘅 Label Route 會合併成一次 LAN socket dispatch；不同實體 Printer 會並行送出。飯糰同外賣仍保留獨立 logical route。診斷中心只顯示本機真實 binding，唔會假裝 Cloud 同步狀態。</p>
  </section>;
}

function ReportsPanel({revision}:{revision:number}){
  void revision;
  const cutoff=readBusinessCutoff();
  const report=buildLocalReport(localRuntime.orders(),{businessStartHour:cutoff.hour,businessStartMinute:cutoff.minute});
  return <section className="more-panel">
    <header className="more-section-heading"><div><span>LOCAL REPORT</span><h2>今日營運</h2></div><strong>{report.businessDate}</strong></header>
    <div className="more-kpis fusion-kpis">
      <article><span>完成訂單</span><b>{report.completedOrders}</b></article>
      <article><span>淨銷售</span><b>{money(report.netSalesMinor)}</b></article>
      <article><span>現金銷售</span><b>{money(report.cashSalesMinor)}</b></article>
      <article><span>平均客單</span><b>{money(report.averageOrderMinor)}</b></article>
      <article><span>商品件數</span><b>{report.itemUnits}</b></article>
    </div>
    <section className="fusion-list">
      <header><b>商品排行</b><span>LOCAL DATA</span></header>
      {report.topProducts.length?report.topProducts.map(row=><article key={row.name}><span>{row.name}</span><b>{row.quantity} 件</b><strong>{money(row.salesMinor)}</strong></article>):<p>今日未有訂單。</p>}
    </section>
    <div className="more-tab-row"><button type="button" onClick={()=>download('mfk-report-'+report.businessDate+'.csv',csv(report),'text/csv;charset=utf-8')}>匯出 CSV</button></div>
  </section>;
}

function DayClosePanel({revision,onSaved}:{revision:number;onSaved:()=>void}){
  void revision;
  const cutoff=readBusinessCutoff();
  const report=buildLocalReport(localRuntime.orders(),{
    businessStartHour:cutoff.hour,
    businessStartMinute:cutoff.minute,
  });
  const openingRecord=readCurrentCashOpeningState().opening;
  const openingCashMinor=openingRecord?.amountMinor??0;
  const [mode,setMode]=useState<'total'|'denom'>('denom');
  const [denomEntryMode,setDenomEntryMode]=useState<'count'|'amount'>('amount');
  const [counted,setCounted]=useState('');
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [amounts,setAmounts]=useState<Record<string,string>>({});
  const [cashRemoved,setCashRemoved]=useState('');
  const [note,setNote]=useState('');
  const [message,setMessage]=useState('');
  const [completion,setCompletion]=useState<LocalDayClose|null>(null);
  const closes=readLocalDayCloses();
  const latest=[...closes].filter(x=>x.businessDate===report.businessDate).sort((a,b)=>b.version-a.version||b.createdAt-a.createdAt)[0];
  const denominations=[1,2,5,10,20,50,100,500,1000] as const;

  const qtyFor=(value:number)=>Math.max(0,Math.floor(Number(counts[String(value)])||0));
  const denomTotal=denominations.reduce((sum,value)=>sum+value*qtyFor(value),0);
  const countedMinor=mode==='denom'?Math.round(denomTotal*100):Math.round(Number(counted||0)*100);
  const expected=openingCashMinor+report.cashSalesMinor;
  const difference=countedMinor-expected;
  const hasCount=mode==='denom'?denominations.some(value=>qtyFor(value)>0):Boolean(counted);
  const hasRemoval=cashRemoved.trim()!=='';
  const cashRemovedMinor=Math.max(0,Math.round(Number(cashRemoved||0)*100));
  const removalValid=hasRemoval&&cashRemovedMinor<=countedMinor;
  const retainedCashMinor=removalValid?countedMinor-cashRemovedMinor:0;

  const setQty=(value:number,qty:number)=>{
    const normalized=Math.max(0,Math.floor(Number(qty)||0));
    setCounts(current=>({...current,[String(value)]:normalized}));
    setAmounts(current=>({...current,[String(value)]:String(normalized*value)}));
  };

  const setAmount=(value:number,raw:string)=>{
    const numeric=Math.max(0,Math.floor(Number(raw)||0));
    setAmounts(current=>({...current,[String(value)]:raw}));
    setCounts(current=>({...current,[String(value)]:Math.floor(numeric/value)}));
  };

  const printClose=async(target:LocalDayClose)=>{
    setMessage('日結單打印中…');
    try{
      await localRuntime.printDailyClose(target.businessDate);
      setMessage('日結單已送到顧客小票打印機。');
    }catch(error){
      setMessage('日結單打印失敗：'+(error instanceof Error?error.message:'PRINT_FAILED'));
    }
  };

  const close=()=>{
    if(latest){setCompletion(latest);setMessage('今日已經完成日結；正常日結唔會再建立新版本。');return;}
    if(!openingRecord){setMessage('今日未確認開更現金；請重新進入 SMT 完成開更現金確認。');return;}
    if(!hasCount){setMessage('請先輸入實點現金。');return;}
    if(!hasRemoval){setMessage('請輸入今次取走現金；如果唔取走請填 0。');return;}
    if(cashRemovedMinor>countedMinor){setMessage('取走現金唔可以大過實點現金。');return;}
    const denominationNote=mode==='denom'
      ?'｜面額點算 '+denominations.map(value=>String.fromCharCode(36)+value+'×'+qtyFor(value)).join('、')
      :'';
    const result=commitLocalDayCloseOnce({
      orders:localRuntime.orders(),
      businessStartHour:cutoff.hour,
      businessStartMinute:cutoff.minute,
      openingCashMinor,
      countedCashMinor:countedMinor,
      cashRemovedMinor,
      note:note+denominationNote,
    });
    queueDayCloseProjection(result.row);
    setCompletion(result.row);
    setMessage(result.created?'日結完成。':'今日已經完成日結；冇建立重複版本。');
    onSaved();
  };

  if(latest)return <section className="more-panel dayclose-panel">
    <header className="more-section-heading"><div><span>LOCAL DAY CLOSE</span><h2>收銀與日結</h2></div><strong>今日已完成</strong></header>
    <section className="dayclose-complete-card">
      <div className="dayclose-complete-icon">✓</div>
      <div>
        <span>{latest.businessDate}</span>
        <h3>今日日結已鎖定</h3>
        <p>正常日結每個 Business Date 只可以完成一次。重覆入頁或者再撳按鈕都唔會再建立新版本。</p>
      </div>
    </section>
    <div className="more-kpis">
      <article><span>開更現金</span><b>{money(latest.openingCashMinor)}</b></article>
      <article><span>現金銷售</span><b>{money(latest.cashSalesMinor)}</b></article>
      <article><span>實點現金</span><b>{money(latest.countedCashMinor)}</b></article>
      <article><span>取走現金</span><b>{latest.cashRemovedMinor===undefined?'未記錄':money(latest.cashRemovedMinor)}</b></article>
      <article><span>留櫃現金</span><b>{latest.retainedCashMinor===undefined?'未記錄':money(latest.retainedCashMinor)}</b></article>
      <article><span>差額</span><b>{money(latest.cashDifferenceMinor)}</b></article>
    </div>
    <div className="fusion-note">記錄 ID：{latest.id}。如日後需要更正，會走獨立日結更正權限流程，唔會再用正常日結按鈕新增版本。</div>
    <div className="more-tab-row"><button type="button" className="more-primary" onClick={()=>void printClose(latest)}>打印日結單</button></div>
    {message?<p role="status" className="fusion-status">{message}</p>:null}
  </section>;

  return <section className="more-panel dayclose-panel">
    <header className="more-section-heading"><div><span>LOCAL DAY CLOSE</span><h2>收銀與日結</h2></div><strong>今日未日結</strong></header>

    <div className="more-kpis">
      <article><span>今日開更現金</span><b>{money(openingCashMinor)}</b></article>
      <article><span>今日現金銷售</span><b>{money(report.cashSalesMinor)}</b></article>
      <article><span>預計櫃桶</span><b>{money(expected)}</b></article>
      <article><span>實點現金</span><b>{money(countedMinor)}</b></article>
      <article><span>目前差額</span><b>{hasCount?money(difference):'—'}</b></article>
    </div>

    <div className="dayclose-mode-switch">
      <button type="button" className={mode==='denom'?'active':''} onClick={()=>setMode('denom')}>按面額點算</button>
      <button type="button" className={mode==='total'?'active':''} onClick={()=>setMode('total')}>直接輸入總額</button>
    </div>

    <div className="fusion-form-grid dayclose-base-fields">
      <label className="more-field"><span>開更現金</span><input value={(openingCashMinor/100).toFixed(2)} readOnly/></label>
      {mode==='total'?<label className="more-field"><span>實點現金</span><input inputMode="decimal" value={counted} onChange={e=>setCounted(e.target.value.replace(/[^0-9.]/g,''))}/></label>:null}
      <label className="more-field"><span>今次取走現金</span><input inputMode="decimal" value={cashRemoved} onChange={e=>setCashRemoved(e.target.value.replace(/[^0-9.]/g,''))} placeholder="例如 4000"/></label>
      <label className="more-field"><span>計算後留櫃現金</span><input value={removalValid?(retainedCashMinor/100).toFixed(2):''} readOnly placeholder="實點 − 取走"/></label>
      <label className="more-field fusion-wide"><span>備註</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：現金差異原因／額外補回散紙"/></label>
    </div>

    {mode==='denom'?<section className="cash-denomination-shell">
      <header className="cash-denomination-toolbar">
        <div><b>面額點算</b><span>先點清實際櫃桶現金，再輸入今次攞走幾多；系統會自動計留櫃現金。</span></div>
        <div className="cash-entry-toggle">
          <button type="button" className={denomEntryMode==='count'?'active':''} onClick={()=>setDenomEntryMode('count')}>輸入張／個數</button>
          <button type="button" className={denomEntryMode==='amount'?'active':''} onClick={()=>setDenomEntryMode('amount')}>輸入面額總金額</button>
        </div>
      </header>
      <section className="cash-denomination-table">
        <header><span>面額</span><span>{denomEntryMode==='count'?'張／個數':'該面額總金額'}</span><span>換算</span><span>小計</span></header>
        {denominations.map(value=>{
          const qty=qtyFor(value);
          const rawAmount=amounts[String(value)]??String(qty*value||'');
          const typedAmount=Math.max(0,Math.floor(Number(rawAmount)||0));
          const remainder=typedAmount%value;
          return <div key={value}>
            <b>{String.fromCharCode(36)+value}</b>
            {denomEntryMode==='count'
              ?<div className="cash-count-control"><button type="button" onClick={()=>setQty(value,qty-1)}>−</button><input inputMode="numeric" value={qty||''} placeholder="0" onChange={e=>setQty(value,Number(e.target.value))}/><button type="button" onClick={()=>setQty(value,qty+1)}>＋</button></div>
              :<div className="cash-amount-control"><span>{String.fromCharCode(36)}</span><input inputMode="numeric" value={rawAmount} placeholder="0" onChange={e=>setAmount(value,e.target.value)}/></div>}
            <span className={remainder&&denomEntryMode==='amount'?'cash-convert invalid':'cash-convert'}>{qty} {value<10?'個':'張'}{remainder&&denomEntryMode==='amount'?' · 金額唔係面額倍數':''}</span>
            <strong>{money(value*qty*100)}</strong>
          </div>;
        })}
        <footer><span>面額合計</span><strong>{money(countedMinor)}</strong></footer>
      </section>
    </section>:null}

    <section className="cash-retain-summary">
      <article><span>實點現金</span><b>{hasCount?money(countedMinor):'—'}</b></article>
      <article><span>取走現金</span><b>{hasRemoval?money(cashRemovedMinor):'—'}</b></article>
      <article className="retained"><span>留櫃至下個 Business Day</span><b>{removalValid?money(retainedCashMinor):'—'}</b></article>
    </section>

    <footer className="dayclose-sticky-footer">
      <div>{hasCount?<><span>差額 {money(difference)}</span>{removalValid?<span>留櫃 {money(retainedCashMinor)}</span>:<span>未確認取走現金</span>}</>:<span>未輸入點算資料</span>}</div>
      <button type="button" className="more-primary" onClick={close}>確認本機日結</button>
    </footer>

    {message?<p role="status" className="fusion-status">{message}</p>:null}
    {completion?<div className="dayclose-success-overlay">
      <section className="dayclose-success-dialog" role="dialog" aria-modal="true" aria-labelledby="dayclose-success-title">
        <div className="dayclose-complete-icon">✓</div>
        <span>DAY CLOSE COMPLETED</span>
        <h3 id="dayclose-success-title">日結成功</h3>
        <p>{completion.businessDate} 已完成日結，而且今日唔會再建立第二個正常日結版本。</p>
        <div className="dayclose-success-grid">
          <article><span>實點</span><b>{money(completion.countedCashMinor)}</b></article>
          <article><span>取走</span><b>{completion.cashRemovedMinor===undefined?'未記錄':money(completion.cashRemovedMinor)}</b></article>
          <article><span>留櫃</span><b>{completion.retainedCashMinor===undefined?'未記錄':money(completion.retainedCashMinor)}</b></article>
          <article><span>差額</span><b>{money(completion.cashDifferenceMinor)}</b></article>
        </div>
        <button type="button" className="more-primary" onClick={()=>setCompletion(null)}>完成</button>
      </section>
    </div>:null}
  </section>;
}

function BackupPanel({onRestore}:{onRestore:()=>void}){
  const [message,setMessage]=useState('');
  const [candidate,setCandidate]=useState<LocalBackup|null>(null);
  const create=()=>{
    const backup=createLocalBackup(snapshotMfkStorage());
    download('mfk-local-backup-'+backup.createdAt+'.json',JSON.stringify(backup,null,2));
    setMessage('本機備份已建立並下載。');
  };
  const choose=async(file:File)=>{
    try{
      const parsed=JSON.parse(await file.text()) as LocalBackup;
      const valid=validateLocalBackup(parsed);
      if(!valid.ok){setCandidate(null);setMessage('備份無效：'+valid.errors.join(' / '));return;}
      setCandidate(parsed);setMessage('備份校驗通過，可以恢復。');
    }catch{setCandidate(null);setMessage('備份檔案無法讀取。')}
  };
  const restore=()=>{
    if(!candidate)return;
    const current=snapshotMfkStorage();
    const next=restoreLocalBackup(current,candidate);
    applyMfkStorageSnapshot(next);
    setMessage('恢復完成，已重新載入本機資料。');
    onRestore();
  };
  return <section className="more-panel">
    <header className="more-section-heading"><div><span>LOCAL BACKUP</span><h2>備份與恢復</h2></div><strong>只處理 MFK 本機資料</strong></header>
    <p className="fusion-note">備份唔經 Cloud。檔案只包含 <code>mfk.*</code> 本機資料，其他 App 資料唔會被寫入。</p>
    <div className="more-tab-row">
      <button type="button" onClick={create}>建立／下載備份</button>
      <label className="fusion-file-button">選擇備份<input type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void choose(file)}}/></label>
      <button type="button" className="more-primary" disabled={!candidate} onClick={restore}>恢復已驗證備份</button>
    </div>
    {message?<p role="status" className="fusion-status">{message}</p>:null}
  </section>;
}

export function LocalMoreWorkspace(){
  const navigate=useNavigate();
  const [section,setSection]=useState<Section>('overview');
  const [revision,setRevision]=useState(0);
  useEffect(()=>localRuntime.subscribe(()=>setRevision(value=>value+1)),[]);
  const bump=()=>setRevision(value=>value+1);
  const titleMap:Record<Section,string>={
    overview:'更多功能總覽',printing:'打印與設備',diagnostics:'顯示與操作／診斷',
    dayclose:'收銀與日結',reports:'報表與分析',backup:'備份與恢復',
    'admin-menu':'Admin 同步狀態'
  };
  return <main className="more-workspace more-card-workspace" aria-label="MFK SMT 本地營運中心">
    <header className="more-card-topbar">
      <button type="button" onClick={()=>section==='overview'?navigate('/'):setSection('overview')}>{section==='overview'?'← 返回點單':'← 更多功能'}</button>
      <div><small>SMT LOCAL OPERATIONS</small><b>{titleMap[section]}</b></div>
      <span>LOCAL-FIRST</span>
    </header>
    <section className="more-workspace-content">
      {section==='overview'?<OverviewPanel onOpen={setSection}/>:null}
      {section==='printing'?<PrinterPanel/>:null}
      {section==='diagnostics'?<DiagnosticsPanel/>:null}
      {section==='dayclose'?<DayClosePanel revision={revision} onSaved={bump}/>:null}
      {section==='reports'?<ReportsPanel revision={revision}/>:null}
      {section==='backup'?<BackupPanel onRestore={()=>window.location.reload()}/>:null}
      {section==='admin-menu'?<LocalAdminMenuWorkspace/>:null}
    </section>
  </main>;
}
