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

    const metrics=await page.evaluate(()=>{
      const rect=(selector:string)=>document.querySelector(selector)?.getBoundingClientRect();
      return {
        viewportHeight:innerHeight,
        viewportWidth:innerWidth,
        documentHeight:document.documentElement.scrollHeight,
        documentWidth:document.documentElement.scrollWidth,
        hero:rect('.hero'),
        cta:rect('.hero-copy > button'),
        quickCards:[...document.querySelectorAll('.quick-card')].map(el=>el.getBoundingClientRect()),
        quickIcons:[...document.querySelectorAll('.quick-icon')].map(el=>el.getBoundingClientRect()),
        lifestyle:rect('.lifestyle'),
        recent:rect('.recent-card'),
        navButtons:[...document.querySelectorAll('nav button')].map(el=>el.getBoundingClientRect()),
      };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.hero?.height ?? 0).toBeGreaterThanOrEqual(metrics.viewportHeight*.60);
    expect(metrics.hero?.height ?? 0).toBeLessThanOrEqual(metrics.viewportHeight*.72);

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
    for(const button of metrics.navButtons){
      expect(button.height).toBeGreaterThanOrEqual(52);
      expect(button.width).toBeGreaterThanOrEqual(70);
    }
  });
}

test('primary home actions stay honest in preview',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');

  await expect(page.locator('.hero-copy > button')).toBeVisible();
  await expect(page.locator('.quick-card')).toHaveCount(4);
  await expect(page.locator('.lifestyle')).toBeVisible();
  await expect(page.locator('.featured-card')).toHaveCount(0);
  await expect(page.locator('.recent-card')).toBeVisible();
  await expect(page.locator('nav button')).toHaveCount(4);

  await page.locator('.quick-card').first().click();
  await expect(page.getByRole('status')).toContainText('預覽版未接駁');
});
