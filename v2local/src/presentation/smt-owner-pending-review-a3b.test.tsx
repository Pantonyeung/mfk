import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PendingOrderReviewWorkspace} from '../features/ordering/PendingOrderReviewWorkspace.tsx';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const pendingSource=fs.readFileSync(path.join(root,'features/ordering/PendingOrderReviewWorkspace.tsx'),'utf8');
const runtimeSource=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
const intakeSource=fs.readFileSync(path.join(root,'runtime/customer-cloud-intake.ts'),'utf8');

const keetaOrder:any={
  id:'MFK-K1',
  display:'P017',
  sourceLabel:'Keeta · K017',
  createdAt:'2026-09-27T10:00:00.000Z',
  totalMinor:5900,
  paymentLabel:'KEETA',
  fulfillmentLabel:'待處理',
  providerRef:'KEETA:17',
  providerPickupCode:'K017',
  keetaDeferCount:1,
  items:[{id:'main',name:'紫米飯團 A 餐',qty:1,unitMinor:5900,detail:'飯團：原味 · 小食：鹽酥雞'}],
};

describe('SMT consolidation A3B — Summary → Review → Accept presentation',()=>{
  it('opens on a non-mutating Summary before Review / Accept',()=>{
    const html=renderToStaticMarkup(<PendingOrderReviewWorkspace
      order={keetaOrder}
      onAccept={async()=>''}
      onOpenOrders={()=>undefined}
      onDeferKeeta={async()=>undefined}
    />);
    expect(html).toContain('#P017');
    expect(html).toContain('摘要');
    expect(html).toContain('即刻處理');
    expect(html).toContain('稍後處理');
    expect(html).toContain('1 / 2');
    expect(html).toContain('完整訂單工作台');
    expect(html).not.toContain('確認接單');
  });

  it('keeps explicit Review then Accept controls and evidence fail-closed semantics',()=>{
    expect(pendingSource).toContain("setStage('review')");
    expect(pendingSource).toContain('接單核對');
    expect(pendingSource).toContain('確認接單');
    expect(pendingSource).toContain("order.fulfillmentLabel==='待處理'");
    expect(pendingSource).toContain("paymentVerificationState==='VERIFIED'");
    expect(pendingSource).toContain('付款截圖 · 人工核對');
    expect(pendingSource).toContain('核對正確');
    expect(pendingSource).toContain('有問題');
    expect(pendingSource).toContain('pending-evidence-zoom');
    expect(runtimeSource).toContain('PAYMENT_EVIDENCE_VERIFICATION_REQUIRED');
  });

  it('routes pending queue cards into the dedicated review panel and reuses current runtime commands',()=>{
    expect(app).toContain("setPanel({type:'pending-order',orderId:id})");
    expect(app).toContain('PendingOrderReviewWorkspace');
    expect(app).toContain('localRuntime.acceptOrder(order.id)');
    expect(app).toContain('localRuntime.reviewPaymentEvidence(order.id,decision)');
    expect(app).toContain('localRuntime.deferKeetaOrder(order.id)');
    expect(pendingSource).not.toContain('createOrder(');
    expect(pendingSource).not.toContain('printOrderOutputs(');
    expect(pendingSource).not.toContain('fetch(');
  });

  it('moves Customer cloud orders into pending review and requires evidence for electronic payment',()=>{
    expect(intakeSource).toContain("initialFulfillmentLabel:'待處理'");
    expect(intakeSource).toContain('CUSTOMER_PAYMENT_EVIDENCE_REQUIRED');
    expect(intakeSource).toContain('customerName:intent.checkout.name');
    expect(intakeSource).toContain("paymentVerificationState:'PENDING' as const");
  });

  it('keeps Keeta manual defer capped at two and separate from accept / cancel',()=>{
    expect(runtimeSource).toContain('deferKeetaOrder(orderId)');
    expect(runtimeSource).toContain('KEETA_DEFER_LIMIT_REACHED');
    expect(runtimeSource).toContain("keetaDeferCount:deferCount");
    expect(runtimeSource).toContain("appendActionAudit({action:'KEETA_DEFER_'+String(deferCount),orderId})");
    expect(pendingSource).toContain("(order.keetaDeferCount??0)>=2");
  });
});
