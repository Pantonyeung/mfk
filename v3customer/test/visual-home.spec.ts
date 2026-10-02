import {expect,test,type Page} from '@playwright/test';

const viewports=[
  {name:'360',width:360,height:800},
  {name:'390',width:390,height:844},
  {name:'412',width:412,height:915},
  {name:'430',width:430,height:932},
] as const;

async function addFirstItemAndOpenCheckout(page:Page){
  await page.goto('/');
  await page.getByRole('button',{name:'菜單',exact:true}).click();
  await page.getByRole('button',{name:/香草烤雞腿飯/}).click();
  await page.getByRole('button',{name:'加入記憶罐'}).click();
  await page.getByRole('button',{name:/一次過結帳/}).click();
  await page.getByRole('button',{name:/下一步/}).click();
}

for(const size of viewports){
  test(`mobile home layout contract ${size.name}`,async({page})=>{
    await page.setViewportSize({width:size.width,height:size.height});
    await page.goto('/');
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('.hero-slide')].every(image=>image.complete&&image.naturalWidth>0));

    const metrics=await page.evaluate(()=>{
      const rect=(selector:string)=>document.querySelector(selector)?.getBoundingClientRect();
      return {
        viewportHeight:innerHeight,
        viewportWidth:innerWidth,
        documentHeight:document.documentElement.scrollHeight,
        documentWidth:document.documentElement.scrollWidth,
        header:rect('.header'),
        headerPosition:getComputedStyle(document.querySelector('.header')!).position,
        hero:rect('.hero'),
        heroTitle:rect('#hero-title'),
        heroVisual:rect('.hero-visual'),
        heroSlides:[...document.querySelectorAll('.hero-slide')].map(el=>el.getBoundingClientRect()),
        heroDots:[...document.querySelectorAll('.hero-dots button')].map(el=>el.getBoundingClientRect()),
        cta:rect('.hero-copy > button'),
        quickCards:[...document.querySelectorAll('.quick-card')].map(el=>el.getBoundingClientRect()),
        quickIcons:[...document.querySelectorAll('.quick-icon')].map(el=>el.getBoundingClientRect()),
        lifestyle:rect('.lifestyle'),
        recent:rect('.recent-card'),
        navButtons:[...document.querySelectorAll('nav button')].map(el=>el.getBoundingClientRect()),
      };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.headerPosition).toBe('fixed');
    expect(metrics.header?.top ?? -1).toBe(0);
    expect(metrics.hero?.height ?? 0).toBeGreaterThanOrEqual(metrics.viewportHeight*.60);
    expect(metrics.hero?.height ?? 0).toBeLessThanOrEqual(metrics.viewportHeight*.72);
    expect(metrics.heroVisual?.top ?? 0).toBeGreaterThanOrEqual((metrics.heroTitle?.bottom ?? 0)+4);
    expect(metrics.heroSlides).toHaveLength(4);
    expect(metrics.heroDots).toHaveLength(4);
    for(const dot of metrics.heroDots){
      expect(dot.height).toBeGreaterThanOrEqual(34);
      expect(dot.width).toBeGreaterThanOrEqual(34);
    }

    const pageScreens=metrics.documentHeight/metrics.viewportHeight;
    expect(pageScreens).toBeGreaterThanOrEqual(1.20);
    expect(pageScreens).toBeLessThanOrEqual(1.50);
    expect(metrics.cta?.height ?? 0).toBeGreaterThanOrEqual(48);
    expect(metrics.quickCards).toHaveLength(4);
    for(const card of metrics.quickCards){
      expect(card.height).toBeGreaterThanOrEqual(150);
      expect(card.width).toBeGreaterThanOrEqual(70);
    }
    for(const icon of metrics.quickIcons){
      expect(icon.height).toBeGreaterThanOrEqual(52);
      expect(icon.width).toBeGreaterThanOrEqual(52);
    }
    expect(metrics.lifestyle?.height ?? 0).toBeGreaterThanOrEqual(150);
    expect(metrics.recent?.height ?? 0).toBeGreaterThanOrEqual(72);
    expect(metrics.navButtons).toHaveLength(5);
    for(const button of metrics.navButtons){
      expect(button.height).toBeGreaterThanOrEqual(52);
      expect(button.width).toBeGreaterThanOrEqual(60);
    }
  });
}

test('primary home actions and hero motion stay honest',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.getByRole('button',{name:'店舖狀態：營業中'})).toBeVisible();
  await expect(page.locator('.quick-card')).toHaveCount(4);
  await expect(page.getByRole('button',{name:/限時優惠/})).toBeVisible();
  await expect(page.getByText('期間限定')).toHaveCount(0);
  await expect(page.locator('.hero-slide')).toHaveCount(4);

  const heroVisual=page.locator('.hero-visual');
  const initialWidth=(await heroVisual.boundingBox())?.width ?? 0;
  await page.evaluate(()=>window.scrollTo(0,260));
  await expect.poll(()=>page.locator('.hero').evaluate(el=>Number(getComputedStyle(el).getPropertyValue('--hero-progress')))).toBeGreaterThan(.9);
  expect((await heroVisual.boundingBox())?.width ?? initialWidth).toBeLessThan(initialWidth*.9);
  expect((await page.locator('.header').boundingBox())?.y ?? -1).toBe(0);

  await page.getByRole('button',{name:'記憶罐'}).click();
  await expect(page.getByRole('heading',{name:'記憶罐',exact:true})).toBeVisible();
  await expect(page.getByText('記憶罐仲係空嘅')).toBeVisible();
});

test('four home entrances have four independent experiences',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/今日精選/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading',{name:'今日主廚精選'})).toBeVisible();
  await expect(page.getByText('每日內容由舖頭更新')).toBeVisible();
  await page.getByRole('button',{name:'關閉'}).click();

  await page.getByRole('button',{name:/人氣組合/}).click();
  await expect(page.getByRole('heading',{name:'熱門配搭，一次揀好'})).toBeVisible();
  await page.getByRole('button',{name:'返回',exact:true}).click();

  await page.getByRole('button',{name:/限時優惠/}).click();
  await expect(page.getByRole('heading',{name:'趁優惠，食好一餐'})).toBeVisible();
  await page.getByRole('button',{name:'返回',exact:true}).click();

  await page.getByRole('button',{name:/30分鐘內可取/}).click();
  await expect(page.getByRole('heading',{name:'由揀餐到取餐，一眼睇明'})).toBeVisible();
  await expect(page.getByText('整張訂單只揀一次付款方法')).toBeVisible();
});

test('product options are one scroll page and Memory Jar accepts multiple items',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'菜單',exact:true}).click();
  await page.getByRole('button',{name:/香草烤雞腿飯/}).click();
  await expect(page.getByRole('heading',{name:'選擇組合'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'口味與加配'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'數量與備註'})).toBeVisible();

  const hero=page.locator('.product-hero');
  const initialHeight=(await hero.boundingBox())?.height ?? 0;
  await page.evaluate(()=>window.scrollTo(0,420));
  await expect.poll(async()=>(await hero.boundingBox())?.height ?? initialHeight).toBeLessThan(initialHeight*.65);
  await page.getByRole('radio',{name:/配飲品/}).click();
  await page.getByRole('checkbox',{name:/加蛋/}).click();
  await page.getByRole('button',{name:'增加數量'}).click();
  await page.getByPlaceholder('例如：不要蔥、少辣').fill('少醬');
  await page.getByRole('button',{name:'加入記憶罐'}).click();
  await expect(page.locator('.jar-item')).toHaveCount(1);

  await page.getByRole('button',{name:/繼續揀餐/}).click();
  await page.getByRole('button',{name:/香酥雞粒飯/}).click();
  await page.getByRole('button',{name:'加入記憶罐'}).click();
  await expect(page.locator('.jar-item')).toHaveCount(2);
  await expect(page.getByText('已加入 2 款餐點；可以繼續揀，最後一次過結帳。')).toBeVisible();
  await page.getByRole('button',{name:/一次過結帳/}).click();
  await expect(page.getByRole('heading',{name:'取餐資料'})).toBeVisible();
});

test('electronic payment requires evidence and exposes both coupon fallback previews',async({page})=>{
  await addFirstItemAndOpenCheckout(page);
  await expect(page.getByRole('heading',{name:'付款方式'})).toBeVisible();
  await page.getByRole('button',{name:/下一步/}).click();
  await expect(page.getByRole('alert')).toContainText('請先上載付款證明');
  await expect(page.getByRole('heading',{name:'付款方式'})).toBeVisible();

  await page.getByRole('button',{name:/優惠券/}).click();
  await page.getByRole('button',{name:'套用'}).click();
  await page.locator('#payment-proof').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from('preview-proof')});
  await page.getByRole('button',{name:/下一步/}).click();
  await expect(page.getByText('付款證明只會交由舖頭核對，並非已付款確認')).toBeVisible();

  await page.getByRole('button',{name:'未付款／現金後備'}).click();
  await expect(page.getByRole('heading',{name:'轉到 WhatsApp 前確認'})).toBeVisible();
  await expect(page.getByText('只供對話查詢，唔係訂單編號。')).toBeVisible();
  await page.getByRole('button',{name:'關閉'}).click();
  await page.getByRole('button',{name:'已付款後備'}).click();
  await expect(page.getByRole('heading',{name:'已付款價錢會保留'})).toBeVisible();
  await expect(page.getByText('唔需要再次付款',{exact:false})).toBeVisible();
});

test('cash bypasses payment proof and pickup code is phone last four digits',async({page})=>{
  await addFirstItemAndOpenCheckout(page);
  await page.getByRole('button',{name:/現金付款/}).click();
  await expect(page.locator('#payment-proof')).toHaveCount(0);
  await expect(page.locator('.qr-preview')).toHaveCount(0);
  await page.getByRole('button',{name:/下一步/}).click();
  await expect(page.getByText('唔會進入付款證明流程')).toBeVisible();
  await page.getByRole('button',{name:/確認送出/}).click();
  await expect(page.getByText('現金付款・到店付款')).toBeVisible();
  await expect(page.getByText('付款證明已提交')).toHaveCount(0);
  await expect(page.getByText('4567',{exact:true})).toBeVisible();
  await expect(page.getByText(/訂單顯示編號 MF-NEW/)).toBeVisible();
});

test('member recovery, lifetime Seeds and marketing consent remain separate',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'我的',exact:true}).click();
  await expect(page.getByText('終身累計種子')).toBeVisible();
  await page.getByRole('button',{name:/登入／啟用會員/}).click();
  await expect(page.getByRole('heading',{name:'正式會員登入'})).toBeVisible();
  await expect(page.getByLabel('密碼')).toHaveAttribute('type','password');
  await page.getByRole('button',{name:'忘記密碼／更改電話'}).click();
  await expect(page.getByRole('heading',{name:'經 WhatsApp 人工核對'})).toBeVisible();
  await expect(page.getByText('一次性臨時密碼')).toBeVisible();

  await page.getByRole('button',{name:'首頁',exact:true}).click();
  await page.getByRole('button',{name:'我的',exact:true}).click();
  await page.getByRole('button',{name:/設定 通知、同意及私隱/}).click();
  await expect(page.getByText('訂單通知')).toBeVisible();
  await expect(page.locator('.settings-list b').filter({hasText:'優惠消息'})).toBeVisible();
  const toggles=page.locator('.settings-list input');
  await expect(toggles.nth(0)).toBeChecked();
  await expect(toggles.nth(1)).not.toBeChecked();
});

test('refresh reads status while reorder creates a new Memory Jar',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'訂單',exact:true}).click();
  await page.getByRole('button',{name:'查看詳情'}).click();
  await page.getByRole('button',{name:/更新狀態/}).click();
  await expect(page.getByRole('status')).toContainText('冇重複送出訂單');
  await page.getByRole('button',{name:'再來一單'}).click();
  await expect(page.getByRole('heading',{name:'建立一個新記憶罐'})).toBeVisible();
});
