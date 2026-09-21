import {describe,expect,it} from 'vitest';
import {encodePrinterText} from './printer-encoding.ts';
import {decorateEscPosTicket,ESC_POS_DRAWER_PULSE,ESC_POS_FULL_CUT} from './native-print.ts';

function hex(bytes:Uint8Array){return Array.from(bytes).map(v=>v.toString(16).padStart(2,'0')).join('')}

describe('printer encoding',()=>{
  it('encodes Chinese receipt text as GB18030 bytes',()=>{
    expect(hex(encodePrinterText('磨飯','gb18030'))).toBe('c4a5ef88');
  });
  it('supports Big5 when a printer requires traditional Chinese code page',()=>{
    expect(hex(encodePrinterText('磨飯','big5'))).toBe('bf69b6ba');
  });
  it('keeps UTF-8 available for printers configured for UTF-8',()=>{
    expect(hex(encodePrinterText('MFK','utf-8'))).toBe('4d464b');
  });
  it('adds cash drawer pulse before a cash receipt and full cut after the ticket',()=>{
    const body=new Uint8Array([0x41,0x42]);
    const bytes=decorateEscPosTicket(body,{kickDrawer:true,cutAfter:true});
    expect(Array.from(bytes.slice(0,ESC_POS_DRAWER_PULSE.length))).toEqual(Array.from(ESC_POS_DRAWER_PULSE));
    expect(Array.from(bytes.slice(-ESC_POS_FULL_CUT.length))).toEqual(Array.from(ESC_POS_FULL_CUT));
  });
});
