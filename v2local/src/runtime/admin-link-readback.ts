export const ADMIN_PRICING_READBACK_URL='https://morefun-v2-admin.pantonyeung.workers.dev/api/pricing/active';

export interface AdminPricingReadback{
  readonly storeId:string;
  readonly currency:string;
  readonly revision:string;
  readonly revisionToken?:string;
  readonly generatedAt:string;
  readonly productCount:number;
  readonly productIds:readonly string[];
}

function nonEmpty(value:unknown):string|null{
  return typeof value==='string'&&value.trim()?value.trim():null;
}

export async function readAdminPricingReadback(fetcher:typeof fetch=fetch,url:string=ADMIN_PRICING_READBACK_URL):Promise<AdminPricingReadback>{
  const response=await fetcher(url,{method:'GET',headers:{accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('ADMIN_PRICING_READBACK_HTTP_'+response.status);
  let body:unknown;
  try{body=await response.json();}catch{throw new Error('ADMIN_PRICING_READBACK_JSON_INVALID');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('ADMIN_PRICING_READBACK_ENVELOPE_INVALID');
  const envelope=body as Record<string,unknown>;
  if(envelope.ok!==true||!envelope.value||typeof envelope.value!=='object'||Array.isArray(envelope.value)){
    throw new Error('ADMIN_PRICING_READBACK_ENVELOPE_INVALID');
  }
  const value=envelope.value as Record<string,unknown>;
  const storeId=nonEmpty(value.storeId);
  const currency=nonEmpty(value.currency);
  const revision=nonEmpty(value.revision);
  const generatedAt=nonEmpty(value.generatedAt);
  const salesPriceContext=nonEmpty(value.salesPriceContext);
  const products=value.products;
  if(!storeId||!currency||!revision||!generatedAt||salesPriceContext!=='DIRECT'||!products||typeof products!=='object'||Array.isArray(products)){
    throw new Error('ADMIN_PRICING_READBACK_INVALID');
  }
  const productIds=Object.keys(products as Record<string,unknown>).sort();
  const revisionToken=nonEmpty(value.revisionToken);
  return Object.freeze({
    storeId,
    currency,
    revision,
    ...(revisionToken?{revisionToken}:{}),
    generatedAt,
    productCount:productIds.length,
    productIds:Object.freeze(productIds),
  });
}
