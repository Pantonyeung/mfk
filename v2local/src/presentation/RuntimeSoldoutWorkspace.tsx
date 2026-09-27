import {useCallback,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import type {CleanSmtCoreRuntimePort,SmtAvailabilityProjection,SmtAvailabilityStatus} from '../runtime/local-runtime.ts';
import type {SmtCapacityPoolStateView} from '../runtime/capacity-pool-state.ts';
import './state-pages.css';

const statusLabel:Record<SmtAvailabilityStatus,string>={available:'可售',soldout:'售罄',paused:'暫停'};

export function RuntimeSoldoutWorkspace({runtime,embedded=false}:{runtime:CleanSmtCoreRuntimePort;embedded?:boolean}){
  const navigate=useNavigate();
  const [view,setView]=useState<SmtAvailabilityProjection|null>(null);
  const [capacity,setCapacity]=useState<SmtCapacityPoolStateView|null>(null);
  const [query,setQuery]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!runtime.readAvailability){setError('CATALOG_AVAILABILITY_PROJECTION_UNAVAILABLE');return;}
    setBusy(true);setError(null);
    try{
      const [availability,poolState]=await Promise.all([
        runtime.readAvailability(),
        runtime.readCapacityPoolState?runtime.readCapacityPoolState():Promise.resolve(null),
      ]);
      setView(availability);
      setCapacity(poolState);
    }catch{setError('AVAILABILITY_READ_FAILED');}
    finally{setBusy(false);}
  },[runtime]);

  useEffect(()=>{void load();return runtime.subscribe(()=>void load());},[load,runtime]);

  const visible=useMemo(()=>view?.nodes.filter(node=>!query||`${node.nodeId} ${node.label}`.toLowerCase().includes(query.toLowerCase()))??[],[view,query]);
  const counts=useMemo(()=>({
    total:view?.nodes.length??0,
    soldout:view?.nodes.filter(node=>node.status==='soldout').length??0,
    paused:view?.nodes.filter(node=>node.status==='paused').length??0,
  }),[view]);

  const adjustCapacity=async(poolId:string,current:number)=>{
    if(!runtime.adjustCapacityPool)return;
    const raw=window.prompt('目前剩餘數量',String(current));
    if(raw===null)return;
    const quantity=Number(raw.trim());
    if(!Number.isSafeInteger(quantity)||quantity<0){setError('CAPACITY_MANUAL_QUANTITY_INVALID');return;}
    const note=window.prompt('調整原因（可留空）','');
    if(note===null)return;
    setBusy(true);setError(null);
    try{setCapacity(await runtime.adjustCapacityPool(poolId,quantity,note));}
    catch(cause){setError(cause instanceof Error?cause.message:'CAPACITY_MANUAL_ADJUST_FAILED');}
    finally{setBusy(false);}
  };

  const mutate=async(nodeId:string,status:SmtAvailabilityStatus)=>{
    if(!view||!view.canChange||!runtime.setAvailability)return;
    setBusy(true);setError(null);
    try{setView(await runtime.setAvailability(nodeId,status,view.revision));}
    catch{setError('AVAILABILITY_MUTATION_FAILED');}
    finally{setBusy(false);}
  };

  return <main className="soldout-operations-page runtime-soldout-page" aria-label="售罄管理" data-smt-core-runtime="bound">
    <header><div><span>AVAILABILITY · V2</span><h1>售罄操作</h1></div><div>{!embedded?<button type="button" onClick={()=>navigate('/')}>返回點單</button>:null}<button type="button" disabled={busy} onClick={()=>void load()}>更新</button></div></header>
    <section className="soldout-toolbar"><input aria-label="搜尋商品" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋商品"/><button type="button" aria-pressed="true">全部 {counts.total}</button><button type="button">售罄 {counts.soldout}</button><button type="button">暫停 {counts.paused}</button></section>
    {capacity?.pools.length?<section className="capacity-pool-state-panel" aria-label="產能 Pool 狀態">
      <header><div><small>BUSINESS DAY · {capacity.businessDate}</small><h2>產能 Pool</h2></div><span>本機狀態</span></header>
      <div>{capacity.pools.map(pool=><article key={pool.poolId}>
        <div><b>{pool.name}</b><small>{pool.poolId} · {pool.productIds.length} 件商品</small></div>
        <strong>{pool.remainingQty} / {pool.configuredInitialQty}</strong>
        <small>自家 ≤ {pool.firstPartyStopAt} · 第三方 ≤ {pool.thirdPartyStopAt}</small>
        <div className="capacity-channel-state">
          <span className={pool.firstPartyAccepting?'accepting':'stopped'}>自家接單 · {pool.firstPartyAccepting?'接受新單':'暫停新單'}</span>
          <span className={pool.thirdPartyAccepting?'accepting':'stopped'}>第三方接單 · {pool.thirdPartyAccepting?'接受新單':'暫停新單'}</span>
        </div>
        <button type="button" className="capacity-pool-adjust-button" disabled={busy||!runtime.adjustCapacityPool} onClick={()=>void adjustCapacity(pool.poolId,pool.remainingQty)}>調整數量</button>
      </article>)}</div>
      {capacity.invalidActivePoolIds.length?<p role="alert">有 {capacity.invalidActivePoolIds.length} 個啟用 Pool 設定無效，未建立本機狀態。</p>:null}
    </section>:null}
    {error&&!view?<section className="soldout-grid" role="alert"><p>{error}</p><p>Availability單項 canonical read/set已存在；整店售罄頁仍需要正式 Catalog target projection，UI不會自己發明商品清單。</p></section>:null}
    {view?<div className="soldout-grid">{visible.map(node=><article className={node.status==='soldout'?'sold':''} key={node.nodeId}><div className="soldout-art"/><div><b>{node.label}</b><small>{statusLabel[node.status]}{node.sourceLabel?` · ${node.sourceLabel}`:''}</small>{node.detail?<small>{node.detail}</small>:null}</div><div className="runtime-availability-actions"><button type="button" disabled={busy||!view.canChange||node.status==='soldout'} onClick={()=>void mutate(node.nodeId,'soldout')}>售罄</button><button type="button" disabled={busy||!view.canChange||node.status==='paused'} onClick={()=>void mutate(node.nodeId,'paused')}>暫停</button><button type="button" disabled={busy||!view.canChange||node.status==='available'} onClick={()=>void mutate(node.nodeId,'available')}>恢復</button></div></article>)}</div>:null}
    <footer><div><b>Revision {view?.revision??'—'}</b><span>商品清單與狀態只接受 V2 provider projection。</span></div>{error&&view?<strong role="alert">{error}</strong>:null}</footer>
  </main>;
}
