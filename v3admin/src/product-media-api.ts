export type ProductMediaSurface='CUSTOMER'|'KEETA';

export interface ProductMediaUploadResult{
  state:'UPLOADED';
  storage:'R2';
  objectKey:string;
  mediaUrl:string;
  sha256:string;
  surface:ProductMediaSurface;
  uploadedAt:string;
}

function previewApiBase(){
  return (import.meta.env.VITE_MFK_V3_PREVIEW_API_BASE as string|undefined)?.replace(/\/$/,'')??'';
}

export async function uploadPreviewProductMedia(input:{
  productId:string;
  surface:ProductMediaSurface;
  file:File;
  storeId?:string;
}):Promise<ProductMediaUploadResult>{
  const base=previewApiBase();
  if(!base)throw new Error('PREVIEW_MEDIA_API_NOT_CONFIGURED');
  const storeId=input.storeId??'MF01';
  const url=new URL(base+'/api/product-media');
  url.searchParams.set('storeId',storeId);
  url.searchParams.set('productId',input.productId);
  url.searchParams.set('surface',input.surface);
  const response=await fetch(url.toString(),{
    method:'POST',
    headers:{'content-type':input.file.type},
    body:input.file,
  });
  const body=await response.json().catch(()=>({})) as Partial<ProductMediaUploadResult>&{code?:string};
  if(!response.ok)throw new Error(body.code||'PRODUCT_MEDIA_UPLOAD_FAILED');
  if(body.state!=='UPLOADED'||body.storage!=='R2'||!body.objectKey||!body.mediaUrl){
    throw new Error('PRODUCT_MEDIA_UPLOAD_INVALID');
  }
  return body as ProductMediaUploadResult;
}

export const PRODUCT_MEDIA_STORAGE_POLICY=Object.freeze({
  binaryStore:'R2_ONLY',
  previewBucket:'mfk-admin-v3-product-media-preview',
  surfaces:Object.freeze(['CUSTOMER','KEETA'] as const),
  externalUrlAuthority:false,
  browserDirectR2Credentials:false,
  maxBytes:8*1024*1024,
});
