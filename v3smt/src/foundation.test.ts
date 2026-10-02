import {readFileSync,readdirSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const productionSource=readdirSync(new URL('.',import.meta.url))
  .filter(name=>/\.tsx?$/.test(name)&&!name.endsWith('.test.ts'))
  .map(name=>read('./'+name))
  .join('\n');

describe('MFP V3 authority foundation',()=>{
  it('locks one Store Kernel formal transaction authority',()=>{
    const port=read('./store-kernel-port.ts');
    const state=read('./state-authority.ts');
    expect(port).toContain("STORE_KERNEL_AUTHORITY='FORMAL_TRANSACTION_AUTHORITY'");
    expect(state).toContain("formalTransaction:'STORE_KERNEL'");
    expect(state).toContain("pricing:'STORE_KERNEL'");
  });

  it('forbids periodic business polling in the fresh client',()=>{
    expect(productionSource).not.toMatch(/setInterval\s*\(/);
    const state=read('./state-authority.ts');
    expect(state).toContain('refetchInterval:false');
    expect(state).not.toMatch(/refetchInterval:\s*(?:true|[1-9]\d*)/);
  });

  it('does not import v2 client state or runtime modules',()=>{
    expect(productionSource).not.toContain('v2local');
    expect(productionSource).not.toContain('../v2');
    expect(productionSource).not.toContain('../../v2');
  });

  it('supports responsive MFP Pad and MFP Mobile surfaces from one shell',()=>{
    const app=read('./App.tsx');
    expect(app).toContain("'MFP_PAD'");
    expect(app).toContain("'MFP_MOBILE'");
    expect(app).toContain("matchMedia('(max-width: 767px)')");
  });

  it('keeps durable storage bounded to transport metadata',()=>{
    const state=read('./state-authority.ts');
    expect(state).toContain('MFP_OUTBOX_MAX_ROWS=1000');
    expect(state).toContain("durableTransportMetadata:'DEXIE_BOUNDED_OUTBOX_ONLY'");
    expect(state).not.toMatch(/commitId|canonicalRevision|rejectionCode/);
  });

  it('has no direct network or unrelated domain fan-out in the business port',()=>{
    const port=read('./store-kernel-port.ts').toLowerCase();
    expect(port).not.toMatch(/\bfetch\s*\(/);
    for(const domain of ['customer','keeta','sellability','config'])expect(port).not.toContain(domain);
  });

  it('creates no SMM authority, state, head or runtime dependency',()=>{
    const intent=['SMM','INTENT','STORE'].join('_');
    const worker=['mfk','smm-web'].join('-');
    expect(productionSource).not.toContain(intent);
    expect(productionSource).not.toMatch(/SMM.{0,20}HeadSeq/);
    expect(productionSource).not.toContain(worker);
  });
});
