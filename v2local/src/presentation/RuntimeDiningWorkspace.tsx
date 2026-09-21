import {useCallback,useEffect,useMemo,useState} from 'react';
import type {CleanSmtCoreRuntimePort,SmtDiningProjection} from '../runtime/local-runtime.ts';
import './dining-operations-workspace.css';

export function RuntimeDiningWorkspace({runtime}:{runtime:CleanSmtCoreRuntimePort}){
  const [view,setView]=useState<SmtDiningProjection|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!runtime.readDining){setError('DINE_IN_PROVIDER_UNAVAILABLE');return;}
    setBusy(true);setError(null);
    try{setView(await runtime.readDining());}
    catch{setError('DINE_IN_READ_FAILED');}
    finally{setBusy(false);}
  },[runtime]);

  useEffect(()=>{void load();},[load]);

  const groups=useMemo(()=>{
    const result=new Map<string,NonNullable<SmtDiningProjection['tables']>[number][]>();
    for(const table of view?.tables??[]){const list=result.get(table.areaLabel)??[];list.push(table);result.set(table.areaLabel,list);}
    return [...result.entries()];
  },[view]);

  return <main className="dining-operations-workspace runtime-dining-workspace" aria-label="堂食／掛單工作台" data-smt-core-runtime="bound">
    <aside className="hold-only-column">
      <header><div><small>QUEUE · V2</small><h2>輪候／叫號</h2></div><span>{view?.queue.length??0}</span></header>
      <div className="hold-only-list">{view?.queue.map(row=><article key={row.id}><strong>{row.codeLabel}</strong><span>{row.partySize} 位</span><small>{row.statusLabel}</small></article>)}</div>
      {!runtime.readDining?<p className="dining-boundary" role="alert">Dining UI真身已接入；Table/Dine-In canonical provider未 admission，唔使用舊 runtime建立枱/session truth。</p>:null}
    </aside>

    <section className="dining-floor-board">
      <header><div><small>堂食營運 · {view?.businessDate??'—'}</small><h1>堂食／掛單工作台</h1></div><span>{view?'已同步':'讀取中'}</span></header>
      {error?<p className="dining-notice" role="alert">{error}</p>:null}
      {busy&&!view?<p>讀取堂食資料中…</p>:null}
      {groups.map(([area,tables])=><section className="dining-area-group" key={area}><header><b>{area}</b><span>{tables.length}</span></header><div className="dining-slot-grid">{tables.map(table=><article key={table.id} className={`dining-slot ${table.state==='available'?'empty':table.state==='attention'?'overtime':'occupied'}`}><strong>{table.label}</strong><span>{table.state==='available'?'空位':table.partySize?`${table.partySize} 位`:'使用中'}</span><em>{table.outstandingLabel??''}</em></article>)}</div></section>)}
      {!view&&!error?<p className="dining-boundary">等待 Dining projection。</p>:null}
    </section>

    <aside className="selected-order-inspector">
      {!view?.selectedSession?<div className="dining-boundary"><b>未有已選 session</b><p>枱面資料可以正常查看；揀枱同修改堂食資料嘅正式操作功能尚未接通。</p></div>:<><header><div><small>SESSION</small><h2>{view.selectedSession.tableLabels.join('＋')}</h2></div><span>{view.selectedSession.statusLabel}</span></header><section className="inspector-money">{view.selectedSession.metrics.map(metric=><p key={metric.id}><span>{metric.label}</span><b>{metric.value}</b></p>)}</section><div className="inspector-context-actions"><span role="status">堂食操作功能尚未接通</span></div></>}
    </aside>
  </main>;
}
