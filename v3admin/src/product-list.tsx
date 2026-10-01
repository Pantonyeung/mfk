import {useMemo,useState,type KeyboardEvent} from 'react';
import {DraftBar,PageHeader,StatusBadge} from './ui.tsx';

type RowObject=Record<string,unknown>;

export type ProductListRecord={
  id:string;
  name:string;
  code:string;
  category:string;
  priceMinor:number;
  status:'已發佈'|'草稿'|'待回讀'|'已停用'|'資料過期'|'結果未明';
  printRule:string;
  updatedAt:string;
};

const PREVIEW_PRODUCTS:readonly ProductListRecord[]=[
  {id:'p-001',name:'紫米飯糰・照燒雞',code:'PRD000123',category:'飯糰',priceMinor:4200,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:42'},
  {id:'p-002',name:'香煎雞扒紫米飯',code:'PRD000124',category:'飯類',priceMinor:5200,status:'已發佈',printRule:'製作單＋打包單',updatedAt:'今日 08:39'},
  {id:'p-003',name:'鹽酥雞小食',code:'PRD000125',category:'小食',priceMinor:2800,status:'草稿',printRule:'製作單',updatedAt:'今日 08:18'},
  {id:'p-004',name:'無糖凍檸茶',code:'PRD000126',category:'茶飲',priceMinor:1800,status:'待回讀',printRule:'標籤',updatedAt:'昨日 21:06'},
  {id:'p-005',name:'南瓜粟米湯',code:'PRD000127',category:'湯品',priceMinor:2600,status:'已停用',printRule:'製作單',updatedAt:'昨日 19:24'},
  {id:'p-006',name:'紫米豆乳布甸',code:'PRD000128',category:'甜品',priceMinor:2400,status:'已發佈',printRule:'打包單',updatedAt:'昨日 17:51'},
];

const PREVIEW_CATEGORIES=['全部','飯類','飯糰','便當','茶飲','小食','湯品','甜品'] as const;
const STATUS_OPTIONS=['全部','已發佈','草稿','待回讀','已停用'] as const;

function row(value:unknown):RowObject{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as RowObject:{};
}
function rows(value:unknown){return Array.isArray(value)?value:[];}
function textValue(...values:unknown[]){
  for(const value of values){if(typeof value==='string'&&value.trim())return value.trim();}
  return '';
}
function numberValue(...values:unknown[]){
  for(const value of values){const n=Number(value);if(Number.isFinite(n))return n;}
  return 0;
}
function money(minor:number){
  const value=Math.max(0,minor)/100;
  return 'HK$'+(Number.isInteger(value)?String(value):value.toFixed(2));
}
function humanStatus(product:RowObject):ProductListRecord['status']{
  const raw=textValue(product.status,product.publishState,product.state).toUpperCase();
  if(product.enabled===false||product.active===false||['DISABLED','INACTIVE','ARCHIVED'].includes(raw))return '已停用';
  if(['DRAFT','SAVED_DRAFT'].includes(raw))return '草稿';
  if(['PENDING','PENDING_READBACK','PUBLISHED_PENDING_ACK'].includes(raw))return '待回讀';
  if(['STALE'].includes(raw))return '資料過期';
  if(['UNKNOWN'].includes(raw))return '結果未明';
  return '已發佈';
}
function statusTone(status:ProductListRecord['status']){
  if(status==='已發佈')return 'good' as const;
  if(status==='已停用')return 'neutral' as const;
  if(status==='結果未明'||status==='資料過期')return 'unknown' as const;
  return 'warning' as const;
}
function productPriceMinor(product:RowObject){
  if(product.priceMinor!==undefined)return Math.round(numberValue(product.priceMinor));
  if(product.basePriceMinor!==undefined)return Math.round(numberValue(product.basePriceMinor));
  return Math.round(numberValue(product.price,product.basePrice,product.unitPrice)*100);
}
function categoryLookup(snapshot:RowObject){
  const catalog=row(snapshot.catalog);
  return new Map(rows(catalog.categories).map(raw=>{
    const category=row(raw);
    const id=textValue(category.id,category.categoryId,category.code);
    const name=textValue(category.name,category.title,category.label,id);
    return [id,name] as const;
  }));
}
export function productRecordsFromSnapshot(snapshot:unknown):ProductListRecord[]{
  const root=row(snapshot);
  const catalog=row(root.catalog);
  const categories=categoryLookup(root);
  return rows(catalog.products).map((raw,index)=>{
    const product=row(raw);
    const id=textValue(product.id,product.productId,product.code,product.productCode)||'product-'+String(index+1);
    const categoryId=textValue(product.categoryId,product.category,product.categoryCode);
    const category=categories.get(categoryId)||textValue(product.categoryName,product.categoryLabel,categoryId)||'未分類';
    const print=row(product.printSettings??product.printRule);
    const printRule=print.label===true?'標籤':print.production===true?'製作單':textValue(product.printLabel,product.printDestination)||'跟隨打印規則';
    const updated=textValue(product.updatedAt,product.modifiedAt,product.createdAt);
    return{
      id,
      name:textValue(product.name,product.productName,product.displayName,product.title)||'未命名商品',
      code:textValue(product.productCode,product.code,product.sku,id),
      category,
      priceMinor:productPriceMinor(product),
      status:humanStatus(product),
      printRule,
      updatedAt:updated?new Date(updated).toLocaleString('zh-HK',{timeZone:'Asia/Hong_Kong',hour12:false}):'—',
    };
  });
}

function ProductThumb({name}:{name:string}){
  const mark=name.replace(/[・\s]/g,'').slice(0,2)||'品';
  return <div className="v3-product-thumb" aria-hidden="true">{mark}</div>;
}

function ProductDrawer({product,onClose}:{product:ProductListRecord;onClose:()=>void}){
  return <><button type="button" className="v3-product-drawer-backdrop" aria-label="關閉產品詳情" onClick={onClose}/>
    <aside className="v3-product-drawer" aria-label="產品詳情預覽">
      <div className="v3-product-drawer-head"><div><small>UI-02 接續位置</small><h2>{product.name}</h2></div><button type="button" onClick={onClose}>關閉</button></div>
      <div className="v3-product-drawer-note">今輪只驗證「點產品 → temporary slide-over」。編輯欄位會喺 UI-02 正式鎖定後接入，唔會長期佔住 Product List。</div>
      <dl>
        <div><dt>商品編號</dt><dd>{product.code}<small>系統自動生成，不可 inline 修改</small></dd></div>
        <div><dt>分類</dt><dd>{product.category}</dd></div>
        <div><dt>基本價格</dt><dd>{money(product.priceMinor)}</dd></div>
        <div><dt>狀態</dt><dd><StatusBadge tone={statusTone(product.status)}>{product.status}</StatusBadge></dd></div>
      </dl>
    </aside>
  </>;
}

export function ProductListPage({canonicalSnapshot,previewMode=false,onReviewDraft}:{canonicalSnapshot?:unknown;previewMode?:boolean;onReviewDraft?:()=>void}){
  const sourceRows=useMemo(()=>previewMode?[...PREVIEW_PRODUCTS]:productRecordsFromSnapshot(canonicalSnapshot),[canonicalSnapshot,previewMode]);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('全部');
  const [status,setStatus]=useState('全部');
  const [sort,setSort]=useState('updated');
  const [view,setView]=useState<'list'|'grid'>('list');
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [openProduct,setOpenProduct]=useState<ProductListRecord|null>(null);

  const categoryOptions=useMemo(()=>{
    if(previewMode)return [...PREVIEW_CATEGORIES];
    const values=[...new Set(sourceRows.map(item=>item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-HK'));
    return ['全部',...values];
  },[previewMode,sourceRows]);

  const filtered=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase();
    const list=sourceRows.filter(item=>{
      const queryMatch=!needle||[item.name,item.code,item.category].some(value=>value.toLocaleLowerCase().includes(needle));
      const categoryMatch=category==='全部'||item.category===category;
      const statusMatch=status==='全部'||item.status===status;
      return queryMatch&&categoryMatch&&statusMatch;
    });
    return [...list].sort((a,b)=>{
      if(sort==='name')return a.name.localeCompare(b.name,'zh-HK');
      if(sort==='price-low')return a.priceMinor-b.priceMinor;
      if(sort==='price-high')return b.priceMinor-a.priceMinor;
      return b.updatedAt.localeCompare(a.updatedAt,'zh-HK');
    });
  },[sourceRows,query,category,status,sort]);

  const toggleSelection=(id:string)=>{
    setSelected(current=>{
      const next=new Set(current);
      if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  };
  const openFromKeyboard=(event:KeyboardEvent<HTMLElement>,product:ProductListRecord)=>{
    if(event.key==='Enter'){event.preventDefault();setOpenProduct(product);}
  };

  return <div className="v3-product-page">
    {previewMode?<div className="v3-preview-banner" role="status"><strong>UI-01 公網預覽</strong><span>以下商品、狀態同「2 項未發佈變更」全部係介面示例，只用嚟驗 UI；唔代表正式 Canonical 資料。</span></div>:null}
    <PageHeader
      eyebrow="菜單管理"
      title="產品管理"
      description="快速搵產品、判斷狀態同進入編輯；預設保持完整 Product List 工作空間。"
      aside={<><span className="v3-product-count">{filtered.length} / {sourceRows.length} 項商品</span><button className="v3-primary" type="button" disabled title="新增產品會喺 UI-03 接入">＋ 新增產品</button></>}
    />

    <section className="v3-product-toolbar" aria-label="產品搜尋與篩選">
      <div className="v3-product-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品名稱、商品編號、關鍵字"/></div>
      <div className="v3-product-selects">
        <label><span>狀態</span><select value={status} onChange={event=>setStatus(event.target.value)}>{STATUS_OPTIONS.map(option=><option key={option}>{option}</option>)}</select></label>
        <label><span>排序</span><select value={sort} onChange={event=>setSort(event.target.value)}><option value="updated">最近更新</option><option value="name">商品名稱</option><option value="price-low">價格：低至高</option><option value="price-high">價格：高至低</option></select></label>
        <div className="v3-view-toggle" aria-label="顯示方式"><button type="button" aria-pressed={view==='list'} className={view==='list'?'is-active':''} onClick={()=>setView('list')}>列表</button><button type="button" aria-pressed={view==='grid'} className={view==='grid'?'is-active':''} onClick={()=>setView('grid')}>卡片</button></div>
      </div>
    </section>

    <div className="v3-category-chips" aria-label="分類快捷篩選">
      {categoryOptions.map(option=><button key={option} type="button" className={category===option?'is-active':''} aria-pressed={category===option} onClick={()=>setCategory(option)}>{option}</button>)}
    </div>

    {filtered.length===0?<section className="v3-product-empty"><h2>目前未有符合條件嘅商品</h2><p>試下清除搜尋，或者切返「全部」分類／狀態。</p><button type="button" onClick={()=>{setQuery('');setCategory('全部');setStatus('全部');}}>清除篩選</button></section>:
      view==='grid'?<div className="v3-product-grid">{filtered.map(product=><article key={product.id} className="v3-product-card" tabIndex={0} onKeyDown={event=>openFromKeyboard(event,product)} onClick={()=>setOpenProduct(product)}>
        <div className="v3-product-card-top"><ProductThumb name={product.name}/><StatusBadge tone={statusTone(product.status)}>{product.status}</StatusBadge></div>
        <h3>{product.name}</h3><p>{product.category} · {product.code}</p><strong>{money(product.priceMinor)}</strong><small>{product.printRule} · {product.updatedAt}</small>
      </article>)}</div>:
      <><div className="v3-product-table-wrap"><table className="v3-product-table"><thead><tr><th className="v3-select-col"><span className="v3-visually-hidden">選擇</span></th><th>商品</th><th>商品編號</th><th>分類</th><th>基本價格</th><th>狀態</th><th>打印規則</th><th>最近更新</th><th><span className="v3-visually-hidden">操作</span></th></tr></thead>
        <tbody>{filtered.map(product=><tr key={product.id} tabIndex={0} onKeyDown={event=>openFromKeyboard(event,product)} onClick={()=>setOpenProduct(product)}>
          <td className="v3-select-col"><input type="checkbox" aria-label={'選擇 '+product.name} checked={selected.has(product.id)} onClick={event=>event.stopPropagation()} onChange={()=>toggleSelection(product.id)}/></td>
          <td><div className="v3-product-identity"><ProductThumb name={product.name}/><div><strong>{product.name}</strong><small>點擊開啟產品詳情</small></div></div></td>
          <td><code>{product.code}</code></td><td>{product.category}</td><td className="v3-money">{money(product.priceMinor)}</td><td><StatusBadge tone={statusTone(product.status)}>{product.status}</StatusBadge></td><td>{product.printRule}</td><td>{product.updatedAt}</td>
          <td><button type="button" className="v3-row-more" aria-label={product.name+' 其他操作'} onClick={event=>event.stopPropagation()}>•••</button></td>
        </tr>)}</tbody></table></div>
        <div className="v3-product-mobile-list">{filtered.map(product=><article key={product.id} className="v3-product-mobile-card" tabIndex={0} onKeyDown={event=>openFromKeyboard(event,product)} onClick={()=>setOpenProduct(product)}>
          <ProductThumb name={product.name}/><div className="v3-product-mobile-main"><div><strong>{product.name}</strong><StatusBadge tone={statusTone(product.status)}>{product.status}</StatusBadge></div><span>{product.category} · {product.code}</span><footer><b>{money(product.priceMinor)}</b><small>{product.updatedAt}</small></footer></div>
        </article>)}</div></>}

    {selected.size?<div className="v3-selection-bar" role="status"><strong>已選 {selected.size} 項</strong><span>批量操作會喺對應 Slice 正式定義後接入。</span><button type="button" onClick={()=>setSelected(new Set())}>取消選取</button></div>:null}
    {previewMode?<DraftBar count={2} onReview={onReviewDraft??(()=>{})}/>:null}
    {openProduct?<ProductDrawer product={openProduct} onClose={()=>setOpenProduct(null)}/>:null}
  </div>;
}
