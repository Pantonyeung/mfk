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
  const [filter,setFilter]=useState<'all'|'waiting'|'making'|'ready'>('all');

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
  const visible=filter==='waiting'?waiting:filter==='making'?making:filter==='ready'?ready:active;
  const next=active[0];
  const nextAction=next?.fulfillmentLabel==='待處理'?'核對並接單':next?.fulfillmentLabel==='可取餐'?'核對後交付':'檢查製作進度';

  return <main className="smt-work-page">
    <header className="smt-page-heading"><div><span>工作</span><h1>下一張要做乜，一眼就見到</h1><p>系統只按現有訂單狀態排序；唔會自行估計延誤或未知。</p></div><button type="button" onClick={()=>void load()} disabled={loading}>{loading?'更新中…':'重新整理'}</button></header>
    {error?<ActionFeedback tone="danger" title="未能載入工作" detail={error} actionLabel="再試一次" onAction={()=>void load()}/>:null}

    {!loading&&!error&&next?<section className={`smt-work-next-card ${next.fulfillmentLabel==='待處理'?'attention':next.fulfillmentLabel==='可取餐'?'ready':'current'}`}>
      <div><span>下一張要處理</span><h2>{next.orderIdLabel}</h2><p>{next.sourceLabel??'現場'} · {next.itemCount} 件 · {next.totalLabel}</p></div>
      <StatusTag tone={next.fulfillmentLabel==='待處理'?'warning':next.fulfillmentLabel==='可取餐'?'success':'info'}>{next.fulfillmentLabel}</StatusTag>
      <button type="button" onClick={()=>navigate('/orders?orderId='+encodeURIComponent(next.orderId))}>{nextAction} →</button>
    </section>:null}

    <section className="smt-work-filter" aria-label="按工作狀態篩選">
      <button type="button" className={filter==='all'?'active':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}><span>全部</span><strong>{active.length}</strong></button>
      <button type="button" className={filter==='waiting'?'active attention':''} aria-pressed={filter==='waiting'} onClick={()=>setFilter('waiting')}><span>等待接單</span><strong>{waiting.length}</strong></button>
      <button type="button" className={filter==='making'?'active current':''} aria-pressed={filter==='making'} onClick={()=>setFilter('making')}><span>製作中</span><strong>{making.length}</strong></button>
      <button type="button" className={filter==='ready'?'active ready':''} aria-pressed={filter==='ready'} onClick={()=>setFilter('ready')}><span>可取餐</span><strong>{ready.length}</strong></button>
    </section>

    {loading&&!snapshot?<section className="smt-work-loading" aria-live="polite"><span/><div><b>正在讀取工作隊列</b><p>請稍候，系統會保留目前畫面。</p></div></section>:visible.length?<section className="smt-work-list" aria-label="目前工作隊列">
      <header><div><span>工作隊列</span><h2>{filter==='all'?'建議處理次序':filter==='waiting'?'等待接單':filter==='making'?'製作中':'可取餐'}</h2></div><small>{visible.length} 張</small></header>
      {visible.map((order,index)=>{
        const tone=order.fulfillmentLabel==='待處理'?'warning':order.fulfillmentLabel==='可取餐'?'success':'info';
        const action=order.fulfillmentLabel==='待處理'?'核對並接單':order.fulfillmentLabel==='可取餐'?'核對後交付':'檢查製作進度';
        return <button type="button" className={`smt-work-row ${tone}`} key={order.orderId} onClick={()=>navigate('/orders?orderId='+encodeURIComponent(order.orderId))}>
          <span className="smt-work-rank">{index+1}</span><span className="smt-work-order"><b>{order.orderIdLabel}</b><small>{order.sourceLabel??'現場'} · {order.paymentLabel}</small></span><span className="smt-work-items">{order.itemCount} 件<strong>{order.totalLabel}</strong></span><StatusTag tone={tone}>{order.fulfillmentLabel}</StatusTag><span className="smt-work-next"><small>下一步</small><b>{action} →</b></span>
        </button>;
      })}
    </section>:!loading&&!error?<EmptyState icon="✓" title={filter==='all'?'目前冇待處理工作':'呢個狀態暫時冇訂單'} detail={filter==='all'?'新訂單出現時會顯示喺呢度；亦可以去「訂單」查看記錄。':'轉去其他狀態，或者查看全部工作。'} actionLabel={filter==='all'?'查看所有訂單':'顯示全部'} onAction={()=>filter==='all'?navigate('/orders'):setFilter('all')}/>:null}
  </main>;
}
