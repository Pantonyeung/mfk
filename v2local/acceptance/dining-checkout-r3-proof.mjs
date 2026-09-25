import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer,build} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
const out='/tmp/mfk-dining-r3';
await fs.mkdir(out,{recursive:true});
const app=await fs.readFile('src/App.tsx','utf8');
assert.ok(app.includes('function OperationalApp()'));
assert.equal(app.split('<RuntimeReadyActivation/>').length,2);
// Test-only seam: use EXACT real application/Checkout, but never start provider consumers.
// No checkout, payment, cart, or dining implementation is replaced.
await fs.writeFile('src/__dining_r3_app.tsx',app.replace('<RuntimeReadyActivation/>','<></>')+'\nexport {OperationalApp};\n');
await fs.writeFile('acceptance/dining-checkout-r3.html','<!doctype html><html lang="zh-Hant"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>堂食真正結帳流程｜隔離測試</title><body style="margin:0"><div id="root"></div><script type="module" src="./dining-checkout-r3-entry.tsx"></script></body></html>');
await fs.writeFile('acceptance/dining-checkout-r3-entry.tsx',`import React from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router';
import '../src/styles.css';
const key='mfk.v2local.runtime.v1';
if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({orders:[],availability:{},holds:[
{id:'R3-TABLE',codeLabel:'H001',kind:'dining',createdAt:new Date().toISOString(),partySize:4,note:'隔離測試：同一張堂食單',totalMinor:8200,assignedTable:'T01',payments:[],items:[{id:'rice',name:'原味飯團',qty:2,unitMinor:4100}]},
{id:'R3-WAIT',codeLabel:'W002',kind:'dining',createdAt:new Date().toISOString(),partySize:2,note:'隔離輪候示例',totalMinor:2000,payments:[],items:[{id:'drink',name:'手打檸檬茶',qty:1,unitMinor:2000}]}
]}));
if(!location.hash)location.hash='#/dining';
const {OperationalApp}=await import('../src/__dining_r3_app.tsx');
const {localRuntime}=await import('../src/runtime/local-runtime.ts');
(window as any).__diningR3={runtime:localRuntime,key};
createRoot(document.getElementById('root')!).render(<><div style={{position:'fixed',top:0,left:0,zIndex:3000,fontSize:11,background:'#edf4ff',color:'#174a98',padding:'3px 8px',pointerEvents:'none'}}>隔離示例｜真正 Checkout 元件＋本機付款接口｜測試資料；無打印／開櫃；正式訂單連接未完成</div><HashRouter><OperationalApp/></HashRouter></>);
`);
const server=await createServer({server:{host:'127.0.0.1',port:4173,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
const key='mfk.v2local.runtime.v1';
async function fixture(){
 const context=await browser.newContext({viewport:{width:1180,height:820}});
 const external=[];const errors=[];
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'&&url.protocol!=='file:'&&url.protocol!=='data:'&&url.protocol!=='blob:'){external.push(url.origin);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(3500);
 await page.goto('http://127.0.0.1:4173/acceptance/dining-checkout-r3.html#/dining');
 await page.locator('.dining-nine-grid').waitFor();
 return{page,context,external,errors};
}
async function checkout(page,{all=false,wait=false}={}){
 if(wait)await page.locator('.dining-wait-list article').first().locator('button').first().click();
 else await page.locator('.dining-nine-grid .dining-table').first().click();
 await page.locator('.dining-detail-lines article').first().waitFor();
 if(all)await page.getByRole('button',{name:'全選未結',exact:true}).click();
 else await page.locator('.dining-line-selector').first().getByRole('button',{name:'＋',exact:true}).click();
 await page.locator('.dining-settle-button').click();await page.locator('.checkout-workspace').waitFor();
}
const snapshot=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const confirm=async page=>{await page.locator('.checkout-confirm').click();};
const paidDialog=page=>page.getByRole('dialog',{name:'交易完成核對'});
async function hundred(page){await page.locator('.checkout-quick-cash').getByRole('button',{name:'+100',exact:true}).click();}
async function test(name,fn){let f;try{f=await fixture();await fn(f.page);assert.deepEqual(f.errors,[]);assert.deepEqual(f.external,[]);results.push({name,status:'PASS',externalRequests:0,pageErrors:0});}catch(error){results.push({name,status:'FAIL',error:String(error)});if(f)await f.page.screenshot({path:path.join(out,name+'-FAIL.png')}).catch(()=>{});}finally{await f?.context.close();}}
await test('01-dining-source-is-locked',async page=>{
 await checkout(page);assert.equal(await page.locator('.checkout-source-grid').getByRole('button',{name:'Foodpanda'}).isDisabled(),true);
 assert.match(await page.locator('.checkout-source-grid').innerText(),/堂食/);
});
await test('02-real-cash-confirm-and-single-payment',async page=>{
 await checkout(page);await hundred(page);
 await page.locator('.checkout-confirm').evaluate(button=>{button.click();button.click();button.click();});
 await paidDialog(page).waitFor();const hold=(await snapshot(page)).holds.find(h=>h.id==='R3-TABLE');
 assert.equal(hold.payments.length,1);assert.equal(hold.payments[0].amountMinor,4100);assert.equal(hold.payments[0].receivedMinor,10000);assert.equal(hold.payments[0].changeMinor,5900);
 assert.equal(hold.assignedTable,'T01');assert.equal((await snapshot(page)).orders.length,0);
 await page.screenshot({path:path.join(out,'dining-checkout-r3-partial-tablet.png')});
});
await test('03-completion-restored-after-reload-no-repayment',async page=>{
 await checkout(page);await hundred(page);await confirm(page);await paidDialog(page).waitFor();await page.reload();await paidDialog(page).waitFor();
 assert.match(await paidDialog(page).innerText(),/59\.00/);assert.equal((await snapshot(page)).holds[0].payments.length,1);
});
await test('04-draft-restored-after-reload',async page=>{
 await checkout(page);await page.reload();await page.locator('.checkout-workspace').waitFor();
 assert.match(await page.locator('.checkout-order-lines').innerText(),/原味飯團/);
 assert.equal(await page.locator('.checkout-confirm').isDisabled(),true);
 await hundred(page);await confirm(page);await paidDialog(page).waitFor();assert.equal((await snapshot(page)).holds[0].payments.length,1);
});
await test('05-full-payment-done-returns-free-table-with-history',async page=>{
 await checkout(page,{all:true});await hundred(page);await confirm(page);await paidDialog(page).waitFor();
 await paidDialog(page).getByRole('button',{name:'完成',exact:true}).click();await page.locator('.dining-nine-grid').waitFor();
 assert.match(await page.locator('.dining-table').first().getAttribute('class'),/available/);
 assert.equal((await snapshot(page)).holds.find(h=>h.id==='R3-TABLE').payments.length,1);
 assert.equal(await page.evaluate(()=>localStorage.getItem('mfk.smt.dining-checkout-ui.v1')),null);
});
await test('06-stale-checkout-explains-error-without-new-payment',async page=>{
 await checkout(page);await page.evaluate(k=>{const data=JSON.parse(localStorage.getItem(k));data.holds[0].items[0].unitMinor=5000;data.holds[0].totalMinor=10000;localStorage.setItem(k,JSON.stringify(data));},key);
 await hundred(page);await confirm(page);await page.locator('.checkout-payment-alert').waitFor();
 assert.match(await page.locator('.checkout-payment-alert').innerText(),/更新|重新核對/);assert.equal((await snapshot(page)).holds[0].payments.length,0);
});
await test('07-waiting-checkout-uses-correct-location',async page=>{
 await checkout(page,{wait:true,all:true});await hundred(page);await confirm(page);await paidDialog(page).waitFor();
 assert.match(await paidDialog(page).innerText(),/轮候|輪候/);assert.doesNotMatch(await paidDialog(page).innerText(),/堂食 ·  號枱/);
});
await test('08-electronic-keypad-stays-disabled',async page=>{
 await checkout(page);await page.locator('.checkout-method-grid').getByRole('button',{name:/FPS/}).click();
 assert.equal(await page.locator('.checkout-keypad').isVisible(),true);assert.equal(await page.locator('.checkout-keypad button').first().isDisabled(),true);
 await confirm(page);await paidDialog(page).waitFor();assert.equal((await snapshot(page)).holds[0].payments[0].tender,'FPS');
});
await test('09-back-does-not-pay-or-retain-old-ui-intent',async page=>{
 await checkout(page);await page.locator('.checkout-order-footer button').first().click();await page.locator('.dining-nine-grid').waitFor();
 assert.equal((await snapshot(page)).holds[0].payments.length,0);assert.equal(await page.evaluate(()=>localStorage.getItem('mfk.smt.dining-checkout-ui.v1')),null);
});
await test('10-storage-failure-never-shows-completion-then-retry-once',async page=>{
 await checkout(page);await hundred(page);
 await page.evaluate(k=>{const orig=Storage.prototype.setItem;let fail=true;Storage.prototype.setItem=function(a,b){if(a===k&&fail){fail=false;throw new Error('SIMULATED_STORAGE_FAILURE');}return orig.call(this,a,b);};},key);
 await confirm(page);await page.locator('.checkout-payment-alert').waitFor();
 assert.match(await page.locator('.checkout-payment-alert').innerText(),/儲存|保存/);assert.equal((await snapshot(page)).holds[0].payments.length,0);
 await page.locator('.checkout-payment-alert button').click();await paidDialog(page).waitFor();assert.equal((await snapshot(page)).holds[0].payments.length,1);
});
const report={suite:'DINING_R3_REAL_CHECKOUT',passed:results.filter(r=>r.status==='PASS').length,total:results.length,results};
await fs.writeFile(path.join(out,'checkout-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
// Package EXACT same Checkout application for offline owner review, not a rewritten mock.
const outputs=(await build({configFile:false,plugins:[react()],base:'./',build:{write:false,cssCodeSplit:false,minify:true,target:'esnext',rollupOptions:{input:path.resolve('acceptance/dining-checkout-r3.html'),output:{inlineDynamicImports:true}}}})).output;
let html=String(outputs.find(f=>f.type==='asset'&&f.fileName.endsWith('.html')).source);
html=html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(_,url)=>{const chunk=outputs.find(f=>f.type==='chunk'&&url.endsWith(f.fileName));assert.ok(chunk);return '<script type="module">'+chunk.code.replace(/<\/script/gi,'<\\/script')+'</script>';});
html=html.replace(/<link\b[^>]*href="([^"]+)"[^>]*>/g,(tag,url)=>{const css=outputs.find(f=>f.type==='asset'&&f.fileName.endsWith('.css')&&url.endsWith(f.fileName));return css?'<style>'+css.source+'</style>':tag;});
await fs.writeFile(path.join(out,'dining-checkout-preview.html'),html);
await browser.close();await server.close();
await fs.rm('src/__dining_r3_app.tsx');
if(report.passed!==report.total)process.exitCode=1;
