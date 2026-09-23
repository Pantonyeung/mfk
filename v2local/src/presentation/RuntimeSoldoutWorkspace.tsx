import {useCallback,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import type {CleanSmtCoreRuntimePort,SmtAvailabilityProjection,SmtAvailabilityStatus} from '../runtime/local-runtime.ts';
import {ActionFeedback,DisabledReason,EmptyState,StatusTag} from './SmtUi.tsx';
import './state-pages.css';
import './soldout-guided.css';

const statusLabel:Record<SmtAvailabilityStatus,string>={available:'供應中',soldout:'售罄',paused:'暫停供應'};
type Filter='all'|SmtAvailabilityStatus;

export function RuntimeSoldoutWorkspace({runtime,embedded=false}:{runtime:CleanSmtCoreRuntimePort;embedded?:boolean}){
  const navigate=useNavigate();
  const [view,setView]=useState<SmtAvailabilityProjection|null>(null);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [feedback,setFeedback]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!runtime.readAvailability){setError('目前未能讀取商品供應狀態。');return;}
    setBusy(true);setError(null);
    try{setView(await runtime.readAvailability());}
    catch{setError('商品供應狀態載入失敗，請稍後再試。');}
    finally{setBusy(false);}
  },[runtime]);

  useEffect(()=>{void load();return runtime.subscribe(()=>void load());},[load,runtime]);

  const visible=useMemo(()=>view?.nodes.filter(node=>(filter==='all'||node.status===filter)&&(!query||`${node.nodeId} ${node.label}`.toLowerCase().includes(query.toLowerCase())))??[],[view,query,filter]);
  const selected=view?.nodes.find(node=>node.nodeId===selectedId)??null;
  const counts=useMemo(()=>(
    {total:view?.nodes.length??0,soldout:view?.nodes.filter(node=>node.status==='soldout').length??0,paused:view?.nodes.filter(node=>node.status==='paused').length??0}
  ),[view]);

  const mutate=async(status:SmtAvailabilityStatus)=>{
    if(!view||!selected||!view.canChange||!runtime.setAvailability)return;
    setBusy(true);setError(null);setFeedback(null);
    try{
      setView(await runtime.setAvailability(selected.nodeId,status,view.revision));
      setFeedback(`「${selected.label}」已改為${statusLabel[status]}`);
    }catch{setError('商品供應狀態未能更新，請重新整理後再試。');}
    finally{setBusy(false);}
  };

  return <main className="soldout-operations-page runtime-soldout-page soldout-guided" aria-label="商品供應管理" data-smt-core-runtime="bound">
    <header><div><span>營運 · 商品供應</span><h1>先揀商品，再更新狀態</h1><p>一次只處理一件商品，完成後會即時顯示結果。</p></div><div>{!embedded?<button type="button" onClick={()=>navigate('/operations')}>返回營運</button>:null}<button type="button" disabled={busy} onClick={()=>void load()}>{busy?'更新中…':'重新整理'}</button></div></header>
    {feedback?<ActionFeedback tone="success" title={feedback} detail="狀態已按目前系統回傳更新。" onDismiss={()=>setFeedback(null)}/>:null}
    {error?<ActionFeedback tone="danger" title="未能完成商品供應操作" detail={error} actionLabel="重新整理" onAction={()=>void load()}/>:null}
    <section className="soldout-toolbar" aria-label="搜尋及篩選商品">
      <input type="search" aria-label="搜尋商品" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品名稱"/>
      <button type="button" aria-pressed={filter==='all'} className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>全部 {counts.total}</button>
      <button type="button" aria-pressed={filter==='soldout'} className={filter==='soldout'?'active':''} onClick={()=>setFilter('soldout')}>售罄 {counts.soldout}</button>
      <button type="button" aria-pressed={filter==='paused'} className={filter==='paused'?'active':''} onClick={()=>setFilter('paused')}>暫停 {counts.paused}</button>
    </section>

    <section className="soldout-guided-body">
      <div className="soldout-product-list" aria-label="商品清單">
        {view&&visible.length?visible.map(node=><button type="button" className={`soldout-product-row${selectedId===node.nodeId?' selected':''}`} key={node.nodeId} aria-pressed={selectedId===node.nodeId} onClick={()=>{setSelectedId(node.nodeId);setFeedback(null)}}>
          <span className="soldout-art" aria-hidden="true"/><span><b>{node.label}</b>{node.detail?<small>{node.detail}</small>:<small>{node.sourceLabel==='LOCAL'?'本機菜單':node.sourceLabel??'商品供應資料'}</small>}</span><StatusTag tone={node.status==='available'?'success':node.status==='soldout'?'danger':'warning'}>{statusLabel[node.status]}</StatusTag><em>設定 →</em>
        </button>):view?<EmptyState icon="⌕" title="冇符合條件嘅商品" detail="清除搜尋或者改用其他篩選。" actionLabel="顯示全部" onAction={()=>{setQuery('');setFilter('all')}}/>:null}
      </div>

      <aside className="soldout-decision" aria-label="商品供應設定">
        {selected?<>
          <header><div><small>目前處理</small><h2>{selected.label}</h2></div><StatusTag tone={selected.status==='available'?'success':selected.status==='soldout'?'danger':'warning'}>{statusLabel[selected.status]}</StatusTag></header>
          <p>揀一個真實狀態。已經生效嘅狀態會鎖住，避免重複操作。</p>
          <div className="soldout-state-choices">
            <button type="button" disabled={busy||!view?.canChange||selected.status==='available'} onClick={()=>void mutate('available')}><span>供</span><b>恢復供應</b><small>商品可以再次點選</small></button>
            <button type="button" disabled={busy||!view?.canChange||selected.status==='paused'} onClick={()=>void mutate('paused')}><span>停</span><b>暫停供應</b><small>暫時停止，但唔標記售罄</small></button>
            <button type="button" className="danger" disabled={busy||!view?.canChange||selected.status==='soldout'} onClick={()=>void mutate('soldout')}><span>罄</span><b>標記售罄</b><small>向前線清楚顯示已售罄</small></button>
          </div>
          {!view?.canChange?<DisabledReason>目前帳戶只可以查看，未有更新商品供應嘅權限。</DisabledReason>:null}
          <footer><span>資料版本 {view?.revision??'—'}</span><button type="button" onClick={()=>setSelectedId(null)}>完成／返回商品清單</button></footer>
        </>:<EmptyState icon="1" title="先揀一件商品" detail="左邊只顯示商品同目前狀態；揀選後，呢度先會顯示可以做嘅操作。"/>}
      </aside>
    </section>
  </main>;
}
