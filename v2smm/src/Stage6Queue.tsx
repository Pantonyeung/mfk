import {useMemo,useState} from 'react';
import type {SmmConnectionState,SmmOrderProjection,SmmWorkItem} from './product-types';
import {
  smmStage6ConnectionState,
  smmStage6Counts,
  smmStage6DisplayCode,
  smmStage6ItemCount,
  smmStage6MatchesFilter,
  smmStage6ObservedTime,
  smmStage6ServiceKind,
  smmStage6Sort,
  smmStage6Source,
  smmStage6StateLabel,
  type SmmStage6Filter,
} from './stage6-queue.mjs';

type Stage6Surface='LIST'|'DETAIL'|'ACTIONS'|'STATUS';

function matchingOrder(item:SmmWorkItem,orders:readonly SmmOrderProjection[]){
  if(item.orderId){
    const byId=orders.find(order=>order.orderId===item.orderId);
    if(byId)return byId;
  }
  if(item.displayCode)return orders.find(order=>order.displayCode===item.displayCode);
  return undefined;
}

function itemKey(item:SmmWorkItem){return item.displayCode||item.workId}

function timeLabel(value:string){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '時間待讀回';
  return date.toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false});
}

function dateTimeLabel(value:string){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '時間待讀回';
  return date.toLocaleString('zh-HK',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
}

function serviceLabel(item:SmmWorkItem){
  const kind=smmStage6ServiceKind(item);
  return kind==='DINE_IN'?'堂食':kind==='TAKEAWAY'?'外賣':'服務方式待讀回';
}

function statusTone(state:SmmWorkItem['state']){
  return state==='ACTION_REQUIRED'?'critical':state==='DELAYED'?'warning':state==='UNKNOWN'?'unknown':'normal';
}

function lifecycleLabel(value:string|undefined){
  const state=String(value??'').toUpperCase();
  if(['NEW','CREATED','PENDING','RECEIVED'].includes(state))return '新訂單';
  if(['PREPARING','IN_PROGRESS','PROCESSING'].includes(state))return '製作中';
  if(['READY','READY_FOR_PICKUP'].includes(state))return '可取餐';
  if(state==='COMPLETED')return '已完成';
  if(state==='CANCELLED')return '已取消';
  return null;
}

function Stage6ConnectionBanner({connection,hasRows}:{connection:SmmConnectionState;hasRows:boolean}){
  const state=smmStage6ConnectionState(connection,hasRows);
  if(!state)return null;
  return <section className={`stage6-state-banner stage6-state-${state.kind.toLowerCase()}`} data-stage6-shared-state={state.kind} role="status">
    <span className="stage6-state-icon" aria-hidden="true">{state.kind==='LOADING'?'◌':state.kind==='OFFLINE'?'⌁':state.kind==='STALE'?'◷':state.kind==='PARTIAL'?'◫':state.kind==='UNKNOWN'?'?':'!'}</span>
    <div><strong>{state.title}</strong><small>{state.detail}</small></div>
  </section>;
}

function Stage6Empty(){
  return <section className="stage6-empty" data-stage6-visual="6.5_EMPTY">
    <img src="/brand/stage6/stage6-empty.webp" alt="磨飯角色拿住平板，表示目前沒有待處理訂單"/>
    <h2>目前沒有需要處理的訂單！</h2>
    <p>一切順利，繼續保持！</p>
    <blockquote>「好味 · 由你開始！」<small>More Fun in Every Order</small></blockquote>
  </section>;
}

function Stage6Actions({onClose}:{onClose:()=>void}){
  const actions=[
    ['▶','開始製作','標記為製作中'],
    ['✓','已完成 / 可取餐','標記為可取餐'],
    ['◷','延遲','更新預計時間'],
    ['!','需要協助','如商品缺貨 / 需聯絡客人'],
    ['×','取消訂單','標記為已取消'],
  ] as const;
  return <div className="stage6-action-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="stage6-action-sheet" role="dialog" aria-modal="true" aria-labelledby="stage6-action-title" data-stage6-visual="6.3_ACTIONS">
      <header><strong id="stage6-action-title">更新訂單狀態</strong><small>目前 Stage 6 只讀；以下操作未連接。</small></header>
      <div className="stage6-action-list">
        {actions.map(([icon,label,detail])=><div className="stage6-disabled-action" key={label}>
          <button type="button" disabled aria-disabled="true">
            <span aria-hidden="true">{icon}</span>
            <span><strong>{label}</strong><small>{detail}</small></span>
          </button>
          <small>此操作需由 SMT 處理</small>
        </div>)}
      </div>
      <button type="button" className="stage6-cancel-sheet" onClick={onClose}>取消</button>
    </section>
  </div>;
}

function Stage6Detail({
  item,
  order,
  surface,
  refreshing,
  onBack,
  onActions,
  onRefreshStatus,
}:{
  item:SmmWorkItem;
  order:SmmOrderProjection|undefined;
  surface:'DETAIL'|'STATUS';
  refreshing:boolean;
  onBack:()=>void;
  onActions:()=>void;
  onRefreshStatus:()=>void;
}){
  const display=smmStage6DisplayCode(item,order);
  const source=smmStage6Source(item,order);
  const observed=smmStage6ObservedTime(item,order);
  const count=smmStage6ItemCount(item);
  const canonicalStatus=smmStage6StateLabel(item.state,item.statusLabel);
  const fulfillment=lifecycleLabel(order?.lifecycle);
  const note=item.note??order?.note;
  const structured=item.items??[];
  const customerName=String(item.customerName??'').trim();
  const customerContact=String(item.customerContact??'').trim();

  return <section className="stage6-detail" data-stage6-visual={surface==='STATUS'?'6.4_STATUS':'6.2_DETAIL'}>
    <header className="stage6-subheader">
      <button type="button" onClick={onBack} aria-label="返回待處理列表">‹</button>
      <div><strong>{surface==='STATUS'?'狀態更新':'訂單詳情'}</strong><small>只讀正式投影</small></div>
      <span/>
    </header>

    <section className="stage6-detail-identity">
      <div><strong>{display}</strong><span>{source}</span></div>
      <span className={`stage6-status ${statusTone(item.state)}`}>{canonicalStatus}</span>
      <small>{dateTimeLabel(observed)} · {serviceLabel(item)}{count===null?' · 項目數待讀回':` · ${count} 項`}</small>
      {fulfillment?<small>目前狀態：{fulfillment}</small>:null}
    </section>

    {(customerName||customerContact)?<section className="stage6-detail-section">
      <h3>客人</h3>
      {customerName?<strong>{customerName}</strong>:null}
      {customerContact?<span>{customerContact}</span>:null}
    </section>:null}

    <section className="stage6-detail-section">
      <h3>商品{count===null?'':`（${count} 項）`}</h3>
      {structured.length?<div className="stage6-item-lines">{structured.map((line,index)=><article key={index}>
        <b>{line.quantity}</b>
        <div><strong>{line.name}</strong>{line.detail?<small>{line.detail}</small>:null}</div>
        {line.amountLabel?<span>{line.amountLabel}</span>:null}
      </article>)}</div>:
      order?.itemSummary?<p className="stage6-canonical-summary">{order.itemSummary}</p>:
      <p className="stage6-canonical-summary">{item.summary}</p>}
    </section>

    {note?<section className="stage6-note"><strong>備註</strong><span>{note}</span></section>:null}

    {surface==='STATUS'?<section className="stage6-readback-card">
      <strong>目前只顯示重新讀取結果</strong>
      <p>Stage 6 無權更新製作或取消狀態；任何狀態變更都必須由 SMT 執行，再由呢度讀返正式結果。</p>
    </section>:null}

    <footer className="stage6-detail-actions">
      <button type="button" onClick={onActions}>更多操作</button>
      {surface==='DETAIL'
        ?<button type="button" className="primary" disabled={refreshing} onClick={onRefreshStatus}>{refreshing?'重新讀取中…':'重新讀取狀態'}</button>
        :<div className="stage6-disabled-complete"><button type="button" disabled>已完成</button><small>此操作需由 SMT 處理</small></div>}
    </footer>
  </section>;
}

export function Stage6QueueView({
  connection,
  items,
  orders,
  onRefresh,
}:{
  connection:SmmConnectionState;
  items:readonly SmmWorkItem[];
  orders:readonly SmmOrderProjection[];
  onRefresh:()=>Promise<void>|void;
}){
  const [filter,setFilter]=useState<SmmStage6Filter>('ALL');
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [surface,setSurface]=useState<Stage6Surface>('LIST');
  const [refreshing,setRefreshing]=useState(false);

  const sorted=useMemo(()=>smmStage6Sort(items),[items]);
  const counts=useMemo(()=>smmStage6Counts(sorted),[sorted]);
  const filtered=useMemo(()=>sorted.filter(item=>smmStage6MatchesFilter(item,filter)),[sorted,filter]);
  const selected=selectedKey?sorted.find(item=>itemKey(item)===selectedKey):undefined;
  const order=selected?matchingOrder(selected,orders):undefined;

  const openDetail=(item:SmmWorkItem)=>{
    setSelectedKey(itemKey(item));
    setSurface('DETAIL');
  };
  const backToList=()=>{setSurface('LIST');setSelectedKey(null)};
  const refreshStatus=async()=>{
    if(refreshing)return;
    setRefreshing(true);
    try{await Promise.resolve(onRefresh());setSurface('STATUS');}
    finally{setRefreshing(false)}
  };

  if(selected&&surface!=='LIST'){
    return <>
      <Stage6Detail
        item={selected}
        order={order}
        surface={surface==='STATUS'?'STATUS':'DETAIL'}
        refreshing={refreshing}
        onBack={backToList}
        onActions={()=>setSurface('ACTIONS')}
        onRefreshStatus={()=>void refreshStatus()}
      />
      {surface==='ACTIONS'?<Stage6Actions onClose={()=>setSurface('DETAIL')}/>:null}
    </>;
  }

  const filters:[
    SmmStage6Filter,
    string,
    number,
  ][]=[
    ['ALL','全部',counts.ALL],
    ['TAKEAWAY','外賣',counts.TAKEAWAY],
    ['DINE_IN','堂食',counts.DINE_IN],
    ['ATTENTION','需處理',counts.ATTENTION],
  ];

  return <section className="stage6-page" data-stage6-visual="6.1_QUEUE">
    <header className="stage6-header">
      <div><h1>待處理</h1><small>即時訂單 · 優先處理 · 清晰狀態</small></div>
      <button type="button" className="stage6-refresh" disabled={refreshing} onClick={()=>void onRefresh()} aria-label="重新整理待處理">{refreshing?'…':'↻'}</button>
    </header>

    <Stage6ConnectionBanner connection={connection} hasRows={sorted.length>0}/>

    <div className="stage6-filters" aria-label="待處理分類">
      {filters.map(([value,label,count])=><button type="button" key={value} className={filter===value?'active':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>
        <b>{count}</b><span>{label}</span>
      </button>)}
    </div>

    {connection==='READY'&&sorted.length===0?<Stage6Empty/>:null}

    {sorted.length>0&&filtered.length===0?<section className="stage6-filter-empty" role="status">
      <strong>呢個分類暫時冇項目</strong>
      <span>數量只按目前正式投影計算。</span>
    </section>:null}

    {filtered.length?<div className="stage6-queue">{filtered.map(item=>{
      const rowOrder=matchingOrder(item,orders);
      const display=smmStage6DisplayCode(item,rowOrder);
      const source=smmStage6Source(item,rowOrder);
      const observed=smmStage6ObservedTime(item,rowOrder);
      const count=smmStage6ItemCount(item);
      const state=smmStage6StateLabel(item.state,item.statusLabel);
      return <button type="button" className={`stage6-card stage6-card-${statusTone(item.state)}`} key={itemKey(item)} onClick={()=>openDetail(item)}>
        <span className="stage6-card-source">{source}</span>
        <span className="stage6-card-main"><strong>{display}</strong><small>{timeLabel(observed)}{count===null?' · 項目數待讀回':` · ${count} 項`}</small><small>{item.summary}</small></span>
        <span className={`stage6-status ${statusTone(item.state)}`}>{state}</span>
        <span className="stage6-card-arrow" aria-hidden="true">›</span>
      </button>;
    })}</div>:null}
  </section>;
}
