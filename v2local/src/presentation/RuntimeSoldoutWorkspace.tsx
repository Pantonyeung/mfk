import {useCallback,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import type {CleanSmtCoreRuntimePort,SmtAvailabilityProjection,SmtAvailabilityStatus} from '../runtime/local-runtime.ts';
import './state-pages.css';

const statusLabel:Record<SmtAvailabilityStatus,string>={available:'可售',soldout:'售罄',paused:'暫停'};

export function RuntimeSoldoutWorkspace({runtime,embedded=false}:{runtime:CleanSmtCoreRuntimePort;embedded?:boolean}){
  const navigate=useNavigate();
  const [view,setView]=useState<SmtAvailabilityProjection|null>(null);
  const [selected,setSelected]=useState<Set<string>>(()=>new Set());
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!runtime.readAvailability){setError('CATALOG_AVAILABILITY_PROJECTION_UNAVAILABLE');return;}
    setBusy(true);setError(null);
    try{setView(await runtime.readAvailability());}
    catch{setError('AVAILABILITY_READ_FAILED');}
    finally{setBusy(false);}
  },[runtime]);

  useEffect(()=>{void load();},[load]);

  const counts=useMemo(()=>({
    total:view?.nodes.length??0,
    soldout:view?.nodes.filter(node=>node.status==='soldout').length??0,
    paused:view?.nodes.filter(node=>node.status==='paused').length??0,
  }),[view]);

  const toggle=(nodeId:string)=>setSelected(current=>{
    const next=new Set(current);
    if(next.has(nodeId))next.delete(nodeId);else next.add(nodeId);
    return next;
  });

  const mutate=async(nodeId:string,status:SmtAvailabilityStatus)=>{
    if(!view||!view.canChange||!runtime.setAvailability)return;
    setBusy(true);setError(null);
    try{
      const next=await runtime.setAvailability(nodeId,status,view.revision);
      setView(next);
      setSelected(current=>{const copy=new Set(current);copy.delete(nodeId);return copy;});
    }catch{setError('AVAILABILITY_MUTATION_FAILED');}
    finally{setBusy(false);}
  };

  const applyBatch=async(status:SmtAvailabilityStatus)=>{
    if(!view||!view.canChange||!runtime.setAvailability||selected.size===0)return;
    setBusy(true);setError(null);
    try{
      let next=view;
      for(const nodeId of selected){
        const node=next.nodes.find(row=>row.nodeId===nodeId);
        if(!node||node.status===status)continue;
        next=await runtime.setAvailability(nodeId,status,next.revision);
      }
      setView(next);
      setSelected(new Set());
    }catch{setError('AVAILABILITY_BATCH_MUTATION_FAILED');}
    finally{setBusy(false);}
  };

  const allSelected=Boolean(view?.nodes.length)&&selected.size===view?.nodes.length;
  const toggleAll=()=>setSelected(current=>allSelected?new Set():new Set(view?.nodes.map(node=>node.nodeId)??current));

  return <main className="soldout-operations-page runtime-soldout-page soldout-compact" aria-label="售罄管理" data-smt-core-runtime="bound">
    <header className="soldout-compact-head">
      <div><h1>售罄</h1><p><span>售罄 {counts.soldout}</span><span>暫停 {counts.paused}</span><span>全部 {counts.total}</span></p></div>
      <div>{!embedded?<button type="button" onClick={()=>navigate('/')}>返回</button>:null}<button type="button" disabled={busy} onClick={()=>void load()}>更新</button></div>
    </header>

    {error&&!view?<section className="soldout-compact-error" role="alert"><b>未能讀取商品狀態</b><span>{error}</span></section>:null}

    {view?<section className="soldout-list-shell">
      <header className="soldout-list-head">
        <button type="button" className={allSelected?'selected':''} onClick={toggleAll} aria-pressed={allSelected}>{allSelected?'✓':'○'}</button>
        <span>商品</span><span>狀態</span><span>操作</span>
      </header>
      <div className="soldout-list">
        {view.nodes.map(node=><article key={node.nodeId} className={`state-${node.status}`}>
          <button type="button" className={selected.has(node.nodeId)?'selected':''} onClick={()=>toggle(node.nodeId)} aria-pressed={selected.has(node.nodeId)} aria-label={`選擇 ${node.label}`}>{selected.has(node.nodeId)?'✓':'○'}</button>
          <div><b>{node.label}</b>{node.detail?<small>{node.detail}</small>:null}</div>
          <strong>{statusLabel[node.status]}</strong>
          <div className="runtime-availability-actions">
            <button type="button" disabled={busy||!view.canChange||node.status==='soldout'} onClick={()=>void mutate(node.nodeId,'soldout')}>售罄</button>
            <button type="button" disabled={busy||!view.canChange||node.status==='paused'} onClick={()=>void mutate(node.nodeId,'paused')}>暫停</button>
            <button type="button" disabled={busy||!view.canChange||node.status==='available'} onClick={()=>void mutate(node.nodeId,'available')}>恢復</button>
          </div>
        </article>)}
      </div>
    </section>:null}

    <footer className="soldout-batch-bar">
      <div><b>{selected.size}</b><span>已選</span>{error&&view?<em role="alert">{error}</em>:null}</div>
      <div>
        <button type="button" disabled={busy||!view?.canChange||selected.size===0} onClick={()=>void applyBatch('soldout')}>批量售罄</button>
        <button type="button" disabled={busy||!view?.canChange||selected.size===0} onClick={()=>void applyBatch('paused')}>批量暫停</button>
        <button type="button" className="recover" disabled={busy||!view?.canChange||selected.size===0} onClick={()=>void applyBatch('available')}>批量恢復</button>
      </div>
    </footer>
  </main>;
}
