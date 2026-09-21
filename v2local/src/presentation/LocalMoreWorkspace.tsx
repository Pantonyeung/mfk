import {useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import {applyLanPrinter,printTextInternal,printTextLan,testInternalPrinter,testLanPrinter,type NativeResult} from '../runtime/native-print.ts';
import './more-workspace.css';

type Printer={
  id:string;name:string;model:string;kind:'internal'|'lan';role:string;host:string;port:number;capability:'receipt-80mm/kitchen'|'label-58mm'
};
const KEY='mfk.v2local.printers.v1';
const defaults:Printer[]=[
  {id:'receipt-1',name:'商米 T2s 內置小票機',model:'SUNMI T2S',kind:'internal',role:'顧客小票',host:'',port:0,capability:'receipt-80mm/kitchen'},
  {id:'kitchen-1',name:'後廚機',model:'XP-N160II',kind:'lan',role:'製作單',host:'',port:9100,capability:'receipt-80mm/kitchen'},
  {id:'packing-1',name:'打包機',model:'XP-N160II',kind:'lan',role:'打包單',host:'',port:9100,capability:'receipt-80mm/kitchen'},
  {id:'label-1',name:'飯團標籤機',model:'T271U',kind:'lan',role:'產品標籤',host:'',port:9100,capability:'label-58mm'}
];
function load():Printer[]{
  try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return Array.isArray(v)?v:defaults.map(x=>({...x}));}
  catch{return defaults.map(x=>({...x}))}
}
function save(rows:Printer[]){localStorage.setItem(KEY,JSON.stringify(rows))}
function code(result:NativeResult|null){return !result?'未測試':result.ok?(result.code||'PASS'):(result.code||'FAIL')}

export function LocalMoreWorkspace(){
  const navigate=useNavigate();
  const [printers,setPrinters]=useState<Printer[]>(load);
  const [selected,setSelected]=useState('receipt-1');
  const [status,setStatus]=useState<Record<string,NativeResult|null>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const current=useMemo(()=>printers.find(x=>x.id===selected)??printers[0],[printers,selected]);
  const update=(patch:Partial<Printer>)=>{
    const next=printers.map(p=>p.id===current.id?{...p,...patch}:p);setPrinters(next);save(next);
  };
  const run=async(kind:'save'|'test'|'print')=>{
    if(!current||busy)return;
    setBusy(kind);let result:NativeResult;
    try{
      if(current.kind==='internal'){
        result=kind==='print'?await printTextInternal('MFK V2 LOCAL\n'+current.name+'\n'+new Date().toISOString()):await testInternalPrinter();
      }else{
        const input={endpointId:current.id,host:current.host.trim(),port:Number(current.port),displayName:current.name,model:current.model,capability:current.capability};
        if(!input.host){result={ok:false,code:'LAN_ENDPOINT_HOST_REQUIRED'};}
        else if(kind==='save')result=await applyLanPrinter(input);
        else if(kind==='test')result=await testLanPrinter(input);
        else result=await printTextLan({...input,text:'\x1b\x40MFK V2 LOCAL PRINT TEST\n'+current.name+'\n'+new Date().toISOString()+'\n\n\n'});
      }
    }catch(error){result={ok:false,code:error instanceof Error?error.message:'PRINT_ACTION_FAILED'}}
    setStatus(s=>({...s,[current.id]:result}));setBusy(null);
  };

  return <main className="more-workspace runtime-more-workspace" aria-label="MFK V2 本地營運中心">
    <aside className="more-workspace-menu">
      <header><span>MFK · V2 LOCAL</span><h1>營運中心</h1></header>
      <button type="button" onClick={()=>navigate('/')}><b>返回點單</b><small>Ordering</small></button>
      <button type="button" className="active"><b>打印與設備</b><small>Native Print</small></button>
      <button type="button" onClick={()=>navigate('/orders')}><b>本機訂單</b><small>Local Orders</small></button>
    </aside>
    <section className="more-workspace-content">
      <section className="more-panel">
        <header className="more-section-heading"><div><span>LOCAL PRINT</span><h2>打印與設備</h2></div><strong>{window.moreFunNative?'Native Bridge 已連接':'Native Bridge 未連接'}</strong></header>
        <p>呢頁直接由主 WebView 呼叫 Carrier 1.0.6 打印橋接，唔經 iframe、Cloud、D1 或 Runtime server。</p>
        <div className="more-tab-row">{printers.map(p=><button key={p.id} type="button" className={p.id===current.id?'active':''} onClick={()=>setSelected(p.id)}>{p.role}</button>)}</div>
        <div className="more-kpis">
          <article><span>設備</span><b>{current.name}</b></article>
          <article><span>連接</span><b>{current.kind==='internal'?'SUNMI INTERNAL':'LAN TCP'}</b></article>
          <article><span>結果</span><b>{code(status[current.id]??null)}</b></article>
        </div>
        <label className="more-field"><span>設備名稱</span><input value={current.name} onChange={e=>update({name:e.target.value})}/></label>
        {current.kind==='lan'?<>
          <label className="more-field"><span>Printer IP</span><input inputMode="decimal" placeholder="192.168.1.201" value={current.host} onChange={e=>update({host:e.target.value})}/></label>
          <label className="more-field"><span>Port</span><input inputMode="numeric" value={String(current.port)} onChange={e=>update({port:Number(e.target.value)||0})}/></label>
        </>:null}
        <div className="more-tab-row">
          <button type="button" disabled={Boolean(busy)} onClick={()=>void run('save')}>{busy==='save'?'處理中…':'儲存／套用'}</button>
          <button type="button" disabled={Boolean(busy)} onClick={()=>void run('test')}>{busy==='test'?'測試中…':'測試連線'}</button>
          <button type="button" className="more-primary" disabled={Boolean(busy)} onClick={()=>void run('print')}>{busy==='print'?'送出中…':'測試出紙'}</button>
        </div>
        {status[current.id]?<p role="status"><b>{status[current.id]?.ok?'PASS':'FAIL'}：</b>{code(status[current.id]??null)}</p>:null}
      </section>
    </section>
  </main>;
}
