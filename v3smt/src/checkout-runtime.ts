import type {MfpFormalCheckoutAuthority,MfpTenderConfig} from './checkout-domain.ts';
import {createMfpFormalCheckoutNativeAuthority} from './formal-business-native-transport.ts';
import {mfpSecurityPort} from './security-runtime.ts';

export interface MfpCheckoutRuntimeBinding{
  readonly authority:MfpFormalCheckoutAuthority;
  readonly tenders:readonly MfpTenderConfig[];
}

const nativeTenders:MfpTenderConfig[]=[];
const nativeFormalCheckoutAuthority:MfpFormalCheckoutAuthority=createMfpFormalCheckoutNativeAuthority({
  identity(){
    const {device,session,sessionState}=mfpSecurityPort.getSnapshot();
    if(!device)throw new Error('MFP_DEVICE_IDENTITY_REQUIRED');
    if(sessionState!=='AUTHENTICATED'||!session)throw new Error('MFP_STAFF_SESSION_UNAUTHORIZED');
    return Object.freeze({
      storeId:device.storeId,
      deviceId:device.deviceId,
      staffSessionRef:session.staffSessionRef,
    });
  },
  onTenders(tenders){nativeTenders.splice(0,nativeTenders.length,...tenders);},
});

// The Android bridge is high-level only. Missing canonical admission or tender policy still fails closed.
export const mfpCheckoutRuntimeBinding:MfpCheckoutRuntimeBinding=Object.freeze({
  authority:nativeFormalCheckoutAuthority,
  tenders:nativeTenders,
});
