import {describe,expect,it} from 'vitest';
import {parsePrintableSelections,productionSelectionLines,productLabelContent} from './print-content.ts';

describe('structured print content',()=>{
  const combo='選擇飯團：汁燒鰻魚紫米飯團 · 小食：酥皮椰奶 · 飲品：日式玄米茶 (+$6.00) · 辣度：少辣';

  it('removes category labels and prices for production line-by-line output',()=>{
    expect(productionSelectionLines(combo)).toEqual([
      '汁燒鰻魚紫米飯團',
      '酥皮椰奶',
      '日式玄米茶',
      '少辣',
    ]);
  });

  it('keeps combo add-ons and drinks off the food product label',()=>{
    expect(productLabelContent({productName:'自選飯團 D 餐',detail:combo})).toEqual({
      title:'汁燒鰻魚紫米飯團',
      modifierLines:['少辣'],
    });
  });

  it('keeps direct product modifiers under the product name',()=>{
    expect(productLabelContent({
      productName:'招牌雞粒飯團',
      detail:'青瓜：走青瓜 · 醬：少醬',
    })).toEqual({
      title:'招牌雞粒飯團',
      modifierLines:['走青瓜','少醬'],
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
