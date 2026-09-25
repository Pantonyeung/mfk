import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const directory=process.env.PROOF_DIR||'/tmp/mfk-dining-proof';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1180,height:820}});
const errors=[];const requests=[];
page.on('pageerror',error=>errors.push(String(error)));
await page.route('**/*',route=>{
  if(/^https?:/.test(route.request().url())){requests.push(route.request().url());return route.abort();}
  return route.continue();
});
try{
  await page.goto(pathToFileURL(directory+'/dining-preview.html').href);
  await page.locator('.dining-table').first().waitFor();
  assert.equal(await page.title(),'磨飯｜堂食操作預覽');
  assert.equal(await page.locator('.dining-table').count(),9);
  await page.locator('.dining-table').first().click();
  await page.getByRole('button',{name:'全選未結',exact:true}).click();
  await page.screenshot({path:directory+'/dining-tablet-verified.png'});
  await page.locator('.dining-settle-button').click();
  const readback=page.getByTestId('checkout-readback');await readback.waitFor();
  const request=JSON.parse(await readback.innerText());
  assert.equal(request.holdId,'H1');assert.equal(request.selections.reduce((s,x)=>s+x.qty,0),10);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await fs.writeFile(directory+'/standalone-proof.json',JSON.stringify({status:'PASS',viewport:[1180,820],units:10,holdId:'H1',networkRequests:0,pageErrors:0},null,2));
  console.log('STANDALONE_DINING_PREVIEW_PASS: 9 tables, SAME H1, 10 units, zero network, zero page errors');
}finally{await browser.close();}
