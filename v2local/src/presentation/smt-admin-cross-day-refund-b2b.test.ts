import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildLocalReport} from '../runtime/local-operations.ts';
import {MFK_ADMIN_REFUND_SCHEMA} from '../../../contracts/admin-refund-v1.ts';

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

describe('SMT B2b Admin cross-day refund intake',()=>{
  beforeEach(()=>{
    installStorage();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T02:00:00.000Z'));
  });
  afterEach(()=>vi.useRealTimers());

  it('keeps original sale day intact, posts refund on execution day, and reduces period total exactly once',async()=>{
    const {localRuntime}=await import('../runtime/local-runtime.ts');
    localRuntime.clear();
    const order=localRuntime.createOrder({
      items:[{id:'line-a',name:'飯團',qty:1,unitMinor:5000,serviceMode:'takeaway'}],
      totalMinor:5000,paymentLabel:'CASH',sourceLabel:'現場',
    });
    const originalFulfillment=order.fulfillmentLabel;

    vi.setSystemTime(new Date('2026-09-22T10:00:00.000Z'));
    const event={
      schema:MFK_ADMIN_REFUND_SCHEMA,
      refundId:'AR-cross-day-001',
      storeId:'MF01',
      orderId:order.id,
      display:order.display,
      originalBusinessDate:'2026-09-21',
      originalCreatedAt:order.createdAt,
      executionAt:'2026-09-22T10:00:00.000Z',
      executionBusinessDate:'2026-09-22',
      method:'CASH',
      amountMinor:2000,
      lines:[{lineId:'line-a',itemName:'飯團',quantity:1,amountMinor:2000}],
      note:'跨日退款',
      source:'ADMIN',
      originalDayCloseVersion:1,
      addendumSequence:1,
      addendumVersionLabel:'1.1',
    } as const;

    expect(localRuntime.applyAdminRefundEvent(event).disposition).toBe('APPLIED');
    expect(localRuntime.applyAdminRefundEvent(event).disposition).toBe('IDEMPOTENT');
    expect(localRuntime.orders().find(row=>row.id===order.id)?.fulfillmentLabel).toBe(originalFulfillment);

    const monday=buildLocalReport(localRuntime.orders(),{
      now:Date.parse('2026-09-21T12:00:00.000Z'),businessStartHour:5,businessStartMinute:0,
    });
    const tuesday=buildLocalReport(localRuntime.orders(),{
      now:Date.parse('2026-09-22T12:00:00.000Z'),businessStartHour:5,businessStartMinute:0,
    });
    expect(monday.grossSalesMinor).toBe(5000);
    expect(monday.refundMinor).toBe(0);
    expect(monday.netSalesMinor).toBe(5000);
    expect(tuesday.grossSalesMinor).toBe(0);
    expect(tuesday.refundMinor).toBe(2000);
    expect(tuesday.netSalesMinor).toBe(-2000);
    expect(tuesday.cashRefundMinor).toBe(2000);
    expect(monday.netSalesMinor+tuesday.netSalesMinor).toBe(3000);
    expect(tuesday.refundRows[0]).toMatchObject({
      refundId:'AR-cross-day-001',
      orderId:order.id,
      originalBusinessDate:'2026-09-21',
      method:'CASH',
      amountMinor:2000,
    });
  });

  it('uses actual refund method for drawer effect and preserves refund after restart',async()=>{
    const first=await import('../runtime/local-runtime.ts');
    first.localRuntime.clear();
    const order=first.localRuntime.createOrder({
      items:[{id:'line-a',name:'飯團',qty:1,unitMinor:5000,serviceMode:'takeaway'}],
      totalMinor:5000,paymentLabel:'CASH',sourceLabel:'現場',
    });
    vi.setSystemTime(new Date('2026-09-22T10:00:00.000Z'));
    first.localRuntime.applyAdminRefundEvent({
      schema:MFK_ADMIN_REFUND_SCHEMA,
      refundId:'AR-cross-day-fps',
      storeId:'MF01',
      orderId:order.id,
      display:order.display,
      originalBusinessDate:'2026-09-21',
      originalCreatedAt:order.createdAt,
      executionAt:'2026-09-22T10:00:00.000Z',
      executionBusinessDate:'2026-09-22',
      method:'FPS',
      amountMinor:2000,
      lines:[{lineId:'line-a',itemName:'飯團',quantity:1,amountMinor:2000}],
      note:'',
      source:'ADMIN',
      originalDayCloseVersion:1,
      addendumSequence:1,
      addendumVersionLabel:'1.1',
    });
    const report=buildLocalReport(first.localRuntime.orders(),{
      now:Date.parse('2026-09-22T12:00:00.000Z'),businessStartHour:5,businessStartMinute:0,
    });
    expect(report.refundMinor).toBe(2000);
    expect(report.cashRefundMinor).toBe(0);

    vi.resetModules();
    const restarted=await import('../runtime/local-runtime.ts');
    expect(restarted.localRuntime.orders().find(row=>row.id===order.id)?.refunds?.[0]?.id).toBe('AR-cross-day-fps');
  });

  it('installs Admin refund doorbell intake and prints refund original/execution timing in day close',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const main=fs.readFileSync(path.resolve(root,'../main.tsx'),'utf8');
    const intake=fs.readFileSync(path.join(root,'runtime/admin-refund-intake.ts'),'utf8');
    const ticket=fs.readFileSync(path.join(root,'runtime/daily-close-ticket.ts'),'utf8');
    expect(main).toContain('installAdminRefundIntake');
    expect(intake).toContain("event.type==='ADMIN_REFUND_AVAILABLE'");
    expect(intake).toContain('/api/admin-sync/smt-refunds?storeId=MF01&deviceId=');
    expect(ticket).toContain('【退款明細】');
    expect(ticket).toContain("+'原單：'+original");
    expect(ticket).toContain("+'退款：'+execution");
  });
});
