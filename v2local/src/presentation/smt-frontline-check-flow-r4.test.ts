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

describe('SMT Frontline Check Flow R4',()=>{
  it('places cart view service and combine controls in the cart header',()=>{
    expect(ordering).toContain('ordering-cart-head-controls');
    expect(ordering).toContain("view.cart.viewMode==='original'?'原單':'整理'");
    expect(ordering).toContain("view.cart.serviceMode==='takeaway'?'外賣':'堂食'");
    expect(ordering).toContain("組合 {view.cart.combineSimilar?'開':'關'}");
    expect(orderingCss).toContain('.ordering-cart-head-controls');
  });

  it('shows save and cancel only for active carts, and retrieve only for empty carts',()=>{
    expect(ordering).toContain('view.cart.lines.length?<div className="ordering-cart-secondary-actions active-cart"');
    expect(ordering).toContain('>暫存</button>');
    expect(ordering).toContain('>取消</button>');
    expect(ordering).toContain('view.heldCartCount>0?<div className="ordering-cart-secondary-actions empty-cart"');
    expect(ordering).toContain('取回訂單');
    expect(orderingCss).toContain('.ordering-cart-secondary-actions.active-cart');
    expect(orderingCss).toContain('.ordering-cart-secondary-actions.empty-cart');
  });

  it('save is immediate and clears the cart for the next guest',()=>{
    expect(app).toContain("localRuntime.createHold({kind:'waiting'");
    expect(app).toContain("note:'暫存'");
    expect(app).toMatch(/onHoldCart:\(\)=>\{[\s\S]*createHold[\s\S]*finishHold\(\);/);
    expect(app).toContain("onOpenHeldOrders:()=>{if(!cart.length&&savedCarts.length)setPanel({type:'holds'});}");
  });

  it('keeps saved carts separate from dining holds',()=>{
    expect(app).toContain("heldCarts.filter(hold=>hold.kind==='waiting')");
    expect(app).toContain('heldCartCount:savedCarts.length');
    expect(app).toContain('holds={savedCarts as readonly WorkspaceHoldDraft[]}');
  });

  it('uses a compact open-check list plus preview for retrieval',()=>{
    expect(center).toContain('open-checks-workspace');
    expect(center).toContain('open-checks-list');
    expect(center).toContain('open-checks-preview');
    expect(center).toContain('取回訂單');
  });
});
