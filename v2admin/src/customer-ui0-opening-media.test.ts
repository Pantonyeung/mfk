import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
describe('Customer UI0 private R2 media delivery',()=>{
  it('serves only the locked UI0 object through existing Admin Customer edge',()=>{
    const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
    expect(worker).toContain("url.pathname==='/api/customer/ui0-opening'");
    expect(worker).toContain("CUSTOMER_PAYMENT_EVIDENCE.get('ip/e788f78a-6345-45fa-8d87-467699aa5795.mp4')");
    expect(worker).toContain("headers.set('content-type','video/mp4')");
    expect(worker).not.toContain("CUSTOMER_PAYMENT_EVIDENCE.put('ip/e788f78a-6345-45fa-8d87-467699aa5795.mp4'");
  });
});
