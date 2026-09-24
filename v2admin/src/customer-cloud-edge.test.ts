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

  it('does not introduce D1 or R2 business authority',()=>{
    const wrangler=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
    expect(wrangler).not.toContain('"d1_databases"');
    expect(wrangler).not.toContain('"r2_buckets"');
    expect(wrangler).toContain('"name": "CUSTOMER_RUNTIME"');
  });
});
