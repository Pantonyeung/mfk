import {test,expect} from '@playwright/test';
const catalog={scope:'MFP_V3_LINKED_TEST_MF01_20261003',mode:'CONNECTED_TEST',fingerprint:'published-one',revision:1,publishedAt:'2026-10-03T01:00:00Z',categories:[{id:'c1',name:'飯糰'}],products:[{id:'p1',name:'測試飯糰',description:'已發布商品',categoryId:'c1',priceMinor:4100,available:true,unavailableReason:'',options:[{id:'g1',name:'飯量',min:1,max:1,defaults:['o1'],choices:[{id:'o1',name:'正常',adjustmentMinor:0},{id:'o2',name:'加飯',adjustmentMinor:500}]}]}],formalCheckoutConnected:false,physicalPrintConnected:false};
const storageKey='mfp:v3:linked-test:customer:request:v1';
async function setup(page:any){
  let current:any=structuredClone(catalog),catalogReads=0,statusReads=0,submits:any[]=[],failSubmit=false;
  const records=new Map<string,any>(),reviews=new Map<string,string>();
  let catalogHold:Promise<void>|null=null,releaseCatalog:(()=>void)|null=null,pendingCatalog=0;
  const sockets=new Set<any>();
  await page.routeWebSocket('**/api/v3-test/*-events',(ws:any)=>{sockets.add(ws);ws.onClose(()=>sockets.delete(ws));});
  await page.route('**/api/v3-test/**',async(route:any)=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/catalog')){catalogReads++;if(catalogHold){pendingCatalog++;await catalogHold;pendingCatalog--;}return route.fulfill({json:current});}
    const body=route.request().postDataJSON();
    if(path.endsWith('/submit')){submits.push(body);if(!records.has(body.submissionId)){records.set(body.submissionId,body);reviews.set(body.submissionId,'UNSEEN');}if(failSubmit)return route.abort('failed');}
    if(path.endsWith('/readback'))statusReads++;
    const record=records.get(body?.submissionId),review=reviews.get(body?.submissionId)??'UNSEEN';
    if(!record)return route.fulfill({status:404,json:{state:'UNKNOWN'}});
    return route.fulfill({status:path.endsWith('/submit')?202:200,json:{submissionId:record.submissionId,state:review==='REJECTED'?'REJECTED':'PENDING_SMT',reviewState:review,reviewedAt:null,message:'server status',formalOrderCreated:false,paymentConfirmed:false}});
  });
  return {get pendingCatalog(){return pendingCatalog;},holdCatalog:()=>{catalogHold=new Promise<void>(resolve=>releaseCatalog=resolve);},releaseCatalog:()=>{catalogHold=null;releaseCatalog?.();releaseCatalog=null;},get submits(){return submits;},get catalogReads(){return catalogReads;},get statusReads(){return statusReads;},setReview:(v:string,id?:string)=>{for(const key of id?[id]:records.keys())reviews.set(key,v);},setCatalog:(v:any)=>current=v,fail:(v:boolean)=>failSubmit=v,signal:()=>sockets.forEach(ws=>ws.send(JSON.stringify({state:'PAID',priceMinor:1}))),close:()=>sockets.forEach(ws=>ws.close())};
}
async function add(page:any){await page.getByRole('button',{name:'選擇 測試飯糰'}).click();await expect(page.getByLabel('正常')).toBeChecked();await page.getByLabel('加飯').check();await page.getByRole('button',{name:'加入測試購物籃'}).click();}
test('server products/options, repeated click, reload, doorbell and canonical status are truthful',async({page})=>{
  const api=await setup(page);await page.goto('/');await expect(page.getByText('CONNECTED TEST',{exact:true})).toBeVisible();await expect(page.getByText('$41.00',{exact:true})).toBeVisible();await add(page);
  await page.getByRole('button',{name:'送出測試要求',exact:true}).evaluate((button:HTMLButtonElement)=>{button.click();button.click();});
  await expect(page.getByTestId('request-status')).toHaveText('PENDING · 等候 POS 查看');expect(api.submits).toHaveLength(1);expect(api.submits[0].cart[0].selections[0].optionId).toBe('o2');expect(api.submits[0].checkout.paymentMethod).toBe('PAY_AT_STORE');
  const id=api.submits[0].submissionId;await page.reload();await expect(page.getByTestId('request-status')).toHaveText('PENDING · 等候 POS 查看');expect(api.submits).toHaveLength(1);await expect(page.getByText(id,{exact:true})).toBeVisible();
  api.setReview('SEEN');api.signal();await expect(page.getByTestId('request-status')).toHaveText('SEEN · POS 已查看');expect(api.statusReads).toBeGreaterThan(0);
  api.setReview('REJECTED');await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(page.getByTestId('request-status')).toHaveText('REJECTED · 店舖未能接受');
  await expect(page.getByText(/訂單已成立|付款成功|已列印|落單成功/)).toHaveCount(0);await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page.screenshot({path:'/tmp/customer-linked-request.png',fullPage:true});
});
test('ambiguous submit survives reload and retries exact identity and payload',async({page})=>{
  const api=await setup(page);api.fail(true);await page.goto('/');await add(page);await page.getByRole('button',{name:'送出測試要求',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Failed to fetch');
  const first=api.submits[0];api.fail(false);await page.reload();await expect(page.getByTestId('request-status')).toContainText('PENDING');await page.getByRole('button',{name:'以相同身份重試'}).click();await expect.poll(()=>api.submits.length).toBe(2);expect(api.submits[1]).toEqual(first);
});
test('catalog invalidation clears stale selections and reconnect rereads without polling',async({page})=>{
  const api=await setup(page);await page.goto('/');await add(page);api.setCatalog({...catalog,fingerprint:'published-two',products:[{...catalog.products[0],priceMinor:4300}]});api.signal();await expect(page.getByText('$43.00',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'送出測試要求',exact:true})).toBeDisabled();
  const before=api.catalogReads;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>api.catalogReads).toBeGreaterThan(before);await page.screenshot({path:'/tmp/customer-linked-catalog.png',fullPage:true});
});
test('malformed data and storage fail closed without preview fallbacks or writes',async({page})=>{
  const api=await setup(page);api.setCatalog({...catalog,formalCheckoutConnected:true});await page.goto('/');await expect(page.getByRole('alert')).toContainText('LINKED_FORMAL_CLAIM_INVALID');await expect(page.getByRole('button',{name:'送出測試要求',exact:true})).toBeDisabled();expect(api.submits).toHaveLength(0);
  await page.evaluate(key=>localStorage.setItem(key,'broken'),storageKey);await page.reload();await expect(page.getByRole('alert').first()).toContainText('LINKED_STORAGE');expect(await page.evaluate(key=>localStorage.getItem(key),storageKey)).toBe('broken');
});
test('optional single-choice group can be cleared after a canonical default',async({page})=>{
  const api=await setup(page);api.setCatalog({...catalog,products:[{...catalog.products[0],options:[{...catalog.products[0].options[0],min:0}]}]});await page.goto('/');await page.getByRole('button',{name:'選擇 測試飯糰'}).click();await expect(page.getByLabel('正常')).toBeChecked();await page.getByLabel('不選擇飯量').check();await expect(page.getByLabel('正常')).not.toBeChecked();await page.getByRole('button',{name:'加入測試購物籃'}).click();await page.getByRole('button',{name:'送出測試要求',exact:true}).click();await expect(page.getByTestId('request-status')).toContainText('PENDING');expect(api.submits[0].cart[0].selections).toEqual([]);
});
test('explicit new test request requires seen status and preserves old request after reload',async({page})=>{
  const api=await setup(page);await page.goto('/');await add(page);await page.getByRole('button',{name:'送出測試要求',exact:true}).click();await expect(page.getByTestId('request-status')).toContainText('PENDING');await expect(page.getByRole('button',{name:'建立新的測試要求'})).toHaveCount(0);
  const first=api.submits[0];api.setReview('SEEN');api.signal();await expect(page.getByTestId('request-status')).toContainText('SEEN');await page.getByRole('button',{name:'建立新的測試要求'}).click();await expect(page.getByRole('button',{name:'送出測試要求',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('region',{name:'先前測試要求'})).toBeVisible();const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey);expect(saved.active).toBeNull();expect(saved.history).toEqual([first]);expect(api.submits).toHaveLength(1);
  await add(page);await page.getByRole('button',{name:'送出測試要求',exact:true}).click();await expect(page.getByTestId('request-status')).toContainText('PENDING');expect(api.submits).toHaveLength(2);const second=api.submits[1];expect(second.submissionId).not.toBe(first.submissionId);
  api.setReview('REJECTED',second.submissionId);api.signal();await expect(page.getByTestId('request-status')).toContainText('REJECTED');
  const retained=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),storageKey);expect(retained.history).toEqual([first]);expect(retained.active).toEqual(second);
  await page.getByRole('region',{name:'先前測試要求'}).locator('summary').click();await page.getByRole('button',{name:'讀取先前要求狀態'}).click();await expect(page.getByRole('status').filter({hasText:'最近讀回：SEEN'})).toBeVisible();
});

test('catalog refresh during a native product click preserves navigation and keeps mutation closed',async({page})=>{
  const api=await setup(page);await page.goto('/');await add(page);
  const submit=page.getByRole('button',{name:'送出測試要求',exact:true});
  await expect(submit).toBeEnabled();
  const product=page.getByRole('button',{name:'選擇 測試飯糰'});
  await expect(product).toBeEnabled();await product.hover();
  api.holdCatalog();
  try{
    await page.mouse.down();
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect.poll(()=>api.pendingCatalog).toBeGreaterThan(0);
    await expect(submit).toBeDisabled(); // Observe the React invalidation commit before pointer-up.
    await page.mouse.up();
    await expect(page.getByLabel('正常')).toBeChecked();
    await expect(page.getByLabel('正常')).toBeDisabled();
    await expect(page.getByRole('button',{name:'加入測試購物籃'})).toBeDisabled();
    await expect(page.getByRole('button',{name:'送出測試要求',exact:true})).toBeDisabled();
  }finally{api.releaseCatalog();}
  await expect(page.getByLabel('正常')).toBeEnabled();
  await expect(page.getByLabel('正常')).toBeChecked();
  await page.getByRole('button',{name:'加入測試購物籃'}).click();
  await expect(page.getByRole('button',{name:'移除 測試飯糰'})).toHaveCount(2);
  expect(api.submits).toHaveLength(0);
});
