import {useCallback,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import type {
  CleanSmtCoreRuntimePort,
  LocalDiningHoldDetail,
  SmtDiningProjection
} from '../runtime/local-runtime.ts';
import './dining-operations-workspace.css';

const tenderLabels:Record<string,string>={
  CASH:'現金',
  ALIPAY:'Alipay',
  WECHAT:'WeChat Pay',
  FPS:'轉數快',
  PAYME:'PayMe',
  COMBO:'組合付款',
};
const money=(minor:number)=>'$'+(minor/100).toFixed(2);

export interface DiningCheckoutRequest{
  readonly holdId:string;
  readonly codeLabel:string;
  readonly tableLabel:string;
  readonly selections:readonly {lineIndex:number;qty:number}[];
  readonly lines:readonly {lineIndex:number;id:string;name:string;qty:number;unitMinor:number}[];
}
export function RuntimeDiningWorkspace({runtime,onCheckout}:{runtime:CleanSmtCoreRuntimePort;onCheckout:(request:DiningCheckoutRequest)=>void}){
  const navigate=useNavigate();
  const [view,setView]=useState<SmtDiningProjection|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [showAdd,setShowAdd]=useState(false);
  const [partySize,setPartySize]=useState(2);
  const [note,setNote]=useState('');
  const [selectedWait,setSelectedWait]=useState<string|null>(null);
  const [selectedHoldId,setSelectedHoldId]=useState<string|null>(null);
  const [detail,setDetail]=useState<LocalDiningHoldDetail|null>(null);
  const [selection,setSelection]=useState<Record<number,number>>({});
  const [message,setMessage]=useState('');
  const [now,setNow]=useState(Date.now());

  const load=useCallback(async()=>{
    if(!runtime.readDining){setError('DINE_IN_PROVIDER_UNAVAILABLE');return;}
    setBusy(true);setError(null);
    try{setView(await runtime.readDining());}
    catch{setError('DINE_IN_READ_FAILED');}
    finally{setBusy(false);}
  },[runtime]);

  const loadDetail=useCallback(async(holdId:string)=>{
    if(!runtime.readDiningHold)return;
    try{
      const next=await runtime.readDiningHold(holdId);
      setSelectedHoldId(holdId);
      setDetail(next);
      setSelection({});
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'堂食詳情讀取失敗');
    }
  },[runtime]);

  useEffect(()=>{void load();return runtime.subscribe(()=>void load());},[load,runtime]);
  useEffect(()=>{
    const id=window.setInterval(()=>setNow(Date.now()),30000);
    return()=>window.clearInterval(id);
  },[]);
  useEffect(()=>{
    if(selectedHoldId)void loadDetail(selectedHoldId);
  },[view?.revision,selectedHoldId,loadDetail]);

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
      const tableLabel=view?.tables.find(table=>table.id===tableId)?.label??tableId;
      setMessage('已安排到 '+tableLabel+'。');
      setSelectedWait(null);
      setSelectedHoldId(selectedWait);
      await load();
      await loadDetail(selectedWait);
    }catch(cause){setMessage(cause instanceof Error?cause.message:'安排座位失敗');}
  };

  const remove=async(id:string)=>{
    if(!runtime.removeDiningWait)return;
    try{
      await runtime.removeDiningWait(id);
      if(selectedWait===id)setSelectedWait(null);
      if(selectedHoldId===id){setSelectedHoldId(null);setDetail(null);}
      await load();
    }catch(cause){setMessage(cause instanceof Error?cause.message:'移除輪候失敗');}
  };

  const unassign=async()=>{
    if(!detail||!runtime.unassignDiningTable)return;
    try{
      await runtime.unassignDiningTable(detail.holdId);
      setMessage('已取消掛枱，退回輪候。');
      setSelectedWait(detail.holdId);
      setSelectedHoldId(null);
      setDetail(null);
      await load();
    }catch(cause){setMessage(cause instanceof Error?cause.message:'取消掛枱失敗');}
  };

  const clearTable=async()=>{
    if(!detail||!runtime.clearDiningHold)return;
    try{
      await runtime.clearDiningHold(detail.holdId);
      setMessage('已完成結帳並清枱。');
      setSelectedHoldId(null);setDetail(null);setSelection({});
      await load();
    }catch(cause){setMessage(cause instanceof Error?cause.message:'清枱失敗');}
  };

  const selectedAmount=useMemo(()=>{
    if(!detail)return 0;
    return detail.lines.reduce((sum,line)=>sum+(selection[line.lineIndex]??0)*line.unitMinor,0);
  },[detail,selection]);

  const selectedUnits=useMemo(()=>Object.values(selection).reduce((sum,qty)=>sum+(Number(qty)||0),0),[selection]);

  const adjustSelection=(lineIndex:number,delta:number)=>{
    if(!detail)return;
    const line=detail.lines.find(item=>item.lineIndex===lineIndex);if(!line)return;
    setSelection(current=>{
      const next=Math.max(0,Math.min(line.remainingQty,(current[lineIndex]??0)+delta));
      return {...current,[lineIndex]:next};
    });
  };

  const selectAllRemaining=()=>{
    if(!detail)return;
    const next:Record<number,number>={};
    for(const line of detail.lines)next[line.lineIndex]=line.remainingQty;
    setSelection(next);
  };

  const goCheckout=()=>{
    if(!detail||selectedUnits<=0)return;
    const selections=Object.entries(selection)
      .map(([lineIndex,qty])=>({lineIndex:Number(lineIndex),qty:Number(qty)}))
      .filter(item=>item.qty>0);
    const lines=selections.map(selected=>{
      const line=detail.lines.find(item=>item.lineIndex===selected.lineIndex);
      if(!line)throw new Error('DINING_LINE_NOT_FOUND');
      return {
        lineIndex:line.lineIndex,
        id:line.id,
        name:line.name,
        qty:selected.qty,
        unitMinor:line.unitMinor,
      };
    });
    onCheckout({
      holdId:detail.holdId,
      codeLabel:detail.codeLabel,
      tableLabel:detail.assignedTable?(view?.tables.find(table=>table.id===detail.assignedTable)?.label??detail.assignedTable):'',
      selections,
      lines,
    });
    navigate('/checkout');
  };

  const tableElapsed=(startedAt?:string)=>{
    if(!startedAt)return 0;
    return Math.max(0,Math.floor((now-new Date(startedAt).getTime())/60000));
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
        <button type="button" onClick={()=>setSelectedWait(current=>current===row.id?null:row.id)}><strong>{row.codeLabel}</strong><span>{row.partySize} 位</span><small>{row.statusLabel}</small></button>
        <button type="button" className="remove" onClick={()=>void remove(row.id)}>×</button>
      </article>)}</div>
      <p className="dining-hint">{selectedWait?'已揀輪候單；撳中間任何空枱即可安排。':'撳輪候單可以選擇／取消選擇。'}</p>
    </aside>

    <section className="dining-floor-board">
      <header><div><small>堂食營運 · {view?.businessDate??'—'}</small><h1>九宮格堂食</h1></div><span>{view?'已同步':'讀取中'}</span></header>
      {error?<p className="dining-notice" role="alert">{error}</p>:null}
      {busy&&!view?<p>讀取堂食資料中…</p>:null}
      <div className="dining-nine-grid">{view?.tables.map(table=>{
        const elapsed=tableElapsed(table.startedAt);
        const overdue=Math.max(0,elapsed-35);
        const urgent=table.state!=='settled'&&table.state!=='available'&&elapsed>=35;
        const selected=Boolean(table.holdId&&table.holdId===selectedHoldId);
        return <button key={table.id} type="button"
          className={'dining-table '+table.state+(urgent?' overdue':'')+(selected?' selected':'')}
          onClick={()=>{
            if(table.state==='available'){if(selectedWait)void assign(table.id);return;}
            if(table.holdId)void loadDetail(table.holdId);
          }}>
          <div className="dining-table-top"><strong>{table.label}</strong><em>{table.state==='settled'?'已結帳':table.state==='available'?'空枱':(table.partySize??0)+' 位'}</em></div>
          {table.state!=='available'?<>
            <b>{table.outstandingLabel}</b>
            <span className="dining-table-items">{table.itemSummary||'未有商品內容'}{table.itemCount?(' · '+table.itemCount+' 件'):''}</span>
            <span className={urgent?'dining-table-time overdue':'dining-table-time'}>
              用餐 {elapsed} 分鐘 · {overdue>0?'超時 '+overdue+' 分鐘':'剩餘 '+Math.max(0,35-elapsed)+' 分鐘'}
            </span>
            <div className="dining-table-money"><small>已付 {money(table.paidMinor??0)}</small><strong>未付 {money(table.remainingMinor??0)}</strong></div>
          </>:<small>{selectedWait?'撳此安排':'空枱'}</small>}
        </button>;
      })}</div>
      {message?<p className="dining-message">{message}</p>:null}
    </section>

    <aside className="dining-detail-panel">
      {detail?<>
        <header>
          <div><small>{detail.codeLabel}</small><h2>{detail.assignedTable?(view?.tables.find(table=>table.id===detail.assignedTable)?.label??detail.assignedTable):'未掛枱'}</h2></div>
          <span>{detail.partySize} 位</span>
        </header>
        <div className="dining-detail-timer">
          <span>用餐時間</span>
          <b>{tableElapsed(detail.createdAt)} 分鐘</b>
          <small>{tableElapsed(detail.createdAt)>=35?'已超時 '+(tableElapsed(detail.createdAt)-35)+' 分鐘':'距離 35 分鐘仲有 '+(35-tableElapsed(detail.createdAt))+' 分鐘'}</small>
        </div>

        <section className="dining-detail-lines">
          <header><b>商品／分項結帳</b><button type="button" onClick={selectAllRemaining}>全選未結</button></header>
          {detail.lines.map(line=><article key={line.lineIndex} className={line.remainingQty===0?'paid':''}>
            <div className="dining-line-copy"><b>{line.name}</b><small>{money(line.unitMinor)} × {line.qty}</small><span>已結 {line.paidQty} · 未結 {line.remainingQty}</span></div>
            <div className="dining-line-selector">
              <button type="button" disabled={(selection[line.lineIndex]??0)<=0} onClick={()=>adjustSelection(line.lineIndex,-1)}>−</button>
              <b>{selection[line.lineIndex]??0}</b>
              <button type="button" disabled={(selection[line.lineIndex]??0)>=line.remainingQty} onClick={()=>adjustSelection(line.lineIndex,1)}>＋</button>
            </div>
          </article>)}
        </section>

        <section className="dining-payment-panel checkout-authority">
          <header><div><b>本次結帳選擇</b><small>付款只可以喺 Checkout 介面完成</small></div><strong>{money(selectedAmount)}</strong></header>
          <button className="dining-settle-button" disabled={selectedUnits<=0||detail.remainingMinor<=0} onClick={goCheckout}>前往 Checkout · {selectedUnits} 件</button>
        </section>

        <section className="dining-balance">
          <div><span>原總額</span><b>{money(detail.totalMinor)}</b></div>
          <div><span>已結帳</span><b>{money(detail.paidMinor)}</b></div>
          <div className="remaining"><span>未結帳</span><strong>{money(detail.remainingMinor)}</strong></div>
        </section>

        <section className="dining-payment-history">
          <header><b>付款紀錄</b><span>{detail.payments.length}</span></header>
          {detail.payments.length?detail.payments.map(payment=><div key={payment.id}><span>{tenderLabels[payment.tender]??payment.tender}</span><b>{money(payment.amountMinor)}</b><small>{new Date(payment.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</small></div>):<p>未有付款紀錄。</p>}
        </section>

        <footer className="dining-detail-actions">
          <button type="button" className="unassign" disabled={detail.remainingMinor===0} onClick={()=>void unassign()}>取消掛枱／退回輪候</button>
          <button type="button" className="clear" disabled={detail.remainingMinor>0} onClick={()=>void clearTable()}>清枱</button>
        </footer>
      </>:<div className="dining-detail-empty">
        <b>枱號詳情</b>
        <p>撳中間已使用嘅枱，就會睇到商品、用餐時間、已結／未結同分項付款。</p>
      </div>}
    </aside>
  </main>;
}
