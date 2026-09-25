import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});

const out='/tmp/mfk-dining-r4';
await fs.mkdir(out,{recursive:true});
await page.goto('http://127.0.0.1:4173/acceptance/dining-cart-entry-r4.html',{waitUntil:'networkidle'});

if(await page.title()!=='MFK Dining Cart Entry R4')throw new Error('PAGE_IDENTITY_FAILED');
if(!(await page.locator('body').innerText()).includes('暫存／堂食'))throw new Error('APP_BLANK_OR_WRONG');

const modes=page.locator('.hold-kind-grid button');
if(await modes.count()!==2)throw new Error('MODE_TOGGLE_COUNT');

if(!(await modes.nth(0).getAttribute('class'))?.includes('active'))throw new Error('TAKEAWAY_DID_NOT_DEFAULT_HOLD');
if(!await page.locator('.hold-cart-summary').isVisible())throw new Error('TAKEAWAY_HOLD_SUMMARY_MISSING');
if(await page.locator('.hold-inline-dining').count())throw new Error('TAKEAWAY_SHOULD_NOT_START_DINING');

await modes.nth(1).click();
if(!await page.locator('.hold-inline-dining').isVisible())throw new Error('MANUAL_DINING_SWITCH_FAILED');
if(await page.getByRole('button',{name:/加入輪候/}).count()!==1)throw new Error('WAITING_BUTTON_MISSING');
if(await page.locator('.hold-nine-grid button').count()!==9)throw new Error('NINE_GRID_MISSING');
await page.screenshot({path:out+'/takeaway-switched-to-dining.png',fullPage:false});

await page.locator('#scenario-mixed').click();
await page.waitForTimeout(50);
const mixedModes=page.locator('.hold-kind-grid button');
if(!(await mixedModes.nth(1).getAttribute('class'))?.includes('active'))throw new Error('MIXED_DID_NOT_DEFAULT_DINING');
if(!await page.locator('.hold-inline-dining').isVisible())throw new Error('MIXED_DINING_VIEW_MISSING');
await page.screenshot({path:out+'/mixed-default-dining.png',fullPage:false});

await mixedModes.nth(0).click();
if(!await page.locator('.hold-cart-summary').isVisible())throw new Error('MANUAL_HOLD_SWITCH_FAILED');
if(await page.getByRole('button',{name:'確認暫存'}).count()!==1)throw new Error('CONFIRM_HOLD_MISSING');
await page.screenshot({path:out+'/mixed-switched-to-hold.png',fullPage:false});

if(errors.length)throw new Error('BROWSER_ERRORS:'+errors.join(' | '));
await fs.writeFile(out+'/report.json',JSON.stringify({pass:true,checks:9,pageErrors:errors},null,2));
await browser.close();
console.log('DINING_CART_ENTRY_R4_BROWSER_PASS 9/9');
