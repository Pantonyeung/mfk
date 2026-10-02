import {useMemo,useState} from 'react';

import {parseMfpMoneyInput} from './checkout-domain.ts';
import {
  countMfpCashDenominations,
  type MfpBusinessDayOpening,
  type MfpCashMovement,
  type MfpDailyReport,
  type MfpMoneyActor,
  type MfpOpeningSuggestion,
} from './money-domain.ts';
import type {MfpOrderingSurface} from './ordering-domain.ts';

const money=new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'});
const formatMoney=(minor:number|null|undefined)=>minor===null||minor===undefined?'—':money.format(minor/100);
const denominations=[100,200,500,1000,2000,5000,10000,50000] as const;

export interface MfpMoneyWorkspaceActions{
  readonly onBack:()=>void;
  readonly onOpening:(amountMinor:number,note:string)=>void;
  readonly onMovement:(type:'CASH_IN'|'CASH_OUT',amountMinor:number,reason:string,note:string)=>void;
  readonly onDayClose:(countedCashMinor:number,cashRemovedMinor:number)=>void;
}

export function MfpMoneyWorkspace({surface,businessDayId,businessDate,actor,opening,suggestion,movements,report,actions}:{
  surface:MfpOrderingSurface;
  businessDayId:string;
  businessDate:string;
  actor:MfpMoneyActor;
  opening:MfpBusinessDayOpening|null;
  suggestion:MfpOpeningSuggestion|null;
  movements:readonly MfpCashMovement[];
  report:MfpDailyReport|null;
  actions:MfpMoneyWorkspaceActions;
}){
  const [openingInput,setOpeningInput]=useState(String((opening?.amountMinor??suggestion?.amountMinor??0)/100));
  const [openingNote,setOpeningNote]=useState('');
  const [movementType,setMovementType]=useState<'CASH_IN'|'CASH_OUT'>('CASH_IN');
  const [movementInput,setMovementInput]=useState('');
  const [reason,setReason]=useState('');
  const [movementNote,setMovementNote]=useState('');
  const [countMode,setCountMode]=useState<'DENOMINATION'|'DIRECT'>('DENOMINATION');
  const [counts,setCounts]=useState<Record<number,number>>({});
  const [directTotal,setDirectTotal]=useState('');
  const [removed,setRemoved]=useState('');
  const [error,setError]=useState('');
  const denominationTotal=useMemo(()=>countMfpCashDenominations(counts),[counts]);
  const submit=(work:()=>void)=>{try{work();setError('');}catch(value){setError(value instanceof Error?value.message:'MFP_MONEY_INPUT_INVALID');}};
  const actual=countMode==='DENOMINATION'?denominationTotal:(()=>{try{return parseMfpMoneyInput(directTotal||'0');}catch{return null;}})();

  return <section className="mfp-money" data-money-surface={surface}>
    <header><div><small>{businessDayId} · {businessDate}</small><h1>Business Day / Cash</h1><span>{actor.displayName}</span></div><button type="button" onClick={actions.onBack}>返回 Ordering</button></header>
    <div className="mfp-money-grid">
      <section><h2>Opening Cash</h2><p>Previous Retained / Next Opening：{formatMoney(suggestion?.amountMinor)}</p><label>Opening Cash<input inputMode="decimal" value={openingInput} onChange={event=>setOpeningInput(event.target.value)}/></label><label>Override Note<input value={openingNote} onChange={event=>setOpeningNote(event.target.value)}/></label><button type="button" disabled={Boolean(opening||report)} onClick={()=>submit(()=>actions.onOpening(parseMfpMoneyInput(openingInput),openingNote))}>Confirm Opening</button><small>改動 suggestion 會保留 actor / time / source audit，唔會 rewrite previous close。</small></section>

      <section><h2>Cash In / Cash Out</h2><div role="group"><button type="button" className={movementType==='CASH_IN'?'active':''} onClick={()=>setMovementType('CASH_IN')}>Cash In</button><button type="button" className={movementType==='CASH_OUT'?'active':''} onClick={()=>setMovementType('CASH_OUT')}>Cash Out</button></div><label>Amount<input inputMode="decimal" value={movementInput} onChange={event=>setMovementInput(event.target.value)}/></label><label>Reason<input value={reason} onChange={event=>setReason(event.target.value)}/></label><label>Note optional<input value={movementNote} onChange={event=>setMovementNote(event.target.value)}/></label><button type="button" disabled={!opening||Boolean(report)} onClick={()=>submit(()=>actions.onMovement(movementType,parseMfpMoneyInput(movementInput),reason,movementNote))}>Append Movement</button><p>{movements.length} records · ≠ Sales · ≠ Refund · ≠ Payment Correction</p></section>

      <section className="mfp-money-count"><h2>Cash Count</h2><div role="group"><button type="button" className={countMode==='DENOMINATION'?'active':''} onClick={()=>setCountMode('DENOMINATION')}>Denomination</button><button type="button" className={countMode==='DIRECT'?'active':''} onClick={()=>setCountMode('DIRECT')}>Direct Total</button></div>{countMode==='DENOMINATION'?<div className="mfp-denominations">{denominations.map(value=><label key={value}>{formatMoney(value)}<input type="number" inputMode="numeric" min="0" step="1" value={counts[value]??0} onChange={event=>setCounts(rows=>({...rows,[value]:Math.max(0,Number.parseInt(event.target.value||'0',10))}))}/></label>)}</div>:<label>Actual Count<input inputMode="decimal" value={directTotal} onChange={event=>setDirectTotal(event.target.value)}/></label>}<p>countedCashMinor：<strong>{formatMoney(actual)}</strong></p><label>Cash Removed<input inputMode="decimal" value={removed} onChange={event=>setRemoved(event.target.value)}/></label><button type="button" disabled={!opening||actual===null||Boolean(report)} onClick={()=>submit(()=>actions.onDayClose(actual!,parseMfpMoneyInput(removed||'0')))}>Complete Day Close</button></section>

      <section className="mfp-money-close"><h2>Day Close · Original Report IMMUTABLE</h2><div className="mfp-money-facts"><p><span>Opening</span><b>{formatMoney(report?.opening.amountMinor??opening?.amountMinor)}</b></p><p><span>Cash Sales</span><b>{formatMoney(report?.cashSalesMinor)}</b></p><p><span>Cash In</span><b>{formatMoney(report?.cashInMinor)}</b></p><p><span>Cash Out</span><b>{formatMoney(report?.cashOutMinor)}</b></p><p><span>Cash Refund / Adjustment</span><b>{formatMoney(report?.cashRefundAdjustmentMinor)}</b></p><p><span>Expected Cash</span><b>{formatMoney(report?.expectedCashMinor)}</b></p><p><span>Actual Count</span><b>{formatMoney(report?.countedCashMinor??actual)}</b></p><p><span>Variance</span><b>{formatMoney(report?.varianceMinor)}</b></p><p><span>Cash Removed</span><b>{formatMoney(report?.cashRemovedMinor)}</b></p><p><span>Retained Cash</span><b>{formatMoney(report?.retainedCashMinor)}</b></p><p><span>Next Opening</span><b>{formatMoney(report?.retainedCashMinor)}</b></p></div>
        <div className="mfp-money-summaries"><article><h3>Channel Summary</h3>{report?.channelSummary.map(row=><p key={row.id}>{row.id} · {row.orderCount} · {formatMoney(row.amountMinor)}</p>)??<p>—</p>}</article><article><h3>Tender Summary</h3>{report?.tenderSummary.map(row=><p key={row.id}>{row.id} · {row.orderCount} · {formatMoney(row.amountMinor)}</p>)??<p>—</p>}</article></div><small>Later refund / correction 只可以 append linked 1.1+ record；不可 rewrite 1.0。</small></section>
    </div>
    {error?<output className="mfp-money-error" aria-live="polite">{error}</output>:null}
  </section>;
}
