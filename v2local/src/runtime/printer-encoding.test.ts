import {describe,expect,it} from 'vitest';
import {encodePrinterText} from './printer-encoding.ts';

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
});
