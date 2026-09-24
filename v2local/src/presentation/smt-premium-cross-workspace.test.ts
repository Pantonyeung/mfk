import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const globalCss=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const orderingCss=fs.readFileSync(path.join(root,'features/ordering/ordering-workspace.css'),'utf8');
const checkoutCss=fs.readFileSync(path.join(root,'features/checkout/checkout-workspace.css'),'utf8');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

describe('SMT cross-workspace premium language',()=>{
  it('applies one decisive grammar to orders dining soldout more and shell',()=>{
    expect(globalCss).toContain('MoreFunOS Premium Interaction Language — SMT R1');
    for(const marker of['.clean-rail','.order-manager','.dining-operations-workspace','.soldout-operations-page','.more-workspace']){
      expect(globalCss).toContain(marker);
    }
    expect(globalCss).toContain('--mf-smt-blue:#1768dc');
    expect(globalCss).toContain('--mf-smt-green:#15855a');
    expect(globalCss).toContain('--mf-smt-amber:#9a6308');
    expect(globalCss).toContain('--mf-smt-red:#bd3d37');
  });

  it('has immediate feedback, designed focus and reduced-motion equivalence',()=>{
    expect(orderingCss).toContain('--smt-motion-tap:90ms');
    expect(orderingCss).toContain('recently-added');
    expect(orderingCss).toContain('line-updated');
    expect(checkoutCss).toContain('checkout-fast-section.is-current');
    expect(checkoutCss).toContain('prefers-reduced-motion:reduce');
    expect(globalCss).toContain('prefers-reduced-motion:reduce');
    expect(globalCss).toContain(':focus-visible');
  });

  it('keeps SMT current runtime as the only execution seam',()=>{
    expect(app).toContain('localRuntime.createOrder');
    expect(app).toContain('localRuntime.printOrderOutputs');
    expect(app).toContain('localRuntime.settleDiningHold');
    expect(app).not.toMatch(/fetch\s*\(|new\s+WebSocket|XMLHttpRequest/);
  });
});
