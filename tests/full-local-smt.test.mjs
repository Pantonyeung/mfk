import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(join(root,path),'utf8');

async function exists(path){
  try{return (await stat(path)).isFile();}catch{return false;}
}

async function walk(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

test('full SMT shell is present',async()=>{
  const required=[
    'index.html','app-loader.js','app-shell.css',
    'pages/order/index.html','pages/order/page.js','pages/order/menu-api.js',
    'pages/checkout/index.html','pages/checkout/page.js',
    'pages/orders/index.html','pages/orders/page.js',
    'pages/dine/index.html','pages/dine/page.js',
    'pages/soldout/index.html','pages/soldout/page.js',
    'pages/more/index.html','pages/more/page.js','pages/more/print-domain.js',
    'shared/store.js','shared/runtime.js','shared/shell.js','shared/page-bridge.js'
  ];
  for(const path of required)assert.equal(await exists(join(root,path)),true,path);
});

test('all local HTML script and stylesheet references exist',async()=>{
  const htmlFiles=(await walk(root)).filter(path=>path.endsWith('.html')&&!path.includes('/.git/'));
  for(const htmlPath of htmlFiles){
    const html=await readFile(htmlPath,'utf8');
    const refs=[
      ...[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m=>m[1]),
      ...[...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m=>m[1]),
    ];
    for(const raw of refs){
      const ref=raw.split('?')[0];
      if(!ref||/^(?:https?:|data:|about:)/.test(ref))continue;
      const target=resolve(dirname(htmlPath),ref);
      assert.equal(await exists(target),true,htmlPath.replace(root,'')+' -> '+raw);
    }
  }
});

test('active SMT runtime has no remote network client',async()=>{
  const firstParty=[
    'app-loader.js',
    'pages/order/page.js','pages/order/menu-api.js','pages/order/order-domain.js',
    'pages/checkout/page.js','pages/checkout/checkout-domain.js',
    'pages/orders/page.js','pages/orders/orders-domain.js',
    'pages/dine/page.js','pages/dine/dine-domain.js',
    'pages/soldout/page.js',
    'pages/more/page.js','pages/more/more-domain.js','pages/more/print-domain.js',
    'shared/runtime.js','shared/store.js','shared/operations.js','shared/order-identity.js','shared/page-bridge.js','shared/shell.js'
  ];
  for(const path of firstParty){
    const source=await read(path);
    assert.doesNotMatch(source,/\bfetch\s*\(/,path);
    assert.doesNotMatch(source,/\bXMLHttpRequest\b/,path);
    assert.doesNotMatch(source,/\bWebSocket\b/,path);
    assert.doesNotMatch(source,/\bEventSource\b/,path);
    assert.doesNotMatch(source,/https?:\/\//,path);
    assert.doesNotMatch(source,/firebase/i,path);
  }
});

test('menu is local-only and checkout is onsite-only',async()=>{
  const menu=await read('pages/order/menu-api.js');
  const checkout=await read('pages/checkout/page-config.js');
  const orderPage=await read('pages/order/page.js');
  assert.match(menu,/source:'local'/);
  assert.match(checkout,/channels:\['現場'\]/);
  assert.match(orderPage,/LOCAL ONLY · 本機餐牌/);
  assert.doesNotMatch(orderPage,/Firebase/);
});

test('local printer configuration exists before native printing is connected',async()=>{
  const print=await read('pages/more/print-domain.js');
  for(const id of ['receipt-1','kitchen-1','packing-1','label-riceball','label-pack']){
    assert.match(print,new RegExp(id));
  }
  assert.match(print,/morefun\.print\.v1/);
  assert.match(print,/waiting_bridge/);
});
