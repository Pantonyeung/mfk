import {useMemo,useState} from 'react';
import type {SmmConnectionState,SmmOrderProjection} from './product-types';
import {
  smmStage7AmountLabel,
  smmStage7ConnectionState,
  smmStage7InSegment,
  smmStage7ItemCount,
  smmStage7MatchesDate,
  smmStage7MatchesSearch,
  smmStage7MatchesSource,
  smmStage7OrderTime,
  smmStage7Phone,
  smmStage7SourceGroup,
  smmStage7StatusLabel,
  type SmmStage7DateFilter,
  type SmmStage7SearchScope,
  type SmmStage7Segment,
  type SmmStage7SourceFilter,
} from './stage7-orders.mjs';

type Stage7Surface='LIST'|'SEARCH'|'DETAIL'|'STATUS';

const SOURCE_FILTERS:readonly [SmmStage7SourceFilter,string][]=[
  ['ALL','全部'],
  ['ONSITE','現場'],
  ['SMM','SMM'],
  ['OWN_PLATFORM','自家平台'],
  ['THIRD_PARTY','第三方'],
];

const SEARCH_SCOPES:readonly [SmmStage7SearchScope,string][]=[
  ['ALL','全部'],
  ['DISPLAY','訂單編號'],
  ['PRODUCT','商品名稱'],
  ['PHONE','電話'],
];

const STATUS_OPTIONS=['待確認','製作中','準備完成 / 可取餐','已取餐','已取消'] as const;

function dateTimeLabel(value:string){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '未有資料';
  return date.toLocaleString('zh-HK',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
}

function timeLabel(value:string){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '未有資料';
  return date.toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false});
}

function statusTone(label:string){
  if(label==='已取餐')return 'success';
  if(label==='已取消')return 'cancelled';
  if(label.includes('可取餐')||label.includes('完成'))return 'ready';
  if(label==='製作中')return 'working';
  if(label==='待確認')return 'pending';
  if(label==='狀態未明'||label==='部分資料')return 'unknown';
  return 'neutral';
}

function sourceLabel(row:SmmOrderProjection){
  const raw=String(row.source||'').trim();
  return raw||'未有資料';
}

function sourceFilterCount(rows:readonly SmmOrderProjection[],filter:SmmStage7SourceFilter){
  return rows.filter(row=>smmStage7MatchesSource(row,filter)).length;
}

function Stage7StateBanner({connection,hasRows}:{connection:SmmConnectionState;hasRows:boolean}){
  const state=smmStage7ConnectionState(connection,hasRows);
  if(!state)return null;
  const icon=state.kind==='LOADING'?'◌':state.kind==='OFFLINE'?'⌁':state.kind==='STALE'?'◷':state.kind==='PARTIAL'?'◫':state.kind==='UNKNOWN'?'?':'!';
  return <section className={`stage7-state stage7-state-${state.kind.toLowerCase()}`} data-stage7-shared-state={state.kind} role="status">
    <span aria-hidden="true">{icon}</span>
    <div><strong>{state.title}</strong><small>{state.detail}</small></div>
  </section>;
}

function Stage7Empty({segment}:{segment:SmmStage7Segment}){
  return <section className="stage7-empty" data-stage7-empty="true">
    <span className="stage7-empty-icon" aria-hidden="true">▣</span>
    <h2>{segment==='ACTIVE'?'暫時沒有進行中訂單':'暫時沒有歷史訂單'}</h2>
    <p>{segment==='ACTIVE'?'正式訂單出現後會按目前 canonical 狀態顯示。':'完成或取消訂單會保留做只讀歷史記錄。'}</p>
  </section>;
}

function Stage7Card({row,onOpen}:{row:SmmOrderProjection;onOpen:()=>void}){
  const count=smmStage7ItemCount(row);
  const status=smmStage7StatusLabel(row);
  const source=sourceLabel(row);
  const time=smmStage7OrderTime(row);
  return <button type="button" className="stage7-card" onClick={onOpen}>
    <span className={`stage7-source-icon stage7-source-${smmStage7SourceGroup(row).toLowerCase()}`}>{source.slice(0,4)}</span>
    <span className="stage7-card-main">
      <span><strong>{row.displayCode||'未有資料'}</strong><small>{source}</small></span>
      <small>{timeLabel(time)} · {count===null?'項目數未有資料':`${count} 項`} · {smmStage7AmountLabel(row)}</small>
      <small>{row.itemSummary||'商品資料未有資料'}</small>
    </span>
    <span className={`stage7-status stage7-status-${statusTone(status)}`}>{status}</span>
    <span className="stage7-chevron" aria-hidden="true">›</span>
  </button>;
}

function Stage7Search({
  rows,
  query,
  setQuery,
  scope,
  setScope,
  onBack,
  onOpen,
}:{
  rows:readonly SmmOrderProjection[];
  query:string;
  setQuery:(value:string)=>void;
  scope:SmmStage7SearchScope;
  setScope:(value:SmmStage7SearchScope)=>void;
  onBack:()=>void;
  onOpen:(row:SmmOrderProjection)=>void;
}){
  const phoneAvailable=rows.some(row=>Boolean(smmStage7Phone(row)));
  const results=useMemo(()=>rows.filter(row=>smmStage7MatchesSearch(row,query,scope)),[rows,query,scope]);
  return <section className="stage7-search-screen" data-stage7-visual="7.3_SEARCH">
    <header className="stage7-subheader">
      <button type="button" onClick={onBack} aria-label="返回訂單列表">‹</button>
      <strong>搜尋訂單</strong>
      <span/>
    </header>
    <label className="stage7-search-box">
      <span aria-hidden="true">⌕</span>
      <input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="訂單編號 / 商品 / 電話"/>
      {query?<button type="button" onClick={()=>setQuery('')} aria-label="清除搜尋">×</button>:null}
    </label>
    <div className="stage7-search-scopes">
      {SEARCH_SCOPES.map(([value,label])=><button
        type="button"
        key={value}
        className={scope===value?'active':''}
        disabled={value==='PHONE'&&!phoneAvailable}
        aria-pressed={scope===value}
        onClick={()=>setScope(value)}
      >{label}{value==='PHONE'&&!phoneAvailable?<small>未有資料</small>:null}</button>)}
    </div>
    {!query.trim()?<section className="stage7-search-hint"><strong>輸入搜尋內容</strong><span>只會比對 Display Number、canonical 商品名稱，以及已獲允許嘅 canonical 電話。</span></section>:
      results.length?<div className="stage7-list">{results.map(row=><Stage7Card key={row.orderId} row={row} onOpen={()=>onOpen(row)}/>)}</div>:
      <section className="stage7-search-hint"><strong>找不到訂單</strong><span>系統唔會用內部 Order ID 或不存在嘅電話做搜尋結果。</span></section>}
  </section>;
}

function DetailField({label,value}:{label:string;value:string|undefined|null}){
  const text=String(value??'').trim();
  return <div className="stage7-field"><span>{label}</span><strong>{text||'未有資料'}</strong></div>;
}

function Stage7Detail({
  row,
  surface,
  refreshing,
  onBack,
  onStatus,
  onRefresh,
}:{
  row:SmmOrderProjection;
  surface:'DETAIL'|'STATUS';
  refreshing:boolean;
  onBack:()=>void;
  onStatus:()=>void;
  onRefresh:()=>void;
}){
  const count=smmStage7ItemCount(row);
  const status=smmStage7StatusLabel(row);
  const phone=smmStage7Phone(row);
  const structured=row.items??[];

  if(surface==='STATUS'){
    return <section className="stage7-status-screen" data-stage7-visual="7.5_STATUS">
      <header className="stage7-subheader">
        <button type="button" onClick={onBack} aria-label="返回訂單詳情">‹</button>
        <strong>更新訂單狀態</strong>
        <span/>
      </header>
      <section className="stage7-status-order">
        <div><strong>{row.displayCode||'未有資料'}</strong><span>{sourceLabel(row)}</span></div>
        <small>{count===null?'項目數未有資料':`${count} 項`} · {smmStage7AmountLabel(row)}</small>
      </section>
      <section className="stage7-status-options">
        {STATUS_OPTIONS.map(option=><label key={option} className={status===option?'current':''}>
          <input type="radio" disabled checked={status===option} readOnly/>
          <span><strong>{option}</strong><small>{status===option?'目前 canonical 狀態':'此操作需由 SMT 處理'}</small></span>
        </label>)}
      </section>
      <label className="stage7-disabled-note">
        <span>備註（選填）</span>
        <textarea disabled placeholder="此操作需由 SMT 處理"/>
      </label>
      <p className="stage7-authority-note">FULFILLMENT_COMMAND / CANCEL_COMMAND 目前未連接。此畫面只可重新讀取 SMT 已處理後嘅 canonical 狀態。</p>
      <footer className="stage7-status-footer">
        <button type="button" onClick={onBack}>取消</button>
        <button type="button" className="primary" disabled>確認更新</button>
        <small>此操作需由 SMT 處理</small>
        <button type="button" className="stage7-readback" disabled={refreshing} onClick={onRefresh}>{refreshing?'重新讀取中…':'重新讀取 SMT 狀態'}</button>
      </footer>
    </section>;
  }

  return <section className="stage7-detail" data-stage7-visual="7.4_DETAIL">
    <header className="stage7-subheader">
      <button type="button" onClick={onBack} aria-label="返回訂單列表">‹</button>
      <strong>訂單詳情</strong>
      <span>•••</span>
    </header>

    <section className="stage7-detail-hero">
      <div><strong>{row.displayCode||'未有資料'}</strong><span>{sourceLabel(row)}</span></div>
      <span className={`stage7-status stage7-status-${statusTone(status)}`}>{status}</span>
      <small>下單時間　{dateTimeLabel(smmStage7OrderTime(row))}</small>
      {row.eta?<small>預計取餐　{row.eta}</small>:<small>預計取餐　未有資料</small>}
    </section>

    <section className="stage7-detail-section">
      <h3>顧客資料</h3>
      <DetailField label="姓名" value={row.customerName}/>
      <DetailField label="電話" value={phone}/>
    </section>

    <section className="stage7-detail-section">
      <h3>訂單內容{count===null?'':`（${count} 項）`}</h3>
      {structured.length?<div className="stage7-items">{structured.map((item,index)=><article key={index}>
        <b>{item.quantity}</b>
        <div><strong>{item.name||'未有資料'}</strong><small>{item.detail||item.remark||'未有資料'}</small></div>
        <span>{item.amountLabel||'未有資料'}</span>
      </article>)}</div>:
      <p className="stage7-summary">{row.itemSummary||'未有資料'}</p>}
    </section>

    <section className="stage7-detail-section stage7-money">
      <h3>金額 / 付款</h3>
      <DetailField label="有效總額" value={smmStage7AmountLabel(row)}/>
      <DetailField label="付款方式" value={row.tenderLabel}/>
    </section>

    <section className="stage7-detail-section">
      <h3>來源 / Fulfillment</h3>
      <DetailField label="來源" value={sourceLabel(row)}/>
      <DetailField label="外部參考" value={row.externalRef}/>
      <DetailField label="目前狀態" value={status}/>
    </section>

    <section className="stage7-detail-section">
      <h3>Timeline</h3>
      {row.timeline.length?<div className="stage7-timeline">{row.timeline.map((item,index)=><article key={index}>
        <span/>
        <div><strong>{item.label||'未有資料'}</strong><small>{item.detail||'未有資料'}</small></div>
        <time>{dateTimeLabel(item.at)}</time>
      </article>)}</div>:<p className="stage7-summary">未有資料</p>}
    </section>

    {row.note?<section className="stage7-note"><strong>訂單備註</strong><span>{row.note}</span></section>:null}

    <footer className="stage7-detail-footer">
      <button type="button" onClick={onStatus}>更新狀態</button>
      <button type="button" className="primary" disabled={refreshing} onClick={onRefresh}>{refreshing?'重新讀取中…':'重新整理'}</button>
      <small>更新狀態只提供 read-only 畫面；真正 mutation 需由 SMT 處理。</small>
    </footer>
  </section>;
}

export function Stage7OrdersView({
  connection,
  rows,
  onRefresh,
}:{
  connection:SmmConnectionState;
  rows:readonly SmmOrderProjection[];
  onRefresh:()=>Promise<void>|void;
}){
  const [segment,setSegment]=useState<SmmStage7Segment>('ACTIVE');
  const [sourceFilter,setSourceFilter]=useState<SmmStage7SourceFilter>('ALL');
  const [dateFilter,setDateFilter]=useState<SmmStage7DateFilter>('ALL');
  const [customDate,setCustomDate]=useState('');
  const [query,setQuery]=useState('');
  const [searchScope,setSearchScope]=useState<SmmStage7SearchScope>('ALL');
  const [surface,setSurface]=useState<Stage7Surface>('LIST');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [refreshing,setRefreshing]=useState(false);

  const segmentRows=useMemo(()=>rows.filter(row=>smmStage7InSegment(row,segment)),[rows,segment]);
  const filteredRows=useMemo(()=>segmentRows.filter(row=>
    smmStage7MatchesSource(row,sourceFilter)&&
    (segment!=='HISTORY'||smmStage7MatchesDate(row,dateFilter,customDate))
  ),[segmentRows,sourceFilter,segment,dateFilter,customDate]);
  const selected=selectedId?rows.find(row=>row.orderId===selectedId):undefined;

  const refresh=async()=>{
    if(refreshing)return;
    setRefreshing(true);
    try{await Promise.resolve(onRefresh())}
    finally{setRefreshing(false)}
  };

  const openDetail=(row:SmmOrderProjection)=>{setSelectedId(row.orderId);setSurface('DETAIL')};
  const backToList=()=>{setSelectedId(null);setSurface('LIST')};

  if(selected&&surface==='DETAIL'){
    return <Stage7Detail row={selected} surface="DETAIL" refreshing={refreshing} onBack={backToList} onStatus={()=>setSurface('STATUS')} onRefresh={()=>void refresh()}/>;
  }
  if(selected&&surface==='STATUS'){
    return <Stage7Detail row={selected} surface="STATUS" refreshing={refreshing} onBack={()=>setSurface('DETAIL')} onStatus={()=>{}} onRefresh={()=>void refresh()}/>;
  }
  if(surface==='SEARCH'){
    return <Stage7Search
      rows={filteredRows}
      query={query}
      setQuery={setQuery}
      scope={searchScope}
      setScope={setSearchScope}
      onBack={()=>setSurface('LIST')}
      onOpen={openDetail}
    />;
  }

  return <section className="stage7-page" data-stage7-visual={segment==='ACTIVE'?'7.1_ACTIVE':'7.2_HISTORY'}>
    <header className="stage7-header">
      <h1>訂單</h1>
      <button type="button" onClick={()=>setSurface('SEARCH')} aria-label="搜尋訂單">⌕</button>
    </header>

    <Stage7StateBanner connection={connection} hasRows={rows.length>0}/>

    <div className="stage7-segments" aria-label="訂單範圍">
      <button type="button" className={segment==='ACTIVE'?'active':''} aria-pressed={segment==='ACTIVE'} onClick={()=>{setSegment('ACTIVE');setDateFilter('ALL')}}>進行中</button>
      <button type="button" className={segment==='HISTORY'?'active':''} aria-pressed={segment==='HISTORY'} onClick={()=>setSegment('HISTORY')}>歷史</button>
    </div>

    {segment==='HISTORY'?<div className="stage7-date-filter" aria-label="歷史日期">
      {([
        ['ALL','全部'],['TODAY','今天'],['YESTERDAY','昨天'],['CUSTOM','自訂日期'],
      ] as const).map(([value,label])=><button type="button" key={value} className={dateFilter===value?'active':''} onClick={()=>setDateFilter(value)}>{label}</button>)}
      {dateFilter==='CUSTOM'?<input type="date" value={customDate} onChange={event=>setCustomDate(event.target.value)} aria-label="選擇歷史日期"/>:null}
    </div>:null}

    <div className="stage7-source-filters" aria-label="訂單來源">
      {SOURCE_FILTERS.map(([value,label])=><button type="button" key={value} className={sourceFilter===value?'active':''} aria-pressed={sourceFilter===value} onClick={()=>setSourceFilter(value)}>
        <span>{label}</span><b>{sourceFilterCount(segmentRows,value)}</b>
      </button>)}
    </div>

    <button type="button" className="stage7-search-entry" onClick={()=>setSurface('SEARCH')}>
      <span aria-hidden="true">⌕</span><span>{query||'搜尋 Display Number / 商品 / 電話'}</span>
    </button>

    {connection==='READY'&&filteredRows.length===0?<Stage7Empty segment={segment}/>:null}

    {filteredRows.length?<div className="stage7-list">{filteredRows.map(row=><Stage7Card key={row.orderId} row={row} onOpen={()=>openDetail(row)}/>)}</div>:null}

    <button type="button" className="stage7-refresh-button" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?'重新整理中…':'重新整理訂單'}</button>
  </section>;
}
