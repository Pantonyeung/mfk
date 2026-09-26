import {useRef,useState} from 'react';
import type {CustomerRecommendation} from '../recommendation';
import type {CustomerConnectionState,CustomerProduct} from '../product-types';
import type {ProductOriginRect} from '../ui/primitives';
import './stage2.css';

// Primary UI reference: 磨飯_more_fun_點單探索介面.png
export const STAGE2_VISUAL_REFERENCE='https://cdn.creativeclaw.co/u/6ad84d58/images/54252ae0-960b-4ba2-b45f-2e32cde0b221.png';
const OFFICIAL_LOGO_URL='https://cdn.creativeclaw.co/u/6ad84d58/images/402357b6-d757-4238-99f7-3d20607da6f2.png';

type Stage2Filter='all'|'popular'|'favorites';

function matchesQuery(product:CustomerProduct,query:string){
  const needle=query.trim().toLowerCase();
  if(!needle)return true;
  return [product.name,product.description,product.badge??''].join(' ').toLowerCase().includes(needle);
}

function Stage2StatePanel({
  connection,
  browserOnline,
}:{
  connection:CustomerConnectionState;
  browserOnline:boolean;
}){
  if(!browserOnline)return <section className="stage2-state-panel state-offline" role="status"><strong>目前離線</strong><p>已載入菜單仍可瀏覽；正式提交會喺後續交易邊界重新確認。</p></section>;
  if(connection==='ERROR')return <section className="stage2-state-panel state-error" role="alert"><strong>暫時未能同步菜單</strong><p>暫時未能同步菜單，請稍後再試。</p></section>;
  if(connection==='STALE'||connection==='PARTIAL')return <section className="stage2-state-panel state-stale" role="status"><strong>正顯示最近一次菜單</strong><p>價格、供應同可售狀態會喺正式交易前再次核對。</p></section>;
  if(connection==='NOT_CONNECTED')return <section className="stage2-state-panel state-empty" role="status"><strong>菜單服務尚未連接</strong><p>未有正式資料時，不會填入假商品、假價格或假供應狀態。</p></section>;
  if(connection==='LOADING')return <section className="stage2-state-panel state-loading" role="status" aria-busy="true"><strong>正在整理菜單</strong><p>分類同商品會逐項出現。</p></section>;
  return null;
}

function FavoriteButton({
  active,
  onToggle,
}:{
  active:boolean;
  onToggle:()=>void;
}){
  return <button
    className={"stage2-favorite"+(active?' is-active':'')}
    type="button"
    aria-pressed={active}
    aria-label={active?'取消收藏':'收藏'}
    onClick={event=>{event.stopPropagation();onToggle()}}
  >{active?'♥':'♡'}</button>;
}

function FeaturedProductCard({
  product,
  favorite,
  onToggleFavorite,
  onOpen,
}:{
  product:CustomerProduct;
  favorite:boolean;
  onToggleFavorite:()=>void;
  onOpen:(product:CustomerProduct,origin:ProductOriginRect)=>void;
}){
  return <article className={"stage2-featured-card"+(product.available?'':' is-sold-out')}>
    <button
      className="stage2-card-hit"
      type="button"
      data-product-id={product.productId}
      disabled={!product.available}
      onClick={event=>{
        const rect=event.currentTarget.getBoundingClientRect();
        onOpen(product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});
      }}
    >
      <span className="stage2-product-media" aria-hidden="true"/>
      <span className="stage2-featured-copy">
        <small>{product.badge??'本分類精選'}</small>
        <strong>{product.name}</strong>
        <p>{product.description}</p>
        <em>{product.displayPriceLabel??'價格待店舖提供'}</em>
      </span>
      {!product.available?<span className="stage2-sold-out">已售罄</span>:null}
    </button>
    <FavoriteButton active={favorite} onToggle={onToggleFavorite}/>
  </article>;
}

function SmallProductCard({
  product,
  favorite,
  onToggleFavorite,
  onOpen,
}:{
  product:CustomerProduct;
  favorite:boolean;
  onToggleFavorite:()=>void;
  onOpen:(product:CustomerProduct,origin:ProductOriginRect)=>void;
}){
  return <article className={"stage2-small-card"+(product.available?'':' is-sold-out')}>
    <button
      className="stage2-card-hit"
      type="button"
      data-product-id={product.productId}
      disabled={!product.available}
      onClick={event=>{
        const rect=event.currentTarget.getBoundingClientRect();
        onOpen(product,{top:rect.top,left:rect.left,width:rect.width,height:rect.height});
      }}
    >
      <span className="stage2-product-media" aria-hidden="true"/>
      <span className="stage2-small-copy">
        {product.badge?<small>{product.badge}</small>:null}
        <strong>{product.name}</strong>
        <em>{product.displayPriceLabel??'價格待店舖提供'}</em>
      </span>
      {!product.available?<span className="stage2-sold-out">已售罄</span>:null}
    </button>
    <FavoriteButton active={favorite} onToggle={onToggleFavorite}/>
  </article>;
}

export function Stage2Menu({
  connection,
  browserOnline,
  categories,
  activeCategoryId,
  setCategory,
  query,
  setQuery,
  products,
  recommendations,
  onProduct,
  cartCount,
  onCart,
}:{
  connection:CustomerConnectionState;
  browserOnline:boolean;
  categories:readonly {categoryId:string;name:string}[];
  activeCategoryId:string|null;
  setCategory:(id:string|null)=>void;
  query:string;
  setQuery:(value:string)=>void;
  products:readonly CustomerProduct[];
  recommendations:readonly CustomerRecommendation[];
  onProduct:(product:CustomerProduct,origin:ProductOriginRect)=>void;
  cartCount:number;
  onCart:()=>void;
}){
  const searchRef=useRef<HTMLInputElement>(null);
  const [filter,setFilter]=useState<Stage2Filter>('all');
  const [favorites,setFavorites]=useState<ReadonlySet<string>>(new Set());
  const searchMode=Boolean(query.trim());

  const recommendationProducts=recommendations.map(item=>item.product);
  const categoryValid=activeCategoryId&&categories.some(item=>item.categoryId===activeCategoryId);
  const selectedCategoryId=categoryValid?activeCategoryId:null;
  const categoryProducts=selectedCategoryId
    ?products.filter(product=>product.categoryId===selectedCategoryId)
    :recommendationProducts;

  const popularIds=new Set(recommendations.map(item=>item.product.productId));
  const filteredByMode=categoryProducts.filter(product=>{
    if(filter==='favorites')return favorites.has(product.productId);
    if(filter==='popular')return popularIds.has(product.productId);
    return true;
  });
  const displayProducts=searchMode
    ?products.filter(product=>matchesQuery(product,query))
    :filteredByMode;

  const featuredProduct=displayProducts.find(product=>product.available)??displayProducts[0]??null;
  const smallProducts=featuredProduct?displayProducts.filter(product=>product.productId!==featuredProduct.productId):[];

  const repairRecommendations=recommendations.filter(item=>item.product.available).slice(0,2);

  const toggleFavorite=(productId:string)=>{
    setFavorites(current=>{
      const next=new Set(current);
      if(next.has(productId))next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  return <main className="stage2-shell" data-visual-spec="磨飯_more_fun_點單探索介面" data-visual-reference={STAGE2_VISUAL_REFERENCE}>
    <header className="stage2-header">
      <img className="stage2-logo" src={OFFICIAL_LOGO_URL} alt="磨飯 More Fun"/>
      <div className="stage2-header-actions">
        <button type="button" onClick={()=>{searchRef.current?.focus();}}>搜尋</button>
        <button type="button" onClick={onCart}>記憶罐{cartCount?' · '+cartCount:''}</button>
      </div>
    </header>

    <div className="stage2-content">
      <Stage2StatePanel connection={connection} browserOnline={browserOnline}/>

      <label className={"stage2-search-field"+(searchMode?' is-active':'')}>
        <span>搜尋商品</span>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={event=>setQuery(event.target.value)}
          placeholder="搜尋想食嘅餐點"
          autoComplete="off"
        />
        {query?<button type="button" onClick={()=>setQuery('')}>清除</button>:null}
      </label>

      {!searchMode?<>
        <div className="stage2-category-rail" role="tablist" aria-label="商品分類">
          <button role="tab" aria-selected={!selectedCategoryId} className={!selectedCategoryId?'is-active':''} onClick={()=>setCategory(null)}>人氣推薦</button>
          {categories.map(category=><button
            key={category.categoryId}
            role="tab"
            aria-selected={selectedCategoryId===category.categoryId}
            className={selectedCategoryId===category.categoryId?'is-active':''}
            onClick={()=>setCategory(category.categoryId)}
          >{category.name}</button>)}
        </div>

        <div className="stage2-filter-strip" role="group" aria-label="商品篩選">
          <button className={filter==='all'?'is-active':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>全部</button>
          <button className={filter==='popular'?'is-active':''} aria-pressed={filter==='popular'} onClick={()=>setFilter('popular')}>人氣</button>
          <button className={filter==='favorites'?'is-active':''} aria-pressed={filter==='favorites'} onClick={()=>setFilter('favorites')}>已收藏{favorites.size?' '+favorites.size:''}</button>
        </div>
      </>:null}

      {searchMode?<section className="stage2-search-results">
        <div className="stage2-section-heading">
          <div><span>SEARCH</span><h1>搜尋結果</h1></div>
          <strong>{displayProducts.length} 款</strong>
        </div>
        {displayProducts.length?<div className="stage2-small-grid">
          {displayProducts.map(product=><SmallProductCard
            key={product.productId}
            product={product}
            favorite={favorites.has(product.productId)}
            onToggleFavorite={()=>toggleFavorite(product.productId)}
            onOpen={onProduct}
          />)}
        </div>:<section className="stage2-zero-repair">
          <span>暫時搵唔到「{query.trim()}」</span>
          <h2>試下其他分類</h2>
          <p>搜尋失敗唔會阻止你繼續點餐；可以換分類，或者睇下其他人氣選擇。</p>
          <div className="stage2-repair-categories">
            <button onClick={()=>{setQuery('');setCategory(null)}}>人氣推薦</button>
            {categories.slice(0,4).map(category=><button key={category.categoryId} onClick={()=>{setQuery('');setCategory(category.categoryId)}}>{category.name}</button>)}
          </div>
          {repairRecommendations.length?<div className="stage2-repair-products">
            {repairRecommendations.map(item=><SmallProductCard
              key={item.product.productId}
              product={item.product}
              favorite={favorites.has(item.product.productId)}
              onToggleFavorite={()=>toggleFavorite(item.product.productId)}
              onOpen={onProduct}
            />)}
          </div>:null}
        </section>}
      </section>:displayProducts.length?<section className="stage2-browse">
        <div className="stage2-section-heading">
          <div><span>{selectedCategoryId?'CATEGORY':'TODAY'}</span><h1>{selectedCategoryId?categories.find(item=>item.categoryId===selectedCategoryId)?.name??'點單':'今日主角'}</h1></div>
          <strong>{displayProducts.length} 款</strong>
        </div>

        {featuredProduct?<FeaturedProductCard
          product={featuredProduct}
          favorite={favorites.has(featuredProduct.productId)}
          onToggleFavorite={()=>toggleFavorite(featuredProduct.productId)}
          onOpen={onProduct}
        />:null}

        {smallProducts.length?<div className="stage2-small-grid">
          {smallProducts.map(product=><SmallProductCard
            key={product.productId}
            product={product}
            favorite={favorites.has(product.productId)}
            onToggleFavorite={()=>toggleFavorite(product.productId)}
            onOpen={onProduct}
          />)}
        </div>:null}
      </section>:<section className="stage2-empty" role="status">
        <strong>{filter==='favorites'?'未有收藏商品':'呢個分類暫時未有商品'}</strong>
        <p>{filter==='favorites'?'撳商品右上角收藏，今次瀏覽期間就可以喺呢度快速搵返。':'可以切換其他分類繼續睇。'}</p>
        <button type="button" onClick={()=>{setFilter('all');setCategory(null)}}>返回人氣推薦</button>
      </section>}
    </div>
  </main>;
}
