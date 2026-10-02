import {readFileSync,readdirSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const orderingSource=readdirSync(new URL('.',import.meta.url))
  .filter(name=>/^ordering-.*\.tsx?$/.test(name)&&!/\.test\.tsx?$/.test(name))
  .map(name=>read('./'+name)).join('\n');

describe('MFP V3 A4 authority and integration guard',()=>{
  it('reads the A3 atomic active projection and subscribes to its existing coordinator',()=>{
    const runtime=read('./ordering-runtime.tsx');
    expect(runtime).toContain('projectionStore.readActive()');
    expect(runtime).toContain('sync.subscribe');
    expect(runtime).toContain('selectMfpOrderingCatalog');
  });

  it('contains no direct catalog/Admin fetch, second WebSocket or business polling',()=>{
    expect(orderingSource).not.toMatch(/\bfetch\s*\(/);
    expect(orderingSource).not.toMatch(/new\s+WebSocket\s*\(/);
    expect(orderingSource).not.toMatch(/setInterval\s*\(/);
    expect(orderingSource).not.toMatch(/readHead\s*\(|readChanges\s*\(|readCheckpoint\s*\(/);
  });

  it('imports no v2 client state and creates no SMM authority',()=>{
    expect(orderingSource).not.toMatch(/from\s+['"][^'"]*v2(?:local|smm)/);
    expect(orderingSource).not.toMatch(/SMM_(?:INTENT|HEAD|SESSION|ORDER)|mfk-smm-web|x-mfk-smm-session/);
  });

  it('keeps formal order, payment, fulfillment and print state out of the A4 draft domain',()=>{
    const domain=read('./ordering-domain.ts');
    expect(domain).not.toMatch(/\b(?:orderId|displayNumber|paymentState|fulfillmentState|printState|COMMITTED)\b/);
    expect(domain).toContain("draftOnly:true");
    expect(domain).toContain("pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS'");
  });

  it('mounts Pad and Mobile over one shared ordering domain implementation',()=>{
    const workspace=read('./ordering-workspace.tsx');
    expect(workspace.match(/createMfpOrderingDomain\(/g)).toHaveLength(1);
    expect(workspace).toContain('data-ordering-surface="MFP_PAD"');
    expect(workspace).toContain('data-ordering-surface="MFP_MOBILE"');
  });
});
