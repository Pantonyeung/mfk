import {useMemo,useState} from 'react';
import './ordering-center-workspaces.css';

export interface WorkspaceProduct{
  readonly id:string;
  readonly category:string;
  readonly name:string;
  readonly priceMinor:number;
  readonly priceLabel:string;
  readonly imageUrl?:string;
}
export interface WorkspaceCartLine{
  readonly id:string;
  readonly productId:string;
  readonly name:string;
  readonly qty:number;
  readonly unitMinor:number;
  readonly detail?:string;
}
export type OrderingPanelState=
  |{readonly type:'product';readonly productId:string}
  |{readonly type:'organize'}
  |{readonly type:'combo'}
  |{readonly type:'hold'}
  |null;

const money=(minor:number)=>'$'+(Math.max(0,minor)/100).toFixed(2);

export function ProductConfigWorkspace({product,onAdd}:{product:WorkspaceProduct;onAdd:(detail:string,deltaMinor:number,qty:number)=>void}){
  const [qty,setQty]=useState(1);
  const [rice,setRice]=useState('正常飯');
  const [flavor,setFlavor]=useState('原味');
  const [drink,setDrink]=useState('台式奶茶');
  const [spice,setSpice]=useState('不辣');
  const [sauce,setSauce]=useState('正常');
  const [addons,setAddons]=useState<Record<string,boolean>>({});
  const [note,setNote]=useState('');
  const addonPrices:Record<string,number>={'加蛋':300,'加芝士':400,'加午餐肉':600,'加牛腩':2000,'加大份飯':600};
  const delta=Object.entries(addons).reduce((sum,[key,on])=>sum+(on?(addonPrices[key]??0):0),0);
  const detail=[rice,flavor,drink,spice,sauce,...Object.keys(addons).filter(key=>addons[key]),note.trim()].filter(Boolean).join(' · ');
  const toggle=(key:string)=>setAddons(current=>({...current,[key]:!current[key]}));
  return <div className="cfg-workspace">
    <header className="cfg-product-head">
      <div className="cfg-product-hero">{product.imageUrl?<img src={product.imageUrl} alt=""/>:null}</div>
      <div><small>{product.category}</small><h2>{product.name}</h2><strong>{money(product.priceMinor+delta)}</strong></div>
      <div className="cfg-qty"><span>數量</span><button onClick={()=>setQty(Math.max(1,qty-1))}>−</button><b>{qty}</b><button onClick={()=>setQty(qty+1)}>＋</button></div>
    </header>

    <section className="cfg-block"><header><b>固定選項 1｜飯量</b><span>單選</span></header><div className="cfg-choice-grid three">{['正常飯','少飯','半飯','走飯'].map(value=><button key={value} className={rice===value?'active':''} onClick={()=>setRice(value)}>{value}</button>)}</div></section>
    <section className="cfg-block"><header><b>固定選項 2｜常用口味</b><span>單選</span></header><div className="cfg-choice-grid three">{['原味','咖喱','黑椒'].map(value=><button key={value} className={flavor===value?'active':''} onClick={()=>setFlavor(value)}>{value}</button>)}</div></section>
    <section className="cfg-block"><header><b>套餐飲品</b><span>必選</span></header><div className="cfg-choice-grid three">{['台式奶茶','凍檸茶','不用飲品'].map(value=><button key={value} className={drink===value?'active':''} onClick={()=>setDrink(value)}>{value}</button>)}</div></section>

    <div className="cfg-split">
      <section className="cfg-block"><header><b>加配</b><span>多選</span></header><div className="cfg-check-list">{Object.entries(addonPrices).map(([name,price])=><label key={name}><input type="checkbox" checked={Boolean(addons[name])} onChange={()=>toggle(name)}/><span>{name}</span><b>+ {money(price)}</b></label>)}</div></section>
      <section className="cfg-block"><header><b>辣度</b><span>單選</span></header><div className="cfg-choice-grid two">{['不辣','微辣','中辣','大辣'].map(value=><button key={value} className={spice===value?'active':''} onClick={()=>setSpice(value)}>{value}</button>)}</div><header className="cfg-subhead"><b>醬汁</b></header><div className="cfg-choice-grid two">{['正常','少醬','多醬','醬另上'].map(value=><button key={value} className={sauce===value?'active':''} onClick={()=>setSauce(value)}>{value}</button>)}</div></section>
    </div>

    <label className="cfg-note"><span>備註</span><input value={note} maxLength={60} onChange={event=>setNote(event.target.value)} placeholder="例如：不要蔥、醬分開"/><small>{note.length}/60</small></label>
    <footer className="cfg-action"><div><span>單價</span><b>{money(product.priceMinor+delta)}</b></div><button className="primary" onClick={()=>onAdd(detail,delta,qty)}>加入訂單　{money((product.priceMinor+delta)*qty)}</button></footer>
  </div>;
}

export function OrganizeWorkspace({lines,onDone}:{lines:readonly WorkspaceCartLine[];onDone:()=>void}){
  const mealLines=lines.filter(line=>!line.productId.toLowerCase().includes('tea'));
  const drinkLines=lines.filter(line=>line.productId.toLowerCase().includes('tea'));
  const [selected,setSelected]=useState<Record<string,string>>({});
  return <div className="organize-workspace">
    <header className="organize-title"><h2>整理工作台</h2><div><span>未完成 {Math.max(0,mealLines.length-Object.keys(selected).length)}</span><span>可配對 {Math.ceil(mealLines.length/2)}</span><span>待補飲品 {drinkLines.length}</span></div></header>
    <section className="organize-section"><header><b><i>1</i> 必選</b><span>{mealLines.length}</span></header>
      <div className="organize-required">{mealLines.map((line,index)=><article key={line.id}><div><b>{index+1}　{line.name}</b><small>{line.detail??'請確認必選項'}</small></div><div className="organize-options">{['肉燥','咖喱','菜飯'].map(v=><button key={v} className={selected[line.id]===v?'active':''} onClick={()=>setSelected(s=>({...s,[line.id]:v}))}>{v}</button>)}</div></article>)}</div>
    </section>
    <section className="organize-section"><header><b><i>2</i> 配對／代補</b><span>{Math.ceil(mealLines.length/2)}</span></header>
      <div className="organize-pairs">{Array.from({length:Math.ceil(mealLines.length/2)},(_,idx)=>{const a=mealLines[idx*2],b=mealLines[idx*2+1];return <article key={idx}><strong>{idx+1} 組</strong><div>{a?<span>{a.name}</span>:null}{b?<span>{b.name}</span>:<em>＋ 未配對</em>}</div></article>})}</div>
    </section>
    <section className="organize-section"><header><b><i>3</i> 快捷飲品</b><span>{drinkLines.length}</span></header><div className="organize-drinks">{['凍檸茶','台式奶茶','手打檸檬茶','不用飲品'].map(v=><button key={v}>{v}</button>)}</div></section>
    <footer className="organize-footer"><button onClick={onDone}>完成整理</button></footer>
  </div>;
}

export function ComboWorkspace({products,onAdd}:{products:readonly WorkspaceProduct[];onAdd:(productId:string,detail:string,unitMinor:number)=>void}){
  const riceballs=products.filter(product=>product.category==='飯團');
  const [tier,setTier]=useState<'A'|'B'|'C'|'D'>('B');
  const [riceball,setRiceball]=useState(riceballs[0]?.id??'');
  const [side,setSide]=useState('香脆薯角');
  const [drink,setDrink]=useState('台式奶茶');
  const tierPrice={A:4100,B:4300,C:4500,D:4700}[tier];
  const selected=riceballs.find(product=>product.id===riceball);
  const detail=tier+'套 · '+side+' · '+drink;
  return <div className="combo-workspace">
    <header className="combo-title"><div><h2>紫米套餐區</h2><p>飯糰＋小食＋飲品；本地先完成操作模型，價格／選項之後由 Admin 發布。</p></div><strong>{tier} 套　{money(tierPrice)}+</strong></header>
    <div className="combo-tiers">{(['A','B','C','D'] as const).map(value=><button key={value} className={tier===value?'active':''} onClick={()=>setTier(value)}><b>{value} 套</b><span>{money({A:4100,B:4300,C:4500,D:4700}[value])}+</span></button>)}</div>
    <section className="combo-section"><header><b>1　選擇飯糰</b><span>必選 1</span></header><div className="combo-product-grid">{riceballs.map(product=><button key={product.id} className={riceball===product.id?'active':''} onClick={()=>setRiceball(product.id)}>{product.imageUrl?<img src={product.imageUrl} alt=""/>:null}<b>{product.name}</b><span>{product.priceLabel}</span></button>)}</div></section>
    <section className="combo-section duo"><div><header><b>2　選擇小食</b></header><div className="combo-option-grid">{['香脆薯角','QQ 紫米餅','炸雞塊','台灣一口腸','黃金薯餅','涼拌西蘭花'].map(v=><button key={v} className={side===v?'active':''} onClick={()=>setSide(v)}>{v}</button>)}</div></div><div><header><b>3　選擇飲品</b></header><div className="combo-option-grid">{['台式奶茶','凍檸茶','熱玄米茶','手打檸檬茶','不用飲品'].map(v=><button key={v} className={drink===v?'active':''} onClick={()=>setDrink(v)}>{v}</button>)}</div></div></section>
    <section className="combo-summary"><div><span>已選</span><b>{selected?.name??'未選'} · {side} · {drink}</b></div><strong>{money(tierPrice)}</strong></section>
    <footer className="combo-footer"><button disabled={!selected} onClick={()=>selected&&onAdd(selected.id,detail,tierPrice)}>加入購物車　{money(tierPrice)}</button></footer>
  </div>;
}


export function HoldCartWorkspace({lines,totalMinor,onHold}:{lines:readonly WorkspaceCartLine[];totalMinor:number;onHold:(kind:'dining'|'waiting',partySize:number,note:string)=>void}){
  const [kind,setKind]=useState<'dining'|'waiting'>('waiting');
  const [partySize,setPartySize]=useState(2);
  const [note,setNote]=useState('');
  return <div className="hold-cart-workspace">
    <header><div><h2>暫存／候位</h2><p>暫存唔會建立正式訂單；只保存購物車，等客人確認或者安排堂食。</p></div><strong>{money(totalMinor)}</strong></header>
    <section className="hold-kind-grid">
      <button className={kind==='dining'?'active':''} onClick={()=>setKind('dining')}><b>掛入堂食／輪候</b><span>進入堂食九宮格流程，之後安排座位。</span></button>
      <button className={kind==='waiting'?'active':''} onClick={()=>setKind('waiting')}><b>暫存待客</b><span>客人話等一等，先離開點單流程，之後再處理。</span></button>
    </section>
    <section className="hold-cart-summary"><header><b>購物車內容</b><span>{lines.reduce((sum,line)=>sum+line.qty,0)} 件</span></header>{lines.map(line=><article key={line.id}><span>{line.qty}×</span><b>{line.name}</b><strong>{money(line.qty*line.unitMinor)}</strong></article>)}</section>
    <div className="hold-cart-form">
      <label><span>人數</span><div><button onClick={()=>setPartySize(Math.max(1,partySize-1))}>−</button><b>{partySize}</b><button onClick={()=>setPartySize(partySize+1)}>＋</button></div></label>
      <label><span>備註</span><input value={note} onChange={event=>setNote(event.target.value)} placeholder="例如：客人 10 分鐘後返"/></label>
    </div>
    <footer><button onClick={()=>onHold(kind,partySize,note)}>確認暫存</button></footer>
  </div>;
}
