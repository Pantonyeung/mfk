import {
  MFK_ADMIN_MENU_INDEX_SCHEMA,
  validateMfkAdminMenuIndexRevision,
  type MfkAdminMenuIndexRevision,
} from './admin-menu-index-v1.ts';

export const MFK_ADMIN_MENU_TRANSFER_SCHEMA='MFK_ADMIN_MENU_TRANSFER_V1' as const;
export const MFK_ADMIN_MENU_READBACK_SCHEMA='MFK_ADMIN_MENU_READBACK_V1' as const;
export const MFK_ADMIN_MENU_A2_SEAM_ID='ADMIN_MENU_INDEX_A2' as const;

export interface MfkAdminMenuTransferBundle{
  readonly schema:typeof MFK_ADMIN_MENU_TRANSFER_SCHEMA;
  readonly seamId:typeof MFK_ADMIN_MENU_A2_SEAM_ID;
  readonly sourcePort:'ADMIN';
  readonly targetPort:'SMT';
  readonly transportId:string;
  readonly createdAt:string;
  readonly revision:MfkAdminMenuIndexRevision;
}

export interface MfkAdminMenuReadbackReceipt{
  readonly schema:typeof MFK_ADMIN_MENU_READBACK_SCHEMA;
  readonly seamId:typeof MFK_ADMIN_MENU_A2_SEAM_ID;
  readonly sourcePort:'ADMIN';
  readonly targetPort:'SMT';
  readonly transportId:string;
  readonly observedAt:string;
  readonly deliveryDisposition:'APPLIED'|'IDEMPOTENT'|'REJECTED';
  readonly expectedRevision:number;
  readonly expectedFingerprint:string;
  readonly observedRevision:number;
  readonly observedFingerprint:string;
  readonly state:'MATCH'|'MISMATCH'|'UNKNOWN';
  readonly evidenceRef:string;
  readonly failureCode?:string;
}

function requireIso(value:unknown,code:string){
  if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new Error(code);
  return value;
}
function requireText(value:unknown,code:string,max=180){
  if(typeof value!=='string')throw new Error(code);
  const text=value.trim();
  if(!text||text.length>max)throw new Error(code);
  return text;
}

export function adminMenuTransportId(revision:MfkAdminMenuIndexRevision){
  return 'ADMIN-MENU:R'+revision.revision+':'+revision.fingerprint;
}

export function buildAdminMenuTransferBundle(
  revision:MfkAdminMenuIndexRevision,
  createdAt=new Date().toISOString(),
):MfkAdminMenuTransferBundle{
  const valid=validateMfkAdminMenuIndexRevision(revision);
  requireIso(createdAt,'ADMIN_MENU_TRANSFER_CREATED_AT_INVALID');
  return Object.freeze({
    schema:MFK_ADMIN_MENU_TRANSFER_SCHEMA,
    seamId:MFK_ADMIN_MENU_A2_SEAM_ID,
    sourcePort:'ADMIN',
    targetPort:'SMT',
    transportId:adminMenuTransportId(valid),
    createdAt,
    revision:valid,
  });
}

export function validateAdminMenuTransferBundle(input:unknown):MfkAdminMenuTransferBundle{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ADMIN_MENU_TRANSFER_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schema!==MFK_ADMIN_MENU_TRANSFER_SCHEMA)throw new Error('ADMIN_MENU_TRANSFER_SCHEMA_UNSUPPORTED');
  if(row.seamId!==MFK_ADMIN_MENU_A2_SEAM_ID)throw new Error('ADMIN_MENU_TRANSFER_SEAM_INVALID');
  if(row.sourcePort!=='ADMIN'||row.targetPort!=='SMT')throw new Error('ADMIN_MENU_TRANSFER_PORT_INVALID');
  const createdAt=requireIso(row.createdAt,'ADMIN_MENU_TRANSFER_CREATED_AT_INVALID');
  const revision=validateMfkAdminMenuIndexRevision(row.revision);
  const expectedId=adminMenuTransportId(revision);
  if(row.transportId!==expectedId)throw new Error('ADMIN_MENU_TRANSFER_ID_MISMATCH');
  return Object.freeze({
    schema:MFK_ADMIN_MENU_TRANSFER_SCHEMA,
    seamId:MFK_ADMIN_MENU_A2_SEAM_ID,
    sourcePort:'ADMIN',
    targetPort:'SMT',
    transportId:expectedId,
    createdAt,
    revision,
  });
}

export function buildAdminMenuReadbackReceipt(input:{
  readonly bundle:MfkAdminMenuTransferBundle;
  readonly observedAt?:string;
  readonly deliveryDisposition:'APPLIED'|'IDEMPOTENT'|'REJECTED';
  readonly observedRevision:number;
  readonly observedFingerprint:string;
  readonly failureCode?:string;
}):MfkAdminMenuReadbackReceipt{
  const bundle=validateAdminMenuTransferBundle(input.bundle);
  const observedAt=requireIso(input.observedAt??new Date().toISOString(),'ADMIN_MENU_READBACK_OBSERVED_AT_INVALID');
  if(!Number.isSafeInteger(input.observedRevision)||input.observedRevision<1)throw new Error('ADMIN_MENU_READBACK_REVISION_INVALID');
  const observedFingerprint=requireText(input.observedFingerprint,'ADMIN_MENU_READBACK_FINGERPRINT_INVALID');
  const state=input.deliveryDisposition==='REJECTED'
    ?'MISMATCH'
    :input.observedRevision===bundle.revision.revision&&observedFingerprint===bundle.revision.fingerprint
      ?'MATCH'
      :'MISMATCH';
  const evidenceRef='SMT-LKG:R'+input.observedRevision+':'+observedFingerprint;
  return Object.freeze({
    schema:MFK_ADMIN_MENU_READBACK_SCHEMA,
    seamId:MFK_ADMIN_MENU_A2_SEAM_ID,
    sourcePort:'ADMIN',
    targetPort:'SMT',
    transportId:bundle.transportId,
    observedAt,
    deliveryDisposition:input.deliveryDisposition,
    expectedRevision:bundle.revision.revision,
    expectedFingerprint:bundle.revision.fingerprint,
    observedRevision:input.observedRevision,
    observedFingerprint,
    state,
    evidenceRef,
    ...(input.failureCode?{failureCode:requireText(input.failureCode,'ADMIN_MENU_READBACK_FAILURE_CODE_INVALID')}:{})
  });
}

export function validateAdminMenuReadbackReceipt(input:unknown):MfkAdminMenuReadbackReceipt{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('ADMIN_MENU_READBACK_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schema!==MFK_ADMIN_MENU_READBACK_SCHEMA)throw new Error('ADMIN_MENU_READBACK_SCHEMA_UNSUPPORTED');
  if(row.seamId!==MFK_ADMIN_MENU_A2_SEAM_ID)throw new Error('ADMIN_MENU_READBACK_SEAM_INVALID');
  if(row.sourcePort!=='ADMIN'||row.targetPort!=='SMT')throw new Error('ADMIN_MENU_READBACK_PORT_INVALID');
  const disposition=row.deliveryDisposition;
  if(!['APPLIED','IDEMPOTENT','REJECTED'].includes(String(disposition)))throw new Error('ADMIN_MENU_READBACK_DISPOSITION_INVALID');
  const state=row.state;
  if(!['MATCH','MISMATCH','UNKNOWN'].includes(String(state)))throw new Error('ADMIN_MENU_READBACK_STATE_INVALID');
  const expectedRevision=Number(row.expectedRevision);
  const observedRevision=Number(row.observedRevision);
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw new Error('ADMIN_MENU_READBACK_EXPECTED_REVISION_INVALID');
  if(!Number.isSafeInteger(observedRevision)||observedRevision<1)throw new Error('ADMIN_MENU_READBACK_OBSERVED_REVISION_INVALID');
  return Object.freeze({
    schema:MFK_ADMIN_MENU_READBACK_SCHEMA,
    seamId:MFK_ADMIN_MENU_A2_SEAM_ID,
    sourcePort:'ADMIN',
    targetPort:'SMT',
    transportId:requireText(row.transportId,'ADMIN_MENU_READBACK_TRANSPORT_ID_INVALID'),
    observedAt:requireIso(row.observedAt,'ADMIN_MENU_READBACK_OBSERVED_AT_INVALID'),
    deliveryDisposition:disposition as MfkAdminMenuReadbackReceipt['deliveryDisposition'],
    expectedRevision,
    expectedFingerprint:requireText(row.expectedFingerprint,'ADMIN_MENU_READBACK_EXPECTED_FINGERPRINT_INVALID'),
    observedRevision,
    observedFingerprint:requireText(row.observedFingerprint,'ADMIN_MENU_READBACK_OBSERVED_FINGERPRINT_INVALID'),
    state:state as MfkAdminMenuReadbackReceipt['state'],
    evidenceRef:requireText(row.evidenceRef,'ADMIN_MENU_READBACK_EVIDENCE_INVALID'),
    ...(row.failureCode?{failureCode:requireText(row.failureCode,'ADMIN_MENU_READBACK_FAILURE_CODE_INVALID')}:{})
  });
}

export function compareAdminMenuReadback(
  bundle:MfkAdminMenuTransferBundle,
  receipt:MfkAdminMenuReadbackReceipt,
):'MATCH'|'MISMATCH'|'UNKNOWN'{
  const expected=validateAdminMenuTransferBundle(bundle);
  const observed=validateAdminMenuReadbackReceipt(receipt);
  if(observed.transportId!==expected.transportId)return 'UNKNOWN';
  if(observed.expectedRevision!==expected.revision.revision||observed.expectedFingerprint!==expected.revision.fingerprint)return 'MISMATCH';
  return observed.state;
}

export function assertAdminMenuA2NoHiddenTransport(){
  // Contract-level sentinel: A2 is human-controlled file transport only.
  return Object.freeze({
    seamId:MFK_ADMIN_MENU_A2_SEAM_ID,
    transport:'HUMAN_CONTROLLED_FILE',
    network:'ABSENT',
    polling:'ABSENT',
  });
}

export {MFK_ADMIN_MENU_INDEX_SCHEMA};
