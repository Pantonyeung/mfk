import {describe,expect,it} from 'vitest';
import {
  DINING_ADD_ORDER_UI_KEY,
  clearDiningAddOrderUiSession,
  readDiningAddOrderUiSession,
  saveDiningAddOrderUiSession,
  type DiningAddOrderRequest,
} from './dining-add-order-ui-session.ts';

function storage(){
  const values=new Map<string,string>();
  return {
    values,
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>values.set(key,value),
    removeItem:(key:string)=>values.delete(key),
  };
}

const request:DiningAddOrderRequest={
  holdId:'HOLD-1',
  submissionId:'DINADD:HOLD-1:abc:1',
  codeLabel:'P001',
  tableLabel:'3 號枱',
  formalOrderId:'ORDER-1',
};

describe('D6 Dining add-order UI session',()=>{
  it('persists one stable add-order identity across reload',()=>{
    const s=storage();
    saveDiningAddOrderUiSession(request,s);
    expect(readDiningAddOrderUiSession(s)).toEqual(request);
    expect(JSON.parse(s.values.get(DINING_ADD_ORDER_UI_KEY)??'{}')).toMatchObject({version:1,request});
  });

  it('clears the intent when leaving add-order mode',()=>{
    const s=storage();
    saveDiningAddOrderUiSession(request,s);
    clearDiningAddOrderUiSession(s);
    expect(readDiningAddOrderUiSession(s)).toBeNull();
  });

  it('fails closed on malformed persisted add-order identity',()=>{
    const s=storage();
    s.setItem(DINING_ADD_ORDER_UI_KEY,JSON.stringify({
      version:1,
      request:{...request,submissionId:''},
    }));
    expect(readDiningAddOrderUiSession(s)).toBeNull();
  });
});
