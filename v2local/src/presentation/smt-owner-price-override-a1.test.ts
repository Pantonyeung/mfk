import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ui=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'presentation/dining-operations-workspace.css'),'utf8');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');

describe('SMT consolidation A1 manual price override presentation',()=>{
  it('shows the control only through Admin PRICE_OVERRIDE permission and preserves role neutrality',()=>{
    expect(ui).toContain("hasStaffPermission('PRICE_OVERRIDE')");
    expect(ui).toContain('Boolean(readActiveStaffSession())');
    expect(ui).toContain('人工改價');
    expect(ui).toContain('Role 名稱唔會自動取得改價權');
    expect(runtime).toContain("if(!session)throw new Error('DINING_PRICE_OVERRIDE_AUTH_REQUIRED')");
    expect(runtime).toContain("if(!hasStaffPermission('PRICE_OVERRIDE'))throw new Error('DINING_PRICE_OVERRIDE_FORBIDDEN')");
    expect(runtime).not.toContain("session.role==='OWNER'");
  });

  it('exposes signed deal price, optional reason, stale protection and append-only audit history',()=>{
    expect(ui).toContain('例如 39.00 或 -5.00');
    expect(ui).toContain('原因（選填）');
    expect(ui).toContain('人工改價紀錄');
    expect(ui).toContain('priceOverrideRevision');
    expect(runtime).toContain('DINING_PRICE_OVERRIDE_STALE');
    expect(runtime).toContain("source:'MANUAL_OVERRIDE'");
    expect(runtime).toContain("permission:'PRICE_OVERRIDE'");
    expect(runtime).toContain('sequence');
  });

  it('uses a fixed large modal and keeps negative balances out of ordinary Checkout',()=>{
    expect(css).toContain('.dining-price-override-modal');
    expect(css).toContain('width:min(75vw');
    expect(css).toContain('height:min(75vh');
    expect(css).toContain('min-height:48px');
    expect(ui).toContain('一般收款 Checkout 已停用');
    expect(runtime).toContain('DINING_NEGATIVE_BALANCE_REQUIRES_ADJUSTMENT');
  });
});