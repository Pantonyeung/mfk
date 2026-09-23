import {useMemo,useState} from 'react';
import type {
  SmmConnectionState,
  SmmPendingIntent,
  SmmProduct,
  SmmReadModelSnapshot,
} from './product-types';
import {
  capacityStateCopy,
  channelStateCopy,
  connectionCopy,
  formatObservedAt,
  lifecycleLabel,
  orderReadbackCopy,
  printStateCopy,
  refundStateCopy,
  reportFreshnessCopy,
  workStateCopy,
} from './presentation';
import {EmptyState,ModalSheet,PageHeading,SectionHeading,StateMessage,StatusTag} from './ui';

export function WorkView({connection,items,onRefresh}:{
  connection:SmmConnectionState;
  items:NonNullable<SmmReadModelSnapshot['work']>;
  onRefresh:()=>void;
}){
  const groups=useMemo(()=>{
    const sorted=[...items].sort((a,b)=>workStateCopy(a.state).priority-workStateCopy(b.state).priority);
    return [
      {state:'ACTION_REQUIRED',title:'需要人手',detail:'先處理需要店員判斷或操作的項目'},
      {state:'DELAYED',title:'已延誤',detail:'已超出預期時間的工作'},
      {state:'UNKNOWN',title:'結果未明',detail:'等待正式系統確認的工作'},
      {state:'NORMAL',title:'正常進行中',detail:'目前按預期處理的工作'},
    ].map(group=>({...group,items:sorted.filter(item=>item.state===group.state)})).filter(group=>group.items.length);
  },[items]);
  const attention=items.filter(item=>item.state!=='NORMAL').length;

  return <section className="page work-page">
    <PageHeading eyebrow="工作" title="現在要處理甚麼" detail="需要人手、延誤及結果未明的項目會排在最前。" aside={<div className="heading-count"><strong>{attention}</strong><small>項需留意</small></div>}/>
    {!items.length?<EmptyState title={connection==='NOT_CONNECTED'?'工作服務尚未連接':'目前沒有待處理工作'} detail={connection==='NOT_CONNECTED'?'連接後會顯示正式製作、延誤及異常資料。':'目前沒有需要前線處理的事項。'}><button className="primary-button" onClick={onRefresh}>重新整理</button></EmptyState>:
      <div className="priority-groups">{groups.map(group=><section key={group.state} className="priority-group">
        <SectionHeading title={group.title} detail={group.detail} aside={<b className="section-count">{group.items.length}</b>}/>
        <div className="work-list">{group.items.map(item=>{
          const state=workStateCopy(item.state);
          return <article className={`work-row priority-${state.priority}`} key={item.workId}>
            <div className="work-code"><strong>{item.displayCode??'門店工作'}</strong><small>{new Date(item.observedAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</small></div>
            <div className="work-summary"><h2>{item.summary}</h2><p>{item.eta?`預計：${item.eta}`:'未有預計時間'}</p></div>
            <StatusTag tone={state.tone} label={state.label}/>
          </article>;
        })}</div>
      </section>)}</div>}
  </section>;
}

type OrderSegment='attention'|'active'|'history';

export function OrdersView({connection,rows,sourceFilter,onSourceFilter}:{
  connection:SmmConnectionState;
  rows:NonNullable<SmmReadModelSnapshot['orders']>;
  sourceFilter:string;
  onSourceFilter:(source:string)=>void;
}){
  const defaultSegment:OrderSegment=rows.some(row=>row.readback!=='CONFIRMED')?'attention':'active';
  const [segment,setSegment]=useState<OrderSegment>(defaultSegment);
  const [query,setQuery]=useState('');
  const sources=['全部',...Array.from(new Set(rows.map(row=>row.source)))];
  const filtered=rows.filter(row=>{
    const history=row.lifecycle==='COMPLETED'||row.lifecycle==='CANCELLED';
    const segmentOk=segment==='history'?history:segment==='attention'?!history&&row.readback!=='CONFIRMED':!history;
    const searchOk=!query.trim()||[row.displayCode,row.source,row.lifecycle,row.itemSummary].join(' ').toLowerCase().includes(query.toLowerCase());
    return segmentOk&&searchOk&&(sourceFilter==='全部'||row.source===sourceFilter);
  });

  return <section className="page orders-page">
    <PageHeading eyebrow="訂單" title="訂單記錄" detail="先查看需要注意的訂單，再處理正常進行中的訂單。" aside={<div className="heading-count"><strong>{filtered.length}</strong><small>張訂單</small></div>}/>
    <div className="orders-toolbar">
      <div className="segmented-control" role="group" aria-label="訂單範圍">
        <button className={segment==='attention'?'active':''} aria-pressed={segment==='attention'} onClick={()=>setSegment('attention')}>需留意</button>
        <button className={segment==='active'?'active':''} aria-pressed={segment==='active'} onClick={()=>setSegment('active')}>進行中</button>
        <button className={segment==='history'?'active':''} aria-pressed={segment==='history'} onClick={()=>setSegment('history')}>已完成</button>
      </div>
      <label className="search-field" htmlFor="order-search"><span>搜尋訂單</span><input id="order-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="訂單號、來源或商品"/></label>
    </div>
    {sources.length>1?<div className="filter-rail" aria-label="訂單來源">{sources.map(source=><button key={source} className={sourceFilter===source?'active':''} aria-pressed={sourceFilter===source} onClick={()=>onSourceFilter(source)}>{source}</button>)}</div>:null}
    {!filtered.length?<EmptyState title={connection==='NOT_CONNECTED'?'訂單服務尚未連接':'沒有符合條件的訂單'} detail={connection==='NOT_CONNECTED'?'連接後會顯示正式訂單、來源、狀態及時間線。':'可以改用其他搜尋字或篩選。'}/>:
      <div className="order-list">{filtered.map(row=>{
        const readback=orderReadbackCopy(row.readback);
        return <article className="order-row" key={row.orderId}>
          <header><div><small>{row.source} · {formatObservedAt(row.observedAt)}</small><h2>{row.displayCode}</h2></div><StatusTag tone={readback.tone} label={readback.label}/></header>
          <div className="order-summary"><span>{lifecycleLabel(row.lifecycle)}</span>{row.amountLabel?<strong>{row.amountLabel}</strong>:null}<span>{row.itemSummary}</span></div>
          {row.note?<p className="order-note">備註：{row.note}</p>:null}
          <details className="order-timeline"><summary>查看處理時間線</summary><div>{row.timeline.map((item,index)=><p key={`${item.at}-${index}`}><time>{new Date(item.at).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'})}</time><strong>{item.label}</strong><span>{item.detail??''}</span></p>)}</div></details>
        </article>;
      })}</div>}
  </section>;
}

export function StatusView({connection,snapshot,canSetSellability,onSellability}:{
  connection:SmmConnectionState;
  snapshot:SmmReadModelSnapshot|null;
  canSetSellability:boolean;
  onSellability:(productId:string,available:boolean)=>void;
}){
  const state=connectionCopy(connection);
  const channels=snapshot?.channels??[];
  const products=snapshot?.menu?.products??[];
  return <section className="page status-page">
    <PageHeading eyebrow="狀態" title="門店現在狀況" detail="只突出需要留意的連線、產能及商品供應狀態。" aside={snapshot?.observedAt?<small className="last-updated">{formatObservedAt(snapshot.observedAt)}</small>:undefined}/>
    <StateMessage tone={state.tone} title={state.label} detail={state.detail}/>

    <div className="status-layout">
      <section className="surface-panel status-span">
        <SectionHeading title="平台狀態" detail="平台連線及正式資料新鮮度"/>
        {!channels.length?<EmptyState title={connection==='NOT_CONNECTED'?'平台狀態尚未連接':'目前沒有平台狀態'} detail="系統不會用假連線標記代替正式讀回。"/>:
          <div className="plain-list">{channels.map(channel=>{
            const copy=channelStateCopy(channel.state);
            return <article className="plain-row" key={channel.channel}><div><strong>{channel.channel}</strong><small>{channel.detail} · {formatObservedAt(channel.observedAt)}</small></div><StatusTag tone={copy.tone} label={copy.label}/></article>;
          })}</div>}
      </section>

      <section className="surface-panel">
        <SectionHeading title="產能" detail="只顯示門店提供的產能狀態"/>
        {snapshot?.capacity?(()=>{const copy=capacityStateCopy(snapshot.capacity.state);return <><StatusTag tone={copy.tone} label={copy.label}/><h3 className="status-value">{snapshot.capacity.label}</h3><p>{snapshot.capacity.detail}</p><small>{formatObservedAt(snapshot.capacity.observedAt)}</small></>})():<EmptyState title="產能資料尚未連接" detail="SMM 不會自行判斷門店忙閒。"/>}
      </section>

      <section className="surface-panel">
        <SectionHeading title="營業日" detail="只作記錄及報表分類"/>
        {snapshot?.businessDay?<><h3 className="status-value">{snapshot.businessDay.businessDate}</h3><StatusTag tone={snapshot.businessDay.state==='OPEN'?'success':snapshot.businessDay.state==='CLOSED'?'neutral':'warning'} label={snapshot.businessDay.state==='OPEN'?'營業中':snapshot.businessDay.state==='CLOSED'?'已結束':'狀態未明'}/><small>{formatObservedAt(snapshot.businessDay.observedAt)}</small><p className="record-only-note">營業日永遠唔會阻止落單、付款或者本機提交。</p></>:<EmptyState title="營業日資料尚未連接" detail="營業日只作記錄同報表分類。"/>}
      </section>

      <section className="surface-panel status-span">
        <SectionHeading title="商品供應" detail="售罄或恢復供應只會經正式門店服務執行"/>
        {!products.length?<EmptyState title={connection==='NOT_CONNECTED'?'商品供應服務尚未連接':'目前沒有商品'} detail="正式供應狀態必須由門店權威資料提供。"/>:
          <div className="plain-list sellability-list">{products.map(product=><article className="plain-row" key={product.productId}><div><strong>{product.name}</strong><small>{product.available?'目前供應中':'目前暫停供應'}</small></div><button className={product.available?'secondary-button':'primary-button'} disabled={!canSetSellability} onClick={()=>onSellability(product.productId,!product.available)}>{product.available?'標記售罄':'恢復供應'}</button></article>)}</div>}
        {!canSetSellability?<p className="disabled-reason">目前未連接商品供應控制；操作不會改變門店資料。</p>:null}
      </section>
    </div>
  </section>;
}

type MoreTool='pending'|'printing'|'diagnostics'|'reporting'|'refunds';

export function MoreView({connection,snapshot,pendingIntents,onReadback,onDiscard}:{
  connection:SmmConnectionState;
  snapshot:SmmReadModelSnapshot|null;
  pendingIntents:readonly SmmPendingIntent[];
  onReadback:(intent:SmmPendingIntent)=>void;
  onDiscard:(submissionId:string)=>void;
}){
  const [tool,setTool]=useState<MoreTool|null>(null);
  const groups=[
    {title:'支援',detail:'處理本機草稿及查看診斷資料',items:[
      {tool:'pending' as const,title:'待提交草稿',detail:`${pendingIntents.length} 個本機草稿`,state:pendingIntents.length?'需要處理':'沒有草稿'},
      {tool:'diagnostics' as const,title:'診斷',detail:'連線、資料版本及本機草稿',state:connectionCopy(connection).label},
    ]},
    {title:'設備',detail:'查看只讀設備健康資料',items:[
      {tool:'printing' as const,title:'列印狀態',detail:'只讀列印設備健康',state:snapshot?.printHealth.length?`${snapshot.printHealth.length} 部設備`:'未連接'},
    ]},
    {title:'報表',detail:'查看門店提供的營運摘要',items:[
      {tool:'reporting' as const,title:'營運報表',detail:'訂單、營業額及平均單',state:snapshot?.reporting?reportFreshnessCopy(snapshot.reporting.freshness).label:'未連接'},
    ]},
    {title:'售後',detail:'查看退款及售後跟進',items:[
      {tool:'refunds' as const,title:'退款要求',detail:'只讀退款及售後資料',state:snapshot?.refundRequests.length?`${snapshot.refundRequests.length} 項`:'未連接'},
    ]},
  ];

  return <section className="page more-page">
    <PageHeading eyebrow="更多" title="店務工具" detail="低頻工具按工作目的分組；只顯示正式系統已提供的資料。"/>
    <div className="utility-groups">{groups.map(group=><section className="utility-group" key={group.title}>
      <SectionHeading title={group.title} detail={group.detail}/>
      <div>{group.items.map(item=><button className="utility-link" key={item.tool} onClick={()=>setTool(item.tool)}><span><strong>{item.title}</strong><small>{item.detail}</small></span><em>{item.state}</em><b aria-hidden="true">›</b></button>)}</div>
    </section>)}</div>
    <ModalSheet open={tool!==null} title={tool?moreTitle(tool):'店務工具'} description="只顯示已知資料；未連接功能會保持未連接。" onClose={()=>setTool(null)} size="narrow">
      {tool==='pending'?<PendingIntents intents={pendingIntents} onReadback={onReadback} onDiscard={onDiscard}/>:
       tool==='printing'?<PrintHealth connection={connection} rows={snapshot?.printHealth??[]}/>:
       tool==='reporting'?<Reporting projection={snapshot?.reporting}/>:
       tool==='refunds'?<RefundRequests connection={connection} rows={snapshot?.refundRequests??[]}/>:
       <Diagnostics connection={connection} snapshot={snapshot} pendingCount={pendingIntents.length}/>}
    </ModalSheet>
  </section>;
}

function PendingIntents({intents,onReadback,onDiscard}:{intents:readonly SmmPendingIntent[];onReadback:(intent:SmmPendingIntent)=>void;onDiscard:(submissionId:string)=>void}){
  const [discarding,setDiscarding]=useState<SmmPendingIntent|null>(null);
  if(!intents.length)return <EmptyState title="沒有待提交草稿" detail="目前沒有需要確認的本機草稿。"/>;
  return <div className="plain-list">{intents.map(intent=>{
    const label=intent.state==='UNKNOWN'?'正在確認訂單結果':intent.state==='PENDING'?'等待門店確認':intent.state==='NOT_CONNECTED'?'已保存本機草稿':'本機草稿';
    return <article className="pending-row" key={intent.submissionId}>
      <div><StatusTag tone={intent.state==='UNKNOWN'||intent.state==='PENDING'?'warning':'neutral'} label={label}/><strong>{intent.cart.length} 項商品</strong><small>{intent.lastMessage??'本機草稿，不代表正式訂單'}</small></div>
      <details className="technical-details"><summary>查看提交資料</summary><p>Submission ID：{intent.submissionId}</p><p>{formatObservedAt(intent.updatedAt)}</p></details>
      {discarding?.submissionId===intent.submissionId?<div className="inline-confirm"><strong>刪除這個本機草稿？</strong><p>此操作不會取消任何正式訂單。</p><div><button onClick={()=>setDiscarding(null)}>保留草稿</button><button className="danger-button" onClick={()=>{onDiscard(intent.submissionId);setDiscarding(null)}}>刪除草稿</button></div></div>:
        <div className="row-actions"><button className="secondary-button" onClick={()=>onReadback(intent)}>確認狀態</button><button className="text-danger" onClick={()=>setDiscarding(intent)}>刪除草稿</button></div>}
    </article>;
  })}</div>;
}

function PrintHealth({connection,rows}:{connection:SmmConnectionState;rows:NonNullable<SmmReadModelSnapshot['printHealth']>}){
  if(!rows.length)return <EmptyState title={connection==='NOT_CONNECTED'?'列印狀態尚未連接':'目前沒有列印設備資料'} detail="SMM 只顯示狀態；實體列印及重印權限不屬於此端口。"/>;
  return <div className="plain-list">{rows.map(row=>{const copy=printStateCopy(row.state);return <article className="plain-row" key={row.logicalPrinterId}><div><strong>{row.label}</strong><small>{row.detail} · {formatObservedAt(row.observedAt)}</small></div><StatusTag tone={copy.tone} label={copy.label}/></article>})}</div>;
}

function Reporting({projection}:{projection:SmmReadModelSnapshot['reporting']}){
  if(!projection)return <EmptyState title="營運報表尚未連接" detail="未連接時不會顯示假營業額、假訂單數或假平均單。"/>;
  const freshness=reportFreshnessCopy(projection.freshness);
  return <><div className="metric-grid"><Metric label="營業日" value={projection.businessDate}/><Metric label="訂單" value={String(projection.orderCount)}/><Metric label="營業額" value={projection.salesLabel}/><Metric label="平均單" value={projection.averageOrderLabel}/></div><StateMessage tone={freshness.tone} title={freshness.label} detail={formatObservedAt(projection.observedAt)}/></>;
}

function RefundRequests({connection,rows}:{connection:SmmConnectionState;rows:NonNullable<SmmReadModelSnapshot['refundRequests']>}){
  if(!rows.length)return <EmptyState title={connection==='NOT_CONNECTED'?'退款要求尚未連接':'目前沒有退款要求'} detail="SMM 只顯示退款及售後跟進資料，不持有退款或付款主權。"/>;
  return <div className="plain-list">{rows.map(row=>{const copy=refundStateCopy(row.state);return <article className="plain-row" key={row.refundId}><div><strong>{row.displayCode} · {row.source}</strong><small>{row.reason}{row.amountLabel?` · ${row.amountLabel}`:''} · {formatObservedAt(row.observedAt)}</small></div><StatusTag tone={copy.tone} label={copy.label}/></article>})}</div>;
}

function Diagnostics({connection,snapshot,pendingCount}:{connection:SmmConnectionState;snapshot:SmmReadModelSnapshot|null;pendingCount:number}){
  const state=connectionCopy(connection);
  return <div className="diagnostics"><Metric label="門店連線" value={state.label}/><Metric label="餐單版本" value={snapshot?.menu?.revision??'未有餐單'}/><Metric label="本機待提交" value={String(pendingCount)}/><p>本機項目只係本機草稿，不係正式訂單。</p><small>{formatObservedAt(snapshot?.observedAt)}</small></div>;
}

function Metric({label,value}:{label:string;value:string}){
  return <div className="metric"><small>{label}</small><strong>{value}</strong></div>;
}

function moreTitle(tool:MoreTool):string{
  if(tool==='pending')return '待提交草稿';
  if(tool==='printing')return '列印狀態';
  if(tool==='reporting')return '營運報表';
  if(tool==='refunds')return '退款要求';
  return '診斷';
}
