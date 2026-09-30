import {validateMfkAdminConfigEnvelope,type MfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';

const STORE_ID='MF01';

function apiBase(){
  return (import.meta.env.VITE_MFK_ADMIN_API_BASE as string|undefined)?.replace(/\/$/,'')??'';
}

export const v3AdminCanonicalQueryKey=['mfk','admin-v3','canonical','active',STORE_ID] as const;

export async function readV3CanonicalAdminActive(sessionToken:string):Promise<MfkAdminConfigEnvelope>{
  if(!sessionToken)throw new Error('V3_ADMIN_SESSION_REQUIRED');
  const response=await fetch(apiBase()+'/api/admin-browser/active?storeId='+encodeURIComponent(STORE_ID),{
    method:'GET',
    cache:'no-store',
    credentials:'include',
    headers:{'x-mfk-admin-session':sessionToken},
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(body.message||body.code||'V3_ADMIN_CANONICAL_HTTP_'+response.status));
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
    snapshotSections:Object.keys(envelope.snapshot).filter(key=>envelope.snapshot[key]!==undefined).sort(),
  });
}
