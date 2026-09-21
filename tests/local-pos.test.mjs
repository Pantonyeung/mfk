import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../app.js',import.meta.url),'utf8');

function storageFrom(map){
  return {
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key),
  };
}

function boot(map=new Map()){
  const root={innerHTML:''};
  const context={
    console,
    crypto:{randomUUID:()=>('uuid-'+Math.random().toString(16).slice(2))},
    localStorage:storageFrom(map),
    alert(message){throw new Error('UNEXPECTED_ALERT:'+message)},
    confirm(){return true},
    setInterval(){return 0},
    clearInterval(){},
    document:{
      querySelector(selector){return selector==='#app'?root:null},
      querySelectorAll(){return []},
    },
  };
  context.globalThis=context;
  vm.createContext(context);
  const instrumented=source+'\n;globalThis.__mfkTest={products,state,addProduct,cartTotal,openCheckout,confirmCheckout,loadOrders};';
  vm.runInContext(instrumented,context,{filename:'app.js'});
  return {context,api:context.__mfkTest,root,map};
}

test('production JS is syntax-valid local-only code with no network client',()=>{
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/\bWebSocket\b/);
  assert.doesNotMatch(source,/\bEventSource\b/);
  assert.doesNotMatch(source,/https?:\/\//);
});

test('local POS can create a CASH order and persist it without network',()=>{
  const shared=new Map();
  const first=boot(shared);
  assert.equal(first.api.state.orders.length,0);
  first.api.addProduct(first.api.products[0]);
  assert.equal(first.api.state.cart.length,1);
  assert.equal(first.api.cartTotal(),first.api.products[0].price);

  first.api.openCheckout();
  assert.equal(first.api.state.modal.type,'checkout');
  first.api.state.modal.received=first.api.cartTotal();
  first.api.confirmCheckout();

  assert.equal(first.api.state.orders.length,1);
  const order=first.api.state.orders[0];
  assert.equal(order.tender,'CASH');
  assert.equal(order.status,'COMPLETED');
  assert.equal(order.total,first.api.products[0].price);
  assert.equal(order.change,0);
  assert.equal(first.api.state.cart.length,0);

  const raw=shared.get('mfk.local.pos.v1');
  assert.ok(raw);
  const saved=JSON.parse(raw);
  assert.equal(saved.orders.length,1);
  assert.equal(saved.orders[0].id,order.id);

  const restarted=boot(shared);
  assert.equal(restarted.api.state.orders.length,1);
  assert.equal(restarted.api.state.orders[0].id,order.id);
  assert.equal(restarted.api.state.orders[0].display,order.display);
});
