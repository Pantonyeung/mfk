export interface V3CanonicalAdminEnvelope{
  readonly schema:'MFK_ADMIN_CONFIG_SYNC_V1';
  readonly storeId:string;
  readonly revision:number;
  readonly publishedAt:string;
  readonly adminFingerprint:string;
  readonly snapshot:Readonly<Record<string,unknown>>;
  readonly fingerprint:string;
}

function fingerprintV3Canonical(input:Omit<V3CanonicalAdminEnvelope,'fingerprint'>){
  const canonical=JSON.stringify({
    schema:input.schema,
    storeId:input.storeId,
    revision:input.revision,
    publishedAt:input.publishedAt,
    adminFingerprint:input.adminFingerprint,
    snapshot:input.snapshot,
  });
  let hash=0x811c9dc5;
  for(let index=0;index<canonical.length;index++){
    hash^=canonical.charCodeAt(index);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return 'fnv1a32:'+hash.toString(16).padStart(8,'0');
}

function validateV3CanonicalShape(input:unknown):V3CanonicalAdminEnvelope{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ADMIN_CONFIG_ENVELOPE_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schema!=='MFK_ADMIN_CONFIG_SYNC_V1')throw new Error('ADMIN_CONFIG_SCHEMA_UNSUPPORTED');
  if(typeof row.storeId!=='string'||!row.storeId.trim())throw new Error('ADMIN_CONFIG_STORE_ID_INVALID');
  if(!Number.isSafeInteger(Number(row.revision))||Number(row.revision)<1)throw new Error('ADMIN_CONFIG_REVISION_INVALID');
  if(typeof row.publishedAt!=='string'||!Number.isFinite(Date.parse(row.publishedAt)))throw new Error('ADMIN_CONFIG_PUBLISHED_AT_INVALID');
  if(typeof row.adminFingerprint!=='string'||!row.adminFingerprint.trim())throw new Error('ADMIN_CONFIG_ADMIN_FINGERPRINT_INVALID');
  if(!row.snapshot||typeof row.snapshot!=='object'||Array.isArray(row.snapshot))throw new Error('ADMIN_CONFIG_SNAPSHOT_INVALID');
  if(!(row.snapshot as Record<string,unknown>).catalog)throw new Error('ADMIN_CONFIG_CATALOG_REQUIRED');
  if(typeof row.fingerprint!=='string'||!row.fingerprint.trim())throw new Error('ADMIN_CONFIG_FINGERPRINT_INVALID');
  const base={
    schema:'MFK_ADMIN_CONFIG_SYNC_V1' as const,
    storeId:row.storeId.trim(),
    revision:Number(row.revision),
    publishedAt:row.publishedAt,
    adminFingerprint:row.adminFingerprint.trim(),
    snapshot:row.snapshot as Readonly<Record<string,unknown>>,
  };
  const fingerprint=row.fingerprint.trim();
  if(fingerprint!==fingerprintV3Canonical(base))throw new Error('ADMIN_CONFIG_FINGERPRINT_MISMATCH');
  return Object.freeze({...base,fingerprint});
}

const STORE_ID='MF01';

function apiBase(){
  return (import.meta.env.VITE_MFK_ADMIN_API_BASE as string|undefined)?.replace(/\/$/,'')??'';
}

export const v3AdminCanonicalQueryKey=['mfk','admin-v3','canonical','active',STORE_ID] as const;

export async function readV3CanonicalAdminActive(sessionToken:string):Promise<V3CanonicalAdminEnvelope>{
  if(!sessionToken)throw new Error('V3_ADMIN_SESSION_REQUIRED');
  const response=await fetch(apiBase()+'/api/admin-browser/active?storeId='+encodeURIComponent(STORE_ID),{
    method:'GET',
    cache:'no-store',
    credentials:'include',
    headers:{'x-mfk-admin-session':sessionToken},
  });
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(body.message||body.code||'V3_ADMIN_CANONICAL_HTTP_'+response.status));
  return validateV3CanonicalShape(body);
}

export function summarizeV3Canonical(envelope:V3CanonicalAdminEnvelope){
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
