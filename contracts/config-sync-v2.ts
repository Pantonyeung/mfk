export const MFK_CONFIG_SYNC_V2='MFK_CONFIG_SYNC_V2' as const;

export const MFK_CONFIG_DOMAINS=Object.freeze([
  'CATALOG','OPTION_CENTER','AVAILABILITY','BUSINESS_DAY','PRINT','PRODUCT_MEDIA',
  'STORE_SETTINGS','QUICK_REASONS','STAFF','KEETA','CUSTOMER_CHANNEL','CAPACITY',
  'CUSTOMER_PRESENTATION','OWNER_PRESENTATION','FRONTLINE_PRESENTATION',
  'INVENTORY','LOYALTY','COUPONS','PRICING_PROMOTIONS','ANNOUNCEMENTS',
] as const);
export type MfkConfigDomain=typeof MFK_CONFIG_DOMAINS[number];

export interface MfkConfigBaselineV2{
  readonly schema:typeof MFK_CONFIG_SYNC_V2;
  readonly kind:'BASELINE';
  readonly storeId:string;
  readonly revision:number;
  readonly fingerprint:string;
  readonly committedAt:string;
  readonly domains:Readonly<Record<MfkConfigDomain,unknown>>;
}

export interface MfkConfigDeltaV2{
  readonly schema:typeof MFK_CONFIG_SYNC_V2;
  readonly kind:'DELTA';
  readonly storeId:string;
  readonly fromRevision:number;
  readonly toRevision:number;
  readonly changeId:string;
  readonly committedAt:string;
  readonly changedDomains:readonly MfkConfigDomain[];
  readonly changes:Readonly<Partial<Record<MfkConfigDomain,unknown>>>;
}

export interface MfkConfigInvalidationV2{
  readonly schema:typeof MFK_CONFIG_SYNC_V2;
  readonly type:'CONFIG_INVALIDATED';
  readonly storeId:string;
  readonly revision:number;
  readonly changeId:string;
  readonly changedDomains:readonly MfkConfigDomain[];
}

export function requiresBaseline(input:{localRevision:number;cloudRevision:number;hasBaseline:boolean;deltaFromRevision?:number}){
  if(!input.hasBaseline)return true;
  if(input.localRevision>input.cloudRevision)return true;
  if(input.localRevision===input.cloudRevision)return false;
  return input.deltaFromRevision!==input.localRevision;
}
