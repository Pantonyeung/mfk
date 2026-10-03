export interface LinkedRequestStatus{submissionId:string;state:string;reviewState:string;reviewedAt:string|null;message:string;formalOrderCreated:false;paymentConfirmed:false}
export interface LinkedInboxRow extends LinkedRequestStatus{cart:{productName:string;quantity:number;note?:string;selections:{optionName:string}[]}[];checkout:{name:string;phone:string};receivedAt:string;idempotencyKey:string}
export async function linkedRequest<T>(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch('/api/v3-test'+path,{method,cache:'no-store',credentials:'same-origin',signal,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw new Error(String(data.code||'連線失敗：'+response.status));return data as T;
}
/** A doorbell only invalidates. Truth is always fetched again; no periodic business polling. */
export function subscribeLinked(topic:'catalog'|'request',onChange:()=>void){
  let closed=false;let ws:WebSocket|null=null;let retry=0;let retryTimer:number|undefined;let refreshTimer:number|undefined;
  const refresh=()=>{if(closed||refreshTimer!==undefined)return;refreshTimer=window.setTimeout(()=>{refreshTimer=undefined;if(!closed)onChange();},80);};
  const connect=()=>{
    if(closed||navigator.onLine===false)return;window.clearTimeout(retryTimer);ws?.close();
    const url=new URL('/api/v3-test/'+topic+'-events',window.location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
    const current=new WebSocket(url);ws=current;
    current.onopen=()=>{retry=0;refresh();};current.onmessage=refresh;
    current.onclose=()=>{if(!closed&&ws===current&&retry<8){retryTimer=window.setTimeout(connect,Math.min(30000,1000*2**retry++));}};
    current.onerror=()=>current.close();
  };
  const resume=()=>{refresh();if(!ws||ws.readyState>1){retry=0;connect();}};
  connect();window.addEventListener('online',resume);window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);
  return()=>{closed=true;window.clearTimeout(retryTimer);window.clearTimeout(refreshTimer);ws?.close();window.removeEventListener('online',resume);window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);};
}
