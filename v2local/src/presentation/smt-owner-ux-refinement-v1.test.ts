import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const ordering=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');
const orderingCss=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace.css'),'utf8');
const center=fs.readFileSync(path.join(root,'features/ordering/OrderingCenterWorkspaces.tsx'),'utf8');
const fast=fs.readFileSync(path.join(root,'features/ordering/FastLaneWorkspaces.tsx'),'utf8');
const checkout=fs.readFileSync(path.join(root,'features/checkout/CheckoutWorkspace.tsx'),'utf8');
const checkoutCss=fs.readFileSync(path.join(root,'features/checkout/checkout-workspace.css'),'utf8');

describe('SMT owner UX refinement',()=>{
  it('uses a compact category rail instead of a full-width category strip',()=>{
    expect(ordering).toContain('ordering-browse-body');
    expect(orderingCss).toContain('grid-template-columns:126px minmax(0,1fr)');
    expect(orderingCss).toContain('flex-direction:column');
  });

  it('uses one large dismissible modal and protects unsaved edits',()=>{
    expect(ordering).toContain('ordering-modal-backdrop');
    expect(ordering).toContain('ordering-modal-window');
    expect(ordering).toContain('if(event.target===event.currentTarget)centerPanel.onClose()');
    expect(app).toContain("window.confirm('有未保存修改，確定退出？')");
    expect(center).toContain('onDirtyChange?.(true)');
    expect(center).not.toContain('export function OrganizeWorkspace');
    expect(center).not.toContain('export function ComboWorkspace');
  });

  it('keeps ABC visible as riceball-meal groups even before full pairing',()=>{
    expect(fast).toContain('previewLabels=Array.from({length:mainUnits}');
    expect(fast).toContain('等待小食配對');
    expect(fast).toContain('加入飯團後，A／B／C… 組別會即時喺呢度出現');
    expect(fast).toContain('固定 F1–F6 類產品照常直接落單');
    expect(app).toContain("label:'飯團餐配對'");
  });

  it('shows local tenders only for walk-in and replaces them with channel information otherwise',()=>{
    expect(app).toContain("const settlementMode=channel==='walk-in'?'LOCAL_PAYMENT' as const:'CHANNEL_INFO' as const");
    expect(app).toContain("methods:(['CASH','ALIPAY','WECHAT','FPS','PAYME','COMBO']");
    expect(checkout).toContain("view.settlementMode==='LOCAL_PAYMENT'");
    expect(checkout).toContain('checkout-channel-stage');
    expect(checkout).toContain('view.channelInfo.fields.map');
    expect(app).toContain("whatsapp:'到店付款'");
    expect(app).toContain("'morefun-app':'到店付款'");
    expect(app).toContain("foodpanda:'FOODPANDA'");
    expect(app).toContain("keeta:'KEETA'");
  });

  it('restores large payment choices instead of a thin step-by-step strip',()=>{
    expect(checkoutCss).toContain('grid-template-rows:repeat(2,minmax(88px,1fr))');
    expect(checkoutCss).toContain('min-height:88px');
    expect(checkout).not.toContain('<span>1</span><b>選擇來源</b>');
    expect(checkout).not.toContain('<span>2</span><b>付款方式</b>');
  });
});
