import {
  validateMfkAdminConfigEnvelope,
  type MfkAdminConfigEnvelope,
} from '../../contracts/admin-config-sync-v1.ts';

function apiBase(){
  return (import.meta.env.VITE_MFK_ADMIN_API_BASE as string|undefined)?.replace(/\/$/,'')??'';
}

export function v3AdminCanonicalQueryKey(storeId:string){
  return ['mfk','admin-v3','canonical','active',storeId] as const;
}

export function v3AdminCanonicalActiveRequestUrl(storeId:string){
  return apiBase()+'/api/admin-browser/active?storeId='+encodeURIComponent(storeId);
}

export async function readV3CanonicalAdminActive(input:{
  readonly storeId:string;
  readonly sessionToken:string;
}):Promise<MfkAdminConfigEnvelope>{
  if(!input.sessionToken)throw new Error('V3_ADMIN_SESSION_REQUIRED');
  const response=await fetch(v3AdminCanonicalActiveRequestUrl(input.storeId),{
    method:'GET',
    cache:'no-store',
    credentials:'include',
    headers:{'x-mfk-admin-session':input.sessionToken},
  });
  const body=await response.json().catch(()=>({})) as unknown;
  if(!response.ok){
    const row=body&&typeof body==='object'&&!Array.isArray(body)?body as Record<string,unknown>:{};
    throw new Error(String(row.message||row.code||'V3_ADMIN_CANONICAL_HTTP_'+response.status));
  }
  const source=body&&typeof body==='object'&&!Array.isArray(body)?body as Record<string,unknown>:{};
  const snapshot=source.snapshot&&typeof source.snapshot==='object'&&!Array.isArray(source.snapshot)?source.snapshot as Record<string,unknown>:{};
  if(typeof source.revision!=='number')throw new Error('V3_ADMIN_CANONICAL_REVISION_INVALID');
  if([source,snapshot].some(row=>row.preview===true||row.previewMode===true||row.source==='PREVIEW'||row.source==='preview'||Object.hasOwn(row,'draftId')||Object.hasOwn(row,'workingSnapshot')))throw new Error('V3_ADMIN_CANONICAL_PREVIEW_OR_DRAFT_REJECTED');
  const envelope=validateMfkAdminConfigEnvelope(body);
  if(envelope.storeId!==input.storeId)throw new Error('V3_ADMIN_CANONICAL_STORE_MISMATCH');
  return envelope;
}

export function summarizeV3Canonical(envelope:MfkAdminConfigEnvelope){
  const catalog=envelope.snapshot.catalog&&typeof envelope.snapshot.catalog==='object'&&!Array.isArray(envelope.snapshot.catalog)
    ?envelope.snapshot.catalog as Record<string,unknown>
    :{};
  const count=(key:string)=>Array.isArray(catalog[key])?catalog[key].length:0;
  return Object.freeze({
    storeId:envelope.storeId,
    publishedAt:envelope.publishedAt,
    revision:envelope.revision,
    fingerprint:envelope.fingerprint,
    adminFingerprint:envelope.adminFingerprint,
    categories:count('categories'),
    products:count('products'),
    modifierGroups:count('modifierGroups'),
    combos:count('combos'),
  });
}
