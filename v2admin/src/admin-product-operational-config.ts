import {usePersistentAdminState} from './admin-local-store.ts';

export interface ProductPrintRule{
  readonly receipt:boolean;
  readonly production:boolean;
  readonly packing:boolean;
  readonly label:boolean;
  readonly dineIn:boolean;
  readonly takeaway:boolean;
  readonly labelPrinterIds:readonly string[];
}

export const DEFAULT_PRODUCT_PRINT_RULE:ProductPrintRule=Object.freeze({
  receipt:true,
  production:true,
  packing:true,
  label:true,
  dineIn:true,
  takeaway:true,
  labelPrinterIds:Object.freeze([]),
});

export function normalizeProductPrintRule(value:Partial<ProductPrintRule>|undefined):ProductPrintRule{
  return Object.freeze({
    receipt:value?.receipt??true,
    production:value?.production??true,
    packing:value?.packing??true,
    label:value?.label??true,
    dineIn:value?.dineIn??true,
    takeaway:value?.takeaway??true,
    labelPrinterIds:Object.freeze([...(value?.labelPrinterIds??[])]),
  });
}

export function useProductPrintRules(){
  return usePersistentAdminState<Record<string,ProductPrintRule>>('print-rules.v1',{});
}

export type ProductMediaStorageState='UNSET'|'REFERENCE_ONLY'|'R2_D1_PENDING'|'R2_D1_VERIFIED';

export interface ProductMediaConfig{
  readonly canonicalImageRef:string;
  readonly r2ObjectKey:string;
  readonly d1MediaRef:string;
  readonly publicUrl:string;
  readonly keetaImageUrl:string;
  readonly storageState:ProductMediaStorageState;
  readonly lastVerifiedAt:string;
}

export const EMPTY_PRODUCT_MEDIA:ProductMediaConfig=Object.freeze({
  canonicalImageRef:'',
  r2ObjectKey:'',
  d1MediaRef:'',
  publicUrl:'',
  keetaImageUrl:'',
  storageState:'UNSET',
  lastVerifiedAt:'',
});

export function normalizeProductMedia(value:Partial<ProductMediaConfig>|undefined,canonicalImageRef=''):ProductMediaConfig{
  const canonical=(value?.canonicalImageRef??canonicalImageRef).trim();
  return Object.freeze({
    canonicalImageRef:canonical,
    r2ObjectKey:value?.r2ObjectKey?.trim()??'',
    d1MediaRef:value?.d1MediaRef?.trim()??'',
    publicUrl:value?.publicUrl?.trim()??canonical,
    keetaImageUrl:value?.keetaImageUrl?.trim()??'',
    storageState:value?.storageState??(canonical?'REFERENCE_ONLY':'UNSET'),
    lastVerifiedAt:value?.lastVerifiedAt?.trim()??'',
  });
}

export function useProductMediaConfig(){
  return usePersistentAdminState<Record<string,ProductMediaConfig>>('product-media.v1',{});
}

export const PRODUCT_MEDIA_BACKEND_CONTRACT=Object.freeze({
  uploadAuthority:'ADMIN_AUTHENTICATED_WORKER',
  binaryStore:'MFK_R2_PRODUCT_MEDIA',
  metadataProjection:'MFK_D1_PRODUCT_MEDIA',
  canonicalProductField:'imageRef',
  publicPath:'/media/products/*',
  maxBytes:8*1024*1024,
  acceptedContentTypes:Object.freeze(['image/jpeg','image/png','image/webp','image/avif']),
  browserDirectR2Credentials:false,
  currentExecution:'NOT_WIRED',
});
