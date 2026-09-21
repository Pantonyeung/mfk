const APP_ORIGIN='https://appassets.androidplatform.net';

function parseMessage(data){
  if(typeof data!=='string'||!data.trim())return null;
  try{
    const value=JSON.parse(data);
    return value&&typeof value.type==='string'?value:null;
  }catch{return null;}
}

function toBase64(bytes){
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary);
}

function makeRequestId(prefix='mfk-print'){
  return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
}

export async function sendNativePrintCommand(type,expectedTypes,extra={},timeoutMs=6000){
  const requestId=makeRequestId();
  const request={type,requestId,...extra};
  return await new Promise(resolve=>{
    let settled=false;
    const finish=result=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      window.removeEventListener('message',onMessage);
      resolve(result);
    };
    const onMessage=event=>{
      const envelope=event.data;
      if(!envelope||envelope.type!=='morefun:native-response')return;
      const message=parseMessage(envelope.data);
      if(!message||message.requestId!==requestId)return;
      if(message.type==='carrier.error'||message.status==='failed'){
        finish({ok:false,code:message.failureCode||message.errorCode||'NATIVE_PRINT_FAILED',message});
        return;
      }
      if(Array.isArray(expectedTypes)&&expectedTypes.length&&!expectedTypes.includes(message.type))return;
      if(message.outcome==='REJECTED_BEFORE_SEND'||message.outcome==='NOT_PRINTED'){
        finish({ok:false,code:message.failureCode||'NATIVE_PRINT_REJECTED',message});
        return;
      }
      if(message.outcome==='OUTCOME_UNKNOWN'){
        finish({ok:false,code:message.uncertaintyCode||'NATIVE_PRINT_OUTCOME_UNKNOWN',message});
        return;
      }
      finish({ok:true,code:message.outcome||null,message});
    };
    window.addEventListener('message',onMessage);
    const timer=setTimeout(()=>finish({ok:false,code:'NATIVE_PRINT_TIMEOUT'}),timeoutMs);
    try{
      if(parent&&parent!==window){
        parent.postMessage({type:'morefun:native-request',request},APP_ORIGIN);
      }else if(window.moreFunNative?.postMessage){
        window.moreFunNative.postMessage(JSON.stringify(request));
      }else{
        finish({ok:false,code:'NATIVE_PRINT_BRIDGE_UNAVAILABLE'});
      }
    }catch(_error){
      finish({ok:false,code:'NATIVE_PRINT_BRIDGE_POST_FAILED'});
    }
  });
}

export async function applyPrinterBinding(printer){
  if(printer.transport==='sunmi-native'){
    return sendNativePrintCommand('print.sunmi.test',['print.sunmi.test.result'],{});
  }
  const purpose=(printer.purposes||[])[0]||'receipt';
  const capability=purpose.includes('label')?'label-58mm':'receipt-80mm/kitchen';
  return sendNativePrintCommand('print.lan.endpoint.apply',['print.lan.endpoint.apply.result'],{
    endpointId:printer.id,
    host:String(printer.host||'').trim(),
    port:Number(printer.port),
    displayName:printer.name,
    model:printer.model,
    capability,
  });
}

export async function testPrinterConnection(printer){
  if(printer.transport==='sunmi-native'){
    return sendNativePrintCommand('print.sunmi.test',['print.sunmi.test.result'],{});
  }
  const applied=await applyPrinterBinding(printer);
  if(!applied.ok)return applied;
  return sendNativePrintCommand('print.lan.endpoint.test',['print.lan.endpoint.test.completed'],{
    endpointId:printer.id,
  },7000);
}

export async function sendPrinterTestPage(printer,title='MFK PRINT TEST'){
  const timestamp=new Date().toISOString();
  let raw;
  if((printer.purposes||[]).some(x=>String(x).includes('label'))){
    const safe=String(title).replace(/"/g,'').replace(/[^\x20-\x7E]/g,' ').slice(0,40);
    raw='SIZE 40 mm,30 mm\r\nGAP 2 mm,0 mm\r\nCLS\r\n'
      +'TEXT 20,20,"3",0,1,1,"MFK PRINT TEST"\r\n'
      +'TEXT 20,55,"3",0,1,1,"'+safe+'"\r\n'
      +'TEXT 20,90,"2",0,1,1,"'+timestamp.slice(0,19)+'"\r\n'
      +'PRINT 1\r\n';
  }else{
    raw='\x1B\x40MFK PRINT TEST\n------------------------------\n'
      +String(title).replace(/[^\x20-\x7E]/g,' ').slice(0,40)+'\n'
      +timestamp+'\n------------------------------\n\n\n';
  }
  const bytes=new TextEncoder().encode(raw);
  const payloadBase64=toBase64(bytes);
  const dispatchAttemptId=makeRequestId('mfk-dispatch');
  if(printer.transport==='sunmi-native'){
    return sendNativePrintCommand('print.sunmi.dispatch',['print.sunmi.dispatch.completed'],{
      dispatchAttemptId,payloadBase64,
    },10000);
  }
  const applied=await applyPrinterBinding(printer);
  if(!applied.ok)return applied;
  return sendNativePrintCommand('print.lan.dispatch',['print.lan.dispatch.completed'],{
    endpointId:printer.id,dispatchAttemptId,payloadBase64,
  },10000);
}
