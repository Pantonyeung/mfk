import {Buffer} from 'buffer';
import iconv from 'iconv-lite';

export type PrinterEncoding='gb18030'|'big5'|'utf-8';

export function encodePrinterText(text:string,encoding:PrinterEncoding='gb18030'):Uint8Array{
  if(encoding==='utf-8')return new TextEncoder().encode(text);
  const target=encoding==='big5'?'big5':'gb18030';
  const bytes=iconv.encode(text,target);
  return new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
}

export function toBase64Bytes(bytes:Uint8Array):string{
  let binary='';
  for(let index=0;index<bytes.length;index++)binary+=String.fromCharCode(bytes[index]??0);
  return btoa(binary);
}

export function encodeEscPosText(text:string,encoding:PrinterEncoding='gb18030'):Uint8Array{
  const body=encodePrinterText(text,encoding);
  if(encoding==='utf-8')return body;
  const prefix=new Uint8Array([0x1b,0x40,0x1c,0x26]);
  const suffix=new Uint8Array([0x1c,0x2e]);
  const output=new Uint8Array(prefix.length+body.length+suffix.length);
  output.set(prefix,0);
  output.set(body,prefix.length);
  output.set(suffix,prefix.length+body.length);
  return output;
}
