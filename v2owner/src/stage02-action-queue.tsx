import {useMemo,useState} from 'react';
import type {
  OwnerActionItem,
  OwnerActivityRecord,
  OwnerConnectionState,
} from './product-types';
import {
  buildOwnerActionDetailViewModel,
  buildOwnerActionQueueViewModel,
  type OwnerActionQueueRowViewModel,
} from './stage02-view-model';

type SeverityFilter='ALL'|'URGENT'|'ATTENTION'|'INFO';

export interface OwnerActionCommandFlight {
  readonly actionId:string;
  readonly state:'PENDING'|'UNKNOWN'|'FAILED'|'REJECTED';
  readonly message:string;
}

export function ActionQueuePage({
  connection,
  items,
  activity,
  commandFlight,
  onCommand,
  onRecheck,
}:{
  connection:OwnerConnectionState;
  items:readonly OwnerActionItem[];
  activity:readonly OwnerActivityRecord[];
  commandFlight:OwnerActionCommandFlight|null;
  onCommand:(label:string,target:string,impact:string,actionId?:string)=>void;
  onRecheck:(actionId:string)=>void;
}){
  const [filter,setFilter]=useState<SeverityFilter>('ALL');
  const [selectedActionId,setSelectedActionId]=useState<string|null>(null);
  const snapshot=useMemo(()=>({
    actions:items,
    activity,
  }),[items,activity]);
  const vm=useMemo(()=>buildOwnerActionQueueViewModel({
    ...emptySnapshot,
    actions:snapshot.actions,
    activity:snapshot.activity,
  }),[snapshot]);
  const rows=filter==='ALL'?vm.rows:vm.rows.filter(row=>row.action.severity===filter);
  const selected=useMemo(
    ()=>selectedActionId?vm.rows.find(row=>row.action.actionId===selectedActionId)??null:null,
    [selectedActionId,vm.rows],
  );

  return <section className="page action-queue-page">
    <header className="page-head action-queue-head">
      <div>
        <span>待處理</span>
        <h1>真正要你介入嘅事</h1>
        <small>集中顯示真正需要你留意同處理嘅營運事項。</small>
      </div>
      <b className="hero-number">{vm.openCount}</b>
    </header>

    <section className="action-summary-strip" aria-label="待處理摘要">
      <div><strong>{vm.urgentCount}</strong><span>緊急</span></div>
      <div><strong>{vm.attentionCount}</strong><span>注意</span></div>
      <div><strong>{vm.infoCount}</strong><span>資訊</span></div>
    </section>

    <div className="action-filter-row" role="group" aria-label="嚴重程度篩選">
      {(['ALL','URGENT','ATTENTION','INFO'] as const).map(value=><button
        key={value}
        className={filter===value?'active':''}
        onClick={()=>setFilter(value)}
      >{value==='ALL'?'全部':value==='URGENT'?'緊急':value==='ATTENTION'?'注意':'資訊'}</button>)}
    </div>

    {!rows.length?<ActionQueueEmpty connection={connection}/>:<div className="cards">
      {rows.map(row=><ActionQueueCard key={row.action.actionId} row={row} onOpen={()=>setSelectedActionId(row.action.actionId)}/>)}
    </div>}

    {selected?<ActionDetailDrawer
      row={selected}
      activity={activity}
      commandFlight={commandFlight}
      onCommand={onCommand}
      onRecheck={onRecheck}
      onClose={()=>setSelectedActionId(null)}
    />:null}
  </section>;
}

function ActionQueueCard({row,onOpen}:{row:OwnerActionQueueRowViewModel;onOpen:()=>void}){
  const item=row.action;
  return <button className={'action-queue-card severity-'+item.severity.toLowerCase()} onClick={onOpen}>
    <div className="action-queue-card-top">
      <div className="action-labels">
        <span className={'severity-pill '+item.severity.toLowerCase()}>{item.severity==='URGENT'?'緊急':item.severity==='ATTENTION'?'注意':'資訊'}</span>
        <span className={'queue-state '+row.state.toLowerCase()}>{row.state==='PENDING_READBACK'?'處理中':row.state==='UNKNOWN'?'待確認':'待處理'}</span>
      </div>
      <small>{row.elapsedLabel}</small>
    </div>
    <h2>{item.title}</h2>
    <p>{item.detail}</p>
    <div className="action-facts-grid">
      <div><span>影響目標</span><strong>{item.target}</strong></div>
      <div><span>已持續</span><strong>{row.elapsedLabel}</strong></div>
      <div><span>目前狀態</span><strong>{certaintyLabel(item.certainty)}</strong></div>
      <div><span>安全下一步</span><strong>{row.safeNextStepLabel??'只讀檢視'}</strong></div>
    </div>
    <div className="action-card-footer"><span>查看詳情</span><small>處理紀錄會保留</small></div>
  </button>;
}

function ActionDetailDrawer({
  row,
  activity,
  commandFlight,
  onCommand,
  onRecheck,
  onClose,
}:{
  row:OwnerActionQueueRowViewModel;
  activity:readonly OwnerActivityRecord[];
  commandFlight:OwnerActionCommandFlight|null;
  onCommand:(label:string,target:string,impact:string,actionId?:string)=>void;
  onRecheck:(actionId:string)=>void;
  onClose:()=>void;
}){
  const detail=buildOwnerActionDetailViewModel(row,activity);
  const item=row.action;
  const flight=commandFlight?.actionId===item.actionId?commandFlight:null;
  const canonicalUnknown=row.state==='UNKNOWN';
  const commandLocked=canonicalUnknown||flight?.state==='PENDING'||flight?.state==='UNKNOWN';
  return <div className="overlay">
    <section className="drawer action-detail-drawer" role="dialog" aria-modal="true" aria-label="Action Detail">
      <header className="drawer-head">
        <div><small>待處理詳情</small><h2>{item.title}</h2></div>
        <button onClick={onClose}>✕</button>
      </header>

      <section className="action-detail-status">
        <span className={'severity-pill '+item.severity.toLowerCase()}>{item.severity==='URGENT'?'緊急':item.severity==='ATTENTION'?'注意':'資訊'}</span>
        <span className={'queue-state '+row.state.toLowerCase()}>{row.state==='PENDING_READBACK'?'處理中':row.state==='UNKNOWN'?'待確認':'待處理'}</span>
        <span className={'certainty '+item.certainty.toLowerCase()}>{certaintyLabel(item.certainty)}</span>
      </section>

      <section className="detail-section">
        <h3>問題</h3>
        <p>{item.detail}</p>
      </section>
      <section className="detail-section">
        <h3>影響</h3>
        <div className="action-detail-grid">
          <div><span>目標</span><strong>{item.target}</strong></div>
          <div><span>已持續</span><strong>{row.elapsedLabel}</strong></div>
          <div><span>處理建議</span><strong>{row.safeNextStepLabel??'查看詳情'}</strong></div>
          <div><span>目前確定性</span><strong>{certaintyLabel(item.certainty)}</strong></div>
        </div>
      </section>

      <section className="detail-section">
        <h3>安全處理</h3>
        {item.actionLabel?<button className="primary wide action-primary" disabled={commandLocked} onClick={()=>{
          onCommand(item.actionLabel!,item.target,'提交後會再次確認最新狀態；未確認完成前不會重複操作。',item.actionId);
        }}>{canonicalUnknown?'結果待確認':flight?.state==='PENDING'?'正在處理':flight?.state==='UNKNOWN'?'結果待確認':row.safeNextStepLabel??item.actionLabel}</button>:<p className="muted-copy">目前只供查看，未有可直接處理嘅操作。</p>}
        {canonicalUnknown||flight?<div className={'command-flight '+(flight?.state??'UNKNOWN').toLowerCase()} role="status">
          <strong>{flight?.state==='PENDING'?'正在確認最新狀態':canonicalUnknown||flight?.state==='UNKNOWN'?'結果待確認':flight?.state==='REJECTED'?'未獲接受':'操作未完成'}</strong>
          <span>{flight?.message??'最新狀態仍未能確認；請先重新檢查，暫時唔好再次提交。'}</span>
          {(canonicalUnknown||flight?.state==='UNKNOWN')&&flight?.state!=='PENDING'?<button className="secondary-action" onClick={()=>onRecheck(item.actionId)}>重新確認狀態</button>:null}
        </div>:null}
        <p className="queue-rule-copy">處理後會再次核對最新結果；未確認完成嘅事項會繼續留喺待處理清單。</p>
      </section>

      <section className="detail-section">
        <h3>處理結果</h3>
        <div className="action-detail-grid">
          <div><span>最新狀態</span><strong>{item.readbackSummary??certaintyLabel(item.certainty)}</strong></div>
          <div><span>完成確認</span><strong>{item.resolutionProofLabel??'尚未完成確認'}</strong></div>
        </div>
      </section>

      <section className="detail-section">
        <h3>相關處理紀錄</h3>
        {detail.history.length?<div className="queue-history">{detail.history.slice(0,8).map(record=><article key={record.activityId}>
          <div><strong>{record.title}</strong><span>{record.actor}</span></div>
          <small>{new Date(record.observedAt).toLocaleString('zh-HK')} · {record.result}</small>
        </article>)}</div>:<p className="muted-copy">未有已連結嘅處理紀錄。</p>}
      </section>

      <div className="boundary-box">相同問題會合併顯示，避免重複提醒；已處理紀錄仍會保留。</div>
    </section>
  </div>;
}

function ActionQueueEmpty({connection}:{connection:OwnerConnectionState}){
  const title=connection==='OFFLINE_READONLY'?'離線唯讀：暫時未能取得新事項':'暫時冇待處理事項';
  return <section className="card empty-state action-empty" data-visual-asset="AI_ASSET_PENDING">
    <h2>{title}</h2>
    <p>真正需要人介入嘅營運事項先會出現喺呢度。</p>
  </section>;
}

function certaintyLabel(value:OwnerActionItem['certainty']){
  return value==='CONFIRMED'?'已確認':value==='PARTIAL'?'部分確認':'未明';
}

const emptySnapshot={
  readiness:[],
  actions:[],
  orders:[],
  channels:[],
  sellability:[],
  staff:[],
  devices:[],
  reports:[],
  campaigns:[],
  settlements:[],
  inventory:[],
  notifications:[],
  activity:[],
  observedAt:'',
} as const;
