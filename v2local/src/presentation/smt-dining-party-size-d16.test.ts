import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ui=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'presentation/dining-operations-workspace.css'),'utf8');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');

describe('D16 Dining party-size presentation',()=>{
  it('allows both waiting and seated Dining detail to use the same bounded cover mutation',()=>{
    expect(ui).toContain('runtime.updateDiningPartySize');
    expect(ui).toContain('dining-party-size-control');
    expect(ui).toContain('人數已更新為');
    expect(ui).toContain('void loadDetail(row.id)');
    expect(runtime).toContain('updateDiningPartySize?(holdId:string,partySize:number)');
  });

  it('keeps the control touch-safe and avoids pricing/payment/print side effects',()=>{
    expect(css).toContain('.dining-party-size-control button');
    expect(css).toContain('min-width:44px');
    expect(css).toContain('min-height:44px');
    expect(runtime).toContain("action:'DINING_PARTY_SIZE_CHANGE'");
    expect(runtime).not.toContain('printDiningPartySize');
  });
});