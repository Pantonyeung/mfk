import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');

const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const center=fs.readFileSync(path.join(root,'features/ordering/OrderingCenterWorkspaces.tsx'),'utf8');
const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
const orders=fs.readFileSync(path.join(root,'presentation/RuntimeOrdersWorkspace.tsx'),'utf8');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');

describe('SMT donor skeleton fusion V2 parity locks',()=>{
  it('preserves dual-purpose hold: normal draft plus dining queue/table placement',()=>{
    expect(center).toContain('<b>暫存</b>');
    expect(center).toContain('<b>堂食</b>');
    expect(center).toContain('加入輪候');
    expect(center).toContain('hold-nine-grid');
    expect(app).toContain("localRuntime.createHold({kind:'waiting'");
    expect(app).toContain("localRuntime.createHold({kind:'dining'");
    expect(app).toContain('localRuntime.assignDiningTable?.(draft.id,tableId)');
  });

  it('preserves current dining authority and partial settlement',()=>{
    expect(runtime).toContain('settleDiningHold');
    expect(runtime).toContain('remainingQty');
    expect(runtime).toContain('unassignDiningTable');
    expect(runtime).toContain('clearDiningHold');
    expect(dining).toContain('onCheckout');
  });

  it('preserves current customer and Keeta arrival channels',()=>{
    expect(app).toContain("window.addEventListener('mfk-customer-order-intake'");
    expect(app).toContain("window.addEventListener('mfk-keeta-order-intake'");
    expect(orders).toContain('acceptOrder');
    expect(orders).toContain('markOrderReady');
  });

  it('preserves all three MoreFunOS frontline accelerators',()=>{
    expect(app).toContain("id:'riceball-pool'");
    expect(app).toContain("id:'required'");
    expect(app).toContain("id:'combo'");
    expect(app).toContain('快速組合');
    expect(app).toContain('必選區');
    expect(app).toContain('紫米套餐區');
  });

  it('forbids using the rejected Fusion R1 as an implementation dependency',()=>{
    expect(app).not.toContain('SMT-FULL-FUSION-OPTIMIZATION-R1');
    expect(center).not.toContain('SMT-FULL-FUSION-OPTIMIZATION-R1');
  });
});
