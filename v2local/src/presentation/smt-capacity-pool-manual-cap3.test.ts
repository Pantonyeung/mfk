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

  it('keeps CAP3 free of a manager-only permission gate and preserves a touch-safe adjustment action',()=>{
    expect(ui).not.toContain('Manager-only');
    expect(css).toContain('.capacity-pool-adjust-button');
    expect(css).toContain('min-height:44px');
  });
});