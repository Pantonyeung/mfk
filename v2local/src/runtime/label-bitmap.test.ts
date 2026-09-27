import {describe,expect,it} from 'vitest';
import {LABEL_TSC_PROFILE,buildTscBitmapPayload,packMonochromeBitmap} from './label-bitmap.ts';

const ascii=(bytes:Uint8Array)=>new TextDecoder('latin1').decode(bytes);

describe('TSC label bitmap profile',()=>{
  it('copies the proven old POS label geometry',()=>{
    expect(LABEL_TSC_PROFILE).toMatchObject({
      protocol:'TSC',
      widthMm:50,
      heightMm:40,
      leftOffset:0,
      topOffset:0,
      lineGap:28,
    });
  });

  it('packs pixels into 1-bit printer bitmap rows',()=>{
    const pixels=new Uint8Array([
      1,0,0,0,0,0,0,1,
      0,1,0,0,0,0,1,0,
    ]);
    const packed=packMonochromeBitmap(pixels,8,2);
    expect(Array.from(packed)).toEqual([0x81,0x42]);
  });

  it('builds a 50x40 TSC BITMAP payload instead of printer text fonts',()=>{
    const bitmap=new Uint8Array([0x81,0x42]);
    const payload=buildTscBitmapPayload({bitmap,widthDots:8,heightDots:2});
    const text=ascii(payload);
    expect(text).toContain('SIZE 50 mm,40 mm');
    expect(text).toContain('REFERENCE 0,0');
    expect(text).toContain('BITMAP 0,0,1,2,0,');
    expect(text).toContain('PRINT 1,1');
    expect(text).not.toContain('TST24.BF2');
    expect(text).not.toContain('TSS24.BF2');
  });
});
