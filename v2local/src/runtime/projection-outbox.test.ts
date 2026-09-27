import {beforeEach,describe,expect,it,vi} from 'vitest';
import {
  SMT_PROJECTION_ACKED_KEY,
  SMT_PROJECTION_OUTBOX_KEY,
  flushProjectionOutbox,
  queueCashOpeningProjection,
  queueDayCloseProjection,
  queueOrderProjection,
  readProjectionOutbox,
} from './projection-outbox.ts';

function installBrowserState(online=false){
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
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:online}});
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{
    getRandomValues:(buffer:Uint8Array)=>{buffer.fill(9);return buffer;},
  }});
  return values;
}

describe('SMT projection outbox',()=>{
  beforeEach(()=>{vi.restoreAllMocks();installBrowserState(false);});

  it('dedupes identical facts but queues a changed order state as a new event',()=>{
    const base={
      id:'MFK-1',
      display:'P001',
      createdAt:'2026-09-22T01:00:00.000Z',
      updatedAt:'2026-09-22T01:00:00.000Z',
      totalMinor:5000,
      paymentLabel:'CASH',
      fulfillmentLabel:'進行中',
      sourceLabel:'現場',
      staffId:'staff-1',
      staffName:'店員甲',
      items:[{id:'p1',name:'商品',qty:1,unitMinor:5000}],
    };
    queueOrderProjection(base);
    queueOrderProjection(base);
    expect(readProjectionOutbox()).toHaveLength(1);
    queueOrderProjection({...base,updatedAt:'2026-09-22T01:05:00.000Z',fulfillmentLabel:'可取餐'});
    expect(readProjectionOutbox()).toHaveLength(2);
  });

  it('queues cash-opening and exactly-once day-close facts',()=>{
    queueCashOpeningProjection({
      id:'CASHOPEN-2026-09-22',
      businessDate:'2026-09-22',
      createdAt:123,
      amountMinor:100000,
      changedFromSuggestion:false,
      note:'',
    });
    queueDayCloseProjection({
      id:'DAYCLOSE-2026-09-22-V1',
      businessDate:'2026-09-22',
      version:1,
      createdAt:456,
      openingCashMinor:100000,
      cashSalesMinor:400000,
      expectedCashMinor:500000,
      countedCashMinor:500000,
      cashDifferenceMinor:0,
      cashRemovedMinor:400000,
      retainedCashMinor:100000,
      note:'',
    });
    expect(readProjectionOutbox().map(row=>row.event.type)).toEqual([
      'CASH_OPENING_CONFIRMED','DAY_CLOSE_RECORDED',
    ]);
  });

  it('removes only server-ACKed events and remembers ACK ids across restart',async()=>{
    const values=installBrowserState(true);
    queueOrderProjection({
      id:'MFK-1',display:'P001',createdAt:'2026-09-22T01:00:00.000Z',updatedAt:'2026-09-22T01:00:00.000Z',
      totalMinor:5000,paymentLabel:'CASH',fulfillmentLabel:'進行中',sourceLabel:'現場',items:[],
    });
    const event=readProjectionOutbox()[0]!.event;
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({accepted:[event.eventId]}),{
      status:200,headers:{'content-type':'application/json'},
    })));
    await flushProjectionOutbox();
    expect(readProjectionOutbox()).toHaveLength(0);
    expect(JSON.parse(values.get(SMT_PROJECTION_ACKED_KEY)||'[]')).toContain(event.eventId);

    queueOrderProjection({
      id:'MFK-1',display:'P001',createdAt:'2026-09-22T01:00:00.000Z',updatedAt:'2026-09-22T01:00:00.000Z',
      totalMinor:5000,paymentLabel:'CASH',fulfillmentLabel:'進行中',sourceLabel:'現場',items:[],
    });
    expect(JSON.parse(values.get(SMT_PROJECTION_OUTBOX_KEY)||'[]')).toHaveLength(0);
  });
});
