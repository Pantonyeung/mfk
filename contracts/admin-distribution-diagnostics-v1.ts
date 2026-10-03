import type {
  MfkSyncAppliedAck,
  MfkSyncCheckpointPointer,
  MfkSyncHead,
  MfkSyncPort,
} from './checkpointed-delta-sync-v1.ts';

export const MFK_ADMIN_DISTRIBUTION_DIAGNOSTICS_SCHEMA='MFK_ADMIN_DISTRIBUTION_DIAGNOSTICS_V1' as const;
const PORTS=['SMT','SMM','CUSTOMER','KEETA'] as const;

export type MfkAdminDistributionGlobalState='CURRENT'|'PARTIAL'|'ATTENTION'|'UNKNOWN';
export type MfkAdminDistributionPortState='CURRENT'|'AVAILABLE'|'BEHIND'|'PENDING'|'STALE'|'UNKNOWN'|'REJECTED'|'RECOVERY_REQUIRED'|'ERROR';
export type MfkAdminCheckpointState='HEALTHY'|'BUILDING'|'STALE'|'FAILED'|'CORRUPT'|'UNKNOWN';
export type MfkAdminFreshnessState='FRESH'|'STALE'|'UNKNOWN';

type DiagnosticErrorInput=Readonly<Record<string,unknown>>|null|undefined;
type CheckpointInput=Readonly<{
  pointer?:MfkSyncCheckpointPointer|null;
  meta?:Readonly<Record<string,unknown>>|null;
  error?:DiagnosticErrorInput;
  r2Readback?:Readonly<{verified:boolean;observedAt:string;error?:string|null}>|null;
}>;

export interface MfkAdminDistributionDiagnosticsInput{
  readonly canonical?:Readonly<{
    storeId:string;
    canonicalRevision:number;
    commitId:string;
    sourceCommitSeq:number;
    canonicalFingerprint:string;
    publishedAt:string;
  }>|null;
  readonly heads:Partial<Readonly<Record<MfkSyncPort,MfkSyncHead>>>;
  readonly applied:readonly MfkSyncAppliedAck[];
  readonly provider?:Readonly<{status?:Readonly<Record<string,unknown>>|null;error?:DiagnosticErrorInput}>|null;
  readonly checkpoints:Partial<Readonly<Record<MfkSyncPort,CheckpointInput>>>;
  readonly projectionErrors:readonly Readonly<Record<string,unknown>>[];
  readonly commercialProof?:Readonly<{state:'HEALTHY'|'ERROR'|'UNKNOWN';observedAt:string;error?:string|null}>|null;
  readonly observedAt:string;
  readonly staleAfterMs?:number|null;
  readonly checkpointMaxAgeMs?:number|null;
}

export interface MfkAdminDiagnosticError{
  readonly domain:'PROJECTION'|'CHECKPOINT'|'PROVIDER';
  readonly port:MfkSyncPort;
  readonly code:string;
  readonly firstObservedAt:string|null;
  readonly lastObservedAt:string;
  readonly headSeq:number;
  readonly sourceCommitSeq:number;
  readonly operatorMeaning:string;
}

export interface MfkAdminFreshness{
  readonly state:MfkAdminFreshnessState;
  readonly observedAt:string|null;
  readonly ageMs:number|null;
}

export interface MfkAdminTrackedClientDiagnostic{
  readonly clientId:string;
  readonly headSeq:number;
  readonly appliedSeq:number;
  readonly behind:number;
  readonly projectionHashMatch:boolean;
  readonly lastAppliedAt:string;
  readonly lastSeenAt:string;
  readonly checkpointSeq:number|null;
  readonly state:'CURRENT'|'BEHIND'|'STALE'|'UNKNOWN'|'ERROR';
  readonly freshness:MfkAdminFreshness;
}

export interface MfkAdminPortHeadDiagnostic{
  readonly port:MfkSyncPort;
  readonly headSeq:number;
  readonly checkpointSeq:number;
  readonly journalFloorSeq:number;
  readonly projectionHash:string;
  readonly sourceCommitSeq:number;
  readonly observedAt:string;
}

export interface MfkAdminClientPortDiagnostic extends MfkAdminPortHeadDiagnostic{
  readonly state:'CURRENT'|'BEHIND'|'STALE'|'UNKNOWN'|'ERROR';
  readonly behind:number;
  readonly coverage:'TRACKED_CLIENTS_ONLY';
  readonly clients:readonly MfkAdminTrackedClientDiagnostic[];
  readonly error:MfkAdminDiagnosticError|null;
}

export interface MfkAdminCustomerPortDiagnostic extends MfkAdminPortHeadDiagnostic{
  readonly state:'AVAILABLE'|'UNKNOWN'|'ERROR';
  readonly distributionState:'AVAILABLE'|'UNKNOWN'|'ERROR';
  readonly browserCoverage:'NOT_GLOBALLY_TRACKED';
  readonly commercialProofIssuer:'HEALTHY'|'UNKNOWN'|'ERROR';
  readonly error:MfkAdminDiagnosticError|null;
}

export interface MfkAdminKeetaPortDiagnostic extends MfkAdminPortHeadDiagnostic{
  readonly state:'CURRENT'|'BEHIND'|'PENDING'|'UNKNOWN'|'REJECTED'|'RECOVERY_REQUIRED'|'ERROR';
  readonly providerAppliedSeq:number;
  readonly behind:number;
  readonly lastOperationId:string|null;
  readonly lastMutationKind:string|null;
  readonly lastTaskId:number|string|null;
  readonly lastProviderState:string;
  readonly lastError:string|null;
  readonly freshness:MfkAdminFreshness;
  readonly error:MfkAdminDiagnosticError|null;
}

export interface MfkAdminCheckpointDiagnostic{
  readonly port:MfkSyncPort;
  readonly state:MfkAdminCheckpointState;
  readonly checkpointSeq:number;
  readonly currentObjectHash:string|null;
  readonly previousCheckpointSeq:number|null;
  readonly journalFloorSeq:number;
  readonly checkpointAgeMs:number|null;
  readonly lastBuildState:string;
  readonly lastBuildError:string|null;
  readonly r2ReadbackVerified:boolean;
  readonly observedAt:string;
}

export interface MfkAdminDistributionDiagnostics{
  readonly schema:typeof MFK_ADMIN_DISTRIBUTION_DIAGNOSTICS_SCHEMA;
  readonly canonical:Readonly<{
    state:'PUBLISHED'|'UNKNOWN';
    storeId:string;
    canonicalRevision:number;
    commitId:string;
    sourceCommitSeq:number;
    canonicalFingerprint:string;
    publishedAt:string;
  }>;
  readonly ports:Readonly<{
    SMT:MfkAdminClientPortDiagnostic;
    SMM:MfkAdminClientPortDiagnostic;
    CUSTOMER:MfkAdminCustomerPortDiagnostic;
    KEETA:MfkAdminKeetaPortDiagnostic;
  }>;
  readonly checkpoints:Readonly<Record<MfkSyncPort,MfkAdminCheckpointDiagnostic>>;
  readonly errors:readonly MfkAdminDiagnosticError[];
  readonly freshnessPolicy:Readonly<{state:'LOCKED'|'OWNER_LOCK_REQUIRED';staleAfterMs:number|null}>;
  readonly globalState:MfkAdminDistributionGlobalState;
  readonly observedAt:string;
}

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}

function nonNegative(value:unknown){
  const number=Number(value);
  return Number.isSafeInteger(number)&&number>=0?number:0;
}

function instant(value:unknown,fallback:string){
  const text=String(value||'');
  return Number.isFinite(Date.parse(text))?text:fallback;
}

function safeCode(value:unknown,fallback:string){
  const text=String(value||'').trim();
  return /^[A-Z][A-Z0-9_]{0,127}$/.test(text)?text:fallback;
}

function freshness(observedAt:unknown,nowMs:number,staleAfterMs:number|null):MfkAdminFreshness{
  const value=String(observedAt||'');
  const at=Date.parse(value);
  if(!Number.isFinite(at)||at>nowMs)return Object.freeze({state:'UNKNOWN',observedAt:null,ageMs:null});
  const ageMs=Math.max(0,nowMs-at);
  if(staleAfterMs===null)return Object.freeze({state:'UNKNOWN',observedAt:value,ageMs});
  return Object.freeze({state:ageMs>staleAfterMs?'STALE':'FRESH',observedAt:value,ageMs});
}

function headDiagnostic(port:MfkSyncPort,head:MfkSyncHead|undefined,observedAt:string):MfkAdminPortHeadDiagnostic{
  return Object.freeze({
    port,
    headSeq:nonNegative(head?.headSeq),
    checkpointSeq:nonNegative(head?.checkpointSeq),
    journalFloorSeq:nonNegative(head?.journalFloorSeq),
    projectionHash:String(head?.projectionHash||''),
    sourceCommitSeq:nonNegative(head?.sourceCommitSeq),
    observedAt:instant(head?.observedAt,observedAt),
  });
}

function operatorMeaning(domain:MfkAdminDiagnosticError['domain']){
  if(domain==='PROJECTION')return 'Port projection failed; Canonical publish remains a separate fact.';
  if(domain==='CHECKPOINT')return 'Checkpoint recovery evidence needs attention; Port Head and Applied state remain separate.';
  return 'Provider delivery or readback needs attention; accepted does not mean applied.';
}

function normalizeError(
  domain:MfkAdminDiagnosticError['domain'],port:MfkSyncPort,input:DiagnosticErrorInput,
  head:MfkSyncHead|undefined,observedAt:string,
):MfkAdminDiagnosticError|null{
  if(!input)return null;
  const value=record(input);
  return Object.freeze({
    domain,port,
    code:safeCode(value.code??value.error,domain+'_ERROR_REDACTED'),
    firstObservedAt:Number.isFinite(Date.parse(String(value.firstObservedAt||'')))?String(value.firstObservedAt):null,
    lastObservedAt:instant(value.lastObservedAt??value.observedAt,observedAt),
    headSeq:nonNegative(value.headSeq??head?.headSeq),
    sourceCommitSeq:nonNegative(value.sourceCommitSeq??head?.sourceCommitSeq),
    operatorMeaning:operatorMeaning(domain),
  });
}

function clientPort(
  port:'SMT'|'SMM',head:MfkSyncHead|undefined,acks:readonly MfkSyncAppliedAck[],
  projectionError:MfkAdminDiagnosticError|null,observedAt:string,nowMs:number,staleAfterMs:number|null,
):MfkAdminClientPortDiagnostic{
  const base=headDiagnostic(port,head,observedAt);
  const clients=acks.filter(ack=>ack.port===port).map(ack=>{
    const behind=Math.max(0,base.headSeq-nonNegative(ack.appliedSeq));
    const projectionHashMatch=String(ack.projectionHash||'')===base.projectionHash;
    const currentFreshness=freshness(ack.appliedAt,nowMs,staleAfterMs);
    const state=ack.appliedSeq>base.headSeq||(ack.appliedSeq===base.headSeq&&!projectionHashMatch)
      ?'ERROR'
      :behind>0
        ?'BEHIND'
        :currentFreshness.state==='STALE'
          ?'STALE'
          :currentFreshness.state==='UNKNOWN'
            ?'UNKNOWN'
            :'CURRENT';
    return Object.freeze({
      clientId:String(ack.clientId),headSeq:base.headSeq,appliedSeq:nonNegative(ack.appliedSeq),behind,
      projectionHashMatch,lastAppliedAt:String(ack.appliedAt),lastSeenAt:String(ack.appliedAt),
      checkpointSeq:ack.checkpointSeq===undefined?null:nonNegative(ack.checkpointSeq),state,freshness:currentFreshness,
    }) as MfkAdminTrackedClientDiagnostic;
  }).sort((left,right)=>left.clientId.localeCompare(right.clientId));
  const states=clients.map(client=>client.state);
  const state=projectionError||states.includes('ERROR')?'ERROR'
    :states.includes('BEHIND')?'BEHIND'
      :states.includes('STALE')?'STALE'
        :!head||!clients.length||states.includes('UNKNOWN')?'UNKNOWN':'CURRENT';
  return Object.freeze({...base,state,behind:clients.reduce((max,client)=>Math.max(max,client.behind),0),coverage:'TRACKED_CLIENTS_ONLY',clients:Object.freeze(clients),error:projectionError});
}

function customerPort(
  head:MfkSyncHead|undefined,projectionError:MfkAdminDiagnosticError|null,
  commercialProof:MfkAdminDistributionDiagnosticsInput['commercialProof'],observedAt:string,
):MfkAdminCustomerPortDiagnostic{
  const base=headDiagnostic('CUSTOMER',head,observedAt);
  const state=projectionError?'ERROR':head?'AVAILABLE':'UNKNOWN';
  return Object.freeze({...base,state,distributionState:state,browserCoverage:'NOT_GLOBALLY_TRACKED',
    commercialProofIssuer:commercialProof?.state??'UNKNOWN',error:projectionError});
}

function keetaPort(
  head:MfkSyncHead|undefined,statusInput:Readonly<Record<string,unknown>>|null|undefined,
  providerError:MfkAdminDiagnosticError|null,projectionError:MfkAdminDiagnosticError|null,
  observedAt:string,nowMs:number,staleAfterMs:number|null,
):MfkAdminKeetaPortDiagnostic{
  const base=headDiagnostic('KEETA',head,observedAt);
  const status=record(statusInput),lastOperation=record(status.lastOperation),lastOperationText=typeof status.lastOperation==='string'?status.lastOperation:null;
  const providerAppliedSeq=nonNegative(status.providerAppliedSeq);
  const behind=Math.max(0,base.headSeq-providerAppliedSeq);
  const lastProviderState=String(status.state||'UNKNOWN').toUpperCase();
  const providerFreshness=freshness(status.observedAt,nowMs,staleAfterMs);
  const recovery=String(status.error||providerError?.code||'').includes('CHECKPOINT_REQUIRED')||String(status.error||providerError?.code||'').includes('JOURNAL_GAP');
  const state=projectionError?'ERROR'
    :!head?'UNKNOWN'
      :providerAppliedSeq>base.headSeq?'ERROR'
        :lastProviderState==='REJECTED'?'REJECTED'
      :recovery?'RECOVERY_REQUIRED'
        :providerError?'ERROR'
        :lastProviderState==='PENDING'?'PENDING'
          :lastProviderState==='UNKNOWN'?'UNKNOWN'
            :behind>0?'BEHIND'
              :providerFreshness.state==='FRESH'&&lastProviderState==='APPLIED'?'CURRENT':'UNKNOWN';
  const error=projectionError??providerError;
  const taskId=typeof status.taskId==='string'||Number.isSafeInteger(Number(status.taskId))?status.taskId as string|number:null;
  return Object.freeze({...base,state,providerAppliedSeq,behind,
    lastOperationId:lastOperation.operationId?String(lastOperation.operationId):null,
    lastMutationKind:lastOperation.kind?String(lastOperation.kind):lastOperationText,
    lastTaskId:taskId,lastProviderState,lastError:status.error?safeCode(status.error,'PROVIDER_ERROR_REDACTED'):null,
    freshness:providerFreshness,error});
}

function checkpointDiagnostic(
  port:MfkSyncPort,head:MfkSyncHead|undefined,input:CheckpointInput|undefined,
  observedAt:string,nowMs:number,checkpointMaxAgeMs:number|null,
):MfkAdminCheckpointDiagnostic{
  const pointer=input?.pointer??null,current=pointer?.current,previous=pointer?.previous;
  const meta=record(input?.meta),error=record(input?.error);
  const readback=input?.r2Readback??null;
  const createdAt=String(current?.createdAt||head?.checkpointCreatedAt||'');
  const createdMs=Date.parse(createdAt);
  const checkpointAgeMs=Number.isFinite(createdMs)&&createdMs<=nowMs?Math.max(0,nowMs-createdMs):null;
  const errorCode=safeCode(error.code??error.reason,'CHECKPOINT_ERROR_REDACTED');
  const liveError=safeCode(readback?.error,'CHECKPOINT_READBACK_ERROR_REDACTED');
  const corruptPattern=/(CORRUPT|SHA256|GZIP|JSON|MISMATCH|NOT_FOUND)/;
  let state:MfkAdminCheckpointState='UNKNOWN';
  if(input?.error)state=corruptPattern.test(errorCode)?'CORRUPT':'FAILED';
  else if(readback&&!readback.verified)state=corruptPattern.test(liveError)?'CORRUPT':'FAILED';
  else if(String(meta.state||'')==='BUILDING')state='BUILDING';
  else if(current&&readback?.verified&&checkpointMaxAgeMs!==null&&checkpointAgeMs!==null&&checkpointAgeMs>checkpointMaxAgeMs)state='STALE';
  else if(current&&readback?.verified)state='HEALTHY';
  return Object.freeze({
    port,state,checkpointSeq:nonNegative(current?.checkpointSeq??head?.checkpointSeq),
    currentObjectHash:current?.objectSha256?String(current.objectSha256).slice(0,12):null,
    previousCheckpointSeq:previous?nonNegative(previous.checkpointSeq):null,
    journalFloorSeq:nonNegative(head?.journalFloorSeq),checkpointAgeMs,
    lastBuildState:String(meta.state||(!current&&head?.checkpointHash?'LEGACY_DO':'UNKNOWN')),
    lastBuildError:input?.error?errorCode:readback&&!readback.verified?liveError:null,
    r2ReadbackVerified:Boolean(readback?.verified),observedAt:instant(readback?.observedAt,observedAt),
  });
}

export function buildMfkAdminDistributionDiagnostics(input:MfkAdminDistributionDiagnosticsInput):MfkAdminDistributionDiagnostics{
  const observedAt=instant(input.observedAt,new Date().toISOString()),nowMs=Date.parse(observedAt);
  const staleAfterMs=Number.isSafeInteger(Number(input.staleAfterMs))&&Number(input.staleAfterMs)>0?Number(input.staleAfterMs):null;
  const checkpointMaxAgeMs=Number.isSafeInteger(Number(input.checkpointMaxAgeMs))&&Number(input.checkpointMaxAgeMs)>0?Number(input.checkpointMaxAgeMs):null;
  const projectionByPort=new Map<MfkSyncPort,MfkAdminDiagnosticError>();
  for(const raw of input.projectionErrors){
    const port=String(raw.port||'') as MfkSyncPort;
    if(!PORTS.includes(port))continue;
    const normalized=normalizeError('PROJECTION',port,raw,input.heads[port],observedAt);
    if(normalized)projectionByPort.set(port,normalized);
  }
  const providerError=normalizeError('PROVIDER','KEETA',input.provider?.error,input.heads.KEETA,observedAt);
  const ports=Object.freeze({
    SMT:clientPort('SMT',input.heads.SMT,input.applied,projectionByPort.get('SMT')??null,observedAt,nowMs,staleAfterMs),
    SMM:clientPort('SMM',input.heads.SMM,input.applied,projectionByPort.get('SMM')??null,observedAt,nowMs,staleAfterMs),
    CUSTOMER:customerPort(input.heads.CUSTOMER,projectionByPort.get('CUSTOMER')??null,input.commercialProof,observedAt),
    KEETA:keetaPort(input.heads.KEETA,input.provider?.status,providerError,projectionByPort.get('KEETA')??null,observedAt,nowMs,staleAfterMs),
  });
  const checkpoints=Object.freeze(Object.fromEntries(PORTS.map(port=>[
    port,checkpointDiagnostic(port,input.heads[port],input.checkpoints[port],observedAt,nowMs,checkpointMaxAgeMs),
  ])) as unknown as Record<MfkSyncPort,MfkAdminCheckpointDiagnostic>);
  const checkpointErrors=PORTS.map(port=>{
    const checkpoint=input.checkpoints[port];
    const liveError=checkpoint?.r2Readback&&!checkpoint.r2Readback.verified
      ?{code:checkpoint.r2Readback.error||'CHECKPOINT_R2_READBACK_FAILED',observedAt:checkpoint.r2Readback.observedAt}
      :null;
    return normalizeError('CHECKPOINT',port,checkpoint?.error??liveError,input.heads[port],observedAt);
  }).filter(Boolean) as MfkAdminDiagnosticError[];
  const errors=Object.freeze([...projectionByPort.values(),...checkpointErrors,...(providerError?[providerError]:[])]);
  const canonical=input.canonical?Object.freeze({state:'PUBLISHED' as const,...input.canonical}):Object.freeze({
    state:'UNKNOWN' as const,storeId:'',canonicalRevision:0,commitId:'',sourceCommitSeq:0,canonicalFingerprint:'',publishedAt:'',
  });
  const portStates=[ports.SMT.state,ports.SMM.state,ports.CUSTOMER.state,ports.KEETA.state];
  const checkpointStates=PORTS.map(port=>checkpoints[port].state);
  const globalState:MfkAdminDistributionGlobalState=canonical.state==='UNKNOWN'?'UNKNOWN'
    :errors.length||ports.CUSTOMER.commercialProofIssuer==='ERROR'||portStates.some(state=>['ERROR','REJECTED','RECOVERY_REQUIRED'].includes(state))||checkpointStates.some(state=>state==='FAILED'||state==='CORRUPT')?'ATTENTION'
      :portStates.some(state=>['BEHIND','PENDING','STALE'].includes(state))||checkpointStates.some(state=>state==='STALE'||state==='BUILDING')?'PARTIAL'
        :ports.CUSTOMER.commercialProofIssuer==='UNKNOWN'||portStates.includes('UNKNOWN')||checkpointStates.includes('UNKNOWN')?'UNKNOWN':'CURRENT';
  return Object.freeze({
    schema:MFK_ADMIN_DISTRIBUTION_DIAGNOSTICS_SCHEMA,canonical,ports,checkpoints,errors,
    freshnessPolicy:Object.freeze({state:staleAfterMs===null?'OWNER_LOCK_REQUIRED':'LOCKED',staleAfterMs}),
    globalState,observedAt,
  });
}

export function validateMfkAdminDistributionDiagnostics(input:unknown):MfkAdminDistributionDiagnostics{
  const value=record(input);
  if(value.schema!==MFK_ADMIN_DISTRIBUTION_DIAGNOSTICS_SCHEMA)throw new Error('ADMIN_DISTRIBUTION_DIAGNOSTICS_SCHEMA_INVALID');
  if(!Number.isFinite(Date.parse(String(value.observedAt||''))))throw new Error('ADMIN_DISTRIBUTION_DIAGNOSTICS_OBSERVED_AT_INVALID');
  const ports=record(value.ports),checkpoints=record(value.checkpoints),canonical=record(value.canonical);
  if(!['PUBLISHED','UNKNOWN'].includes(String(canonical.state)))throw new Error('ADMIN_DISTRIBUTION_DIAGNOSTICS_CANONICAL_INVALID');
  for(const port of PORTS){
    if(record(ports[port]).port!==port||record(checkpoints[port]).port!==port)throw new Error('ADMIN_DISTRIBUTION_DIAGNOSTICS_PORT_INVALID:'+port);
  }
  if(!['CURRENT','PARTIAL','ATTENTION','UNKNOWN'].includes(String(value.globalState)))throw new Error('ADMIN_DISTRIBUTION_DIAGNOSTICS_GLOBAL_STATE_INVALID');
  if(!Array.isArray(value.errors))throw new Error('ADMIN_DISTRIBUTION_DIAGNOSTICS_ERRORS_INVALID');
  return Object.freeze(value as unknown as MfkAdminDistributionDiagnostics);
}
