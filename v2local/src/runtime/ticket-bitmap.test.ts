import {describe,expect,it} from 'vitest';
import {
  ESC_POS_RASTER_PROFILE,
  buildEscPosRasterPayload,
  packEscPosRasterPixels,
} from './ticket-bitmap.ts';

describe('80mm ESC/POS raster payload',()=>{
  it('packs black pixels as printed dots',()=>{
    const pixels=new Uint8Array([
      1,0,0,0,0,0,0,1,
      0,1,0,0,0,0,1,0,
    ]);
    expect(Array.from(packEscPosRasterPixels(pixels,8,2))).toEqual([0x81,0x42]);
  });

  it('emits GS v 0 raster bands and physical finishing commands',()=>{
    const widthDots=16;
    const heightDots=3;
    const bitmap=new Uint8Array(Math.ceil(widthDots/8)*heightDots);
    bitmap[0]=0xff;
    const payload=buildEscPosRasterPayload({
      bitmap,widthDots,heightDots,
      cutAfter:true,kickDrawer:true,beepAfter:true,
    });
    const bytes=Array.from(payload);
    expect(bytes.slice(0,2)).toEqual([0x1b,0x40]);
    expect(bytes).toEqual(expect.arrayContaining([0x1b,0x70,0x00,0x19,0xfa]));
    const rasterAt=bytes.findIndex((value,index)=>value===0x1d&&bytes[index+1]===0x76&&bytes[index+2]===0x30);
    expect(rasterAt).toBeGreaterThan(0);
    expect(bytes.slice(rasterAt,rasterAt+8)).toEqual([0x1d,0x76,0x30,0x00,0x02,0x00,0x03,0x00]);
    expect(bytes.slice(-4)).toEqual([0x1b,0x42,0x03,0x02]);
  });

  it('keeps the physical profile at 576 dots / 203 dpi with bounded bands',()=>{
    expect(ESC_POS_RASTER_PROFILE).toMatchObject({widthDots:576,dpi:203,bandHeight:192});
  });
});
