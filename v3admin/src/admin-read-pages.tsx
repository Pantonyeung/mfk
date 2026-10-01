import {useMemo,useState} from 'react';
import {PageHeader,StatusBadge,Timeline} from './ui.tsx';
import {usePreviewCatalog} from './preview-catalog-store.ts';

type PreviewOrder={
  id:string;
  source:string;
  amountMinor:number;
  status:'待處理'|'製作中'|'可取餐'|'已完成'|'已取消'|'異常';
  createdAt:string;
  customer:string;
  items:readonly string[];
  issue?:string;
};

const ORDERS:readonly PreviewOrder[]=[
  {id:'MF-2601001',source:'自家平台',amountMinor:8600,status:'製作中',createdAt:'10:12',customer:'陳小姐',items:['紫米飯糰・照燒雞 ×2','無糖凍檸茶 ×1']},
  {id:'MF-2601002',source:'Keeta',amountMinor:5200,status:'可取餐',createdAt:'10:08',customer:'Keeta 客戶',items:['香煎雞扒紫米飯 ×1']},
  {id:'MF-2601003',source:'門店',amountMinor:12800,status:'待處理',createdAt:'10:17',customer:'堂食 3號枱',items:['磨飯午市套餐 ×2']},
  {id:'MF-2600999',source:'Keeta',amountMinor:4500,status:'異常',createdAt:'09:48',customer:'Keeta 客戶',items:['紫米飯糰・泡菜豬肉 ×1'],issue:'商品映射需要確認'},
  {id:'MF-2600988',source:'門店',amountMinor:12400,status:'已完成',createdAt:'09:31',customer:'堂食 1號枱',items:['香煎雞扒紫米飯 ×2','無糖凍檸茶 ×1']},
  {id:'MF-2600975',source:'自家平台',amountMinor:6800,status:'已取消',createdAt:'08:52',customer:'李先生',items:['磨飯午市套餐 ×1']},
];

function money(minor:number){return 'HK$'+(minor/100).toFixed(2);}

function OrderDetail({order,onClose}:{order:PreviewOrder;onClose:()=>void}){
  return <div className="v3-functional-editor" role="dialog" aria-modal="true"><button className="v3-functional-backdrop" onClick={onClose}/><section className="v3-functional-sheet">
    <header><div><small>訂單詳情 · 只讀</small><h2>{order.id}</h2></div><button onClick={onClose}>關閉</button></header>
    <div className="v3-functional-body">
      <section className="v3-functional-section"><div className="v3-readback-grid">
        <div><span>來源</span><strong>{order.source}</strong></div><div><span>金額</span><strong>{money(order.amountMinor)}</strong></div><div><span>狀態</span><strong>{order.status}</strong></div><div><span>客戶／枱</span><strong>{order.customer}</strong></div>
      </div></section>
      <section className="v3-functional-section"><h3>商品</h3>{order.items.map((item,index)=><div className="v3-ref-row" key={index}><strong>{item}</strong></div>)}</section>
      {order.issue?<section className="v3-functional-section"><h3>異常</h3><div className="v3-warning">{order.issue}</div></section>:null}
      <section className="v3-functional-section"><h3>履約時間線</h3><Timeline items={[{title:'訂單建立',time:order.createdAt,description:order.source},{title:order.status,time:'目前',description:'Admin 只讀 projection'}]}/></section>
      <div className="v3-mobile-form-note">Admin 不提供取消訂單、退款、付款方式修正等交易 mutation。</div>
    </div>
  </section></div>;
}

export function OrdersPage({mode}:{mode:'open'|'history'|'exceptions'}){
  const [query,setQuery]=useState('');
  const [source,setSource]=useState('ALL');
  const [selected,setSelected]=useState<PreviewOrder|null>(null);
  const rows=useMemo(()=>{
    return ORDERS.filter(order=>{
      const modeMatch=mode==='open'?['待處理','製作中','可取餐'].includes(order.status):mode==='history'?['已完成','已取消'].includes(order.status):order.status==='異常';
      const q=query.trim().toLocaleLowerCase();
      return modeMatch&&(source==='ALL'||order.source===source)&&(!q||(order.id+' '+order.customer+' '+order.items.join(' ')).toLocaleLowerCase().includes(q));
    });
  },[mode,query,source]);
  const title=mode==='open'?'進行中訂單':mode==='history'?'訂單歷史':'訂單異常';
  return <div className="v3-functional-page">
    <div className="v3-preview-banner"><strong>只讀 Preview</strong><span>訂單畫面只做查看、搜尋、追蹤同核對；冇交易 mutation。</span></div>
    <PageHeader eyebrow="訂單監察" title={title} description="搜尋訂單、查看正式欄位語義同進詳情；所有操作保持只讀。" aside={<span className="v3-product-count">{rows.length} 張</span>}/>
    <section className="v3-product-toolbar"><div className="v3-product-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋訂單編號、客戶、商品"/></div><div className="v3-product-selects"><label><span>來源</span><select value={source} onChange={event=>setSource(event.target.value)}><option value="ALL">全部來源</option><option>自家平台</option><option>Keeta</option><option>門店</option></select></label></div></section>
    <div className="v3-action-list">{rows.map(order=><article key={order.id} onClick={()=>setSelected(order)} className="is-clickable"><div><strong>{order.id}</strong><small>{order.source} · {order.customer} · {order.createdAt}</small></div><strong>{money(order.amountMinor)}</strong><StatusBadge tone={order.status==='異常'?'warning':order.status==='可取餐'||order.status==='已完成'?'good':'neutral'}>{order.status}</StatusBadge></article>)}</div>
    {selected?<OrderDetail order={selected} onClose={()=>setSelected(null)}/>:null}
  </div>;
}

const CHANNEL_METRICS=[
  {name:'自家平台',sales:462000,orders:67,refunds:6800},
  {name:'Keeta',sales:274000,orders:39,refunds:10000},
  {name:'門店',sales:128000,orders:20,refunds:0},
] as const;

export function ReportPage({mode}:{mode:'sales'|'products'|'channels'|'refunds'|'operations'|'export'}){
  const products=usePreviewCatalog(state=>state.products);
  const [period,setPeriod]=useState('TODAY');
  const title=mode==='sales'?'銷售':mode==='products'?'產品':mode==='channels'?'渠道':mode==='refunds'?'退款':mode==='operations'?'營運':'匯出';
  const salesTotal=CHANNEL_METRICS.reduce((sum,item)=>sum+item.sales,0);
  const orders=CHANNEL_METRICS.reduce((sum,item)=>sum+item.orders,0);
  return <div className="v3-functional-page">
    <div className="v3-preview-banner"><strong>報表 Preview</strong><span>報表只讀；數字係介面驗收示例，唔代表 Production 營業額。</span></div>
    <PageHeader eyebrow="報表" title={title} description="固定可信報表介面；錯誤／過期唔會偽裝成 0。" />
    <div className="v3-pricing-tabs"><button className={period==='TODAY'?'is-active':''} onClick={()=>setPeriod('TODAY')}>今日</button><button className={period==='YESTERDAY'?'is-active':''} onClick={()=>setPeriod('YESTERDAY')}>昨日</button><button className={period==='7D'?'is-active':''} onClick={()=>setPeriod('7D')}>近 7 日</button></div>
    {mode==='sales'?<><section className="v3-whole-kpi-grid"><article><span>有效營業額</span><strong>{money(salesTotal)}</strong><small>{period}</small></article><article><span>訂單數</span><strong>{orders}</strong></article><article><span>平均客單價</span><strong>{money(Math.round(salesTotal/orders))}</strong></article><article><span>退款</span><strong>{money(CHANNEL_METRICS.reduce((sum,item)=>sum+item.refunds,0))}</strong></article></section></>:null}
    {mode==='products'?<div className="v3-price-edit-list">{products.slice().sort((a,b)=>b.priceMinor-a.priceMinor).map((product,index)=><article key={product.id}><div><strong>{product.name}</strong><small>{product.category} · {product.code}</small></div><strong>{Math.max(1,22-index)} 件</strong><StatusBadge tone={product.status==='已停用'?'neutral':'good'}>{product.status}</StatusBadge></article>)}</div>:null}
    {mode==='channels'?<div className="v3-price-edit-list">{CHANNEL_METRICS.map(channel=><article key={channel.name}><div><strong>{channel.name}</strong><small>{channel.orders} 張訂單</small></div><strong>{money(channel.sales)}</strong><StatusBadge tone="good">已確認</StatusBadge></article>)}</div>:null}
    {mode==='refunds'?<div className="v3-action-list"><article><div><strong>RF-2601001</strong><small>MF-2600975 · 自家平台</small></div><strong>HK$68.00</strong><StatusBadge tone="good">已退款</StatusBadge></article><article><div><strong>RF-2600990</strong><small>Keeta provider evidence</small></div><strong>HK$100.00</strong><StatusBadge tone="neutral">只讀</StatusBadge></article></div>:null}
    {mode==='operations'?<div className="v3-action-list"><article><div><strong>打印異常</strong><small>今日</small></div><strong>1</strong><StatusBadge tone="warning">需要處理</StatusBadge></article><article><div><strong>渠道異常</strong><small>今日</small></div><strong>1</strong><StatusBadge tone="warning">需要處理</StatusBadge></article><article><div><strong>裝置資料過期</strong><small>今日</small></div><strong>1</strong><StatusBadge tone="unknown">資料過期</StatusBadge></article></div>:null}
    {mode==='export'?<section className="v3-functional-section"><div className="v3-functional-grid"><label><span>報表類型</span><select><option>銷售明細</option><option>商品表現</option><option>渠道報表</option><option>退款記錄</option></select></label><label><span>格式</span><select><option>CSV</option><option>Excel</option></select></label></div><button className="v3-primary" type="button">Preview 產生匯出</button><div className="v3-mobile-form-note">Preview 唔會建立包含 Production 敏感資料嘅真實匯出。</div></section>:null}
  </div>;
}
