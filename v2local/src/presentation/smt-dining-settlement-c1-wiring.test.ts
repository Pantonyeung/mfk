import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('C1 Dining Checkout command wiring',()=>{
  it('carries one stable submission id and one expected revision from Dining into Checkout',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
    const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');

    expect(dining).toContain('readonly submissionId:string');
    expect(dining).toContain('readonly expectedRevision:string');
    expect(dining).toContain('submissionId:nextDiningSubmissionId(detail.holdId)');
    expect(dining).toContain('expectedRevision:detail.checkoutRevision');

    expect(app).toContain('submissionId:diningCheckout.submissionId');
    expect(app).toContain('expectedRevision:diningCheckout.expectedRevision');
    expect(app).toContain("...(tenderCode==='CASH'?{receivedMinor:received}:{})");
  });

  it('does not add a Dining print, drawer or second Order side effect to the C1 payment call',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
    const start=runtime.indexOf('  async settleDiningHold(holdId,selections,tender,command){');
    const end=runtime.indexOf('  async clearDiningHold(holdId){',start);
    const block=runtime.slice(start,end);

    expect(block).toContain('DINING_SUBMISSION_CONFLICT');
    expect(block).toContain('DINING_CHECKOUT_STALE');
    expect(block).toContain('DINING_CASH_INSUFFICIENT');
    expect(block).not.toContain('createOrder(');
    expect(block).not.toContain('dispatchOrderOutputs');
    expect(block).not.toContain('kickDrawer');
    expect(block).not.toContain('print');
  });
});
