import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const ordering=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');
const orderingCss=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace.css'),'utf8');
const center=fs.readFileSync(path.join(root,'features/ordering/OrderingCenterWorkspaces.tsx'),'utf8');
const globalCss=fs.readFileSync(path.join(root,'styles.css'),'utf8');

describe('SMT Frontline Layout Correction R3',()=>{
  it('keeps add-to-cart feedback out of document flow',()=>{
    expect(ordering).toContain('ordering-feedback-stack');
    expect(orderingCss).toMatch(/\.ordering-feedback-stack\s*\{[^}]*position:absolute/s);
    expect(orderingCss).toContain('z-index:30');
  });

  it('locks products to four columns and caps visible grid at five rows',()=>{
    expect(orderingCss).toContain('grid-template-columns:repeat(4,minmax(0,1fr))!important');
    expect(orderingCss).toContain('max-height:746px');
    expect(orderingCss).toContain('max-height:616px');
    expect(orderingCss).not.toMatch(/grid-auto-rows:minmax\([^;]*1fr\)!important/);
  });

  it('groups visual preferences under one Display Settings surface',()=>{
    expect(app).toContain('clean-display-settings');
    expect(app).toContain("showImages:boolean");
    expect(app).toContain("density:'standard'|'compact'");
    expect(app).toContain('分類行數');
    expect(app).toContain('分類每行');
    expect(app).toContain('商品圖片');
    expect(app).toContain('商品密度');
    expect(app).toContain('商品卡固定每行 4 格');
    expect(globalCss).toContain('.clean-display-settings');
  });

  it('does not aggregate identical quick-add items when combine is off',()=>{
    expect(app).toContain('const existing=combineSimilar?');
    expect(app).toContain('if(!combineSimilar)');
    expect(app).toContain('Array.from({length:Math.max(1,line.qty)}');
    expect(app).toContain('quantity:1');
  });

  it('supports direct remove and explicit held-order restore',()=>{
    expect(ordering).toContain('ordering-line-remove');
    expect(ordering).toContain('onRemoveCartLine');
    expect(ordering).toContain('onOpenHeldOrders');
    expect(ordering).toContain('取單');
    expect(center).toContain('確認取回');
    expect(center).toContain('目前購物籃有');
    expect(app).toContain("onOpenHeldOrders:()=>setPanel({type:'holds'})");
  });
});
