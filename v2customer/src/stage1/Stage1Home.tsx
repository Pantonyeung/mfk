import type {CustomerRecommendation} from '../recommendation';
import type {
  CustomerConnectionState,
  CustomerHistoryProjection,
  CustomerOrderProjection,
  CustomerProduct,
  CustomerReadModelSnapshot,
} from '../product-types';
import {ActionButton,PullRefreshSurface,type ProductOriginRect} from '../ui/primitives';
import './stage1-home.css';

const STAGE1_AI_ART_URL='https://cdn.creativeclaw.co/u/6ad84d58/images/57ce2f93-c8d0-491d-9bd0-23a2be364d14.png';

const stageLabel:Record<CustomerOrderProjection['stage'],string>={
  RECEIVED:'等待店舖確認',
  REJECTED:'未能接單',
  ACCEPTED:'店舖已接單',
  PREPARING:'製作中',
  DELAYED:'稍有延誤',
  READY:'可取餐',
  PICKUP_VERIFICATION:'取餐核對',
  HANDED_OVER:'已交收',
  COMPLETED:'已完成',
};

function ProductPlaceholder({product}:{product:CustomerProduct}){
  return <span className="stage1-product-placeholder" aria-hidden="true">
    <span>{product.name.slice(0,1)}</span>
  </span>;
}

export function Stage1Home({
  snapshot,
  connection,
  activeOrders,
  history,
  recommendations,
  cartCount,
  onRefresh,
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
  activeOrders:readonly CustomerOrderProjection[];
  history:readonly CustomerHistoryProjection[];
  recommendations:readonly CustomerRecommendation[];
  cartCount:number;
  onRefresh:()=>void;
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

  return <PullRefreshSurface refreshing={connection==='LOADING'} onRefresh={onRefresh}>
    <section className="page stage1-home">
      <header className="stage1-store-status">
        <div>
          <span>磨飯 · 今日自取</span>
          <h1>{store?.storeName??'磨飯'}</h1>
          <p>{store?.etaLabel??'取餐時間以店舖最新狀態為準'}</p>
        </div>
        <strong className={store?.channelAvailable?'open':'closed'}>
          <i aria-hidden="true"/>
          {store?store.channelAvailable?'營業中':'暫停正式落單':'同步中'}
        </strong>
      </header>

      {currentOrder?<button className="stage1-current-order" onClick={onOrders}>
        <span>進行中訂單</span>
        <strong>{stageLabel[currentOrder.stage]}</strong>
        <small>{currentOrder.displayCode}{currentOrder.etaLabel?' · '+currentOrder.etaLabel:''}</small>
      </button>:null}

      <section className="stage1-hero" aria-label="磨飯品牌主視覺">
        <img src={STAGE1_AI_ART_URL} alt="磨飯品牌插畫"/>
        <div className="stage1-hero-copy">
          <span>MORE FUN</span>
          <h2>今日，都食一餐自己想食嘅。</h2>
          <p>到店自取。慢慢揀，去到提交先再確認店舖狀態。</p>
          <ActionButton disabled={!canBrowse} onClick={onBrowse}>{canBrowse?'開始點餐':'菜單同步中'}</ActionButton>
        </div>
      </section>

      {store?.notice?<section className="stage1-announcement" role="status">
        <img src={STAGE1_AI_ART_URL} alt="" aria-hidden="true"/>
        <div><span>今日公告</span><p>{store.notice}</p></div>
      </section>:null}

      {store&&!store.channelAvailable?<section className="stage1-closed-card">
        <span>今日暫停正式落單</span>
        <h2>仍然可以慢慢睇、慢慢揀。</h2>
        <p>菜單有資料時仍可瀏覽同整理記憶罐；正式提交會喺之後步驟再確認店舖狀態。</p>
        <div>
          <ActionButton disabled={!canBrowse} onClick={onBrowse}>{canBrowse?'繼續睇菜單':'菜單同步中'}</ActionButton>
          <ActionButton variant="quiet" onClick={onFallback}>備用聯絡方法</ActionButton>
        </div>
      </section>:null}

      <section className="stage1-top6">
        <div className="stage1-section-heading">
          <div><span>TOP 6</span><h2>人氣推薦</h2></div>
          <button onClick={onBrowse}>全部餐點</button>
        </div>
        {topRecommendations.length?<div className="stage1-top6-grid">
          {topRecommendations.map(item=><button
            key={item.product.productId}
            className="stage1-product-card"
            data-product-id={item.product.productId}
            onClick={event=>{
              const rect=event.currentTarget.getBoundingClientRect();
              onProduct(item.product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});
            }}
          >
            <ProductPlaceholder product={item.product}/>
            <span className="stage1-product-copy">
              {item.product.badge?<small>{item.product.badge}</small>:null}
              <strong>{item.product.name}</strong>
              <em>{item.product.displayPriceLabel??'價格待店舖提供'}</em>
            </span>
          </button>)}
        </div>:<div className="stage1-top6-empty">推薦資料未準備好時，仍可直接進入菜單。</div>}
      </section>

      <section className="stage1-quick">
        <div className="stage1-section-heading"><div><span>MORE FUN MEMORY</span><h2>下次再快一步</h2></div></div>
        <div className="stage1-quick-grid">
          <button onClick={onMember}>
            <span>記憶券</span>
            <strong>{availableCouponCount?availableCouponCount+' 張可用':'查看回憶券'}</strong>
            <small>正式交易成功後先處理使用狀態</small>
          </button>
          <button onClick={onHistory}>
            <span>常購清單</span>
            <strong>{history.length?'由以前食過嘅開始':'建立第一份常購'}</strong>
            <small>歷史訂單只作新購物意圖來源</small>
          </button>
          <button onClick={onBrowse}>
            <span>期間限定</span>
            <strong>睇今期限定</strong>
            <small>內容及供應以店舖最新菜單為準</small>
          </button>
        </div>
      </section>

      <section className="stage1-memory-strip">
        <button onClick={onJar}>
          <span>記憶罐</span>
          <strong>{cartCount?cartCount+' 件餐點':'今餐未開始'}</strong>
        </button>
        {lastOrder?<button onClick={()=>onBuyAgain(lastOrder)}>
          <span>上次食過</span>
          <strong>{lastOrder.itemSummary}</strong>
          <small>按目前菜單重新驗證</small>
        </button>:<button onClick={onHistory}>
          <span>訂單回憶</span>
          <strong>完成第一張訂單後會出現</strong>
        </button>}
      </section>
    </section>
  </PullRefreshSurface>;
}
