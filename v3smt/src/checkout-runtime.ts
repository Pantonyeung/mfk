import type {MfpFormalCheckoutAuthority,MfpTenderConfig} from './checkout-domain.ts';

export interface MfpCheckoutRuntimeBinding{
  readonly authority:MfpFormalCheckoutAuthority;
  readonly tenders:readonly MfpTenderConfig[];
}

const unboundFormalCheckoutAuthority:MfpFormalCheckoutAuthority=Object.freeze({
  async validateCheckout(){return Object.freeze({state:'UNKNOWN' as const,readbackRequired:true as const});},
});

// Production Store Kernel/Pricing and canonical tender binding is deliberately fail-closed until A9.
export const mfpCheckoutRuntimeBinding:MfpCheckoutRuntimeBinding=Object.freeze({
  authority:unboundFormalCheckoutAuthority,
  tenders:Object.freeze([]),
});
