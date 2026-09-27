import {useEffect,useMemo,useState} from 'react';
import type {StoredOrder} from '../../runtime/local-runtime.ts';
import {
  PAYMENT_FOLLOWUP_TEMPLATES,
  buildWhatsAppPaymentFollowup,
  createWhatsAppQrDataUrl,
  type PaymentFollowupTemplateId,
} from '../../runtime/payment-evidence-whatsapp.ts';
import './pending-order-review-workspace.css';

const money=(minor:number)=>String.fromCharCode(36)+(minor/100).toFixed(2);

export function PendingOrderReviewWorkspace({
  order,onAccept,onOpenOrders,onReadEvidence,onReviewEvidence,onDeferKeeta,
}:{
  order:StoredOrder;
  onAccept:()=>Promise<string>;
  onOpenOrders:()=>void;
  onReadEvidence?:()=>Promise<{readonly objectUrl:string}>;
  onReviewEvidence?:(decision:'VERIFIED'|'REJECTED')=>Promise<void>;
  onDeferKeeta?:()=>Promise<void>;
}){
  const [stage,setStage]=useState<'summary'|'review'>('summary');
  const [busy,setBusy]=useState(false);
  const [deferBusy,setDeferBusy]=useState(false);
  const [reviewBusy,setReviewBusy]=useState(false);
  const [result,setResult]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [evidenceUrl,setEvidenceUrl]=useState<string|null>(null);
  const [evidenceLoading,setEvidenceLoading]=useState(false);
  const [evidenceError,setEvidenceError]=useState<string|null>(null);
  const [evidenceZoom,setEvidenceZoom]=useState(false);
  const [templateId,setTemplateId]=useState<PaymentFollowupTemplateId>('UNCLEAR');
  const [whatsappQr,setWhatsappQr]=useState<string|null>(null);

  const isPending=order.fulfillmentLabel==='待處理';
  const isKeeta=String(order.providerRef||'').startsWith('KEETA:')||/^Keeta\b/i.test(String(order.sourceLabel||''));
  const evidenceRequired=Boolean(order.paymentEvidenceRef);
  const evidenceVerified=order.paymentVerificationState==='VERIFIED';
  const canAccept=isPending&&(!evidenceRequired||evidenceVerified);
  const itemCount=useMemo(()=>order.items.reduce((sum,item)=>sum+item.qty,0),[order.items]);
  const createdLabel=new Date(order.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'});

  useEffect(()=>{
    if(stage!=='review'||!order.paymentEvidenceRef||!onReadEvidence){
      setEvidenceUrl(null);
      setEvidenceLoading(false);
      setEvidenceError(null);
      return;
    }
    let disposed=false;
    let objectUrl:string|undefined;
    setEvidenceLoading(true);
    setEvidenceError(null);
    setEvidenceUrl(null);
    void onReadEvidence().then(result=>{
      if(disposed){URL.revokeObjectURL(result.objectUrl);return;}
      objectUrl=result.objectUrl;
      setEvidenceUrl(result.objectUrl);
    }).catch(cause=>{
      if(!disposed)setEvidenceError(cause instanceof Error?cause.message:'PAYMENT_EVIDENCE_READ_FAILED');
    }).finally(()=>{if(!disposed)setEvidenceLoading(false);});
    return()=>{disposed=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[stage,order.id,order.paymentEvidenceRef]);

  useEffect(()=>{
    if(stage!=='review'||!order.customerPhone){
      setWhatsappQr(null);
      return;
    }
    let disposed=false;
    try{
      const followup=buildWhatsAppPaymentFollowup({
        phone:order.customerPhone,
        display:order.display,
        totalLabel:money(order.totalMinor),
        templateId,
      });
      void createWhatsAppQrDataUrl(followup.url).then(data=>{
        if(!disposed)setWhatsappQr(data);
      }).catch(()=>{if(!disposed)setWhatsappQr(null);});
    }catch{
      setWhatsappQr(null);
    }
    return()=>{disposed=true;};
  },[stage,order.customerPhone,order.display,order.totalMinor,templateId]);

  const accept=async()=>{
    if(!canAccept||busy)return;
    setBusy(true);setError(null);setResult(null);
    try{setResult(await onAccept());}
    catch(cause){setError(cause instanceof Error?cause.message:'ORDER_ACCEPT_FAILED');}
    finally{setBusy(false);}
  };
  const reviewEvidence=async(decision:'VERIFIED'|'REJECTED')=>{
    if(!onReviewEvidence||reviewBusy)return;
    setReviewBusy(true);setError(null);
    try{await onReviewEvidence(decision);}
    catch(cause){setError(cause instanceof Error?cause.message:'PAYMENT_EVIDENCE_REVIEW_FAILED');}
    finally{setReviewBusy(false);}
  };
  const deferKeeta=async()=>{
    if(!isKeeta||!isPending||!onDeferKeeta||deferBusy||(order.keetaDeferCount??0)>=2)return;
    setDeferBusy(true);setError(null);
    try{
      await onDeferKeeta();
      setResult('已稍後處理；訂單仍保留喺待處理區。');
    }catch(cause){setError(cause instanceof Error?cause.message:'KEETA_DEFER_FAILED');}
    finally{setDeferBusy(false);}
  };

  if(stage==='summary')return <div className="pending-order-flow">
    <header className="pending-order-title">
      <div><small>{isKeeta?'KEETA ORDER':'CUSTOMER ORDER'} · 摘要</small><h2>#{order.display}</h2><p>{order.sourceLabel} · {createdLabel}</p></div>
      <span className={isPending?'pending':'active'}>{order.fulfillmentLabel}</span>
    </header>
    <section className="pending-order-summary-grid">
      <article><span>客戶</span><b>{order.customerName||'—'}</b></article>
      <article><span>產品</span><b>{itemCount} 件</b></article>
      <article><span>總額</span><b>{money(order.totalMinor)}</b></article>
      <article><span>付款</span><b>{order.paymentLabel||'未記錄'}</b></article>
      <article><span>取餐碼</span><b>{order.providerPickupCode||'—'}</b></article>
      {isKeeta?<article><span>稍後處理</span><b>{order.keetaDeferCount??0} / 2</b></article>:null}
    </section>
    <section className="pending-order-preview">
      <header><b>訂單內容</b><span>{order.items.length} 款</span></header>
      {order.items.slice(0,4).map((item,index)=><div key={item.id+'-'+index}>
        <span>{item.qty}×</span><p><b>{item.name}</b>{item.detail?<small>{item.detail}</small>:null}</p><strong>{money(item.unitMinor*item.qty)}</strong>
      </div>)}
      {order.items.length>4?<small>另有 {order.items.length-4} 款，下一步完整核對。</small>:null}
    </section>
    {result?<div className="pending-order-result success">{result}</div>:null}
    {error?<div className="pending-order-result error">{error}</div>:null}
    <footer className="pending-order-actions">
      <button type="button" onClick={onOpenOrders}>完整訂單工作台</button>
      {isKeeta?<button type="button" disabled={deferBusy||(order.keetaDeferCount??0)>=2||!isPending} onClick={()=>void deferKeeta()}>
        {deferBusy?'處理中…':(order.keetaDeferCount??0)>=2?'已達 2 次上限':'稍後處理'}
      </button>:null}
      <button type="button" className="primary" disabled={!isPending} onClick={()=>setStage('review')}>{isKeeta?'即刻處理':'開始核對'}</button>
    </footer>
  </div>;

  const selectedTemplate=PAYMENT_FOLLOWUP_TEMPLATES.find(row=>row.id===templateId)??PAYMENT_FOLLOWUP_TEMPLATES[0];
  return <div className="pending-order-flow review">
    <header className="pending-order-title">
      <div><small>{isKeeta?'KEETA ORDER':'CUSTOMER ORDER'} · REVIEW</small><h2>#{order.display} · 接單核對</h2><p>確認來源、餐點、金額同客戶／平台資料，再執行現有正式接單流程。</p></div>
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
        <div><span>客戶</span><b>{order.customerName||'—'}</b></div>
        <div><span>電話</span><b>{order.customerPhone||'—'}</b></div>
        <div><span>來源</span><b>{order.sourceLabel}</b></div>
        <div><span>付款記錄</span><b>{order.paymentLabel||'未記錄'}</b></div>
        <div><span>總額</span><b>{money(order.totalMinor)}</b></div>
        {order.paymentVerificationState?<div><span>付款核對</span><b>{
          order.paymentVerificationState==='PENDING'?'待核對':order.paymentVerificationState==='VERIFIED'?'已核對':'已拒絕'
        }</b></div>:null}
        {order.providerPickupCode?<div><span>取餐碼</span><b>{order.providerPickupCode}</b></div>:null}
        {isKeeta?<div><span>稍後處理</span><b>{order.keetaDeferCount??0} / 2</b></div>:null}

        {order.paymentEvidenceRef?<section className="pending-payment-evidence">
          <header><b>付款截圖 · 人工核對</b><span>{
            order.paymentVerificationState==='VERIFIED'?'已核對':order.paymentVerificationState==='REJECTED'?'已拒絕':'待核對'
          }</span></header>
          {evidenceLoading?<p>載入付款截圖中…</p>:null}
          {evidenceError?<p className="error">未能讀取付款截圖：{evidenceError}</p>:null}
          {evidenceUrl?<button type="button" className="pending-evidence-image-button" onClick={()=>setEvidenceZoom(true)} aria-label="放大付款截圖"><img src={evidenceUrl} alt="客戶付款截圖"/></button>:null}
          <small>付款截圖係核對證據，唔會單獨當成付款成功真相。</small>
          <div className="pending-evidence-actions">
            <button type="button" disabled={reviewBusy||order.paymentVerificationState==='REJECTED'} onClick={()=>void reviewEvidence('REJECTED')}>有問題</button>
            <button type="button" className="primary" disabled={reviewBusy||order.paymentVerificationState==='VERIFIED'} onClick={()=>void reviewEvidence('VERIFIED')}>核對正確</button>
          </div>
        </section>:null}

        {!isKeeta&&order.customerPhone?<section className="pending-whatsapp-qr">
          <header><b>WhatsApp QR</b><span>{selectedTemplate.label}</span></header>
          <div className="pending-whatsapp-template">{PAYMENT_FOLLOWUP_TEMPLATES.map(template=><button type="button" key={template.id} className={templateId===template.id?'active':''} onClick={()=>setTemplateId(template.id)}>{template.label}</button>)}</div>
          {whatsappQr?<img src={whatsappQr} alt={'WhatsApp QR · '+selectedTemplate.label}/>:<p>未能建立 QR。</p>}
        </section>:null}

        <p>{isKeeta?'確認接單後沿現有 Keeta Provider mirror + 既有打印路徑；Provider 異常只記 Attention。':'如有付款證明，必須先人工核對；接單仍沿現有 Formal Order / Print authority。'}</p>
      </aside>
    </div>
    {result?<div className="pending-order-result success">{result}</div>:null}
    {error?<div className="pending-order-result error">{error}</div>:null}
    <footer className="pending-order-actions">
      <button type="button" onClick={()=>setStage('summary')}>返回摘要</button>
      <button type="button" onClick={onOpenOrders}>完整訂單工作台</button>
      <button type="button" className="primary" disabled={!canAccept||busy||Boolean(result)} onClick={()=>void accept()}>
        {busy?'接單中…':!canAccept&&evidenceRequired?'先核對付款':'確認接單'}
      </button>
    </footer>
    {evidenceZoom&&evidenceUrl?<div className="pending-evidence-zoom" role="dialog" aria-modal="true" onClick={()=>setEvidenceZoom(false)}>
      <button type="button" onClick={()=>setEvidenceZoom(false)}>關閉</button>
      <img src={evidenceUrl} alt="放大付款截圖"/>
    </div>:null}
  </div>;
}
