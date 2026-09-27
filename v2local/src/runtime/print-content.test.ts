import {describe,expect,it} from 'vitest';
import {parsePrintableSelections,productionBlockLines,productLabelContent,verticalSelectionLines} from './print-content.ts';

describe('final locked structured print content',()=>{
  const combo='選擇飯團：汁燒鰻魚紫米飯團 · 小食：酥皮椰奶 · 飲品：日式玄米茶 (+$6.00) · 辣度：少辣';

  it('puts main food + snack on one production row and drink on the next row',()=>{
    expect(productionBlockLines(combo)).toEqual([
      '汁燒鰻魚紫米飯團 (少辣) / 酥皮椰奶',
      '日式玄米茶',
    ]);
  });

  it('prints packing/receipt selections vertically without category prefixes',()=>{
    expect(verticalSelectionLines(combo)).toEqual([
      '汁燒鰻魚紫米飯團 (少辣)',
      '酥皮椰奶',
      '日式玄米茶',
    ]);
  });

  it('keeps all locked product-label content while removing category prefixes',()=>{
    expect(productLabelContent({productName:'自選飯團 D 餐',detail:combo})).toEqual({
      title:'汁燒鰻魚紫米飯團',
      bodyLines:['(少辣)','酥皮椰奶','日式玄米茶'],
    });
  });

  it('keeps direct modifiers grouped under a simple product label',()=>{
    expect(productLabelContent({
      productName:'招牌雞粒飯團',
      detail:'青瓜：走青瓜 · 醬：少醬',
    })).toEqual({
      title:'招牌雞粒飯團',
      bodyLines:['(走青瓜，少醬)'],
    });
  });

  it('classifies structural groups without leaking their group names',()=>{
    expect(parsePrintableSelections('飯團：A · 小食：B · 飲品：C')).toEqual([
      {key:'飯團',value:'A',kind:'main'},
      {key:'小食',value:'B',kind:'addon'},
      {key:'飲品',value:'C',kind:'drink'},
    ]);
  });
});
