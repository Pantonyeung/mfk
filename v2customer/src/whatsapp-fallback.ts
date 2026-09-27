import type {
  CustomerCartLine,
  CustomerCheckoutDraft,
  CustomerQuoteSnapshot,
  CustomerWhatsAppFallback,
} from './product-types.ts';

function money(minor:number){return 'HK$'+(minor/100).toFixed(2);}

export function buildWhatsAppFallbackMessage(input:{
  fallback:CustomerWhatsAppFallback;
  cart:readonly CustomerCartLine[];
  checkout:CustomerCheckoutDraft;
  quote:CustomerQuoteSnapshot|null;
  publishedTotalMinor?:number;
  fallbackReference?:string;
  pickupCode?:string;
}){
  const items=input.cart.map(line=>{
    const choices=line.selections.map(item=>item.optionName).filter(Boolean).join('、');
    const detail=[choices,line.note?.trim()].filter(Boolean).join(' · ');
    return '- '+line.productName+' ×'+line.quantity+(detail?'（'+detail+'）':'');
  }).join('\n');
  const values:Record<string,string>={
    '{name}':input.checkout.name.trim()||'未提供',
    '{phone}':input.checkout.phone.trim()||'未提供',
    '{items}':items||'未有餐點',
    '{total}':Number.isSafeInteger(Number(input.publishedTotalMinor))?money(Number(input.publishedTotalMinor)):input.quote?money(input.quote.totalMinor):'待確認',
    '{fallbackReference}':input.fallbackReference||'未建立',
    '{submissionId}':input.fallbackReference||'未建立',
    '{pickupCode}':input.pickupCode||'未提供',
    '{paymentMethod}':input.checkout.paymentMethod==='ELECTRONIC'?(input.checkout.paymentChannelLabel||'電子支付'):'到店付款',
    '{paymentStatus}':input.checkout.paymentMethod==='ELECTRONIC'
      ?input.checkout.paymentEvidence?.state==='UPLOADED'?'已提交付款憑證':'付款憑證未完成'
      :'到店付款',
  };
  let message=input.fallback.template;
  for(const [key,value] of Object.entries(values))message=message.split(key).join(value);
  return message;
}

export function buildWhatsAppFallbackUrl(input:{
  fallback:CustomerWhatsAppFallback;
  cart:readonly CustomerCartLine[];
  checkout:CustomerCheckoutDraft;
  quote:CustomerQuoteSnapshot|null;
  publishedTotalMinor?:number;
  fallbackReference?:string;
  pickupCode?:string;
}){
  const digits=input.fallback.phone.replace(/\D/g,'');
  if(!input.fallback.enabled||digits.length<8)return null;
  const message=buildWhatsAppFallbackMessage(input);
  if(!message.trim())return null;
  return 'https://wa.me/'+digits+'?text='+encodeURIComponent(message);
}
