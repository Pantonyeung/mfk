import {useCallback,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import type {CleanSmtCoreRuntimePort,SmtOrdersProjection} from '../runtime/local-runtime.ts';
import './orders-workspace.css';

export function RuntimeOrdersWorkspace({runtime}:{runtime:CleanSmtCoreRuntimePort}){
  const navigate=useNavigate();
  const [snapshot,setSnapshot]=useState<SmtOrdersProjection|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [filter,setFilter]=useState<'全部'|'已完成'>('全部');
  const [printBusy,setPrintBusy]=useState(false);
  const [printStatus,setPrintStatus]=useState<string|null>(null);
  const [readyBusy,setReadyBusy]=useState(false);
  const [readyStatus,setReadyStatus]=useState<{tone:'success'|'error';text:string}|null>(null);

  const load=useCallback(async(selectedOrderId?:string,silent=false)=>{
    if(!runtime.readOrders){setError('ORDERS_PROVIDER_UNAVAILABLE');return;}
    if(!silent)setLoading(true);
    setError(null);
    try{setSnapshot(await runtime.readOrders(selectedOrderId));}
    catch{setError('ORDERS_READ_FAILED');}
    finally{if(!silent)setLoading(false);}
  },[runtime]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>runtime.subscribe(()=>{
    void load(snapshot?.selectedOrderId,true);
  }),[runtime,load,snapshot?.selectedOrderId]);

  const selected=snapshot?.selectedOrder;
  const activeRows=useMemo(()=>{
    const items=snapshot?.items??[];
    return [
      {id:'progress',label:'進行中',orders:items.filter(order=>order.fulfillmentLabel==='可取餐')},
      {id:'pending',label:'待處理',orders:items.filter(order=>order.fulfillmentLabel==='待處理')},
      {id:'cancel',label:'可取消',orders:[] as typeof items},
    ] as const;
  },[snapshot]);
  const completedRows=useMemo(()=>[
    {id:'completed',label:'已完成',orders:(snapshot?.items??[]).filter(order=>order.fulfillmentLabel==='已完成')}
  ] as const,[snapshot]);
  const rows=filter==='已完成'?completedRows:activeRows;
  const visibleCount=rows.reduce((sum,row)=>sum+row.orders.length,0);

  const markSelectedReady=useCallback(async()=>{
    if(!selected||!runtime.markOrderReady||readyBusy)return;
    setReadyBusy(true);setReadyStatus(null);
    try{
      await runtime.markOrderReady(selected.orderId);
      await load(selected.orderId);
      setReadyStatus({tone:'success',text:'已標記可取餐'});
    }catch(cause){
      const code=cause instanceof Error?cause.message:String(cause??'');
      setReadyStatus({
        tone:'error',
        text:code.includes('NOT_ACTIONABLE')?'呢張單目前唔可以標記可取餐。':
          code.includes('STALE')?'訂單履約狀態啱啱有更新，今次操作已拒絕；請重新同步。':
          '未能確認可取餐狀態；正式訂單狀態保持原狀。',
      });
      await load(selected.orderId,true).catch(()=>{});
    }finally{setReadyBusy(false);}
  },[selected,runtime,readyBusy,load]);

  const printSelected=useCallback(async()=>{
    if(!selected||(!runtime.printOrderOutputs&&!runtime.printOrderReceipt)||printBusy)return;
    setPrintBusy(true);setPrintStatus(null);
    try{
      if(runtime.printOrderOutputs){
        const result=await runtime.printOrderOutputs(selected.orderId);
        if(result.planned===0)setPrintStatus('未有任何已綁定打印 Route');
        else if(result.failed===0)setPrintStatus(`已送出 ${result.sent}/${result.planned} 個打印工作`);
        else{
          const failures=result.results.filter(row=>!row.ok).map(row=>row.role+':'+row.code).join('；');
          setPrintStatus(`打印部分失敗：${result.sent}/${result.planned}；${failures}`);
        }
      }else{
        const result=await runtime.printOrderReceipt!(selected.orderId);
        setPrintStatus(result.state==='COMPLETED'?'打印完成':`打印狀態：${result.state}`);
      }
    }catch(cause){
      const code=cause instanceof Error?cause.message:String(cause??'PRINT_FAILED');
      setPrintStatus('打印失敗：'+code);
    }finally{setPrintBusy(false);}
  },[selected,runtime,printBusy]);

  return <main className="orders-workspace runtime-orders-workspace" aria-label="Orders Main Workspace" data-smt-core-runtime="bound">
    <section className="orders-detail-column">
      <article className="orders-selected-detail">
        <header><div><small>ORDER · V2 PROJECTION</small><h1>{selected?.orderIdLabel??'選擇訂單'}</h1>{selected?.localSequenceLabel?<span>{selected.localSequenceLabel}</span>:null}</div><strong>{selected?.totalLabel??'—'}</strong></header>
        {!runtime.readOrders?<p className="orders-notice" role="alert">Orders UI已接入 V2，但 read/history consumer provider尚未 admission；唔會用舊 runtime或 fixture補單。</p>:null}
        {error?<p className="orders-notice" role="alert">{error}</p>:null}
        {loading&&!snapshot?<p className="orders-local-bootstrap">首次載入訂單資料…</p>:null}
        {loading&&snapshot?<p className="orders-sync-state" role="status">背景同步中</p>:null}
        {selected?<>
          <div className="orders-status-strip"><span>付款</span><b>{selected.paymentLabel}</b><small>{selected.fulfillmentLabel}</small></div>
          <section className="orders-payment-summary">{selected.metrics.slice(0,3).map(metric=><p key={metric.id}><span>{metric.label}</span><b>{metric.value}</b></p>)}</section>
          <section className="orders-detail-lines">
            <header><b>訂單內容</b><span>{selected.itemCount} 件</span></header>
            {selected.lines.length?selected.lines.map(line=><article key={line.id}>
              <div><strong>{line.name}</strong><small>{line.unitLabel} × {line.quantity}</small></div>
              <b>×{line.quantity}</b>
              <span>{line.lineTotalLabel}</span>
            </article>):<p>呢張單冇商品明細。</p>}
          </section>
          {selected.attention.map(item=><p className="orders-notice" key={item}>{item}</p>)}
          <div className="orders-main-actions"><button type="button" disabled={!runtime.markOrderReady||readyBusy||selected.fulfillmentLabel==='可取餐'||selected.fulfillmentLabel==='已完成'} onClick={()=>void markSelectedReady()}>{readyBusy?'處理中…':selected.fulfillmentLabel==='可取餐'?'已可取餐':'標記可取餐'}</button><button type="button" disabled={(!runtime.printOrderOutputs&&!runtime.printOrderReceipt)||printBusy} onClick={()=>void printSelected()}>{printBusy?'打印中…':'打印全部已設定'}</button></div>
          {readyStatus?<p className={readyStatus.tone==='error'?'orders-notice':'orders-sync-state'} role={readyStatus.tone==='error'?'alert':'status'}>{readyStatus.text}</p>:null}
          {printStatus?<p className="orders-sync-state" role="status">{printStatus}</p>:null}
        </>:null}
      </article>
      <div className="orders-history-actions"><button type="button" onClick={()=>navigate('/')}>返回點單</button><button type="button" disabled={loading} onClick={()=>void load(snapshot?.selectedOrderId)}>同步</button><button type="button" onClick={()=>navigate('/more')}>營運中心</button></div>
    </section>

    <section className="orders-pool-column">
      <header className="orders-toolbar">
        <div className="orders-payment-filter" aria-label="訂單檢視篩選">{(['全部','已完成'] as const).map(item=><button type="button" key={item} aria-pressed={filter===item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{item}</button>)}</div>
        <span>{visibleCount} 單</span>
      </header>
      <div className="orders-source-pools">
        {rows.map(row=><section className="orders-pool-row" key={row.id}>
          <header><div><strong>{row.label}</strong><span>{row.orders.length} 單</span></div></header>
          <div className="orders-pool-cards">
            {row.orders.length?row.orders.map(order=><button type="button" key={order.orderId} className={snapshot?.selectedOrderId===order.orderId?'selected':''} aria-pressed={snapshot?.selectedOrderId===order.orderId} onClick={()=>void load(order.orderId)}>
              <strong>{order.orderIdLabel}</strong><span>{order.itemCount} 件</span><b>{order.totalLabel}</b>
              <small>{[order.sourceLabel,order.paymentLabel,order.fulfillmentLabel].filter(Boolean).join(' · ')}</small>
            </button>):<p>{row.id==='cancel'?'目前未有 canonical 可取消狀態。':'目前沒有訂單。'}</p>}
          </div>
        </section>)}
      </div>
    </section>
  </main>;
}
