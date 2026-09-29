import {describe,expect,it} from 'vitest';
import {MFK_CONFIG_DOMAINS,requiresBaseline} from './config-sync-v2.ts';

describe('config sync v2 contract',()=>{
  it('keeps explicit bounded domains',()=>{expect(MFK_CONFIG_DOMAINS).toContain('STORE_SETTINGS');expect(MFK_CONFIG_DOMAINS).toContain('CATALOG');});
  it('requires full baseline for first install',()=>expect(requiresBaseline({localRevision:0,cloudRevision:20,hasBaseline:false})).toBe(true));
  it('does not fetch when revisions match',()=>expect(requiresBaseline({localRevision:20,cloudRevision:20,hasBaseline:true})).toBe(false));
  it('accepts contiguous delta',()=>expect(requiresBaseline({localRevision:20,cloudRevision:21,hasBaseline:true,deltaFromRevision:20})).toBe(false));
  it('falls back to baseline on revision gap',()=>expect(requiresBaseline({localRevision:20,cloudRevision:23,hasBaseline:true,deltaFromRevision:22})).toBe(true));
});
