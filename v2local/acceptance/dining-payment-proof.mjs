import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
const output='/tmp/mfk-dining-r2';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch();const results=[];
async function run(name,fn){const context=await browser.newContext({viewport:{width:1180,height:820}});const page=await context.newPage();const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=route.request().url();if(!u.startsWith('http://127.0.0.1:4173/')&&!u.startsWith('file:')&&!u.startsWith('data:')){external.push(u);return route.abort();}return route.continue();});
  try{await page.goto('http://127.0.0.1:4173/acceptance/dining-payment.html');await page.locator('.dining-table').first().waitFor();await fn(page);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push({name,status:'PASS'});}
  catch(error){results.push({name,status:'FAIL',error:String(error)});await page.screenshot({path:path.join(output,name+'-failed.png')});}
  finally{await context.close();}
}
const go=async page=>{await page.locator('.dining-table').first().click();await page.getByRole('button',{name:'全選未結'}).click();await page.getByRole('button',{name:/前往結帳/}).click();await page.getByRole('heading',{name:'分項結帳示例'}).waitFor();};
const snapshot=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mfk.v2local.runtime.v1')));
await run('01-partial-replay',async page=>{
  await page.locator('.dining-table').first().click();await page.locator('.dining-line-selector button').last().click();await page.getByRole('button',{name:/前往結帳/}).click();
  await page.getByRole('button',{name:'測試付款確認',exact:true}).click();await page.getByRole('heading',{name:'分項付款已保存'}).waitFor();
  await page.getByRole('button',{name:'重試同一確認（測試）'}).click();const state=await snapshot(page);
  assert.equal(state.holds[0].payments.length,1);assert.equal(state.holds[0].assignedTable,'T01');assert.equal(state.holds[0].payments[0].changeMinor,5900);assert.equal(state.orders.length,0);
  await page.getByRole('button',{name:'返回桌台',exact:true}).click();await page.locator('.dining-table.occupied').waitFor();
});
await run('02-full-release-history-reload',async page=>{
  await go(page);await page.getByRole('button',{name:'測試付款確認',exact:true}).click();await page.getByRole('heading',{name:'已付清，桌台已釋放'}).waitFor();
  let state=await snapshot(page);assert.ok(state.holds[0].archivedAt);assert.equal(state.holds[0].items.length,1);assert.equal(state.holds[0].payments.length,1);assert.equal(state.orders.length,0);
  await page.getByRole('button',{name:'返回桌台',exact:true}).click();await page.locator('.dining-table.available').first().waitFor();
  await page.getByRole('button',{name:/已結帳紀錄/}).click();await page.getByRole('button',{name:/H001/}).click();await page.getByText('已付清，桌台已釋放；商品及付款紀錄保留。').waitFor();
  await page.screenshot({path:path.join(output,'dining-r2-paid-history-tablet.png')});
  await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:path.join(output,'dining-r2-paid-history-desktop.png')});
  await page.reload();await page.getByRole('button',{name:/已結帳紀錄 1/}).waitFor();state=await snapshot(page);assert.equal(state.holds[0].payments.length,1);assert.equal(await page.locator('.dining-table.available').count(),9);
});
await run('03-cash-too-small',async page=>{
  await go(page);await page.getByLabel('實收金額').fill('1');await page.getByRole('button',{name:'測試付款確認',exact:true}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/DINING_CASH_INSUFFICIENT/);assert.equal((await snapshot(page)).holds[0].payments.length,0);
});
await run('04-stale-price-selection',async page=>{
  await go(page);await page.evaluate(async()=>{const {runtime,request}=window.__diningR2;await runtime.settleDiningHold(request.holdId,[{lineIndex:0,qty:1}],'CASH',{submissionId:'OTHER',expectedRevision:request.expectedRevision,receivedMinor:10000});});
  await page.getByRole('button',{name:'測試付款確認',exact:true}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/DINING_CHECKOUT_STALE/);assert.equal((await snapshot(page)).holds[0].payments.length,1);
});
// Package actual runtime + real dining UI, with the explicitly labelled test payment adapter.
const buildResult=await build({configFile:false,root:process.cwd(),base:'./',plugins:[react()],build:{write:false,cssCodeSplit:false,minify:true,rollupOptions:{input:path.resolve('acceptance/dining-payment.html')}}});
const outputs=(Array.isArray(buildResult)?buildResult:[buildResult]).flatMap(item=>item.output??[]);
let html=String(outputs.find(item=>item.type==='asset'&&item.fileName.endsWith('.html')).source);
html=html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(tag,url)=>{const item=outputs.find(row=>row.type==='chunk'&&url.endsWith(row.fileName));assert.ok(item);assert.equal(item.imports.length+item.dynamicImports.length,0);return '<script type="module">'+item.code.replace(/<\/script/gi,'<\\/script')+'</script>';});
html=html.replace(/<link\b[^>]*href="([^"]+)"[^>]*>/g,(tag,url)=>{const item=outputs.find(row=>row.type==='asset'&&row.fileName.endsWith('.css')&&url.endsWith(row.fileName));return item?'<style>'+String(item.source).replace(/<\/style/gi,'<\\/style')+'</style>':tag;});
assert.ok(!/(?:src|href)="[^"]*assets\//.test(html));
const file=path.join(output,'dining-payment-preview.html');await fs.writeFile(file,html);
const context=await browser.newContext({viewport:{width:1180,height:820}});await context.setOffline(true);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{await page.goto(pathToFileURL(file).href);await page.locator('.dining-table').first().waitFor();await go(page);await page.getByRole('button',{name:'測試付款確認',exact:true}).click();await page.getByRole('heading',{name:'已付清，桌台已釋放'}).waitFor();assert.deepEqual(errors,[]);results.push({name:'05-offline-standalone',status:'PASS'});}catch(error){results.push({name:'05-offline-standalone',status:'FAIL',error:String(error)});}
await context.close();await browser.close();
const report={suite:'DINING_R2_RUNTIME_BROWSER',passed:results.filter(row=>row.status==='PASS').length,total:results.length,results};await fs.writeFile(path.join(output,'payment-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.passed!==report.total)process.exitCode=1;
