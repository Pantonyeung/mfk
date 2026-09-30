export const MFK_CANONICAL_DOORBELL_URL='wss://admin.morefunos.com/api/admin-sync/events?storeId=MF01' as const;

export type MfkCanonicalDoorbellEvent=Readonly<{
  type:string;
  storeId?:string;
  [key:string]:unknown;
}>;

export const MFK_CANONICAL_DATA_EVENTS=Object.freeze(new Set([
  'ADMIN_CONFIG_AVAILABLE',
  'SMT_PROJECTION_AVAILABLE',
  'CUSTOMER_ORDER_AVAILABLE',
  'CUSTOMER_QUOTE_AVAILABLE',
  'KEETA_ORDER_AVAILABLE',
  'OWNER_SELLABILITY_COMMAND_AVAILABLE',
  'ADMIN_REFUND_AVAILABLE',
]));

export interface MfkCanonicalDoorbellOptions{
  readonly onEvent:(event:MfkCanonicalDoorbellEvent)=>void;
  readonly onReconnect?:()=>void;
  readonly url?:string;
}

export function installMfkCanonicalDoorbell(options:MfkCanonicalDoorbellOptions){
  if(typeof window==='undefined'||typeof WebSocket==='undefined')return()=>{};
  let socket:WebSocket|null=null;
  let reconnectTimer:number|undefined;
  let reconnectAttempt=0;
  let opened=false;
  let stopped=false;

  const scheduleReconnect=()=>{
    if(stopped||!navigator.onLine)return;
    if(reconnectTimer!==undefined)window.clearTimeout(reconnectTimer);
    const delays=[500,1000,2000,5000,15000];
    const delay=delays[Math.min(reconnectAttempt,delays.length-1)]!;
    reconnectAttempt+=1;
    reconnectTimer=window.setTimeout(connect,delay);
  };

  function connect(){
    if(stopped||!navigator.onLine)return;
    if(socket&&socket.readyState<=WebSocket.OPEN)return;
    try{
      socket=new WebSocket(options.url??MFK_CANONICAL_DOORBELL_URL);
      socket.addEventListener('open',()=>{
        const recovering=opened;
        opened=true;
        reconnectAttempt=0;
        if(recovering)options.onReconnect?.();
      });
      socket.addEventListener('message',message=>{
        try{
          const event=JSON.parse(String(message.data)) as MfkCanonicalDoorbellEvent;
          if(event&&typeof event.type==='string')options.onEvent(event);
        }catch{}
      });
      socket.addEventListener('close',()=>{socket=null;scheduleReconnect();});
      socket.addEventListener('error',()=>{try{socket?.close();}catch{}});
    }catch{scheduleReconnect();}
  }

  const onOnline=()=>{
    options.onReconnect?.();
    connect();
  };
  const onOffline=()=>{try{socket?.close();}catch{}};

  window.addEventListener('online',onOnline);
  window.addEventListener('offline',onOffline);
  connect();

  return()=>{
    stopped=true;
    if(reconnectTimer!==undefined)window.clearTimeout(reconnectTimer);
    window.removeEventListener('online',onOnline);
    window.removeEventListener('offline',onOffline);
    try{socket?.close();}catch{}
    socket=null;
  };
}
