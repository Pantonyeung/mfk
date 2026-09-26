import type {CustomerRecommendation} from '../recommendation';
import type {
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerOrderProjection,
  CustomerProduct,
  CustomerReadModelSnapshot,
} from '../product-types';
import type {ProductOriginRect} from '../ui/primitives';
import './stage1.css';

const OFFICIAL_LOGO_URL='https://cdn.creativeclaw.co/u/6ad84d58/images/402357b6-d757-4238-99f7-3d20607da6f2.png';
const AI_GENERATED_STAGE1_ART='https://cdn.creativeclaw.co/u/6ad84d58/images/57ce2f93-c8d0-491d-9bd0-23a2be364d14.png';

const statusLabel=(storeAvailable:boolean|undefined)=>{
  if(storeAvailable===true)return '營業中';
  if(storeAvailable===false)return '暫停正式落單';
  return '同步中';
};

function Stage1StatePanel({
  connection,
  browserOnline,
  error,
  onRetry,
}:{
  connection:CustomerConnectionState;
  browserOnline:boolean;
  error:string|null;
  onRetry:()=>void;
}){
  if(!browserOnline)return <section className="stage1-state-panel state-offline" role="status"><strong>目前離線</strong><p>已載入內容可以繼續查看；正式提交仍會喺正確交易邊界再次確認。</p></section>;
  if(connection==='ERROR')return <section className="stage1-state-panel state-error" role="alert"><strong>暫時未能同步店舖資料</strong><p>{error||'請檢查連線後再試。'}</p><button onClick={onRetry}>重新同步</button></section>;
  if(connection==='STALE'||connection==='PARTIAL')return <section className="stage1-state-panel state-stale" role="status"><strong>正顯示最近一次資料</strong><p>最新店舖狀態仍在更新；價格、供應及提交會喺後續正確邊界再確認。</p><button onClick={onRetry}>更新資料</button></section>;
  if(connection==='NOT_CONNECTED')return <section className="stage1-state-panel state-empty" role="status"><strong>店舖服務尚未連接</strong><p>首頁只顯示已有正式資料，不會用假價格、假商品或假營業狀態補位。</p></section>;
  if(connection==='LOADING')return <section className="stage1-state-panel state-loading" role="status" aria-busy="true"><strong>正在準備首頁</strong><p>店舖狀態、公告同推薦會逐項出現。</p></section>;
  return null;
}

function Stage1ProductPlaceholder({product}:{product:CustomerProduct}){
  return <span className="stage1-product-placeholder" aria-hidden="true">
    <span>{product.name.slice(0,1)}</span>
  </span>;
}

export function Stage1Home({
  snapshot,
  connection,
  browserOnline,
  error,
  activeOrders,
  history,
  recommendations,
  cartCount,
  onRetry,
  onProduct,
  onBrowse,
  onJar,
  onOrders,
  onHistory,
  onMember,
  onBuyAgain,
  onFallback,
}:{
  snapshot:CustomerReadModelSnapshot|null;
  connection:CustomerConnectionState;
  browserOnline:boolean;
  error:string|null;
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
  onFallback:()=>void;
}){
  const store=snapshot?.store;
  const member=snapshot?.member;
  const currentOrder=activeOrders[0];
  const lastOrder=history[0];
  const canBrowse=Boolean(snapshot?.menu);
  const topRecommendations=recommendations.filter(item=>item.product.available).slice(0,6);
  const availableCouponCount=member?.state==='READY'&&member.coupons
    ?member.coupons.filter(item=>item.state==='AVAILABLE').length
    :0;

  return <main className="stage1-shell">
    <header className="stage1-fixed-header">
      <button className="stage1-logo-button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} aria-label="返回首頁頂部">
        <img src={OFFICIAL_LOGO_URL} alt="磨飯 More Fun"/>
      </button>
      <div className={"stage1-store-status-badge "+(store?.channelAvailable===true?'is-open':store?.channelAvailable===false?'is-closed':'is-syncing')}>
        <i aria-hidden="true"/>
        <span>{statusLabel(store?.channelAvailable)}</span>
      </div>
    </header>

    <div className="stage1-content">
      <Stage1StatePanel connection={connection} browserOnline={browserOnline} error={error} onRetry={onRetry}/>

      {currentOrder?<button className="stage1-live-order" onClick={onOrders}>
        <span>進行中訂單</span>
        <strong>{currentOrder.stage==='READY'?'可取餐':currentOrder.stage==='PREPARING'?'製作中':currentOrder.stage==='ACCEPTED'?'店舖已接單':'查看最新進度'}</strong>
        <small>{currentOrder.displayCode}{currentOrder.etaLabel?' · '+currentOrder.etaLabel:''}</small>
      </button>:null}

      <section className="stage1-hero-banner" data-art-source="AI_GENERATED_STAGE1_ART">
        <img src={AI_GENERATED_STAGE1_ART} alt="磨飯品牌 AI 插畫"/>
        <div className="stage1-hero-shade"/>
        <div className="stage1-hero-copy">
          <span>MORE FUN · TODAY</span>
          <h1>今日，食一餐自己想食嘅。</h1>
          <p>到店自取。先睇、先揀；正式提交先再確認店舖狀態。</p>
          <button className="stage1-primary-cta" disabled={!canBrowse} onClick={onBrowse}>{canBrowse?'開始點餐':'菜單同步中'}</button>
        </div>
      </section>

      {store?.notice?<section className="stage1-announcement-strip" role="status">
        <img src={AI_GENERATED_STAGE1_ART} alt="" aria-hidden="true"/>
        <div>
          <span>店舖公告</span>
          <p>{store.notice}</p>
        </div>
      </section>:null}

      {store&&!store.channelAvailable?<section className="stage1-closed-panel">
        <span>今日暫停正式落單</span>
        <h2>仍然可以慢慢睇、慢慢揀。</h2>
        <p>關店時仍可 Browse / Build Cart；只會喺正式 Commit 阻止交易。</p>
        <div>
          <button className="stage1-primary-cta" disabled={!canBrowse} onClick={onBrowse}>{canBrowse?'繼續瀏覽菜單':'菜單同步中'}</button>
          <button className="stage1-secondary-cta" onClick={onFallback}>備用聯絡方法</button>
        </div>
      </section>:null}

      <section className="stage1-top6">
        <div className="stage1-section-title">
          <div><span>TOP 6</span><h2>人氣推薦</h2></div>
          <button onClick={onBrowse}>全部餐點</button>
        </div>

        {topRecommendations.length?<div className="stage1-top6-grid">
          {topRecommendations.map(item=><button
            className="stage1-product-card"
            key={item.product.productId}
            data-product-id={item.product.productId}
            onClick={event=>{
              const rect=event.currentTarget.getBoundingClientRect();
              onProduct(item.product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});
            }}
          >
            <Stage1ProductPlaceholder product={item.product}/>
            <span className="stage1-product-info">
              {item.product.badge?<small>{item.product.badge}</small>:null}
              <strong>{item.product.name}</strong>
              <em>{item.product.displayPriceLabel??'價格待店舖提供'}</em>
            </span>
          </button>)}
        </div>:<div className="stage1-top6-empty">
          <strong>推薦未準備好</strong>
          <span>唔影響點餐；可以直接進入菜單。</span>
          <button onClick={onBrowse} disabled={!canBrowse}>查看菜單</button>
        </div>}
      </section>

      <section className="stage1-quick-entry-section">
        <div className="stage1-section-title">
          <div><span>MORE FUN MEMORY</span><h2>下次再快一步</h2></div>
        </div>
        <div className="stage1-quick-entry-grid">
          <button onClick={onMember}>
            <span>記憶券</span>
            <strong>{availableCouponCount?availableCouponCount+' 張可用':'查看記憶券'}</strong>
            <small>Coupon 狀態以正式交易結果為準</small>
          </button>
          <button onClick={onHistory}>
            <span>常購清單</span>
            <strong>{history.length?'由食過嘅重新建立':'建立第一份常購'}</strong>
            <small>Reorder 會用目前菜單重新驗證</small>
          </button>
          <button onClick={onBrowse}>
            <span>期間限定</span>
            <strong>睇今期限定</strong>
            <small>內容、價格、供應全部讀目前正式投影</small>
          </button>
        </div>
      </section>

      <section className="stage1-memory-strip">
        <button onClick={onJar}>
          <span>記憶罐</span>
          <strong>{cartCount?cartCount+' 件餐點':'今餐未開始'}</strong>
          <small>未提交前仍然係草稿</small>
        </button>
        {lastOrder?<button onClick={()=>onBuyAgain(lastOrder)}>
          <span>上次食過</span>
          <strong>{lastOrder.itemSummary}</strong>
          <small>按目前菜單再來一單</small>
        </button>:<button onClick={onHistory}>
          <span>訂單回憶</span>
          <strong>完成第一張訂單後會出現</strong>
          <small>歷史內容保持唯讀</small>
        </button>}
      </section>
    </div>
  </main>;
}
