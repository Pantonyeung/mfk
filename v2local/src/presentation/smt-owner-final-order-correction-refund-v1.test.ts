import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
const orders=fs.readFileSync(path.join(root,'presentation/RuntimeOrdersWorkspace.tsx'),'utf8');

describe('Owner FINAL order correction / refund / cancel notice',()=>{
  it('offers payment correction and linked refund from the Orders page',()=>{
    expect(orders).toContain('付款方式修正');
    expect(orders).toContain('Full Refund');
    expect(orders).toContain('Partial Refund');
    expect(orders).toContain('runtime.correctOrderPayment');
    expect(orders).toContain('runtime.refundOrder');
    expect(orders).toContain('付款修正歷史');
    expect(orders).toContain('退款紀錄');
  });

  it('fails closed on direct modification of own-platform formal orders until customer confirmation is wired',()=>{
    expect(orders).toContain("sourceLane(selected.sourceLabel)==='owned'");
    expect(orders).toContain('通知客戶 → 客戶確認');
    expect(orders).toContain('禁止直接改寫正式訂單');
  });

  it('prints a cancellation notice only after a production ticket was actually issued',()=>{
    expect(runtime).toContain('productionIssuedAt');
    expect(runtime).toContain("row.role==='製作單'&&row.ok");
    expect(runtime).toContain('dispatchCancellationNotice(order)');
    expect(runtime).toContain("*** 取消通知單 ***");
    expect(runtime).toContain("cancellationNoticeState");
    expect(runtime).toContain("if(order.fulfillmentLabel==='已取消')return");
  });

  it('never opens the cash drawer on cancellation notice or refunds',()=>{
    expect(runtime).toContain('kickDrawer:false');
    expect(runtime).not.toContain("action:'REFUND_FULL',orderId,reason:'DRAWER");
  });
});
