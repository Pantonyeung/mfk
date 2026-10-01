import {useMemo} from 'react';
import {useV3ReadModels} from './formal-read-model.tsx';
import {PageHeader,StatusBadge} from './ui.tsx';

function money(minor:number){return 'HK$'+(Number(minor||0)/100).toFixed(2);}
function text(value:unknown){return typeof value==='string'?value:'';}
function num(value:unknown){const n=Number(value);return Number.isFinite(n)?n:0;}
function record(value:unknown){return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}

export function FormalBusinessDayRuntimePage(){
  const read=useV3ReadModels();
  const latest=read.days[0];
  const opening=record(latest?.openingCash);
  const close=record(latest?.dayClose);
  const hasDay=Boolean(latest);
  const status=close&&Object.keys(close).length?'已日結':opening&&Object.keys(opening).length?'營業中':hasDay?'有 Projection':'結果未明';

  return <div className="v3-functional-page">
    <PageHeader eyebrow="營運管理" title="營業日" description="呢頁只讀 SMT / Cash Projection；開始營業、日結等 runtime mutation 唔會由 Admin 假做。" aside={<button type="button" disabled={read.reportsRefreshing} onClick={()=>void read.refresh()}>{read.reportsRefreshing?'更新中…':'重新讀取'}</button>}/>
    {read.reportsError?<div className="v3-error">{read.reportsError.message}</div>:null}
    <section className="v3-whole-kpi-grid">
      <article><span>目前營業日</span><strong>{latest?.date??'—'}</strong><small>{hasDay?'正式 Projection':'未有正式資料'}</small><StatusBadge tone={status==='營業中'?'good':status==='已日結'?'neutral':'unknown'}>{status}</StatusBadge></article>
      <article><span>開更現金</span><strong>{Object.keys(opening).length?money(num(opening.amountMinor)):'—'}</strong><small>{text(opening.staffName)||text(opening.staffId)||'未回傳'}</small></article>
      <article><span>日結</span><strong>{Object.keys(close).length?'已記錄':'未記錄'}</strong><small>{text(close.staffName)||text(close.staffId)||'—'}</small></article>
      <article><span>營業日訂單</span><strong>{latest?.orders??'—'}</strong><small>SMT projected orders</small></article>
    </section>
    <section className="v3-functional-section">
      <header><div><h3>Authority</h3><p>Admin 只睇 Projection；營業日 runtime 狀態由 SMT / Cash authority 決定。</p></div><StatusBadge tone="good">READ-ONLY</StatusBadge></header>
      <div className="v3-mobile-form-note">如果要「開更／收舖」正式操作，必須另接 verified runtime command + readback seam，唔會用 Draft 代替。</div>
    </section>
  </div>;
}

export function FormalCashCloseRuntimePage(){
  const read=useV3ReadModels();
  const latest=read.days[0];
  const opening=record(latest?.openingCash);
  const close=record(latest?.dayClose);
  const counted=num(close.countedCashMinor);
  const removed=num(close.cashRemovedMinor);
  const retained=num(close.retainedCashMinor);
  const expected=num(close.expectedCashMinor);
  const variance=Object.keys(close).length?counted-expected:null;

  return <div className="v3-functional-page">
    <PageHeader eyebrow="營運管理" title="現金／收舖" description="只讀正式開更／日結 Projection；Admin 唔成為 Cash authority。" aside={<button type="button" disabled={read.reportsRefreshing} onClick={()=>void read.refresh()}>重新讀取</button>}/>
    {read.reportsError?<div className="v3-error">{read.reportsError.message}</div>:null}
    {!latest?<section className="v3-product-empty"><h2>目前未有正式營業日 Projection</h2><p>未同步之前唔會顯示假現金結果。</p></section>:<>
      <section className="v3-whole-kpi-grid">
        <article><span>開更現金</span><strong>{Object.keys(opening).length?money(num(opening.amountMinor)):'—'}</strong><small>{latest.date}</small></article>
        <article><span>系統預計現金</span><strong>{Object.keys(close).length?money(expected):'—'}</strong><small>Day Close evidence</small></article>
        <article><span>實點現金</span><strong>{Object.keys(close).length?money(counted):'—'}</strong><small>{variance===null?'未日結':variance===0?'一致':'差額 '+money(variance)}</small></article>
        <article><span>留櫃／取走</span><strong>{Object.keys(close).length?money(retained)+' / '+money(removed):'—'}</strong><small>retained / removed</small></article>
      </section>
      <section className="v3-functional-section">
        <h3>日結 Evidence</h3>
        {Object.keys(close).length?<div className="v3-formal-draft-meta">
          {Object.entries(close).slice(0,12).map(([key,value])=><div key={key}><span>{key}</span><strong>{typeof value==='object'?JSON.stringify(value):String(value??'—')}</strong></div>)}
        </div>:<div className="v3-product-empty"><h2>目前未有日結記錄</h2></div>}
      </section>
    </>}
  </div>;
}
