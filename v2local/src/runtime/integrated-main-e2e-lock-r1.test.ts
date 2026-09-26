import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');

const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

describe('2026-09-26 integrated main E2E preservation lock',()=>{
  it('preserves Web SMT acceptance isolation while production SMT keeps Customer and Keeta consumers',()=>{
    const main=read('main.tsx');
    expect(main).toContain('const webAcceptance=isSmtWebAcceptance()');
    expect(main).toContain('if(!webAcceptance){');
    expect(main).toContain('installKeetaOrderIntake()');
    expect(main).toContain('installKeetaOrderLifecycle()');
    expect(main).toContain('installKeetaAfterSales()');
    expect(main).toContain('installCustomerCloudBridge()');
    expect(main).toContain('if(webAcceptance)installSmmWebAcceptanceIntake(smmLanIngress)');
  });

  it('preserves Customer to SMT revision, pricing, evidence, canonical order and readback semantics',()=>{
    const customer=read('runtime/customer-cloud-intake.ts');
    expect(customer).toContain('const {envelope,catalog}=activeCatalog()');
    expect(customer).toContain("CUSTOMER_MENU_REVISION_CHANGED");
    expect(customer).toContain("CUSTOMER_MENU_PRICE_CHANGED");
    expect(customer).toContain("sourceLabel:'自家 App'");
    expect(customer).toContain("paymentEvidenceRef:intent.checkout.paymentEvidenceRef");
    expect(customer).toContain("initialFulfillmentLabel:'進行中'");
    expect(customer).toContain("state:'CONFIRMED'");
    expect(customer).toContain('canonicalOrderId:order.id');
    expect(customer).toContain('canonicalDisplay:order.display');
  });

  it('preserves SMM stable identity, pricing facts and canonical SMT ingress/readback',()=>{
    const ingress=read('runtime/smm-lan-ingress.ts');
    const appMain=read('main.tsx');
    expect(ingress).toContain('submissionId');
    expect(ingress).toContain('idempotencyKey');
    expect(ingress).toContain('publishedTotalMinor');
    expect(ingress).toContain('publishedUnitPriceMinor');
    expect(appMain).toContain("request.type==='smm.lan.order.submit.v1'");
    expect(appMain).toContain("type==='smm.lan.order.readback.v1'");
    expect(appMain).toContain('smmLanIngress.submit');
    expect(appMain).toContain('smmLanIngress.readSubmission');
  });

  it('preserves current SMT shell/header and connected Customer/Keeta alert projections',()=>{
    const app=read('App.tsx');
    const orders=read('presentation/RuntimeOrdersWorkspace.tsx');
    expect(app).toContain('className="clean-rail"');
    expect(app).toContain('aria-label="MFK 主導航"');
    expect(app).toContain('className="mfk-global-order-alert"');
    expect(app).toContain("window.addEventListener('mfk-customer-order-intake',onArrival)");
    expect(app).toContain("window.addEventListener('mfk-keeta-order-intake',onArrival)");
    expect(orders).toContain("window.addEventListener('mfk-customer-order-intake',refresh)");
    expect(orders).toContain("window.addEventListener('mfk-keeta-order-intake',refresh)");
    expect(orders).toContain("label:'現場訂單'");
    expect(orders).toContain("label:'自家平台'");
    expect(orders).toContain("label:'第三方平台'");
  });
});
