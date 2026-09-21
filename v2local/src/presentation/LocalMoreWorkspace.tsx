import {useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import {applyLanPrinter,printTextLan,testLanPrinter,type NativeResult} from '../runtime/native-print.ts';
import {localRuntime} from '../runtime/local-runtime.ts';
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
};

export const PRINTER_BINDING_KEY='mfk.v2local.printers.v3';
const LEGACY_PRINTER_BINDING_KEY='mfk.v2local.printers.v2';

const defaults:PrinterBinding[]=[
  {id:'receipt-1',routeKey:'logical.receipt',name:'顧客小票打印機',model:'LAN PRINTER',role:'顧客小票',host:'',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  {id:'production-1',routeKey:'logical.production',name:'製作單打印機',model:'LAN PRINTER',role:'製作單',host:'',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  {id:'packing-1',routeKey:'logical.packing',name:'打包單打印機',model:'LAN PRINTER',role:'打包單',host:'',port:9100,capability:'receipt-80mm/kitchen',encoding:'gb18030'},
  {id:'product-label-1',routeKey:'logical.product-label',name:'產品標籤打印機',model:'LAN LABEL PRINTER',role:'產品標籤',host:'',port:9100,capability:'label-58mm',encoding:'big5'},
  {id:'bag-label-1',routeKey:'logical.bag-label',name:'袋標籤打印機',model:'LAN LABEL PRINTER',role:'袋標籤',host:'',port:9100,capability:'label-58mm',encoding:'big5'},
];

type Section='printing'|'dayclose'|'reports'|'backup';

function migrateStored(value:unknown,{legacy=false}:{legacy?:boolean}={}):PrinterBinding[]{
  if(!Array.isArray(value))return defaults.map(x=>({...x}));
  const stored=value.filter(x=>x&&typeof x==='object') as Record<string,unknown>[];
  return defaults.map(fallback=>{
    const old=stored.find(x=>String(x.id||'')===fallback.id)
      ??stored.find(x=>String(x.role||'')===fallback.role);
    if(!old)return {...fallback};
    return {
      ...fallback,
      name:typeof old.name==='string'&&old.name.trim()?old.name:fallback.name,
      model:typeof old.model==='string'&&old.model.trim()&&!String(old.model).includes('SUNMI')?String(old.model):fallback.model,
      host:typeof old.host==='string'?old.host:'',
      port:Number.isSafeInteger(Number(old.port))&&Number(old.port)>0?Number(old.port):9100,
      encoding:
        fallback.capability==='label-58mm'
          ? (old.encoding==='utf-8'?'utf-8':legacy?'big5':old.encoding==='big5'?'big5':'big5')
          : (old.encoding==='big5'||old.encoding==='utf-8'?old.encoding:'gb18030'),
    };
  });
}
function loadPrinters():PrinterBinding[]{
  try{
    const current=JSON.parse(localStorage.getItem(PRINTER_BINDING_KEY)||'null');
    if(current)return migrateStored(current);
    const legacy=JSON.parse(localStorage.getItem(LEGACY_PRINTER_BINDING_KEY)||'null');
    if(legacy){
      const migrated=migrateStored(legacy,{legacy:true});
      localStorage.setItem(PRINTER_BINDING_KEY,JSON.stringify(migrated));
      return migrated;
    }
    return defaults.map(x=>({...x}));
  }catch{return defaults.map(x=>({...x}))}
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
        const labelFont=current.encoding==='big5'?'TST24.BF2':current.encoding==='gb18030'?'TSS24.BF2':'3';
        const payload=current.capability==='label-58mm'
          ?'SIZE 40 mm,30 mm\r\nGAP 2 mm,0 mm\r\nDENSITY 8\r\nCLS\r\nTEXT 20,20,"3",0,1,1,"MFK TEST"\r\nTEXT 20,55,"'+labelFont+'",0,1,1,"'+current.role+'"\r\nPRINT 1,1\r\n'
          :'\x1b\x40MFK FUSION '+current.role+' TEST\n'+current.name+'\n'+new Date().toISOString()+'\n\n\n';
        result=await printTextLan({...printer,text:payload});
      }
    }catch(error){result={ok:false,code:error instanceof Error?error.message:'PRINT_ACTION_FAILED'}}
    setStatus(s=>({...s,[current.id]:result}));
    setBusy(null);
  };

  return <section className="more-panel">
    <header className="more-section-heading"><div><span>PHYSICAL PRINT ROUTING</span><h2>打印與設備</h2></div><strong>{window.moreFunNative?'Carrier Bridge 已連接':'Native Bridge 未連接'}</strong></header>
    <p className="fusion-note">每個邏輯用途由你綁定一部外置實體 Printer。系統唔預設 T2S 內置打印機。</p>
    <div className="more-tab-row">{printers.map(p=><button key={p.id} type="button" className={p.id===current.id?'active':''} onClick={()=>setSelected(p.id)}>{p.role}</button>)}</div>
    <div className="more-kpis">
      <article><span>Route</span><b>{current.routeKey}</b></article>
      <article><span>實體打印機</span><b>{current.host?current.host+':'+current.port:'未綁定'}</b></article>
      <article><span>結果</span><b>{resultLabel(status[current.id]??null)}</b></article>
    </div>
    <label className="more-field"><span>打印機名稱</span><input value={current.name} onChange={e=>update({name:e.target.value})}/></label>
    <label className="more-field"><span>Printer IP / Host</span><input inputMode="decimal" placeholder="例如 192.168.1.201" value={current.host} onChange={e=>update({host:e.target.value})}/></label>
    <label className="more-field"><span>Port</span><input inputMode="numeric" value={String(current.port)} onChange={e=>update({port:Number(e.target.value)||0})}/></label>
    <label className="more-field"><span>中文編碼</span><select value={current.encoding} onChange={e=>update({encoding:e.target.value as PrinterBinding['encoding']})}><option value="gb18030">GB18030</option><option value="big5">Big5（標籤預設）</option><option value="utf-8">UTF-8</option></select></label>
    <div className="more-tab-row">
      <button type="button" disabled={Boolean(busy)} onClick={()=>void run('test')}>{busy==='test'?'測試中…':'① 測試連線'}</button>
      <button type="button" className="more-primary" disabled={Boolean(busy)} onClick={()=>void run('print')}>{busy==='print'?'出紙中…':'② 測試出紙'}</button>
      <button type="button" disabled={Boolean(busy)} onClick={()=>void run('save')}>{busy==='save'?'保存中…':'③ 保存綁定'}</button>
    </div>
    {status[current.id]?<p role="status"><b>{status[current.id]?.ok?'PASS':'FAIL'}：</b>{resultLabel(status[current.id]??null)}</p>:null}
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
  const [counted,setCounted]=useState('');
  const [note,setNote]=useState('');
  const [message,setMessage]=useState('');
  const closes=readLocalDayCloses();
  const latest=[...closes].filter(x=>x.businessDate===report.businessDate).sort((a,b)=>b.version-a.version)[0];
  const expected=Math.round(Number(opening||0)*100)+report.cashSalesMinor;
  const countedMinor=Math.round(Number(counted||0)*100);
  const difference=(counted?countedMinor:0)-expected;
  const close=()=>{
    if(!counted){setMessage('請先輸入實點現金。');return;}
    const row=createLocalDayClose({
      orders:localRuntime.orders(),openingCashMinor:Math.round(Number(opening||0)*100),
      countedCashMinor:countedMinor,existing:closes,note,
    });
    writeLocalDayCloses([...closes,row]);
    setMessage('日結已保存：V'+row.version+' · 差額 '+money(row.cashDifferenceMinor));
    onSaved();
  };
  return <section className="more-panel">
    <header className="more-section-heading"><div><span>LOCAL DAY CLOSE</span><h2>收銀與日結</h2></div><strong>{latest?'已日結 V'+latest.version:'今日未日結'}</strong></header>
    <div className="more-kpis">
      <article><span>今日現金銷售</span><b>{money(report.cashSalesMinor)}</b></article>
      <article><span>預計櫃桶</span><b>{money(expected)}</b></article>
      <article><span>目前差額</span><b>{counted?money(difference):'—'}</b></article>
    </div>
    <div className="fusion-form-grid">
      <label className="more-field"><span>開更現金</span><input inputMode="decimal" value={opening} onChange={e=>setOpening(e.target.value)}/></label>
      <label className="more-field"><span>實點現金</span><input inputMode="decimal" value={counted} onChange={e=>setCounted(e.target.value)}/></label>
      <label className="more-field fusion-wide"><span>備註</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：現金差異原因"/></label>
    </div>
    <div className="more-tab-row"><button type="button" className="more-primary" onClick={close}>確認本機日結</button></div>
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
  const [section,setSection]=useState<Section>('printing');
  const [revision,setRevision]=useState(0);
  useEffect(()=>localRuntime.subscribe(()=>setRevision(value=>value+1)),[]);
  const bump=()=>setRevision(value=>value+1);
  return <main className="more-workspace runtime-more-workspace" aria-label="MFK SMT Fusion 本地營運中心">
    <aside className="more-workspace-menu">
      <header><span>MFK · SMT FUSION</span><h1>營運中心</h1></header>
      <button type="button" onClick={()=>navigate('/')}><b>返回點單</b><small>MoreFun V2 Ordering</small></button>
      <button type="button" className={section==='printing'?'active':''} onClick={()=>setSection('printing')}><b>打印與設備</b><small>External Printer Registry</small></button>
      <button type="button" className={section==='dayclose'?'active':''} onClick={()=>setSection('dayclose')}><b>收銀與日結</b><small>Local Day Close</small></button>
      <button type="button" className={section==='reports'?'active':''} onClick={()=>setSection('reports')}><b>報表與分析</b><small>Local Report</small></button>
      <button type="button" className={section==='backup'?'active':''} onClick={()=>setSection('backup')}><b>備份與恢復</b><small>Local Backup</small></button>
      <button type="button" onClick={()=>navigate('/orders')}><b>本機訂單</b><small>Local Orders</small></button>
    </aside>
    <section className="more-workspace-content">
      {section==='printing'?<PrinterPanel/>:null}
      {section==='dayclose'?<DayClosePanel revision={revision} onSaved={bump}/>:null}
      {section==='reports'?<ReportsPanel revision={revision}/>:null}
      {section==='backup'?<BackupPanel onRestore={()=>window.location.reload()}/>:null}
    </section>
  </main>;
}
