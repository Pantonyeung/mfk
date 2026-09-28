import {describe,expect,it} from 'vitest';
import {
  clearDiningCheckoutUiSession,
  diningCheckoutCart,
  DINING_CHECKOUT_UI_KEY,
  readDiningCheckoutUiSession,
  saveDiningCheckoutUiSession,
} from './dining-checkout-ui-session.ts';
import type {DiningCheckoutRequest} from '../../presentation/RuntimeDiningWorkspace.tsx';

function storage(){
  const values=new Map<string,string>();
  return {
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{values.set(key,value);},
    removeItem:(key:string)=>{values.delete(key);},
    raw:values,
  };
}
const request:DiningCheckoutRequest={
  holdId:'HOLD-1',
  submissionId:'DINPAY:HOLD-1:abc:1',
  expectedRevision:'DINING2:revision',
  codeLabel:'H001',
  tableLabel:'窗邊 A',
  selections:[{lineIndex:0,qty:1}],
  lines:[{lineIndex:0,id:'rice',name:'飯團｜少飯',qty:1,unitMinor:4100}],
};

describe('C2 Dining Checkout UI session',()=>{
  it('persists and restores only a valid resumable Dining Checkout intent',()=>{
    const s=storage();
    saveDiningCheckoutUiSession(request,s);
    expect(readDiningCheckoutUiSession(s)).toEqual(request);
    expect(JSON.parse(s.raw.get(DINING_CHECKOUT_UI_KEY)!)).toEqual({version:1,request});
  });

  it('rejects corrupt or incomplete intent instead of inventing a payment identity',()=>{
    const s=storage();
    s.setItem(DINING_CHECKOUT_UI_KEY,JSON.stringify({version:1,request:{...request,submissionId:''}}));
    expect(readDiningCheckoutUiSession(s)).toBeNull();
    expect(()=>saveDiningCheckoutUiSession({...request,expectedRevision:''},s)).toThrow('DINING_CHECKOUT_REFRESH_REQUIRED');
  });

  it('rebuilds the visible Checkout cart from the persisted intent without changing money',()=>{
    expect(diningCheckoutCart(request)).toEqual([{
      id:'dining-checkout-HOLD-1-0-0',
      productId:'rice',
      name:'飯團',
      qty:1,
      unitMinor:4100,
      serviceMode:'dine-in',
      detail:'少飯',
    }]);
  });

  it('clears only the UI intent when Checkout is intentionally exited',()=>{
    const s=storage();
    saveDiningCheckoutUiSession(request,s);
    clearDiningCheckoutUiSession(s);
    expect(readDiningCheckoutUiSession(s)).toBeNull();
  });
});
