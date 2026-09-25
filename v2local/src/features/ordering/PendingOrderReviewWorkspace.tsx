import {useEffect,useMemo,useState} from 'react';
import QRCode from 'qrcode';
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
  readonly customerName?:string;
  readonly customerPhone?:string;
  readonly paymentEvidenceRef?:string;
  readonly paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED';
  readonly keetaDeferCount?:number;
  readonly items:readonly PendingReviewLine[];
}

const money=(minor:number)=>String.fromCharCode(36)+(minor/100).toFixed(2);
const whatsappTemplates=[
  {id:'date',label:'日期唔啱',message:'你好，我哋係磨飯。你上傳嘅付款證明日期似乎唔啱，麻煩你核對後重新傳送，謝謝。'},
  {id:'time',label:'時間唔啱',message:'你好，我哋係磨飯。你上傳嘅付款證明時間似乎唔啱，麻煩你核對後重新傳送，謝謝。'},
  {id:'amount',label:'金額唔啱',message:'你好，我哋係磨飯。你上傳嘅付款證明金額同訂單唔一致，麻煩你核對後重新傳送，謝謝。'},
  {id:'blur',label:'截圖唔清',message:'你好，我哋係磨飯。你上傳嘅付款截圖唔夠清楚，麻煩你重新傳一張可以睇到日期、時間同金額嘅截圖，謝謝。'},
  {id:'resend',label:'要求重傳',message:'你好，我哋係磨飯。麻煩你重新傳送今次訂單嘅付款證明，方便我哋核對，謝謝。'},
] as const;

function whatsappPhone(value:string){
  const digits=String(value||'').replace(/\D/g,'');
  if(digits.length===8)return '852'+digits;
  return digits;
}

export function PendingOrderReviewWorkspace({
  order,onAccept,onOpenOrders,onReviewEvidence,onDeferKeeta,
}:{
  order:PendingReviewOrder;
  onAccept:()=>Promise<string>;
  onOpenOrders:()=>void;
  onReviewEvidence?:(decision:'VERIFIED'|'REJECTED')=>Promise<void>;
  onDeferKeeta?:()=>Promise<void>;
}){
  const [stage,setStage]=useState<'summary'|'review'>('summary');
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [evidenceUrl,setEvidenceUrl]=useState<string|null>(null);
  const [evidenceLoading,setEvidenceLoading]=useState(false);
  const [evidenceError,setEvidenceError]=useState<string|null>(null);
  const [evidenceZoom,setEvidenceZoom]=useState(false);
  const [reviewBusy,setReviewBusy]=useState(false);
  const [selectedTemplate,setSelectedTemplate]=useState<(typeof whatsappTemplates)[number]['id']>('resend');
  const [whatsappQr,setWhatsappQr]=useState<string|null>(null);
  const [deferBusy,setDeferBusy]=useState(false);
  const itemCount=useMemo(()=>order.items.reduce((sum,item)=>sum+item.qty,0),[order.items]);
  const isPending=order.fulfillmentLabel==='待處理';
  const sourceIsKeeta=/^Keeta\b/i.test(order.sourceLabel);
  const evidenceRequired=Boolean(order.paymentEvidenceRef);
  const evidenceVerified=order.paymentVerificationState==='VERIFIED';
  const canAccept=isPending&&(!evidenceRequired||evidenceVerified);
  const createdLabel=new Date(order.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'});
  const selectedMessage=whatsappTemplates.find(row=>row.id===selectedTemplate)??whatsappTemplates[4];

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

  useEffect(()=>{
    const phone=whatsappPhone(order.customerPhone??'');
    if(stage!=='review'||!phone){setWhatsappQr(null);return;}
    let disposed=false;
    const url='https://wa.me/'+phone+'?text='+encodeURIComponent(selectedMessage.message);
    void QRCode.toDataURL(url,{width:220,margin:1,errorCorrectionLevel:'M'}).then(data=>{
      if(!disposed)setWhatsappQr(data);
    }).catch(()=>{if(!disposed)setWhatsappQr(null);});
    return()=>{disposed=true;};
  },[stage,order.customerPhone,selectedMessage.message]);

  const accept=async()=>{
    if(!canAccept||busy)return;
    setBusy(true);setError(null);setResult(null);
    try{setResult(await onAccept());}
    catch(cause){setError(cause instanceof Error?cause.message:'未能接單');}
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
    if(!sourceIsKeeta||!onDeferKeeta||deferBusy||(order.keetaDeferCount??0)>=2)return;
    setDeferBusy(true);setError(null);
    try{
      await onDeferKeeta();
      setResult('已稍後處理；訂單仍保留喺 Keeta 待處理區。');
    }catch(cause){setError(cause instanceof Error?cause.message:'KEETA_DEFER_FAILED');}
    finally{setDeferBusy(false);}
  };

  if(stage==='summary')return <div className="pending-order-flow">
    <header className="pending-order-title">
      <div><small>{sourceIsKeeta?'KEETA ORDER':'CUSTOMER ORDER'} · 摘要</small><h2>#{order.display}</h2><p>{order.sourceLabel} · {createdLabel}</p></div>
      <span className={isPending?'pending':'active'}>{order.fulfillmentLabel}</span>
    </header>
    <section className="pending-order-summary-grid">
      <article><span>客戶</span><b>{order.customerName||'—'}</b></article>
      <article><span>產品</span><b>{itemCount} 件</b></article>
      <article><span>總額</span><b>{money(order.totalMinor)}</b></article>
      <article><span>付款</span><b>{order.paymentLabel||'未記錄'}</b></article>
      <article><span>取餐碼</span><b>{order.providerPickupCode||'—'}</b></article>
      {sourceIsKeeta?<article><span>稍後處理</span><b>{order.keetaDeferCount??0} / 2</b></article>:null}
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
      {sourceIsKeeta?<button type="button" disabled={deferBusy||(order.keetaDeferCount??0)>=2||!isPending} onClick={()=>void deferKeeta()}>
        {deferBusy?'處理中…':(order.keetaDeferCount??0)>=2?'已達 2 次上限':'稍後處理'}
      </button>:null}
      <button type="button" className="primary" onClick={()=>setStage('review')}>{sourceIsKeeta?'即刻處理':'開始核對'}</button>
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
        <div><span>客戶</span><b>{order.customerName||'—'}</b></div>
        <div><span>電話</span><b>{order.customerPhone||'—'}</b></div>
        <div><span>來源</span><b>{order.sourceLabel}</b></div>
        <div><span>付款記錄</span><b>{order.paymentLabel||'未記錄'}</b></div>
        <div><span>總額</span><b>{money(order.totalMinor)}</b></div>
        {order.paymentVerificationState?<div><span>付款核對</span><b>{order.paymentVerificationState==='PENDING'?'待核對':order.paymentVerificationState==='VERIFIED'?'已核對':'已拒絕'}</b></div>:null}
        {order.providerPickupCode?<div><span>取餐碼</span><b>{order.providerPickupCode}</b></div>:null}
        {order.utensilPreference?<div><span>餐具</span><b>{order.utensilPreference}</b></div>:null}
        {order.orderRemark?<div className="wide"><span>訂單備註</span><b>{order.orderRemark}</b></div>:null}

        {order.paymentEvidenceRef?<section className="pending-payment-evidence">
          <header><b>付款截圖 · 人工核對</b><span>{order.paymentVerificationState==='VERIFIED'?'已核對':order.paymentVerificationState==='REJECTED'?'已拒絕':'待核對'}</span></header>
          {evidenceLoading?<p>載入付款截圖中…</p>:null}
          {evidenceError?<p className="error">未能讀取付款截圖：{evidenceError}</p>:null}
          {evidenceUrl?<button type="button" className="pending-evidence-image-button" onClick={()=>setEvidenceZoom(true)} aria-label="放大付款截圖"><img src={evidenceUrl} alt="客戶付款截圖"/></button>:null}
          <small>請人工核對日期、時間、金額、清晰度，同埋係咪似今次付款。截圖本身唔等於已付款。</small>
          <div className="pending-evidence-actions">
            <button type="button" disabled={reviewBusy||order.paymentVerificationState==='REJECTED'} onClick={()=>void reviewEvidence('REJECTED')}>有問題</button>
            <button type="button" className="primary" disabled={reviewBusy||order.paymentVerificationState==='VERIFIED'} onClick={()=>void reviewEvidence('VERIFIED')}>核對正確</button>
          </div>
        </section>:null}

        {!sourceIsKeeta&&order.customerPhone?<section className="pending-whatsapp-qr">
          <header><b>WhatsApp QR</b><span>掃描直接聯絡客戶</span></header>
          <div className="pending-whatsapp-template">{whatsappTemplates.map(template=><button type="button" key={template.id} className={selectedTemplate===template.id?'active':''} onClick={()=>setSelectedTemplate(template.id)}>{template.label}</button>)}</div>
          {whatsappQr?<img src={whatsappQr} alt={'WhatsApp QR · '+selectedMessage.label}/>:<p>未能建立 QR。</p>}
          <small>{selectedMessage.message}</small>
        </section>:null}

        <p>{sourceIsKeeta?'接單後沿現有 Keeta CONFIRM mirror + 既有打印路徑；Provider 異常會保留本地結果並顯示 Attention。':'只有付款證明核對完成（如適用）先可以接受；接受後沿同一正式訂單進製作／打印。'}</p>
      </aside>
    </div>
    {result?<div className="pending-order-result success">{result}</div>:null}
    {error?<div className="pending-order-result error">{error}。請到完整訂單工作台核對目前正式狀態。</div>:null}
    <footer className="pending-order-actions">
      <button type="button" onClick={()=>setStage('summary')}>返回摘要</button>
      <button type="button" onClick={onOpenOrders}>完整訂單工作台</button>
      <button type="button" className="primary" disabled={!canAccept||busy||Boolean(result)} onClick={()=>void accept()}>{busy?'接單中…':!canAccept&&evidenceRequired?'先核對付款':'確認接單'}</button>
    </footer>

    {evidenceZoom&&evidenceUrl?<div className="pending-evidence-zoom" onMouseDown={event=>{if(event.target===event.currentTarget)setEvidenceZoom(false);}}>
      <section role="dialog" aria-modal="true" aria-label="放大付款截圖">
        <header><b>付款截圖</b><button type="button" onClick={()=>setEvidenceZoom(false)}>×</button></header>
        <img src={evidenceUrl} alt="放大付款截圖"/>
      </section>
    </div>:null}
  </div>;
}
