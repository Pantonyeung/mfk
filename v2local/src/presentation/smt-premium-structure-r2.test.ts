import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const ordering=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');
const orderingCss=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace.css'),'utf8');
const soldout=fs.readFileSync(path.join(root,'presentation/RuntimeSoldoutWorkspace.tsx'),'utf8');
const soldoutCss=fs.readFileSync(path.join(root,'presentation/state-pages.css'),'utf8');
const more=fs.readFileSync(path.join(root,'presentation/LocalMoreWorkspace.tsx'),'utf8');
const moreCss=fs.readFileSync(path.join(root,'presentation/more-workspace.css'),'utf8');

describe('SMT Premium Structure Redesign R2',()=>{
  it('removes training copy and search from primary ordering viewport',()=>{
    expect(ordering).not.toContain('一按加入，有必選先停低');
    expect(ordering).not.toContain('搜尋商品名稱');
    expect(ordering).not.toContain('點選模式');
    expect(ordering).toContain('ordering-categories');
    expect(ordering).toContain('ordering-workbar');
  });

  it('moves mode and category density controls into side rail',()=>{
    expect(app).toContain('clean-order-controls');
    expect(app).toContain("categoryRows:1|2");
    expect(app).toContain("categoryColumns:5|6|7");
    expect(app).toContain("mode:'quick'|'standard'");
    expect(app).toContain('ETA');
    expect(app).toContain('fulfillmentMinutes');
    expect(orderingCss).toContain('.ordering-categories.rows-1');
    expect(orderingCss).toContain('.ordering-categories.rows-2');
  });

  it('supports explicit preview-only pending queue simulation without writing orders',()=>{
    expect(app).toContain("get('demo')==='pending'");
    expect(app).toContain("demo:true");
    expect(app).toContain("ETA 14:22");
    expect(app).not.toMatch(/demo-pending-[^\n]*createOrder/);
  });

  it('makes soldout text-first and supports canonical batch mutation',()=>{
    expect(soldout).toContain('批量售罄');
    expect(soldout).toContain('批量暫停');
    expect(soldout).toContain('批量恢復');
    expect(soldout).toContain("await runtime.setAvailability");
    expect(soldout).not.toContain('soldout-art');
    expect(soldout).not.toContain('搜尋商品');
    expect(soldoutCss).toContain('soldout-list-shell');
    expect(soldoutCss).toContain('soldout-batch-bar');
  });

  it('compresses day close into denomination grid plus one settlement panel',()=>{
    expect(more).toContain('cash-denomination-grid');
    expect(more).toContain('dayclose-settlement-panel');
    expect(more).toContain('留返開更金額');
    expect(more).toContain('確認日結');
    expect(more).not.toContain('先點清實際櫃桶現金，再輸入今次攞走幾多');
    expect(moreCss).toContain('.dayclose-workbench');
    expect(moreCss).toContain('grid-template-columns:minmax(0,1fr) 330px');
  });
});
