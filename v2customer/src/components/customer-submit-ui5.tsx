import {useEffect,useMemo,useState} from 'react';
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
    <footer><span>提交前已發布總額</span><strong>{Number.isSafeInteger(Number(intent.publishedTotalMinor))?money(Number(intent.publishedTotalMinor)):'價格待同步'}</strong></footer>
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
      <span>UI5 · SUBMIT</span>
      <h1>{state==='UNKNOWN'?'正在確認原本提交':state==='NOT_CONNECTED'?'轉用人工救援':state==='REJECTED'?'需要重新確認餐點':submitting||state==='PENDING'?'正在安全送出':'準備送出今次訂單'}</h1>
      <p>{state==='UNKNOWN'
        ?'提交結果未明；只會查詢原本提交身份，請勿重複提交。'
        :state==='NOT_CONNECTED'
          ?'自動接單未能完成；舊 Online Submit 已鎖定，唔會背景補送或者網絡恢復後偷偷再送。'
          :state==='REJECTED'
            ?'店舖未能接受今次提交。返回記憶罐只修正受影響內容，再重新確認。'
            :'正式 Order 仍由 SMT 建立；呢一步只會沿用同一 Checkout Intent、Submission Identity 同 idempotency。'}</p>
    </header>

    <section className="ui5-identity-boundary">
      <div><span>取餐碼</span><strong>{pickupCode??'----'}</strong><small>電話最後 4 位</small></div>
      {state==='NOT_CONNECTED'?<div><span>人工參考碼</span><strong>{intent.fallbackReference}</strong><small>只用於 WhatsApp 人工救援</small></div>:null}
      <p>取餐碼 ≠ 流水號 ≠ 人工參考碼 ≠ Order ID。畫面唔會顯示 UUID 或內部識別碼。</p>
    </section>

    <OrderSummary intent={intent}/>

    <section className="ui5-submit-progress" aria-live="polite">
      <div className="ui5-submit-orbit" aria-hidden="true"><i/><i/><i/></div>
      <span>同一提交身份</span>
      <h2>{submitProbe?'第 '+probeAttempt+' / '+probeTotal+' 次接單檢查':state==='PENDING'?'SMT 正在處理同一提交':state==='DRAFT'?'未開始安全提交':state==='UNKNOWN'?'原本提交等待 Readback':'提交路徑已鎖定'}</h2>
      <p>{submitProbe
        ?'每次檢查都屬同一個 Checkout Intent；唔會建立三張訂單。'
        :state==='PENDING'
          ?'按鈕保持鎖定；只等待現有提交取得 canonical 結果。'
          :state==='DRAFT'
            ?'確認後先送出；Duplicate tap 會被同步鎖定。'
            :'任何下一步都唔會重新建立另一個提交身份。'}</p>
      <div className="ui5-attempt-dots" aria-label={'提交進度 '+probeAttempt+' / '+probeTotal}>
        {Array.from({length:probeTotal},(_,index)=><i key={index} className={index<probeAttempt?'done':''}/>)}
      </div>
    </section>

    {intent.checkout.paymentMethod==='ELECTRONIC'?<section className="ui5-proof-state">
      <span>付款憑證</span>
      <strong>{intent.checkout.paymentEvidence?.state==='UPLOADED'?'已提交付款憑證':'付款憑證狀態待重新確認'}</strong>
      <p>付款截圖只係 Evidence；付款結果仍待 SMT / 店員正式核對。</p>
    </section>:null}

    {state==='UNKNOWN'?<section className="ui5-unknown" role="alert">
      <span>SUBMISSION UNKNOWN</span>
      <h2>請勿重複提交</h2>
      <p>{intent.lastMessage??'原本落單要求可能已送達。只讀回原本提交結果，禁止建立第二張單。'}</p>
      <ActionButton wide loading={reading} onClick={onReadback}>重新確認原本提交</ActionButton>
    </section>:null}

    {state==='NOT_CONNECTED'?<section className="ui5-fallback" role="alert">
      <span>WHATSAPP FALLBACK</span>
      <h2>自動接單暫時不可用</h2>
      <p>{intent.lastMessage??'已完成有限接單檢查；Online Submit 已鎖定。'}</p>
      <div><span>人工參考碼</span><strong>{intent.fallbackReference}</strong></div>
      <ActionButton wide disabled={!fallbackAvailable} onClick={onFallback}>{fallbackAvailable?'打開 WhatsApp 人工落單':'店舖暫未設定 WhatsApp'}</ActionButton>
      <small>打開 WhatsApp 之後仍然零背景重送、零延遲重送、零 reconnect auto-submit。</small>
    </section>:null}

    {state==='REJECTED'?<section className="ui5-rejected" role="alert">
      <span>REJECTED</span><h2>店舖未能接受今次訂單</h2>
      <p>{intent.lastMessage??'返回記憶罐重新確認目前餐牌、供應或價格。'}</p>
      <ActionButton wide onClick={onBackToJar}>返回記憶罐</ActionButton>
    </section>:null}

    {state==='DRAFT'||state==='PENDING'?<section className="ui5-primary-submit">
      <ActionButton wide loading={submitting||state==='PENDING'} disabled={locked} onClick={onSubmit}>
        {submitting||state==='PENDING'?'正在安全送出':'確認並送出訂單'}
      </ActionButton>
      <button type="button" disabled={submitting||state==='PENDING'} onClick={onBackReview}>返回提交前確認</button>
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
      <div className="ui5-waiting-orbit" aria-hidden="true"><i/><i/><i/></div>
      <span>{canonicalDelivered?'訂單已成功送達':'正在讀回原本訂單'}</span>
      <h1>{waiting?'等待店舖確認':'店舖狀態已更新'}</h1>
      <p>{waiting
        ?'SMT 已建立正式訂單；而家只會讀取 canonical 狀態，絕不因等待而再次 Submit。'
        :'店舖已離開「等待確認」階段。UI5 唔會自行推斷後續流程，請到訂單頁查看正式狀態。'}</p>
    </header>

    <section className="ui5-waiting-status" aria-live="polite">
      <div><span>已等待</span><AnimatedValue as="strong">{elapsed}</AnimatedValue></div>
      <div><span>讀回狀態</span><strong>{order?.readback??(canonicalDelivered?'CONFIRMED CACHE':'UNKNOWN')}</strong></div>
      <p>{connection==='STALE'||connection==='PARTIAL'||connection==='UNKNOWN'?'目前顯示最近一次正式讀回；Refresh 只查狀態。':'Realtime / 現有同步會更新；手動 Refresh 亦只查狀態。'}</p>
    </section>

    <section className="ui5-order-identities">
      <article><span>流水號</span><strong>{displayCode}</strong><small>店舖正式 Display Number</small></article>
      <article><span>取餐碼</span><strong>{pickupCode}</strong><small>電話最後 4 位</small></article>
      <p>流水號同取餐碼係兩個不同用途；畫面唔會顯示 Order ID / UUID。</p>
    </section>

    <section className="ui5-waiting-summary">
      <span>Order Summary</span><h2>{summary}</h2>
      {order?.amountLabel?<strong>{order.amountLabel}</strong>:Number.isSafeInteger(Number(intent?.publishedTotalMinor))?<strong>{money(Number(intent?.publishedTotalMinor))}</strong>:null}
    </section>

    <section className="ui5-safe-leave">
      <span>可以離開呢一頁</span>
      <h2>{waiting?'我哋會繼續等店舖正式確認':'最新狀態已經可以喺訂單頁查看'}</h2>
      <p>離開畫面唔會取消訂單，亦唔會觸發重新 Submit。</p>
      <div>
        <ActionButton variant="secondary" onClick={onHome}>返首頁</ActionButton>
        <ActionButton onClick={onOrders}>查看訂單</ActionButton>
      </div>
    </section>

    <section className="ui5-readonly-refresh">
      <button type="button" onClick={onRefresh}>只讀 Refresh</button>
      <small>Refresh 只查 Status，永遠唔會重新 Submit。</small>
    </section>
  </section>;
}
