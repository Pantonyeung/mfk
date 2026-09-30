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

export async function readV3CanonicalAdminActive(input:{
  readonly storeId:string;
  readonly sessionToken:string;
}):Promise<MfkAdminConfigEnvelope>{
  if(!input.sessionToken)throw new Error('V3_ADMIN_SESSION_REQUIRED');
  const response=await fetch(apiBase()+'/api/admin-browser/active?storeId='+encodeURIComponent(input.storeId),{
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
  return validateMfkAdminConfigEnvelope(body);
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
