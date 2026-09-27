import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ui=fs.readFileSync(path.join(root,'presentation/RuntimeSoldoutWorkspace.tsx'),'utf8');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
const state=fs.readFileSync(path.join(root,'runtime/capacity-pool-state.ts'),'utf8');
const css=fs.readFileSync(path.join(root,'presentation/state-pages.css'),'utf8');

describe('CAP5 bounded override presentation contract',()=>{
  it('exposes explicit bounded approval with scope, quantity and approval content',()=>{
    expect(ui).toContain('runtime.approveCapacityOverride');
    expect(ui).toContain('Override 額外份數');
    expect(ui).toContain('Override 範圍：自家／第三方／全部');
    expect(ui).toContain('批准內容／原因');
    expect(ui).toContain('批准 Override');
    expect(ui).toContain('Override 剩餘');
  });

  it('keeps override local/bounded and touch-safe',()=>{
    expect(runtime).toContain('approveCapacityOverride?');
    expect(state).toContain("type CapacityOverrideScope='FIRST_PARTY'|'THIRD_PARTY'|'ALL_REMOTE'");
    expect(state).toContain('remainingAllowance');
    expect(state).toContain('CAPACITY_OVERRIDE_INSUFFICIENT');
    expect(css).toContain('.capacity-pool-override-button');
    expect(css).toContain('min-height:44px');
    expect(ui).toContain('不代表第三方平台已完成遠端恢復');
  });
});