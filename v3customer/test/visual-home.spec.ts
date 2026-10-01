import {expect,test} from '@playwright/test';

const viewports=[
  {name:'360',width:360,height:800},
  {name:'390',width:390,height:844},
  {name:'412',width:412,height:915},
  {name:'430',width:430,height:932},
] as const;

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
    expect(metrics.quickIcons).toHaveLength(4);
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

test('primary home actions stay honest in preview',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');

  await expect(page.locator('.hero-copy > button')).toBeVisible();
  await expect(page.getByRole('button',{name:'店舖狀態：營業中'})).toBeVisible();
  await expect(page.locator('.quick-card')).toHaveCount(4);
  await expect(page.getByRole('button',{name:/期間限定/})).toBeVisible();
  await expect(page.getByText('限時優惠')).toHaveCount(0);
  await expect(page.locator('.hero-slide')).toHaveCount(4);
  await page.getByRole('button',{name:'顯示季節手作'}).click();
  await expect(page.getByRole('button',{name:'顯示季節手作'})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.hero-slide').nth(1)).toHaveCSS('opacity','1');
  await expect(page.locator('.lifestyle')).toBeVisible();
  await expect(page.locator('.featured-card')).toHaveCount(0);
  await expect(page.locator('.recent-card')).toBeVisible();
  await expect(page.locator('nav button')).toHaveCount(5);

  const heroVisual=page.locator('.hero-visual');
  const initialWidth=(await heroVisual.boundingBox())?.width ?? 0;
  await page.evaluate(()=>window.scrollTo(0,260));
  await expect.poll(()=>page.locator('.hero').evaluate(el=>Number(getComputedStyle(el).getPropertyValue('--hero-progress')))).toBeGreaterThan(.9);
  expect((await heroVisual.boundingBox())?.width ?? initialWidth).toBeLessThan(initialWidth*.9);
  expect((await page.locator('.header').boundingBox())?.y ?? -1).toBe(0);

  await page.getByRole('button',{name:'記憶罐'}).click();
  await expect(page.getByRole('heading',{name:'記憶罐',exact:true})).toBeVisible();
  await expect(page.getByText('記憶罐仲係空嘅')).toBeVisible();
  await expect(page.locator('.jar-heading img')).toHaveAttribute('src',/memory-jar-empty/);
});

test('every home shortcut resolves to its intended preview screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');

  await page.getByRole('button',{name:'通知',exact:true}).click();
  await expect(page.getByRole('heading',{name:'通知',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'首頁',exact:true}).click();

  for(const label of ['今日精選','人氣組合','期間限定','30分鐘內可取']){
    await page.getByRole('button',{name:new RegExp(label)}).click();
    await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
    await page.getByRole('button',{name:'首頁',exact:true}).click();
  }

  await page.getByRole('button',{name:/查看全部/}).click();
  await expect(page.getByRole('heading',{name:'訂單',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'首頁',exact:true}).click();
  await page.locator('.recent-card').click();
  await expect(page.getByRole('heading',{name:'再來一單',exact:true})).toBeVisible();
});

test('all home entry points lead into the preview customer journey',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');

  await page.getByRole('button',{name:'店舖狀態：營業中'}).click();
  await expect(page.getByRole('dialog')).toContainText('今日營業時間');
  await page.getByRole('button',{name:'知道了'}).click();

  await page.getByRole('button',{name:'搜尋'}).click();
  await page.getByPlaceholder('搜尋餐點、食材或口味').fill('雞');
  await page.locator('.search-results>button').first().click();
  await expect(page.getByRole('heading',{name:'香草烤雞腿飯'})).toBeVisible();

  await page.getByRole('button',{name:/下一步/}).click();
  await page.getByRole('radio',{name:/配飲品/}).click();
  await page.getByRole('button',{name:/下一步/}).click();
  await page.getByRole('checkbox',{name:/加蛋/}).click();
  await page.getByRole('button',{name:'加入記憶罐'}).click();
  await expect(page.getByText('美味已收藏')).toBeVisible();
  await expect(page.locator('.jar-heading img')).toHaveAttribute('src',/memory-jar-partial/);

  await page.getByRole('button',{name:/繼續落單/}).click();
  await expect(page.getByRole('heading',{name:'取餐資料'})).toBeVisible();
  await page.getByRole('button',{name:/下一步/}).click();
  await expect(page.getByRole('heading',{name:'付款方式'})).toBeVisible();
  await page.getByRole('button',{name:/下一步/}).click();
  await expect(page.getByText('預覽模式：確認後只會展示流程，不會建立正式訂單或扣款。')).toBeVisible();
  await page.getByRole('button',{name:/確認送出/}).click();
  await expect(page.getByRole('heading',{name:'等候舖頭確認'})).toBeVisible();
  await expect(page.getByText('付款證明已提交')).toBeVisible();
  await expect(page.locator('.waiting-art img')).toHaveAttribute('src',/memory-jar-full/);

  await page.getByRole('button',{name:'訂單',exact:true}).click();
  await expect(page.getByRole('heading',{name:'訂單',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'我的',exact:true}).click();
  await expect(page.getByRole('heading',{name:'我的',exact:true})).toBeVisible();
});
