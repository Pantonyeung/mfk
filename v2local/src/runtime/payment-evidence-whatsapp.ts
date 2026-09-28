import QRCode from 'qrcode';

export type PaymentFollowupTemplateId='UNCLEAR'|'AMOUNT_MISMATCH'|'DETAIL_MISSING';

export const PAYMENT_FOLLOWUP_TEMPLATES=Object.freeze([
  Object.freeze({id:'UNCLEAR' as const,label:'付款截圖不清晰'}),
  Object.freeze({id:'AMOUNT_MISMATCH' as const,label:'付款金額未能核對'}),
  Object.freeze({id:'DETAIL_MISSING' as const,label:'付款資料不完整'}),
]);

export function normalizeWhatsAppPhone(value:string):string|null{
  const digits=String(value||'').replace(/\D/g,'');
  if(/^852\d{8}$/.test(digits))return digits;
  if(/^\d{8}$/.test(digits))return '852'+digits;
  if(/^\d{10,15}$/.test(digits))return digits;
  return null;
}

export function paymentFollowupMessage(input:{
  display:string;
  totalLabel:string;
  templateId:PaymentFollowupTemplateId;
}):string{
  const order='#'+String(input.display||'').replace(/^#/,'');
  if(input.templateId==='AMOUNT_MISMATCH'){
    return `你好，我哋係磨飯。你今次訂單 ${order}（${input.totalLabel}）嘅付款金額暫時未能核對，麻煩重新確認付款資料，再傳送一張完整付款截圖畀我哋，謝謝。`;
  }
  if(input.templateId==='DETAIL_MISSING'){
    return `你好，我哋係磨飯。你今次訂單 ${order} 嘅付款截圖資料唔完整，麻煩重新傳送一張可以清楚見到付款金額、付款時間同交易資料嘅完整截圖，謝謝。`;
  }
  return `你好，我哋係磨飯。你今次訂單 ${order} 嘅付款截圖比較模糊，暫時未能核對。麻煩重新傳送一張清晰完整嘅付款截圖畀我哋，謝謝。`;
}

export function buildWhatsAppPaymentFollowup(input:{
  phone:string;
  display:string;
  totalLabel:string;
  templateId:PaymentFollowupTemplateId;
}):{url:string;message:string;phone:string}{
  const phone=normalizeWhatsAppPhone(input.phone);
  if(!phone)throw new Error('CUSTOMER_WHATSAPP_PHONE_INVALID');
  const message=paymentFollowupMessage(input);
  return Object.freeze({
    phone,
    message,
    url:'https://wa.me/'+phone+'?text='+encodeURIComponent(message),
  });
}

export async function createWhatsAppQrDataUrl(url:string):Promise<string>{
  return QRCode.toDataURL(url,{
    errorCorrectionLevel:'M',
    margin:1,
    width:320,
  });
}
