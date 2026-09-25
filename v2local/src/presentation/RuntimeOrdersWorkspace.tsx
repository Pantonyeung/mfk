import {useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router';
import type {CleanSmtCoreRuntimePort,SmtOrdersProjection,SmtReprintOption} from '../runtime/local-runtime.ts';
import {hasStaffPermission} from '../runtime/staff-auth.ts';
import {readSmtQuickReasons,readSmtStoreSettings} from '../runtime/admin-operational-config.ts';
import {subscribeSmtAdminConfig} from '../runtime/admin-config-sync.ts';
import {decideKeetaAfterSale,previewKeetaPartialRefund,readKeetaAfterSales,type KeetaAfterSaleCase} from '../runtime/keeta-after-sale.ts';
import {readKeetaOrderIntakeAttention,reconcileKeetaOrderIntake} from '../runtime/keeta-order-intake.ts';
import {buildWhatsAppPaymentFollowup,createWhatsAppQrDataUrl,PAYMENT_FOLLOWUP_TEMPLATES,type PaymentFollowupTemplateId} from '../runtime/payment-evidence-whatsapp.ts';
import './orders-workspace.css';

type PaymentFilter='全部'|'現金'|'Alipay'|'WeChat Pay'|'FPS / PayMe';
type Modal='actions'|'edit'|'cancel'|'reprint'|null;

function sourceLane(source?:string){
  const value=String(source||'').trim();
  if(value.startsWith('現場')||value.startsWith('SMM')||value.startsWith('電話')||value.startsWith('WhatsApp'))return 'walkin';
  if(value.startsWith('自家 App')||value.startsWith('磨飯 App')||value.startsWith('Customer'))return 'app';
  return 'platform';
}
function paymentMatches(label:string,filter:PaymentFilter){
  if(filter==='全部')return true;
  const value=label.toUpperCase();
  if(filter==='現金')return value.includes('CASH');
  if(filter==='Alipay')return value.includes('ALIPAY');
  if(filter==='WeChat Pay')return value.includes('WECHAT');
  return value.includes('FPS')||value.includes('PAYME');
}

export function RuntimeOrdersWorkspace({runtime}:{runtime:CleanSmtCoreRuntimePort}){
  const canReview=hasStaffPermission('ORDER_REVIEW');
  const canCorrect=hasStaffPermission('ORDER_CORRECTION');
  const [configRevision,setConfigRevision]=useState(0);
  useEffect(()=>subscribeSmtAdminConfig(()=>setConfigRevision(value=>value+1)),[]);
  void configRevision;
  const storeSettings=readSmtStoreSettings();
  const cancelReasons=readSmtQuickReasons('CANCEL');
  const reprintReasons=readSmtQuickReasons('REPRINT');
  const [params]=useSearchParams();
  const initialOrderId=params.get('orderId')??undefined;
  const [snapshot,setSnapshot]=useState<SmtOrdersProjection|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [paymentFilter,setPaymentFilter]=useState<PaymentFilter>('全部');
  const [history,setHistory]=useState(false);
  const [modal,setModal]=useState<Modal>(null);
  const [acceptBusy,setAcceptBusy]=useState(false);
  const [readyBusy,setReadyBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [reprintOptions,setReprintOptions]=useState<readonly SmtReprintOption[]>([]);
  const [selectedJobs,setSelectedJobs]=useState<Set<string>>(new Set());
  const [reprintBusy,setReprintBusy]=useState(false);
  const [editLines,setEditLines]=useState<{id:string;name:string;qty:number;unitMinor:number}[]>([]);
  const [cancelReason,setCancelReason]=useState('');
  const [reprintReason,setReprintReason]=useState('');
  const [afterSaleRevision,setAfterSaleRevision]=useState(0);
  const [afterSaleBusy,setAfterSaleBusy]=useState<string|null>(null);
  const [partialPreview,setPartialPreview]=useState<unknown>(null);
  const [keetaPullBusy,setKeetaPullBusy]=useState(false);
  const [keetaPullMessage,setKeetaPullMessage]=useState<string|null>(null);
  const [keetaIntakeRevision,setKeetaIntakeRevision]=useState(0);
  const [keetaArrival,setKeetaArrival]=useState<{orderId:string;display:string;sourceLabel:string}|null>(null);
  const [customerArrival,setCustomerArrival]=useState<{orderId:string;display:string;sourceLabel:string}|null>(null);
  const [paymentEvidenceUrl,setPaymentEvidenceUrl]=useState<string|null>(null);
  const [paymentEvidenceBusy,setPaymentEvidenceBusy]=useState(false);
  const [paymentReviewBusy,setPaymentReviewBusy]=useState(false);
  const [paymentFollowupTemplate,setPaymentFollowupTemplate]=useState<PaymentFollowupTemplateId>('UNCLEAR');
  const [paymentFollowupQr,setPaymentFollowupQr]=useState<string|null>(null);
  const [paymentFollowupMessage,setPaymentFollowupMessage]=useState<string|null>(null);
  const [paymentFollowupBusy,setPaymentFollowupBusy]=useState(false);
  useEffect(()=>{
    const refresh=()=>setAfterSaleRevision(value=>value+1);
    window.addEventListener('mfk-keeta-after-sale',refresh);
    return()=>window.removeEventListener('mfk-keeta-after-sale',refresh);
  },[]);
  useEffect(()=>{
    const refresh=(raw:Event)=>{
      setKeetaIntakeRevision(value=>value+1);
      const detail=(raw as CustomEvent<{canonicalOrderId?:string;display?:string;sourceLabel?:string}>).detail;
      if(!detail?.canonicalOrderId)return;
      setKeetaArrival({orderId:detail.canonicalOrderId,display:String(detail.display||''),sourceLabel:String(detail.sourceLabel||'Keeta')});
      try{
        const AudioContextCtor=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(AudioContextCtor){
          const ctx=new AudioContextCtor();const osc=ctx.createOscillator();const gain=ctx.createGain();
          osc.frequency.value=880;gain.gain.value=0.12;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.22);
        }
      }catch{}
    };
    window.addEventListener('mfk-keeta-order-intake',refresh);
    return()=>window.removeEventListener('mfk-keeta-order-intake',refresh);
  },[]);  useEffect(()=>{
    const refresh=(raw:Event)=>{
      const detail=(raw as CustomEvent<{canonicalOrderId?:string;display?:string;sourceLabel?:string}>).detail;
      if(!detail?.canonicalOrderId)return;
      setCustomerArrival({orderId:detail.canonicalOrderId,display:String(detail.display||''),sourceLabel:String(detail.sourceLabel||'自家 App')});
      try{
        const AudioContextCtor=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(AudioContextCtor){
          const ctx=new AudioContextCtor();const osc=ctx.createOscillator();const gain=ctx.createGain();
          osc.frequency.value=1040;gain.gain.value=0.16;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.35);
        }
      }catch{}
    };
    window.addEventListener('mfk-customer-order-intake',refresh);
    return()=>window.removeEventListener('mfk-customer-order-intake',refresh);
  },[]);



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
  void afterSaleRevision;
  void keetaIntakeRevision;
  const keetaIntakeAttention=readKeetaOrderIntakeAttention();
  const afterSales=selected?readKeetaAfterSales(selected.orderId):[];
  const allItems=snapshot?.items??[];
  const filtered=useMemo(()=>allItems.filter(order=>{
    const state=order.fulfillmentLabel;
    const inHistory=state==='已完成'||state==='已取消';
    return (history?inHistory:!inHistory)&&paymentMatches(order.paymentLabel,paymentFilter);
  }),[allItems,history,paymentFilter]);

  const lanes=useMemo(()=>[
    {id:'walkin',label:'現場訂單',orders:filtered.filter(order=>sourceLane(order.sourceLabel)==='walkin')},
    {id:'app',label:'自家平台',orders:filtered.filter(order=>sourceLane(order.sourceLabel)==='app')},
    {id:'platform',label:'第三方平台',orders:filtered.filter(order=>sourceLane(order.sourceLabel)==='platform')},
  ] as const,[filtered]);

  const pendingKeetaOrders=useMemo(()=>allItems.filter(order=>String(order.sourceLabel||'').startsWith('Keeta')&&order.fulfillmentLabel==='待處理'),[allItems]);

  const paymentCounts=useMemo(()=>{
    const base=allItems.filter(order=>history?(order.fulfillmentLabel==='已完成'||order.fulfillmentLabel==='已取消'):(order.fulfillmentLabel!=='已完成'&&order.fulfillmentLabel!=='已取消'));
    const count=(filter:PaymentFilter)=>base.filter(order=>paymentMatches(order.paymentLabel,filter)).length;
    return new Map<PaymentFilter,number>([
      ['全部',base.length],['現金',count('現金')],['Alipay',count('Alipay')],
      ['WeChat Pay',count('WeChat Pay')],['FPS / PayMe',count('FPS / PayMe')]
    ]);
  },[allItems,history]);

  useEffect(()=>{
    setModal(null);setMessage(null);setReprintOptions([]);setSelectedJobs(new Set());setCancelReason('');setReprintReason('');setPaymentFollowupQr(null);setPaymentFollowupMessage(null);setPaymentFollowupTemplate('UNCLEAR');
    if(selected)setEditLines(selected.lines.map(line=>({
      id:line.id,name:line.name,qty:line.quantity,
      unitMinor:Math.round(Number(line.unitLabel.replace(/[^0-9.]/g,''))*100)
    })));
  },[snapshot?.selectedOrderId]);

  const openPaymentEvidence=async()=>{
    if(!selected?.paymentEvidenceRef||!runtime.readPaymentEvidence||paymentEvidenceBusy)return;
    setPaymentEvidenceBusy(true);setMessage(null);
    try{
      if(paymentEvidenceUrl)URL.revokeObjectURL(paymentEvidenceUrl);
      const result=await runtime.readPaymentEvidence(selected.orderId);
      setPaymentEvidenceUrl(result.objectUrl);
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'付款截圖讀取失敗');
    }finally{setPaymentEvidenceBusy(false);}
  };
  const reviewPaymentEvidence=async(decision:'VERIFIED'|'REJECTED')=>{
    if(!selected?.paymentEvidenceRef||!runtime.reviewPaymentEvidence||paymentReviewBusy)return;
    setPaymentReviewBusy(true);setMessage(null);
    try{
      await runtime.reviewPaymentEvidence(selected.orderId,decision);
      await load(selected.orderId,true);
      setMessage(decision==='VERIFIED'?'付款截圖已核對，可以接受訂單。':'付款截圖未通過；訂單保持待處理，請再聯絡客人或取消。');
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'付款核對失敗');
    }finally{setPaymentReviewBusy(false);}
  };

  const buildPaymentFollowupQr=async()=>{
    if(!selected?.customerPhone||paymentFollowupBusy)return;
    setPaymentFollowupBusy(true);setMessage(null);
    try{
      const followup=buildWhatsAppPaymentFollowup({
        phone:selected.customerPhone,
        display:selected.orderIdLabel,
        totalLabel:selected.totalLabel,
        templateId:paymentFollowupTemplate,
      });
      setPaymentFollowupMessage(followup.message);
      setPaymentFollowupQr(await createWhatsAppQrDataUrl(followup.url));
    }catch(cause){
      setPaymentFollowupQr(null);setPaymentFollowupMessage(null);
      setMessage(cause instanceof Error&&cause.message==='CUSTOMER_WHATSAPP_PHONE_INVALID'
        ?'客人電話格式唔適合建立 WhatsApp QR。'
        :cause instanceof Error?cause.message:'未能建立 WhatsApp QR');
    }finally{setPaymentFollowupBusy(false);}
  };

  const acceptSelected=async()=>{
    if(!selected||!runtime.acceptOrder||acceptBusy)return;
    setAcceptBusy(true);setMessage(null);
    try{
      const result=await runtime.acceptOrder(selected.orderId);
      await load(selected.orderId,true);
      const isKeeta=String(selected.sourceLabel||'').startsWith('Keeta');
      setMessage(isKeeta
        ?(result.provider.state==='ATTENTION'?'本地已接單；Keeta confirm 需要處理：'+(result.provider.code??'UNKNOWN'):'已接單；Keeta confirm 已同步')
        :'已接受訂單；狀態已進入製作中。');
    }catch(cause){setMessage(cause instanceof Error?cause.message:'未能接單');}
    finally{setAcceptBusy(false);}
  };
  const pullKeetaOrders=async()=>{
    if(keetaPullBusy)return;
    setKeetaPullBusy(true);setKeetaPullMessage(null);
    try{
      await reconcileKeetaOrderIntake();
      await load(snapshot?.selectedOrderId,true);
      const attention=readKeetaOrderIntakeAttention();
      setKeetaPullMessage(attention.length
        ?'Keeta 接單異常：'+attention.map(row=>String((row as {code?:unknown}).code??'UNKNOWN')).join('；')
        :'已手動檢查 Keeta 新單；目前冇待處理錯誤。');
    }catch(cause){
      setKeetaPullMessage(cause instanceof Error?cause.message:'KEETA_ORDER_PULL_FAILED');
    }finally{setKeetaPullBusy(false);}
  };
  const markReady=async()=>{
    if(!selected||!runtime.markOrderReady||readyBusy)return;
    setReadyBusy(true);setMessage(null);
    try{
      const result=await runtime.markOrderReady(selected.orderId);
      await load(selected.orderId,true);
      setMessage(result.provider.state==='ATTENTION'
        ?'本地已標記可取餐；Keeta READY 需要處理：'+(result.provider.code??'UNKNOWN')
        :'已標記可取餐；Keeta READY 已同步');
    }
    catch(cause){setMessage(cause instanceof Error?cause.message:'未能標記可取餐');}
    finally{setReadyBusy(false);}
  };

  const openReprint=async()=>{
    if(!selected||!runtime.readOrderReprintOptions)return;
    try{
      const options=await runtime.readOrderReprintOptions(selected.orderId);
      setReprintOptions(options);setSelectedJobs(new Set());setModal('reprint');
    }catch(cause){setMessage(cause instanceof Error?cause.message:'REPRINT_OPTIONS_FAILED');}
  };

  const runReprint=async()=>{
    if(!selected||!runtime.reprintOrderJobs||!selectedJobs.size||reprintBusy)return;
    setReprintBusy(true);setMessage(null);
    try{
      const result=await runtime.reprintOrderJobs(selected.orderId,[...selectedJobs],reprintReason.trim()||undefined);
      setMessage(result.failed===0?'重印已送出 '+result.sent+'/'+result.planned:'重印部分失敗 '+result.sent+'/'+result.planned);
      setModal(null);
    }catch(cause){setMessage(cause instanceof Error?cause.message:'REPRINT_FAILED');}
    finally{setReprintBusy(false);}
  };

  const saveEdit=async()=>{
    if(!canCorrect){setMessage('你冇訂單更正權限。');return;}
    if(!selected||!runtime.updateOrderItems)return;
    try{
      await runtime.updateOrderItems(selected.orderId,editLines);
      await load(selected.orderId,true);setMessage('修改已保存；同一訂單編號，未自動重印。');setModal(null);
    }catch(cause){setMessage(cause instanceof Error?cause.message:'ORDER_EDIT_FAILED');}
  };

  const cancelSelected=async()=>{
    if(!canCorrect){setMessage('你冇訂單更正權限。');return;}
    if(!selected||!runtime.cancelOrder)return;
    try{
      await runtime.cancelOrder(selected.orderId,cancelReason.trim()||undefined);
      await load(undefined,true);setMessage('訂單已取消；冇自動退款、重印或開錢箱。');setModal(null);
    }catch(cause){setMessage(cause instanceof Error?cause.message:'ORDER_CANCEL_FAILED');}
  };

  const decideRefund=async(row:KeetaAfterSaleCase,decision:'APPROVE'|'REJECT')=>{
    if(!canCorrect||afterSaleBusy)return;
    let reason:string|undefined;
    if(decision==='REJECT'){
      const input=window.prompt('請輸入拒絕退款原因');
      if(input===null)return;
      reason=input.trim();
      if(!reason){setMessage('拒絕退款需要原因。');return;}
    }
    setAfterSaleBusy(row.afterSaleOrderId);setMessage(null);
    try{
      await decideKeetaAfterSale(row.afterSaleOrderId,decision,decision==='REJECT'?100000:undefined,reason);
      setAfterSaleRevision(value=>value+1);
      setMessage(decision==='APPROVE'?'已送出 Keeta 同意退款決定':'已送出 Keeta 拒絕退款決定');
    }catch(cause){setMessage(cause instanceof Error?cause.message:'KEETA_REFUND_DECISION_FAILED');}
    finally{setAfterSaleBusy(null);}
  };

  const previewPartial=async()=>{
    if(!selected||afterSaleBusy)return;
    setAfterSaleBusy('PARTIAL_PREVIEW');setMessage(null);
    try{
      const result=await previewKeetaPartialRefund(selected.orderId,[]);
      setPartialPreview(result);
      setMessage('已讀取 Keeta 可部分退款項目預覽；未執行退款。');
    }catch(cause){setMessage(cause instanceof Error?cause.message:'KEETA_PARTIAL_REFUND_PREVIEW_FAILED');}
    finally{setAfterSaleBusy(null);}
  };

  const toggleJob=(jobId:string)=>setSelectedJobs(current=>{
    const next=new Set(current);if(next.has(jobId))next.delete(jobId);else next.add(jobId);return next;
  });
  const ticketReprintOptions=reprintOptions.filter(option=>option.role!=='產品標籤'&&option.role!=='袋標籤');
  const labelReprintGroups=[...reprintOptions.filter(option=>option.role==='產品標籤'||option.role==='袋標籤').reduce((map,option)=>{
    const key=option.bindingId;
    const current=map.get(key)??{bindingId:key,printerName:option.printerName,physicalKey:option.physicalKey,options:[] as SmtReprintOption[]};
    current.options.push(option);map.set(key,current);return map;
  },new Map<string,{bindingId:string;printerName:string;physicalKey:string;options:SmtReprintOption[]}>()).values()];

  if(!canReview)return <main className="order-manager"><section className="order-empty"><b>你冇查看訂單權限</b><p>需要 Admin 權限：ORDER_REVIEW。</p></section></main>;

  return <main className="order-manager">
    {customerArrival?<div className="keeta-arrival-backdrop" role="alertdialog" aria-modal="true">
      <section className="keeta-arrival-card">
        <strong>自家 App 新訂單到達</strong>
        <b>#{customerArrival.display}</b>
        <span>{customerArrival.sourceLabel}</span>
        <button className="primary" onClick={()=>{void load(customerArrival.orderId,true);setCustomerArrival(null);}}>查看並接受訂單</button>
      </section>
    </div>:null}
    {keetaArrival?<div className="keeta-arrival-backdrop" role="alertdialog" aria-modal="true">
      <section className="keeta-arrival-card">
        <strong>Keeta 新訂單到達</strong>
        <b>#{keetaArrival.display}</b>
        <span>{keetaArrival.sourceLabel}</span>
        <button className="primary" onClick={()=>{void load(keetaArrival.orderId,true);setKeetaArrival(null);}}>查看並處理訂單</button>
      </section>
    </div>:null}
    <header className="order-manager-top">
      <div className="order-manager-title"><span>☰</span><b>P01-01 訂單管理工作台</b></div>
      <div className="order-system-badges"><span>● 系統正常</span><span>▣ 打印機在線</span><span>SMT-01</span></div>
    </header>

    <aside className="order-inspector">
      {selected?<article>
        <header><div><h1>{selected.orderIdLabel}</h1><span>{selected.fulfillmentLabel}</span></div></header>
        <div className="order-inspector-meta"><b>{selected.sourceLabel??'現場'}</b><span>{selected.paymentLabel}</span></div>
        <section className="order-inspector-lines">
          <header><b>訂單內容</b><span>{selected.itemCount} 件</span></header>
          {selected.lines.map((line,index)=><div key={line.id+'-'+index}><span>{line.quantity}</span><p><b>{line.name}</b><small>{line.unitLabel} × {line.quantity}</small></p><strong>{line.lineTotalLabel}</strong></div>)}
        </section>
        <section className="order-inspector-money"><div><span>訂單金額</span><b>{selected.totalLabel}</b></div><div><span>付款方式</span><b>{selected.paymentLabel}</b></div></section>
        {selected.paymentEvidenceRef?<section className={'payment-review-card state-'+String(selected.paymentVerificationState||'PENDING').toLowerCase()}>
          <header><div><span>電子支付</span><h3>{selected.paymentVerificationState==='VERIFIED'?'付款已核對':selected.paymentVerificationState==='REJECTED'?'付款截圖未通過':'付款待核對'}</h3></div><strong>{selected.paymentVerificationState??'PENDING'}</strong></header>
          <p>{selected.paymentVerificationState==='VERIFIED'?'可以繼續接受訂單。':selected.paymentVerificationState==='REJECTED'?'訂單未取消；請聯絡客人或者由有權限員工取消訂單。':'先查看客人付款截圖，再決定是否通過。'}</p>
          <div className="payment-review-actions">
            <button type="button" disabled={paymentEvidenceBusy} onClick={()=>void openPaymentEvidence()}>{paymentEvidenceBusy?'載入中…':'查看付款截圖'}</button>
            <button type="button" className="danger" disabled={paymentReviewBusy||selected.paymentVerificationState==='REJECTED'} onClick={()=>void reviewPaymentEvidence('REJECTED')}>不接受付款</button>
            <button type="button" className="primary" disabled={paymentReviewBusy||selected.paymentVerificationState==='VERIFIED'} onClick={()=>void reviewPaymentEvidence('VERIFIED')}>確認付款</button>
          </div>
          {selected.paymentVerificationState==='REJECTED'?<section className="payment-followup">
            <header><b>要求客人重新傳送付款截圖</b><span>{selected.customerPhone?'可建立 WhatsApp QR':'冇可用電話'}</span></header>
            <label><span>訊息範本</span><select value={paymentFollowupTemplate} onChange={event=>{setPaymentFollowupTemplate(event.target.value as PaymentFollowupTemplateId);setPaymentFollowupQr(null);setPaymentFollowupMessage(null);}}>{PAYMENT_FOLLOWUP_TEMPLATES.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
            <button type="button" disabled={!selected.customerPhone||paymentFollowupBusy} onClick={()=>void buildPaymentFollowupQr()}>{paymentFollowupBusy?'建立中…':'產生 WhatsApp QR'}</button>
            {paymentFollowupQr?<div className="payment-followup-qr"><img src={paymentFollowupQr} alt="掃描後開啟 WhatsApp 訊息"/><p>{paymentFollowupMessage}</p><small>用手機掃描後會開啟 WhatsApp 對話並預填訊息；仍由店員確認後送出。</small></div>:null}
          </section>:null}
        </section>:null}
        {afterSales.length?<section className="order-after-sale">
          <header><b>Keeta 退款／售後</b><span>{afterSales.length}</span></header>
          {afterSales.map(row=><article key={row.afterSaleOrderId}>
            <div><b>{row.eventId===1007?'部分退款':'退款'} · #{row.afterSaleOrderId}</b><small>Provider status {row.providerStatus??'—'}{row.isAppeal?' · Appeal':''}</small></div>
            <strong>{row.refundAmountMinor==null?'—':'$'+(row.refundAmountMinor/100).toFixed(2)} {row.currency??''}</strong>
            {row.applyReason?<p>{row.applyReason}</p>:null}
            {row.handleReason?<p>最新處理：{row.handleReason}</p>:null}
            <footer>
              <button disabled={!canCorrect||Boolean(afterSaleBusy)||row.decisionState==='APPROVED'||row.decisionState==='REJECTED'} onClick={()=>void decideRefund(row,'REJECT')}>拒絕</button>
              <button className="primary" disabled={!canCorrect||Boolean(afterSaleBusy)||row.decisionState==='APPROVED'||row.decisionState==='REJECTED'} onClick={()=>void decideRefund(row,'APPROVE')}>同意退款</button>
            </footer>
            {row.decisionState?<small>本地決定：{row.decisionState}{row.decisionCode?' · '+row.decisionCode:''}</small>:null}
          </article>)}
          <button type="button" className="order-partial-preview" disabled={!canCorrect||Boolean(afterSaleBusy)} onClick={()=>void previewPartial()}>查詢可部分退款商品</button>
          {partialPreview?<details><summary>部分退款 Provider Preview</summary><pre>{JSON.stringify(partialPreview,null,2)}</pre></details>:null}
        </section>:null}
        {message?<p className="order-inline-message">{message}</p>:null}
        <footer>
          <button onClick={()=>void openReprint()}>▣ 重印</button>
          <button disabled={!canCorrect} title={canCorrect?'':'需要 ORDER_CORRECTION 權限'} onClick={()=>setModal('actions')}>✎ 取消／修改</button>
          {selected.fulfillmentLabel==='待處理'
            ?<button className="primary" disabled={!runtime.acceptOrder||acceptBusy||(Boolean(selected.paymentEvidenceRef)&&selected.paymentVerificationState!=='VERIFIED')} title={selected.paymentEvidenceRef&&selected.paymentVerificationState!=='VERIFIED'?'請先核對付款截圖':''} onClick={()=>void acceptSelected()}>{acceptBusy?'接單中…':String(selected.sourceLabel||'').startsWith('Keeta')?'接受 Keeta 訂單':'接受訂單'}</button>
            :null}
          <button className="primary" disabled={!runtime.markOrderReady||readyBusy||selected.fulfillmentLabel==='待處理'||selected.fulfillmentLabel==='可取餐'||selected.fulfillmentLabel==='已完成'||selected.fulfillmentLabel==='已取消'} onClick={()=>void markReady()}>{readyBusy?'處理中…':'提前完成／可取餐'}</button>
        </footer>
      </article>:<div className="order-empty">選擇一張訂單。</div>}
    </aside>

    <section className="order-board">
      <div className="order-payment-bar">
        <b>付款方式：</b>
        {(['全部','現金','Alipay','WeChat Pay','FPS / PayMe'] as const).map(filter=><button key={filter} className={paymentFilter===filter?'active':''} onClick={()=>setPaymentFilter(filter)}>{filter}<span>{paymentCounts.get(filter)??0}</span></button>)}
        <button className="history" onClick={()=>setHistory(value=>!value)}>{history?'進行中訂單':'歷史訂單'}</button>
      </div>
      <div className="order-board-head">
        <span>{history?'歷史訂單':'進行中訂單'}　{filtered.length}</span>
        <div><button type="button" disabled={keetaPullBusy} onClick={()=>void pullKeetaOrders()}>{keetaPullBusy?'同步中…':'手動接 Keeta 新單'}</button><label>Admin 出餐計時</label><b>{storeSettings.fulfillmentMinutes} 分鐘</b><button disabled title="由 Admin 門店設定提供">Admin</button></div>
      </div>
      {pendingKeetaOrders.length?<button type="button" className="keeta-pending-banner" onClick={()=>void load(pendingKeetaOrders[0]!.orderId,true)}><b>Keeta 有 {pendingKeetaOrders.length} 張訂單未處理</b><span>請立即接受或處理訂單</span></button>:null}
      {keetaPullMessage?<p className="order-board-error">{keetaPullMessage}</p>:null}
      {keetaIntakeAttention.length?<p className="order-board-error">Keeta 接單注意：{keetaIntakeAttention.map(row=>String((row as {code?:unknown}).code??'UNKNOWN')).join('；')}</p>:null}

      <div className="order-channel-grid">
        {lanes.map(lane=><section key={lane.id} className="order-channel-lane">
          <header><b>{lane.label}</b><span>{lane.orders.length}</span></header>
          <div className="order-channel-list">
            {lane.orders.length?lane.orders.map(order=><button key={order.orderId} className={snapshot?.selectedOrderId===order.orderId?'selected':''} onClick={()=>void load(order.orderId)}>
              <strong>{order.orderIdLabel}</strong>
              <span>{order.sourceLabel}</span>
              <small>{order.paymentLabel} · {order.itemCount} 件</small>
              <div><em>{order.fulfillmentLabel}</em><b>{order.totalLabel}</b></div>
            </button>):<p>目前沒有訂單。</p>}
          </div>
        </section>)}
      </div>
      {error?<p className="order-board-error">{error}</p>:null}
      {loading&&!snapshot?<p className="order-board-error">載入訂單…</p>:null}
    </section>

    {paymentEvidenceUrl?<div className="order-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){URL.revokeObjectURL(paymentEvidenceUrl);setPaymentEvidenceUrl(null);}}}>
      <section className="order-modal payment-evidence-modal">
        <header><h2>付款截圖</h2><button onClick={()=>{URL.revokeObjectURL(paymentEvidenceUrl);setPaymentEvidenceUrl(null);}}>×</button></header>
        <div className="payment-evidence-preview"><img src={paymentEvidenceUrl} alt="客戶付款截圖"/></div>
        <footer><button onClick={()=>{URL.revokeObjectURL(paymentEvidenceUrl);setPaymentEvidenceUrl(null);}}>關閉</button></footer>
      </section>
    </div>:null}

    {selected&&modal?<div className="order-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setModal(null)}}>
      <section className={'order-modal '+modal}>
        <header><h2>{modal==='reprint'?'重印':modal==='edit'?'修改訂單':modal==='cancel'?'取消訂單':'取消／修改'}</h2><button onClick={()=>setModal(null)}>×</button></header>

        {modal==='actions'?<div className="order-action-choices">
          <button onClick={()=>setModal('edit')}><b>✎ 修改訂單</b><span>修改商品數量；保持同一訂單編號，完成後唔自動重印。</span></button>
          <button className="danger" onClick={()=>setModal('cancel')}><b>⊗ 取消訂單</b><span>取消此訂單；退款／第三方平台動作唔會自動執行。</span></button>
        </div>:null}

        {modal==='edit'?<div className="order-edit-body">
          <p>原訂單商品（同一 Order identity）</p>
          <div className="order-edit-lines">{editLines.map((line,index)=><article key={line.id+'-'+index}>
            <div><b>{line.name}</b><small>{'$'+(line.unitMinor/100).toFixed(2)}</small></div>
            <div className="order-edit-qty"><button onClick={()=>setEditLines(lines=>lines.map((row,i)=>i===index?{...row,qty:Math.max(0,row.qty-1)}:row))}>−</button><strong>{line.qty}</strong><button onClick={()=>setEditLines(lines=>lines.map((row,i)=>i===index?{...row,qty:row.qty+1}:row))}>＋</button></div>
            <button className="trash" onClick={()=>setEditLines(lines=>lines.filter((_,i)=>i!==index))}>刪除</button>
          </article>)}</div>
          <div className="order-edit-total"><span>修改後金額</span><b>{'$'+(editLines.reduce((sum,row)=>sum+row.qty*row.unitMinor,0)/100).toFixed(2)}</b></div>
          <footer><button onClick={()=>setModal(null)}>取消修改</button><button className="primary" onClick={()=>void saveEdit()}>確認修改</button></footer>
        </div>:null}

        {modal==='cancel'?<div className="order-cancel-body">
          <p>確定取消 {selected.orderIdLabel}？</p>
          <div className="order-cancel-warning">呢個本地動作只改訂單狀態；唔會自動退款、重印、開錢箱或通知外部平台。</div>
          <label><span>原因（可選）</span><select value={cancelReason} onChange={event=>setCancelReason(event.target.value)}><option value="">唔填原因</option>{cancelReasons.map(reason=><option key={reason.id} value={reason.label}>{reason.label}</option>)}</select></label>
          <label><span>自填原因（可選）</span><input value={cancelReason} onChange={event=>setCancelReason(event.target.value)} placeholder="Admin 快捷原因以外可自填"/></label>
          <footer><button onClick={()=>setModal(null)}>返回</button><button className="danger" onClick={()=>void cancelSelected()}>確認取消</button></footer>
        </div>:null}

        {modal==='reprint'?<div className="order-reprint-body">
          <p>選擇需要重新打印嘅內容。Label 會按實體打印機分組；同一部機有多張 Label 時可以展開逐張揀。重印永遠唔會開錢箱。</p>
          {ticketReprintOptions.length?<section className="order-reprint-ticket-group"><header><b>80mm 單據</b><span>{ticketReprintOptions.length}</span></header><div className="order-reprint-options">{ticketReprintOptions.map(option=><label key={option.jobId}><input type="checkbox" checked={selectedJobs.has(option.jobId)} onChange={()=>toggleJob(option.jobId)}/><span><b>{option.label}</b><small>{option.printerName}</small></span></label>)}</div></section>:null}
          <div className="order-reprint-printers">{labelReprintGroups.map(group=><details key={group.bindingId} className="order-reprint-printer-group" open={group.options.length===1}>
            <summary><span><b>{group.printerName}</b><small>{group.physicalKey||'未綁定'} · {group.options.length} 張 Label</small></span><button type="button" onClick={event=>{event.preventDefault();setSelectedJobs(current=>{const next=new Set(current);const allSelected=group.options.every(option=>next.has(option.jobId));for(const option of group.options){if(allSelected)next.delete(option.jobId);else next.add(option.jobId);}return next;});}}>呢部全選</button></summary>
            <div className="order-reprint-options">{group.options.map(option=><label key={option.jobId}><input type="checkbox" checked={selectedJobs.has(option.jobId)} onChange={()=>toggleJob(option.jobId)}/><span><b>{option.label}</b><small>{option.detail??option.role}</small></span></label>)}</div>
          </details>)}</div>
          <div className="order-reprint-tools"><button onClick={()=>setSelectedJobs(new Set(reprintOptions.map(option=>option.jobId)))}>全部選擇</button><button onClick={()=>setSelectedJobs(new Set())}>清除</button></div>
          <label><span>重印原因（可選）</span><select value={reprintReason} onChange={event=>setReprintReason(event.target.value)}><option value="">唔填原因</option>{reprintReasons.map(reason=><option key={reason.id} value={reason.label}>{reason.label}</option>)}</select></label>
          <footer><button onClick={()=>setModal(null)}>取消</button><button className="primary" disabled={!selectedJobs.size||reprintBusy} onClick={()=>void runReprint()}>{reprintBusy?'打印中…':'開始打印'}</button></footer>
        </div>:null}
      </section>
    </div>:null}
  </main>;
}
