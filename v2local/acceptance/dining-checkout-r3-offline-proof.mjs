import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='/tmp/mfk-dining-r3';
const html=path.join(out,'dining-checkout-preview.html');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const viewport of [{width:1180,height:820},{width:1920,height:1080}]){
  const name=viewport.width===1180?'tablet':'desktop';
  const context=await browser.newContext({viewport,offline:true});
  const external=[];const errors=[];
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.protocol==='http:'||u.protocol==='https:'){external.push(u.origin);return route.abort();}
   return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(5000);
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(pathToFileURL(html).href+'#/dining');
   await page.locator('.dining-nine-grid').waitFor();
   assert.match(await page.title(),/堂食真正結帳流程/);
   await page.locator('.dining-table').first().click();
   await page.getByRole('button',{name:'全選未結',exact:true}).click();
   await page.locator('.dining-settle-button').click();
   await page.locator('.checkout-workspace').waitFor();
   await page.locator('.checkout-quick-cash').getByRole('button',{name:'+100',exact:true}).click();
   await page.locator('.checkout-confirm').click();
   const dialog=page.getByRole('dialog',{name:'交易完成核對'});
   await dialog.waitFor();
   assert.match(await dialog.innerText(),/堂食付款已記錄/);
   assert.match(await dialog.innerText(),/18\.00/);
   await page.reload();await dialog.waitFor();
   assert.match(await dialog.innerText(),/18\.00/);
   let snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('mfk.v2local.runtime.v1')));
   let paid=snapshot.holds.find(h=>h.id==='R3-TABLE');
   assert.equal(paid.payments.length,1);assert.equal(paid.payments[0].amountMinor,8200);
   assert.equal(paid.payments[0].receivedMinor,10000);assert.equal(paid.payments[0].changeMinor,1800);
   assert.ok(paid.archivedAt);assert.equal(snapshot.orders.length,0);
   await page.screenshot({path:path.join(out,'dining-r3-recovered-review-'+name+'.png')});
   await dialog.getByRole('button',{name:'完成',exact:true}).click();
   await page.locator('.dining-nine-grid').waitFor();
   assert.match(await page.locator('.dining-table').first().getAttribute('class'),/available/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('mfk.smt.dining-checkout-ui.v1')),null);
   snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('mfk.v2local.runtime.v1')));
   paid=snapshot.holds.find(h=>h.id==='R3-TABLE');assert.equal(paid.payments.length,1);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   await page.screenshot({path:path.join(out,'dining-r3-after-done-'+name+'.png')});
   results.push({name:'offline-payment-reload-done-'+name,status:'PASS',viewport,externalRequests:0,pageErrors:0});
  }catch(error){results.push({name,status:'FAIL',error:String(error),external,errors});await page.screenshot({path:path.join(out,'offline-'+name+'-FAIL.png')}).catch(()=>{});}
  finally{await context.close();}
 }
}finally{await browser.close();}
const report={suite:'DINING_R3_PACKAGED_OFFLINE',passed:results.filter(r=>r.status==='PASS').length,total:results.length,results};
await fs.writeFile(path.join(out,'offline-browser-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;
