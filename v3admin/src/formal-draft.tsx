import {assertFormalOptionReadiness} from './formal-option-readiness.ts';
import {createContext,useContext,useEffect,useRef,type ReactNode} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import type {MfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {v3AdminCanonicalQueryKey} from './canonical.ts';
import {prepareV3BusinessConfigurationExtract,type V3BusinessConfigurationExtract} from './business-config-extract.ts';
import {assertFormalPosTenderTransition,hasFormalPosTenders} from './formal-pos-tenders.ts';

export interface V3FormalAdminVersionSummary{
  readonly revision:number;
  readonly publishedAt:string;
  readonly fingerprint:string;
  readonly adminFingerprint:string;
  readonly state:'ACTIVE'|'ARCHIVED';
}
export interface V3FormalAdminVersionList{
  readonly schema:'MFK_ADMIN_VERSION_LIST_V1';
  readonly storeId:string;
  readonly activeFingerprint:string;
  readonly historyCompleteness:'FORWARD_ONLY';
  readonly versions:readonly V3FormalAdminVersionSummary[];
}

export interface V3FormalAdminDraft{
  readonly schema:'MFK_ADMIN_DRAFT_V1';
  readonly storeId:string;
  readonly draftId:string;
  readonly baseFingerprint:string;
  readonly basePublishedAt:string;
  readonly draftRevision:number;
  readonly snapshot:Record<string,unknown>;
  readonly updatedAt:string;
  readonly updatedByStaffId:string;
}

export class V3FormalDraftHttpError extends Error{
  readonly status:number;
  readonly code:string;
  readonly body:Record<string,unknown>;
  constructor(status:number,body:Record<string,unknown>){
    const code=String(body.code||body.message||'V3_ADMIN_DRAFT_HTTP_'+status);
    super(code);
    this.name='V3FormalDraftHttpError';
    this.status=status;
    this.code=code;
    this.body=body;
  }
}

function apiBase(){
  return (import.meta.env.VITE_MFK_ADMIN_API_BASE as string|undefined)?.replace(/\/$/,'')??'';
}
function endpoint(path:string,storeId:string){
  return apiBase()+path+'?storeId='+encodeURIComponent(storeId);
}
async function parseResponse(response:Response){
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new V3FormalDraftHttpError(response.status,body);
  return body;
}
function authHeaders(sessionToken:string,withJson=false){
  return {
    'x-mfk-admin-session':sessionToken,
    ...(withJson?{'content-type':'application/json'}:{}),
  };
}
function validateDraft(value:unknown):V3FormalAdminDraft{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('V3_ADMIN_DRAFT_INVALID');
  const row=value as Record<string,unknown>;
  const snapshot=row.snapshot;
  if(
    row.schema!=='MFK_ADMIN_DRAFT_V1'||
    typeof row.storeId!=='string'||
    typeof row.draftId!=='string'||!row.draftId||
    typeof row.baseFingerprint!=='string'||!row.baseFingerprint||
    typeof row.basePublishedAt!=='string'||
    !Number.isSafeInteger(row.draftRevision)||
    !snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    typeof row.updatedAt!=='string'||
    typeof row.updatedByStaffId!=='string'
  )throw new Error('V3_ADMIN_DRAFT_INVALID');
  return row as unknown as V3FormalAdminDraft;
}

export function v3FormalDraftQueryKey(storeId:string){
  return ['mfk','admin-v3','formal-draft',storeId] as const;
}

export async function readV3FormalDraft(input:{storeId:string;sessionToken:string}):Promise<V3FormalAdminDraft|null>{
  const response=await fetch(endpoint('/api/admin-browser/draft',input.storeId),{
    method:'GET',
    cache:'no-store',
    credentials:'include',
    headers:authHeaders(input.sessionToken),
  });
  if(response.status===404){
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    if(String(body.code||'')==='ADMIN_DRAFT_NOT_FOUND')return null;
    throw new V3FormalDraftHttpError(response.status,body);
  }
  return validateDraft(await parseResponse(response));
}

export async function putV3FormalDraft(input:{
  storeId:string;
  sessionToken:string;
  canonical:MfkAdminConfigEnvelope;
  currentDraft:V3FormalAdminDraft|null;
  snapshot:Record<string,unknown>;
}):Promise<V3FormalAdminDraft>{
  const canonicalSnapshot=input.canonical.snapshot as Record<string,unknown>;
  for(const before of [canonicalSnapshot,input.currentDraft?.snapshot??canonicalSnapshot]){
    if(hasFormalPosTenders(before)||hasFormalPosTenders(input.snapshot))assertFormalPosTenderTransition(before,input.snapshot);
  }
  const baseFingerprint=input.currentDraft?.baseFingerprint??input.canonical.fingerprint;
  const basePublishedAt=input.currentDraft?.basePublishedAt??input.canonical.publishedAt;
  const payload:Record<string,unknown>={
    baseFingerprint,
    basePublishedAt,
    snapshot:input.snapshot,
  };
  if(input.currentDraft)payload.expectedDraftRevision=input.currentDraft.draftRevision;
  const response=await fetch(endpoint('/api/admin-browser/draft',input.storeId),{
    method:'PUT',
    credentials:'include',
    headers:authHeaders(input.sessionToken,true),
    body:JSON.stringify(payload),
  });
  return validateDraft(await parseResponse(response));
}

export async function deleteV3FormalDraft(input:{storeId:string;sessionToken:string;draft:V3FormalAdminDraft}){
  const response=await fetch(endpoint('/api/admin-browser/draft',input.storeId),{
    method:'DELETE',
    credentials:'include',
    headers:authHeaders(input.sessionToken,true),
    body:JSON.stringify({draftId:input.draft.draftId,expectedDraftRevision:input.draft.draftRevision}),
  });
  return parseResponse(response);
}

export async function publishV3FormalDraft(input:{storeId:string;sessionToken:string;canonical:MfkAdminConfigEnvelope;draft:V3FormalAdminDraft}){
  assertFormalPosTenderTransition(input.canonical.snapshot as Record<string,unknown>,input.draft.snapshot);
  assertFormalOptionReadiness(input.draft.snapshot);
  const response=await fetch(endpoint('/api/admin-browser/draft/publish',input.storeId),{
    method:'POST',
    credentials:'include',
    headers:authHeaders(input.sessionToken,true),
    body:JSON.stringify({draftId:input.draft.draftId,expectedDraftRevision:input.draft.draftRevision}),
  });
  return parseResponse(response);
}


function validateVersionList(value:unknown):V3FormalAdminVersionList{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('V3_ADMIN_VERSION_LIST_INVALID');
  const row=value as Record<string,unknown>;
  if(
    row.schema!=='MFK_ADMIN_VERSION_LIST_V1'||
    typeof row.storeId!=='string'||!row.storeId||
    typeof row.activeFingerprint!=='string'||!row.activeFingerprint||
    row.historyCompleteness!=='FORWARD_ONLY'||
    !Array.isArray(row.versions)
  )throw new Error('V3_ADMIN_VERSION_LIST_INVALID');
  const versions=row.versions.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('V3_ADMIN_VERSION_LIST_INVALID');
    const version=item as Record<string,unknown>;
    if(
      !Number.isSafeInteger(version.revision)||
      typeof version.publishedAt!=='string'||!Number.isFinite(Date.parse(version.publishedAt))||
      typeof version.fingerprint!=='string'||!version.fingerprint||
      typeof version.adminFingerprint!=='string'||
      !['ACTIVE','ARCHIVED'].includes(String(version.state))
    )throw new Error('V3_ADMIN_VERSION_LIST_INVALID');
    return version as unknown as V3FormalAdminVersionSummary;
  });
  return {...row,versions} as unknown as V3FormalAdminVersionList;
}

export async function readV3FormalVersions(input:{storeId:string;sessionToken:string}):Promise<V3FormalAdminVersionList>{
  const response=await fetch(endpoint('/api/admin-browser/versions',input.storeId),{
    method:'GET',
    cache:'no-store',
    credentials:'include',
    headers:authHeaders(input.sessionToken),
  });
  return validateVersionList(await parseResponse(response));
}

export async function rollbackV3FormalVersion(input:{
  storeId:string;
  sessionToken:string;
  canonical:MfkAdminConfigEnvelope;
  targetFingerprint:string;
  reason:string;
  operationId:string;
}):Promise<Record<string,unknown>>{
  const response=await fetch(endpoint('/api/admin-browser/versions/rollback',input.storeId),{
    method:'POST',
    credentials:'include',
    headers:authHeaders(input.sessionToken,true),
    body:JSON.stringify({
      operationId:input.operationId,
      targetFingerprint:input.targetFingerprint,
      expectedActiveFingerprint:input.canonical.fingerprint,
      expectedActivePublishedAt:input.canonical.publishedAt,
      expectedActiveRevision:input.canonical.revision,
      reason:input.reason,
    }),
  });
  return parseResponse(response);
}


export interface V3FormalCreatedProduct{
  readonly id:string;
  readonly productCode:string;
  readonly name:string;
  readonly categoryId:string;
  readonly basePrice:string;
  readonly description:string;
  readonly active:boolean;
}

export interface V3FormalProductCreateResult{
  readonly state:'CREATED';
  readonly product:V3FormalCreatedProduct;
  readonly draft:V3FormalAdminDraft;
}

function validateCreatedProduct(value:unknown):V3FormalCreatedProduct{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('V3_ADMIN_PRODUCT_CREATE_INVALID');
  const row=value as Record<string,unknown>;
  if(
    typeof row.id!=='string'||!row.id||
    typeof row.productCode!=='string'||!row.productCode||
    typeof row.name!=='string'||!row.name||
    typeof row.categoryId!=='string'||!row.categoryId||
    typeof row.basePrice!=='string'||
    typeof row.description!=='string'||
    typeof row.active!=='boolean'
  )throw new Error('V3_ADMIN_PRODUCT_CREATE_INVALID');
  return row as unknown as V3FormalCreatedProduct;
}

export async function createV3FormalProduct(input:{
  storeId:string;
  sessionToken:string;
  canonical:MfkAdminConfigEnvelope;
  currentDraft:V3FormalAdminDraft|null;
  product:{name:string;categoryId:string;basePrice:string;description:string;active:boolean};
}):Promise<V3FormalProductCreateResult>{
  const payload:Record<string,unknown>={
    baseFingerprint:input.currentDraft?.baseFingerprint??input.canonical.fingerprint,
    basePublishedAt:input.currentDraft?.basePublishedAt??input.canonical.publishedAt,
    product:input.product,
  };
  if(input.currentDraft)payload.expectedDraftRevision=input.currentDraft.draftRevision;
  const response=await fetch(endpoint('/api/admin-browser/draft/products',input.storeId),{
    method:'POST',
    credentials:'include',
    headers:authHeaders(input.sessionToken,true),
    body:JSON.stringify(payload),
  });
  const body=await parseResponse(response);
  if(body.state!=='CREATED')throw new Error('V3_ADMIN_PRODUCT_CREATE_INVALID');
  return{
    state:'CREATED',
    product:validateCreatedProduct(body.product),
    draft:validateDraft(body.draft),
  };
}

interface FormalDraftContextValue{
  readonly canonical:MfkAdminConfigEnvelope;
  readonly draft:V3FormalAdminDraft|null;
  readonly workingSnapshot:Record<string,unknown>;
  readonly isLoading:boolean;
  readonly isSaving:boolean;
  readonly isPublishing:boolean;
  readonly error:Error|null;
  readonly readError:Error|null;
  readonly saveSnapshot:(snapshot:Record<string,unknown>)=>Promise<V3FormalAdminDraft>;
  readonly mutateSnapshot:(mutator:(current:Record<string,unknown>)=>Record<string,unknown>)=>Promise<V3FormalAdminDraft>;
  readonly createProduct:(product:{name:string;categoryId:string;basePrice:string;description:string;active:boolean})=>Promise<V3FormalProductCreateResult>;
  readonly discard:()=>Promise<void>;
  readonly publish:()=>Promise<Record<string,unknown>>;
  readonly readVersions:()=>Promise<V3FormalAdminVersionList>;
  readonly prepareBusinessConfigurationExtract:()=>Promise<V3BusinessConfigurationExtract>;
  readonly rollbackVersion:(input:{targetFingerprint:string;reason:string;operationId:string})=>Promise<Record<string,unknown>>;
  readonly isRollingBack:boolean;
  readonly refresh:()=>Promise<void>;
}

const FormalDraftContext=createContext<FormalDraftContextValue|null>(null);

/** A late write response must not replace a newer read or cross a draft/store identity. */
function retainNewestDraftResponse(response:V3FormalAdminDraft,current:V3FormalAdminDraft|null|undefined,input:{storeId:string;canonical:MfkAdminConfigEnvelope;currentDraft:V3FormalAdminDraft|null}){
  const expected=input.currentDraft;
  const baseFingerprint=expected?.baseFingerprint??input.canonical.fingerprint;
  const basePublishedAt=expected?.basePublishedAt??input.canonical.publishedAt;
  if(response.storeId!==input.storeId||response.baseFingerprint!==baseFingerprint||response.basePublishedAt!==basePublishedAt||
    (expected&&(response.draftId!==expected.draftId||response.draftRevision<=expected.draftRevision)))throw new Error('V3_ADMIN_DRAFT_RESPONSE_IDENTITY_INVALID');
  if(expected&&!current)throw new Error('V3_ADMIN_DRAFT_RESPONSE_SUPERSEDED');
  if(current){
    if(current.storeId!==response.storeId||current.draftId!==response.draftId||current.baseFingerprint!==response.baseFingerprint||current.basePublishedAt!==response.basePublishedAt)throw new Error('V3_ADMIN_DRAFT_RESPONSE_SUPERSEDED');
    if(current.draftRevision>response.draftRevision)return current;
    if(current.draftRevision===response.draftRevision){
      if(JSON.stringify(current.snapshot)!==JSON.stringify(response.snapshot))throw new Error('V3_ADMIN_DRAFT_RESPONSE_CONFLICT');
      return current;
    }
  }
  return response;
}


export function V3FormalDraftProvider({
  storeId,
  sessionToken,
  canonical,
  children,
}:{
  storeId:string;
  sessionToken:string;
  canonical:MfkAdminConfigEnvelope;
  children:ReactNode;
}){
  const queryClient=useQueryClient();
  const key=v3FormalDraftQueryKey(storeId);
  const writeEpoch=useRef(Symbol('formal-draft-session'));
  useEffect(()=>{writeEpoch.current=Symbol('formal-draft-session');return()=>{writeEpoch.current=Symbol('closed-formal-draft-session');};},[storeId,sessionToken]);
  type WriteContext={storeId:string;sessionToken:string;epoch:symbol;currentDraft:V3FormalAdminDraft|null;canonical:MfkAdminConfigEnvelope};
  const captureWrite=():WriteContext=>({storeId,sessionToken,epoch:writeEpoch.current,currentDraft:queryClient.getQueryData<V3FormalAdminDraft|null>(key)??null,canonical});
  const acceptWrite=async(response:V3FormalAdminDraft,input:WriteContext)=>{
    if(input.epoch!==writeEpoch.current)throw new Error('V3_ADMIN_DRAFT_RESPONSE_SESSION_CHANGED');
    const responseKey=v3FormalDraftQueryKey(input.storeId);
    // A read started before this successful write may still resolve with the older revision.
    // Cancel only this key and never revert a newer cached read while doing so.
    await queryClient.cancelQueries({queryKey:responseKey,exact:true},{revert:false,silent:true});
    if(input.epoch!==writeEpoch.current)throw new Error('V3_ADMIN_DRAFT_RESPONSE_SESSION_CHANGED');
    const current=queryClient.getQueryData<V3FormalAdminDraft|null>(responseKey);
    queryClient.setQueryData(responseKey,retainNewestDraftResponse(response,current,input));
  };
  const query=useQuery({
    queryKey:key,
    queryFn:()=>readV3FormalDraft({storeId,sessionToken}),
    staleTime:0,
    gcTime:0,
    refetchOnMount:'always',
    refetchOnWindowFocus:true,
    refetchOnReconnect:true,
  });

  const saveMutation=useMutation({
    mutationFn:(input:WriteContext&{snapshot:Record<string,unknown>})=>putV3FormalDraft(input),
    onSuccess:(draft,input)=>acceptWrite(draft,input),
  });

  const createProductMutation=useMutation({
    mutationFn:(input:WriteContext&{product:{name:string;categoryId:string;basePrice:string;description:string;active:boolean}})=>createV3FormalProduct(input),
    onSuccess:(result,input)=>acceptWrite(result.draft,input),
  });

  const discardMutation=useMutation({
    mutationFn:async()=>{
      const draft=queryClient.getQueryData<V3FormalAdminDraft|null>(key)??null;
      if(!draft)return;
      await deleteV3FormalDraft({storeId,sessionToken,draft});
    },
    onSuccess:()=>queryClient.setQueryData(key,null),
  });

  const publishMutation=useMutation({
    mutationFn:async()=>{
      const draft=queryClient.getQueryData<V3FormalAdminDraft|null>(key)??null;
      if(!draft)throw new Error('ADMIN_DRAFT_NOT_FOUND');
      return publishV3FormalDraft({storeId,sessionToken,canonical,draft});
    },
    onSuccess:async()=>{
      queryClient.setQueryData(key,null);
      await queryClient.invalidateQueries({queryKey:v3AdminCanonicalQueryKey(storeId)});
    },
  });


  const rollbackMutation=useMutation({
    mutationFn:(input:{targetFingerprint:string;reason:string;operationId:string})=>rollbackV3FormalVersion({
      storeId,
      sessionToken,
      canonical,
      targetFingerprint:input.targetFingerprint,
      reason:input.reason,
      operationId:input.operationId,
    }),
    onSuccess:async()=>{
      await queryClient.invalidateQueries({queryKey:v3AdminCanonicalQueryKey(storeId)});
    },
  });

  const draft=query.data??null;
  const canonicalSnapshot=(canonical.snapshot&&typeof canonical.snapshot==='object'&&!Array.isArray(canonical.snapshot)
    ?canonical.snapshot
    :{}) as Record<string,unknown>;
  const workingSnapshot=draft?.snapshot??canonicalSnapshot;
  const error=(query.error??saveMutation.error??createProductMutation.error??discardMutation.error??publishMutation.error??rollbackMutation.error) as Error|null;

  const value:FormalDraftContextValue={
    canonical,
    draft,
    workingSnapshot,
    isLoading:query.isPending,
    isSaving:saveMutation.isPending||createProductMutation.isPending||discardMutation.isPending,
    isPublishing:publishMutation.isPending,
    error,
    readError:query.error,
    saveSnapshot:snapshot=>saveMutation.mutateAsync({...captureWrite(),snapshot}),
    mutateSnapshot:mutator=>{
      const context=captureWrite();
      const snapshot=mutator(context.currentDraft?.snapshot??canonicalSnapshot);
      // Snapshot, optimistic lock and session identity are captured together before TanStack awaits.
      return saveMutation.mutateAsync({...context,snapshot});
    },
    createProduct:product=>createProductMutation.mutateAsync({...captureWrite(),product}),
    discard:async()=>{await discardMutation.mutateAsync();},
    publish:()=>publishMutation.mutateAsync(),
    readVersions:()=>readV3FormalVersions({storeId,sessionToken}),
    prepareBusinessConfigurationExtract:()=>prepareV3BusinessConfigurationExtract({storeId,sessionToken}),
    rollbackVersion:input=>rollbackMutation.mutateAsync(input),
    isRollingBack:rollbackMutation.isPending,
    refresh:async()=>{await query.refetch();},
  };
  return <FormalDraftContext.Provider value={value}>{children}</FormalDraftContext.Provider>;
}

export function useV3FormalDraft(){
  const value=useContext(FormalDraftContext);
  if(!value)throw new Error('V3_FORMAL_DRAFT_PROVIDER_REQUIRED');
  return value;
}
