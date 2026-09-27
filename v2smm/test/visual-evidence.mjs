import {chromium} from 'playwright';
import {preview} from 'vite';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

const BASE='http://127.0.0.1:4173';
const observedAt='2026-09-28T12:00:00+08:00';

const snapshot={
  connectionPath:'INTERNET',
  observedAt,
  orders:[],
  work:[],
  channels:[],
  dineSessions:[],
  diningTables:[
    {tableId:'T1',label:'A1',sortOrder:1},
    {tableId:'T2',label:'A2',sortOrder:2},
  ],
  printHealth:[],
  refundRequests:[],
  menu:{
    revision:'MENU-2026-09-28',
    observedAt,
    categories:[
      {categoryId:'popular',name:'人氣推薦',sortOrder:1},
      {categoryId:'riceball',name:'飯糰',sortOrder:2},
      {categoryId:'meal',name:'套餐',sortOrder:3},
    ],
    products:[
      {
        productId:'P-RICEBALL-01',
        categoryId:'popular',
        name:'招牌紫米飯糰',
        description:'紫米、主菜同新鮮配料',
        available:true,
        publishedTakeawayUnitPriceMinor:4300,
        publishedDineInUnitPriceMinor:4200,
        variationRequired:true,
        variations:[
          {variationId:'V-STD',name:'標準',available:true},
          {variationId:'V-LIGHT',name:'少飯',available:true},
        ],
        optionGroups:[
          {
            optionGroupId:'G-SAUCE',
            name:'醬汁',
            required:true,
            minSelections:1,
            maxSelections:1,
            options:[
              {optionId:'O-SAUCE-A',name:'蜜糖芥末',available:true,publishedAdjustmentMinor:0},
              {optionId:'O-SAUCE-B',name:'雙倍醬',available:true,publishedAdjustmentMinor:200},
            ],
          },
          {
            optionGroupId:'G-EXTRA',
            name:'加配',
            required:false,
            minSelections:0,
            maxSelections:2,
            options:[
              {optionId:'O-EGG',name:'溫泉蛋',available:true,publishedAdjustmentMinor:600},
              {optionId:'O-CHEESE',name:'芝士',available:true,publishedAdjustmentMinor:500},
            ],
          },
        ],
        comboId:'C-RICEBALL',
      },
      {
        productId:'P-BENTO-01',
        categoryId:'popular',
        name:'台式肉燥便當',
        description:'人氣便當',
        available:true,
        publishedTakeawayUnitPriceMinor:4900,
        publishedDineInUnitPriceMinor:4800,
        optionGroups:[],
      },
      {
        productId:'P-SALAD-01',
        categoryId:'popular',
        name:'紫米雞肉沙律',
        description:'清爽蔬菜配紫米',
        available:true,
        publishedTakeawayUnitPriceMinor:5200,
        publishedDineInUnitPriceMinor:5100,
        optionGroups:[],
      },
      {
        productId:'P-SOLD-01',
        categoryId:'popular',
        name:'限定飯糰',
        description:'今日暫停供應',
        available:false,
        publishedTakeawayUnitPriceMinor:4700,
        publishedDineInUnitPriceMinor:4600,
        optionGroups:[],
      },
    ],
    combos:[
      {
        comboId:'C-RICEBALL',
        name:'紫米套餐',
        publishedBasePriceMinor:5800,
        mainPoolId:'POOL-MAIN',
        addonPoolIds:['POOL-SNACK','POOL-DRINK'],
      },
    ],
    comboPools:[
      {
        poolId:'POOL-MAIN',
        name:'主食',
        kind:'MAIN_COURSE',
        groups:[{
          groupId:'CG-MAIN',
          name:'主食',
          required:true,
          minSelections:1,
          maxSelections:1,
          subPools:[{
            subPoolId:'SP-MAIN',
            name:'飯糰',
            publishedAdjustmentMinor:0,
            choices:[
              {choiceId:'CH-MAIN-1',choiceType:'PRODUCT',productId:'P-RICEBALL-01',label:'招牌紫米飯糰',available:true,publishedAdjustmentMinor:0},
            ],
          }],
        }],
      },
      {
        poolId:'POOL-SNACK',
        name:'小食',
        kind:'ADDON',
        addonKind:'SNACK',
        groups:[{
          groupId:'CG-SNACK',
          name:'小食',
          required:true,
          minSelections:1,
          maxSelections:1,
          subPools:[{
            subPoolId:'SP-SNACK',
            name:'小食',
            publishedAdjustmentMinor:0,
            choices:[
              {choiceId:'CH-SNACK-1',choiceType:'LABEL',label:'薯角',available:true,publishedAdjustmentMinor:0},
            ],
          }],
        }],
      },
      {
        poolId:'POOL-DRINK',
        name:'飲品',
        kind:'ADDON',
        addonKind:'DRINK',
        groups:[{
          groupId:'CG-DRINK',
          name:'飲品',
          required:false,
          minSelections:0,
          maxSelections:1,
          subPools:[{
            subPoolId:'SP-DRINK',
            name:'飲品',
            publishedAdjustmentMinor:0,
            choices:[
              {choiceId:'CH-DRINK-1',choiceType:'LABEL',label:'台式奶茶',available:true,publishedAdjustmentMinor:0},
              {choiceId:'CH-DRINK-2',choiceType:'LABEL',label:'冷泡茶',available:true,publishedAdjustmentMinor:600},
            ],
          }],
        }],
      },
    ],
  },
};

const staffDirectory={
  staff:[
    {staffId:'STAFF-A',loginId:'1001',displayName:'店長 A',role:'店務管理'},
    {staffId:'STAFF-B',loginId:'1002',displayName:'店員 B',role:'店員'},
  ],
};

async function installRoutes(page,{snapshotDelay=0,snapshotFailure=false}={}){
  await page.route('**/api/smm/snapshot*',async route=>{
    if(snapshotDelay)await new Promise(resolve=>setTimeout(resolve,snapshotDelay));
    if(snapshotFailure){
      await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'TEMP_UNAVAILABLE'})});
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)});
  });
  await page.route('**/api/smm/staff',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(staffDirectory),
  }));
  await page.route('**/api/smm/staff/session',route=>route.fulfill({
    status:401,contentType:'application/json',body:JSON.stringify({code:'NO_SESSION'}),
  }));
}

async function shot(page,dir,name){
  await page.screenshot({path:path.join(dir,name+'.png'),fullPage:true});
}

async function captureSize(browser,width,height){
  const dir=path.resolve('evidence/smm-p0',width+'x'+height);
  await mkdir(dir,{recursive:true});

  {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();
    await installRoutes(page);
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(120);
    await shot(page,dir,'stage0-splash');
    await page.getByRole('heading',{name:'員工登入'}).waitFor({timeout:5000});
    await page.waitForTimeout(150);
    await shot(page,dir,'stage0-staff-login');
    await context.close();
  }

  {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();
    await installRoutes(page,{snapshotDelay:2200});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(800);
    await page.getByRole('heading',{name:'正在連線'}).waitFor({timeout:3000});
    await shot(page,dir,'stage0-connection');
    await context.close();
  }

  {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();
    await installRoutes(page,{snapshotFailure:true});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'重新連接門店'}).waitFor({timeout:5000});
    await page.waitForTimeout(120);
    await shot(page,dir,'stage0-recovery');
    await context.close();
  }

  {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();
    await installRoutes(page);
    await page.goto(BASE+'/?ui-bypass=1',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'今日想食咩？'}).waitFor({timeout:5000});
    await page.waitForTimeout(120);
    await shot(page,dir,'stage1-order');

    await page.getByRole('button',{name:/招牌紫米飯糰/}).click();
    await page.getByRole('heading',{name:'招牌紫米飯糰'}).waitFor();
    await page.waitForTimeout(100);
    await shot(page,dir,'stage2-product-config');

    await page.getByRole('button',{name:/標準/}).click();
    await page.getByRole('button',{name:/蜜糖芥末/}).click();
    await page.getByRole('button',{name:/加入購物車/}).click();

    await page.getByRole('button',{name:/查看購物車/}).click();
    await page.getByRole('heading',{name:/1 件商品/}).waitFor();
    await page.waitForTimeout(100);
    await shot(page,dir,'stage3-cart');

    await page.getByRole('button',{name:'去結帳'}).click();
    await page.getByRole('heading',{name:'落單前確認'}).waitFor();
    await page.waitForTimeout(100);
    await shot(page,dir,'stage4-checkout');
    await context.close();
  }
}

const server=await preview({
  preview:{host:'127.0.0.1',port:4173,strictPort:true},
  logLevel:'error',
});
const browser=await chromium.launch({headless:true});
try{
  await captureSize(browser,440,956);
  await captureSize(browser,360,780);
}finally{
  await browser.close();
  await server.close();
}
console.log('SMM_P0_VISUAL_EVIDENCE_READY');
