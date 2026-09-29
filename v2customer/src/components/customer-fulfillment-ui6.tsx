import {useEffect,useMemo,useState} from 'react';
import {CUSTOMER_FINAL_SOURCE} from '../source-assets';
import {ActionButton,AnimatedValue} from '../ui/primitives';
import type {
  CustomerConnectionState,
  CustomerOrderProjection,
  CustomerOrderStage,
  CustomerPendingIntent,
} from '../product-types';

type Ui6Stage='RECEIVED'|'ACCEPTED'|'PREPARING'|'DELAYED'|'READY'|'REJECTED'|'CANCELED';
type Ui6Freshness='CURRENT'|'LOADING'|'ERROR'|'OFFLINE'|'STALE'|'UNKNOWN';
type Ui6EmptyState='LOADING'|'EMPTY'|'ERROR'|'OFFLINE'|'STALE'|'UNKNOWN';

const UI6_META:Record<Ui6Stage,{label:string;eyebrow:string;title:string;detail:string;tone:'waiting'|'active'|'delay'|'ready'|'terminal'}>={
  RECEIVED:{label:'等待店舖確認',eyebrow:'訂單已成功送達',title:'等待店舖確認',detail:'店舖收到訂單後會盡快確認。',tone:'waiting'},
  ACCEPTED:{label:'製作中',eyebrow:'店舖已確認',title:'店舖已確認接單',detail:'店舖已正式接單，正準備製作。',tone:'active'},
  PREPARING:{label:'製作中',eyebrow:'製作進度',title:'餐點製作中',detail:'店舖正在製作；未到可取餐階段。',tone:'active'},
  DELAYED:{label:'稍有延誤',eyebrow:'時間更新',title:'取餐時間稍有延誤',detail:'訂單仍在製作；只顯示店舖已提供的最新時間。',tone:'delay'},
  READY:{label:'可取餐',eyebrow:'餐點已準備好',title:'可以到店取餐',detail:'可取餐只代表餐點已準備好，未代表已交收或已完成。',tone:'ready'},
  REJECTED:{label:'未能接單',eyebrow:'店舖回覆',title:'店舖今次未能接單',detail:'請按店舖原因修正餐點或重新選擇。',tone:'terminal'},
  CANCELED:{label:'已取消',eyebrow:'訂單狀態',title:'訂單已取消',detail:'呢張訂單已經取消，可以到訂單紀錄查看詳情。',tone:'terminal'},
};

const EMPTY_META:Record<Ui6EmptyState,{eyebrow:string;title:string;detail:string}>={
  LOADING:{eyebrow:'更新中',title:'正在讀取店舖狀態',detail:'稍等一陣，我哋正更新最新訂單進度。'},
  EMPTY:{eyebrow:'確認中',title:'店舖狀態等待更新',detail:'暫時未有新進度，我哋會繼續確認原本訂單。'},
  ERROR:{eyebrow:'更新失敗',title:'暫時未能讀取店舖狀態',detail:'可以重新整理；唔會因此重複落單。'},
  OFFLINE:{eyebrow:'目前離線',title:'店舖狀態暫時不可讀',detail:'恢復連線後會重新更新訂單進度。'},
  STALE:{eyebrow:'資料需要更新',title:'最近狀態未能確認',detail:'以下可能唔係最新進度，請重新整理。'},
  UNKNOWN:{eyebrow:'確認中',title:'正在確認店舖狀態',detail:'暫時未能確認最新進度，請稍後再試。'},
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
const freshnessFrom=(connection:CustomerConnectionState,browserOnline:boolean):Ui6Freshness=>{
  if(!browserOnline||connection==='NOT_CONNECTED')return 'OFFLINE';
  if(connection==='LOADING')return 'LOADING';
  if(connection==='ERROR')return 'ERROR';
  if(connection==='STALE'||connection==='PARTIAL')return 'STALE';
  if(connection==='UNKNOWN')return 'UNKNOWN';
  return 'CURRENT';
};
const emptyStateFrom=(freshness:Ui6Freshness):Ui6EmptyState=>freshness==='CURRENT'?'EMPTY':freshness;
const freshnessLabel=(freshness:Exclude<Ui6Freshness,'CURRENT'>)=>freshness==='OFFLINE'?'目前離線':freshness==='STALE'?'資料需要更新':freshness==='ERROR'?'更新失敗':freshness==='LOADING'?'更新中':'確認中';

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
      <small>店舖取餐流水號</small>
    </article>
    <article>
      <span>取餐碼</span>
      <strong>{pickupCode}</strong>
      <small>電話最後 4 位</small>
    </article>
    <p>流水號同取餐碼用途不同；到店取餐跟畫面提示出示即可。</p>
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

function ReadbackPending({
  state,
  intent,
  order,
  onRefresh,
  onOrders,
  onHome,
}:{
  state:Ui6EmptyState;
  intent:CustomerPendingIntent|null;
  order:CustomerOrderProjection|null;
  onRefresh:()=>void;
  onOrders:()=>void;
  onHome:()=>void;
}){
  const meta=EMPTY_META[state];
  return <section className={"page ui6-tracking ui6-readback-pending state-"+state.toLowerCase()} data-ui6-state={state}>
    <header className="ui6-hero">
      <img className="ui6-brand-art-slot" src={CUSTOMER_FINAL_SOURCE.maleIpSheet.url} alt="" aria-hidden="true" data-source-asset={CUSTOMER_FINAL_SOURCE.maleIpSheet.sourceFile}/>
      <span>{meta.eyebrow}</span>
      <h1>{meta.title}</h1>
      <p>{meta.detail}</p>
    </header>
    <IdentityCards order={order} intent={intent}/>
    <section className="ui6-readback-empty" aria-live="polite">
      <span>訂單進度</span>
      <strong>{state==='OFFLINE'?'目前離線':state==='ERROR'?'更新失敗':state==='STALE'?'需要更新':state==='LOADING'?'更新中':'確認中'}</strong>
      <p>未確認到新狀態之前，會保留目前畫面，唔會將「可取餐」當成「已完成」。</p>
    </section>
    <section className="ui6-actions">
      <ActionButton variant="secondary" onClick={onHome}>返首頁</ActionButton>
      <ActionButton onClick={onOrders}>查看全部訂單</ActionButton>
    </section>
    <section className="ui6-readonly-refresh">
      <button type="button" onClick={onRefresh}>重新整理</button>
      <small>只會更新訂單進度，唔會重新落單。</small>
    </section>
  </section>;
}

export function StoreFulfillmentUi6View({
  order,
  intent,
  connection,
  browserOnline,
  onRefresh,
  onOrders,
  onHome,
}:{
  order:CustomerOrderProjection|null;
  intent:CustomerPendingIntent|null;
  connection:CustomerConnectionState;
  browserOnline:boolean;
  onRefresh:()=>void;
  onOrders:()=>void;
  onHome:()=>void;
}){
  const freshness=freshnessFrom(connection,browserOnline);
  const stage=order&&isUi6Stage(order.stage)?order.stage:null;
  const unsupported=Boolean(order&&!stage);
  const elapsed=useElapsed(intent?.committedAt??intent?.updatedAt??order?.timeline?.[0]?.at??order?.observedAt);
  const timeline=useMemo(()=>(
    order?.timeline.filter(item=>isUi6Stage(item.stage)).slice(-6)??[]
  ),[order?.timeline]);

  if(!stage||!order){
    return <ReadbackPending
      state={unsupported?'UNKNOWN':emptyStateFrom(freshness)}
      intent={intent}
      order={order}
      onRefresh={onRefresh}
      onOrders={onOrders}
      onHome={onHome}
    />;
  }

  const meta=UI6_META[stage];
  const summary=order.itemSummary||intent?.cart.map(line=>line.productName+' ×'+line.quantity).join('、')||'訂單內容等待讀回';
  const terminal=stage==='REJECTED'||stage==='CANCELED';

  return <section className={"page ui6-tracking tone-"+meta.tone} data-ui6-stage={stage} data-ui6-freshness={freshness}>
    {freshness!=='CURRENT'?<section className={"ui6-freshness state-"+freshness.toLowerCase()} role="status">
      <span>{freshnessLabel(freshness)}</span>
      <p>{freshness==='OFFLINE'
        ?'目前離線；以下係最近一次已知進度。恢復連線後會重新更新。'
        :freshness==='STALE'
          ?'以下係最近一次已知進度；最新狀態仍在更新。'
          :freshness==='ERROR'
            ?'更新暫時出錯；以下保留最近一次已知進度。'
            :freshness==='LOADING'
              ?'正在更新；以下係最近一次已知進度。'
              :'最新進度仍在確認；以下保留最近一次已知狀態。'}</p>
    </section>:null}

    <header className="ui6-hero">
      <div className="ui6-brand-art-slot" data-final-art-pending="true" role="img" aria-label="磨飯品牌角色插圖位置"/>
      <span>{meta.eyebrow}</span>
      <h1>{meta.title}</h1>
      <p>{meta.detail}</p>
      {stage==='DELAYED'&&order.etaLabel?<div className="ui6-eta"><small>最新預計取餐時間</small><strong>{order.etaLabel}</strong></div>:null}
      {stage==='DELAYED'&&!order.etaLabel?<small className="ui6-no-eta">店舖未有提供新 ETA；唔會自行估算時間。</small>:null}
    </header>

    <ProgressRail stage={stage}/>

    <IdentityCards order={order} intent={intent}/>

    <section className="ui6-order-summary">
      <header><span>今次訂單</span>{order.amountLabel?<strong>{order.amountLabel}</strong>:null}</header>
      <h2>{summary}</h2>
      {order.paymentStatusLabel?<p><b>付款：</b>{order.paymentStatusLabel}</p>:null}
      {stage==='READY'?<div className="ui6-ready-note"><strong>到店請出示取餐碼</strong><span>可取餐唔代表已交收；真正交畀你之後先會完成。</span></div>:null}
      {terminal&&order.rejectionReason?<div className="ui6-terminal-reason"><span>店舖原因</span><strong>{order.rejectionReason}</strong></div>:null}
    </section>

    <section className="ui6-readback" aria-live="polite">
      <div><span>目前狀態</span><AnimatedValue as="strong">{meta.label}</AnimatedValue></div>
      <div><span>已經過</span><AnimatedValue as="strong">{elapsed}</AnimatedValue></div>
      <div><span>資料狀態</span><strong>{order.readback==='CONFIRMED'?'已更新':order.readback==='PARTIAL'?'更新中':'確認中'}</strong></div>
      <div><span>資料時間</span><strong>{formatObservedAt(order.observedAt)}</strong></div>
      <p>{freshness==='CURRENT'?'以上係店舖最新訂單進度。':'目前先顯示最近一次已知進度，資料恢復後會再更新。'}</p>
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
      <button type="button" onClick={onRefresh}>重新整理</button>
      <small>只會更新訂單進度，唔會改動訂單或重複落單。</small>
    </section>
  </section>;
}
