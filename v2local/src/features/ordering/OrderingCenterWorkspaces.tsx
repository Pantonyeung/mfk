import {useState} from 'react';
import type {SyncedOptionSet} from '../../runtime/admin-config-projection.ts';
import type {MfkOrderLineCompositionV1} from '../../../../contracts/order-line-composition-v1.ts';
import './ordering-center-workspaces.css';

export interface WorkspaceProduct{
  readonly id:string;
  readonly category:string;
  readonly name:string;
  readonly priceMinor:number;
  readonly priceLabel:string;
  readonly imageUrl?:string;
  readonly optionSets?:readonly SyncedOptionSet[];
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
  |{readonly type:'fast-lane';readonly lane:'riceball-pool'|'required'|'combo'}
  |{readonly type:'quick-drink-config';readonly productId:string;readonly comboLineId:string;readonly groupId:string;readonly choiceId:string}
  |{readonly type:'pending-order';readonly orderId:string}
  |{readonly type:'hold'}
  |{readonly type:'holds'}
  |null;

const money=(minor:number)=>(minor<0?'-':'')+String.fromCharCode(36)+(Math.abs(minor)/100).toFixed(2);

export function ProductConfigWorkspace({product,onAdd,maxQty=99,onDirtyChange}:{product:WorkspaceProduct;onAdd:(detail:string,deltaMinor:number,qty:number,structured:{readonly selections:Readonly<Record<string,readonly string[]>>;readonly note:string})=>void;maxQty?:number;onDirtyChange?:(dirty:boolean)=>void}){
  const [qty,setQty]=useState(1);
  const [note,setNote]=useState('');
  const [selected,setSelected]=useState<Record<string,string[]>>(()=>Object.fromEntries(
    (product.optionSets??[]).map(set=>[
      set.id,
      set.options.filter(option=>option.defaultSelected).map(option=>option.id),
    ]),
  ));

  const toggle=(set:SyncedOptionSet,optionId:string)=>{
    onDirtyChange?.(true);
    setSelected(current=>{
      const existing=current[set.id]??[];
      if(set.selection==='SINGLE')return {...current,[set.id]:[optionId]};
      const on=existing.includes(optionId);
      const next=on?existing.filter(id=>id!==optionId):[...existing,optionId];
      return {...current,[set.id]:next.slice(0,Math.max(1,set.max||next.length))};
    });
  };
  const selectedOptions=(product.optionSets??[]).flatMap(set=>{
    const ids=new Set(selected[set.id]??[]);
    return set.options.filter(option=>ids.has(option.id));
  });
  const delta=selectedOptions.reduce((sum,option)=>sum+option.priceAdjustmentMinor,0);
  const invalid=(product.optionSets??[]).some(set=>{
    const count=(selected[set.id]??[]).length;
    return count<set.min||count>set.max||(set.required&&count<1);
  });
  const detail=[
    ...(product.optionSets??[]).flatMap(set=>{
      const ids=new Set(selected[set.id]??[]);
      const names=set.options.filter(option=>ids.has(option.id)).map(option=>option.name);
      return names.length?[set.name+'：'+names.join('、')]:[];
    }),
    note.trim(),
  ].filter(Boolean).join(' · ');

  return <div className="cfg-workspace">
    <header className="cfg-product-head">
      <div className="cfg-product-hero">{product.imageUrl?<img src={product.imageUrl} alt=""/>:null}</div>
      <div><small>{product.category}</small><h2>{product.name}</h2><strong>{money(product.priceMinor+delta)}</strong></div>
      <div className="cfg-qty"><span>數量</span><button disabled={qty<=1} onClick={()=>{onDirtyChange?.(true);setQty(Math.max(1,qty-1));}}>−</button><b>{qty}</b><button disabled={qty>=maxQty} onClick={()=>{onDirtyChange?.(true);setQty(Math.min(maxQty,qty+1));}}>＋</button></div>
    </header>

    {(product.optionSets??[]).length
      ?(product.optionSets??[]).map(set=><section className="cfg-block" key={set.id}>
        <header><b>{set.name}</b><span>{set.required?'必選':'可選'} · {set.selection==='SINGLE'?'單選':'多選'} · {set.min}–{set.max}</span></header>
        <div className="cfg-choice-grid three">{set.options.map(option=>{
          const active=(selected[set.id]??[]).includes(option.id);
          const price=option.priceAdjustmentMinor;
          return <button key={option.id} className={active?'active':''} onClick={()=>toggle(set,option.id)}>
            <b>{option.name}</b>{price!==0?<small>{price>0?'+':''}{money(price)}</small>:null}
          </button>;
        })}</div>
      </section>)
      :<section className="cfg-block"><header><b>商品選項</b><span>Admin</span></header><p>此商品目前冇已發布選項組。</p></section>}

    <label className="cfg-note"><span>備註</span><input value={note} maxLength={60} onChange={event=>{onDirtyChange?.(true);setNote(event.target.value);}} placeholder="例如：不要蔥、醬分開"/><small>{note.length}/60</small></label>
    <footer className="cfg-action"><div><span>單價</span><b>{money(product.priceMinor+delta)}</b></div><button className="primary" disabled={invalid} onClick={()=>onAdd(detail,delta,qty,{selections:selected,note:note.trim()})}>加入訂單　{money((product.priceMinor+delta)*qty)}</button></footer>
  </div>;
}

export interface HoldPlacementTable{
  readonly id:string;
  readonly label:string;
  readonly occupied:boolean;
  readonly codeLabel?:string;
}

export function HoldCartWorkspace({
  lines,totalMinor,tables,onHoldWaiting,onHoldQueue,onHoldTable,onDirtyChange
}:{
  lines:readonly WorkspaceCartLine[];
  totalMinor:number;
  tables:readonly HoldPlacementTable[];
  onHoldWaiting:(partySize:number,note:string)=>void;
  onHoldQueue:(partySize:number,note:string)=>void;
  onHoldTable:(tableId:string,partySize:number,note:string)=>void;
  onDirtyChange?:(dirty:boolean)=>void;
}){
  const [mode,setMode]=useState<'cart'|'dining'>('cart');
  const [partySize,setPartySize]=useState(2);
  const [note,setNote]=useState('');

  return <div className="hold-cart-workspace">
    <header>
      <div><h2>暫存工作台</h2><p>同一頁完成：暫存待客，或者掛入堂食／輪候。</p></div>
      <strong>{money(totalMinor)}</strong>
    </header>

    <section className="hold-kind-grid">
      <button className="waiting" onClick={()=>onHoldWaiting(partySize,note)}>
        <b>暫存待客</b>
        <span>客人未確認；保存呢張 Cart，之後由「取回訂單」直接攞返。</span>
      </button>
      <button className={mode==='dining'?'active dining':'dining'} onClick={()=>{onDirtyChange?.(true);setMode('dining');}}>
        <b>掛入堂食</b>
        <span>唔跳頁；下面「購物車內容」即場轉成加入輪候＋1–9 號枱。</span>
      </button>
    </section>

    {mode==='cart'?<section className="hold-cart-summary">
      <header><b>購物車內容</b><span>{lines.reduce((sum,line)=>sum+line.qty,0)} 件</span></header>
      {lines.map(line=><article key={line.id}>
        <span>{line.qty}×</span>
        <div><b>{line.name}</b>{line.detail?<small>{line.detail}</small>:null}</div>
        <strong>{money(line.qty*line.unitMinor)}</strong>
      </article>)}
    </section>:<section className="hold-inline-dining">
      <aside className="hold-inline-left">
        <div className="hold-party">
          <span>人數</span>
          <div><button onClick={()=>{onDirtyChange?.(true);setPartySize(Math.max(1,partySize-1));}}>−</button><b>{partySize}</b><button onClick={()=>{onDirtyChange?.(true);setPartySize(partySize+1);}}>＋</button></div>
        </div>
        <button className="hold-queue-button" onClick={()=>onHoldQueue(partySize,note)}>
          <b>加入輪候</b>
          <span>直接放入堂食輪候，唔使再跳堂食頁揀第二次。</span>
        </button>
        <label className="hold-note"><span>備註</span><input value={note} onChange={event=>{onDirtyChange?.(true);setNote(event.target.value);}} placeholder="例如：等 10 分鐘"/></label>
        <button className="hold-back-cart" onClick={()=>{onDirtyChange?.(true);setMode('cart');}}>返回購物車內容</button>
      </aside>
      <div className="hold-nine-grid">
        {tables.map(table=><button key={table.id} className={table.occupied?'occupied':'available'} disabled={table.occupied} onClick={()=>onHoldTable(table.id,partySize,note)}>
          <b>{table.label}</b>
          <span>{table.occupied?(table.codeLabel??'使用中'):'空枱'}</span>
        </button>)}
      </div>
    </section>}
  </div>;
}


export interface WorkspaceHoldDraft{
  readonly id:string;
  readonly codeLabel:string;
  readonly kind:'dining'|'waiting';
  readonly createdAt:string;
  readonly partySize:number;
  readonly note:string;
  readonly totalMinor:number;
  readonly assignedTable?:string;
  readonly items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode?:'takeaway'|'dine-in';detail?:string;composition?:MfkOrderLineCompositionV1}[];
}

export function HoldListWorkspace({holds,onRestore,onRemove}:{holds:readonly WorkspaceHoldDraft[];onRestore:(hold:WorkspaceHoldDraft)=>void;onRemove:(id:string)=>void}){
  return <div className="hold-list-workspace">
    <header><div><h2>暫存單</h2><p>未完成付款／未正式提交嘅 Cart 全部喺呢度取回。</p></div><strong>{holds.length} 張</strong></header>
    <div className="hold-list">
      {holds.length?holds.map(hold=><article key={hold.id}>
        <div className="hold-list-head"><div><b>{hold.codeLabel}</b><span>{hold.kind==='dining'?'堂食／輪候':'暫存待客'}</span></div><strong>{money(hold.totalMinor)}</strong></div>
        <div className="hold-list-meta"><span>{new Date(hold.createdAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</span><span>{hold.partySize} 位</span>{hold.assignedTable?<span>枱 {hold.assignedTable.replace('T','')}</span>:null}</div>
        <div className="hold-list-items">{hold.items.map((item,index)=><p key={hold.id+'-'+index}><span>{item.qty}×</span><b>{item.name}{item.detail?<small>{item.detail}</small>:null}</b><strong>{money(item.qty*item.unitMinor)}</strong></p>)}</div>
        {hold.note?<small>備註：{hold.note}</small>:null}
        <footer><button type="button" className="danger" onClick={()=>onRemove(hold.id)}>刪除暫存</button><button type="button" className="primary" onClick={()=>onRestore(hold)}>取回購物車</button></footer>
      </article>):<div className="hold-list-empty">而家未有暫存單。</div>}
    </div>
  </div>;
}
