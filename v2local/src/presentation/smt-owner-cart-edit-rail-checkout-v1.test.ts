import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const center=fs.readFileSync(path.join(root,'features/ordering/OrderingCenterWorkspaces.tsx'),'utf8');
const ordering=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');
const orderingCss=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace.css'),'utf8');
const checkout=fs.readFileSync(path.join(root,'features/checkout/CheckoutWorkspace.tsx'),'utf8');
const checkoutCss=fs.readFileSync(path.join(root,'features/checkout/checkout-workspace.css'),'utf8');
const shellCss=fs.readFileSync(path.join(root,'styles.css'),'utf8');

describe('SMT owner cart edit / rail / checkout refinement',()=>{
  it('opens cart lines in edit mode and updates the same line instead of creating a second cart line',()=>{
    expect(app).toContain("setPanel({type:'product',productId:line.productId,lineId:line.id})");
    expect(app).toContain('const updateConfigured=(lineId:string');
    expect(app).toContain("cart.map(line=>line.id===lineId?");
    expect(center).toContain("mode?:'add'|'edit'");
    expect(center).toContain("mode==='edit'?'儲存修改':'加入購物籃'");
    expect(center).toContain('initialSelections');
    expect(center).toContain('initialUnitMinor');
  });

  it('sizes product detail to roughly three quarters of the screen',()=>{
    expect(ordering).toContain("centerPanel.variant==='product'?'product-detail':'default-detail'");
    expect(orderingCss).toContain('.ordering-modal-window.product-detail');
    expect(orderingCss).toContain('width:75%');
    expect(orderingCss).toContain('height:75%');
  });

  it('moves quick mode, quick drink and display switches to the left rail',()=>{
    expect(app).toContain('clean-order-tools');
    expect(app).toContain('clean-display-popover');
    expect(app).toContain("orderingMode==='quick'?'active':''");
    expect(app).toContain('quickDrinkCount');
    expect(ordering).not.toContain('ordering-fast-controls');
    expect(shellCss).toContain('.clean-order-tools');
  });

  it('keeps keypad visible but disabled for electronic or external channels',()=>{
    expect(checkout).toContain("const keypadEnabled=view.settlementMode==='LOCAL_PAYMENT'&&view.cashEntryVisible");
    expect(checkout).toContain('disabled={!keypadEnabled}');
    expect(checkout).toContain("checkout-payment-body'+(keypadEnabled?'':' keypad-disabled')");
    expect(checkoutCss).toContain('.checkout-payment-body.keypad-disabled .checkout-keypad');
    expect(checkoutCss).toContain('opacity:.42');
  });

  it('restores compact checkout proportions',()=>{
    expect(checkoutCss).toContain('.checkout-source-grid button{min-height:50px');
    expect(checkoutCss).toContain('.checkout-method-grid button{min-height:50px');
    expect(checkoutCss).toContain('.checkout-keypad button{min-height:46px');
  });
});
