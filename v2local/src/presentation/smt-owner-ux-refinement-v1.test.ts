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
  it('restores the owner screenshot horizontal category layout',()=>{
    expect(ordering).toContain('ordering-browse-body');
    expect(orderingCss).toContain('grid-template-columns:repeat(7,minmax(0,1fr))');
    expect(orderingCss).toContain('grid-template-rows:auto minmax(0,1fr)');
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
    expect(fast).toContain('固定 F1–F6／預組產品照常直接落單');
    expect(app).toContain("label:'紫米套餐區'");
  });

  it('retains walk-in/external selection rules while dining always settles its existing local payment',()=>{
    expect(app).toContain("const settlementMode=diningCheckout||channel==='walk-in'?'LOCAL_PAYMENT' as const:'CHANNEL_INFO' as const");
    expect(app).toContain('enabled:!diningCheckout');
    expect(app).toContain('onSelectChannel:next=>{if(!diningCheckout)setChannel(next);}');
    expect(checkout).toContain('channel.enabled===false');
    expect(app).toContain("methods:(['CASH','ALIPAY','WECHAT','FPS','PAYME','COMBO']");
    expect(checkout).toContain("view.settlementMode==='LOCAL_PAYMENT'");
    expect(checkout).toContain('checkout-channel-stage');
    expect(checkout).toContain('view.channelInfo.fields.map');
    expect(app).toContain("whatsapp:'到店付款'");
    expect(app).toContain("'morefun-app':'到店付款'");
    expect(app).toContain("foodpanda:'FOODPANDA'");
    expect(app).toContain("keeta:'KEETA'");
  });

  it('locks 01 source and dynamic 02 payment/info with a blue checkout',()=>{
    expect(checkout).toContain('<i>01</i> ORDER SOURCE');
    expect(checkout).toContain('<i>02</i> PAYMENT');
    expect(checkout).toContain('<i>02</i> CHANNEL INFORMATION');
    expect(checkoutCss).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(checkoutCss).toContain('background:#1f5fbf');
  });

  it('uses the fixed product-detail geometry with authorized price override',()=>{
    expect(center).toContain('cfg-options-scroll');
    expect(center).toContain('cfg-review-panel');
    expect(center).toContain('canOverridePrice');
    expect(center).toContain('overrideUnitMinor');
    expect(app).toContain('staffAuthRequired()');
  });
});
