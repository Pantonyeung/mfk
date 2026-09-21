import {describe,expect,it} from 'vitest';
import {ADMIN_CAPABILITIES,ADMIN_CAPABILITY_GROUPS} from './admin-capabilities.ts';
import {ADMIN_DONOR_SOURCE} from './admin-donor-source.ts';

describe('MFK Admin clean donor extraction',()=>{
  it('keeps the complete donor capability tree visible',()=>{
    expect(ADMIN_CAPABILITY_GROUPS.map(group=>group.id)).toEqual([
      'overview','operations','products','orders','print','channels','members','reports','store','system',
    ]);
    expect(ADMIN_CAPABILITIES).toHaveLength(37);
    for(const required of ['products','categories','modifiers','pricing','combo','print-center','staff','audit']){
      expect(ADMIN_CAPABILITIES.some(item=>item.id===required)).toBe(true);
    }
  });

  it('assigns every capability to an MFK truth owner and a unique MFK route',()=>{
    expect(new Set(ADMIN_CAPABILITIES.map(item=>item.mfkPath)).size).toBe(ADMIN_CAPABILITIES.length);
    expect(ADMIN_CAPABILITIES.every(item=>Boolean(item.owner))).toBe(true);
  });

  it('never enables legacy authority during clean extraction',()=>{
    expect(ADMIN_DONOR_SOURCE.legacyWritersEnabled).toBe(false);
    expect(ADMIN_DONOR_SOURCE.legacyDatabaseAuthorityEnabled).toBe(false);
    expect(ADMIN_DONOR_SOURCE.legacyApiAuthorityEnabled).toBe(false);
    expect(ADMIN_DONOR_SOURCE.targetAuthority).toBe('MFK_REDEFINED');
  });
});
