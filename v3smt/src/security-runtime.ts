import {createMfpSecurityPort,type MfpDeviceIdentity,type MfpSecurityAuthority} from './security-port.ts';
import {createMfpFormalBusinessNativeTransport} from './formal-business-native-transport.ts';
import {mfpCommandOutbox,mfpDeviceMetadataStore} from './state-authority.ts';
import {createMfpStoreKernelPort} from './store-kernel-port.ts';

const unboundAuthority:MfpSecurityAuthority=Object.freeze({
  async readDeviceAuthorization(device:MfpDeviceIdentity){return Object.freeze({...device,status:'UNKNOWN'});},
  async loginStaff(){return Object.freeze({state:'UNAUTHORIZED'});},
  async readStaffSession(){throw new Error('MFP_AUTH_BINDING_UNAVAILABLE');},
  async logoutStaff(){/* Local logout remains effective while production binding is unavailable. */},
});

const mfpFormalStoreKernel=createMfpStoreKernelPort({
  transport:createMfpFormalBusinessNativeTransport(),
  outbox:mfpCommandOutbox,
});

export const mfpSecurityPort=createMfpSecurityPort({
  storeId:'MF01',
  deviceClass:'PAD',
  metadataStore:mfpDeviceMetadataStore,
  authority:unboundAuthority,
  storeKernel:mfpFormalStoreKernel,
});
