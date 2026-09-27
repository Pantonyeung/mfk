import {useEffect,useMemo,useState} from 'react';
import {ActionButton,AnimatedValue} from '../ui/primitives';
import type {
  CustomerConnectionState,
  CustomerOrderProjection,
  CustomerOrderStage,
  CustomerPendingIntent,
} from '../product-types';

type Ui6Stage='RECEIVED'|'ACCEPTED'|'PREPARING'|'DELAYED'|'READY'|'REJECTED'|'CANCELED';

const UI6_META:Record<Ui6Stage,{label:string;eyebrow:string;title:string;detail:string;tone:'waiting'|'active'|'delay'|'ready'|'terminal'}>={
  RECEIVED:{label:'等待店舖確認',eyebrow:'訂單已送達',title:'等待店舖確認',detail:'正式訂單已建立；目前只讀取店舖 canonical 狀態。',tone:'waiting'},
  ACCEPTED:{label:'製作中',eyebrow:'店舖已確認',title:'店舖已確認接單',detail:'店舖已正式接單，正準備製作。',tone:'active'},
  PREPARING:{label:'製作中',eyebrow:'製作進度',title:'餐點製作中',detail:'店舖正在製作；未到可取餐階段。',tone:'active'},
  DELAYED:{label:'稍有延誤',eyebrow:'時間更新',title:'取餐時間稍有延誤',detail:'訂單仍在製作；只顯示店舖已提供的最新時間。',tone:'delay'},
  READY:{label:'可取餐',eyebrow:'餐點已準備好',title:'可以到店取餐',detail:'可取餐只代表餐點已準備好，未代表已交收或已完成。',tone:'ready'},
  REJECTED:{label:'未能接單',eyebrow:'店舖回覆',title:'店舖今次未能接單',detail:'呢個係店舖正式回覆；系統唔會自動重新提交。',tone:'terminal'},
  CANCELED:{label:'已取消',eyebrow:'訂單狀態',title:'訂單已取消',detail:'取消係正式訂單狀態；系統唔會因取消而重新提交。',tone:'terminal'},
};

const isUi6Stage=(value:CustomerOrderStage):value is Ui6Stage=>Object.prototype.hasOwnProperty.call(UI6_META,value);
const digits=(value:string)=>value.replace(/\D/g,'');
const pickupCodeFromPhone=(phone:string)=>{
  const value=digits(phone);
  return value.length>=4?value.slice(-4):null;
};
const formatObservedAt=(value:string|undefined)=>{
  if(!value)return '等待讀回';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return value;
  return new Intl.DateTimeFormat('zh-HK',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
};

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

function IdentityCards({order,intent}:{order:CustomerOrderProjection|null;intent:CustomerPendingIntent|null}){
  const pickupCode=order?.pickupCode??pickupCodeFromPhone(intent?.checkout.phone??'')??'----';
  const displayCode=order?.displayCode??intent?.canonicalDisplay??'同步中';
  return <section className="ui6-identities" aria-label="訂單識別資料">
    <article>
      <span>流水號</span>
      <strong>{displayCode}</strong>
      <small>店舖正式 Display Number</small>
    </article>
    <article>
      <span>取餐碼</span>
      <strong>{pickupCode}</strong>
      <small>電話最後 4 位</small>
    </article>
    <p>流水號同取餐碼用途不同；Order ID 只留系統內部關聯，唔會顯示實際值或 UUID。</p>
  </section>;
}

function ProgressRail({stage}:{stage:Ui6Stage}){
  if(stage==='REJECTED'||stage==='CANCELED')return null;
  const rank:Record<Exclude<Ui6Stage,'REJECTED'|'CANCELED'>,number>={
    RECEIVED:0,ACCEPTED:1,PREPARING:1,DELAYED:1,READY:2,
  };
  const current=rank[stage];
  const steps=['店舖確認','製作中','可取餐'];
  return <ol className="ui6-progress" aria-label="訂單進度">
    {steps.map((label,index)=><li key={label} className={index<current?'done':index===current?'active':''}>
      <i aria-hidden="true"/><span>{label}</span>
    </li>)}
  </ol>;
}

export function StoreFulfillmentUi6View({
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
  const rawStage=order?.stage??'RECEIVED';
  const stage:Ui6Stage=isUi6Stage(rawStage)?rawStage:'RECEIVED';
  const meta=UI6_META[stage];
  const elapsed=useElapsed(intent?.committedAt??intent?.updatedAt??order?.timeline?.[0]?.at??order?.observedAt);
  const stale=connection==='STALE'||connection==='PARTIAL'||connection==='UNKNOWN'||connection==='ERROR'||connection==='NOT_CONNECTED';
  const timeline=useMemo(()=>(
    order?.timeline.filter(item=>isUi6Stage(item.stage)).slice(-6)??[]
  ),[order?.timeline]);
  const summary=order?.itemSummary||intent?.cart.map(line=>line.productName+' ×'+line.quantity).join('、')||'訂單內容等待讀回';
  const terminal=stage==='REJECTED'||stage==='CANCELED';

  return <section className={"page ui6-tracking tone-"+meta.tone} data-ui6-stage={stage}>
    <header className="ui6-hero">
      <span>{meta.eyebrow}</span>
      <h1>{meta.title}</h1>
      <p>{meta.detail}</p>
      {stage==='DELAYED'&&order?.etaLabel?<div className="ui6-eta"><small>最新預計取餐時間</small><strong>{order.etaLabel}</strong></div>:null}
      {stage==='DELAYED'&&!order?.etaLabel?<small className="ui6-no-eta">店舖未有提供新 ETA；唔會自行估算時間。</small>:null}
    </header>

    <ProgressRail stage={stage}/>

    <IdentityCards order={order} intent={intent}/>

    <section className="ui6-order-summary">
      <header><span>今次訂單</span>{order?.amountLabel?<strong>{order.amountLabel}</strong>:null}</header>
      <h2>{summary}</h2>
      {order?.paymentStatusLabel?<p><b>付款：</b>{order.paymentStatusLabel}</p>:null}
      {stage==='READY'?<div className="ui6-ready-note"><strong>到店請出示取餐碼</strong><span>Ready ≠ Completed；UI6 冇「完成交收」操作。</span></div>:null}
      {terminal&&order?.rejectionReason?<div className="ui6-terminal-reason"><span>店舖原因</span><strong>{order.rejectionReason}</strong></div>:null}
    </section>

    <section className="ui6-readback" aria-live="polite">
      <div><span>目前狀態</span><AnimatedValue as="strong">{meta.label}</AnimatedValue></div>
      <div><span>已經過</span><AnimatedValue as="strong">{elapsed}</AnimatedValue></div>
      <div><span>讀回</span><strong>{order?.readback??'等待讀回'}</strong></div>
      <div><span>資料時間</span><strong>{formatObservedAt(order?.observedAt)}</strong></div>
      <p>{stale?'而家顯示最近一次 canonical readback；網絡恢復後只會重新讀狀態，唔會重新提交訂單。':'狀態來自店舖 canonical Order / Fulfillment projection。'}</p>
    </section>

    {timeline.length?<section className="ui6-timeline">
      <span>狀態紀錄</span>
      <ol>{timeline.map((item,index)=>{
        const label=isUi6Stage(item.stage)?UI6_META[item.stage].label:item.label;
        return <li key={item.at+'-'+index}><i aria-hidden="true"/><div><strong>{label}</strong>{item.detail?<small>{item.detail}</small>:null}</div><time>{formatObservedAt(item.at)}</time></li>;
      })}</ol>
    </section>:null}

    <section className="ui6-actions">
      <ActionButton variant="secondary" onClick={onHome}>返首頁</ActionButton>
      <ActionButton onClick={onOrders}>查看全部訂單</ActionButton>
    </section>

    <section className="ui6-readonly-refresh">
      <button type="button" onClick={onRefresh}>只讀 Refresh</button>
      <small>只查 canonical Status；唔會 Accept、改 Fulfillment、標記 Ready／Completed，亦唔會重新 Submit。</small>
    </section>
  </section>;
}
