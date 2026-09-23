import {useCallback,useEffect,useState} from 'react';
import {useNavigate} from 'react-router';
import type {CleanSmtCoreRuntimePort,SmtAvailabilityProjection,SmtDiningProjection} from '../runtime/local-runtime.ts';
import {ActionFeedback,StatusTag} from './SmtUi.tsx';
import './smt-operations-hub.css';

export function SmtOperationsHub({runtime}:{runtime:CleanSmtCoreRuntimePort}){
  const navigate=useNavigate();
  const [dining,setDining]=useState<SmtDiningProjection|null>(null);
  const [availability,setAvailability]=useState<SmtAvailabilityProjection|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [nextDining,nextAvailability]=await Promise.all([
        runtime.readDining?runtime.readDining():Promise.resolve(null),
        runtime.readAvailability?runtime.readAvailability():Promise.resolve(null),
      ]);
      setDining(nextDining);setAvailability(nextAvailability);setError(null);
    }catch{setError('部分營運狀態暫時未能讀取。');}
    finally{setLoading(false);}
  },[runtime]);

  useEffect(()=>{void load();return runtime.subscribe(()=>void load());},[load,runtime]);
  const occupied=dining?.tables.filter(table=>table.state==='occupied'||table.state==='attention').length??0;
  const attention=dining?.tables.filter(table=>table.state==='attention').length??0;
  const unavailable=availability?.nodes.filter(node=>node.status!=='available').length??0;

  return <main className="smt-operations-page">
    <header className="smt-page-heading"><div><span>營運</span><h1>先睇需要注意嘅門店狀態</h1><p>堂食同商品供應分開處理；只顯示系統實際讀取到嘅狀態。</p></div><button type="button" disabled={loading} onClick={()=>void load()}>{loading?'更新中…':'重新整理'}</button></header>
    {error?<ActionFeedback tone="warning" title="未能讀取全部狀態" detail={error} actionLabel="再試一次" onAction={()=>void load()}/>:null}
    <section className="smt-operations-grid">
      <article className="smt-operation-card">
        <header><div className="smt-operation-icon">枱</div><StatusTag tone={attention?'warning':'success'}>{attention?`${attention} 項注意`:'目前正常'}</StatusTag></header>
        <div><span>堂食</span><h2>枱面、輪候與結帳</h2><p>目前 {occupied} 張使用中枱，輪候 {dining?.queue.length??0} 組。</p></div>
        <dl><div><dt>使用中</dt><dd>{occupied}</dd></div><div><dt>需要注意</dt><dd>{attention}</dd></div><div><dt>輪候</dt><dd>{dining?.queue.length??0}</dd></div></dl>
        <button type="button" onClick={()=>navigate('/dining')}>進入堂食工作台 →</button>
      </article>
      <article className="smt-operation-card">
        <header><div className="smt-operation-icon">貨</div><StatusTag tone={unavailable?'warning':'success'}>{unavailable?`${unavailable} 項非供應中`:'全部供應中'}</StatusTag></header>
        <div><span>商品供應</span><h2>售罄與暫停供應</h2><p>只改現有商品供應狀態；唔會改菜單、價格或商品身份。</p></div>
        <dl><div><dt>商品總數</dt><dd>{availability?.nodes.length??0}</dd></div><div><dt>非供應中</dt><dd>{unavailable}</dd></div><div><dt>資料版本</dt><dd>{availability?.revision??'—'}</dd></div></dl>
        <button type="button" onClick={()=>navigate('/soldout')}>管理商品供應 →</button>
      </article>
    </section>
    <ActionFeedback tone="info" title="所有資料仍以正式來源為準" detail="呢個頁面只重新整理入口同閱讀次序；堂食、商品供應、結帳同訂單嘅原有規則全部保持不變。"/>
  </main>;
}
