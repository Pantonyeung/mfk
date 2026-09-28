import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ui=fs.readFileSync(path.join(root,'presentation/RuntimeSoldoutWorkspace.tsx'),'utf8');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
const css=fs.readFileSync(path.join(root,'presentation/state-pages.css'),'utf8');

describe('CAP3 manual capacity correction UI',()=>{
  it('exposes explicit remaining-quantity adjustment on existing Soldout/Capacity surface',()=>{
    expect(ui).toContain('runtime.adjustCapacityPool');
    expect(ui).toContain('調整數量');
    expect(ui).toContain('目前剩餘數量');
    expect(ui).toContain('調整原因');
    expect(runtime).toContain('adjustCapacityPool?(poolId:string,remainingQty:number,note?:string)');
  });

  it('does not expose Manager-only or Override semantics and keeps a touch-safe action',()=>{
    expect(ui).not.toContain('Manager');
    expect(ui).not.toContain('Override');
    expect(css).toContain('.capacity-pool-adjust-button');
    expect(css).toContain('min-height:44px');
  });
});