import {useCallback,useEffect,useState} from 'react';
import type {CleanSmtCoreRuntimePort,SmtDiningProjection} from '../runtime/local-runtime.ts';
import './dining-operations-workspace.css';

export function RuntimeDiningWorkspace({runtime}:{runtime:CleanSmtCoreRuntimePort}){
  const [view,setView]=useState<SmtDiningProjection|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [showAdd,setShowAdd]=useState(false);
  const [partySize,setPartySize]=useState(2);
  const [note,setNote]=useState('');
  const [selectedWait,setSelectedWait]=useState<string|null>(null);
  const [message,setMessage]=useState('');

  const load=useCallback(async()=>{
    if(!runtime.readDining){setError('DINE_IN_PROVIDER_UNAVAILABLE');return;}
    setBusy(true);setError(null);
    try{setView(await runtime.readDining());}
    catch{setError('DINE_IN_READ_FAILED');}
    finally{setBusy(false);}
  },[runtime]);

  useEffect(()=>{void load();return runtime.subscribe(()=>void load());},[load,runtime]);

  const addWait=async()=>{
    if(!runtime.createDiningWait)return;
    try{
      await runtime.createDiningWait({partySize,note});
      setNote('');setPartySize(2);setShowAdd(false);setMessage('已加入輪候。');
      await load();
    }catch(cause){setMessage(cause instanceof Error?cause.message:'加入輪候失敗');}
  };

  const assign=async(tableId:string)=>{
    if(!selectedWait||!runtime.assignDiningTable)return;
    try{
      await runtime.assignDiningTable(selectedWait,tableId);
      setMessage('已安排到 '+tableId.replace('T','')+' 號枱。');
      setSelectedWait(null);
      await load();
    }catch(cause){setMessage(cause instanceof Error?cause.message:'安排座位失敗');}
  };

  const remove=async(id:string)=>{
    if(!runtime.removeDiningWait)return;
    try{await runtime.removeDiningWait(id);if(selectedWait===id)setSelectedWait(null);await load();}
    catch(cause){setMessage(cause instanceof Error?cause.message:'移除輪候失敗');}
  };

  return <main className="dining-operations-workspace runtime-dining-workspace" aria-label="堂食／輪候工作台">
    <aside className="dining-wait-column">
      <header><div><small>QUEUE · LOCAL</small><h2>輪候／叫號</h2></div><span>{view?.queue.length??0}</span></header>
      <button className="dining-add-wait" type="button" onClick={()=>setShowAdd(value=>!value)}>＋ 加入輪候</button>
      {showAdd?<section className="dining-wait-form">
        <label><span>人數</span><div><button onClick={()=>setPartySize(Math.max(1,partySize-1))}>−</button><b>{partySize}</b><button onClick={()=>setPartySize(partySize+1)}>＋</button></div></label>
        <label><span>備註</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="例如：等 10 分鐘"/></label>
        <button className="primary" onClick={()=>void addWait()}>確認加入</button>
      </section>:null}
      <div className="dining-wait-list">{view?.queue.map(row=><article key={row.id} className={selectedWait===row.id?'selected':''}>
        <button type="button" onClick={()=>setSelectedWait(row.id)}><strong>{row.codeLabel}</strong><span>{row.partySize} 位</span><small>{row.statusLabel}</small></button>
        <button type="button" className="remove" onClick={()=>void remove(row.id)}>×</button>
      </article>)}</div>
      <p className="dining-hint">先揀輪候客，再撳右邊空枱，就會安排入座。</p>
    </aside>

    <section className="dining-floor-board">
      <header><div><small>堂食營運 · {view?.businessDate??'—'}</small><h1>九宮格堂食</h1></div><span>{view?'已同步':'讀取中'}</span></header>
      {error?<p className="dining-notice" role="alert">{error}</p>:null}
      {busy&&!view?<p>讀取堂食資料中…</p>:null}
      <div className="dining-nine-grid">{view?.tables.map(table=><button key={table.id} type="button" className={'dining-table '+table.state} disabled={table.state!=='available'||!selectedWait} onClick={()=>void assign(table.id)}>
        <strong>{table.label}</strong>
        <span>{table.state==='available'?'空枱':(table.partySize?table.partySize+' 位':'使用中')}</span>
        <small>{table.outstandingLabel??(selectedWait&&table.state==='available'?'按此安排':'')}</small>
      </button>)}</div>
      {message?<p className="dining-message">{message}</p>:null}
    </section>

    <aside className="dining-side-info">
      <section><h3>目前模式</h3><p>堂食枱位固定 9 張，唔再分 A 區／B 區。</p></section>
      <section><h3>暫存來源</h3><p>點單頁「暫存」選擇掛入堂食後，會直接出現喺輪候列表。</p></section>
      <section><h3>安排規則</h3><p>輪候／暫存本身唔建立正式 Order；安排座位只改本機 Hold 狀態。</p></section>
    </aside>
  </main>;
}
