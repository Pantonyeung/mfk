import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const a6=['./order-operations-domain.ts','./order-operations-runtime.tsx','./order-operations-workspace.tsx'].map(read).join('\n');

describe('MFP V3 A6 authority and regression guards',()=>{
  it('A6-58 imports no v2 client state',()=>{
    expect(a6).not.toMatch(/v2local|\.\.\/\.\.\/v2|\.\.\/v2/);
    expect(a6).not.toMatch(/localStorage|sessionStorage/);
  });

  it('A6-59 creates no SMM order, state, head or session authority',()=>{
    expect(a6).not.toMatch(/SMM|smm-web|HeadSeq|x-mfk-smm-session/);
  });

  it('A6-60 submits bounded operations through the existing Store Kernel security seam only',()=>{
    const domain=read('./order-operations-domain.ts');
    const state=read('./state-authority.ts');
    expect(domain).toContain('submitFrontlineFormalCommand');
    expect(domain).not.toContain("commandType:'ORDER_CREATE'");
    expect(a6).not.toMatch(/class\s+\w*(?:Order|Pricing|Payment|Print|Availability|Capacity)(?:Engine|Authority)/);
    expect(state).toContain("orderOperations:'STORE_KERNEL_CANONICAL_READBACK'");
    expect(state).toContain("availabilityCapacity:'STORE_KERNEL_CANONICAL_READBACK'");
  });

  it('A6-61 keeps canonical readback event-driven with no business polling or direct network path',()=>{
    const runtime=read('./order-operations-runtime.tsx');
    expect(runtime).toContain('refetchInterval:false');
    expect(a6).not.toMatch(/setInterval\s*\(|\bfetch\s*\(|WebSocket\s*\(/);
  });

  it('A6-62 preserves the A1 idempotent Store Kernel envelope and readback seam',()=>{
    const source=read('./store-kernel-port.ts');
    expect(source).toContain('idempotencyKey');expect(source).toContain('readSubmission');expect(source).toContain('MFP_SUBMISSION_PAYLOAD_CONFLICT');
  });

  it('A6-63 preserves the A2 device and frontline staff admission seam',()=>{
    const source=read('./security-port.ts');
    expect(source).toContain('precheckFrontlineAction');expect(source).toContain('submitFrontlineFormalCommand');
  });

  it('A6-64 preserves the A3 atomic active projection and event-driven sync seam',()=>{
    const state=read('./state-authority.ts');const runtime=read('./sync-runtime.ts');
    expect(state).toContain('commitAtomically');expect(runtime).not.toMatch(/setInterval\s*\(/);
  });

  it('A6-65 preserves the A4 draft-only ordering intent and published-fact pricing preview',()=>{
    const source=read('./ordering-domain.ts');
    expect(source).toContain("draftOnly:true");expect(source).toContain("pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS'");
  });

  it('A6-66 preserves the A5 single Payment Confirm and immutable money/report seams',()=>{
    const checkout=read('./checkout-domain.ts');const money=read('./money-domain.ts');
    expect(checkout).toContain("commandType:'CHECKOUT_PAYMENT_CONFIRM'");expect(money).toContain("reportVersion:'1.0'");expect(money).toContain('appendMfpDailyReportAdjustment');
  });
});
