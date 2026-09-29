import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot=path.resolve(here,'..');
const customer=fs.readFileSync(path.join(runtimeRoot,'runtime/customer-cloud-intake.ts'),'utf8');
const keeta=fs.readFileSync(path.join(runtimeRoot,'runtime/keeta-order-intake.ts'),'utf8');
const smm=fs.readFileSync(path.join(runtimeRoot,'runtime/smm-lan-ingress.ts'),'utf8');
const ui=fs.readFileSync(path.join(runtimeRoot,'presentation/RuntimeSoldoutWorkspace.tsx'),'utf8');

describe('CAP4 remote-channel integration contract',()=>{
  it('guards both Customer quote and Customer order admission as FIRST_PARTY',()=>{
    expect(customer).toContain('assertCapacityChannelAdmission');
    expect((customer.match(/channel:'FIRST_PARTY'/g)??[]).length).toBeGreaterThanOrEqual(2);
    expect(customer).toContain('capacityEventsFromRuntime');
  });

  it('guards Keeta canonical admission as THIRD_PARTY before local Formal Order creation',()=>{
    expect(keeta).toContain('assertCapacityChannelAdmission');
    expect(keeta).toContain("channel:'THIRD_PARTY'");
    expect(keeta.indexOf("channel:'THIRD_PARTY'")).toBeLessThan(keeta.indexOf('localRuntime.createOrder(orderInput)'));
  });

  it('does not add remote-channel threshold semantics to trusted SMM staff ingress',()=>{
    expect(smm).not.toContain('CAPACITY_CHANNEL_STOP');
    expect(smm).not.toContain('assertCapacityChannelAdmission');
  });

  it('shows first-party / third-party acceptance projection on the existing Capacity surface',()=>{
    expect(ui).toContain('自家接單');
    expect(ui).toContain('第三方接單');
    expect(ui).toContain('firstPartyAccepting');
    expect(ui).toContain('thirdPartyAccepting');
  });
});