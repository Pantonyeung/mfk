import {describe,expect,it} from 'vitest';
import {sourceLane} from './RuntimeOrdersWorkspace.tsx';

describe('SMT order source lanes',()=>{
  it('keeps trusted staff/frontline sources in 現場訂單',()=>{
    expect(sourceLane('SMM')).toBe('walkin');
    expect(sourceLane('現場')).toBe('walkin');
    expect(sourceLane('電話')).toBe('walkin');
    expect(sourceLane('WhatsApp')).toBe('walkin');
  });

  it('separates self platform from third-party platforms',()=>{
    expect(sourceLane('自家 App')).toBe('app');
    expect(sourceLane('磨飯 App')).toBe('app');
    expect(sourceLane('Keeta · K123')).toBe('platform');
    expect(sourceLane('Foodpanda')).toBe('platform');
  });
});
