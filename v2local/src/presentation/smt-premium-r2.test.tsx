import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const ordering=fs.readFileSync(path.join(root,'features/ordering/OrderingWorkspace.tsx'),'utf8');
const checkout=fs.readFileSync(path.join(root,'features/checkout/CheckoutWorkspace.tsx'),'utf8');
const orders=fs.readFileSync(path.join(root,'presentation/RuntimeOrdersWorkspace.tsx'),'utf8');
const styles=fs.readFileSync(path.join(root,'smt-premium-r2.css'),'utf8');
const main=fs.readFileSync(path.join(root,'main.tsx'),'utf8');

describe('SMT Premium Donor Fusion R2',()=>{
  it('adds decisive now-next guidance without changing domain authority',()=>{
    expect(ordering).toContain('ordering-decision-strip');
    expect(ordering).toContain('NEXT');
    expect(ordering).toContain('先設定');
    expect(ordering).toContain('直接加入');
    expect(orders).toContain('order-context-strip');
    expect(orders).toContain('orderNextLabel');
  });

  it('makes checkout progression explicit and keeps existing action callbacks',()=>{
    expect(checkout).toContain('checkout-decision-rail');
    expect(checkout).toContain('flowStep');
    expect(checkout).toContain('actions.onConfirm');
    expect(checkout).toContain('actions.onQuickCash');
    expect(checkout).toContain('actions.onRetry');
  });

  it('uses shared premium state grammar and reduced motion',()=>{
    for(const marker of[
      '--smt-r2-purple',
      '--smt-r2-coral',
      '--smt-r2-green',
      'ordering-product-card.recently-added',
      'checkout-step.is-current',
      'order-channel-list>button.selected',
      '@media(prefers-reduced-motion:reduce)'
    ])expect(styles).toContain(marker);
    expect(main).toContain("import './smt-premium-r2.css';");
  });

  it('does not add direct network or canonical business writers to presentation files',()=>{
    const presentation=[ordering,checkout,orders].join('\n');
    expect(presentation).not.toMatch(/\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b/);
    expect(presentation).not.toMatch(/createFormalOrder|allocateDisplayNumber|createPricingEngine|createPaymentEngine/);
  });
});
