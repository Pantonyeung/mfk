import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ui=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
const css=fs.readFileSync(path.join(root,'presentation/dining-operations-workspace.css'),'utf8');

describe('SMT Owner consolidation price override UI',()=>{
  it('shows manual price only under Admin PRICE_OVERRIDE permission and an unpaid Formal Order',()=>{
    expect(ui).toContain("hasStaffPermission('PRICE_OVERRIDE')");
    expect(ui).toContain('detail.formalOrderId&&detail.payments.length===0');
    expect(ui).toContain('人工改價');
    expect(ui).toContain('runtime.overrideDiningLinePrice');
    expect(runtime).toContain("permission:'PRICE_OVERRIDE'");
  });

  it('captures the visible revision and keeps immutable audit history visible',()=>{
    expect(ui).toContain('const expectedRevision=detail.checkoutRevision');
    expect(ui).toContain('人工改價紀錄');
    expect(ui).toContain('row.sequence');
    expect(ui).toContain('row.originalUnitMinor');
    expect(ui).toContain('row.effectiveUnitMinor');
    expect(ui).toContain('row.staffName');
  });

  it('accepts signed price input but explicitly blocks ordinary checkout on a negative balance',()=>{
    expect(ui).toContain("人工成交單價（可輸入負數）");
    expect(ui).toContain('detail.remainingMinor<0');
    expect(ui).toContain('一般收款 Checkout 停用');
    expect(runtime).toContain('DINING_NEGATIVE_BALANCE_REQUIRES_ADJUSTMENT');
  });

  it('keeps the operator control compact and touch-safe',()=>{
    expect(css).toContain('.dining-line-price-override');
    expect(css).toContain('min-height:32px');
    expect(css).toContain('.dining-price-override-history');
  });
});
// branch smoke trigger
