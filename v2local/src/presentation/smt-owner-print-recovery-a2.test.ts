import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ui=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
const css=fs.readFileSync(path.join(root,'presentation/dining-operations-workspace.css'),'utf8');
const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');

describe('SMT consolidation A2 — Dining print recovery presentation',()=>{
  it('states transport evidence is not physical-paper truth and forbids blind whole-set retry',()=>{
    expect(ui).toContain('已送到打印通道 ≠ 實體已出紙');
    expect(ui).toContain('系統唔會根據通訊結果自動猜缺紙或自動重印成套');
    expect(ui).toContain('打印通道結果未知；禁止盲目重播首次整套打印');
    expect(runtime).toContain('diningInitialPrintResults');
  });

  it('keeps the human reprint picker neutral and current-plan based',()=>{
    expect(ui).toContain('重印堂食票');
    expect(ui).toContain('只列票種、Label 同 Printer');
    expect(ui).toContain('唔會根據首次 transport 狀態推薦補邊張');
    expect(runtime).toContain('readDiningReprintOptions?(holdId:string)');
    expect(runtime).toContain('DINING_REPRINT_JOB_INVALID');
    const start=ui.indexOf('className="dining-reprint-options"');
    const end=ui.indexOf('</div>',start);
    const picker=ui.slice(start,end);
    expect(picker).not.toContain('firstPrintState');
    expect(picker).not.toContain('recommended');
  });

  it('uses a large fixed operator modal and guarantees no Drawer on reprint path',()=>{
    expect(css).toContain('.dining-reprint-modal');
    expect(css).toContain('width:min(75vw');
    expect(css).toContain('height:min(75vh');
    expect(css).toContain('min-height:48px');
    expect(runtime).toContain('new Set(unique)');
    expect(runtime).toContain("true,\n      'dining-initial'");
  });
});