export const MFP_PRINT_READ_SCHEMA='mfp.print-hardware.read.v1' as const;

export type MfpPrintJobType='RECEIPT'|'PRODUCTION'|'PACKING'|'TABLE_TICKET'|'PRODUCT_LABEL'|'BAG_LABEL'|'CANCEL_NOTICE'|'DAILY_REPORT';
export type MfpPrintPurpose='INITIAL'|'REPRINT'|'PAYMENT_RECEIPT'|'DINING_ADDITION'|'CANCEL_NOTICE'|'DIAGNOSTIC';
export type MfpPrintTransportState='NOT_STARTED'|'PERSISTED'|'DISPATCHING'|'ACKNOWLEDGED'|'FAILED_BEFORE_SEND'|'AMBIGUOUS_AFTER_SEND';

export interface MfpCanonicalPrintJob{
  readonly canonicalPrintJobId:string;
  readonly orderId?:string;
  readonly reportId?:string;
  readonly sourceRef?:string;
  readonly paymentRef?:string;
  readonly jobType:MfpPrintJobType;
  readonly purpose:MfpPrintPurpose;
  readonly logicalDestinationId:string;
  readonly templateId:string;
  readonly templateRevision:number;
  readonly payloadIdentity:string;
  readonly payloadDigest:string;
  readonly createdAt:string;
  readonly canonicalState:'PLANNED'|'READY'|'CANCELLED'|'COMPLETED';
  readonly transportState:MfpPrintTransportState;
  readonly dispatchAttemptId?:string;
  readonly physicalBindingId?:string;
  readonly lastCode?:string;
  readonly reprintOfPrintJobId?:string;
  readonly kickDrawer:boolean;
  readonly labelUnit?:Readonly<{labelId:string;index:number;total:number}>;
  readonly materialItemRefs?:readonly string[];
}

export interface MfpCanonicalPrintReadModel{
  readonly schema:typeof MFP_PRINT_READ_SCHEMA;
  readonly storeId:string;
  readonly revision:number;
  readonly readAt:string;
  readonly jobs:readonly MfpCanonicalPrintJob[];
}

export interface MfpGatewayJobEvidence{
  readonly canonicalPrintJobId:string;
  readonly dispatchAttemptId:string;
  readonly state:MfpPrintTransportState;
  readonly lastStage:string;
  readonly lastCode?:string;
  readonly payloadDigest?:string;
  readonly createdAt:string;
  readonly updatedAt:string;
}

export interface MfpPrintGatewaySnapshot{
  readonly serviceReady:boolean;
  readonly queueDepth:number;
  readonly lastJob:MfpGatewayJobEvidence|null;
}

export interface MfpPrinterBinding{
  readonly bindingId:string;
  readonly logicalDestinationId:string;
  readonly displayName:string;
  readonly model:string;
  readonly transport:'tcp'|'sunmi-built-in'|'usb';
  readonly host?:string;
  readonly port?:number;
  readonly capability:'receipt-80mm/kitchen'|'label-58mm';
  readonly encoding:string;
  readonly enabled:boolean;
  readonly publishedTemplateId?:string;
  readonly drawerPin?:number;
}

export interface MfpAuthorizedPrintDispatch{
  readonly job:MfpCanonicalPrintJob;
  readonly dispatchAttemptId:string;
  readonly payloadBase64:string;
  readonly payloadDigest:string;
}

export type MfpReprintSelection=
  |Readonly<{kind:'WHOLE_TICKET';sourcePrintJobId:string;jobType:'RECEIPT'|'PRODUCTION'|'PACKING'|'TABLE_TICKET'}>
  |Readonly<{kind:'LABELS';routeId:string;sourcePrintJobIds:readonly string[];labelIds:readonly string[]}>;

export interface MfpReprintRequest{
  readonly requestId:string;
  readonly orderId:string;
  readonly reason:string;
  readonly humanConfirmed:true;
  readonly selection:MfpReprintSelection;
}

export interface MfpPrintAuthorityPort{
  readPrintModel():Promise<unknown>;
  authorizeDispatch(canonicalPrintJobId:string):Promise<MfpAuthorizedPrintDispatch>;
  requestReprint(request:MfpReprintRequest):Promise<readonly MfpAuthorizedPrintDispatch[]>;
  requestSafeRetry(canonicalPrintJobId:string,requestId:string):Promise<MfpAuthorizedPrintDispatch>;
  ensureCancelNotice(input:Readonly<{orderId:string;requestId:string;intent:'CANCEL_NOTICE_REQUIRED'}>):Promise<MfpAuthorizedPrintDispatch>;
}

export interface MfpPrintGatewayPort{
  readGatewaySnapshot():Promise<unknown>;
  enqueueCanonicalPrintJob(input:Readonly<{
    canonicalPrintJobId:string;
    dispatchAttemptId:string;
    payloadBase64:string;
    payloadDigest:string;
    target:Readonly<{kind:'LAN';endpointId:string}|{kind:'SUNMI_INTERNAL'}>;
  }>):Promise<unknown>;
  readEndpointBindings():Promise<unknown>;
  applyEndpointBinding(binding:MfpPrinterBinding):Promise<unknown>;
  probeEndpoint(bindingId:string):Promise<unknown>;
  testEndpoint(bindingId:string):Promise<unknown>;
}

export interface MfpPrintHardwareBinding{
  readonly authority:MfpPrintAuthorityPort;
  readonly gateway:MfpPrintGatewayPort;
}

export type MfpPrintAttention=Readonly<{
  kind:'NONE'|'ACKNOWLEDGED'|'SAFE_RETRY'|'HUMAN_CHECK'|'MISSING_BINDING'|'INVALID_CONFIG'|'ENDPOINT_UNREACHABLE';
  safeAction:string;
}>;

export type MfpPrintJobReadback=MfpCanonicalPrintJob&Readonly<{attention:MfpPrintAttention}>;

export interface MfpPrintHardwareReadback{
  readonly canonical:MfpCanonicalPrintReadModel;
  readonly gateway:MfpPrintGatewaySnapshot;
  readonly bindings:readonly MfpPrinterBinding[];
  readonly bindingError?:string;
  readonly jobs:readonly MfpPrintJobReadback[];
}

const jobTypes=new Set<MfpPrintJobType>(['RECEIPT','PRODUCTION','PACKING','TABLE_TICKET','PRODUCT_LABEL','BAG_LABEL','CANCEL_NOTICE','DAILY_REPORT']);
const purposes=new Set<MfpPrintPurpose>(['INITIAL','REPRINT','PAYMENT_RECEIPT','DINING_ADDITION','CANCEL_NOTICE','DIAGNOSTIC']);
const transportStates=new Set<MfpPrintTransportState>(['NOT_STARTED','PERSISTED','DISPATCHING','ACKNOWLEDGED','FAILED_BEFORE_SEND','AMBIGUOUS_AFTER_SEND']);
const canonicalStates=new Set<MfpCanonicalPrintJob['canonicalState']>(['PLANNED','READY','CANCELLED','COMPLETED']);
const text=(value:unknown,code:string)=>{if(typeof value!=='string'||!value.trim())throw new Error(code);return value.trim();};
const record=(value:unknown,code:string):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);return value as Record<string,unknown>;};

function transportState(value:unknown):MfpPrintTransportState{
  if(value==='UNKNOWN')return'AMBIGUOUS_AFTER_SEND';
  if(!transportStates.has(value as MfpPrintTransportState))throw new Error('MFP_PRINT_TRANSPORT_STATE_INVALID');
  return value as MfpPrintTransportState;
}

export function validateMfpCanonicalPrintJob(value:unknown):MfpCanonicalPrintJob{
  const row=record(value,'MFP_PRINT_JOB_INVALID');
  if(!jobTypes.has(row.jobType as MfpPrintJobType))throw new Error('MFP_PRINT_JOB_TYPE_INVALID');
  if(!purposes.has(row.purpose as MfpPrintPurpose))throw new Error('MFP_PRINT_PURPOSE_INVALID');
  if(!canonicalStates.has(row.canonicalState as MfpCanonicalPrintJob['canonicalState']))throw new Error('MFP_PRINT_CANONICAL_STATE_INVALID');
  const templateRevision=Number(row.templateRevision);
  if(!Number.isSafeInteger(templateRevision)||templateRevision<1)throw new Error('MFP_PRINT_TEMPLATE_REVISION_INVALID');
  const kickDrawer=row.kickDrawer===true;
  if(row.kickDrawer!==true&&row.kickDrawer!==false)throw new Error('MFP_PRINT_DRAWER_POLICY_REQUIRED');
  if(kickDrawer&&(row.jobType!=='RECEIPT'||row.purpose!=='PAYMENT_RECEIPT'))throw new Error('MFP_PRINT_DRAWER_POLICY_INVALID');
  if(row.purpose==='REPRINT'&&(kickDrawer||!row.reprintOfPrintJobId))throw new Error('MFP_REPRINT_POLICY_INVALID');
  if(row.purpose==='PAYMENT_RECEIPT'&&!row.paymentRef)throw new Error('MFP_PRINT_PAYMENT_REF_REQUIRED');
  if(row.purpose==='DINING_ADDITION'&&(!Array.isArray(row.materialItemRefs)||row.materialItemRefs.length<1))throw new Error('MFP_PRINT_DELTA_ITEMS_REQUIRED');
  const label=row.labelUnit===undefined?undefined:record(row.labelUnit,'MFP_PRINT_LABEL_UNIT_INVALID');
  const labelUnit=label?Object.freeze({
    labelId:text(label.labelId,'MFP_PRINT_LABEL_ID_REQUIRED'),
    index:Number(label.index),total:Number(label.total),
  }):undefined;
  if(labelUnit&&(!Number.isSafeInteger(labelUnit.index)||!Number.isSafeInteger(labelUnit.total)||labelUnit.index<1||labelUnit.total<labelUnit.index))throw new Error('MFP_PRINT_LABEL_POSITION_INVALID');
  if((row.jobType==='PRODUCT_LABEL'||row.jobType==='BAG_LABEL')!==Boolean(labelUnit))throw new Error('MFP_PRINT_LABEL_UNIT_REQUIRED');
  if(row.purpose==='PAYMENT_RECEIPT'&&row.jobType!=='RECEIPT')throw new Error('MFP_PRINT_PAYMENT_RECEIPT_TYPE_INVALID');
  if(row.purpose==='CANCEL_NOTICE'&&row.jobType!=='CANCEL_NOTICE')throw new Error('MFP_CANCEL_NOTICE_POLICY_INVALID');
  return Object.freeze({
    canonicalPrintJobId:text(row.canonicalPrintJobId,'MFP_PRINT_JOB_ID_REQUIRED'),
    ...(row.orderId?{orderId:text(row.orderId,'MFP_PRINT_ORDER_ID_INVALID')}:{}),
    ...(row.reportId?{reportId:text(row.reportId,'MFP_PRINT_REPORT_ID_INVALID')}:{}),
    ...(row.sourceRef?{sourceRef:text(row.sourceRef,'MFP_PRINT_SOURCE_REF_INVALID')}:{}),
    ...(row.paymentRef?{paymentRef:text(row.paymentRef,'MFP_PRINT_PAYMENT_REF_INVALID')}:{}),
    jobType:row.jobType as MfpPrintJobType,purpose:row.purpose as MfpPrintPurpose,
    logicalDestinationId:text(row.logicalDestinationId,'MFP_PRINT_DESTINATION_REQUIRED'),
    templateId:text(row.templateId,'MFP_PRINT_TEMPLATE_REQUIRED'),templateRevision,
    payloadIdentity:text(row.payloadIdentity,'MFP_PRINT_PAYLOAD_IDENTITY_REQUIRED'),
    payloadDigest:text(row.payloadDigest,'MFP_PRINT_PAYLOAD_DIGEST_REQUIRED'),
    createdAt:text(row.createdAt,'MFP_PRINT_CREATED_AT_REQUIRED'),
    canonicalState:row.canonicalState as MfpCanonicalPrintJob['canonicalState'],
    transportState:transportState(row.transportState),
    ...(row.dispatchAttemptId?{dispatchAttemptId:text(row.dispatchAttemptId,'MFP_PRINT_ATTEMPT_INVALID')}:{}),
    ...(row.physicalBindingId?{physicalBindingId:text(row.physicalBindingId,'MFP_PRINT_BINDING_INVALID')}:{}),
    ...(row.lastCode?{lastCode:text(row.lastCode,'MFP_PRINT_CODE_INVALID')}:{}),
    ...(row.reprintOfPrintJobId?{reprintOfPrintJobId:text(row.reprintOfPrintJobId,'MFP_REPRINT_SOURCE_INVALID')}:{}),
    kickDrawer,
    ...(labelUnit?{labelUnit}:{}),
    ...(Array.isArray(row.materialItemRefs)?{materialItemRefs:Object.freeze(row.materialItemRefs.map(item=>text(item,'MFP_PRINT_DELTA_ITEM_INVALID')))}:{}),
  });
}

export function validateMfpPrintReadModel(value:unknown):MfpCanonicalPrintReadModel{
  const row=record(value,'MFP_PRINT_READ_MODEL_INVALID');
  if(row.schema!==MFP_PRINT_READ_SCHEMA||!Array.isArray(row.jobs))throw new Error('MFP_PRINT_READ_MODEL_INVALID');
  const jobs=row.jobs.map(validateMfpCanonicalPrintJob);
  const revision=Number(row.revision);
  if(!Number.isSafeInteger(revision)||revision<0)throw new Error('MFP_PRINT_READ_REVISION_INVALID');
  if(new Set(jobs.map(job=>job.canonicalPrintJobId)).size!==jobs.length)throw new Error('MFP_PRINT_JOB_ID_DUPLICATE');
  return Object.freeze({schema:MFP_PRINT_READ_SCHEMA,storeId:text(row.storeId,'MFP_PRINT_STORE_ID_REQUIRED'),revision,readAt:text(row.readAt,'MFP_PRINT_READ_AT_REQUIRED'),jobs:Object.freeze(jobs)});
}

export function validateMfpPrinterBinding(value:unknown):MfpPrinterBinding{
  const row=record(value,'MFP_PRINTER_BINDING_INVALID');
  if(!['tcp','sunmi-built-in','usb'].includes(String(row.transport)))throw new Error('MFP_PRINTER_TRANSPORT_INVALID');
  if(!['receipt-80mm/kitchen','label-58mm'].includes(String(row.capability)))throw new Error('MFP_PRINTER_CAPABILITY_INVALID');
  const port=row.port===undefined?undefined:Number(row.port);
  if(row.transport==='tcp'&&(!row.host||!Number.isSafeInteger(port)||port!<1||port!>65535))throw new Error('MFP_PRINTER_ENDPOINT_INVALID');
  if(row.enabled!==true&&row.enabled!==false)throw new Error('MFP_PRINTER_ENABLED_INVALID');
  return Object.freeze({
    bindingId:text(row.bindingId,'MFP_PRINTER_BINDING_ID_REQUIRED'),
    logicalDestinationId:text(row.logicalDestinationId,'MFP_PRINTER_DESTINATION_REQUIRED'),
    displayName:text(row.displayName,'MFP_PRINTER_NAME_REQUIRED'),model:text(row.model,'MFP_PRINTER_MODEL_REQUIRED'),
    transport:row.transport as MfpPrinterBinding['transport'],
    ...(row.host?{host:text(row.host,'MFP_PRINTER_HOST_INVALID')}:{}),...(port===undefined?{}:{port}),
    capability:row.capability as MfpPrinterBinding['capability'],encoding:text(row.encoding,'MFP_PRINTER_ENCODING_REQUIRED'),
    enabled:row.enabled as boolean,
    ...(row.publishedTemplateId?{publishedTemplateId:text(row.publishedTemplateId,'MFP_PRINTER_TEMPLATE_INVALID')}:{}),
    ...(row.drawerPin===undefined?{}:{drawerPin:Number(row.drawerPin)}),
  });
}

function validateGatewayJob(value:unknown):MfpGatewayJobEvidence{
  const row=record(value,'MFP_PRINT_GATEWAY_JOB_INVALID');
  return Object.freeze({
    canonicalPrintJobId:text(row.canonicalPrintJobId,'MFP_PRINT_JOB_ID_REQUIRED'),
    dispatchAttemptId:text(row.dispatchAttemptId,'MFP_PRINT_ATTEMPT_REQUIRED'),state:transportState(row.state),
    lastStage:text(row.lastStage,'MFP_PRINT_STAGE_REQUIRED'),
    ...(row.lastCode?{lastCode:text(row.lastCode,'MFP_PRINT_CODE_INVALID')}:{}),
    ...(row.payloadDigest?{payloadDigest:text(row.payloadDigest,'MFP_PRINT_PAYLOAD_DIGEST_INVALID')}:{}),
    createdAt:text(row.createdAt,'MFP_PRINT_CREATED_AT_REQUIRED'),updatedAt:text(row.updatedAt,'MFP_PRINT_UPDATED_AT_REQUIRED'),
  });
}

export function validateMfpGatewaySnapshot(value:unknown):MfpPrintGatewaySnapshot{
  const row=record(value,'MFP_PRINT_GATEWAY_SNAPSHOT_INVALID');
  const queueDepth=Number(row.queueDepth);
  if(row.serviceReady!==true&&row.serviceReady!==false)throw new Error('MFP_PRINT_GATEWAY_READY_INVALID');
  if(!Number.isSafeInteger(queueDepth)||queueDepth<0)throw new Error('MFP_PRINT_GATEWAY_QUEUE_INVALID');
  return Object.freeze({serviceReady:row.serviceReady as boolean,queueDepth,lastJob:row.lastJob?validateGatewayJob(row.lastJob):null});
}

function attention(job:MfpCanonicalPrintJob,binding:MfpPrinterBinding|undefined,bindingError?:string):MfpPrintAttention{
  if(job.transportState==='AMBIGUOUS_AFTER_SEND')return Object.freeze({kind:'HUMAN_CHECK',safeAction:'人工檢查；如有需要，建立新重印'});
  if(job.lastCode?.includes('INVALID'))return Object.freeze({kind:'INVALID_CONFIG',safeAction:'修正 payload / endpoint 設定；不可當作已打印'});
  if(job.lastCode?.includes('UNREACHABLE')||job.lastCode?.includes('CONNECT'))return Object.freeze({kind:'ENDPOINT_UNREACHABLE',safeAction:'檢查該 Printer 網絡；其他交易可繼續'});
  if(job.transportState==='FAILED_BEFORE_SEND')return Object.freeze({kind:'SAFE_RETRY',safeAction:'只可經正式 Print authority 安全重試'});
  if(job.transportState==='ACKNOWLEDGED')return Object.freeze({kind:'ACKNOWLEDGED',safeAction:'通訊已確認；未證明實體已出紙'});
  if(bindingError)return Object.freeze({kind:'INVALID_CONFIG',safeAction:'檢查損壞嘅本地 Printer binding'});
  if(!binding||!binding.enabled)return Object.freeze({kind:'MISSING_BINDING',safeAction:'設定本地實體 Printer binding'});
  return Object.freeze({kind:'NONE',safeAction:'無需操作'});
}

function resolveEvidence(job:MfpCanonicalPrintJob,gateway:MfpPrintGatewaySnapshot):MfpCanonicalPrintJob{
  const evidence=gateway.lastJob;
  if(!evidence||evidence.canonicalPrintJobId!==job.canonicalPrintJobId||evidence.dispatchAttemptId!==job.dispatchAttemptId)return job;
  return Object.freeze({...job,transportState:evidence.state,lastCode:evidence.lastCode??job.lastCode});
}

function target(binding:MfpPrinterBinding){
  if(!binding.enabled)throw new Error('MFP_PRINTER_BINDING_DISABLED');
  if(binding.transport==='tcp')return Object.freeze({kind:'LAN' as const,endpointId:binding.bindingId});
  if(binding.transport==='sunmi-built-in')return Object.freeze({kind:'SUNMI_INTERNAL' as const});
  throw new Error('MFP_PRINT_TRANSPORT_UNSUPPORTED');
}

function validateAuthorized(value:MfpAuthorizedPrintDispatch):MfpAuthorizedPrintDispatch{
  const job=validateMfpCanonicalPrintJob(value.job);
  const dispatchAttemptId=text(value.dispatchAttemptId,'MFP_PRINT_ATTEMPT_REQUIRED');
  const payloadBase64=text(value.payloadBase64,'MFP_PRINT_PAYLOAD_REQUIRED');
  const payloadDigest=text(value.payloadDigest,'MFP_PRINT_PAYLOAD_DIGEST_REQUIRED');
  if(job.dispatchAttemptId&&job.dispatchAttemptId!==dispatchAttemptId)throw new Error('MFP_PRINT_ATTEMPT_MISMATCH');
  if(job.payloadDigest!==payloadDigest)throw new Error('MFP_PRINT_PAYLOAD_DIGEST_MISMATCH');
  return Object.freeze({job,dispatchAttemptId,payloadBase64,payloadDigest});
}

export function selectMfpLabelJobs(jobs:readonly MfpCanonicalPrintJob[],routeId:string,labelIds:readonly string[]){
  const selected=new Set(labelIds);
  if(!routeId||selected.size!==labelIds.length||selected.size<1)throw new Error('MFP_REPRINT_LABEL_SELECTION_INVALID');
  const matches=jobs.filter(job=>job.logicalDestinationId===routeId&&job.labelUnit&&selected.has(job.labelUnit.labelId));
  if(matches.length!==selected.size)throw new Error('MFP_REPRINT_LABEL_SELECTION_INVALID');
  return Object.freeze(matches);
}

export function createMfpPrintHardwareSession(binding:MfpPrintHardwareBinding){
  const inflight=new Map<string,Promise<readonly MfpGatewayJobEvidence[]>>();

  const read=async():Promise<MfpPrintHardwareReadback>=>{
    const canonical=validateMfpPrintReadModel(await binding.authority.readPrintModel());
    let gateway:MfpPrintGatewaySnapshot;
    try{gateway=validateMfpGatewaySnapshot(await binding.gateway.readGatewaySnapshot());}
    catch{gateway=Object.freeze({serviceReady:false,queueDepth:0,lastJob:null});}
    let bindings:readonly MfpPrinterBinding[]=[];
    let bindingError:string|undefined;
    try{
      const raw=await binding.gateway.readEndpointBindings();
      if(!Array.isArray(raw))throw new Error('MFP_PRINTER_BINDINGS_INVALID');
      bindings=Object.freeze(raw.map(validateMfpPrinterBinding));
      if(new Set(bindings.map(item=>item.bindingId)).size!==bindings.length)throw new Error('MFP_PRINTER_BINDING_ID_DUPLICATE');
    }catch(error){bindingError=error instanceof Error?error.message:'MFP_PRINTER_BINDINGS_INVALID';}
    const jobs=canonical.jobs.map(value=>{
      const job=resolveEvidence(value,gateway);
      return Object.freeze({...job,attention:attention(job,bindings.find(item=>item.logicalDestinationId===job.logicalDestinationId),bindingError)});
    });
    return Object.freeze({canonical,gateway,bindings,bindingError,jobs:Object.freeze(jobs)});
  };

  const dispatchAuthorized=async(raw:MfpAuthorizedPrintDispatch):Promise<MfpGatewayJobEvidence>=>{
    const authorized=validateAuthorized(raw);
    const {job,dispatchAttemptId,payloadBase64,payloadDigest}=authorized;
    if(job.canonicalState!=='READY')throw new Error('MFP_PRINT_JOB_NOT_READY');
    if(job.transportState!=='NOT_STARTED')throw new Error('MFP_PRINT_AUTOMATIC_REDISPATCH_FORBIDDEN');
    const snapshot=validateMfpGatewaySnapshot(await binding.gateway.readGatewaySnapshot());
    if(snapshot.lastJob?.dispatchAttemptId===dispatchAttemptId)return snapshot.lastJob;
    const rawBindings=await binding.gateway.readEndpointBindings();
    if(!Array.isArray(rawBindings))throw new Error('MFP_PRINTER_BINDINGS_INVALID');
    const printers=rawBindings.map(validateMfpPrinterBinding);
    const printer=printers.find(item=>item.logicalDestinationId===job.logicalDestinationId&&item.enabled);
    if(!printer)throw new Error('MFP_PRINT_BINDING_MISSING');
    if(printer.publishedTemplateId&&printer.publishedTemplateId!==job.templateId)throw new Error('MFP_PRINT_PUBLISHED_TEMPLATE_MISMATCH');
    if((job.jobType==='PRODUCT_LABEL'||job.jobType==='BAG_LABEL')!== (printer.capability==='label-58mm'))throw new Error('MFP_PRINT_CAPABILITY_MISMATCH');
    const input={canonicalPrintJobId:job.canonicalPrintJobId,dispatchAttemptId,payloadBase64,payloadDigest,target:target(printer)};
    try{return validateGatewayJob(await binding.gateway.enqueueCanonicalPrintJob(input));}
    catch{
      try{
        const after=validateMfpGatewaySnapshot(await binding.gateway.readGatewaySnapshot());
        if(after.lastJob?.dispatchAttemptId===dispatchAttemptId)return after.lastJob;
      }catch{/* Conservative UNKNOWN below; browser failure never proves not-sent. */}
      return Object.freeze({canonicalPrintJobId:job.canonicalPrintJobId,dispatchAttemptId,state:'AMBIGUOUS_AFTER_SEND',lastStage:'BROWSER_GATEWAY_CALL',lastCode:'MFP_PRINT_GATEWAY_READBACK_UNCONFIRMED',payloadDigest,createdAt:job.createdAt,updatedAt:new Date().toISOString()});
    }
  };

  const runOnce=(requestId:string,work:()=>Promise<readonly MfpGatewayJobEvidence[]>)=>{
    text(requestId,'MFP_PRINT_REQUEST_ID_REQUIRED');
    const existing=inflight.get(requestId);
    if(existing)return existing;
    // ponytail: 128 explicit actions bound one open UI session; formal authority remains the durable idempotency seam.
    if(inflight.size>=128)inflight.delete(inflight.keys().next().value!);
    const pending=work();
    inflight.set(requestId,pending);
    return pending;
  };

  const requestReprint=(request:MfpReprintRequest)=>runOnce(request.requestId,async()=>{
    if(request.humanConfirmed!==true||!request.reason.trim())throw new Error('MFP_REPRINT_HUMAN_CONFIRMATION_REQUIRED');
    if(request.selection.kind==='LABELS'&&request.selection.labelIds.length<1)throw new Error('MFP_REPRINT_LABEL_SELECTION_INVALID');
    const authorized=await binding.authority.requestReprint(request);
    if(authorized.length<1)throw new Error('MFP_REPRINT_JOB_REQUIRED');
    if(request.selection.kind==='WHOLE_TICKET'&&authorized.length!==1)throw new Error('MFP_REPRINT_WHOLE_TICKET_INVALID');
    const requestedSources=new Set(request.selection.kind==='WHOLE_TICKET'?[request.selection.sourcePrintJobId]:request.selection.sourcePrintJobIds);
    const requestedLabels=new Set(request.selection.kind==='LABELS'?request.selection.labelIds:[]);
    for(const raw of authorized){
      const item=validateAuthorized(raw);
      if(item.job.orderId!==request.orderId||item.job.purpose!=='REPRINT'||item.job.kickDrawer||!item.job.reprintOfPrintJobId)throw new Error('MFP_REPRINT_POLICY_INVALID');
      if(item.job.canonicalPrintJobId===item.job.reprintOfPrintJobId)throw new Error('MFP_REPRINT_IDENTITY_REUSED');
      if(!requestedSources.has(item.job.reprintOfPrintJobId))throw new Error('MFP_REPRINT_SOURCE_INVALID');
      if(request.selection.kind==='WHOLE_TICKET'&&item.job.jobType!==request.selection.jobType)throw new Error('MFP_REPRINT_WHOLE_TICKET_INVALID');
      if(request.selection.kind==='LABELS'&&(item.job.logicalDestinationId!==request.selection.routeId||!item.job.labelUnit||!requestedLabels.has(item.job.labelUnit.labelId)))throw new Error('MFP_REPRINT_LABEL_SELECTION_INVALID');
    }
    if(request.selection.kind==='LABELS'&&(authorized.length!==requestedLabels.size||authorized.length!==requestedSources.size))throw new Error('MFP_REPRINT_LABEL_SELECTION_INVALID');
    return Promise.all(authorized.map(dispatchAuthorized));
  });

  const requestSafeRetry=(canonicalPrintJobId:string,requestId:string)=>runOnce(requestId,async()=>{
    const current=await read();
    const job=current.jobs.find(item=>item.canonicalPrintJobId===canonicalPrintJobId);
    if(!job||job.transportState!=='FAILED_BEFORE_SEND')throw new Error('MFP_PRINT_SAFE_RETRY_FORBIDDEN');
    const authorized=validateAuthorized(await binding.authority.requestSafeRetry(canonicalPrintJobId,requestId));
    if(authorized.job.canonicalPrintJobId!==canonicalPrintJobId||authorized.job.purpose==='REPRINT')throw new Error('MFP_PRINT_SAFE_RETRY_IDENTITY_INVALID');
    return [await dispatchAuthorized(authorized)];
  });

  const ensureCancelNotice=(orderId:string,requestId:string)=>runOnce(requestId,async()=>{
    const current=await read();
    const existing=current.jobs.find(job=>job.orderId===orderId&&job.jobType==='CANCEL_NOTICE'&&job.purpose==='CANCEL_NOTICE');
    if(existing){
      if(existing.transportState==='NOT_STARTED')return [await dispatchAuthorized(await binding.authority.authorizeDispatch(existing.canonicalPrintJobId))];
      return [Object.freeze({canonicalPrintJobId:existing.canonicalPrintJobId,dispatchAttemptId:existing.dispatchAttemptId??'NOT_STARTED',state:existing.transportState,lastStage:'CANONICAL_READBACK',lastCode:existing.lastCode,createdAt:existing.createdAt,updatedAt:current.canonical.readAt})];
    }
    const authorized=validateAuthorized(await binding.authority.ensureCancelNotice({orderId,requestId,intent:'CANCEL_NOTICE_REQUIRED'}));
    if(authorized.job.orderId!==orderId||authorized.job.jobType!=='CANCEL_NOTICE'||authorized.job.purpose!=='CANCEL_NOTICE'||authorized.job.kickDrawer)throw new Error('MFP_CANCEL_NOTICE_POLICY_INVALID');
    return [await dispatchAuthorized(authorized)];
  });

  return Object.freeze({
    read,
    dispatchCanonical:async(canonicalPrintJobId:string)=>dispatchAuthorized(await binding.authority.authorizeDispatch(canonicalPrintJobId)),
    requestReprint,requestSafeRetry,ensureCancelNotice,
    applyBinding:async(value:unknown)=>binding.gateway.applyEndpointBinding(validateMfpPrinterBinding(value)),
    probeEndpoint:(bindingId:string)=>binding.gateway.probeEndpoint(text(bindingId,'MFP_PRINTER_BINDING_ID_REQUIRED')),
    testEndpoint:(bindingId:string)=>binding.gateway.testEndpoint(text(bindingId,'MFP_PRINTER_BINDING_ID_REQUIRED')),
  });
}

export type MfpPrintHardwareSession=ReturnType<typeof createMfpPrintHardwareSession>;
