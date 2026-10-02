import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {MfpOrderingSurface} from './ordering-domain.ts';
import {
  selectMfpLabelJobs,
  type MfpCanonicalPrintJob,
  type MfpPrintHardwareReadback,
  type MfpPrintHardwareSession,
  type MfpPrinterBinding,
  type MfpPrintTransportState,
} from './print-hardware-domain.ts';

const stateLabel:Record<MfpPrintTransportState,string>={
  NOT_STARTED:'未開始',PERSISTED:'已持久化',DISPATCHING:'傳送中',ACKNOWLEDGED:'通訊已確認',
  FAILED_BEFORE_SEND:'送出前失敗',AMBIGUOUS_AFTER_SEND:'結果未能確認',
};
const message=(error:unknown)=>error instanceof Error?error.message:'MFP_PRINT_ACTION_FAILED';

function BindingEditor({binding,session,onDone}:{binding:MfpPrinterBinding;session:MfpPrintHardwareSession;onDone:()=>void}){
  const [host,setHost]=useState(binding.host??'');
  const [port,setPort]=useState(String(binding.port??9100));
  const [status,setStatus]=useState('');
  const run=async(kind:'save'|'probe'|'test')=>{
    setStatus('處理中…');
    try{
      if(kind==='save')await session.applyBinding({...binding,host,port:Number(port)});
      if(kind==='probe')await session.probeEndpoint(binding.bindingId);
      if(kind==='test')await session.testEndpoint(binding.bindingId);
      setStatus(kind==='save'?'本地 binding 已提交':'只確認通訊結果；不代表實體已出紙');
      onDone();
    }catch(error){setStatus(`BLOCKED · ${message(error)}`);}
  };
  return <form className="mfp-printer-binding" onSubmit={event=>{event.preventDefault();void run('save');}}>
    <header><div><b>{binding.displayName}</b><small>{binding.logicalDestinationId} · {binding.capability}</small></div><span>{binding.enabled?'啟用':'停用'}</span></header>
    {binding.transport==='tcp'?<div className="mfp-printer-endpoint"><label>Printer IP / Host<input required value={host} onChange={event=>setHost(event.target.value)}/></label><label>Port<input required type="number" min="1" max="65535" inputMode="numeric" value={port} onChange={event=>setPort(event.target.value)}/></label></div>:<p>Sunmi 內置 Printer</p>}
    <small>只改本地實體 binding；Product → Logical Destination 仍由 Admin 發佈。</small>
    <footer><button type="button" onClick={()=>void run('probe')}>Probe</button><button type="button" onClick={()=>void run('test')}>Endpoint Test</button><button type="submit">儲存本地設定</button></footer>
    {status?<output aria-live="polite">{status}</output>:null}
  </form>;
}

export function MfpPrintHardwareWorkspace({surface,session,readback,onRefresh}:{
  surface:MfpOrderingSurface;session:MfpPrintHardwareSession;readback:MfpPrintHardwareReadback;onRefresh:()=>void;
}){
  const [status,setStatus]=useState('');
  const retry=async(jobId:string)=>{
    setStatus('正在向正式 Print authority 要求安全重試…');
    try{await session.requestSafeRetry(jobId,`MFP-A7-SAFE-${crypto.randomUUID()}`);setStatus('SOURCE_VERIFIED · 安全重試已提交');onRefresh();}
    catch(error){setStatus(`BLOCKED · ${message(error)}`);}
  };
  const latestAmbiguous=[...readback.jobs].reverse().find(job=>job.transportState==='AMBIGUOUS_AFTER_SEND');
  return <section className={`mfp-print-hardware ${surface==='MFP_MOBILE'?'mobile':''}`} data-print-hardware-contract="SHARED_PAD_MOBILE">
    <header className="mfp-print-head"><div><small>More / Tools</small><h1>Print / Hardware</h1><p>Transport Evidence ≠ Physical Paper Proof</p></div><button type="button" onClick={onRefresh}>重新讀取</button></header>
    <section className="mfp-print-diagnostics" aria-label="Print recovery diagnostics">
      <article><small>Gateway</small><b>{readback.gateway.serviceReady?'Available':'Unavailable'}</b></article>
      <article><small>Queue</small><b>{readback.gateway.queueDepth}</b></article>
      <article><small>Bindings</small><b>{readback.bindings.length}</b></article>
      <article><small>Last ambiguous</small><b>{latestAmbiguous?.canonicalPrintJobId??'—'}</b></article>
    </section>
    {readback.bindingError?<p className="mfp-print-attention" role="alert">Invalid Config · {readback.bindingError}</p>:null}
    <div className="mfp-print-columns">
      <section><header><h2>Physical Printers</h2><small>本地 IP / Port / Model / Capability</small></header>{readback.bindings.length?readback.bindings.map(binding=><BindingEditor key={binding.bindingId} binding={binding} session={session} onDone={onRefresh}/>):<p className="mfp-print-empty">Missing Binding · 請設定本地實體 Printer。</p>}</section>
      <section><header><h2>Print Attention</h2><small>Canonical job + gateway evidence</small></header><div className="mfp-print-jobs">{readback.jobs.map(job=><article key={job.canonicalPrintJobId} className={`mfp-print-job ${job.attention.kind==='HUMAN_CHECK'?'unknown':''}`}>
        <header><div><b>{job.jobType}</b><small>{job.orderId?`Order ${job.orderId}`:job.reportId?`Report ${job.reportId}`:'正式 PrintJob'}</small></div><span>{stateLabel[job.transportState]}</span></header>
        <dl><div><dt>Job</dt><dd>{job.canonicalPrintJobId}</dd></div><div><dt>Printer / Route</dt><dd>{job.physicalBindingId??job.logicalDestinationId}</dd></div><div><dt>Time</dt><dd>{job.createdAt}</dd></div><div><dt>Code</dt><dd>{job.lastCode??'—'}</dd></div></dl>
        <p>{job.attention.safeAction}</p>
        {job.transportState==='FAILED_BEFORE_SEND'?<button type="button" onClick={()=>void retry(job.canonicalPrintJobId)}>正式安全重試</button>:null}
        {job.transportState==='AMBIGUOUS_AFTER_SEND'?<strong>無普通 Retry；人工檢查後如需要，請由 Order Detail 建立「重印」。</strong>:null}
      </article>)}{!readback.jobs.length?<p className="mfp-print-empty">未有 canonical PrintJob。</p>:null}</div></section>
    </div>
    {status?<output className="mfp-operation-status" aria-live="polite">{status}</output>:null}
  </section>;
}

function sourceJobs(jobs:readonly MfpCanonicalPrintJob[]){return jobs.filter(job=>job.purpose!=='REPRINT'&&job.canonicalState!=='CANCELLED');}

export function MfpOrderPrintPanel({surface,orderId,context,session,onClose}:{
  surface:MfpOrderingSurface;orderId:string;context:'ORDER_REPRINT'|'DINING';session:MfpPrintHardwareSession;onClose:()=>void;
}){
  const [reason,setReason]=useState('人手確認重印');
  const [route,setRoute]=useState('');
  const [selectedLabels,setSelectedLabels]=useState<readonly string[]>([]);
  const [status,setStatus]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const readback=useQuery({queryKey:['mfp','print-hardware','order',orderId],queryFn:session.read,refetchInterval:false,retry:false});
  const jobs=sourceJobs(readback.data?.jobs.filter(job=>job.orderId===orderId)??[]);
  const whole=jobs.filter((job):job is MfpCanonicalPrintJob&{jobType:'RECEIPT'|'PRODUCTION'|'PACKING'|'TABLE_TICKET'}=>['RECEIPT','PRODUCTION','PACKING','TABLE_TICKET'].includes(job.jobType));
  const labelJobs=jobs.filter(job=>job.labelUnit);
  const routes=[...new Set(labelJobs.map(job=>job.logicalDestinationId))];
  const routeJobs=labelJobs.filter(job=>job.logicalDestinationId===route);
  const perform=async(selection:Parameters<MfpPrintHardwareSession['requestReprint']>[0]['selection'])=>{
    setSubmitting(true);setStatus('正在建立正式重印 identity…');
    try{
      await session.requestReprint({requestId:`MFP-A7-REPRINT-${crypto.randomUUID()}`,orderId,reason:reason.trim(),humanConfirmed:true,selection});
      setStatus('SOURCE_VERIFIED · 新重印 PrintJob 已提交；Order / Payment / Fulfillment 無改動');
      await readback.refetch();
    }catch(error){setStatus(`BLOCKED · ${message(error)}`);}finally{setSubmitting(false);}
  };
  const dispatch=async(jobId:string)=>{
    setSubmitting(true);setStatus('正在執行既有 canonical PrintJob…');
    try{await session.dispatchCanonical(jobId);setStatus('SOURCE_VERIFIED · 已提交 gateway；只代表 transport evidence');await readback.refetch();}
    catch(error){setStatus(`BLOCKED · ${message(error)}`);}finally{setSubmitting(false);}
  };
  return <div className="mfp-operation-layer"><section className={`mfp-print-dialog ${surface==='MFP_MOBILE'?'mobile':''}`} role="dialog" aria-modal="true" aria-labelledby="mfp-print-dialog-title">
    <header><div><small>{context==='DINING'?'Dining Print':'Order Detail → Reprint'}</small><h2 id="mfp-print-dialog-title">{context==='DINING'?'堂食打印 / 重印':'重印'}</h2></div><button type="button" aria-label="關閉" onClick={onClose}>×</button></header>
    {readback.isPending?<p aria-busy="true">正在讀取 canonical PrintJob…</p>:null}
    {readback.error?<p role="alert">BLOCKED · {message(readback.error)}</p>:null}
    {context==='DINING'?<section><h3>正式待執行輸出</h3><p>Table Ticket 可以未付款打印；Printed ≠ Paid ≠ Completed。</p>{jobs.filter(job=>job.transportState==='NOT_STARTED').map(job=><button key={job.canonicalPrintJobId} type="button" disabled={submitting} onClick={()=>void dispatch(job.canonicalPrintJobId)}>打印 {job.jobType}</button>)}</section>:null}
    <label>重印原因<input value={reason} maxLength={120} onChange={event=>setReason(event.target.value)}/></label>
    <section><h3>80mm · Whole Ticket Reprint</h3><p>Receipt / Production / Packing 只會成張重印。</p><div className="mfp-reprint-ticket-actions">{whole.map(job=><button key={job.canonicalPrintJobId} type="button" disabled={submitting||!reason.trim()} onClick={()=>void perform({kind:'WHOLE_TICKET',sourcePrintJobId:job.canonicalPrintJobId,jobType:job.jobType})}>{job.jobType}</button>)}</div></section>
    <section><h3>Labels · Partial Reprint</h3><label>Label Route<select value={route} onChange={event=>{setRoute(event.target.value);setSelectedLabels([]);}}><option value="">選擇 route</option>{routes.map(value=><option key={value} value={value}>{value}</option>)}</select></label>{route?<><button type="button" onClick={()=>setSelectedLabels(routeJobs.map(job=>job.labelUnit!.labelId))}>All Select</button><div className="mfp-reprint-labels">{routeJobs.map(job=><label key={job.labelUnit!.labelId}><input type="checkbox" checked={selectedLabels.includes(job.labelUnit!.labelId)} onChange={event=>setSelectedLabels(values=>event.target.checked?[...values,job.labelUnit!.labelId]:values.filter(value=>value!==job.labelUnit!.labelId))}/><span>Label {job.labelUnit!.index} / {job.labelUnit!.total}</span></label>)}</div><button type="button" disabled={submitting||!reason.trim()||!selectedLabels.length} onClick={()=>{const selected=selectMfpLabelJobs(routeJobs,route,selectedLabels);void perform({kind:'LABELS',routeId:route,sourcePrintJobIds:selected.map(job=>job.canonicalPrintJobId),labelIds:selectedLabels});}}>重印已選 {selectedLabels.length} 張</button></>:null}</section>
    <p className="mfp-print-guard">新 reprint identity · 不重新收款 · 不改 Order · 不進 Fulfillment · 不開 Cash Drawer</p>
    {status?<output aria-live="polite">{status}</output>:null}
  </section></div>;
}

export function MfpCancelNoticeAction({orderId,session}:{orderId:string;session:MfpPrintHardwareSession}){
  const [status,setStatus]=useState('');
  const submit=async()=>{try{await session.ensureCancelNotice(orderId,`MFP-A7-CANCEL-${crypto.randomUUID()}`);setStatus('SOURCE_VERIFIED · 已建立或觀察一張正式 Cancel Notice');}catch(error){setStatus(`BLOCKED · ${message(error)}`);}};
  return <div className="mfp-cancel-print"><button type="button" onClick={()=>void submit()}>建立 / 查核取消通知單</button>{status?<output aria-live="polite">{status}</output>:null}</div>;
}
