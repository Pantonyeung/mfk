import {buildAdminMenuIndexRevisionFromDraft} from './admin-menu-link.ts';
import type {AdminSessionDraft} from './admin-draft.tsx';
import {
  buildAdminMenuTransferBundle,
  compareAdminMenuReadback,
  validateAdminMenuReadbackReceipt,
  type MfkAdminMenuReadbackReceipt,
  type MfkAdminMenuTransferBundle,
} from '../../contracts/admin-menu-transfer-v1.ts';

export function buildAdminA2TransferFromDraft(
  draft:AdminSessionDraft,
  baseRevision:number,
  publishedAt=new Date().toISOString(),
):MfkAdminMenuTransferBundle{
  const revision=buildAdminMenuIndexRevisionFromDraft(draft,baseRevision,publishedAt);
  return buildAdminMenuTransferBundle(revision,publishedAt);
}

export function inspectAdminA2Readback(
  bundle:MfkAdminMenuTransferBundle,
  receipt:unknown,
):{
  readonly state:'MATCH'|'MISMATCH'|'UNKNOWN';
  readonly receipt:MfkAdminMenuReadbackReceipt;
}{
  const valid=validateAdminMenuReadbackReceipt(receipt);
  return Object.freeze({state:compareAdminMenuReadback(bundle,valid),receipt:valid});
}
