import {createContext,useContext,type ReactNode} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import type {MfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {v3AdminCanonicalQueryKey} from './canonical.ts';

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

export async function publishV3FormalDraft(input:{storeId:string;sessionToken:string;draft:V3FormalAdminDraft}){
  const response=await fetch(endpoint('/api/admin-browser/draft/publish',input.storeId),{
    method:'POST',
    credentials:'include',
    headers:authHeaders(input.sessionToken,true),
    body:JSON.stringify({draftId:input.draft.draftId,expectedDraftRevision:input.draft.draftRevision}),
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
  readonly saveSnapshot:(snapshot:Record<string,unknown>)=>Promise<V3FormalAdminDraft>;
  readonly mutateSnapshot:(mutator:(current:Record<string,unknown>)=>Record<string,unknown>)=>Promise<V3FormalAdminDraft>;
  readonly createProduct:(product:{name:string;categoryId:string;basePrice:string;description:string;active:boolean})=>Promise<V3FormalProductCreateResult>;
  readonly discard:()=>Promise<void>;
  readonly publish:()=>Promise<Record<string,unknown>>;
  readonly refresh:()=>Promise<void>;
}

const FormalDraftContext=createContext<FormalDraftContextValue|null>(null);

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
    mutationFn:(snapshot:Record<string,unknown>)=>putV3FormalDraft({
      storeId,
      sessionToken,
      canonical,
      currentDraft:queryClient.getQueryData<V3FormalAdminDraft|null>(key)??null,
      snapshot,
    }),
    onSuccess:draft=>queryClient.setQueryData(key,draft),
  });


  const createProductMutation=useMutation({
    mutationFn:(product:{name:string;categoryId:string;basePrice:string;description:string;active:boolean})=>createV3FormalProduct({
      storeId,
      sessionToken,
      canonical,
      currentDraft:queryClient.getQueryData<V3FormalAdminDraft|null>(key)??null,
      product,
    }),
    onSuccess:result=>queryClient.setQueryData(key,result.draft),
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
      return publishV3FormalDraft({storeId,sessionToken,draft});
    },
    onSuccess:async()=>{
      queryClient.setQueryData(key,null);
      await queryClient.invalidateQueries({queryKey:v3AdminCanonicalQueryKey(storeId)});
    },
  });

  const draft=query.data??null;
  const canonicalSnapshot=(canonical.snapshot&&typeof canonical.snapshot==='object'&&!Array.isArray(canonical.snapshot)
    ?canonical.snapshot
    :{}) as Record<string,unknown>;
  const workingSnapshot=draft?.snapshot??canonicalSnapshot;
  const error=(query.error??saveMutation.error??createProductMutation.error??discardMutation.error??publishMutation.error) as Error|null;

  const value:FormalDraftContextValue={
    canonical,
    draft,
    workingSnapshot,
    isLoading:query.isPending,
    isSaving:saveMutation.isPending||createProductMutation.isPending||discardMutation.isPending,
    isPublishing:publishMutation.isPending,
    error,
    saveSnapshot:snapshot=>saveMutation.mutateAsync(snapshot),
    mutateSnapshot:mutator=>saveMutation.mutateAsync(mutator(workingSnapshot)),
    createProduct:product=>createProductMutation.mutateAsync(product),
    discard:async()=>{await discardMutation.mutateAsync();},
    publish:()=>publishMutation.mutateAsync(),
    refresh:async()=>{await query.refetch();},
  };
  return <FormalDraftContext.Provider value={value}>{children}</FormalDraftContext.Provider>;
}

export function useV3FormalDraft(){
  const value=useContext(FormalDraftContext);
  if(!value)throw new Error('V3_FORMAL_DRAFT_PROVIDER_REQUIRED');
  return value;
}
