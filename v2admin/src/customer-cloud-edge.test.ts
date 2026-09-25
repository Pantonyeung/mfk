import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

describe('Customer Cloud Edge authority gate',()=>{
  const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
  const save=readFileSync(new URL('./admin-config-save.ts',import.meta.url),'utf8');

  it('publishes an explicit disabled-by-default Customer channel policy',()=>{
    expect(save).toContain("customerChannelPolicy:readAdminStored('channel-policy.customer.v1',{enabled:false})");
  });

  it('fails new quote and order admission closed until Owner enables the Customer channel',()=>{
    expect(worker).toContain("const customerChannel=row(snapshot.customerChannelPolicy)");
    expect(worker).toContain("const channelAvailable=customerChannel.enabled===true");
    expect(worker).toContain("if(policy.enabled!==true)return json({code:'CUSTOMER_CHANNEL_DISABLED'},503,cors(request))");
  });

  it('keeps Customer on its own public namespace and preserves privileged Admin separation',()=>{
    expect(worker).toContain("url.pathname.startsWith('/api/customer/')");
    expect(worker).toContain("url.pathname.startsWith('/api/customer/smt/')");
    expect(worker).toContain("'/api/customer/orders/submit':'/public/orders/submit'");
    expect(worker).not.toContain("'/api/customer/admin/");
  });

  it('does not introduce D1 business authority and limits R2 to payment media only',()=>{
    const wrangler=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
    expect(wrangler).not.toContain('"d1_databases"');
    expect(wrangler).toContain('"r2_buckets"');
    expect(wrangler).toContain('"binding": "CUSTOMER_PAYMENT_EVIDENCE"');
    expect(wrangler).toContain('"bucket_name": "mfk-customer-payment-evidence"');
    expect(wrangler).toContain('"name": "CUSTOMER_RUNTIME"');
    expect(worker).toContain("kind:'PAYMENT_SCREENSHOT'");
    expect(worker).toContain("verificationState:'PENDING'");
    expect(worker).toContain("kind:'PAYMENT_QR'");
    expect(worker).toContain("'/api/admin/payment-qr'");
    expect(worker).toContain("'/api/customer/payment-qr'");
  });

  it('routes SMM staff orders into the existing Customer Runtime bridge without a second cloud order queue',()=>{
    const runtime=readFileSync(new URL('../customer-runtime.ts',import.meta.url),'utf8');
    expect(worker).toContain("'/api/customer/staff-orders/submit'");
    expect(worker).toContain("'/api/customer/staff-orders/readback'");
    expect(worker).toContain("type:'CUSTOMER_ORDER_AVAILABLE'");
    expect(runtime).toContain("bridgeKind:'SMM_STAFF'");
    expect(runtime).toContain("'/smt/orders/pending'");
    expect(runtime).toContain("'/smt/orders/ack'");
    expect(runtime).not.toContain('SmmIntentStore');
  });

});
