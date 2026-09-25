import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const checkout=fs.readFileSync(path.join(root,'features/checkout/CheckoutWorkspace.tsx'),'utf8');
const checkoutCss=fs.readFileSync(path.join(root,'features/checkout/checkout-workspace.css'),'utf8');
const orderingCss=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace.css'),'utf8');
const fast=fs.readFileSync(path.join(root,'features/ordering/FastLaneWorkspaces.tsx'),'utf8');
const prefs=fs.readFileSync(path.join(root,'runtime/frontline-ui-preferences.ts'),'utf8');

describe('Owner FINAL V1.0 frontline preview',()=>{
  it('keeps high-frequency nav and moves More to a hamburger',()=>{
    expect(app).toContain("label:'售罄／產能'");
    expect(app).not.toContain("{to:'/more',label:'更多'");
    expect(app).toContain('clean-more-button');
    expect(app).toContain("navigate('/more')");
  });

  it('persists fine-grained display settings instead of size presets',()=>{
    expect(app).toContain('產品卡高度');
    expect(app).toContain('字體');
    expect(app).toContain('整體密度');
    expect(app).toContain('即時 Preview · 自動保存 · 重開保留');
    expect(prefs).toContain("mfk.smt.frontline-ui.v1");
    expect(prefs).toContain('productCardHeight');
    expect(prefs).toContain('fontScale');
    expect(prefs).toContain('densityScale');
  });

  it('uses approximately 75 percent for major ordering modals',()=>{
    expect(orderingCss).toContain('.ordering-modal-window.product-detail');
    expect(orderingCss).toContain('.ordering-modal-window.default-detail');
    expect(orderingCss).toContain('width:75%');
    expect(orderingCss).toContain('height:75%');
  });

  it('uses Owner FINAL Fast Lane labels',()=>{
    expect(app).toContain("label:'快速組合'");
    expect(app).toContain("label:'必選區'");
    expect(app).toContain("label:'紫米套餐區'");
    expect(fast).toContain('<h2>快速組合</h2>');
    expect(fast).toContain('<h2>紫米套餐區</h2>');
  });

  it('makes first payment confirm the commit and opens a post-commit completion review',()=>{
    expect(app).toContain('submissionId:checkoutSubmissionIdRef.current');
    expect(app).toContain('printInitialOrderOutputsOnce(order.id)');
    expect(checkout).toContain('COMPLETION REVIEW');
    expect(checkout).toContain('交易已完成');
    expect(checkout).toContain('付款方式修正');
    expect(checkoutCss).toContain('.checkout-completion-modal');
    expect(checkoutCss).toContain('width:75%');
    expect(checkout).toContain('完成</button>');
  });

  it('keeps cash quick buttons from the Owner requirement',()=>{
    expect(checkout).toContain('[20,50,100,200,500]');
    expect(checkout).toContain('剛好');
  });
});
