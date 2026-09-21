import {useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import {applyLanPrinter,printBytesLan,printTextLan,testLanPrinter,type NativeResult} from '../runtime/native-print.ts';
import {LABEL_TSC_PROFILE,renderTscRasterLabel} from '../runtime/label-bitmap.ts';
import {localRuntime,readLastPrintDiagnostic} from '../runtime/local-runtime.ts';
import {readAdminPricingReadback,type AdminPricingReadback} from '../runtime/admin-link-readback.ts';
import {
  applyMfkStorageSnapshot,
  buildLocalReport,
  createLocalBackup,
  createLocalDayClose,
  readLocalDayCloses,
  restoreLocalBackup,
  snapshotMfkStorage,
  validateLocalBackup,
  writeLocalDayCloses,
  type LocalBackup,
} from '../runtime/local-operations.ts';
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
  productIds?:string[];
};

export const PRINTER_BINDING_KEY='mfk.v2local.printers.v5';
const LEGACY_PRINTER_BINDING_KEYS=['mfk.v2local.printers.v4','mfk.v2local.printers.v3','mfk.v2local.printers.v2'] as const;
const RICEBALL_PRODUCT_IDS=['riceball','tuna','pork'];
const TAKEAWAY_PRODUCT_IDS=['bento','curry','wedges','milkTea','lemonTea'];
const FIXED_PRODUCT_LABEL_IDS=new Set(['product-label-1','product-label-2']);

const defaults:PrinterBinding[]=[
  {id:'receipt-1',routeKey:'logical.receipt',name:'顧客小票打印機',model:'LAN PRINTER',role:'顧客小票',host:'',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  {id:'production-1',routeKey:'logical.production',name:'製作單打印機',model:'LAN PRINTER',role:'製作單',host:'',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  {id:'packing-1',routeKey:'logical.packing',name:'打包單打印機',model:'LAN PRINTER',role:'打包單',host:'',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  {id:'product-label-1',routeKey:'logical.product-label.riceball',name:'飯糰標籤機',model:'LAN LABEL PRINTER',role:'產品標籤',host:'',port:9100,capability:'label-58mm',encoding:'big5',productIds:[...RICEBALL_PRODUCT_IDS]},
  {id:'product-label-2',routeKey:'logical.product-label.takeaway',name:'外賣標籤機',model:'LAN LABEL PRINTER',role:'產品標籤',host:'',port:9100,capability:'label-58mm',encoding:'big5',productIds:[...TAKEAWAY_PRODUCT_IDS]},
  {id:'bag-label-1',routeKey:'logical.bag-label',name:'袋標籤打印機',model:'LAN LABEL PRINTER',role:'袋標籤',host:'',port:9100,capability:'label-58mm',encoding:'big5'},
];

type Section='overview'|'printing'|'diagnostics'|'dayclose'|'reports'|'backup';

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
  const report=buildLocalReport(localRuntime.orders());
  const printers=loadPrinters();
  const online=printers.filter(printer=>printer.host.trim()).length;
  const lastPrint=readLastPrintDiagnostic();
  const cards=[
    {id:'dayclose' as const,no:'01',icon:'▣',title:'收銀與日結',desc:'現金點算、開工底箱、日結確認與本機紀錄'},
    {id:'reports' as const,no:'02',icon:'↗',title:'報表與分析',desc:'營業額、訂單、商品排行與本機報表'},
    {id:'printing' as const,no:'03',icon:'▤',title:'打印與設備',desc:'打印機設定、路由、測試與標籤綁定'},
    {id:'backup' as const,no:'04',icon:'☁',title:'備份與恢復',desc:'本機備份、校驗、恢復與資料安全'},
    {id:'diagnostics' as const,no:'05',icon:'⚙',title:'顯示與操作／診斷',desc:'Printer Trace、Route、錯誤碼與本機健康狀態'},
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
  const [selected,setSelected]=useState('receipt-1');
  const [status,setStatus]=useState<Record<string,NativeResult|null>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const current=useMemo(()=>printers.find(x=>x.id===selected)??printers[0],[printers,selected]);

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
          const bytes=await renderTscRasterLabel({
            orderCode:'MFK TEST',
            primaryText:current.name,
            secondaryText:current.role==='產品標籤'?productLabelPurpose(current):'50×40 · TSC',
            pieceLabel:'1/1',
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
    <p className="fusion-note">每個邏輯用途獨立綁定外置實體 Printer。產品 Label 可以有多條 Route；飯糰同外賣先分開，之後由 Admin 發布商品 → Label Route 設定。</p>
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
  const [adminState,setAdminState]=useState<'loading'|'ready'|'error'>('loading');
  const [adminReadback,setAdminReadback]=useState<AdminPricingReadback|null>(null);
  const [adminError,setAdminError]=useState('');
  const groups=new Map<string,PrinterBinding[]>();
  for(const printer of printers){
    const host=printer.host.trim();
    const key=host?host+':'+printer.port:'UNBOUND:'+printer.id;
    const list=groups.get(key)??[];
    list.push(printer);
    groups.set(key,list);
  }
  const unbound=printers.filter(printer=>!printer.host.trim());

  const refreshAdmin=async()=>{
    setAdminState('loading');setAdminError('');
    try{
      const value=await readAdminPricingReadback();
      setAdminReadback(value);setAdminState('ready');
    }catch(error){
      setAdminState('error');
      setAdminError(error instanceof Error?error.message:'ADMIN_PRICING_READBACK_FAILED');
    }
  };
  useEffect(()=>{void refreshAdmin();},[]);

  return <section className="more-panel">
    <header className="more-section-heading"><div><span>LOCAL DIAGNOSTICS</span><h2>診斷中心</h2></div><strong>{window.moreFunNative?'Carrier Bridge 已連接':'Native Bridge 未連接'}</strong></header>
    <div className="more-kpis">
      <article><span>Printer Routes</span><b>{printers.length}</b></article>
      <article><span>未綁定</span><b>{unbound.length}</b></article>
      <article><span>實體設備</span><b>{[...groups.keys()].filter(key=>!key.startsWith('UNBOUND:')).length}</b></article>
      <article><span>最近打印</span><b>{lastPrint?lastPrint.elapsedMs+' ms':'—'}</b></article>
    </div>

    <section className="fusion-list admin-link-readback">
      <header>
        <b>Admin 發布連線｜第一批只讀</b>
        <span>{adminState==='loading'?'讀取中':adminState==='ready'?'READBACK PASS':'READBACK FAIL'}</span>
      </header>
      {adminState==='ready'&&adminReadback?<>
        <article><span>Store</span><b>{adminReadback.storeId}</b><strong>{adminReadback.currency}</strong></article>
        <article><span>Pricing Revision</span><b>{adminReadback.revision}</b><strong>{adminReadback.productCount} Products</strong></article>
        <article><span>Revision Token</span><b>{adminReadback.revisionToken??'—'}</b><strong>{new Date(adminReadback.generatedAt).toLocaleString('zh-HK')}</strong></article>
        <article><span>Product IDs</span><b>{adminReadback.productIds.slice(0,8).join(', ')||'—'}</b><strong>{adminReadback.productIds.length>8?'+'+(adminReadback.productIds.length-8):'全部顯示'}</strong></article>
      </>:adminState==='error'?<p className="fusion-note">Admin readback 失敗：{adminError}</p>:<p className="fusion-note">正在讀取 Cloudflare 已發布 Pricing projection…</p>}
      <div className="more-tab-row"><button type="button" onClick={()=>void refreshAdmin()} disabled={adminState==='loading'}>{adminState==='loading'?'讀取中…':'重新讀取 Admin'}</button></div>
    </section>

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
    <p className="fusion-note">第一批 Admin integration 只做 Cloudflare 已發布 Pricing readback，暫時唔改 Menu、Cart、Checkout、Modifier、Combo、Print Rule 或 Order Mapping。實機確認 readback 後先開下一批。</p>
  </section>;
}

function ReportsPanel({revision}:{revision:number}){
  void revision;
  const report=buildLocalReport(localRuntime.orders());
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
  const report=buildLocalReport(localRuntime.orders());
  const [opening,setOpening]=useState('0');
  const [mode,setMode]=useState<'total'|'denom'>('denom');
  const [denomEntryMode,setDenomEntryMode]=useState<'count'|'amount'>('amount');
  const [counted,setCounted]=useState('');
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [amounts,setAmounts]=useState<Record<string,string>>({});
  const [note,setNote]=useState('');
  const [message,setMessage]=useState('');
  const closes=readLocalDayCloses();
  const latest=[...closes].filter(x=>x.businessDate===report.businessDate).sort((a,b)=>b.version-a.version)[0];
  const denominations=[1,2,5,10,20,100,500] as const;

  const qtyFor=(value:number)=>Math.max(0,Math.floor(Number(counts[String(value)])||0));
  const denomTotal=denominations.reduce((sum,value)=>sum+value*qtyFor(value),0);
  const countedMinor=mode==='denom'?Math.round(denomTotal*100):Math.round(Number(counted||0)*100);
  const expected=Math.round(Number(opening||0)*100)+report.cashSalesMinor;
  const difference=countedMinor-expected;
  const hasCount=mode==='denom'?denominations.some(value=>qtyFor(value)>0):Boolean(counted);

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

  const close=()=>{
    if(!hasCount){setMessage('請先輸入實點現金。');return;}
    const row=createLocalDayClose({
      orders:localRuntime.orders(),
      openingCashMinor:Math.round(Number(opening||0)*100),
      countedCashMinor:countedMinor,
      existing:closes,
      note:note+(mode==='denom'?'｜面額點算 '+denominations.map(value=>'$'+value+'×'+qtyFor(value)).join('、'):''),
    });
    writeLocalDayCloses([...closes,row]);
    setMessage('日結已保存：V'+row.version+' · 差額 '+money(row.cashDifferenceMinor));
    onSaved();
  };

  return <section className="more-panel dayclose-panel">
    <header className="more-section-heading"><div><span>LOCAL DAY CLOSE</span><h2>收銀與日結</h2></div><strong>{latest?'已日結 V'+latest.version:'今日未日結'}</strong></header>

    <div className="more-kpis">
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
      <label className="more-field"><span>開更現金</span><input inputMode="decimal" value={opening} onChange={e=>setOpening(e.target.value)}/></label>
      {mode==='total'?<label className="more-field"><span>實點現金</span><input inputMode="decimal" value={counted} onChange={e=>setCounted(e.target.value)}/></label>:null}
      <label className="more-field fusion-wide"><span>備註</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：現金差異原因"/></label>
    </div>

    {mode==='denom'?<section className="cash-denomination-shell">
      <header className="cash-denomination-toolbar">
        <div><b>面額點算</b><span>可以輸入張／個數，亦可以直接輸入該面額總金額。</span></div>
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
            <b>{'$'+value}</b>
            {denomEntryMode==='count'
              ?<div className="cash-count-control"><button type="button" onClick={()=>setQty(value,qty-1)}>−</button><input inputMode="numeric" value={qty||''} placeholder="0" onChange={e=>setQty(value,Number(e.target.value))}/><button type="button" onClick={()=>setQty(value,qty+1)}>＋</button></div>
              :<div className="cash-amount-control"><span>$</span><input inputMode="numeric" value={rawAmount} placeholder="0" onChange={e=>setAmount(value,e.target.value)}/></div>}
            <span className={remainder&&denomEntryMode==='amount'?'cash-convert invalid':'cash-convert'}>{qty} {value<10?'個':'張'}{remainder&&denomEntryMode==='amount'?' · 非 $'+value+' 倍數':''}</span>
            <strong>{money(value*qty*100)}</strong>
          </div>;
        })}
        <footer><span>面額合計</span><strong>{money(countedMinor)}</strong></footer>
      </section>
    </section>:null}

    <footer className="dayclose-sticky-footer">
      <div>{hasCount?<><span>實點 {money(countedMinor)}</span><span>差額 {money(difference)}</span></>:<span>未輸入點算資料</span>}</div>
      <button type="button" className="more-primary" onClick={close}>確認本機日結</button>
    </footer>

    {message?<p role="status" className="fusion-status">{message}</p>:null}
    {latest?<section className="fusion-list"><header><b>最近日結</b><span>{latest.id}</span></header><article><span>實點 {money(latest.countedCashMinor)}</span><b>預計 {money(latest.expectedCashMinor)}</b><strong>差額 {money(latest.cashDifferenceMinor)}</strong></article></section>:null}
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
    dayclose:'收銀與日結',reports:'報表與分析',backup:'備份與恢復'
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
    </section>
  </main>;
}
