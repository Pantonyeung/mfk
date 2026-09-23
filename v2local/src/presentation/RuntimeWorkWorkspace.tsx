import {useCallback,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import type {CleanSmtCoreRuntimePort,SmtOrdersProjection} from '../runtime/local-runtime.ts';
import {ActionFeedback,EmptyState,StatusTag} from './SmtUi.tsx';
import './runtime-work-workspace.css';

const priority:Record<string,number>={'待處理':0,'進行中':1,'可取餐':2};

export function RuntimeWorkWorkspace({runtime}:{runtime:CleanSmtCoreRuntimePort}){
  const navigate=useNavigate();
  const [snapshot,setSnapshot]=useState<SmtOrdersProjection|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!runtime.readOrders){setError('目前未能讀取工作隊列。');setLoading(false);return;}
    try{setSnapshot(await runtime.readOrders());setError(null);}
    catch{setError('工作隊列載入失敗，請稍後再試。');}
    finally{setLoading(false);}
  },[runtime]);

  useEffect(()=>{void load();return runtime.subscribe(()=>void load());},[load,runtime]);

  const active=useMemo(()=>(snapshot?.items??[])
    .filter(order=>!['已完成','已取消'].includes(order.fulfillmentLabel))
    .slice()
    .sort((a,b)=>(priority[a.fulfillmentLabel]??9)-(priority[b.fulfillmentLabel]??9)),[snapshot]);
  const waiting=active.filter(order=>order.fulfillmentLabel==='待處理');
  const making=active.filter(order=>order.fulfillmentLabel==='進行中');
  const ready=active.filter(order=>order.fulfillmentLabel==='可取餐');

  return <main className="smt-work-page">
    <header className="smt-page-heading">
      <div><span>工作</span><h1>而家最需要處理嘅訂單</h1><p>先處理待接單，再跟進製作中；可取餐訂單會清楚分開。</p></div>
      <button type="button" onClick={()=>void load()} disabled={loading}>{loading?'更新中…':'重新整理'}</button>
    </header>

    {error?<ActionFeedback tone="danger" title="未能載入工作" detail={error} actionLabel="再試一次" onAction={()=>void load()}/>:null}
    {!error&&waiting.length?<ActionFeedback tone="warning" title={`有 ${waiting.length} 張訂單等待處理`} detail="打開第一張訂單，先確認來源同餐點，再執行現有接單操作。" actionLabel="處理第一張" onAction={()=>navigate('/orders?orderId='+encodeURIComponent(waiting[0]!.orderId))}/>:null}

    <section className="smt-work-summary" aria-label="工作摘要">
      <article className="attention"><span>優先處理</span><strong>{waiting.length}</strong><small>等待接單</small></article>
      <article className="current"><span>製作中</span><strong>{making.length}</strong><small>需要跟進</small></article>
      <article className="ready"><span>可以交付</span><strong>{ready.length}</strong><small>等待取餐</small></article>
    </section>

    {loading&&!snapshot?<section className="smt-work-loading" aria-live="polite"><span/><div><b>正在讀取工作隊列</b><p>請稍候，系統會保留目前畫面。</p></div></section>:active.length?<section className="smt-work-list" aria-label="目前工作隊列">
      <header><div><span>建議次序</span><h2>由上至下處理</h2></div><small>共 {active.length} 張進行中訂單</small></header>
      {active.map((order,index)=>{
        const tone=order.fulfillmentLabel==='待處理'?'warning':order.fulfillmentLabel==='可取餐'?'success':'info';
        const next=order.fulfillmentLabel==='待處理'?'核對並接單':order.fulfillmentLabel==='可取餐'?'核對後交付':'檢查製作進度';
        return <button type="button" className={`smt-work-row ${tone}`} key={order.orderId} onClick={()=>navigate('/orders?orderId='+encodeURIComponent(order.orderId))}>
          <span className="smt-work-rank">{index+1}</span>
          <span className="smt-work-order"><b>{order.orderIdLabel}</b><small>{order.sourceLabel??'現場'} · {order.paymentLabel}</small></span>
          <span className="smt-work-items">{order.itemCount} 件<strong>{order.totalLabel}</strong></span>
          <StatusTag tone={tone}>{order.fulfillmentLabel}</StatusTag>
          <span className="smt-work-next"><small>下一步</small><b>{next} →</b></span>
        </button>;
      })}
    </section>:!loading&&!error?<EmptyState icon="✓" title="目前冇待處理工作" detail="新訂單出現時會顯示喺呢度；你亦可以去「訂單」查看歷史記錄。" actionLabel="查看所有訂單" onAction={()=>navigate('/orders')}/>:null}
  </main>;
}
