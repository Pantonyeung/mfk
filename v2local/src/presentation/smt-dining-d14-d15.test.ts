import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ui=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');

describe('D14-A / D15-A Dining presentation contract',()=>{
  it('exposes physical-table join without occupied-order merge semantics',()=>{
    expect(ui).toContain('runtime.joinDiningTable');
    expect(ui).toContain('runtime.unjoinDiningTable');
    expect(ui).toContain("joinHoldId?'撳此併枱'");
    expect(ui).toContain('已有人／已有正式訂單嘅枱唔會合併');
    expect(runtime).toContain("throw new Error('DINING_TABLE_OCCUPIED')");
    expect(runtime).toContain("action:'DINING_TABLE_JOIN'");
    expect(runtime).not.toContain('mergeDiningOrders');
  });

  it('exposes line correction while paid quantity remains outside destructive edit path',()=>{
    expect(ui).toContain('runtime.correctDiningLine');
    expect(ui).toContain('取消 1 件');
    expect(ui).toContain('退款／調整');
    expect(runtime).toContain('DINING_CORRECTION_EXCEEDS_UNPAID_QUANTITY');
    expect(runtime).toContain('DINING_PRODUCTION_CERTAINTY_UNKNOWN');
    expect(runtime).toContain('商品更正通知');
    expect(runtime).toContain("action:'DINING_LINE_VOID'");
  });
});