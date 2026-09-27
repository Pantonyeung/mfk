import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ui=fs.readFileSync(path.join(root,'presentation/RuntimeSoldoutWorkspace.tsx'),'utf8');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
const css=fs.readFileSync(path.join(root,'presentation/state-pages.css'),'utf8');

describe('CAP1 capacity pool read-only presentation',()=>{
  it('shows current Business Day local pool state on the existing Soldout/Capacity surface',()=>{
    expect(ui).toContain('runtime.readCapacityPoolState');
    expect(ui).toContain('產能 Pool');
    expect(ui).toContain('本機狀態');
    expect(ui).toContain('自家 ≤');
    expect(ui).toContain('第三方 ≤');
    expect(runtime).toContain('readCapacityPoolState?():Promise<SmtCapacityPoolStateView>');
  });

  it('preserves the CAP1 read projection primitive as later capacity stages layer on top',()=>{
    expect(runtime).toContain('readCapacityPoolState?():Promise<SmtCapacityPoolStateView>');
    expect(css).toContain('.capacity-pool-state-panel');
    expect(runtime).not.toContain('secondCapacityPoolEngine');
  });
});