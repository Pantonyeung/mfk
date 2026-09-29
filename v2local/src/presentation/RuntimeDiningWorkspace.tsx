import {useCallback,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import type {
  CleanSmtCoreRuntimePort,
  LocalDiningHoldDetail,
  SmtDiningProjection,
  SmtReprintOption
} from '../runtime/local-runtime.ts';
import type {DiningAddOrderRequest} from '../features/ordering/dining-add-order-ui-session.ts';
import {readSmtStoreSettings} from '../runtime/admin-operational-config.ts';
import {subscribeSmtAdminConfig} from '../runtime/admin-config-sync.ts';
import {hasStaffPermission,readActiveStaffSession} from '../runtime/staff-auth.ts';
import './dining-operations-workspace.css';

const tenderLabels:Record<string,string>={
  CASH:'現金',
  ALIPAY:'Alipay',
  WECHAT:'WeChat Pay',
  FPS:'轉數快',
  PAYME:'PayMe',
  COMBO:'組合付款',
};
const money=(minor:number)=>String.fromCharCode(36)+(minor/100).toFixed(2);
let diningSubmissionSequence=0;
let diningAdditionSequence=0;
let diningCorrectionSequence=0;
const nextDiningSubmissionId=(holdId:string)=>{
  diningSubmissionSequence+=1;
  return 'DINPAY:'+holdId+':'+Date.now().toString(36)+':'+diningSubmissionSequence.toString(36);
};
const nextDiningAdditionSubmissionId=(holdId:string)=>{
  diningAdditionSequence+=1;
  return 'DINADD:'+holdId+':'+Date.now().toString(36)+':'+diningAdditionSequence.toString(36);
};
const nextDiningCorrectionSubmissionId=(holdId:string)=>{
  diningCorrectionSequence+=1;
  return 'DINVOID:'+holdId+':'+Date.now().toString(36)+':'+diningCorrectionSequence.toString(36);
};

export interface DiningCheckoutRequest{
  readonly holdId:string;
  readonly submissionId:string;
  readonly expectedRevision:string;
  readonly codeLabel:string;
  readonly tableLabel:string;
  readonly selections:readonly {lineIndex:number;qty:number}[];
  readonly lines:readonly {lineIndex:number;id:string;name:string;qty:number;unitMinor:number}[];
}
export function RuntimeDiningWorkspace({runtime,onCheckout,onAddOrder}:{runtime:CleanSmtCoreRuntimePort;onCheckout:(request:DiningCheckoutRequest)=>void;onAddOrder:(request:DiningAddOrderRequest)=>void}){
  const navigate=useNavigate();
  const [view,setView]=useState<SmtDiningProjection|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [showAdd,setShowAdd]=useState(false);
  const [partySize,setPartySize]=useState(2);
  const [note,setNote]=useState('');
  const [selectedWait,setSelectedWait]=useState<string|null>(null);
  const [transferHoldId,setTransferHoldId]=useState<string|null>(null);
  const [joinHoldId,setJoinHoldId]=useState<string|null>(null);
  const [selectedHoldId,setSelectedHoldId]=useState<string|null>(null);
  const [detail,setDetail]=useState<LocalDiningHoldDetail|null>(null);
  const [selection,setSelection]=useState<Record<number,number>>({});
  const [message,setMessage]=useState('');
  const [priceOverrideLine,setPriceOverrideLine]=useState<number|null>(null);
  const [priceOverrideValue,setPriceOverrideValue]=useState('');
  const [priceOverrideReason,setPriceOverrideReason]=useState('');
  const [priceOverrideRevision,setPriceOverrideRevision]=useState<string|undefined>(undefined);
  const [priceOverrideBusy,setPriceOverrideBusy]=useState(false);
  const [reprintOpen,setReprintOpen]=useState(false);
  const [reprintOptions,setReprintOptions]=useState<readonly SmtReprintOption[]>([]);
  const [selectedReprintJobs,setSelectedReprintJobs]=useState<Set<string>>(new Set());
  const [reprintBusy,setReprintBusy]=useState(false);
  const [now,setNow]=useState(Date.now());
  const [adminConfigRevision,setAdminConfigRevision]=useState(0);
  useEffect(()=>subscribeSmtAdminConfig(()=>setAdminConfigRevision(value=>value+1)),[]);
  void adminConfigRevision;
  const diningOverdueMinutes=readSmtStoreSettings().diningOverdueMinutes;
  const canOverridePrice=Boolean(readActiveStaffSession())&&hasStaffPermission('PRICE_OVERRIDE');

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

  const adjustPartySize=async(delta:number)=>{
    if(!detail||!runtime.updateDiningPartySize)return;
    const next=detail.partySize+delta;
    if(next<1)return;
    try{
      const updated=await runtime.updateDiningPartySize(detail.holdId,next);
      setDetail(updated);
      setMessage('人數已更新為 '+updated.partySize+' 位；訂單、枱號同用餐計時保持不變。');
      await load();
    }catch(cause){setMessage(cause instanceof Error?cause.message:'人數更新失敗');}
  };

  const addWait=async()=>{
    if(!runtime.createDiningWait)return;
    try{
      await runtime.createDiningWait({partySize,note});
      setNote('');setPartySize(2);setShowAdd(false);setMessage('已加入輪候。');
      await load();
    }catch(cause){setMessage(cause instanceof Error?cause.message:'加入輪候失敗');}
  };

  const transfer=async(tableId:string)=>{
    if(!transferHoldId||!runtime.assignDiningTable)return;
    try{
      const moving=detail?.holdId===transferHoldId?detail:(runtime.readDiningHold?await runtime.readDiningHold(transferHoldId):null);
      if(!moving?.assignedTable){
        setTransferHoldId(null);
        setMessage('轉枱已取消；此堂食單目前未掛枱。');
        return;
      }
      const fromLabel=view?.tables.find(table=>table.id===moving.assignedTable)?.label??moving.assignedTable;
      const toLabel=view?.tables.find(table=>table.id===tableId)?.label??tableId;
      await runtime.assignDiningTable(transferHoldId,tableId);
      setMessage('已由 '+fromLabel+' 轉到 '+toLabel+'；訂單編號保持不變。');
      setSelectedWait(null);
      setSelectedHoldId(transferHoldId);
      const movedId=transferHoldId;
      setTransferHoldId(null);
      await load();
      await loadDetail(movedId);
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'轉枱失敗');
    }
  };

  const join=async(tableId:string)=>{
    if(!joinHoldId||!runtime.joinDiningTable)return;
    try{
      const joining=detail?.holdId===joinHoldId?detail:(runtime.readDiningHold?await runtime.readDiningHold(joinHoldId):null);
      if(!joining?.assignedTable){setJoinHoldId(null);setMessage('併枱已取消；此堂食單目前未正式入座。');return;}
      await runtime.joinDiningTable(joinHoldId,tableId);
      const tableLabel=view?.tables.find(table=>table.id===tableId)?.label??tableId;
      setMessage('已加入 '+tableLabel+'；同一堂食單、同一用餐計時。');
      setSelectedWait(null);setTransferHoldId(null);setSelectedHoldId(joinHoldId);
      const joinedId=joinHoldId;setJoinHoldId(null);
      await load();await loadDetail(joinedId);
    }catch(cause){setMessage(cause instanceof Error?cause.message:'併枱失敗');}
  };

  const unjoin=async(tableId:string)=>{
    if(!detail||!runtime.unjoinDiningTable)return;
    try{
      await runtime.unjoinDiningTable(detail.holdId,tableId);
      const tableLabel=view?.tables.find(table=>table.id===tableId)?.label??tableId;
      setMessage('已拆除 '+tableLabel+'；原堂食單仍留喺主枱。');
      await load();await loadDetail(detail.holdId);
    }catch(cause){setMessage(cause instanceof Error?cause.message:'拆枱失敗');}
  };

  const assign=async(tableId:string)=>{
    if(!selectedWait||!runtime.assignDiningTable)return;
    try{
      await runtime.assignDiningTable(selectedWait,tableId);
      void runtime.ensureDiningInitialPrint?.(selectedWait).catch(()=>{});
      const tableLabel=view?.tables.find(table=>table.id===tableId)?.label??tableId;
      setMessage('已安排到 '+tableLabel+'。');
      setSelectedWait(null);
      setTransferHoldId(null);
      setJoinHoldId(null);
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
      setTransferHoldId(null);
      setJoinHoldId(null);
      setSelectedWait(detail.holdId);
      setSelectedHoldId(null);
      setDetail(null);
      await load();
    }catch(cause){setMessage(cause instanceof Error?cause.message:'取消掛枱失敗');}
  };

  const cancelUnpaidDining=async()=>{
    if(!detail?.formalOrderId||!runtime.cancelOrder||detail.paidMinor>0)return;
    const reason=window.prompt('請輸入取消原因','客人取消堂食');
    if(reason===null)return;
    const confirmed=window.confirm('確認取消 '+detail.codeLabel+'？取消唔等於退款；未收款會停止追收。如已出製作單，系統會通知製作部。');
    if(!confirmed)return;
    try{
      await runtime.cancelOrder(detail.formalOrderId,reason.trim()||'堂食取消');
      setMessage('堂食單已取消；冇自動退款、冇開錢箱。');
      setSelectedWait(null);
      setTransferHoldId(null);
      setJoinHoldId(null);
      setSelectedHoldId(null);
      setDetail(null);
      setSelection({});
      await load();
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'堂食取消失敗');
    }
  };

  const clearTable=async()=>{
    if(!detail||!runtime.clearDiningHold)return;
    try{
      await runtime.clearDiningHold(detail.holdId);
      setMessage('已完成結帳並清枱。');
      setTransferHoldId(null);setJoinHoldId(null);
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

  const correctOne=async(lineIndex:number)=>{
    if(!detail||!runtime.correctDiningLine)return;
    const line=detail.lines.find(item=>item.lineIndex===lineIndex);
    if(!line||line.remainingQty<=0)return;
    const reason=window.prompt('商品更正原因','客人取消一件');
    if(reason===null)return;
    if(!window.confirm('確認取消「'+line.name+'」1 件？已出製作後會保留原紀錄並通知製作部。'))return;
    try{
      const result=await runtime.correctDiningLine(detail.holdId,{
        submissionId:nextDiningCorrectionSubmissionId(detail.holdId),
        lineIndex,quantity:1,reason:reason.trim()||'客人取消一件',
      });
      setDetail(result.detail);setSelection({});
      if(result.correction.productionNoticeState==='UNKNOWN')setMessage('商品更正已記錄；製作通知結果未知，請先核對。');
      else if(result.correction.productionNoticeState==='FAILED')setMessage('商品更正已記錄；製作通知未成功，請跟進。');
      else if(result.correction.phase==='POST_PRODUCTION')setMessage('商品更正已記錄，製作部已收到更正通知。');
      else setMessage('商品更正已記錄；未有製作輸出，不需發更正單。');
      await load();
    }catch(cause){
      const code=cause instanceof Error?cause.message:'商品更正失敗';
      setMessage(code==='DINING_PRODUCTION_CERTAINTY_UNKNOWN'?'製作結果未知，暫停更改；請先核對打印／製作結果。':code);
    }
  };

  const openPriceOverride=(lineIndex:number,currentMinor:number)=>{
    if(!canOverridePrice){setMessage('此登入員工未獲 Admin 授權人工改價。');return;}
    if(!detail||detail.payments.length>0){setMessage('已有付款紀錄，人工改價已鎖定。');return;}
    setPriceOverrideLine(lineIndex);
    setPriceOverrideValue((currentMinor/100).toFixed(2));
    setPriceOverrideReason('');
    setPriceOverrideRevision(detail.checkoutRevision);
  };

  const submitPriceOverride=async()=>{
    if(!detail||priceOverrideLine===null||!runtime.overrideDiningLinePrice||priceOverrideBusy)return;
    const raw=priceOverrideValue.trim().replace(/^\$/,'');
    if(!/^-?\d+(?:\.\d{1,2})?$/.test(raw)){setMessage('成交價格式不正確。');return;}
    const effectiveMinor=Math.round(Number(raw)*100);
    if(!Number.isSafeInteger(effectiveMinor)){setMessage('成交價超出可處理範圍。');return;}
    setPriceOverrideBusy(true);
    try{
      const next=await runtime.overrideDiningLinePrice(
        detail.holdId,
        priceOverrideLine,
        effectiveMinor,
        priceOverrideReason,
        priceOverrideRevision,
      );
      setDetail(next);
      setSelection({});
      setPriceOverrideLine(null);
      setPriceOverrideValue('');
      setPriceOverrideReason('');
      setPriceOverrideRevision(undefined);
      setMessage('人工成交價已保存；原價、成交價、操作員同時間紀錄已保留。');
      await load();
    }catch(cause){
      const code=cause instanceof Error?cause.message:'人工改價失敗';
      setMessage(code==='DINING_PRICE_OVERRIDE_STALE'?'堂食單已經有更新，舊改價畫面已失效；請重新打開再操作。':code);
      if(code==='DINING_PRICE_OVERRIDE_STALE')setPriceOverrideLine(null);
    }finally{
      setPriceOverrideBusy(false);
    }
  };

  const openDiningReprint=async()=>{
    if(!detail?.formalOrderId||!runtime.readDiningReprintOptions)return;
    setReprintBusy(true);
    try{
      const options=await runtime.readDiningReprintOptions(detail.holdId);
      setReprintOptions(options);
      setSelectedReprintJobs(new Set());
      setReprintOpen(true);
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'未能讀取堂食重印項目');
    }finally{
      setReprintBusy(false);
    }
  };

  const toggleReprintJob=(jobId:string)=>{
    setSelectedReprintJobs(current=>{
      const next=new Set(current);
      if(next.has(jobId))next.delete(jobId);else next.add(jobId);
      return next;
    });
  };

  const submitDiningReprint=async()=>{
    if(!detail||!runtime.reprintDiningJobs||selectedReprintJobs.size===0||reprintBusy)return;
    setReprintBusy(true);
    try{
      const result=await runtime.reprintDiningJobs(detail.holdId,[...selectedReprintJobs],'DINING_MANUAL_REPRINT');
      setMessage(result.failed===0
        ?'已將所選票據送到打印通道；錢箱不會再次開啟。請由真人核對實體出紙結果。'
        :'部分所選票據未完成打印通道派發；請檢查設備，再由真人決定是否補印。');
      setReprintOpen(false);
      setSelectedReprintJobs(new Set());
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'堂食重印失敗');
    }finally{
      setReprintBusy(false);
    }
  };

  const goAddOrder=()=>{
    if(!detail?.formalOrderId)return;
    onAddOrder({
      holdId:detail.holdId,
      submissionId:nextDiningAdditionSubmissionId(detail.holdId),
      codeLabel:detail.codeLabel,
      tableLabel:detail.assignedTable?(view?.tables.find(table=>table.id===detail.assignedTable)?.label??detail.assignedTable):'輪候',
      formalOrderId:detail.formalOrderId,
    });
    navigate('/');
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
      submissionId:nextDiningSubmissionId(detail.holdId),
      expectedRevision:detail.checkoutRevision,
      codeLabel:detail.codeLabel,
      tableLabel:detail.assignedTable?(view?.tables.find(table=>table.id===detail.assignedTable)?.label??detail.assignedTable):'輪候',
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
        <button type="button" onClick={()=>{
          const nextSelected=selectedWait===row.id?null:row.id;
          setSelectedWait(nextSelected);
          if(nextSelected)void loadDetail(row.id);
          else if(selectedHoldId===row.id){setSelectedHoldId(null);setDetail(null);}
        }}>
          <strong>{row.codeLabel}</strong>
          <span>{row.partySize} 位</span>
          <small>{row.statusLabel}{row.itemCount?(' · '+row.itemCount+' 件 · 未收 '+money(row.remainingMinor??0)):''}</small>
        </button>
        {!row.formalOrderId&&!(row.itemCount??0)?<button type="button" className="remove" onClick={()=>void remove(row.id)}>×</button>:null}
      </article>)}</div>
      <p className="dining-hint">{selectedWait?'已揀輪候單；撳中間任何空枱即可安排。':'撳輪候單可以選擇／取消選擇。'}</p>
    </aside>

    <section className="dining-floor-board">
      <header><div><small>堂食營運 · {view?.businessDate??'—'}</small><h1>九宮格堂食</h1></div><span>{view?'已同步':'讀取中'}</span></header>
      {error?<p className="dining-notice" role="alert">{error}</p>:null}
      {busy&&!view?<p>讀取堂食資料中…</p>:null}
      <div className="dining-nine-grid">{view?.tables.map(table=>{
        const elapsed=tableElapsed(table.startedAt);
        const overdue=Math.max(0,elapsed-diningOverdueMinutes);
        const urgent=table.state!=='settled'&&table.state!=='available'&&elapsed>=diningOverdueMinutes;
        const selected=Boolean(table.holdId&&table.holdId===selectedHoldId);
        return <button key={table.id} type="button"
          className={'dining-table '+table.state+(urgent?' overdue':'')+(selected?' selected':'')}
          onClick={()=>{
            if(table.state==='available'){
              if(joinHoldId){void join(table.id);return;}
              if(transferHoldId){void transfer(table.id);return;}
              if(selectedWait)void assign(table.id);
              return;
            }
            if(table.holdId)void loadDetail(table.holdId);
          }}>
          <div className="dining-table-top"><strong>{table.label}</strong><em>{table.state==='settled'?'已結帳':table.state==='available'?'空枱':table.areaLabel.includes('併枱')?'併枱 · '+(table.partySize??0)+' 位':(table.partySize??0)+' 位'}</em></div>
          {table.state!=='available'?<>
            <b>{table.outstandingLabel}</b>
            <span className="dining-table-items">{table.itemSummary||'未有商品內容'}{table.itemCount?(' · '+table.itemCount+' 件'):''}</span>
            <span className={urgent?'dining-table-time overdue':'dining-table-time'}>
              用餐 {elapsed} 分鐘 · {overdue>0?'超時 '+overdue+' 分鐘':'剩餘 '+Math.max(0,diningOverdueMinutes-elapsed)+' 分鐘'}
            </span>
            <div className="dining-table-money"><small>已收 {money(table.paidMinor??0)}</small><strong>未收 {money(table.remainingMinor??0)}</strong></div>
          </>:<small>{joinHoldId?'撳此併枱':transferHoldId?'撳此轉枱':selectedWait?'撳此安排':'空枱'}</small>}
        </button>;
      })}</div>
      {message?<p className="dining-message">{message}</p>:null}
    </section>

    <aside className="dining-detail-panel">
      {detail?<>
        <header>
          <div><small>{detail.codeLabel}</small><h2>{detail.assignedTable?[detail.assignedTable,...(detail.joinedTables??[])].map(id=>view?.tables.find(table=>table.id===id)?.label??id).join('＋'):'輪候中'}</h2></div>
          <div className="dining-party-size-control" aria-label="堂食人數">
            <button type="button" disabled={detail.partySize<=1} onClick={()=>void adjustPartySize(-1)}>−</button>
            <span>{detail.partySize} 位</span>
            <button type="button" onClick={()=>void adjustPartySize(1)}>＋</button>
          </div>
        </header>
        <div className="dining-detail-timer">
          <span>{detail.assignedTable?'用餐時間':'輪候時間'}</span>
          <b>{tableElapsed(detail.assignedTable?(detail.seatedAt??detail.createdAt):detail.createdAt)} 分鐘</b>
          {detail.assignedTable
            ?<small>{tableElapsed(detail.seatedAt??detail.createdAt)>=diningOverdueMinutes?'已超時 '+(tableElapsed(detail.seatedAt??detail.createdAt)-diningOverdueMinutes)+' 分鐘':'距離 '+diningOverdueMinutes+' 分鐘仲有 '+(diningOverdueMinutes-tableElapsed(detail.seatedAt??detail.createdAt))+' 分鐘'}</small>
            :<small>由輪候建立時間計；未入座唔會計堂食超時。</small>}
        </div>

        {detail.formalOrderId?<section className="dining-first-print-evidence">
          <header>
            <div><b>首次打印通道</b><small>只係 transport evidence</small></div>
            <strong>{detail.firstPrintState==='DONE'?'通道已送':detail.firstPrintState==='FAILED'?'通道有未完成':detail.firstPrintState==='UNKNOWN'?'通道結果未知':detail.firstPrintState==='DISPATCHING'?'派發中':'未開始'}</strong>
          </header>
          {detail.firstPrintSummary?<div className="dining-first-print-summary">
            <span>計劃 {detail.firstPrintSummary.planned}</span>
            <span>已送 {detail.firstPrintSummary.sent}</span>
            <span>未完成 {detail.firstPrintSummary.failed}</span>
          </div>:null}
          <p>已送到打印通道 ≠ 實體已出紙。實際少邊張由廚房／真人確認；系統唔會根據通訊結果自動猜缺紙或自動重印成套。</p>
          {detail.firstPrintAttention==='TRANSPORT_UNKNOWN'?<small className="attention">打印通道結果未知；禁止盲目重播首次整套打印。</small>:null}
          {detail.firstPrintAttention==='TRANSPORT_REPORTED_INCOMPLETE'?<small className="attention">打印通道回報有工作未完成；請先真人核對實體紙張。</small>:null}
          <button type="button" disabled={reprintBusy||!runtime.readDiningReprintOptions} onClick={()=>void openDiningReprint()}>重印堂食票</button>
        </section>:null}

        <section className="dining-detail-lines">
          <header><b>商品／分項結帳</b><button type="button" onClick={selectAllRemaining}>全選未結</button></header>
          {detail.lines.map(line=><article key={line.lineIndex} className={line.remainingQty===0?'paid':''}>
            <div className="dining-line-copy">
              <b>{line.name}</b>
              <small>{money(line.unitMinor)} × {line.qty}{line.voidedQty>0?'（原 '+line.originalQty+' · 已更正 '+line.voidedQty+'）':''}</small>
              <span>已結 {line.paidQty} · 未結 {line.remainingQty}</span>
              <div className="dining-line-actions">
                {canOverridePrice&&detail.payments.length===0&&line.qty>0
                  ?<button type="button" className="dining-line-price-override" onClick={()=>openPriceOverride(line.lineIndex,line.unitMinor)}>人工改價</button>
                  :null}
                {line.remainingQty>0?<button type="button" className="dining-line-correction" onClick={()=>void correctOne(line.lineIndex)}>取消 1 件</button>
                  :line.paidQty>0?<em>已付款數量如需移除，請到正式訂單走退款／調整。</em>:null}
              </div>
            </div>
            <div className="dining-line-selector">
              <button type="button" disabled={(selection[line.lineIndex]??0)<=0} onClick={()=>adjustSelection(line.lineIndex,-1)}>−</button>
              <b>{selection[line.lineIndex]??0}</b>
              <button type="button" disabled={(selection[line.lineIndex]??0)>=line.remainingQty} onClick={()=>adjustSelection(line.lineIndex,1)}>＋</button>
            </div>
          </article>)}
        </section>

        {detail.joinedTables?.length?<section className="dining-joined-table-list">
          <header><b>併枱</b><span>同一堂食單</span></header>
          {detail.joinedTables.map(tableId=><div key={tableId}>
            <span>{view?.tables.find(table=>table.id===tableId)?.label??tableId}</span>
            <button type="button" onClick={()=>void unjoin(tableId)}>拆除此枱</button>
          </div>)}
        </section>:null}

        {detail.corrections.length?<section className="dining-correction-history">
          <header><b>商品更正紀錄</b><span>{detail.corrections.length}</span></header>
          {detail.corrections.slice().reverse().map(row=><div key={row.id}>
            <span>{row.itemName} ×{row.quantity}</span>
            <b>{row.phase==='POST_PRODUCTION'?'已出製作後更正':'製作前更正'}</b>
            <small>{row.productionNoticeState==='NOT_REQUIRED'?'毋須通知製作':row.productionNoticeState==='DONE'?'製作已通知':row.productionNoticeState==='FAILED'?'製作通知失敗':'製作通知結果未知'}</small>
          </div>)}
        </section>:null}

        {detail.priceOverrides.length?<section className="dining-price-override-history">
          <header><b>人工改價紀錄</b><span>{detail.priceOverrides.length}</span></header>
          {detail.priceOverrides.slice().reverse().map(row=><div key={row.id}>
            <span>#{row.sequence} · {row.staffName}</span>
            <b>{money(row.originalUnitMinor)} → {money(row.effectiveUnitMinor)}</b>
            <small>{row.deltaMinor>=0?'+':''}{money(row.deltaMinor)} · {new Date(row.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</small>
            {row.reason?<small>{row.reason}</small>:null}
          </div>)}
        </section>:null}

        <section className="dining-payment-panel checkout-authority">
          <header><div><b>本次結帳選擇</b><small>付款只可以喺 Checkout 介面完成</small></div><strong>{money(selectedAmount)}</strong></header>
          <button className="dining-settle-button" disabled={selectedUnits<=0||detail.remainingMinor<=0} onClick={goCheckout}>前往 Checkout · {selectedUnits} 件</button>
        </section>

        <section className="dining-balance">
          <div><span>總額</span><b>{money(detail.totalMinor)}</b></div>
          <div><span>已收款</span><b>{money(detail.paidMinor)}</b></div>
          <div className="remaining"><span>未收款</span><strong>{money(detail.remainingMinor)}</strong></div>
        </section>
        {detail.totalMinor<0?<p className="dining-message" role="status">此單目前係負數成交總額。系統保留真實金額，但一般收款 Checkout 已停用，避免將負數當成找續、退款或 Cash payout。</p>:null}

        <section className="dining-payment-history">
          <header><b>付款紀錄</b><span>{detail.payments.length}</span></header>
          {detail.payments.length?detail.payments.map(payment=><div key={payment.id}><span>{tenderLabels[payment.tender]??payment.tender}</span><b>{money(payment.amountMinor)}</b><small>{new Date(payment.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</small></div>):<p>未有付款紀錄。</p>}
        </section>

        <footer className="dining-detail-actions">
          <button type="button" className="unassign" title={detail.joinedTables?.length?'請先拆除併枱，再退回輪候。':undefined} disabled={!detail.assignedTable||detail.remainingMinor===0||Boolean(detail.joinedTables?.length)} onClick={()=>void unassign()}>取消掛枱／退回輪候</button>
          <button type="button" className="join-table" disabled={!detail.assignedTable||detail.remainingMinor===0} onClick={()=>{
            if(joinHoldId===detail.holdId){
              setJoinHoldId(null);setMessage('已取消併枱模式。');
            }else{
              setSelectedWait(null);setTransferHoldId(null);setJoinHoldId(detail.holdId);
              setMessage('併枱模式：請撳一張空枱。已有人／已有正式訂單嘅枱唔會合併。');
            }
          }}>{joinHoldId===detail.holdId?'取消併枱':'併枱'}</button>
          <button type="button" className="transfer" title={detail.joinedTables?.length?'請先拆除併枱，再進行轉枱。':undefined} disabled={!detail.assignedTable||detail.remainingMinor===0||Boolean(detail.joinedTables?.length)} onClick={()=>{
            if(transferHoldId===detail.holdId){
              setTransferHoldId(null);
              setMessage('已取消轉枱模式。');
            }else{
              setSelectedWait(null);
              setJoinHoldId(null);
              setTransferHoldId(detail.holdId);
              setMessage('轉枱模式：請撳一張空枱。');
            }
          }}>{transferHoldId===detail.holdId?'取消轉枱':'轉枱'}</button>
          <button type="button" className="add-order" disabled={!detail.formalOrderId} onClick={goAddOrder}>＋ 加單</button>
          {detail.paidMinor>0&&detail.formalOrderId
            ?<button type="button" className="formal-order" title="已有付款；退款同取消係兩個獨立正式動作，請到訂單頁處理。" onClick={()=>navigate('/orders?orderId='+encodeURIComponent(detail.formalOrderId!))}>正式訂單處理</button>
            :<button type="button" className="cancel-order" disabled={!detail.formalOrderId} onClick={()=>void cancelUnpaidDining()}>取消堂食單</button>}
          <button type="button" className="clear" disabled={detail.remainingMinor>0} onClick={()=>void clearTable()}>清枱</button>
        </footer>
      </>:<div className="dining-detail-empty">
        <b>枱號詳情</b>
        <p>撳中間已使用嘅枱，就會睇到商品、用餐時間、已結／未結同分項付款。</p>
      </div>}
    </aside>

    {reprintOpen?<div className="dining-reprint-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!reprintBusy)setReprintOpen(false);}}>
      <section className="dining-reprint-modal" role="dialog" aria-modal="true" aria-labelledby="dining-reprint-title">
        <header><div><small>HUMAN PHYSICAL CHECK</small><h2 id="dining-reprint-title">堂食重印</h2></div><button type="button" disabled={reprintBusy} onClick={()=>setReprintOpen(false)}>×</button></header>
        <p>由廚房／真人確認實際少邊張，再手動揀要補印嘅票。呢度只列票種、Label 同 Printer；唔會根據首次 transport 狀態推薦補邊張。</p>
        <div className="dining-reprint-options">
          {reprintOptions.length?reprintOptions.map(option=><label key={option.jobId}>
            <input type="checkbox" checked={selectedReprintJobs.has(option.jobId)} onChange={()=>toggleReprintJob(option.jobId)}/>
            <span><b>{option.label}</b>{option.detail?<small>{option.detail}</small>:null}<small>{option.printerName}</small></span>
          </label>):<span>目前冇可重印項目。</span>}
        </div>
        <footer><button type="button" disabled={reprintBusy} onClick={()=>setReprintOpen(false)}>取消</button><button type="button" className="primary" disabled={reprintBusy||selectedReprintJobs.size===0} onClick={()=>void submitDiningReprint()}>{reprintBusy?'送出中…':'重印所選 '+selectedReprintJobs.size+' 項'}</button></footer>
      </section>
    </div>:null}

    {priceOverrideLine!==null?<div className="dining-price-override-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!priceOverrideBusy)setPriceOverrideLine(null);}}>
      <section className="dining-price-override-modal" role="dialog" aria-modal="true" aria-labelledby="dining-price-override-title">
        <header><div><small>ADMIN PERMISSION · PRICE_OVERRIDE</small><h2 id="dining-price-override-title">人工成交價</h2></div><button type="button" disabled={priceOverrideBusy} onClick={()=>setPriceOverrideLine(null)}>×</button></header>
        <div className="dining-price-override-body">
          <p>成交價可以係正數、$0 或負數；原因可以留空。Role 名稱唔會自動取得改價權。</p>
          <label><span>成交單價</span><input inputMode="decimal" value={priceOverrideValue} onChange={event=>setPriceOverrideValue(event.target.value)} placeholder="例如 39.00 或 -5.00"/></label>
          <label><span>原因（選填）</span><input value={priceOverrideReason} maxLength={200} onChange={event=>setPriceOverrideReason(event.target.value)} placeholder="可留空"/></label>
          <small>確認後只修改呢張堂食交易嘅有效成交價；唔會修改 Admin 商品定價。</small>
        </div>
        <footer><button type="button" disabled={priceOverrideBusy} onClick={()=>setPriceOverrideLine(null)}>取消</button><button type="button" className="primary" disabled={priceOverrideBusy||!priceOverrideValue.trim()} onClick={()=>void submitPriceOverride()}>{priceOverrideBusy?'保存中…':'確認成交價'}</button></footer>
      </section>
    </div>:null}
  </main>;
}
