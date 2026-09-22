import {describe,expect,it} from 'vitest';
import {ADMIN_CAPABILITIES,ADMIN_CAPABILITY_GROUPS} from './admin-capabilities.ts';
import {MFK_ADMIN_AUTHORITY} from './admin-authority.ts';

describe('MFK Admin product responsibility',()=>{
  it('keeps the complete capability registry visible',()=>{
    expect(ADMIN_CAPABILITY_GROUPS.map(group=>group.id)).toEqual([
      'today','orders','menu','connections','people','reports','store','members','system',
    ]);
    expect(ADMIN_CAPABILITIES).toHaveLength(52);
    for(const required of [
      'products','categories','modifiers','pricing','combo','publish-center','action-queue',
      'device-health','ota','print-center','print-templates','print-rules','settlement',
      'quick-reasons','staff','access-session','product-report','channel-report','refund-report',
      'export-governance','diagnostics','integrations-governance','audit','inventory','members',
      'loyalty','coupons','announcement',
    ]) expect(ADMIN_CAPABILITIES.some(item=>item.id===required),required).toBe(true);
  });

  it('assigns every capability to a unique route, owner and operator product state',()=>{
    expect(new Set(ADMIN_CAPABILITIES.map(item=>item.path)).size).toBe(ADMIN_CAPABILITIES.length);
    expect(ADMIN_CAPABILITIES.every(item=>Boolean(item.owner))).toBe(true);
    expect(ADMIN_CAPABILITIES.every(item=>['READY','READ_ONLY','P1','GOVERNANCE'].includes(item.status))).toBe(true);
    expect(ADMIN_CAPABILITIES.some(item=>item.status==='READY')).toBe(true);
    expect(ADMIN_CAPABILITIES.some(item=>item.status==='READ_ONLY')).toBe(true);
  });

  it('keeps Admin separate from transaction and physical-print execution authority',()=>{
    expect(MFK_ADMIN_AUTHORITY.currentSystem).toBe('MFK');
    expect(MFK_ADMIN_AUTHORITY.transactionExecutionAuthority).toBe(false);
    expect(MFK_ADMIN_AUTHORITY.physicalPrintExecutionAuthority).toBe(false);
  });
});
