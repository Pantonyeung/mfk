import {beforeEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{
    configurable:true,
    value:{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,String(value));},
      removeItem:(key:string)=>{values.delete(key);},
      clear:()=>values.clear(),
      key:(index:number)=>[...values.keys()][index]??null,
      get length(){return values.size;},
    },
  });
}

function installSuccessfulNativeBridge(){
  const messages:string[]=[];
  Object.defineProperty(window,'moreFunNative',{
    configurable:true,
    value:{
      postMessage(raw:string){
        messages.push(raw);
        const request=JSON.parse(raw) as {type:string;requestId:string};
        const responseType=request.type==='print.lan.endpoint.apply'
          ?'print.lan.endpoint.apply.result'
          :request.type==='print.lan.dispatch'
            ?'print.lan.dispatch.completed'
            :'carrier.error';
        window.setTimeout(()=>window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({
          type:responseType,
          requestId:request.requestId,
          outcome:responseType==='carrier.error'?'REJECTED_BEFORE_SEND':'SENT',
        })})),0);
      },
    },
  });
  return messages;
}

function productionBinding(){
  localStorage.setItem('mfk.v2local.printers.v5',JSON.stringify([{
    id:'production-1',
    routeKey:'logical.production',
    name:'廚房製作',
    model:'LAN',
    role:'製作單',
    host:'192.168.1.50',
    port:9100,
    capability:'receipt-80mm/kitchen',
    encoding:'gb18030',
  }]));
}

async function seedIssuedOrder(){
  const first=await import('../runtime/local-runtime.ts');
  first.localRuntime.clear();
  const order=first.localRuntime.createOrder({
    items:[{id:'meal',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
    totalMinor:4100,
    paymentLabel:'CASH',
    sourceLabel:'現場',
  });
  const raw=JSON.parse(localStorage.getItem('mfk.v2local.runtime.v1')||'{}') as {orders:Array<Record<string,unknown>>};
  raw.orders=raw.orders.map(row=>row.id===order.id?{...row,productionIssuedAt:'2026-09-26T10:00:00.000Z'}:row);
  localStorage.setItem('mfk.v2local.runtime.v1',JSON.stringify(raw));
  vi.resetModules();
  return order.id;
}

describe('SMT B3 automatic cancellation notice',()=>{
  beforeEach(()=>{
    installStorage();
    vi.resetModules();
    if(typeof window!=='undefined')delete window.moreFunNative;
  });

  it('prints exactly one cancellation notice after confirmed production issue and persists DONE',async()=>{
    productionBinding();
    const messages=installSuccessfulNativeBridge();
    const orderId=await seedIssuedOrder();
    const {localRuntime}=await import('../runtime/local-runtime.ts');

    await localRuntime.cancelOrder(orderId,'客人取消');
    const first=localRuntime.orders().find(row=>row.id===orderId)!;
    expect(first.fulfillmentLabel).toBe('已取消');
    expect(first.cancellationNoticeState).toBe('DONE');
    expect(first.cancellationNoticeAttemptedAt).toBeTruthy();
    expect(first.cancellationNoticePrintedAt).toBeTruthy();

    const dispatches=messages.filter(raw=>(JSON.parse(raw) as {type:string}).type==='print.lan.dispatch');
    expect(dispatches).toHaveLength(1);

    const attemptedAt=first.cancellationNoticeAttemptedAt;
    await localRuntime.cancelOrder(orderId,'重複取消');
    const replay=localRuntime.orders().find(row=>row.id===orderId)!;
    expect(replay.cancellationNoticeAttemptedAt).toBe(attemptedAt);
    expect(messages.filter(raw=>(JSON.parse(raw) as {type:string}).type==='print.lan.dispatch')).toHaveLength(1);
  });

  it('does not print when production was never confirmed as issued',async()=>{
    productionBinding();
    const messages=installSuccessfulNativeBridge();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const order=localRuntime.createOrder({
      items:[{id:'meal',name:'飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'}],
      totalMinor:4100,paymentLabel:'CASH',sourceLabel:'現場',
    });
    await localRuntime.cancelOrder(order.id,'未製作');
    const stored=localRuntime.orders().find(row=>row.id===order.id)!;
    expect(stored.cancellationNoticeState).toBeUndefined();
    expect(stored.cancellationNoticeAttemptedAt).toBeUndefined();
    expect(messages.filter(raw=>(JSON.parse(raw) as {type:string}).type==='print.lan.dispatch')).toHaveLength(0);
  });

  it('records FAILED instead of retrying when production route is unavailable',async()=>{
    const orderId=await seedIssuedOrder();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    await localRuntime.cancelOrder(orderId,'取消');
    const failed=localRuntime.orders().find(row=>row.id===orderId)!;
    expect(failed.cancellationNoticeState).toBe('FAILED');
    expect(failed.cancellationNoticeAttemptedAt).toBeTruthy();
    expect(failed.cancellationNoticePrintedAt).toBeUndefined();
    const attemptedAt=failed.cancellationNoticeAttemptedAt;
    await localRuntime.cancelOrder(orderId,'再取消');
    expect(localRuntime.orders().find(row=>row.id===orderId)?.cancellationNoticeAttemptedAt).toBe(attemptedAt);
  });

  it('leaves provider cancellation path free of the local automatic notice side effect',async()=>{
    productionBinding();
    const messages=installSuccessfulNativeBridge();
    const orderId=await seedIssuedOrder();
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    const result=localRuntime.applyProviderLifecycle({
      orderId,
      eventId:1004,
      eventName:'ORDER_CANCELLED',
      providerMessageId:'provider-msg-1',
      providerPushedAt:'2026-09-26T10:10:00.000Z',
      rawMessage:JSON.stringify({cancelReason:'平台取消'}),
    });
    expect(result.fulfillmentLabel).toBe('已取消');
    expect(localRuntime.orders().find(row=>row.id===orderId)?.cancellationNoticeState).toBeUndefined();
    expect(messages.filter(raw=>(JSON.parse(raw) as {type:string}).type==='print.lan.dispatch')).toHaveLength(0);
  });

  it('tracks production issue only from an actually successful production print result and never kicks drawer on notice',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
    const ui=fs.readFileSync(path.join(root,'presentation/RuntimeOrdersWorkspace.tsx'),'utf8');
    expect(runtime).toContain("summary.results.some(row=>row.role==='製作單'&&row.ok)");
    expect(runtime).toContain("if(order.productionIssuedAt&&!order.cancellationNoticeAttemptedAt)");
    expect(runtime).toContain("*** 取消通知單 ***");
    expect(runtime).toContain('kickDrawer:false');
    expect(runtime).toContain("if(order.fulfillmentLabel==='已取消')return");
    expect(runtime).toContain("cancellationNoticeState:result.state");
    expect(ui).toContain('如果製作單之前真係成功出過');
    expect(ui).toContain('取消通知');
    expect(ui).toContain('結果未能確認');
  });
});
