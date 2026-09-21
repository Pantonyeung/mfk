import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('runtime canvas is 1920x1080',async()=>{
  const loader=await read('app-loader.js');
  const shell=await read('app-shell.css');
  const root=await read('index.html');
  assert.match(loader,/const TARGET_WIDTH=1920;/);
  assert.match(loader,/const TARGET_HEIGHT=1080;/);
  assert.match(shell,/width: 1920px;/);
  assert.match(shell,/height: 1080px;/);
  assert.doesNotMatch(root,/1280×800/);
});

test('all main pages are locked to 1920x1080',async()=>{
  for(const path of [
    'pages/order/index.html',
    'pages/checkout/index.html',
    'pages/orders/index.html',
    'pages/dine/index.html',
    'pages/soldout/index.html',
    'pages/more/index.html',
  ]){
    const html=await read(path);
    assert.match(html,/1920/);
    assert.match(html,/1080/);
    assert.doesNotMatch(html,/width=1280/);
  }
});
