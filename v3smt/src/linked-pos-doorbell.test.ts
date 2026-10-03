import {afterEach,describe,it,expect,vi} from 'vitest';
import {subscribeLinked} from '../../integrations/v3-linked-client.ts';

class Socket{
  static all:Socket[]=[];
  readyState=0;
  onopen:(()=>void)|null=null;
  onmessage:((event:{data:string})=>void)|null=null;
  onclose:(()=>void)|null=null;
  onerror:(()=>void)|null=null;
  constructor(readonly url:URL){Socket.all.push(this);}
  close(){if(this.readyState===3)return;this.readyState=3;this.onclose?.();}
  open(){this.readyState=1;this.onopen?.();}
}
function setup(){
  vi.useFakeTimers();Socket.all=[];
  const windowMock=Object.assign(new EventTarget(),{location:{href:'https://smt.morefunos.com/'},setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout});
  vi.stubGlobal('window',windowMock);vi.stubGlobal('navigator',{onLine:true});vi.stubGlobal('WebSocket',Socket);
  return windowMock;
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('POS uses shared doorbell invalidation lifecycle',()=>{
  it('coalesces socket payloads into invalidation and never treats their body as truth',()=>{setup();const refresh=vi.fn();const stop=subscribeLinked('request',refresh);const ws=Socket.all[0];expect(ws.url.href).toBe('wss://smt.morefunos.com/api/v3-test/request-events');ws.open();ws.onmessage?.({data:'{"state":"COMMITTED","formalOrderCreated":true}'});ws.onmessage?.({data:'malformed'});vi.advanceTimersByTime(80);expect(refresh).toHaveBeenCalledExactlyOnceWith();stop();});
  it('bounds failed reconnect attempts then resumes on user lifecycle recovery',()=>{const win=setup();const refresh=vi.fn();const stop=subscribeLinked('catalog',refresh);for(let i=0;i<12;i++){Socket.all.at(-1)!.close();vi.advanceTimersByTime(30000);}expect(Socket.all).toHaveLength(9);win.dispatchEvent(new Event('focus'));vi.advanceTimersByTime(80);expect(Socket.all).toHaveLength(10);expect(refresh).toHaveBeenCalledOnce();stop();});
  it('cleans listeners and pending callbacks on unmount without periodic reads',()=>{const win=setup();const refresh=vi.fn();const stop=subscribeLinked('request',refresh);Socket.all[0].open();stop();win.dispatchEvent(new Event('online'));win.dispatchEvent(new Event('focus'));win.dispatchEvent(new Event('pageshow'));vi.advanceTimersByTime(3600000);expect(refresh).not.toHaveBeenCalled();expect(Socket.all).toHaveLength(1);});
});
