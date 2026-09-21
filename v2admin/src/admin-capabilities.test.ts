import {describe,expect,it} from 'vitest';
import {ADMIN_CAPABILITIES,ADMIN_CAPABILITY_GROUPS} from './admin-capabilities.ts';
import {MFK_ADMIN_AUTHORITY} from './admin-authority.ts';

describe('MFK Admin isolated control plane',()=>{
  it('keeps the complete capability registry visible',()=>{
    expect(ADMIN_CAPABILITY_GROUPS.map(group=>group.id)).toEqual([
      'overview','operations','products','orders','print','channels','members','reports','store','system',
    ]);
    expect(ADMIN_CAPABILITIES).toHaveLength(37);
    for(const required of ['products','categories','modifiers','pricing','combo','print-center','staff','audit']){
      expect(ADMIN_CAPABILITIES.some(item=>item.id===required)).toBe(true);
    }
  });

  it('assigns every capability to a unique MFK route and truth owner',()=>{
    expect(new Set(ADMIN_CAPABILITIES.map(item=>item.path)).size).toBe(ADMIN_CAPABILITIES.length);
    expect(ADMIN_CAPABILITIES.every(item=>Boolean(item.owner))).toBe(true);
  });

  it('keeps live authority disabled until explicit domain wiring',()=>{
    expect(MFK_ADMIN_AUTHORITY.currentSystem).toBe('MFK');
    expect(MFK_ADMIN_AUTHORITY.domainWiring).toBe('NOT_WIRED');
    expect(MFK_ADMIN_AUTHORITY.liveMutationEnabled).toBe(false);
    expect(MFK_ADMIN_AUTHORITY.liveReadEnabled).toBe(false);
    expect(MFK_ADMIN_AUTHORITY.transactionExecutionAuthority).toBe(false);
    expect(MFK_ADMIN_AUTHORITY.physicalPrintExecutionAuthority).toBe(false);
  });
});
