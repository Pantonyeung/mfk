import {useState} from 'react';

import {
  MFP_CASH_QUICK_AMOUNTS_MINOR,
  MFP_CHECKOUT_CHANNELS,
  parseMfpMoneyInput,
  type MfpCheckoutChannelId,
  type MfpCheckoutSnapshot,
  type MfpTenderConfig,
} from './checkout-domain.ts';
import type {MfpNormalizedOrderingIntent,MfpOrderingSurface} from './ordering-domain.ts';

const money=new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'});
const formatMoney=(minor:number|null|undefined)=>minor===null||minor===undefined?'—':money.format(minor/100);
const channelLabels:Record<string,string>={
  WALK_IN:'現場',PHONE:'電話',WHATSAPP:'WhatsApp',MORE_FUN_APP:'自家平台',FOODPANDA:'Foodpanda',KEETA:'Keeta',
};

export interface MfpCheckoutWorkspaceActions{
  readonly onBack:()=>void;
  readonly onChannel:(channelId:MfpCheckoutChannelId,identity?:Readonly<{customerPhone?:string;pickupCode?:string;externalOrderNo?:string}>)=>void;
  readonly onTender:(tenderId:string)=>void;
  readonly onCash:(amountMinor:number)=>void;
  readonly onStudentDiscount:(mode:'MANUAL'|'AUTO',studentCount:number,selected:readonly Readonly<{cartLineId:string;quantity:number}>[])=>void;
  readonly onFinalReview:()=>void;
  readonly onPaymentConfirm:()=>void;
}

export function MfpCheckoutWorkspace({surface,intent,snapshot,tenders,actions}:{
  surface:MfpOrderingSurface;
  intent:MfpNormalizedOrderingIntent;
  snapshot:MfpCheckoutSnapshot;
  tenders:readonly MfpTenderConfig[];
  actions:MfpCheckoutWorkspaceActions;
}){
  const [cashInput,setCashInput]=useState(snapshot.cashReceivedMinor===null?'':String(snapshot.cashReceivedMinor/100));
  const [studentCount,setStudentCount]=useState(snapshot.studentDiscountIntent?.studentCount??0);
  const [discountMode,setDiscountMode]=useState<'MANUAL'|'AUTO'>(snapshot.studentDiscountIntent?.mode??'AUTO');
  const [selectedLines,setSelectedLines]=useState<Record<string,number>>(()=>Object.fromEntries(snapshot.studentDiscountIntent?.selections.map(row=>[row.cartLineId,row.quantity])??[]));
  const [customerPhone,setCustomerPhone]=useState(snapshot.finalReview?.sourceIdentity.customerPhone??'');
  const [pickupCode,setPickupCode]=useState(snapshot.finalReview?.sourceIdentity.pickupCode??'');
  const [externalOrderNo,setExternalOrderNo]=useState(snapshot.finalReview?.sourceIdentity.externalOrderNo??'');
  const submitCash=(value:string)=>{
    setCashInput(value);
    try{actions.onCash(parseMfpMoneyInput(value));}catch{/* Keep invalid entry local and unsubmitted. */}
  };
  const selectChannel=(channelId:MfpCheckoutChannelId)=>actions.onChannel(channelId,{customerPhone,pickupCode,externalOrderNo});
  const quote=snapshot.quote;
  const review=snapshot.finalReview;
  const result=snapshot.result;
  const layout=surface==='MFP_PAD'?'mfp-checkout-pad-layout':'mfp-checkout-mobile-steps';
  const processing=snapshot.state==='SUBMITTING';
  const selectionLocked=snapshot.submissionId!==null;
  const backLocked=processing||snapshot.state==='UNKNOWN'||snapshot.state==='COMMITTED';

  return <section className={`mfp-checkout ${surface==='MFP_PAD'?'mfp-checkout-pad':'mfp-checkout-mobile'}`} data-checkout-surface={surface}>
    <header><div><small>FORMAL CHECKOUT · STORE KERNEL AUTHORITY</small><h1>Checkout</h1></div><button type="button" disabled={backLocked} onClick={actions.onBack}>← 返回訂單</button></header>
    <div className={layout}>
      <aside className="mfp-checkout-summary" aria-label="完整訂單摘要">
        <h2>完整訂單摘要</h2>
        {intent.lines.map(line=><article key={line.cartLineId}><div><b>{line.displayName}</b><small>{line.cartLineId} · {line.serviceMode}</small></div><span>×{line.quantity}</span><strong>{formatMoney(line.previewUnitMinor===null?null:line.previewUnitMinor*line.quantity)}</strong></article>)}
        <p><span>Local Preview</span><b>{formatMoney(intent.previewSubtotalMinor)}</b></p>
        <p className="formal"><span>Formal Total</span><strong>{formatMoney(quote?.formalTotalDueMinor)}</strong></p>
        <small>Formal Total 只來自 validation/readback；local preview 唔係 Pricing truth。</small>
      </aside>

      <main className="mfp-checkout-flow">
        <fieldset><legend>1 · Channel</legend><div className="mfp-checkout-choice-grid">{MFP_CHECKOUT_CHANNELS.map(channel=><button type="button" key={channel} disabled={selectionLocked} aria-pressed={snapshot.channelId===channel} className={snapshot.channelId===channel?'active':''} onClick={()=>selectChannel(channel)}>{channelLabels[channel]}</button>)}</div>
          {snapshot.channelId==='PHONE'||snapshot.channelId==='WHATSAPP'?<label>電話<input inputMode="tel" disabled={selectionLocked} value={customerPhone} onChange={event=>setCustomerPhone(event.target.value)} onBlur={()=>snapshot.channelId&&selectChannel(snapshot.channelId)}/></label>:null}
          {['MORE_FUN_APP','FOODPANDA','KEETA'].includes(String(snapshot.channelId))?<div className="mfp-checkout-source-fields"><label>Pickup<input disabled={selectionLocked} value={pickupCode} onChange={event=>setPickupCode(event.target.value)} onBlur={()=>snapshot.channelId&&selectChannel(snapshot.channelId)}/></label><label>External No.<input disabled={selectionLocked} value={externalOrderNo} onChange={event=>setExternalOrderNo(event.target.value)} onBlur={()=>snapshot.channelId&&selectChannel(snapshot.channelId)}/></label></div>:null}
        </fieldset>

        <fieldset><legend>2 · Tender</legend><div className="mfp-checkout-choice-grid">{tenders.map(tender=><button type="button" key={tender.id} disabled={!tender.enabled||selectionLocked} aria-pressed={snapshot.tenderId===tender.id} className={snapshot.tenderId===tender.id?'active':''} onClick={()=>actions.onTender(tender.id)}>{tender.label}</button>)}</div></fieldset>

        {snapshot.tenderId==='CASH'?<fieldset className="mfp-checkout-cash"><legend>3 · Cash</legend><div className="mfp-checkout-money-row"><p><span>應收</span><strong>{formatMoney(quote?.formalTotalDueMinor)}</strong></p><p><span>實收</span><strong>{formatMoney(snapshot.cashReceivedMinor)}</strong></p><p><span>找續</span><strong>{formatMoney(review?.changeMinor??(quote&&snapshot.cashReceivedMinor!==null?Math.max(0,snapshot.cashReceivedMinor-quote.formalTotalDueMinor):null))}</strong></p></div>
          <label>實收金額<input inputMode="decimal" disabled={selectionLocked} value={cashInput} onChange={event=>submitCash(event.target.value)} placeholder="0.00"/></label>
          <div className="mfp-checkout-cash-quick"><button type="button" disabled={selectionLocked} onClick={()=>quote&&submitCash(String(quote.formalTotalDueMinor/100))}>Exact</button>{MFP_CASH_QUICK_AMOUNTS_MINOR.map(amount=><button type="button" key={amount} disabled={selectionLocked} onClick={()=>submitCash(String(amount/100))}>{formatMoney(amount)}</button>)}</div>
        </fieldset>:null}

        <fieldset className="mfp-checkout-student"><legend>4 · Student Discount</legend><label>Student Count<input inputMode="numeric" min="0" step="1" disabled={selectionLocked} value={studentCount} onChange={event=>setStudentCount(Math.max(0,Number.parseInt(event.target.value||'0',10)))}/></label><div role="group" aria-label="Student Discount mode"><button type="button" disabled={selectionLocked} className={discountMode==='AUTO'?'active':''} onClick={()=>setDiscountMode('AUTO')}>AUTO · 最貴優先</button><button type="button" disabled={selectionLocked} className={discountMode==='MANUAL'?'active':''} onClick={()=>setDiscountMode('MANUAL')}>MANUAL</button></div>
          {discountMode==='MANUAL'?<div className="mfp-checkout-discount-lines">{quote?.lines.filter(line=>line.studentDiscountEligible).map(line=><label key={line.cartLineId}>{line.cartLineId} · {formatMoney(line.formalUnitMinor)}<input type="number" inputMode="numeric" min="0" max={line.quantity} disabled={selectionLocked} value={selectedLines[line.cartLineId]??0} onChange={event=>setSelectedLines(rows=>({...rows,[line.cartLineId]:Math.max(0,Math.min(line.quantity,Number.parseInt(event.target.value||'0',10)))}))}/></label>)}</div>:null}
          <button type="button" disabled={!quote||selectionLocked} onClick={()=>actions.onStudentDiscount(discountMode,studentCount,Object.entries(selectedLines).filter(([,quantity])=>quantity>0).map(([cartLineId,quantity])=>({cartLineId,quantity})))}>送出 STUDENT_DISCOUNT_INTENT 驗證</button>
          <small>優惠金額由 Formal Pricing Authority 驗證。</small>
        </fieldset>

        <section className="mfp-checkout-review-entry"><button type="button" disabled={!quote||selectionLocked} onClick={actions.onFinalReview}>Final Review</button></section>
      </main>
    </div>

    {review?<div className="mfp-checkout-review-layer"><section className="mfp-checkout-final-review" role="dialog" aria-modal="true" aria-labelledby="mfp-final-review-title">
      <header><div><small>NO COMMIT YET</small><h2 id="mfp-final-review-title">Final Review</h2></div><span>{snapshot.state}</span></header>
      <div><p><span>Channel</span><b>{review.channelId}</b></p><p><span>Tender</span><b>{review.tenderId}</b></p><p><span>Formal Total</span><strong>{formatMoney(review.formalTotalDueMinor)}</strong></p><p><span>Student Discount</span><b>{formatMoney(review.formalDiscountMinor)}</b></p><p><span>Cash Received</span><b>{formatMoney(review.cashReceivedMinor)}</b></p><p><span>Change</span><b>{formatMoney(review.changeMinor)}</b></p><p><span>Pickup / External No.</span><b>{review.sourceIdentity.pickupCode||review.sourceIdentity.externalOrderNo||'—'}</b></p><p><span>Formal Revision / Validation Status</span><b>{String(review.formalRevision)} · VALID</b></p></div>
      <footer><button type="button" disabled={backLocked} onClick={actions.onBack}>返回訂單</button><button type="button" className="mfp-payment-confirm" disabled={processing||snapshot.state==='COMMITTED'||snapshot.state==='REJECTED'} onClick={actions.onPaymentConfirm}>{processing?'提交中…':snapshot.state==='UNKNOWN'?'UNKNOWN → READBACK':'PAYMENT CONFIRM'}</button></footer>
    </section></div>:null}

    {result?<output className={`mfp-checkout-result ${result.state.toLowerCase()}`} aria-live="polite"><strong>{result.state}</strong>{result.state==='UNKNOWN'?<span>先做 canonical readback；唔會當 FAILED 盲目重送。</span>:result.state==='REJECTED'?<span>{result.rejectionCode}</span>:<span>{result.orderRef??result.commitId}</span>}</output>:snapshot.state==='REJECTED'?<output className="mfp-checkout-result rejected">REJECTED · {snapshot.rejectionCode}</output>:snapshot.state==='UNKNOWN'?<output className="mfp-checkout-result unknown">UNKNOWN · formal validation readback required</output>:null}
  </section>;
}
