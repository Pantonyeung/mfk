import {describe,expect,it} from 'vitest';
import {
  addFormalLogicalPrinter,
  patchFormalLogicalPrinter,
  patchFormalPrintTemplates,
  readFormalLogicalPrinters,
  readFormalPrintTemplates,
  removeFormalLogicalPrinter,
} from './formal-print.ts';

function snapshot(){
  return {
    untouched:{keep:true},
    logicalPrinters:[
      {id:'label-1',name:'Label 1',type:'LABEL',model:'50x40',widthMm:50,active:true,capabilities:['LABEL'],extra:'keep-printer'},
      {id:'receipt-1',name:'Receipt',type:'RECEIPT',model:'80mm',widthMm:80,active:true,capabilities:['RECEIPT']},
    ],
    printTemplates:{
      receipt:'R',production:'P',packing:'PK',label:'L',showComboRelationship:true,separateFoodDrinkCount:true,extra:'keep-template',
    },
    printRules:{
      p1:{receipt:true,production:false,packing:false,label:true,dineIn:true,takeaway:true,labelPrinterIds:['label-1']},
    },
  } as Record<string,unknown>;
}

describe('formal print adapters',()=>{
  it('patches logical printers without physical binding fields',()=>{
    const next=patchFormalLogicalPrinter(snapshot(),'label-1',{name:'Label A',type:'LABEL',widthMm:55}) as any;
    expect(readFormalLogicalPrinters(next)[0]).toMatchObject({id:'label-1',name:'Label A',type:'LABEL',widthMm:55});
    expect(next.logicalPrinters[0].extra).toBe('keep-printer');
    expect('ip' in next.logicalPrinters[0]).toBe(false);
  });

  it('guards deletion when legacy formal print rule still references label printer',()=>{
    expect(()=>removeFormalLogicalPrinter(snapshot(),'label-1')).toThrow('FORMAL_PRINTER_IN_USE');
    const removed=removeFormalLogicalPrinter(snapshot(),'receipt-1');
    expect(readFormalLogicalPrinters(removed).map(item=>item.id)).toEqual(['label-1']);
  });

  it('adds logical printers and patches templates preserving unknown fields',()=>{
    const added=addFormalLogicalPrinter(snapshot(),'logical-new');
    expect(readFormalLogicalPrinters(added).some(item=>item.id==='logical-new')).toBe(true);
    const patched=patchFormalPrintTemplates(snapshot(),{label:'NEW LABEL'}) as any;
    expect(readFormalPrintTemplates(patched).label).toBe('NEW LABEL');
    expect(patched.printTemplates.extra).toBe('keep-template');
    expect(patched.untouched.keep).toBe(true);
  });
});
