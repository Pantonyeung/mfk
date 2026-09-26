// MFK SMT A1 R4 R2 proof on latest main.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initialHoldModeForLines} from '../features/ordering/OrderingCenterWorkspaces.tsx';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ordering=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');
const center=fs.readFileSync(path.join(root,'features/ordering/OrderingCenterWorkspaces.tsx'),'utf8');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

describe('Owner dining cart-entry mindset R4 on current main',()=>{
  it('opens ordinary hold first when every cart line is takeaway',()=>{
    expect(initialHoldModeForLines([
      {serviceMode:'takeaway'},
      {serviceMode:'takeaway'},
    ])).toBe('cart');
  });

  it('opens dining first when any cart line is dine-in, including mixed carts',()=>{
    expect(initialHoldModeForLines([
      {serviceMode:'takeaway'},
      {serviceMode:'dine-in'},
    ])).toBe('dining');
  });

  it('keeps both concepts manually switchable inside the same modal',()=>{
    expect(center).toContain("initialMode?:'cart'|'dining'");
    expect(center).toContain('<b>暫存</b>');
    expect(center).toContain('<b>堂食</b>');
    expect(center).toContain("setMode('cart')");
    expect(center).toContain("setMode('dining')");
    expect(center).toContain('確認暫存');
  });

  it('uses one large cart action and shrinks destructive clear to a trash icon',()=>{
    expect(ordering).toContain('暫存／堂食');
    expect(ordering).toContain('cart-clear-icon');
    expect(ordering).toContain('aria-label="清除訂單"');
    expect(ordering).toContain('<TrashGlyph/>');
  });

  it('passes the cart-derived default into the existing hold workspace without another dining engine',()=>{
    expect(app).toContain('initialMode={initialHoldModeForLines(cart)}');
    expect(app).toContain("setPanel({type:'hold'})");
    expect(app).not.toContain('createDiningEngine');
  });
});
