import type {CustomerRecommendation} from '../recommendation';
import type {
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerOrderProjection,
  CustomerOrderStage,
  CustomerProduct,
  CustomerReadModelSnapshot,
} from '../product-types';
import type {ProductOriginRect} from '../ui/primitives';
import {CUSTOMER_FINAL_SOURCE} from '../source-assets';
import './stage1.css';

const OFFICIAL_LOGO_URL=CUSTOMER_FINAL_SOURCE.logo.url;

const statusLabel=(storeAvailable:boolean|undefined)=>{
  if(storeAvailable===true)return '營業中';
  if(storeAvailable===false)return '休息中';
  return '狀態更新中';
};

const operatingHoursLabel=(snapshot:CustomerReadModelSnapshot|null)=>{
  const raw=(snapshot?.store as unknown as {todayHoursLabel?:string;hoursLabel?:string})?.todayHoursLabel
    ??(snapshot?.store as unknown as {hoursLabel?:string})?.hoursLabel;
  return String(raw||'').trim();
};

const orderStagePresentation=(stage:CustomerOrderStage)=>{
  switch(stage){
    case 'RECEIVED': return {eyebrow:'訂單已收到',title:'店舖收到喇',detail:'我哋而家確認緊，最新結果會喺呢度更新。',asset:'WAITING',tone:'waiting'} as const;
    case 'ACCEPTED': return {eyebrow:'店舖已接單',title:'今餐已經排入製作',detail:'我哋會照住最新預計時間準備。',asset:'ACCEPTED',tone:'accepted'} as const;
    case 'PREPARING': return {eyebrow:'製作中',title:'你嘅一餐，準備緊。',detail:'好好食飯，等多一陣就得。',asset:'PREPARING',tone:'preparing'} as const;
    case 'DELAYED': return {eyebrow:'稍有延誤',title:'我哋需要多少少時間。',detail:'最新預計時間會跟店舖正式更新。',asset:'DELAYED',tone:'delayed'} as const;
    case 'READY': return {eyebrow:'可以取餐',title:'好喇，可以過嚟拎喇。',detail:'到店後請按正式取餐資料交收。',asset:'READY',tone:'ready'} as const;
    case 'ARRIVED': return {eyebrow:'已到店',title:'差最後一步就拎得。',detail:'等店員核對今次取餐資料。',asset:'PICKUP',tone:'pickup'} as const;
    case 'VERIFIED':
    case 'PICKUP_VERIFICATION': return {eyebrow:'取餐核對中',title:'資料核對緊。',detail:'核對完成後先正式交餐。',asset:'PICKUP',tone:'pickup'} as const;
    case 'PICKUP_EXCEPTION': return {eyebrow:'需要幫手',title:'呢張單要店員幫你確認。',detail:'問題處理好之前，唔會當成已完成。',asset:'ATTENTION',tone:'attention'} as const;
    case 'HANDED_OVER': return {eyebrow:'已交收',title:'餐點已經交畀你。',detail:'多謝等候，記得好好食飯。',asset:'COMPLETE',tone:'complete'} as const;
    case 'COMPLETED': return {eyebrow:'已完成',title:'今餐完成喇。',detail:'下次返嚟，可以再由熟悉味道開始。',asset:'COMPLETE',tone:'complete'} as const;
    case 'REJECTED': return {eyebrow:'未能接單',title:'今次店舖未能接受訂單。',detail:'請查看正式原因，再決定下一步。',asset:'ATTENTION',tone:'attention'} as const;
    case 'CANCELED': return {eyebrow:'訂單已取消',title:'今次訂單已停止。',detail:'如有退款或後續安排，以正式記錄為準。',asset:'ATTENTION',tone:'attention'} as const;
    case 'UNKNOWN':
    default: return {eyebrow:'正在確認',title:'最新結果仲確認緊。',detail:'暫時唔會將未確認結果當成成功。',asset:'UNKNOWN',tone:'unknown'} as const;
  }
};

function Stage1StatePanel({connection,browserOnline,empty,onRetry}:{connection:CustomerConnectionState;browserOnline:boolean;empty:boolean;onRetry:()=>void}){
  if(!browserOnline)return <section className="stage1-state-panel state-offline" role="status"><strong>目前離線</strong><p>已載入內容仍可查看；恢復連線前唔會自動提交。</p></section>;
  if(connection==='ERROR')return <section className="stage1-state-panel state-error" role="alert"><strong>暫時未能更新店舖資料</strong><p>未確認資料唔會當成最新狀態。</p><button onClick={onRetry}>重新整理</button></section>;
  if(connection==='STALE'||connection==='PARTIAL')return <section className="stage1-state-panel state-stale" role="status"><strong>正顯示最近一次資料</strong><p>最新店舖內容仍在更新中。</p><button onClick={onRetry}>更新資料</button></section>;
  if(connection==='LOADING')return <section className="stage1-state-panel state-loading" role="status" aria-busy="true"><strong>正在準備首頁</strong><p>店舖狀態、公告同推薦會逐項出現。</p></section>;
  if(connection==='NOT_CONNECTED'||empty)return <section className="stage1-state-panel state-empty" role="status"><strong>暫時未有可顯示內容</strong><p>店舖資料未連接；稍後再試。</p>{connection!=='NOT_CONNECTED'?<button onClick={onRetry}>重新整理</button>:null}</section>;
  return null;
}

function AssetSlot({id,label,className}:{id:string;label:string;className:string}){
  return <span className={className} data-asset-slot={id} aria-hidden="true"><i>{label}</i></span>;
}

export function Stage1Home({
  snapshot,connection,browserOnline,activeOrders,history,recommendations,cartCount,
  onRetry,onProduct,onBrowse,onJar,onOrders,onHistory,onMember,onBuyAgain,
}:{
  snapshot:CustomerReadModelSnapshot|null;
  connection:CustomerConnectionState;
  browserOnline:boolean;
  activeOrders:readonly CustomerOrderProjection[];
  history:readonly CustomerHistoryProjection[];
  recommendations:readonly CustomerRecommendation[];
  cartCount:number;
  onRetry:()=>void;
  onProduct:(product:CustomerProduct,origin:ProductOriginRect|null)=>void;
  onBrowse:()=>void;
  onJar:()=>void;
  onOrders:()=>void;
  onHistory:()=>void;
  onMember:()=>void;
  onBuyAgain:(order:CustomerHistoryProjection)=>void;
}){
  const store=snapshot?.store;
  const member=snapshot?.member;
  const currentOrder=activeOrders[0];
  const lastOrder=history[0];
  const canBrowse=Boolean(snapshot?.menu);
  const empty=connection==='READY'&&!canBrowse;
  const todayHours=operatingHoursLabel(snapshot);
  const announcement=store?.notice?.trim();
  const topRecommendations=recommendations.filter(item=>item.product.available).slice(0,6);
  const frequentRecommendations=history.length?topRecommendations.slice(0,4):[];
  const availableCouponCount=member?.state==='READY'&&member.coupons
    ?member.coupons.filter(item=>item.state==='AVAILABLE').length
    :0;

  const activeOrderPresentation=currentOrder?orderStagePresentation(currentOrder.stage):null;
  const homeMode=currentOrder?'ORDER_ACTIVE':store?.channelAvailable===false?'CLOSED':availableCouponCount?'CAMPAIGN':history.length?'RETURNING':'NORMAL';
  const headline=homeMode==='ORDER_ACTIVE'
    ?'你嘅一餐，店舖正細心準備。'
    :homeMode==='CLOSED'
      ?'而家休息中，餐牌照常慢慢睇。'
      :homeMode==='RETURNING'
        ?'歡迎返嚟，今日都要好好食飯。'
        :homeMode==='CAMPAIGN'
          ?'有一份回憶，等你返嚟打開。'
          :'今日，都要好好食飯。';
  const subline=homeMode==='ORDER_ACTIVE'
    ?'最新進度以店舖正式回讀為準。'
    :homeMode==='CLOSED'
      ?'可以照常瀏覽、揀選同整理記憶罐。'
      :homeMode==='RETURNING'
        ?'熟悉嘅味道，同新發現都喺度。'
        :homeMode==='CAMPAIGN'
          ?'優惠內容以正式會員資料為準。'
          :'一碗好飯，裝進更多美好日常。';

  return <div className="stage1-home" data-home-mode={homeMode} data-content-state={empty?'EMPTY':connection} data-ui-phase="SKELETON">
    <header className="stage1-fixed-header">
      <button className="stage1-logo-button" type="button" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})} aria-label="返回首頁頂部">
        <img src={OFFICIAL_LOGO_URL} alt="磨飯 More Fun"/>
      </button>
      <div className="stage1-store-context">
        <strong>{store?.storeName??'磨飯'}</strong>
        {todayHours?<span>{todayHours}</span>:null}
      </div>
      <div className={'stage1-store-status is-'+(store?.channelAvailable===true?'open':store?.channelAvailable===false?'closed':'unknown')} role="status" aria-label={'店舖狀態：'+statusLabel(store?.channelAvailable)}>
        <i aria-hidden="true"/><span>{statusLabel(store?.channelAvailable)}</span>
      </div>
    </header>

    <div className="stage1-content">
      <Stage1StatePanel connection={connection} browserOnline={browserOnline} empty={empty} onRetry={onRetry}/>

      <section className="stage1-welcome">
        <span>MORE FUN · MORE GOOD DAYS</span>
        <h1>{headline}</h1>
        <p>{subline}</p>
      </section>

      <button className="stage1-search-entry" type="button" onClick={onBrowse} disabled={!canBrowse}>
        <span aria-hidden="true">⌕</span>
        <strong>{canBrowse?'搜尋想食嘅餐點…':'餐牌更新中…'}</strong>
      </button>

      {currentOrder&&activeOrderPresentation?<button className={'stage1-live-order tone-'+activeOrderPresentation.tone} type="button" onClick={onOrders} data-order-stage={currentOrder.stage} data-order-asset={activeOrderPresentation.asset}>
        <AssetSlot id="ACTIVE_ORDER_IP_SLOT" label={'IP '+activeOrderPresentation.asset} className="stage1-live-order-ip-slot"/>
        <span className="stage1-live-order-copy">
          <span className="stage1-live-label">{activeOrderPresentation.eyebrow}</span>
          <strong>{activeOrderPresentation.title}</strong>
          <p className="stage1-live-order-detail">{activeOrderPresentation.detail}</p>
          <p className="stage1-live-order-items">{currentOrder.itemSummary}</p>
          <small>{currentOrder.displayCode}{currentOrder.etaLabel?' · 預計 '+currentOrder.etaLabel:''}</small>
        </span>
        <b aria-hidden="true">›</b>
      </button>:null}

      <button className="stage1-hero-frame" type="button" disabled={!canBrowse} onClick={onBrowse} aria-label={canBrowse?'查看今日餐牌':'餐牌更新中'}>
        <AssetSlot id="HERO_BG_SLOT" label="HERO BACKGROUND" className="stage1-hero-bg-slot"/>
        <AssetSlot id="HERO_IP_SLOT" label="IP" className="stage1-hero-ip-slot"/>
        <AssetSlot id="HERO_FOOD_SLOT" label="FOOD" className="stage1-hero-food-slot"/>
        <span className="stage1-hero-copy" data-asset-slot="HERO_COPY_SAFE_AREA">
          <small>磨飯日常</small>
          <strong>好好吃飯，<br/>日子慢慢有味。</strong>
          <em>{canBrowse?'睇睇今日餐牌 →':'餐牌資料更新中'}</em>
        </span>
      </button>

      {announcement?<section className="stage1-announcement-strip" role="status">
        <AssetSlot id="ANNOUNCEMENT_ICON_SLOT" label="ICON" className="stage1-notice-icon-slot"/>
        <div><strong>店舖公告</strong><p>{announcement}</p></div>
      </section>:null}

      {homeMode==='RETURNING'&&frequentRecommendations.length?<section className="stage1-frequent-section" aria-labelledby="stage1-frequent-title">
        <div className="stage1-section-title">
          <div><h2 id="stage1-frequent-title">常購清單</h2><small>熟悉味道 · 直接由現有推薦資料顯示</small></div>
          <button type="button" onClick={onHistory}>查看全部</button>
        </div>
        <div className="stage1-frequent-row">
          {frequentRecommendations.map(item=><button key={item.product.productId} type="button" onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(item.product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});}}>
            <AssetSlot id="FREQUENT_PRODUCT_IMAGE_SLOT" label="IMAGE" className="stage1-frequent-media-slot"/>
            <strong>{item.product.name}</strong>
          </button>)}
        </div>
      </section>:null}

      {store?.channelAvailable===false?<section className="stage1-closed-panel">
        <AssetSlot id="CLOSED_STATE_ICON_SLOT" label="ICON" className="stage1-closed-icon-slot"/>
        <div><span>休息中</span><strong>餐牌照常開放</strong><p>你仍可揀餐、選配搭同整理記憶罐。</p>{todayHours?<small>今日營業時間 · {todayHours}</small>:null}</div>
        <button type="button" disabled={!canBrowse} onClick={onBrowse}>{canBrowse?'查看餐牌':'餐牌更新中'}</button>
      </section>:null}

      {availableCouponCount?<button className="stage1-promo-banner" type="button" onClick={onMember}>
        <AssetSlot id="CAMPAIGN_ICON_SLOT" label="ICON" className="stage1-promo-icon-slot"/>
        <div><small>記憶券</small><strong>{availableCouponCount} 張回憶券等緊你</strong><span>查看正式內容 →</span></div>
      </button>:null}

      <section className="stage1-quick-entry-section" aria-labelledby="stage1-quick-entry-title">
        <div className="stage1-section-title"><h2 id="stage1-quick-entry-title">快速去到</h2></div>
        <div className="stage1-quick-entry-grid">
          <button type="button" onClick={onMember}>
            <AssetSlot id="MEMORY_TICKET_ICON_SLOT" label="ICON" className="stage1-quick-icon-slot"/>
            <strong>記憶券</strong>{availableCouponCount?<small>{availableCouponCount} 張可用</small>:<small>會員心意</small>}
          </button>
          <button type="button" onClick={onHistory}>
            <AssetSlot id="FREQUENT_ICON_SLOT" label="ICON" className="stage1-quick-icon-slot"/>
            <strong>常購清單</strong><small>{history.length?'搵返熟悉味道':'留低常買味道'}</small>
          </button>
          <button type="button" onClick={onBrowse} disabled={!canBrowse}>
            <AssetSlot id="LIMITED_ICON_SLOT" label="ICON" className="stage1-quick-icon-slot"/>
            <strong>期間限定</strong><small>{canBrowse?'睇今期新意':'餐牌更新中'}</small>
          </button>
        </div>
      </section>

      <section className="stage1-top6" aria-labelledby="stage1-top6-title">
        <div className="stage1-section-title">
          <div><h2 id="stage1-top6-title">為你推薦</h2><small>最多 6 款 · 以最新餐牌為準</small></div>
          <button type="button" onClick={onBrowse} disabled={!canBrowse}>查看全部</button>
        </div>

        {topRecommendations.length?<div className="stage1-top6-grid">
          {topRecommendations.map(item=><button
            type="button" className="stage1-product-card" key={item.product.productId} data-product-id={item.product.productId}
            onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();onProduct(item.product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});}}
          >
            <AssetSlot id="TOP6_PRODUCT_IMAGE_SLOT" label="PRODUCT IMAGE" className="stage1-product-media-slot"/>
            <span className="stage1-product-info" data-asset-slot="TOP6_PRODUCT_TEXT_SLOT">
              <small>{item.reasonLabel}</small>
              <strong>{item.product.name}</strong>
              <em>{item.product.displayPriceLabel??'價格稍後顯示'}</em>
            </span>
          </button>)}
        </div>:<div className="stage1-top6-empty" role="status">
          <strong>今日推薦整理中</strong><span>未有有效推薦；可以先看看完整餐牌。</span>
          <button type="button" onClick={onBrowse} disabled={!canBrowse}>查看餐牌</button>
        </div>}
      </section>

      <section className="stage1-memory-strip" aria-label="今餐與回憶">
        <button type="button" onClick={onJar}><span>記憶罐</span><strong>{cartCount?cartCount+' 件餐點':'今餐未開始'}</strong></button>
        {lastOrder?<button type="button" onClick={()=>onBuyAgain(lastOrder)}><span>上次食過</span><strong>{lastOrder.itemSummary}</strong></button>:<button type="button" onClick={onHistory}><span>我的回憶</span><strong>完成第一張訂單後會出現</strong></button>}
      </section>
    </div>
  </div>;
}
