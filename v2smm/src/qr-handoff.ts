import QRCode from 'qrcode';
import type {SmmCartLine,SmmQuoteSnapshot} from './product-types';

export interface SmmQrHandoff{
  readonly protocolVersion:1;
  readonly type:'smm.qr.order-intent.v1';
  readonly submissionId:string;
  readonly idempotencyKey:string;
  readonly createdAt:string;
  readonly quoteRevision?:string;
  readonly cart:readonly SmmCartLine[];
}
export function createSmmQrHandoff(cart:readonly SmmCartLine[],quote:SmmQuoteSnapshot|null):SmmQrHandoff{
  const submissionId=crypto.randomUUID();
  return Object.freeze({
    protocolVersion:1,type:'smm.qr.order-intent.v1',submissionId,idempotencyKey:submissionId,createdAt:new Date().toISOString(),
    ...(quote?{quoteRevision:quote.revision}:{}),cart:Object.freeze(cart.map(x=>Object.freeze({...x}))),
  });
}
export async function renderSmmQrHandoff(value:SmmQrHandoff){
  return QRCode.toDataURL(JSON.stringify(value),{errorCorrectionLevel:'M',margin:1,width:360});
}
