import {encodeEscPosText,encodePrinterText,toBase64Bytes,type PrinterEncoding} from './printer-encoding.ts';

export interface NativeResult{ok:boolean;code:string|null;message?:Record<string,unknown>}

interface NativeBridge{
  postMessage(message:string):void;
  addEventListener?(type:'message',listener:(event:{data:unknown})=>void):void;
  removeEventListener?(type:'message',listener:(event:{data:unknown})=>void):void;
}
declare global{interface Window{moreFunNative?:NativeBridge}}

function parse(data:unknown):Record<string,unknown>|null{
  if(typeof data!=='string'||!data.trim())return null;
  try{
    const value=JSON.parse(data);
    return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
  }catch{return null;}
}
function requestId(prefix='mfk-v2-print'){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}

export async function sendNative(type:string,expected:readonly string[],extra:Record<string,unknown>={},timeoutMs=7000):Promise<NativeResult>{
  const bridge=window.moreFunNative;
  if(!bridge)return{ok:false,code:'NATIVE_PRINT_BRIDGE_UNAVAILABLE'};
  const id=requestId();
  return await new Promise(resolve=>{
    let settled=false;
    let timer:number|undefined;
    const finish=(result:NativeResult)=>{
      if(settled)return;
      settled=true;
      if(timer!==undefined)window.clearTimeout(timer);
      window.removeEventListener('message',onWindow);
      bridge.removeEventListener?.('message',onBridge);
      resolve(result);
    };
    const accept=(raw:unknown)=>{
      const message=parse(raw);
      if(!message||message.requestId!==id)return;
      const kind=typeof message.type==='string'?message.type:'';
      if(kind==='carrier.error'||message.status==='failed'){
        finish({ok:false,code:String(message.failureCode||message.errorCode||'NATIVE_PRINT_FAILED'),message});
        return;
      }
      if(!expected.includes(kind))return;
      if(message.outcome==='REJECTED_BEFORE_SEND'||message.outcome==='NOT_PRINTED'){
        finish({ok:false,code:String(message.failureCode||'NATIVE_PRINT_REJECTED'),message});return;
      }
      if(message.outcome==='OUTCOME_UNKNOWN'){
        finish({ok:false,code:String(message.uncertaintyCode||'NATIVE_PRINT_OUTCOME_UNKNOWN'),message});return;
      }
      finish({ok:true,code:typeof message.outcome==='string'?message.outcome:null,message});
    };
    const onWindow=(event:MessageEvent)=>accept(event.data);
    const onBridge=(event:{data:unknown})=>accept(event.data);
    window.addEventListener('message',onWindow);
    bridge.addEventListener?.('message',onBridge);
    timer=window.setTimeout(()=>finish({ok:false,code:'NATIVE_PRINT_TIMEOUT'}),timeoutMs);
    try{bridge.postMessage(JSON.stringify({type,requestId:id,...extra}));}
    catch{finish({ok:false,code:'NATIVE_PRINT_BRIDGE_POST_FAILED'});}
  });
}

export interface LanPrinterInput{
  endpointId:string;
  host:string;
  port:number;
  displayName:string;
  model:string;
  capability:'receipt-80mm/kitchen'|'label-58mm';
  encoding?:PrinterEncoding;
}

export async function applyLanPrinter(input:LanPrinterInput){
  return sendNative('print.lan.endpoint.apply',['print.lan.endpoint.apply.result'],input);
}
export async function testLanPrinter(input:LanPrinterInput){
  const applied=await applyLanPrinter(input);
  if(!applied.ok)return applied;
  return sendNative('print.lan.endpoint.test',['print.lan.endpoint.test.completed'],{endpointId:input.endpointId},8000);
}
export async function printBytesLan(input:LanPrinterInput&{bytes:Uint8Array}){
  const applied=await applyLanPrinter(input);
  if(!applied.ok)return applied;
  return sendNative('print.lan.dispatch',['print.lan.dispatch.completed'],{
    endpointId:input.endpointId,
    dispatchAttemptId:requestId('mfk-v2-lan'),
    payloadBase64:toBase64Bytes(input.bytes)
  },10000);
}

function concatNativeBytes(parts:readonly Uint8Array[]){
  const total=parts.reduce((sum,part)=>sum+part.length,0);
  const output=new Uint8Array(total);
  let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.length;}
  return output;
}
export const ESC_POS_DRAWER_PULSE=new Uint8Array([0x1b,0x70,0x00,0x19,0xfa]);
export const ESC_POS_FULL_CUT=new Uint8Array([0x0a,0x0a,0x1d,0x56,0x00]);
export const ESC_POS_BEEP=new Uint8Array([0x1b,0x42,0x03,0x02]);
export function decorateEscPosTicket(bytes:Uint8Array,{kickDrawer=false,cutAfter=false,beepAfter=false}:{kickDrawer?:boolean;cutAfter?:boolean;beepAfter?:boolean}={}){
  return concatNativeBytes([
    ...(kickDrawer?[ESC_POS_DRAWER_PULSE]:[]),
    bytes,
    ...(cutAfter?[ESC_POS_FULL_CUT]:[]),
    ...(beepAfter?[ESC_POS_BEEP]:[]),
  ]);
}
export async function printTextLan(input:LanPrinterInput&{text:string;cutAfter?:boolean;kickDrawer?:boolean;beepAfter?:boolean}){
  const encoding=input.encoding??'gb18030';
  const body=input.capability==='label-58mm'
    ?encodePrinterText(input.text,encoding)
    :encodeEscPosText(input.text,encoding);
  const bytes=input.capability==='label-58mm'?body:decorateEscPosTicket(body,{kickDrawer:input.kickDrawer,cutAfter:input.cutAfter,beepAfter:input.beepAfter});
  return printBytesLan({...input,bytes});
}
