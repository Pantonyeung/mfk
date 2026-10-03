import {useEffect,useId,useMemo,useRef,useState,useSyncExternalStore,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import QRCode from 'qrcode';

import {
  buildMfpWhatsAppContact,
  canAutoAcceptMfpKeeta,
  cancelMfpCustomerPending,
  createMfpCustomerChannelControlSession,
  createMfpCustomerConfirmationSession,
  createMfpExternalAdmissionSession,
  createMfpExternalCoordinator,
  createMfpKeetaAfterSaleRefundSession,
  createMfpKeetaLifecycleSession,
  decideMfpKeetaAfterSale,
  deferMfpKeetaIntent,
  proposeMfpCustomerModification,
  reviewMfpCustomerEvidence,
  type MfpCustomerExternalIntent,
  type MfpExternalAdapter,
  type MfpExternalAdapterAction,
  type MfpExternalIntent,
  type MfpExternalReadModel,
  type MfpExternalTransport,
  type MfpKeetaAfterSaleCase,
  type MfpKeetaExternalIntent,
  type MfpPaymentEvidenceReview,
} from './external-domain.ts';
import type {MfpOrderOperationsReadPort} from './order-operations-domain.ts';
import {MfpUnavailableState} from './operator-ui.tsx';
import type {MfpOrderingSurface} from './ordering-domain.ts';
import type {MfpSecurityPort} from './security-port.ts';

type ExternalAuthority=MfpOrderOperationsReadPort&Required<Pick<MfpOrderOperationsReadPort,'readOperations'>>;

export interface MfpExternalProviderBinding{
  readonly transport:MfpExternalTransport;
  readonly adapter:MfpExternalAdapter;
}

const unavailable=()=>Promise.reject(new Error('MFP_EXTERNAL_BINDING_UNAVAILABLE'));
export const mfpExternalRuntimeBinding:MfpExternalProviderBinding=Object.freeze({
  transport:Object.freeze({readExternal:unavailable,connectDoorbell(){return()=>{};}}),
  adapter:Object.freeze({submitExternalAction:unavailable}),
});

export interface MfpExternalUiActions{
  readonly onAccept:(intent:MfpExternalIntent)=>unknown;
  readonly onReviewEvidence:(intent:MfpCustomerExternalIntent,state:Exclude<MfpPaymentEvidenceReview,'NOT_REQUIRED'|'UNREVIEWED'>)=>unknown;
  readonly onModify:(intent:MfpCustomerExternalIntent,proposal:string)=>unknown;
  readonly onCancel:(intent:MfpCustomerExternalIntent,reason:string)=>unknown;
  readonly onDefer:(intent:MfpKeetaExternalIntent)=>unknown;
  readonly onRefresh:()=>unknown;
  readonly onSetCustomerControl:(mode:'OPEN'|'SPECIAL_CUTOFF'|'IMMEDIATE_STOP',cutoffAt:string|null)=>unknown;
  readonly onAfterSaleDecision:(value:MfpKeetaAfterSaleCase,decision:'APPROVE'|'REJECT')=>unknown;
  readonly onApplyAfterSaleRefund:(value:MfpKeetaAfterSaleCase)=>unknown;
  readonly onOpen?:(intent:MfpExternalIntent)=>unknown;
}

const money=(minor:number|null)=>minor===null?'待確認':new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'}).format(minor/100);
const intentKey=(intent:MfpExternalIntent)=>intent.kind==='CUSTOMER'?`CUSTOMER:${intent.submissionId}:${intent.idempotencyKey}`:`KEETA:${intent.providerShopId}:${intent.providerOrderId}:${intent.fingerprint}`;
const actionStatus=(label:string,value:unknown)=>{
  const state=value&&typeof value==='object'&&'state' in value?String(value.state):'UNKNOWN';
  if(state==='COMMITTED')return `SOURCE_VERIFIED · ${label} · canonical readback confirmed`;
  if(state==='ACKNOWLEDGED')return `SOURCE_VERIFIED · ${label} · adapter acknowledged`;
  if(state==='REJECTED')return `REJECTED · ${label}`;
  if(state==='ATTENTION')return `ATTENTION · ${label}`;
  return `UNKNOWN · ${label} · canonical readback required`;
};

function ExternalCard({intent,onOpen}:{intent:MfpExternalIntent;onOpen?:(intent:MfpExternalIntent)=>unknown}){
  const title=intent.kind==='CUSTOMER'?intent.customerDisplayName:intent.providerOrderId;
  const amount=intent.kind==='CUSTOMER'?intent.previewAmountMinor:intent.amountMinor;
  const detail=intent.kind==='CUSTOMER'?`${intent.paymentMethod} · ${intent.evidenceReview}`:`${intent.acceptanceMode} · ${intent.mappingState}`;
  return <button type="button" className={`mfp-external-card ${intent.attentionCode?'attention':''}`} onClick={()=>onOpen?.(intent)}>
    <span>{intent.kind==='CUSTOMER'?'Customer':'Keeta'}</span><strong>{title}</strong><b>{intent.itemCount} 件 · {money(amount)}</b><small>{detail}</small>{intent.attentionCode?<em>{intent.attentionCode}</em>:null}
  </button>;
}

export function MfpExternalInbox({surface,model,actions}:{surface:MfpOrderingSurface;model:MfpExternalReadModel;actions:MfpExternalUiActions}){
  const mobile=surface==='MFP_MOBILE';
  const [cutoff,setCutoff]=useState('');
  const intents=[...model.customer.intents,...model.keeta.intents];
  return <section className={mobile?'mfp-external-mobile-inbox':'mfp-external-pad-strip'} data-external-surface={surface} aria-label="External pending inbox">
    <header><div><b>待處理訂單</b><small>canonical read model · {model.revision}</small></div><button type="button" onClick={()=>actions.onRefresh()}>重新讀取</button><details><summary>網上接單設定</summary><label>截單時間<input type="datetime-local" value={cutoff} onChange={event=>setCutoff(event.target.value)}/></label><button type="button" onClick={()=>actions.onSetCustomerControl('OPEN',null)}>開放接單</button><button type="button" disabled={!cutoff} onClick={()=>actions.onSetCustomerControl('SPECIAL_CUTOFF',new Date(cutoff).toISOString())}>設定截單時間</button><button type="button" onClick={()=>actions.onSetCustomerControl('IMMEDIATE_STOP',null)}>即時暫停接單</button></details></header>
    {model.customer.acceptance.mode!=='OPEN'?<aside><b>{model.customer.acceptance.mode}</b><span>{model.customer.acceptance.message||'Customer 暫停接新單'}</span><small>只影響新 Customer 單 · WhatsApp fallback</small></aside>:null}
    <div className="mfp-external-cards">{intents.length?intents.map(intent=><ExternalCard key={intentKey(intent)} intent={intent} onOpen={actions.onOpen}/>):<small role="status">暫時未有待處理訂單</small>}</div>
  </section>;
}

function CustomerReview({intent,model,actions}:{intent:MfpCustomerExternalIntent;model:MfpExternalReadModel;actions:MfpExternalUiActions}){
  const [proposal,setProposal]=useState('');
  const [zoomed,setZoomed]=useState(false);
  const [qr,setQr]=useState('');
  const contact=useMemo(()=>buildMfpWhatsAppContact(intent,'ORDER_FALLBACK'),[intent]);
  useEffect(()=>{let active=true;void QRCode.toDataURL(contact.url,{errorCorrectionLevel:'M',margin:1,width:240}).then(value=>{if(active)setQr(value);});return()=>{active=false;};},[contact.url]);
  const acceptDisabled=intent.canonicalOrderId!==null||intent.status==='CANCELLED'||(intent.paymentMethod==='ELECTRONIC'&&(intent.evidenceReview!=='VERIFIED'||!intent.paymentEvidenceRef));
  return <>
    <div className="mfp-external-review-grid">
      <section><h3>{intent.customerDisplayName}</h3><p>{intent.itemCount} 件 · {money(intent.previewAmountMinor)} · {intent.serviceMode}</p>{intent.items.map(item=><div className="mfp-external-line" key={item.lineId}><span>{item.name}</span><b>× {item.quantity}</b></div>)}</section>
      <section data-payment-truth="STORE_KERNEL_ONLY"><h3>Payment / Evidence</h3><p>{intent.paymentMethod} · {intent.paymentChannelId||'到店付款'}</p><strong>{intent.evidenceReview}</strong><small>EVIDENCE ≠ PAYMENT TRUTH</small>
        {intent.paymentEvidenceRef?<><img className="mfp-evidence-thumb" src={intent.paymentEvidenceRef} alt="Customer payment evidence"/><button type="button" onClick={()=>setZoomed(true)}>放大檢視</button></>:null}
        {intent.paymentMethod==='ELECTRONIC'?<div className="mfp-evidence-actions">{(['VERIFIED','REJECTED','NEEDS_RESUBMISSION'] as const).map(state=><button type="button" key={state} onClick={()=>actions.onReviewEvidence(intent,state)}>{state}</button>)}</div>:null}
      </section>
      <section data-whatsapp-order-writer="false"><h3>WhatsApp QR / Contact</h3>{qr?<img className="mfp-whatsapp-qr" src={qr} alt="WhatsApp contact QR code"/>:<span>正在產生 QR…</span>}<a href={contact.url} target="_blank" rel="noreferrer">WhatsApp fallback</a><small>communication only · 唔係 Order writer</small></section>
      <section><h3>Customer modification confirmation</h3>{model.customer.confirmations.length?model.customer.confirmations.map(item=><article key={item.confirmationId}><b>{item.confirmationId}</b><span>{item.state}</span><small>{item.state==='UNKNOWN'?'等候客人確認':'已收到客人決定'}</small></article>):<small>未有待確認修改</small>}</section>
    </div>
    <label className="mfp-external-modify">Modify<textarea value={proposal} onChange={event=>setProposal(event.target.value)} placeholder="輸入建議修改"/><button type="button" disabled={!proposal.trim()} onClick={()=>actions.onModify(intent,proposal)}>Send modification</button></label>
    <footer><button type="button" className="danger" disabled={intent.canonicalOrderId!==null} onClick={()=>actions.onCancel(intent,'STAFF_CANCELLED_PENDING')}>Cancel</button><button type="button" className="primary" disabled={acceptDisabled} onClick={()=>actions.onAccept(intent)}>Accept</button></footer>
    {zoomed&&intent.paymentEvidenceRef?<div className="mfp-evidence-zoom" role="dialog" aria-modal="true" aria-label="Payment evidence zoom" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setZoomed(false);}}}><button type="button" autoFocus onClick={()=>setZoomed(false)}>關閉</button><img src={intent.paymentEvidenceRef} alt="Customer payment evidence enlarged"/></div>:null}
  </>;
}

function KeetaReview({intent,model,actions}:{intent:MfpKeetaExternalIntent;model:MfpExternalReadModel;actions:MfpExternalUiActions}){
  const immediateDisabled=intent.canonicalOrderId!==null||!['PENDING','ATTENTION'].includes(intent.status)||intent.mappingState!=='VALID'||intent.mappingRevision===null||!intent.providerFactsValid;
  const lifecycle=model.keeta.lifecycleEvents.filter(event=>event.providerOrderId===intent.providerOrderId);
  const afterSales=model.keeta.afterSales.filter(item=>item.providerOrderId===intent.providerOrderId);
  return <>
    <div className="mfp-external-review-grid">
      <section><h3>Keeta {intent.providerOrderId}</h3><p>{intent.itemCount} 件 · {money(intent.amountMinor)}</p><small>message {intent.providerMessageId} · fingerprint {intent.fingerprint}</small>{intent.items.map(item=><div className="mfp-external-line" key={item.providerLineId}><span>{item.providerName} → {item.mappedName||'ATTENTION'}</span><b>× {item.quantity}</b></div>)}</section>
      <section><h3>Mapping / Admission</h3><strong>{intent.mappingState}</strong><span>{intent.acceptanceMode}</span>{intent.attentionCode?<em>{intent.attentionCode}</em>:null}<small>received {intent.receivedAt}</small><small>defer {intent.deferCount} / 2 · Later ≠ Reject ≠ Cancel ≠ Accept</small></section>
      <section><h3>Lifecycle</h3>{lifecycle.length?lifecycle.map(event=><article key={`${event.providerMessageId}:${event.fingerprint}`}><b>{event.eventCode}</b><span>{event.state}</span><small>{event.attentionCode||event.providerMessageId}</small></article>):<small>未有 lifecycle event</small>}</section>
      <section data-provider-decision="NOT_LOCAL_REFUND_TRUTH"><h3>After-sale</h3><small>provider decision ≠ local refund truth</small>{afterSales.length?afterSales.map(item=><article key={item.afterSaleOrderId}><b>{item.afterSaleOrderId}</b><span>{item.providerStatus} · {money(item.requestedRefundMinor)}</span><div>{item.state==='APPROVED'?<button type="button" onClick={()=>actions.onApplyAfterSaleRefund(item)}>Apply formal partial refund</button>:<><button type="button" onClick={()=>actions.onAfterSaleDecision(item,'APPROVE')}>APPROVE</button><button type="button" onClick={()=>actions.onAfterSaleDecision(item,'REJECT')}>REJECT</button></>}</div>{item.state==='APPROVED'?<small>A6 / A5 canonical refund · same Order</small>:null}</article>):<small>未有 after-sale request</small>}</section>
    </div>
    <footer><button type="button" disabled={intent.deferCount>=2||intent.canonicalOrderId!==null} onClick={()=>actions.onDefer(intent)}>Later</button><button type="button" className="primary" disabled={immediateDisabled} onClick={()=>actions.onAccept(intent)}>Immediate</button></footer>
  </>;
}

export function MfpExternalReviewPanel({intent,model,actions,onClose}:{intent:MfpExternalIntent;model:MfpExternalReadModel;actions:MfpExternalUiActions;onClose:()=>void}){
  const titleId=useId();const panelRef=useRef<HTMLElement>(null);const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;closeRef.current?.focus();return()=>previous?.focus();},[]);
  const keyDown=(event:ReactKeyboardEvent)=>{
    if(event.key==='Escape'){event.preventDefault();onClose();return;}
    if(event.key!=='Tab'||!panelRef.current)return;
    const focusable=[...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),summary')];
    const first=focusable[0];const last=focusable.at(-1);if(!first||!last)return;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  return <div className="mfp-external-review-layer" onKeyDown={keyDown}><section ref={panelRef} className="mfp-external-review" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <header><div><small>{intent.kind}</small><h2 id={titleId}>{intent.kind==='CUSTOMER'?intent.submissionId:intent.providerOrderId}</h2></div><button ref={closeRef} type="button" aria-label="Close" onClick={onClose}>×</button></header>
    {intent.kind==='CUSTOMER'?<CustomerReview intent={intent} model={model} actions={actions}/>:<KeetaReview intent={intent} model={model} actions={actions}/>}
  </section></div>;
}

interface ExternalCoordinatorLifecycle{
  startup():Promise<unknown>;
  networkOnline():Promise<unknown>;
  networkOffline():void;
  connectDoorbell():()=>void;
}
interface ExternalEnvironment{
  readonly navigator:Readonly<{onLine:boolean}>;
  addEventListener(type:'online'|'offline',listener:()=>void):void;
  removeEventListener(type:'online'|'offline',listener:()=>void):void;
}

export function startMfpExternalLifecycle(coordinator:ExternalCoordinatorLifecycle,environment:ExternalEnvironment=window){
  const online=()=>{void coordinator.networkOnline().catch(()=>{});};
  const offline=()=>coordinator.networkOffline();
  environment.addEventListener('online',online);environment.addEventListener('offline',offline);
  const disconnect=coordinator.connectDoorbell();
  if(environment.navigator.onLine)void coordinator.startup().catch(()=>{});else coordinator.networkOffline();
  return()=>{environment.removeEventListener('online',online);environment.removeEventListener('offline',offline);disconnect();};
}

export function MfpExternalRuntime({surface,security,authority,binding=mfpExternalRuntimeBinding,onCheckConnection}:{surface:MfpOrderingSurface;security:MfpSecurityPort;authority:ExternalAuthority;binding?:MfpExternalProviderBinding;onCheckConnection?:()=>void}){
  const adapter=useMemo<MfpExternalAdapter>(()=>Object.freeze({submitExternalAction(action:MfpExternalAdapterAction){security.precheckFrontlineAction();return binding.adapter.submitExternalAction(action);}}),[binding.adapter,security]);
  const coordinatorRef=useRef<ReturnType<typeof createMfpExternalCoordinator>|null>(null);
  if(!coordinatorRef.current)coordinatorRef.current=createMfpExternalCoordinator({transport:binding.transport});
  const coordinator=coordinatorRef.current;
  const snapshot=useSyncExternalStore(coordinator.subscribe,coordinator.getSnapshot,coordinator.getSnapshot);
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [status,setStatus]=useState('');
  const admissionSessions=useRef(new Map<string,ReturnType<typeof createMfpExternalAdmissionSession>>());
  const lifecycleSessions=useRef(new Map<string,ReturnType<typeof createMfpKeetaLifecycleSession>>());
  const confirmationSessions=useRef(new Map<string,ReturnType<typeof createMfpCustomerConfirmationSession>>());
  const refundTasks=useRef(new Map<string,Promise<unknown>>());
  const automaticStarted=useRef(new Set<string>());

  useEffect(()=>startMfpExternalLifecycle(coordinator),[coordinator]);
  const run=async(label:string,work:()=>Promise<unknown>)=>{
    setStatus(`${label} · 處理中`);
    try{
      const result=await work();const next=actionStatus(label,result);setStatus(next);
      try{await coordinator.manualRefresh();}catch{setStatus(`${next} · external refresh ATTENTION`);}
    }catch(error){setStatus(`ATTENTION · ${error instanceof Error?error.message:'MFP_EXTERNAL_ACTION_FAILED'}`);}
  };
  const sessionFor=(intent:MfpExternalIntent)=>{
    const key=intentKey(intent);let session=admissionSessions.current.get(key);
    if(!session){session=createMfpExternalAdmissionSession({intent,security,authority,adapter});admissionSessions.current.set(key,session);}
    return session;
  };
  const applyAfterSaleRefund=(value:MfpKeetaAfterSaleCase)=>{
    const existing=refundTasks.current.get(value.afterSaleOrderId);if(existing)return existing;
    const task=(async()=>{
      const order=await authority.readOrder(value.canonicalOrderId);if(!order)throw new Error('MFP_KEETA_AFTER_SALE_CANONICAL_ORDER_REQUIRED');
      return createMfpKeetaAfterSaleRefundSession({case:value,order,amountMinor:value.requestedRefundMinor,refundTenderId:order.effectiveTenderId,lineUnits:value.lineUnits,security,authority}).submit();
    })().catch(error=>{refundTasks.current.delete(value.afterSaleOrderId);throw error;});
    refundTasks.current.set(value.afterSaleOrderId,task);return task;
  };

  const model=snapshot.model;
  useEffect(()=>{
    if(!model)return;
    for(const intent of model.keeta.intents)if(canAutoAcceptMfpKeeta(intent)){
      const key=`AUTO:${intentKey(intent)}:${intent.revision}`;if(automaticStarted.current.has(key))continue;automaticStarted.current.add(key);
      void run('Keeta AUTO',()=>sessionFor(intent).accept());
    }
    for(const event of model.keeta.lifecycleEvents){
      if(!event.canonicalOrderId||event.state==='LINKED')continue;
      const key=`LIFECYCLE:${event.providerMessageId}:${event.fingerprint}`;if(automaticStarted.current.has(key))continue;automaticStarted.current.add(key);let session=lifecycleSessions.current.get(key);
      if(!session){session=createMfpKeetaLifecycleSession({event,security,authority,adapter});lifecycleSessions.current.set(key,session);}
      void run('Keeta lifecycle',()=>session!.apply());
    }
    for(const confirmation of model.customer.confirmations){
      if(confirmation.state==='UNKNOWN')continue;
      const key=`CONFIRMATION:${confirmation.confirmationId}:${confirmation.state}:${confirmation.expectedRevision}`;if(automaticStarted.current.has(key))continue;automaticStarted.current.add(key);
      let session=confirmationSessions.current.get(confirmation.confirmationId);
      if(!session){session=createMfpCustomerConfirmationSession({confirmation,security,authority});confirmationSessions.current.set(confirmation.confirmationId,session);}
      void run('Customer confirmation',()=>session!.submit());
    }
  },[model]);

  if(!model)return <section className="mfp-external-runtime" data-external-state={snapshot.state}><MfpUnavailableState title="待處理訂單尚未接駁" description="未能取得網上及 Keeta 訂單。連線恢復後先會顯示真實待處理訂單。" code={snapshot.lastError??undefined} onRetry={()=>void coordinator.manualRefresh().catch(()=>{})} onCheckConnection={onCheckConnection}/></section>;
  const selected=[...model.customer.intents,...model.keeta.intents].find(intent=>intentKey(intent)===selectedKey)||null;
  const actions:MfpExternalUiActions={
    onOpen:intent=>setSelectedKey(intentKey(intent)),
    onAccept:intent=>run(intent.kind==='CUSTOMER'?'Customer Accept':'Keeta Immediate',()=>sessionFor(intent).accept()),
    onReviewEvidence:(intent,state)=>run('Evidence review',()=>reviewMfpCustomerEvidence(adapter,intent,state)),
    onModify:(intent,proposal)=>run('Customer Modify',()=>proposeMfpCustomerModification(adapter,intent,proposal)),
    onCancel:(intent,reason)=>run('Customer Cancel',()=>cancelMfpCustomerPending(adapter,intent,reason)),
    onDefer:intent=>run('Keeta Later',()=>deferMfpKeetaIntent(adapter,intent,new Date().toISOString())),
    onRefresh:()=>{security.precheckFrontlineAction();return coordinator.manualRefresh();},
    onSetCustomerControl:(mode,cutoffAt)=>run('Customer control',()=>createMfpCustomerChannelControlSession({commandId:`MFP-A8-CUSTOMER-CONTROL-${crypto.randomUUID()}`,expectedRevision:model.customer.acceptance.revision,mode,cutoffAt,message:null,security,adapter}).submit()),
    onAfterSaleDecision:(value,decision)=>run('Keeta after-sale',()=>decideMfpKeetaAfterSale(adapter,value,decision)),
    onApplyAfterSaleRefund:value=>run('Keeta formal partial refund',()=>applyAfterSaleRefund(value)),
  };
  return <section className="mfp-external-runtime" data-external-state={snapshot.state}>
    <MfpExternalInbox surface={surface} model={model} actions={actions}/>{status?<output role="status" aria-live="polite">{status}</output>:null}
    {selected?<MfpExternalReviewPanel intent={selected} model={model} actions={actions} onClose={()=>setSelectedKey(null)}/>:null}
  </section>;
}
