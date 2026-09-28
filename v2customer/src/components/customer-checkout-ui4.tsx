import {useEffect,useState} from 'react';
import {ActionButton,AnimatedValue} from '../ui/primitives';
import type {
  CustomerCartLine,
  CustomerCartRepair,
  CustomerCheckoutDraft,
  CustomerPaymentChannel,
  CustomerQuoteSnapshot,
} from '../product-types';

export type CustomerUi4CheckoutStep='contact'|'payment'|'review';

const money=(currency:string,minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency}).format(minor/100);
const digits=(value:string)=>value.replace(/\D/g,'');
export const pickupCodeFromPhone=(phone:string)=>{
  const value=digits(phone);
  return value.length>=4?value.slice(-4):null;
};

function stepClass(index:number,active:number){
  return index<active?'done':index===active?'active':'upcoming';
}

function CheckoutStepper({step}:{step:CustomerUi4CheckoutStep}){
  const active=step==='contact'?2:step==='payment'?3:4;
  const labels=['確認商品','聯絡與取餐','付款','提交前確認'];
  return <ol className="ui4-checkout-stepper" aria-label="結帳進度">
    {labels.map((label,index)=><li key={label} className={stepClass(index+1,active)}><i>{index+1<active?'✓':index+1}</i><span>{label}</span></li>)}
  </ol>;
}

function lineSummary(line:CustomerCartLine){
  const parts=[
    line.selectedVariationName,
    ...line.selections.map(item=>item.optionName),
    line.combo?.comboName,
    ...(line.combo?.selections.map(item=>item.choiceLabel)??[]),
  ].filter(Boolean);
  return parts.length?parts.join(' · '):'原味設定';
}

function lineTotal(line:CustomerCartLine){
  const unit=Number(line.publishedUnitPriceMinor);
  if(!Number.isSafeInteger(unit)||unit<0)return null;
  const total=unit*line.quantity;
  return Number.isSafeInteger(total)&&total>=0?total:null;
}

function CheckoutReviewLines({cart}:{cart:readonly CustomerCartLine[]}){
  return <div className="ui4-review-lines">{cart.map(line=>{
    const total=lineTotal(line);
    return <article key={line.lineId}>
      <div><strong>{line.productName}</strong><p>{lineSummary(line)}</p><small>數量 {line.quantity}</small></div>
      <b>{total===null?'價格待同步':money('HKD',total)}</b>
    </article>;
  })}</div>;
}

export function CheckoutUi4View({
  step,
  cart,
  quote,
  repairs,
  checkout,
  setCheckout,
  paymentChannels,
  onStep,
  onBackToJar,
  onRepair,
  onPaymentEvidence,
  onReviewConfirmed,
}:{
  step:CustomerUi4CheckoutStep;
  cart:readonly CustomerCartLine[];
  quote:CustomerQuoteSnapshot|null;
  repairs:readonly CustomerCartRepair[];
  checkout:CustomerCheckoutDraft;
  setCheckout:(value:CustomerCheckoutDraft)=>void;
  paymentChannels:readonly CustomerPaymentChannel[];
  onStep:(step:CustomerUi4CheckoutStep)=>void;
  onBackToJar:()=>void;
  onRepair:()=>void;
  onPaymentEvidence:(file:File)=>void;
  onReviewConfirmed:()=>void;
}){
  const [reviewConfirmed,setReviewConfirmed]=useState(false);
  const reviewFingerprint=JSON.stringify({
    cart,
    checkout,
    quoteId:quote?.quoteId??null,
    quoteRevision:quote?.revision??null,
    quoteFreshness:quote?.freshness??null,
    repairs:repairs.map(item=>({lineId:item.lineId,kind:item.kind,previousUnitPriceMinor:item.previousUnitPriceMinor,currentUnitPriceMinor:item.currentUnitPriceMinor})),
  });
  useEffect(()=>{setReviewConfirmed(false);},[reviewFingerprint]);
  const phoneDigits=digits(checkout.phone);
  const pickupCode=pickupCodeFromPhone(checkout.phone);
  const phoneReady=phoneDigits.length>=8;
  const selectedChannel=checkout.paymentMethod==='ELECTRONIC'
    ?paymentChannels.find(channel=>channel.channelId===checkout.paymentChannelId)
    :undefined;
  const evidenceReady=checkout.paymentEvidence?.state==='UPLOADED';
  const paymentReady=checkout.paymentMethod==='PAY_AT_STORE'||Boolean(
    selectedChannel&&
    selectedChannel.label===checkout.paymentChannelLabel&&
    selectedChannel.qrImageUrl&&
    evidenceReady
  );
  const materialChange=quote?.freshness==='MATERIAL_CHANGE'||repairs.length>0;
  const reviewReady=cart.length>0&&Boolean(quote)&&quote?.freshness==='CURRENT'&&phoneReady&&paymentReady&&!materialChange;

  return <section className="page checkout-page ui4-checkout" data-ui4-step={step}>
    <button className="back-link" onClick={step==='contact'?onBackToJar:()=>onStep(step==='payment'?'contact':'payment')}>
      {step==='contact'?'返回記憶罐':step==='payment'?'返回聯絡與取餐':'返回付款'}
    </button>
    <header className="page-intro">
      <div>
        <span className="kicker">記憶罐</span>
        <h1>{step==='contact'?'聯絡與取餐':step==='payment'?'付款':'提交前確認'}</h1>
        <p>{step==='review'?'最後睇多次餐點、取餐同付款資料。':'一步一步完成，資料有變會即時提醒你。'}</p>
      </div>
    </header>
    <CheckoutStepper step={step}/>

    {step==='contact'?<>
      <section className="ui4-checkout-card">
        <header><span>聯絡資料</span><h2>今次點稱呼你？</h2></header>
        <div className="checkout-form">
          <label htmlFor="ui4-customer-name"><span>稱呼 <small>選填</small></span><input id="ui4-customer-name" value={checkout.name} onChange={event=>setCheckout({...checkout,name:event.target.value})} autoComplete="name" placeholder="例如：陳小姐"/></label>
          <label htmlFor="ui4-customer-phone"><span>電話</span><input id="ui4-customer-phone" type="tel" inputMode="tel" value={checkout.phone} onChange={event=>setCheckout({...checkout,phone:event.target.value})} autoComplete="tel" placeholder="用作取餐人工核對"/></label>
        </div>
      </section>
      <section className="ui4-pickup-code" aria-live="polite">
        <span>取餐碼</span>
        <AnimatedValue as="strong">{pickupCode??'----'}</AnimatedValue>
        <p>取餐時可以用呢個短碼畀店員核對。</p>
      </section>
      <div className="ui4-checkout-actions">
        <ActionButton variant="secondary" onClick={onBackToJar}>返回確認商品</ActionButton>
        <ActionButton disabled={!phoneReady} onClick={()=>onStep('payment')}>下一步：付款</ActionButton>
      </div>
    </>:null}

    {step==='payment'?<>
      <section className="ui4-checkout-card">
        <header><span>付款方式</span><h2>選擇付款方式</h2></header>
        <div className="payment-method-grid">
          <button type="button" className={checkout.paymentMethod==='PAY_AT_STORE'?'active':''} onClick={()=>setCheckout({...checkout,paymentMethod:'PAY_AT_STORE',paymentChannelId:undefined,paymentChannelLabel:undefined,paymentEvidence:undefined})}><b>到店付款</b><span>取餐時再付款</span></button>
          <button type="button" className={checkout.paymentMethod==='ELECTRONIC'?'active':''} onClick={()=>setCheckout({...checkout,paymentMethod:'ELECTRONIC'})}><b>電子支付</b><span>使用店舖已發布付款方式</span></button>
        </div>
      </section>
      {checkout.paymentMethod==='ELECTRONIC'?<section className="ui4-checkout-card ui4-payment-evidence">
        <header><span>電子支付</span><h2>電子支付</h2></header>
        <div className="payment-channel-grid" role="list" aria-label="電子支付渠道">{paymentChannels.map(channel=>{
          const active=checkout.paymentChannelId===channel.channelId;
          return <button type="button" key={channel.channelId} className={active?'active':''} onClick={()=>{
            const changed=checkout.paymentChannelId!==channel.channelId;
            setCheckout({...checkout,paymentMethod:'ELECTRONIC',paymentChannelId:channel.channelId,paymentChannelLabel:channel.label,...(changed?{paymentEvidence:undefined}:{})});
          }}><b>{channel.label}</b><span>{channel.qrImageUrl?'查看付款碼':'付款碼暫未提供'}</span></button>;
        })}</div>
        {!paymentChannels.length?<p className="payment-channel-empty">店舖暫時未發布可用電子支付方式。</p>:null}
        {selectedChannel?.qrImageUrl?<div className="ui4-payment-qr"><img src={selectedChannel.qrImageUrl} alt={selectedChannel.label+' 付款 QR'}/><small>{selectedChannel.label} · 店舖查看付款碼</small></div>:selectedChannel?<div className="ui4-payment-missing">付款碼暫未提供，可以改用到店付款。</div>:null}
        <div className="payment-evidence">
          <p>完成付款後，上傳今次付款截圖畀店員核對。</p>
          <label className="evidence-picker"><span>{checkout.paymentEvidence?.fileName??'選擇付款截圖'}</span><input key={checkout.paymentEvidence?checkout.paymentEvidence.fileName+'-'+checkout.paymentEvidence.state:'empty'} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)onPaymentEvidence(file)}}/></label>
          {checkout.paymentEvidence?.state==='LOCAL_PENDING_UPLOAD'?<small>付款憑證正在上載…</small>:null}
          {checkout.paymentEvidence?.state==='UPLOADED'?<div className="ui4-evidence-submitted" role="status"><strong>已提交付款憑證</strong><span>店員會再核對付款資料。</span></div>:null}
        </div>
      </section>:null}
      <div className="ui4-checkout-actions">
        <ActionButton variant="secondary" onClick={()=>onStep('contact')}>上一步</ActionButton>
        <ActionButton disabled={!phoneReady||!paymentReady} onClick={()=>onStep('review')}>下一步：提交前確認</ActionButton>
      </div>
    </>:null}

    {step==='review'?<>
      <section className="ui4-checkout-card">
        <header><span>最後確認</span><h2>確認商品</h2></header>
        <CheckoutReviewLines cart={cart}/>
      </section>
      <section className="ui4-checkout-card ui4-review-identity">
        <header><span>聯絡與取餐</span><h2>{checkout.name.trim()||'未填稱呼'}</h2></header>
        <p>{checkout.phone||'未填電話'}</p>
        <div><span>取餐碼</span><strong>{pickupCode??'----'}</strong></div>
        <small>取餐時出示呢個短碼即可。</small>
      </section>
      <section className="ui4-checkout-card">
        <header><span>付款</span><h2>{checkout.paymentMethod==='PAY_AT_STORE'?'到店付款':selectedChannel?.label??'電子支付資料待重新確認'}</h2></header>
        {checkout.paymentMethod==='ELECTRONIC'?evidenceReady?<div className="ui4-evidence-submitted"><strong>已提交付款憑證</strong><span>店員會再核對付款資料。</span></div>:<p>付款憑證未完成。</p>:<p>取餐時再付款。</p>}
      </section>
      <section className={'ui4-review-quote '+(materialChange?'needs-attention':'')}>
        <div><span>訂單總額</span><AnimatedValue as="strong">{quote?money(quote.currency,quote.totalMinor):'價格待同步'}</AnimatedValue></div>
        <p>{quote?.freshness==='CURRENT'?'已按目前餐單重新確認。':'餐點或價格有更新，請先修正受影響項目。'}</p>
      </section>
      {materialChange?<section className="ui4-review-attention" role="alert">
        <span>需要修正</span><h2>{repairs.length?repairs.length+' 項餐點已更新':'餐點或價格有變更'}</h2>
        <div>{repairs.map(repair=><article key={repair.lineId}><strong>{repair.title}</strong><p>{repair.detail}</p>{Number.isSafeInteger(repair.previousUnitPriceMinor)&&Number.isSafeInteger(repair.currentUnitPriceMinor)?<small>{money('HKD',Number(repair.previousUnitPriceMinor))} → {money('HKD',Number(repair.currentUnitPriceMinor))}</small>:null}</article>)}</div>
        <ActionButton variant="secondary" wide onClick={onRepair}>返回記憶罐，只修受影響餐點</ActionButton>
      </section>:null}
      <section className="ui4-review-confirm">
        <span>提交前確認</span>
        <h2>{reviewConfirmed?'資料已確認':'確認今次資料'}</h2>
        <p>{reviewConfirmed?'正式安全提交同等待店舖回覆會由下一階段處理。':'呢個動作只確認 Review UI，唔會建立正式訂單、付款結果或者新提交身份。'}</p>
        <ActionButton wide disabled={!reviewReady||reviewConfirmed} onClick={()=>{setReviewConfirmed(true);onReviewConfirmed();}}>{reviewConfirmed?'已確認資料':'確認以上資料'}</ActionButton>
      </section>
      <div className="ui4-checkout-actions">
        <ActionButton variant="secondary" onClick={()=>onStep('payment')}>返回付款</ActionButton>
        <ActionButton variant="quiet" onClick={onBackToJar}>返回記憶罐</ActionButton>
      </div>
    </>:null}
  </section>;
}
