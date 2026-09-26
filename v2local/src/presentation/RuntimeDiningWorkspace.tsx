import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {hasStaffPermission,readActiveStaffSession} from '../runtime/staff-auth.ts';
import {useNavigate} from 'react-router';
import type {CleanSmtCoreRuntimePort,LocalDiningHoldDetail,SmtDiningProjection} from '../runtime/local-runtime.ts';
import './dining-operations-workspace.css';
import './dining-interaction-r1.css';

const tenderLabels:Record<string,string>={CASH:'現金',ALIPAY:'Alipay',WECHAT:'WeChat Pay',FPS:'轉數快',PAYME:'PayMe',COMBO:'組合付款'};
const money=(minor:number)=>'$'+(minor/100).toFixed(2);
const tableName=(id?:string)=>!id?'外面輪候':id==='T09'?'戶外桌':Number(id.replace(/^T/,''))+' 號枱';
type DiningLine=LocalDiningHoldDetail['lines'][number];
const sameLine=(a:DiningLine|undefined,b:DiningLine|undefined)=>Boolean(a&&b&&a.id===b.id&&a.name===b.name&&a.unitMinor===b.unitMinor);

function retainSelection(current:Record<number,number>,previous:LocalDiningHoldDetail|null,next:LocalDiningHoldDetail){
  if(previous?.holdId!==next.holdId)return {};
  const result:Record<number,number>={};
  for(const [rawIndex,quantity] of Object.entries(current)){
    const index=Number(rawIndex);
    const before=previous.lines.find(line=>line.lineIndex===index);
    const after=next.lines.find(line=>line.lineIndex===index);
    if(!sameLine(before,after)||!after)continue;
    const qty=Math.min(Math.max(0,Math.floor(quantity)),Math.max(0,after.remainingQty));
    if(qty>0)result[index]=qty;
  }
  return result;
}

// DINING_CHECKOUT_HANDOFF_R2
export interface DiningCheckoutRequest{
  readonly submissionId?:string;
  readonly expectedRevision?:string;
  readonly holdId:string;
  readonly codeLabel:string;
  readonly tableLabel:string;
  readonly selections:readonly {lineIndex:number;qty:number}[];
  readonly lines:readonly {lineIndex:number;id:string;name:string;qty:number;unitMinor:number}[];
}

export function RuntimeDiningWorkspace({runtime,onCheckout,warningMinutes}:{
  runtime:CleanSmtCoreRuntimePort;
  onCheckout:(request:DiningCheckoutRequest)=>void;
  /** Only an explicit published dining rule; never infer from preparation or arrival timers. */
  warningMinutes?:number;
}){
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
  const [detailLoading,setDetailLoading]=useState(false);
  const [selection,setSelection]=useState<Record<number,number>>({});
  const [message,setMessage]=useState('');
  const [historyRows,setHistoryRows]=useState<readonly LocalDiningHoldDetail[]>([]);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [now,setNow]=useState(Date.now());
  const [actionBusy,setActionBusy]=useState(false);
  const [checkoutBusy,setCheckoutBusy]=useState(false);
  const [reprintOpen,setReprintOpen]=useState(false);
  const [reprintOptions,setReprintOptions]=useState<readonly {jobId:string;role:string;label:string;detail?:string;printerName?:string}[]>([]);
  const [selectedReprintJobs,setSelectedReprintJobs]=useState<Set<string>>(new Set());
  const [priceOverrideLine,setPriceOverrideLine]=useState<number|null>(null);
  const [priceOverrideValue,setPriceOverrideValue]=useState('');
  const [priceOverrideReason,setPriceOverrideReason]=useState('');
  const canOverridePrice=Boolean(readActiveStaffSession())&&hasStaffPermission('PRICE_OVERRIDE');
  const alive=useRef(true);
  const activeHold=useRef<string|null>(null);
  const currentDetail=useRef<LocalDiningHoldDetail|null>(null);
  const boardRead=useRef(0);
  const detailRead=useRef(0);
  const actionLock=useRef(false);
  const checkoutLock=useRef(false);
  const warning=typeof warningMinutes==='number'&&Number.isFinite(warningMinutes)&&warningMinutes>0?warningMinutes:undefined;

  const applyDetail=useCallback((next:LocalDiningHoldDetail)=>{
    const previous=currentDetail.current;
    currentDetail.current=next;
    setDetail(next);
    setSelection(current=>retainSelection(current,previous,next));
  },[]);

  const load=useCallback(async()=>{
    if(!runtime.readDining){setError('未有堂食資料接口。');return;}
    const request=++boardRead.current;
    setBusy(true);
    try{
      const next=await runtime.readDining();
      const past=await runtime.readDiningHistory?.()??[];
      if(!alive.current||request!==boardRead.current)return;
      setView(next);setHistoryRows(past);setError(null);
    }catch{if(alive.current&&request===boardRead.current)setError('未能更新堂食資料，請稍後再試。');}
    finally{if(alive.current&&request===boardRead.current)setBusy(false);}
  },[runtime]);

  const loadDetail=useCallback(async(holdId:string)=>{
    if(!runtime.readDiningHold)return;
    const request=++detailRead.current;
    setDetailLoading(true);
    try{
      const next=await runtime.readDiningHold(holdId);
      if(!alive.current||request!==detailRead.current||activeHold.current!==holdId)return;
      applyDetail(next);
    }catch{
      if(alive.current&&request===detailRead.current&&activeHold.current===holdId){
        currentDetail.current=null;setDetail(null);setSelection({});
        setMessage('未能讀取所選堂食單，請重新選擇。');
      }
    }finally{if(alive.current&&request===detailRead.current)setDetailLoading(false);}
  },[runtime,applyDetail]);

  useEffect(()=>{
    alive.current=true;
    void load();
    const unsubscribe=runtime.subscribe(()=>{
      void load();
      if(activeHold.current)void loadDetail(activeHold.current);
    });
    const timer=window.setInterval(()=>setNow(Date.now()),30000);
    return()=>{alive.current=false;boardRead.current+=1;detailRead.current+=1;unsubscribe();window.clearInterval(timer);};
  },[runtime,load,loadDetail]);

  const clearSelection=()=>{
    activeHold.current=null;currentDetail.current=null;detailRead.current+=1;
    setSelectedHoldId(null);setSelectedWait(null);setDetail(null);setSelection({});setDetailLoading(false);
  };
  const openHold=(holdId:string,isWaiting=false)=>{
    if(actionLock.current||checkoutLock.current)return;
    if(activeHold.current!==holdId){
      activeHold.current=holdId;currentDetail.current=null;
      setDetail(null);setSelection({});
    }
    setHistoryOpen(false);setSelectedHoldId(holdId);setSelectedWait(isWaiting?holdId:null);setMessage('');
    void loadDetail(holdId);
  };
  const command=async(operation:()=>Promise<void>)=>{
    if(actionLock.current||checkoutLock.current)return;
    actionLock.current=true;setActionBusy(true);setMessage('');
    try{await operation();}
    catch(cause){if(alive.current)setMessage(cause instanceof Error?cause.message:'未能完成操作。');}
    finally{actionLock.current=false;if(alive.current)setActionBusy(false);}
  };
  const addWait=()=>command(async()=>{
    if(!runtime.createDiningWait)throw new Error('未有輪候建立接口。');
    await runtime.createDiningWait({partySize,note:note.trim()});
    setNote('');setPartySize(2);setShowAdd(false);setMessage('已加入輪候。');await load();
  });
  const assign=(tableId:string)=>command(async()=>{
    const holdId=selectedWait;
    if(!holdId||!runtime.assignDiningTable)return;
    await runtime.assignDiningTable(holdId,tableId);
    setSelectedWait(null);activeHold.current=holdId;setSelectedHoldId(holdId);
    setMessage('已安排到'+(view?.tables.find(table=>table.id===tableId)?.label??tableName(tableId))+'，沿用原本堂食單。');
    await load();await loadDetail(holdId);
  });
  const remove=(holdId:string)=>command(async()=>{
    if(!runtime.readDiningHold||!runtime.removeDiningWait)throw new Error('未有輪候移除接口。');
    const latest=await runtime.readDiningHold(holdId);
    if(latest.assignedTable||latest.lines.length>0||latest.payments.length>0){
      setMessage('此輪候單已有商品、付款或桌台，不能直接移除。請先核對原單。');return;
    }
    if(!window.confirm('確定移除 '+latest.codeLabel+' 呢張空白輪候單？'))return;
    await runtime.removeDiningWait(holdId);
    if(activeHold.current===holdId)clearSelection();
    await load();setMessage('已移除空白輪候單。');
  });
  const unassign=()=>command(async()=>{
    const holdId=activeHold.current;
    if(!holdId||!runtime.unassignDiningTable)return;
    await runtime.unassignDiningTable(holdId);
    setSelectedWait(holdId);setMessage('已退回輪候，保留原單及付款紀錄。');
    await load();await loadDetail(holdId);
  });
  // Preserve the existing manual action until core archive/release can retain payment history safely.
  const clearTable=()=>command(async()=>{
    const holdId=activeHold.current;
    if(!holdId||!runtime.clearDiningHold)return;
    await runtime.clearDiningHold(holdId);clearSelection();await load();setMessage('已清枱。');
  });

  const displayTableName=(id?:string)=>!id?'外面輪候':view?.tables.find(table=>table.id===id)?.label??tableName(id);
  const selectedAmount=useMemo(()=>detail?.lines.reduce((sum,line)=>sum+(selection[line.lineIndex]??0)*line.unitMinor,0)??0,[detail,selection]);
  const selectedUnits=useMemo(()=>Object.values(selection).reduce((sum,qty)=>sum+qty,0),[selection]);
  const adjustSelection=(lineIndex:number,delta:number)=>{
    if(checkoutLock.current||actionLock.current||!detail)return;
    const line=detail.lines.find(item=>item.lineIndex===lineIndex);if(!line)return;
    setSelection(current=>({...current,[lineIndex]:Math.max(0,Math.min(line.remainingQty,(current[lineIndex]??0)+delta))}));
  };
  const selectAllRemaining=()=>{
    if(checkoutLock.current||actionLock.current||!detail)return;
    setSelection(Object.fromEntries(detail.lines.filter(line=>line.remainingQty>0).map(line=>[line.lineIndex,line.remainingQty])));
  };
  const openPriceOverride=(lineIndex:number,currentMinor:number)=>{
    if(!canOverridePrice){setMessage('此登入員工未獲 Admin 授權改價。');return;}
    setPriceOverrideLine(lineIndex);setPriceOverrideValue((currentMinor/100).toFixed(2));setPriceOverrideReason('');
  };
  const submitPriceOverride=()=>command(async()=>{
    const holdId=activeHold.current;
    if(!holdId||priceOverrideLine===null||!runtime.overrideDiningLinePrice)throw new Error('未有人工改價接口。');
    const raw=priceOverrideValue.trim().replace(/^\$/,'');
    if(!/^-?\d+(?:\.\d{1,2})?$/.test(raw))throw new Error('成交價格式不正確。');
    const effectiveMinor=Math.round(Number(raw)*100);
    if(!Number.isSafeInteger(effectiveMinor))throw new Error('成交價超出可處理範圍。');
    const next=await runtime.overrideDiningLinePrice(holdId,priceOverrideLine,effectiveMinor,priceOverrideReason);
    applyDetail(next);setPriceOverrideLine(null);setPriceOverrideValue('');setPriceOverrideReason('');
    setMessage('人工成交價已保存；原價及操作員紀錄已保留。');
    await load();
  });
  const reprintPaymentReceipt=(submissionId?:string)=>command(async()=>{
    const holdId=activeHold.current;
    if(!holdId||!submissionId||!runtime.reprintDiningPaymentReceipt)throw new Error('未有付款收據重印接口。');
    const result=await runtime.reprintDiningPaymentReceipt(holdId,submissionId);
    setMessage(result.failed===0?'付款收據已重印；錢箱不會再次開啟。':'付款收據重印失敗，請檢查打印機。');
  });
  const openReprint=()=>command(async()=>{
    const holdId=activeHold.current;
    if(!holdId||!runtime.readDiningReprintOptions)throw new Error('未有堂食重印接口。');
    const options=await runtime.readDiningReprintOptions(holdId);
    setReprintOptions(options);
    setSelectedReprintJobs(new Set());
    setReprintOpen(true);
  });
  const toggleReprint=(jobId:string)=>setSelectedReprintJobs(current=>{
    const next=new Set(current);if(next.has(jobId))next.delete(jobId);else next.add(jobId);return next;
  });
  const runReprint=()=>command(async()=>{
    const holdId=activeHold.current;
    if(!holdId||!runtime.reprintDiningJobs)throw new Error('未有堂食重印接口。');
    if(!selectedReprintJobs.size)throw new Error('請先選擇要重印嘅票。');
    const result=await runtime.reprintDiningJobs(holdId,[...selectedReprintJobs],'DINING_MANUAL_REPRINT');
    setReprintOpen(false);
    setMessage(result.failed===0?'堂食重印已送出 '+result.sent+'/'+result.planned:'堂食重印部分失敗 '+result.sent+'/'+result.planned);
  });
  const goCheckout=async()=>{
    const before=currentDetail.current;
    if(!before||selectedUnits<=0||checkoutLock.current||actionLock.current||!runtime.readDiningHold)return;
    checkoutLock.current=true;setCheckoutBusy(true);setMessage('');
    const holdId=before.holdId;
    const selections=Object.entries(selection).map(([lineIndex,qty])=>({lineIndex:Number(lineIndex),qty})).filter(item=>item.qty>0);
    try{
      const latest=await runtime.readDiningHold(holdId);
      if(!alive.current||activeHold.current!==holdId)return;
      const stale=latest.assignedTable!==before.assignedTable||selections.some(item=>{
        const oldLine=before.lines.find(line=>line.lineIndex===item.lineIndex);
        const newLine=latest.lines.find(line=>line.lineIndex===item.lineIndex);
        return !Number.isSafeInteger(item.qty)||!sameLine(oldLine,newLine)||!newLine||item.qty>newLine.remainingQty;
      });
      applyDetail(latest);
      if(stale){setMessage('訂單已更新，請重新核對本次結帳商品。');return;}
      const lines=selections.map(item=>{
        const line=latest.lines.find(row=>row.lineIndex===item.lineIndex)!;
        return {lineIndex:line.lineIndex,id:line.id,name:line.name,qty:item.qty,unitMinor:line.unitMinor};
      });
      onCheckout({holdId:latest.holdId,codeLabel:latest.codeLabel,tableLabel:latest.assignedTable?.replace(/^T/,'')??'',selections,lines,submissionId:'DINING-'+crypto.randomUUID(),expectedRevision:latest.checkoutRevision});
      navigate('/checkout');
    }catch{if(alive.current)setMessage('未能核對最新結帳資料，未有送出付款。請重新選擇。');}
    finally{checkoutLock.current=false;if(alive.current)setCheckoutBusy(false);}
  };
  const elapsed=(startedAt?:string)=>{
    const timestamp=Date.parse(startedAt??'');
    return Number.isFinite(timestamp)?Math.max(0,Math.floor((now-timestamp)/60000)):0;
  };
  const timerText=(minutes:number)=>warning===undefined?'未有用餐警示設定':minutes>=warning?'超時 '+Math.max(0,minutes-warning)+' 分鐘':'距離警示 '+Math.max(0,warning-minutes)+' 分鐘';

  return <main className="dining-operations-workspace runtime-dining-workspace dining-interaction-r1" aria-label="堂食／輪候工作台">
    <aside className="dining-wait-column">
      <header><div><small>輪候</small><h2>輪候／叫號</h2></div><span>{view?.queue.length??0}</span></header>
      <button className="dining-add-wait" type="button" disabled={actionBusy} onClick={()=>setShowAdd(value=>!value)}>＋ 加入輪候</button>
      {showAdd?<section className="dining-wait-form">
        <label><span>人數</span><div><button type="button" disabled={actionBusy||partySize<=1} onClick={()=>setPartySize(value=>Math.max(1,value-1))}>−</button><b>{partySize}</b><button type="button" disabled={actionBusy} onClick={()=>setPartySize(value=>value+1)}>＋</button></div></label>
        <label><span>備註</span><input value={note} maxLength={120} disabled={actionBusy} onChange={event=>setNote(event.target.value)} placeholder="例如：等 10 分鐘"/></label>
        <button type="button" className="primary" disabled={actionBusy} onClick={()=>void addWait()}>{actionBusy?'處理中…':'確認加入'}</button>
      </section>:null}
      <div className="dining-wait-list">{view?.queue.map(row=><article key={row.id} className={selectedWait===row.id?'selected':''}>
        <button type="button" disabled={actionBusy||checkoutBusy} onClick={()=>openHold(row.id,true)}><strong>{row.codeLabel}</strong><span>{row.partySize} 位</span><small>{row.statusLabel}</small></button>
        <button type="button" className="remove" aria-label={'移除輪候 '+row.codeLabel} disabled={actionBusy||checkoutBusy} onClick={()=>void remove(row.id)}>×</button>
      </article>)}</div>
      <p className="dining-hint">{selectedWait?'右邊核對輪候單；撳中間空枱即可安排。':'撳輪候單查看商品及分項結帳。'}</p>
    </aside>
    <section className="dining-floor-board">
      <header><div><small>堂食 · {view?.businessDate??'—'}</small><h1>桌台</h1></div><button type="button" onClick={()=>setHistoryOpen(value=>!value)}>已結帳紀錄 {historyRows.length}</button><span>{busy?'更新中':'本機資料'}</span></header>
      {error?<p className="dining-notice" role="alert">{error}</p>:null}
      <div className="dining-nine-grid">{view?.tables.map(table=>{
        const minutes=elapsed(table.startedAt);
        const urgent=warning!==undefined&&table.state!=='settled'&&table.state!=='available'&&minutes>=warning;
        return <button key={table.id} type="button" disabled={actionBusy||checkoutBusy}
          className={'dining-table '+table.state+(urgent?' overdue':'')+(table.holdId&&table.holdId===selectedHoldId?' selected':'')}
          onClick={()=>{
            if(table.state==='available'){
              if(selectedWait)void assign(table.id);
              else setMessage('選中空枱：'+tableName(table.id)+'。可先建立輪候單，再安排入座。');
            }else if(table.holdId)openHold(table.holdId);
          }}>
          <div className="dining-table-top"><strong>{table.id==='T09'?'戶外桌':table.label}</strong><em>{table.state==='settled'?'已結帳':table.state==='available'?'空枱':(table.partySize??0)+' 位'}</em></div>
          {table.state!=='available'?<>
            <b>{table.outstandingLabel}</b>
            <span className="dining-table-items">{table.itemSummary||'未有商品'}{table.itemCount?' · '+table.itemCount+' 件':''}</span>
            <span className={'dining-table-time'+(urgent?' overdue':'')}>掛單 {minutes} 分鐘</span>
            <small className="dining-warning-label">{timerText(minutes)}</small>
            <div className="dining-table-money"><small>已付 {money(table.paidMinor??0)}</small><strong>未付 {money(table.remainingMinor??0)}</strong></div>
          </>:<small>{selectedWait?'撳此安排':'空枱'}</small>}
        </button>;
      })}</div>
      {message?<p className="dining-message" role="status">{message}</p>:null}
    </section>
    <aside className="dining-detail-panel" aria-busy={detailLoading}>
      {historyOpen?<section className="dining-payment-history" style={{maxHeight:'100%'}}>
        <header><b>已結帳紀錄</b><button type="button" onClick={()=>setHistoryOpen(false)}>返回</button></header>
        {historyRows.length?historyRows.map(row=><button type="button" key={row.holdId} onClick={()=>openHold(row.holdId)} style={{display:'block',width:'100%',padding:14,marginTop:8,textAlign:'left',background:'#edf4ff',border:'1px solid #bfd0e8',borderRadius:8}}><b>{row.codeLabel} · {displayTableName(row.lastAssignedTable)}</b><p>{money(row.paidMinor)} · {row.payments.length} 次付款</p></button>):<p>未有已结帳紀錄。</p>}
      </section>:detail?<>
        <header><div><small>{detail.codeLabel}</small><h2>{displayTableName(detail.assignedTable??detail.lastAssignedTable)}</h2></div><span>{detail.partySize} 位</span></header>
        <div className="dining-detail-timer"><span>掛單時間</span><b>{elapsed(detail.createdAt)} 分鐘</b><small>{timerText(elapsed(detail.createdAt))}</small></div>
        {detail.formalOrderId?<section className="dining-payment-panel">
          <header><div><b>首次打印</b><small>掛枱時自動建立；唔需要再撳落廚</small></div><strong>{detail.firstPrintState==='DONE'?'完成':detail.firstPrintState==='FAILED'?'有失敗':detail.firstPrintState==='UNKNOWN'?'狀態未知':detail.firstPrintState==='DISPATCHING'?'派發中':'未開始'}</strong></header>
          {detail.firstPrintSummary?<small>計劃 {detail.firstPrintSummary.planned} · 已送 {detail.firstPrintSummary.sent} · 失敗 {detail.firstPrintSummary.failed}</small>:null}
          <p className="dining-message">打印狀態只係通訊／派發證據，唔代表實體紙張一定已經出到。實際少邊張由廚房／真人確認，再用下方「重印堂食票」手動揀。</p>
          {detail.firstPrintAttention==='TRANSPORT_UNKNOWN'?<p className="dining-message">打印通道結果未知：系統唔會估邊張實體紙缺失，亦唔會自動重印成套。</p>:null}
          {detail.firstPrintAttention==='TRANSPORT_REPORTED_INCOMPLETE'?<p className="dining-message">打印通道回報有工作未完成；呢個只係提示。請先真人核對實際缺票，再決定補印。</p>:null}
        </section>:null}
        <section className="dining-detail-lines">
          <header><b>商品／分項結帳</b><button type="button" disabled={checkoutBusy||actionBusy} onClick={selectAllRemaining}>全選未結</button></header>
          {detail.lines.length?detail.lines.map(line=><article key={line.lineIndex} className={line.remainingQty===0?'paid':''}>
            <div className="dining-line-copy"><b>{line.name}</b><small>{money(line.unitMinor)} × {line.qty}</small><span>已結 {line.paidQty} · 未結 {line.remainingQty}</span>{canOverridePrice&&detail.payments.length===0?<button type="button" disabled={actionBusy||checkoutBusy} onClick={()=>openPriceOverride(line.lineIndex,line.unitMinor)}>人工改價</button>:null}</div>
            <div className="dining-line-selector">
              <button type="button" disabled={checkoutBusy||actionBusy||(selection[line.lineIndex]??0)<=0} onClick={()=>adjustSelection(line.lineIndex,-1)}>−</button>
              <b>{selection[line.lineIndex]??0}</b>
              <button type="button" disabled={checkoutBusy||actionBusy||(selection[line.lineIndex]??0)>=line.remainingQty} onClick={()=>adjustSelection(line.lineIndex,1)}>＋</button>
            </div>
          </article>):<p className="dining-no-items">未有商品；目前只記錄輪候／桌台。</p>}
        </section>
        {detail.priceOverrides?.length?<section className="dining-payment-history"><header><b>人工改價紀錄</b><span>{detail.priceOverrides.length}</span></header>{detail.priceOverrides.map(row=><div key={row.id}><span>{row.staffName}</span><b>{money(row.originalUnitMinor)} → {money(row.effectiveUnitMinor)}</b><small>{money(row.deltaMinor)} · {new Date(row.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</small>{row.reason?<small>{row.reason}</small>:null}</div>)}</section>:null}
        <section className="dining-payment-panel checkout-authority">
          <header><div><b>本次結帳</b><small>按商品揀選，不受用餐人數限制</small></div><strong>{money(selectedAmount)}</strong></header>
          <button type="button" className="dining-settle-button" disabled={checkoutBusy||actionBusy||selectedUnits<=0||detail.remainingMinor<=0} onClick={()=>void goCheckout()}>{checkoutBusy?'核對最新資料…':'前往結帳 · '+selectedUnits+' 件'}</button>
        </section>
        <section className="dining-balance"><div><span>原總額</span><b>{money(detail.totalMinor)}</b></div><div><span>已結帳</span><b>{money(detail.paidMinor)}</b></div><div className="remaining"><span>未結帳</span><strong>{money(detail.remainingMinor)}</strong></div></section>
        <section className="dining-payment-history"><header><b>付款紀錄</b><span>{detail.payments.length}</span></header>{detail.payments.length?detail.payments.map(payment=><div key={payment.id}><span>{payment.tender==='COMBO'?(payment.splitTenders??[]).map(row=>(tenderLabels[row.tender]??row.tender)+' '+money(row.amountMinor)).join(' + '):(tenderLabels[payment.tender]??payment.tender)}</span><b>{money(payment.amountMinor)}</b><small>{new Date(payment.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</small><small>{payment.receiptState==='DONE'?'收據已送':payment.receiptState==='FAILED'?'收據失敗':payment.receiptState==='UNKNOWN'?'收據狀態未知':payment.receiptState==='DISPATCHING'?'收據派發中':'未派收據'}</small><button type="button" disabled={actionBusy||checkoutBusy||!payment.submissionId} onClick={()=>void reprintPaymentReceipt(payment.submissionId)}>重印付款收據</button></div>):<p>未有付款紀錄。</p>}</section>
        {detail.archivedAt?<p className="dining-message" role="status">已付清，桌台已釋放；商品及付款紀錄保留。</p>:null}
        <footer className="dining-detail-actions">
          <button type="button" disabled={actionBusy||checkoutBusy||!detail.formalOrderId} onClick={()=>void openReprint()}>重印堂食票</button>
          <button type="button" className="unassign" disabled={actionBusy||checkoutBusy||!detail.assignedTable||detail.remainingMinor===0} onClick={()=>void unassign()}>退回輪候</button>
          {!detail.archivedAt?<button type="button" className="clear" disabled={actionBusy||checkoutBusy||!detail.assignedTable||detail.remainingMinor>0||detail.payments.length===0} onClick={()=>void clearTable()}>保存紀錄並釋枱</button>:null}
        </footer>
      </>:<div className="dining-detail-empty"><b>{detailLoading?'讀取堂食單…':'枱號／輪候詳情'}</b><p>揀桌台或輪候單，即可核對商品及分項結帳。</p></div>}
    </aside>
    {priceOverrideLine!==null?<div className="order-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setPriceOverrideLine(null);}}>
      <section className="order-modal">
        <header><h2>人工成交價</h2><button type="button" onClick={()=>setPriceOverrideLine(null)}>×</button></header>
        <p>此操作由 Admin 授權嘅「改價權限」控制。成交價可以係正數、$0 或負數；原因可以留空。</p>
        <label>成交單價<input inputMode="decimal" value={priceOverrideValue} onChange={event=>setPriceOverrideValue(event.target.value)} placeholder="例如 39.00 或 -5.00"/></label>
        <label>原因（選填）<input value={priceOverrideReason} maxLength={200} onChange={event=>setPriceOverrideReason(event.target.value)} placeholder="可留空"/></label>
        <footer><button type="button" onClick={()=>setPriceOverrideLine(null)}>取消</button><button type="button" className="primary" disabled={actionBusy||!priceOverrideValue.trim()} onClick={()=>void submitPriceOverride()}>確認成交價</button></footer>
      </section>
    </div>:null}
    {reprintOpen?<div className="order-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setReprintOpen(false);}}>
      <section className="order-modal reprint">
        <header><h2>堂食重印</h2><button type="button" onClick={()=>setReprintOpen(false)}>×</button></header>
        <p>由廚房／真人確認實際少邊張，再喺下面手動揀。系統唔會估邊張實體紙缺失；重印亦唔會建立新單、付款或開錢箱。</p>
        <div className="order-action-choices">
          {reprintOptions.map(option=><label key={option.jobId} style={{display:'flex',gap:10,alignItems:'center',padding:10}}>
            <input type="checkbox" checked={selectedReprintJobs.has(option.jobId)} onChange={()=>toggleReprint(option.jobId)}/>
            <span><b>{option.label}</b>{option.detail?<small> · {option.detail}</small>:null}{option.printerName?<small> · {option.printerName}</small>:null}</span>
          </label>)}
        </div>
        <footer><button type="button" onClick={()=>setReprintOpen(false)}>取消</button><button type="button" className="primary" disabled={!selectedReprintJobs.size||actionBusy} onClick={()=>void runReprint()}>確認重印</button></footer>
      </section>
    </div>:null}
  </main>;
}
