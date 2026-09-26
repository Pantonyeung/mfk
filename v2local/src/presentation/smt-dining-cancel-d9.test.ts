import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('D9 Dining cancellation operator boundary',()=>{
  it('exposes cancellation only for unpaid Dining and requires reason + final confirmation',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');

    expect(dining).toContain("const reason=window.prompt('請輸入取消原因','客人取消堂食')");
    expect(dining).toContain("window.confirm('確認取消 '+detail.codeLabel");
    expect(dining).toContain("await runtime.cancelOrder(detail.formalOrderId,reason.trim()||'堂食取消')");
    expect(dining).toContain("disabled={!detail.formalOrderId||detail.paidMinor>0}");
    expect(dining).toContain("detail.paidMinor>0?'已有付款':'取消堂食單'");
  });

  it('states cancel-not-refund and never calls refund from the Dining cancel action',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
    const start=dining.indexOf('  const cancelUnpaidDining=async()=>{');
    const end=dining.indexOf('  const clearTable=async()=>{',start);
    const block=dining.slice(start,end);

    expect(block).toContain('取消唔等於退款');
    expect(block).toContain('冇自動退款、冇開錢箱');
    expect(block).not.toContain('refundOrder');
    expect(block).not.toContain('settleDiningHold');
    expect(block).not.toContain('ensureDiningPaymentReceipt');
  });
});
