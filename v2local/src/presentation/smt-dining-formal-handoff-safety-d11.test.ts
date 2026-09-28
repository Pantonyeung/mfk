import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('D11 paid Dining formal handoff safety',()=>{
  it('projects an explicitly selected active Dining Order into the formal Orders surface',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');

    expect(runtime).toContain("return Boolean(selectedOrderId&&order.id===selectedOrderId)");
    expect(runtime).toContain("...(order.diningHoldId?{diningHoldId:order.diningHoldId}:{})");
    expect(runtime).toContain("...(order.recognizedSalesMinor!==undefined?{recognizedSalesMinor:order.recognizedSalesMinor}:{})");
    expect(runtime).toContain("...(order.outstandingMinor!==undefined?{outstandingMinor:order.outstandingMinor}:{})");
  });

  it('keeps active Dining formal actions bounded instead of exposing generic mutations',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const orders=fs.readFileSync(path.join(root,'presentation/RuntimeOrdersWorkspace.tsx'),'utf8');

    expect(orders).toContain("const selectedIsActiveDining=Boolean(selectedIsDining&&selected&&!['已完成','已取消'].includes(selected.fulfillmentLabel))");
    expect(orders).toContain('活躍堂食未關單，暫不直接退款');
    expect(orders).toContain('堂食付款係逐筆 Payment truth');
    expect(orders).toContain('堂食商品修改／加單要返堂食流程處理');
    expect(orders).toContain('堂食履約狀態由堂食流程管理');
    expect(orders).toContain("disabled={selectedIsActiveDining}");
  });

  it('marks fully paid archived Dining as completed and keeps cancellation separate',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');

    expect(runtime).toContain("hold.archivedAt&&fullyPaid");
    expect(runtime).toContain("?'已取消'");
    expect(runtime).toContain("?'已完成'");
    expect(runtime).toContain("DINING_REFUND_REQUIRES_CLOSED_CHECK");
    expect(runtime).toContain("DINING_REFUND_EXCEEDS_CONFIRMED_PAID");
    expect(runtime).toContain("DINING_REFUND_LINE_AMBIGUOUS");
  });
});
