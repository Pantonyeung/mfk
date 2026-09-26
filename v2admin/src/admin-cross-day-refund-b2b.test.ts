import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MFK_ADMIN_REFUND_SCHEMA,validateAdminRefundEvent} from '../../contracts/admin-refund-v1.ts';

describe('Admin B2b cross-day refund contract',()=>{
  it('validates a cross-day refund linked to Day Close 1.1 without treating the addendum as a posting',()=>{
    const refund=validateAdminRefundEvent({
      schema:MFK_ADMIN_REFUND_SCHEMA,
      refundId:'AR-test-001',
      storeId:'MF01',
      orderId:'MFK-001',
      display:'P001',
      originalBusinessDate:'2026-09-21',
      originalCreatedAt:'2026-09-21T02:00:00.000Z',
      executionAt:'2026-09-22T10:00:00.000Z',
      executionBusinessDate:'2026-09-22',
      method:'CASH',
      amountMinor:2000,
      lines:[{lineId:'line-a',itemName:'飯團',quantity:1,amountMinor:2000}],
      note:'跨日退款',
      source:'ADMIN',
      originalDayCloseVersion:1,
      addendumSequence:1,
      addendumVersionLabel:'1.1',
    });
    expect(refund.addendumVersionLabel).toBe('1.1');
    expect(refund.executionBusinessDate).toBe('2026-09-22');
    expect(()=>validateAdminRefundEvent({...refund,addendumVersionLabel:'1.2'})).toThrow('ADMIN_REFUND_ADDENDUM_VERSION_MISMATCH');
  });

  it('locks non-posting original-day addendum and execution-day money reporting in the worker',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const worker=fs.readFileSync(path.resolve(here,'../worker.ts'),'utf8');
    expect(worker).toContain("postingMode:'NON_POSTING_REFERENCE'");
    expect(worker).toContain("type:'ADMIN_REFUND_AVAILABLE'");
    expect(worker).toContain("if(url.pathname==='/smt-refunds')");
    expect(worker).toContain("executionBusinessDate:hktBusinessDate");
    expect(worker).toContain("refundById=new Map()");
    expect(worker).toContain("row.netMinor=(Number(row.grossMinor)||0)-(Number(row.refundMinor)||0)");
  });

  it('provides an Admin-only refund workspace with exact item reference and visible original/refund times',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const workspace=fs.readFileSync(path.join(here,'WorkflowUpgradeWorkspaces.tsx'),'utf8');
    const client=fs.readFileSync(path.join(here,'admin-projection-client.ts'),'utf8');
    expect(workspace).toContain('ADMIN-ONLY CROSS-DAY REFUND');
    expect(workspace).toContain('退款商品');
    expect(workspace).toContain('數量 Reference');
    expect(workspace).toContain('實際退款方式');
    expect(workspace).toContain('NON-POSTING REFERENCE');
    expect(workspace).toContain('原單');
    expect(workspace).toContain('實際退款');
    expect(client).toContain('createAdminCrossDayRefund');
    expect(client).toContain('/api/admin-sync/refunds?storeId=MF01');
  });

  it('shows refund totals in Admin sales reporting by execution date',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const read=fs.readFileSync(path.join(here,'ReadModelWorkspaces.tsx'),'utf8');
    expect(read).toContain("total('refundMinor')");
    expect(read).toContain("total('cashRefundMinor')");
    expect(read).toContain('按實際退款日入賬');
    expect(read).toContain('期間 gross - refund');
  });
});
