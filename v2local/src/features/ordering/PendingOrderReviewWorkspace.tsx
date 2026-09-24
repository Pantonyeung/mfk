import {useEffect,useMemo,useState} from 'react';
import {readCustomerPaymentEvidence} from '../../runtime/customer-cloud-intake.ts';
import './pending-order-review-workspace.css';

export interface PendingReviewLine{
  readonly id:string;
  readonly name:string;
  readonly qty:number;
  readonly unitMinor:number;
  readonly detail?:string;
}
export interface PendingReviewOrder{
  readonly id:string;
  readonly display:string;
  readonly sourceLabel:string;
  readonly createdAt:string;
  readonly totalMinor:number;
  readonly paymentLabel:string;
  readonly fulfillmentLabel:string;
  readonly providerPickupCode?:string;
  readonly orderRemark?:string;
  readonly utensilPreference?:string;
  readonly paymentEvidenceRef?:string;
  readonly paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED';
  readonly items:readonly PendingReviewLine[];
}

const money=(minor:number)=>String.fromCharCode(36)+(minor/100).toFixed(2);

export function PendingOrderReviewWorkspace({
  order,onAccept,onOpenOrders,
}:{
  order:PendingReviewOrder;
  onAccept:()=>Promise<string>;
  onOpenOrders:()=>void;
}){
  const [stage,setStage]=useState<'summary'|'review'>('summary');
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [evidenceUrl,setEvidenceUrl]=useState<string|null>(null);
  const [evidenceLoading,setEvidenceLoading]=useState(false);
  const [evidenceError,setEvidenceError]=useState<string|null>(null);
  const itemCount=useMemo(()=>order.items.reduce((sum,item)=>sum+item.qty,0),[order.items]);
  const isPending=order.fulfillmentLabel==='待處理';
  const sourceIsKeeta=/^Keeta\b/i.test(order.sourceLabel);
  const createdLabel=new Date(order.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'});
  useEffect(()=>{
    if(stage!=='review'||!order.paymentEvidenceRef){
      setEvidenceUrl(null);setEvidenceLoading(false);setEvidenceError(null);return;
    }
    let disposed=false;
    let objectUrl:string|undefined;
    setEvidenceLoading(true);setEvidenceError(null);setEvidenceUrl(null);
    void readCustomerPaymentEvidence(order.paymentEvidenceRef).then(blob=>{
      if(disposed)return;
      objectUrl=URL.createObjectURL(blob);
      setEvidenceUrl(objectUrl);
    }).catch(cause=>{
      if(!disposed)setEvidenceError(cause instanceof Error?cause.message:'PAYMENT_EVIDENCE_READ_FAILED');
    }).finally(()=>{if(!disposed)setEvidenceLoading(false);});
    return()=>{disposed=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[stage,order.id,order.paymentEvidenceRef]);

  const accept=async()=>{
    if(!isPending||busy)return;
    setBusy(true);setError(null);setResult(null);
    try{setResult(await onAccept());}
    catch(cause){setError(cause instanceof Error?cause.message:'未能接單');}
    finally{setBusy(false);}
  };

  if(stage==='summary')return <div className="pending-order-flow">
    <header className="pending-order-title">
      <div><small>{sourceIsKeeta?'KEETA ORDER':'CUSTOMER ORDER'} · 摘要</small><h2>#{order.display}</h2><p>{order.sourceLabel} · {createdLabel}</p></div>
      <span className={isPending?'pending':'active'}>{order.fulfillmentLabel}</span>
    </header>
    <section className="pending-order-summary-grid">
      <article><span>產品</span><b>{itemCount} 件</b></article>
      <article><span>總額</span><b>{money(order.totalMinor)}</b></article>
      <article><span>付款</span><b>{order.paymentLabel||'未記錄'}</b></article>
      <article><span>取餐碼</span><b>{order.providerPickupCode||'—'}</b></article>
    </section>
    <section className="pending-order-preview">
      <header><b>訂單內容</b><span>{order.items.length} 款</span></header>
      {order.items.slice(0,4).map((item,index)=><div key={item.id+'-'+index}>
        <span>{item.qty}×</span><p><b>{item.name}</b>{item.detail?<small>{item.detail}</small>:null}</p><strong>{money(item.unitMinor*item.qty)}</strong>
      </div>)}
      {order.items.length>4?<small>另有 {order.items.length-4} 款，下一步完整核對。</small>:null}
    </section>
    <footer className="pending-order-actions">
      <button type="button" onClick={onOpenOrders}>完整訂單工作台</button>
      <button type="button" className="primary" onClick={()=>setStage('review')}>開始核對</button>
    </footer>
  </div>;

  return <div className="pending-order-flow review">
    <header className="pending-order-title">
      <div><small>{sourceIsKeeta?'KEETA ORDER':'CUSTOMER ORDER'} · REVIEW</small><h2>#{order.display} · 接單核對</h2><p>確認來源、餐點、金額同客戶／平台資料，再執行現有正式接單 command。</p></div>
      <span className={isPending?'pending':'active'}>{order.fulfillmentLabel}</span>
    </header>
    <div className="pending-review-columns">
      <section className="pending-review-lines">
        <header><b>餐點核對</b><span>{itemCount} 件</span></header>
        {order.items.map((item,index)=><article key={item.id+'-'+index}>
          <span>{item.qty}</span>
          <div><b>{item.name}</b>{item.detail?<small>{item.detail}</small>:null}<em>{money(item.unitMinor)} × {item.qty}</em></div>
          <strong>{money(item.unitMinor*item.qty)}</strong>
        </article>)}
      </section>
      <aside className="pending-review-facts">
        <div><span>來源</span><b>{order.sourceLabel}</b></div>
        <div><span>付款記錄</span><b>{order.paymentLabel||'未記錄'}</b></div>
        <div><span>總額</span><b>{money(order.totalMinor)}</b></div>
        {order.paymentVerificationState?<div><span>付款核對</span><b>{order.paymentVerificationState==='PENDING'?'待核對':order.paymentVerificationState==='VERIFIED'?'已核對':'已拒絕'}</b></div>:null}
        {order.providerPickupCode?<div><span>取餐碼</span><b>{order.providerPickupCode}</b></div>:null}
        {order.utensilPreference?<div><span>餐具</span><b>{order.utensilPreference}</b></div>:null}
        {order.orderRemark?<div className="wide"><span>訂單備註</span><b>{order.orderRemark}</b></div>:null}
        {order.paymentEvidenceRef?<section className="pending-payment-evidence">
          <header><b>付款截圖 · 只讀核對</b><span>{order.paymentVerificationState==='VERIFIED'?'已核對':order.paymentVerificationState==='REJECTED'?'已拒絕':'待核對'}</span></header>
          {evidenceLoading?<p>載入付款截圖中…</p>:null}
          {evidenceError?<p className="error">未能讀取付款截圖：{evidenceError}</p>:null}
          {evidenceUrl?<img src={evidenceUrl} alt="客戶付款截圖"/>:null}
          <small>目前只顯示 current Customer evidence；確認接單不會自動將付款狀態改成「已核對」。</small>
        </section>:null}
        <p>{sourceIsKeeta?'接單後沿現有 Keeta CONFIRM mirror + 既有打印路徑；Provider 異常會保留本地結果並顯示 Attention。':'接單後沿現有本地正式狀態 + 既有打印路徑；不建立第二張訂單。'}</p>
      </aside>
    </div>
    {result?<div className="pending-order-result success">{result}</div>:null}
    {error?<div className="pending-order-result error">{error}。請到完整訂單工作台核對目前正式狀態。</div>:null}
    <footer className="pending-order-actions">
      <button type="button" onClick={()=>setStage('summary')}>返回摘要</button>
      <button type="button" onClick={onOpenOrders}>完整訂單工作台</button>
      <button type="button" className="primary" disabled={!isPending||busy||Boolean(result)} onClick={()=>void accept()}>{busy?'接單中…':isPending?'確認接單':'已處理'}</button>
    </footer>
  </div>;
}
