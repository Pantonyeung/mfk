import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const orders=fs.readFileSync(path.join(root,'presentation/RuntimeOrdersWorkspace.tsx'),'utf8');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

describe('SMT Owner consolidation fulfillment UI',()=>{
  it('uses three Owner source lanes and allows any authenticated SMT operator without a Manager-only gate',()=>{
    expect(orders).toContain("label:'現場／直接來源'");
    expect(orders).toContain("label:'自家平台'");
    expect(orders).toContain("label:'第三方平台'");
    expect(orders).toContain('Boolean(activeStaff)||!staffAuthRequired()');
    expect(orders).not.toContain("hasStaffPermission('ORDER_REVIEW')");
    expect(orders).not.toContain("hasStaffPermission('ORDER_CORRECTION')");
  });

  it('shows reversible fulfillment and bounded Keeta defer controls',()=>{
    expect(orders).toContain('退回未完成');
    expect(orders).toContain('已取餐');
    expect(orders).toContain('稍後處理 ');
    expect(orders).toContain('runtime.markOrderUnready');
    expect(orders).toContain('runtime.markOrderCompleted');
    expect(orders).toContain('runtime.deferKeetaOrder');
  });

  it('shows customer and external identifiers when available',()=>{
    expect(orders).toContain('selected.customerName');
    expect(orders).toContain('selected.externalOrderNo');
    expect(orders).toContain('selected.pickupCode');
  });

  it('keeps restart-safe ETA auto-ready loop on the operational shell',()=>{
    expect(app).toContain("order.fulfillmentLabel!=='進行中'||!order.etaReadyAt");
    expect(app).toContain('localRuntime.markOrderReady?.(order.id)');
    expect(app).toContain('window.setInterval(tick,10_000)');
  });
});
