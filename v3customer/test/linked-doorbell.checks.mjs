import assert from 'node:assert/strict';
import {test} from 'node:test';
import {subscribeLinked} from '../../integrations/v3-linked-client.ts';
test('real shared doorbell invalidates only, reconnect refetches and cleanup stops retries without polling',()=>{
  const saved={window:globalThis.window,WebSocket:globalThis.WebSocket,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
  const timers=new Map(),listeners=new Map(),sockets=[];let timerId=0,refreshes=0;
  class Socket{readyState=0;constructor(url){this.url=url;sockets.push(this);}close(){this.readyState=3;this.onclose?.();}}
  globalThis.window={location:{href:'https://order.morefunos.com/'},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>{throw Error('Business polling forbidden');},addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:event=>listeners.delete(event)};
  globalThis.WebSocket=Socket;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
  const run=delay=>{for(const [id,timer] of [...timers])if(timer.delay===delay){timers.delete(id);timer.fn();}};
  try{
    const stop=subscribeLinked('request',()=>{refreshes++;});assert.equal(sockets.length,1);assert.equal(sockets[0].url.href,'wss://order.morefunos.com/api/v3-test/request-events');
    sockets[0].onopen();run(80);assert.equal(refreshes,1);assert.equal(timers.size,0,'healthy connection has no timer polling');
    sockets[0].onmessage({data:JSON.stringify({state:'PAID',formalOrderCreated:true})});sockets[0].onmessage({data:'junk'});assert.equal(refreshes,1);run(80);assert.equal(refreshes,2,'coalesced invalidation ignores payload truth');
    sockets[0].close();assert.equal([...timers.values()][0].delay,1000);run(1000);assert.equal(sockets.length,2);sockets[1].onopen();run(80);assert.equal(refreshes,3,'reconnect canonical refetch');
    listeners.get('online')();run(80);assert.equal(refreshes,4);stop();assert.equal(timers.size,0);assert.equal(listeners.size,0);
  }finally{if(saved.window===undefined)delete globalThis.window;else globalThis.window=saved.window;if(saved.WebSocket===undefined)delete globalThis.WebSocket;else globalThis.WebSocket=saved.WebSocket;if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete globalThis.navigator;}
});
