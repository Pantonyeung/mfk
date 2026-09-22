import {
  buildAdminMenuReadbackReceipt,
  validateAdminMenuTransferBundle,
  type MfkAdminMenuReadbackReceipt,
} from '../../../contracts/admin-menu-transfer-v1.ts';
import {
  applyAdminMenuIndexRevision,
  readLocalAdminMenuReadback,
} from './local-admin-menu.ts';

export function receiveAdminMenuA2Transfer(input:unknown):MfkAdminMenuReadbackReceipt{
  const bundle=validateAdminMenuTransferBundle(input);
  try{
    const applied=applyAdminMenuIndexRevision(bundle.revision);
    const observed=readLocalAdminMenuReadback();
    return buildAdminMenuReadbackReceipt({
      bundle,
      deliveryDisposition:applied.disposition,
      observedRevision:observed.revision,
      observedFingerprint:observed.fingerprint,
    });
  }catch(error){
    const observed=readLocalAdminMenuReadback();
    return buildAdminMenuReadbackReceipt({
      bundle,
      deliveryDisposition:'REJECTED',
      observedRevision:observed.revision,
      observedFingerprint:observed.fingerprint,
      failureCode:error instanceof Error?error.message:'ADMIN_MENU_A2_APPLY_FAILED',
    });
  }
}
