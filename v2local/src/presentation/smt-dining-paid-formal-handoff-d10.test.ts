import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('D10 paid Dining formal action handoff',()=>{
  it('routes paid Dining to the existing formal Orders surface with the SAME Order identity',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');

    expect(dining).toContain("detail.paidMinor>0&&detail.formalOrderId");
    expect(dining).toContain("navigate('/orders?orderId='+encodeURIComponent(detail.formalOrderId!))");
    expect(dining).toContain('退款同取消係兩個獨立正式動作');
    expect(dining).toContain('>正式訂單處理</button>');
  });

  it('does not create a second paid-cancel/refund authority inside Dining',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
    const orders=fs.readFileSync(path.join(root,'presentation/RuntimeOrdersWorkspace.tsx'),'utf8');

    const start=dining.indexOf('{detail.paidMinor>0&&detail.formalOrderId');
    const end=dining.indexOf('<button type="button" className="clear"',start);
    const block=dining.slice(start,end);

    expect(block).not.toContain('refundOrder');
    expect(block).not.toContain('settleDiningHold');
    expect(block).not.toContain('ensureDiningPaymentReceipt');
    expect(block).not.toContain('cancelOrder(');

    expect(orders).toContain("const initialOrderId=params.get('orderId')??undefined");
    expect(orders).toContain('void load(initialOrderId)');
    expect(orders).toContain('runtime.refundOrder');
    expect(orders).toContain('runtime.cancelOrder');
  });

  it('keeps unpaid Dining on the bounded D9 direct-cancel path',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');

    expect(dining).toContain(':<button type="button" className="cancel-order" disabled={!detail.formalOrderId} onClick={()=>void cancelUnpaidDining()}>取消堂食單</button>');
    expect(dining).toContain("await runtime.cancelOrder(detail.formalOrderId,reason.trim()||'堂食取消')");
  });
});
