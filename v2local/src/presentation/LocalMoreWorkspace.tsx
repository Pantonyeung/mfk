import {useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import {applyLanPrinter,printTextLan,testLanPrinter,type NativeResult} from '../runtime/native-print.ts';
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
};

export const PRINTER_BINDING_KEY='mfk.v2local.printers.v2';

const defaults:PrinterBinding[]=[
  {id:'receipt-1',routeKey:'logical.receipt',name:'顧客小票打印機',model:'LAN PRINTER',role:'顧客小票',host:'',port:9100,capability:'receipt-80mm/kitchen'},
  {id:'production-1',routeKey:'logical.production',name:'製作單打印機',model:'LAN PRINTER',role:'製作單',host:'',port:9100,capability:'receipt-80mm/kitchen'},
  {id:'packing-1',routeKey:'logical.packing',name:'打包單打印機',model:'LAN PRINTER',role:'打包單',host:'',port:9100,capability:'receipt-80mm/kitchen'},
  {id:'product-label-1',routeKey:'logical.product-label',name:'產品標籤打印機',model:'LAN LABEL PRINTER',role:'產品標籤',host:'',port:9100,capability:'label-58mm'},
  {id:'bag-label-1',routeKey:'logical.bag-label',name:'袋標籤打印機',model:'LAN LABEL PRINTER',role:'袋標籤',host:'',port:9100,capability:'label-58mm'},
];

function migrateStored(value:unknown):PrinterBinding[]{
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
    };
  });
}
function load():PrinterBinding[]{
  try{
    const current=JSON.parse(localStorage.getItem(PRINTER_BINDING_KEY)||'null');
    if(current)return migrateStored(current);
    const legacy=JSON.parse(localStorage.getItem('mfk.v2local.printers.v1')||'null');
    const migrated=migrateStored(legacy);
    localStorage.setItem(PRINTER_BINDING_KEY,JSON.stringify(migrated));
    return migrated;
  }catch{return defaults.map(x=>({...x}))}
}
function save(rows:PrinterBinding[]){localStorage.setItem(PRINTER_BINDING_KEY,JSON.stringify(rows))}
function resultLabel(result:NativeResult|null){return !result?'未測試':result.ok?(result.code||'PASS'):(result.code||'FAIL')}

export function LocalMoreWorkspace(){
  const navigate=useNavigate();
  const [printers,setPrinters]=useState<PrinterBinding[]>(load);
  const [selected,setSelected]=useState('receipt-1');
  const [status,setStatus]=useState<Record<string,NativeResult|null>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const current=useMemo(()=>printers.find(x=>x.id===selected)??printers[0],[printers,selected]);

  const update=(patch:Partial<PrinterBinding>)=>{
    const next=printers.map(p=>p.id===current.id?{...p,...patch}:p);
    setPrinters(next);
    save(next);
  };

  const input=()=>({
    endpointId:current.id,
    host:current.host.trim(),
    port:Number(current.port),
    displayName:current.name,
    model:current.model,
    capability:current.capability,
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
        const title='MFK V2 '+current.role+' TEST';
        const payload=current.capability==='label-58mm'
          ?'SIZE 40 mm,30 mm\r\nGAP 2 mm,0 mm\r\nCLS\r\nTEXT 20,20,"3",0,1,1,"MFK V2 TEST"\r\nTEXT 20,55,"3",0,1,1,"'+current.role+'"\r\nPRINT 1\r\n'
          :'\x1b\x40'+title+'\n'+current.name+'\n'+new Date().toISOString()+'\n\n\n';
        result=await printTextLan({...printer,text:payload});
      }
    }catch(error){result={ok:false,code:error instanceof Error?error.message:'PRINT_ACTION_FAILED'}}
    setStatus(s=>({...s,[current.id]:result}));
    setBusy(null);
  };

  return <main className="more-workspace runtime-more-workspace" aria-label="MFK V2 本地營運中心">
    <aside className="more-workspace-menu">
      <header><span>MFK · V2 LOCAL</span><h1>營運中心</h1></header>
      <button type="button" onClick={()=>navigate('/')}><b>返回點單</b><small>Ordering</small></button>
      <button type="button" className="active"><b>打印與設備</b><small>Physical Printer Binding</small></button>
      <button type="button" onClick={()=>navigate('/orders')}><b>本機訂單</b><small>Local Orders</small></button>
    </aside>
    <section className="more-workspace-content">
      <section className="more-panel">
        <header className="more-section-heading"><div><span>PHYSICAL PRINT ROUTING</span><h2>打印與設備</h2></div><strong>{window.moreFunNative?'Carrier 1.0.6 Bridge 已連接':'Native Bridge 未連接'}</strong></header>
        <p>跟返 1.0.6 打印介面：SMT 只做「邏輯目的地 → 你揀嘅實體 LAN 打印機」綁定。唔使用 T2S 內置打印機。</p>

        <div className="more-tab-row">{printers.map(p=><button key={p.id} type="button" className={p.id===current.id?'active':''} onClick={()=>setSelected(p.id)}>{p.role}</button>)}</div>

        <div className="more-kpis">
          <article><span>Route</span><b>{current.routeKey}</b></article>
          <article><span>實體打印機</span><b>{current.host?current.host+':'+current.port:'未綁定'}</b></article>
          <article><span>結果</span><b>{resultLabel(status[current.id]??null)}</b></article>
        </div>

        <label className="more-field"><span>打印機名稱</span><input value={current.name} onChange={e=>update({name:e.target.value})}/></label>
        <label className="more-field"><span>Printer IP / Host</span><input inputMode="decimal" placeholder="例如 192.168.1.201" value={current.host} onChange={e=>update({host:e.target.value})}/></label>
        <label className="more-field"><span>Port</span><input inputMode="numeric" value={String(current.port)} onChange={e=>update({port:Number(e.target.value)||0})}/></label>

        <div className="more-tab-row">
          <button type="button" disabled={Boolean(busy)} onClick={()=>void run('test')}>{busy==='test'?'測試網絡中…':'① 測試網絡'}</button>
          <button type="button" className="more-primary" disabled={Boolean(busy)} onClick={()=>void run('print')}>{busy==='print'?'試印中…':'② 測試打印'}</button>
          <button type="button" disabled={Boolean(busy)} onClick={()=>void run('save')}>{busy==='save'?'保存中…':'③ 保存綁定'}</button>
        </div>

        {status[current.id]?<p role="status"><b>{status[current.id]?.ok?'PASS':'FAIL'}：</b>{resultLabel(status[current.id]??null)}</p>:null}
        <p><small>每條 Route 只送去目前指定一部實體 Printer；同一部 Printer 可以由你手動填同一 IP，供多個 Route 使用。</small></p>
      </section>
    </section>
  </main>;
}
