export const MFK_ADMIN_CONFIG_SYNC_SCHEMA='MFK_ADMIN_CONFIG_SYNC_V1' as const;
export const MFK_ADMIN_CONFIG_STORE_ID='MF01' as const;

export interface MfkAdminConfigEnvelope{
  readonly schema:typeof MFK_ADMIN_CONFIG_SYNC_SCHEMA;
  readonly storeId:string;
  readonly revision:number;
  readonly publishedAt:string;
  readonly adminFingerprint:string;
  readonly snapshot:Readonly<Record<string,unknown>>;
  readonly fingerprint:string;
}

export interface MfkAdminConfigAck{
  readonly schema:'MFK_ADMIN_CONFIG_ACK_V1';
  readonly storeId:string;
  readonly deviceId:string;
  readonly revision:number;
  readonly fingerprint:string;
  readonly appliedAt:string;
  readonly disposition:'APPLIED'|'IDEMPOTENT';
}

function object(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}
function text(value:unknown,code:string,max=200){
  if(typeof value!=='string')throw new Error(code);
  const v=value.trim();
  if(!v||v.length>max)throw new Error(code);
  return v;
}
function revision(value:unknown,code:string){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1)throw new Error(code);
  return n;
}
function canonicalPayload(value:Omit<MfkAdminConfigEnvelope,'fingerprint'>){
  return JSON.stringify({
    schema:value.schema,
    storeId:value.storeId,
    revision:value.revision,
    publishedAt:value.publishedAt,
    adminFingerprint:value.adminFingerprint,
    snapshot:value.snapshot,
  });
}
function fnv1a(value:string){
  let hash=0x811c9dc5;
  for(let i=0;i<value.length;i++){
    hash^=value.charCodeAt(i);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash.toString(16).padStart(8,'0');
}
export function fingerprintMfkAdminConfigEnvelope(value:Omit<MfkAdminConfigEnvelope,'fingerprint'>){
  return 'fnv1a32:'+fnv1a(canonicalPayload(value));
}

export function createMfkAdminConfigEnvelope(input:{
  readonly storeId:string;
  readonly revision:number;
  readonly publishedAt:string;
  readonly adminFingerprint:string;
  readonly snapshot:Readonly<Record<string,unknown>>;
}):MfkAdminConfigEnvelope{
  const base={
    schema:MFK_ADMIN_CONFIG_SYNC_SCHEMA,
    storeId:text(input.storeId,'ADMIN_CONFIG_STORE_ID_INVALID',64),
    revision:revision(input.revision,'ADMIN_CONFIG_REVISION_INVALID'),
    publishedAt:text(input.publishedAt,'ADMIN_CONFIG_PUBLISHED_AT_INVALID',64),
    adminFingerprint:text(input.adminFingerprint,'ADMIN_CONFIG_ADMIN_FINGERPRINT_INVALID',128),
    snapshot:object(input.snapshot,'ADMIN_CONFIG_SNAPSHOT_INVALID'),
  } as const;
  if(!Number.isFinite(Date.parse(base.publishedAt)))throw new Error('ADMIN_CONFIG_PUBLISHED_AT_INVALID');
  if(!base.snapshot.catalog)throw new Error('ADMIN_CONFIG_CATALOG_REQUIRED');
  return Object.freeze({...base,fingerprint:fingerprintMfkAdminConfigEnvelope(base)});
}

export function validateMfkAdminConfigEnvelope(input:unknown):MfkAdminConfigEnvelope{
  const row=object(input,'ADMIN_CONFIG_ENVELOPE_INVALID');
  if(row.schema!==MFK_ADMIN_CONFIG_SYNC_SCHEMA)throw new Error('ADMIN_CONFIG_SCHEMA_UNSUPPORTED');
  const base={
    schema:MFK_ADMIN_CONFIG_SYNC_SCHEMA,
    storeId:text(row.storeId,'ADMIN_CONFIG_STORE_ID_INVALID',64),
    revision:revision(row.revision,'ADMIN_CONFIG_REVISION_INVALID'),
    publishedAt:text(row.publishedAt,'ADMIN_CONFIG_PUBLISHED_AT_INVALID',64),
    adminFingerprint:text(row.adminFingerprint,'ADMIN_CONFIG_ADMIN_FINGERPRINT_INVALID',128),
    snapshot:object(row.snapshot,'ADMIN_CONFIG_SNAPSHOT_INVALID'),
  } as const;
  if(!Number.isFinite(Date.parse(base.publishedAt)))throw new Error('ADMIN_CONFIG_PUBLISHED_AT_INVALID');
  if(!base.snapshot.catalog)throw new Error('ADMIN_CONFIG_CATALOG_REQUIRED');
  const expected=fingerprintMfkAdminConfigEnvelope(base);
  if(row.fingerprint!==expected)throw new Error('ADMIN_CONFIG_FINGERPRINT_MISMATCH');
  return Object.freeze({...base,fingerprint:expected});
}

export function validateMfkAdminConfigAck(input:unknown):MfkAdminConfigAck{
  const row=object(input,'ADMIN_CONFIG_ACK_INVALID');
  if(row.schema!=='MFK_ADMIN_CONFIG_ACK_V1')throw new Error('ADMIN_CONFIG_ACK_SCHEMA_UNSUPPORTED');
  const disposition=row.disposition;
  if(disposition!=='APPLIED'&&disposition!=='IDEMPOTENT')throw new Error('ADMIN_CONFIG_ACK_DISPOSITION_INVALID');
  const out={
    schema:'MFK_ADMIN_CONFIG_ACK_V1' as const,
    storeId:text(row.storeId,'ADMIN_CONFIG_ACK_STORE_ID_INVALID',64),
    deviceId:text(row.deviceId,'ADMIN_CONFIG_ACK_DEVICE_ID_INVALID',128),
    revision:revision(row.revision,'ADMIN_CONFIG_ACK_REVISION_INVALID'),
    fingerprint:text(row.fingerprint,'ADMIN_CONFIG_ACK_FINGERPRINT_INVALID',128),
    appliedAt:text(row.appliedAt,'ADMIN_CONFIG_ACK_APPLIED_AT_INVALID',64),
    disposition,
  };
  if(!Number.isFinite(Date.parse(out.appliedAt)))throw new Error('ADMIN_CONFIG_ACK_APPLIED_AT_INVALID');
  return Object.freeze(out);
}
