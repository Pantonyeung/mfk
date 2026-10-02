import {createMfpSecurityPort,type MfpDeviceIdentity,type MfpSecurityAuthority} from './security-port.ts';
import {mfpDeviceMetadataStore} from './state-authority.ts';

const unboundAuthority:MfpSecurityAuthority=Object.freeze({
  async readDeviceAuthorization(device:MfpDeviceIdentity){return Object.freeze({...device,status:'UNKNOWN'});},
  async loginStaff(){return Object.freeze({state:'UNAUTHORIZED'});},
  async readStaffSession(){throw new Error('MFP_AUTH_BINDING_UNAVAILABLE');},
  async logoutStaff(){/* Local logout remains effective while production binding is unavailable. */},
});

export const mfpSecurityPort=createMfpSecurityPort({
  storeId:'MF01',
  deviceClass:'PAD',
  metadataStore:mfpDeviceMetadataStore,
  authority:unboundAuthority,
});
