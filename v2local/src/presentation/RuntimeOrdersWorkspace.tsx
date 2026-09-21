import {useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router';
import type {CleanSmtCoreRuntimePort,SmtOrdersProjection,SmtReprintOption} from '../runtime/local-runtime.ts';
import './orders-workspace.css';

export function RuntimeOrdersWorkspace({runtime}:{runtime:CleanSmtCoreRuntimePort}){
  const [params]=useSearchParams();
  const initialOrderId=params.get('orderId')??undefined;
  const [snapshot,setSnapshot]=useState<SmtOrdersProjection|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [filter,setFilter]=useState<'全部'|'已完成'>('全部');
  const [readyBusy,setReadyBusy]=useState(false);
  const [readyStatus,setReadyStatus]=useState<string|null>(null);
  const [reprintOpen,setReprintOpen]=useState(false);
  const [reprintOptions,setReprintOptions]=useState<readonly SmtReprintOption[]>([]);
  const [selectedJobs,setSelectedJobs]=useState<Set<string>>(new Set());
  const [reprintBusy,setReprintBusy]=useState(false);
  const [reprintStatus,setReprintStatus]=useState<string|null>(null);

  const load=useCallback(async(selectedOrderId?:string,silent=false)=>{
    if(!runtime.readOrders){setError('ORDERS_PROVIDER_UNAVAILABLE');return;}
    if(!silent)setLoading(true);
    setError(null);
    try{setSnapshot(await runtime.readOrders(selectedOrderId));}
    catch{setError('ORDERS_READ_FAILED');}
    finally{if(!silent)setLoading(false);}
  },[runtime]);

  useEffect(()=>{void load(initialOrderId);},[load,initialOrderId]);
  useEffect(()=>runtime.subscribe(()=>void load(snapshot?.selectedOrderId,true)),[runtime,load,snapshot?.selectedOrderId]);

  const selected=snapshot?.selectedOrder;
  const activeRows=useMemo(()=>{
    const items=snapshot?.items??[];
    return [
      {id:'progress',label:'進行中',helper:'已付款／已確認，正在製作',orders:items.filter(order=>order.fulfillmentLabel==='進行中')},
      {id:'pending',label:'待處理',helper:'磨飯 App／Keeta 異常，待人工確認',orders:items.filter(order=>order.fulfillmentLabel==='待處理')},
      {id:'ready',label:'可取餐',helper:'已完成製作，等待取餐',orders:items.filter(order=>order.fulfillmentLabel==='可取餐')},
    ] as const;
  },[snapshot]);
  const completedRows=useMemo(()=>[
    {id:'completed',label:'已完成',helper:'已完成訂單',orders:(snapshot?.items??[]).filter(order=>order.fulfillmentLabel==='已完成')}
  ] as const,[snapshot]);
  const rows=filter==='已完成'?completedRows:activeRows;
  const visibleCount=rows.reduce((sum,row)=>sum+row.orders.length,0);

  useEffect(()=>{
    setReprintOpen(false);
    setReprintOptions([]);
    setSelectedJobs(new Set());
    setReprintStatus(null);
  },[snapshot?.selectedOrderId]);

  const markSelectedReady=useCallback(async()=>{
    if(!selected||!runtime.markOrderReady||readyBusy)return;
    setReadyBusy(true);setReadyStatus(null);
    try{
      await runtime.markOrderReady(selected.orderId);
      await load(selected.orderId);
      setReadyStatus('已標記可取餐');
    }catch(cause){
      setReadyStatus(cause instanceof Error?cause.message:'未能標記可取餐');
    }finally{setReadyBusy(false);}
  },[selected,runtime,readyBusy,load]);

  const toggleReprint=useCallback(async()=>{
    if(!selected||!runtime.readOrderReprintOptions)return;
    if(reprintOpen){setReprintOpen(false);return;}
    setReprintStatus(null);
    try{
      const options=await runtime.readOrderReprintOptions(selected.orderId);
      setReprintOptions(options);
      setSelectedJobs(new Set());
      setReprintOpen(true);
    }catch(cause){
      setReprintStatus(cause instanceof Error?cause.message:'REPRINT_OPTIONS_FAILED');
    }
  },[selected,runtime,reprintOpen]);

  const runReprint=useCallback(async()=>{
    if(!selected||!runtime.reprintOrderJobs||!selectedJobs.size||reprintBusy)return;
    setReprintBusy(true);setReprintStatus(null);
    try{
      const result=await runtime.reprintOrderJobs(selected.orderId,[...selectedJobs]);
      setReprintStatus(result.failed===0?'重印已送出 '+result.sent+'/'+result.planned:'重印部分失敗 '+result.sent+'/'+result.planned);
      setSelectedJobs(new Set());
    }catch(cause){
      setReprintStatus(cause instanceof Error?cause.message:'REPRINT_FAILED');
    }finally{setReprintBusy(false);}
  },[selected,runtime,selectedJobs,reprintBusy]);

  const toggleJob=(jobId:string)=>setSelectedJobs(current=>{
    const next=new Set(current);
    if(next.has(jobId))next.delete(jobId);else next.add(jobId);
    return next;
  });
  const selectAllLabels=()=>setSelectedJobs(new Set(reprintOptions.filter(option=>option.role==='產品標籤'||option.role==='袋標籤').map(option=>option.jobId)));

  return <main className="orders-workspace runtime-orders-workspace" aria-label="訂單中心">
    <section className="orders-detail-column">
      <article className="orders-selected-detail">
        <header>
          <div><small>訂單</small><h1>{selected?.orderIdLabel??'選擇訂單'}</h1></div>
          <strong>{selected?.totalLabel??'—'}</strong>
        </header>

        {error?<p className="orders-notice" role="alert">{error}</p>:null}
        {loading&&!snapshot?<p className="orders-local-bootstrap">載入訂單…</p>:null}

        {selected?<div className="orders-detail-scroll">
          <div className="orders-status-strip"><span>{selected.sourceLabel??'現場'}</span><b>{selected.paymentLabel}</b><small>{selected.fulfillmentLabel}</small></div>
          <section className="orders-payment-summary">{selected.metrics.slice(0,3).map(metric=><p key={metric.id}><span>{metric.label}</span><b>{metric.value}</b></p>)}</section>
          <section className="orders-detail-lines">
            <header><b>訂單內容</b><span>{selected.itemCount} 件</span></header>
            {selected.lines.map(line=><article key={line.id}>
              <div><strong>{line.name}</strong><small>{line.unitLabel} × {line.quantity}</small></div>
              <b>×{line.quantity}</b><span>{line.lineTotalLabel}</span>
            </article>)}
          </section>
          {readyStatus?<p className="orders-inline-status">{readyStatus}</p>:null}
          {reprintStatus?<p className="orders-inline-status">{reprintStatus}</p>:null}
        </div>:<div className="orders-empty-detail">請喺右邊選擇訂單。</div>}

        {selected&&reprintOpen?<section className="orders-reprint-panel">
          <header><div><b>重印</b><span>只重印揀選內容；重印唔會開錢箱。</span></div><button type="button" onClick={()=>setReprintOpen(false)}>收起</button></header>
          <div className="orders-reprint-tools"><button type="button" onClick={selectAllLabels}>全選 Label</button><button type="button" onClick={()=>setSelectedJobs(new Set())}>清除</button></div>
          <div className="orders-reprint-options">
            {reprintOptions.map(option=><label key={option.jobId}>
              <input type="checkbox" checked={selectedJobs.has(option.jobId)} onChange={()=>toggleJob(option.jobId)}/>
              <span><b>{option.label}</b>{option.detail?<small>{option.detail}</small>:null}</span>
            </label>)}
          </div>
          <button type="button" className="orders-reprint-submit" disabled={!selectedJobs.size||reprintBusy} onClick={()=>void runReprint()}>{reprintBusy?'重印中…':'開始重印'}</button>
        </section>:null}

        {selected?<footer className="orders-action-dock">
          <button type="button" className="primary" disabled={!runtime.markOrderReady||readyBusy||selected.fulfillmentLabel==='可取餐'||selected.fulfillmentLabel==='已完成'} onClick={()=>void markSelectedReady()}>
            {readyBusy?'處理中…':selected.fulfillmentLabel==='可取餐'?'已可取餐':'標記可取餐'}
          </button>
          <button type="button" disabled={!runtime.readOrderReprintOptions||!runtime.reprintOrderJobs} onClick={()=>void toggleReprint()}>{reprintOpen?'收起重印':'重印'}</button>
        </footer>:null}
      </article>
    </section>

    <section className="orders-pool-column">
      <header className="orders-toolbar">
        <div className="orders-payment-filter">{(['全部','已完成'] as const).map(item=><button type="button" key={item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{item}</button>)}</div>
        <span>{visibleCount} 單</span>
      </header>
      <div className={'orders-source-pools '+(filter==='已完成'?'single':'')}>
        {rows.map(row=><section className="orders-pool-row" key={row.id}>
          <header><div><strong>{row.label}</strong><span>{row.orders.length}</span></div><small>{row.helper}</small></header>
          <div className="orders-pool-cards">
            {row.orders.length?row.orders.map(order=><button type="button" key={order.orderId} className={snapshot?.selectedOrderId===order.orderId?'selected':''} onClick={()=>void load(order.orderId)}>
              <strong>{order.orderIdLabel}</strong><span>{order.itemCount} 件</span><b>{order.totalLabel}</b>
              <small>{[order.sourceLabel,order.paymentLabel].filter(Boolean).join(' · ')}</small>
            </button>):<p>目前沒有訂單。</p>}
          </div>
        </section>)}
      </div>
    </section>
  </main>;
}
