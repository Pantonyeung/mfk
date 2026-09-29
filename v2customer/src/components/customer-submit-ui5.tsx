import {useEffect,useMemo,useState} from 'react';
import {CUSTOMER_FINAL_SOURCE} from '../source-assets';
import {ActionButton,AnimatedValue} from '../ui/primitives';
import type {
  CustomerConnectionState,
  CustomerOrderProjection,
  CustomerPendingIntent,
} from '../product-types';

const money=(minor:number)=>new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'}).format(minor/100);
const digits=(value:string)=>value.replace(/\D/g,'');
const pickupCodeFromPhone=(phone:string)=>{
  const value=digits(phone);
  return value.length>=4?value.slice(-4):null;
};

function intentSummary(intent:CustomerPendingIntent){
  return intent.cart.map(line=>{
    const optionNames=[
      line.selectedVariationName,
      ...line.selections.map(item=>item.optionName),
      line.combo?.comboName,
      ...(line.combo?.selections.map(item=>item.choiceLabel)??[]),
    ].filter(Boolean);
    return {
      lineId:line.lineId,
      name:line.productName,
      quantity:line.quantity,
      detail:optionNames.join(' · '),
    };
  });
}

function useElapsed(from:string|undefined){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[]);
  const start=from?Date.parse(from):NaN;
  if(!Number.isFinite(start))return '剛剛';
  const seconds=Math.max(0,Math.floor((now-start)/1000));
  if(seconds<60)return seconds+' 秒';
  const minutes=Math.floor(seconds/60);
  if(minutes<60)return minutes+' 分 '+String(seconds%60).padStart(2,'0')+' 秒';
  return Math.floor(minutes/60)+' 小時 '+String(minutes%60).padStart(2,'0')+' 分';
}

function OrderSummary({intent}:{intent:CustomerPendingIntent}){
  const rows=useMemo(()=>intentSummary(intent),[intent]);
  return <section className="ui5-summary">
    <header><span>今次餐點</span><strong>{intent.cart.reduce((sum,line)=>sum+line.quantity,0)} 件</strong></header>
    <div>{rows.map(row=><article key={row.lineId}><div><b>{row.name}</b>{row.detail?<small>{row.detail}</small>:null}</div><em>×{row.quantity}</em></article>)}</div>
    <footer><span>訂單總額</span><strong>{Number.isSafeInteger(Number(intent.publishedTotalMinor))?money(Number(intent.publishedTotalMinor)):'價格更新中'}</strong></footer>
  </section>;
}

export function SubmitUi5View({
  intent,
  submitting,
  submitProbe,
  reading,
  fallbackAvailable,
  onSubmit,
  onReadback,
  onFallback,
  onBackReview,
  onBackToJar,
}:{
  intent:CustomerPendingIntent;
  submitting:boolean;
  submitProbe:Readonly<{attempt:number;total:number}>|null;
  reading:boolean;
  fallbackAvailable:boolean;
  onSubmit:()=>void;
  onReadback:()=>void;
  onFallback:()=>void;
  onBackReview:()=>void;
  onBackToJar:()=>void;
}){
  const pickupCode=pickupCodeFromPhone(intent.checkout.phone);
  const probeAttempt=submitProbe?.attempt??(submitting?1:0);
  const probeTotal=submitProbe?.total??3;
  const state=intent.state;
  const locked=state==='PENDING'||state==='UNKNOWN'||state==='NOT_CONNECTED'||state==='REJECTED'||state==='DELIVERED';

  return <section className="page ui5-submit" data-ui5-route="submit" data-submit-state={state}>
    <header className="ui5-hero">
      <img className="ui5-brand-art-slot" src={CUSTOMER_FINAL_SOURCE.femaleIpSheet.url} alt="" aria-hidden="true" data-source-asset={CUSTOMER_FINAL_SOURCE.femaleIpSheet.sourceFile}/>
      <span>安全提交</span>
      <h1>{state==='UNKNOWN'?'未收到即時回覆':state==='NOT_CONNECTED'?'可以轉用 WhatsApp':state==='REJECTED'?'需要重新確認餐點':submitting||state==='PENDING'?'正在送出訂單…':'準備送出今次訂單'}</h1>
      <p>{state==='UNKNOWN'
        ?'可能已經送達店舖；我哋只會確認原本嗰次落單，請勿重複提交。'
        :state==='NOT_CONNECTED'
          ?'自動送單暫時未完成；唔會喺背景偷偷重複落單。'
          :state==='REJECTED'
            ?'店舖未能接受今次提交。返回記憶罐只修正受影響內容，再重新確認。'
            :'確認後只會送出今次同一張訂單；重複點擊唔會建立多一張。'}</p>
    </header>

    <section className="ui5-identity-boundary">
      <div><span>取餐碼</span><strong>{pickupCode??'----'}</strong><small>電話最後 4 位</small></div>
      {state==='NOT_CONNECTED'?<div><span>人工參考碼</span><strong>{intent.fallbackReference}</strong><small>只用於 WhatsApp 人工救援</small></div>:null}
      <p>取餐碼、流水號同人工參考碼用途不同；取餐時跟畫面提示出示即可。</p>
    </section>

    <OrderSummary intent={intent}/>

    <section className="ui5-submit-progress" aria-live="polite">
      <div className="ui5-submit-orbit" aria-hidden="true"><i/><i/><i/></div>
      <span>送單進度</span>
      <h2>{submitProbe?'正在確認店舖連線 '+probeAttempt+' / '+probeTotal:state==='PENDING'?'正在送到店舖':state==='DRAFT'?'準備送出':state==='UNKNOWN'?'正在確認原本訂單':'送單狀態已更新'}</h2>
      <p>{submitProbe
        ?'幾次連線檢查都只係確認同一張訂單，唔會重複建立。'
        :state==='PENDING'
          ?'送出後按鈕會暫時鎖定，等店舖回覆結果。'
          :state==='DRAFT'
            ?'確認後先送出；連續點擊亦只會處理一次。'
            :'下一步只會跟住原本嗰次落單繼續。'}</p>
      <div className="ui5-attempt-dots" aria-label={'提交進度 '+probeAttempt+' / '+probeTotal}>
        {Array.from({length:probeTotal},(_,index)=><i key={index} className={index<probeAttempt?'done':''}/>)}
      </div>
    </section>

    {intent.checkout.paymentMethod==='ELECTRONIC'?<section className="ui5-proof-state">
      <span>付款憑證</span>
      <strong>{intent.checkout.paymentEvidence?.state==='UPLOADED'?'已提交付款憑證':'付款憑證狀態待重新確認'}</strong>
      <p>付款截圖已交畀店員核對，最終以店舖確認為準。</p>
    </section>:null}

    {state==='UNKNOWN'?<section className="ui5-unknown" role="alert">
      <span>未收到即時回覆</span>
      <h2>請勿重複提交</h2>
      <p>{intent.lastMessage??'原本落單可能已經送達；我哋只會確認原本嗰次結果。'}</p>
      <ActionButton wide loading={reading} onClick={onReadback}>重新確認原本提交</ActionButton>
    </section>:null}

    {state==='NOT_CONNECTED'?<section className="ui5-fallback" role="alert">
      <span>WhatsApp 人工協助</span>
      <h2>自動接單暫時不可用</h2>
      <p>{intent.lastMessage??'自動送單暫時未完成，可以用 WhatsApp 聯絡店舖。'}</p>
      <div><span>人工參考碼</span><strong>{intent.fallbackReference}</strong></div>
      <ActionButton wide disabled={!fallbackAvailable} onClick={onFallback}>{fallbackAvailable?'打開 WhatsApp 人工落單':'店舖暫未設定 WhatsApp'}</ActionButton>
      <small>轉用 WhatsApp 後，系統唔會喺背景再重複送單。</small>
    </section>:null}

    {state==='REJECTED'?<section className="ui5-rejected" role="alert">
      <span>店舖回覆</span><h2>店舖未能接受今次訂單</h2>
      <p>{intent.lastMessage??'返回記憶罐重新確認目前餐牌、供應或價格。'}</p>
      <ActionButton wide onClick={onBackToJar}>返回記憶罐</ActionButton>
    </section>:null}

    {state==='DRAFT'||state==='PENDING'?<section className="ui5-primary-submit">
      <ActionButton wide loading={submitting||state==='PENDING'} disabled={locked} onClick={onSubmit}>
        {submitting||state==='PENDING'?'正在送出訂單…':'確認並送出訂單'}
      </ActionButton>
      <button type="button" disabled={submitting||state==='PENDING'} onClick={onBackReview}>返回最後確認</button>
    </section>:null}
  </section>;
}

export function WaitingStoreConfirmationUi5View({
  order,
  intent,
  connection,
  onRefresh,
  onOrders,
  onHome,
}:{
  order:CustomerOrderProjection|null;
  intent:CustomerPendingIntent|null;
  connection:CustomerConnectionState;
  onRefresh:()=>void;
  onOrders:()=>void;
  onHome:()=>void;
}){
  const elapsed=useElapsed(intent?.committedAt??intent?.updatedAt??order?.observedAt);
  const pickupCode=pickupCodeFromPhone(intent?.checkout.phone??'')??order?.pickupCode??'----';
  const displayCode=order?.displayCode??intent?.canonicalDisplay??'同步中';
  const stage=order?.stage??'RECEIVED';
  const waiting=stage==='RECEIVED';
  const summary=order?.itemSummary??intent?.cart.map(line=>line.productName+' ×'+line.quantity).join('、')??'訂單內容同步中';
  const canonicalDelivered=Boolean(order)||intent?.state==='DELIVERED';

  return <section className="page ui5-waiting" data-ui5-route="waiting" data-order-stage={stage}>
    <header className="ui5-waiting-hero">
      <img className="ui5-brand-art-slot" src={CUSTOMER_FINAL_SOURCE.femaleIpSheet.url} alt="" aria-hidden="true" data-source-asset={CUSTOMER_FINAL_SOURCE.femaleIpSheet.sourceFile}/>
      <span>安全提交</span>
      <small>{canonicalDelivered?'訂單已成功送達':'正在確認原本訂單'}</small>
      <h1>{waiting?'等待店舖確認':'店舖狀態已更新'}</h1>
      <p>{waiting
        ?'訂單已經送到店舖；等候期間唔會重複落單。'
        :'店舖狀態已更新，請到訂單頁查看最新進度。'}</p>
    </header>

    <section className="ui5-waiting-status" aria-live="polite">
      <div><span>已等待</span><AnimatedValue as="strong">{elapsed}</AnimatedValue></div>
      <div><span>最新狀態</span><strong>{order?.readback==='CONFIRMED'?'已更新':order?.readback==='PARTIAL'?'更新中':canonicalDelivered?'已送達':'確認中'}</strong></div>
      <p>{connection==='STALE'||connection==='PARTIAL'||connection==='UNKNOWN'?'目前顯示最近一次已知狀態；重新整理只會更新進度。':'有新進度會自動更新；亦可以手動重新整理。'}</p>
    </section>

    <section className="ui5-order-identities">
      <article><span>流水號</span><strong>{displayCode}</strong><small>店舖取餐流水號</small></article>
      <article><span>取餐碼</span><strong>{pickupCode}</strong><small>電話最後 4 位</small></article>
      <p>流水號同取餐碼用途不同；到店取餐跟畫面提示出示即可。</p>
    </section>

    <section className="ui5-waiting-summary">
      <span>今次餐點</span><h2>{summary}</h2>
      {order?.amountLabel?<strong>{order.amountLabel}</strong>:Number.isSafeInteger(Number(intent?.publishedTotalMinor))?<strong>{money(Number(intent?.publishedTotalMinor))}</strong>:null}
    </section>

    <section className="ui5-safe-leave">
      <span>可以離開呢一頁</span>
      <h2>{waiting?'我哋會繼續等店舖正式確認':'最新狀態已經可以喺訂單頁查看'}</h2>
      <p>離開呢一頁唔會取消訂單，亦唔會重複落單。</p>
      <div>
        <ActionButton variant="secondary" onClick={onHome}>返首頁</ActionButton>
        <ActionButton onClick={onOrders}>查看訂單詳情</ActionButton>
      </div>
    </section>

    <section className="ui5-readonly-refresh">
      <button type="button" onClick={onRefresh}>重新整理</button>
      <small>只會更新訂單狀態，唔會重新送單。</small>
    </section>
  </section>;
}
