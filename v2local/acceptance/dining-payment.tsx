import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,useNavigate} from 'react-router';
import {RuntimeDiningWorkspace,type DiningCheckoutRequest} from '../src/presentation/RuntimeDiningWorkspace.tsx';
import {localRuntime,type LocalDiningHoldDetail,type DiningTender} from '../src/runtime/local-runtime.ts';

// Isolated example only. This imports actual runtime settlement, never the production activation shell.
// No Customer/Keeta consumer, outbox flush, printer or cash-drawer method is invoked.
window.fetch=async()=>{throw new Error('DEMO_NETWORK_FORBIDDEN');};
const seedKey='mfk.fixture.dining-r2.seeded';
if(!localStorage.getItem(seedKey)){
  if(localStorage.getItem('mfk.v2local.runtime.v1'))throw new Error('DEMO_REQUIRES_EMPTY_ISOLATED_STORAGE');
  const h=localRuntime.createHold({kind:'dining',items:[{id:'demo-rice',name:'示例飯團',qty:2,unitMinor:4100,serviceMode:'dine-in'}],totalMinor:8200,partySize:4,note:'只供操作示例'});
  void localRuntime.assignDiningTable(h.id,'T01');
  localStorage.setItem(seedKey,'1');
}
(window as any).__diningR2={runtime:localRuntime,request:null};
function Probe({request}:{request:DiningCheckoutRequest|null}){
  const navigate=useNavigate();const [cash,setCash]=useState('100');const [method,setMethod]=useState<DiningTender>('CASH');
  const [result,setResult]=useState<LocalDiningHoldDetail|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  if(!request)return <main className="probe"><button onClick={()=>navigate('/')}>返回桌台</button></main>;
  const amount=request.lines.reduce((sum,line)=>sum+line.qty*line.unitMinor,0);
  const pay=async()=>{
    if(busy)return;setBusy(true);setError('');
    try{setResult(await localRuntime.settleDiningHold(request.holdId,request.selections,method,{submissionId:request.submissionId??'',expectedRevision:request.expectedRevision??'',receivedMinor:method==='CASH'?Math.round(Number(cash)*100):amount}));}
    catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
    finally{setBusy(false);}
  };
  return <main className="probe"><section className="probe-card">
    <small>測試付款交接器 · 唔係完整正式 Checkout</small><h1>分項結帳示例</h1>
    <p>{request.codeLabel} · 本次 {request.lines.reduce((sum,line)=>sum+line.qty,0)} 件 · ${ (amount/100).toFixed(2) }</p>
    <div><button disabled={!!result} aria-pressed={method==='CASH'} onClick={()=>setMethod('CASH')}>現金</button> <button disabled={!!result} aria-pressed={method==='FPS'} onClick={()=>setMethod('FPS')}>轉數快</button></div>
    <label>實收金額<input aria-label="實收金額" disabled={method!=='CASH'||!!result} value={cash} inputMode="decimal" onChange={event=>setCash(event.target.value)}/></label>
    {error?<p role="alert">{error}</p>:null}
    {result?<div className="result" role="status"><h2>{result.archivedAt?'已付清，桌台已釋放':'分項付款已保存'}</h2><p>已付 ${(result.paidMinor/100).toFixed(2)} · 剩餘 ${(result.remainingMinor/100).toFixed(2)} · {result.payments.length} 次付款</p><p>商品及付款紀錄保留；沒有建立正式訂單、打印或開櫃。</p></div>:null}
    <footer><button onClick={()=>navigate('/')}>返回桌台</button><button className="primary" disabled={busy} onClick={()=>void pay()}>{result?'重試同一確認（測試）':'測試付款確認'}</button></footer>
  </section></main>;
}
function App(){
  const [request,setRequest]=useState<DiningCheckoutRequest|null>(null);
  return <><div className="demo-banner">堂食 R2 隔離示例｜只用示例資料，不收真錢、不打印、不開錢箱；正式訂單連接未完成。</div><div className="demo-body"><MemoryRouter><Routes>
    <Route path="/" element={<RuntimeDiningWorkspace runtime={localRuntime} onCheckout={value=>{setRequest(value);(window as any).__diningR2.request=value;}}/>}/>
    <Route path="/checkout" element={<Probe request={request}/>}/>
  </Routes></MemoryRouter></div></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
