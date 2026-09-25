import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const out=process.env.PROOF_DIR||'/tmp/mfk-dining-proof';
const base=process.env.PROOF_URL||'http://127.0.0.1:4173/acceptance/dining.html';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
async function run(name,fn,viewport={width:1180,height:820}){
  const page=await browser.newPage({viewport});const errors=[];const external=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('dialog',d=>d.accept());
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1'&&url.protocol!=='data:'){external.push(url.origin);return route.abort();}
    return route.continue();
  });
  try{
    await page.goto(base);await page.locator('.dining-table').first().waitFor();
    await fn(page);
    assert.equal(await page.locator('vite-error-overlay').count(),0,'Vite error overlay');
    assert.deepEqual(errors,[],'browser runtime errors');assert.deepEqual(external,[],'must not contact any production service');
    await page.screenshot({path:out+'/'+name+'.png',fullPage:false});
    results.push({name,status:'PASS'});
  }catch(error){
    await page.screenshot({path:out+'/'+name+'-failure.png',fullPage:false}).catch(()=>{});
    results.push({name,status:'FAIL',error:String(error)});
  }finally{await page.close();}
}
const table=(page,n)=>page.locator('.dining-table').nth(n-1);
const checkout=page=>page.locator('.dining-settle-button');
const waitRow=(page,code)=>page.locator('.dining-wait-list article').filter({hasText:code});
const selectAll=page=>page.getByRole('button',{name:'全選未結',exact:true});

await run('01-outdoor-and-layout',async page=>{
  assert.equal(await page.locator('.dining-table').count(),9);
  assert.match(await table(page,9).innerText(),/戶外桌/);
  const board=await page.locator('.dining-nine-grid').boundingBox();
  const panel=await page.locator('.dining-detail-panel').boundingBox();
  assert.ok(board&&panel&&board.x+board.width<=panel.x+2,'three fixed regions do not overlap');
  assert.ok(panel.x+panel.width<=1181,'detail panel stays inside viewport');
});
await run('02-waiting-detail-to-checkout',async page=>{
  await waitRow(page,'W001').locator('button').first().click();
  await page.locator('.dining-detail-panel').getByText('輪候飯團',{exact:true}).waitFor();
  await selectAll(page).click();await checkout(page).click();
  await page.getByTestId('checkout-readback').waitFor();
  const calls=await page.evaluate(()=>window.__diningProof.calls);
  assert.equal(calls.checkout.length,1);assert.equal(calls.checkout[0].holdId,'HW');assert.equal(calls.assign.length,0);
});
await run('03-selection-survives-refresh',async page=>{
  await table(page,1).click();await page.locator('.dining-detail-lines article').first().waitFor();
  await page.locator('.dining-line-selector').first().getByRole('button',{name:'＋',exact:true}).click();
  await page.evaluate(()=>window.__diningProof.emit());await page.waitForTimeout(120);
  assert.equal((await page.locator('.dining-line-selector b').first().innerText()).trim(),'1');
});
await run('04-late-read-cannot-replace-selection',async page=>{
  await page.evaluate(()=>{window.__diningProof.delay.H1=350;});
  await table(page,1).click();await table(page,2).click();await page.waitForTimeout(500);
  assert.match(await page.locator('.dining-detail-panel').innerText(),/便當乙/);
  assert.doesNotMatch(await page.locator('.dining-detail-panel').innerText(),/飯團甲/);
});
await run('05-stale-checkout-fails-closed',async page=>{
  await table(page,1).click();await selectAll(page).click();
  await page.evaluate(()=>{
    const row=window.__diningProof.snapshot().H1;
    window.__diningProof.mutate('H1',{lines:row.lines.map(x=>({...x,remainingQty:0,paidQty:x.qty})),paidMinor:row.totalMinor,remainingMinor:0});
  });
  await checkout(page).click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.__diningProof.calls.checkout.length),0,'stale item quantities must not reach checkout');
  assert.match(await page.locator('main').innerText(),/訂單已更新/);
});
await run('06-ordered-wait-cannot-be-deleted',async page=>{
  await waitRow(page,'W001').locator('.remove').click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.__diningProof.calls.remove.length),0,'never delete an ordered/paid wait from queue X');
  assert.equal(await waitRow(page,'W001').count(),1);
});
await run('07-item-split-not-person-limit',async page=>{
  await table(page,1).click();await selectAll(page).click();await checkout(page).click();await page.getByTestId('checkout-readback').waitFor();
  const req=await page.evaluate(()=>window.__diningProof.calls.checkout[0]);
  assert.equal(req.holdId,'H1');assert.equal(req.selections.reduce((s,x)=>s+x.qty,0),10);
  assert.equal(req.lines.reduce((s,x)=>s+x.qty*x.unitMinor,0),28900);
});
await run('08-double-click-single-checkout',async page=>{
  await table(page,1).click();await selectAll(page).click();
  await checkout(page).evaluate(button=>{button.click();button.click();});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.__diningProof.calls.checkout.length),1);
});
await run('09-only-explicit-dining-warning',async page=>{
  assert.equal(await table(page,1).evaluate(el=>el.classList.contains('overdue')),true,'32 minutes should exceed explicit 30-minute fixture rule');
  await page.goto(base+'?warning=none');await page.locator('.dining-table').first().waitFor();
  assert.equal(await page.locator('.dining-table.overdue').count(),0,'no made-up default limit when rule absent');
});
await run('10-occupied-table-never-stolen',async page=>{
  await waitRow(page,'W001').locator('button').first().click();await table(page,1).click();await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>window.__diningProof.calls.assign.length),0);
});
await run('11-empty-wait-keeps-same-identity-on-seat',async page=>{
  await waitRow(page,'W002').locator('button').first().click();await table(page,9).click();await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>window.__diningProof.calls.assign),['HE:T09']);
  assert.match(await page.locator('.dining-detail-panel').innerText(),/戶外桌/);
});
await run('12-desktop-visual',async page=>{
  await table(page,1).click();await selectAll(page).click();
  assert.ok(await checkout(page).isVisible());
  assert.ok((await page.locator('main').innerText()).includes('飯團甲'));
},{width:1920,height:1080});

await browser.close();
const report={suite:'MFK_DINING_INTERACTION_R1',passed:results.filter(x=>x.status==='PASS').length,total:results.length,results};
await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.passed!==report.total)process.exitCode=1;
