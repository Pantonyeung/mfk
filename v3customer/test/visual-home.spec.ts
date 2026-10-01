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
      const quickCards=[...document.querySelectorAll('.quick-card')].map(el=>el.getBoundingClientRect());
      const navButtons=[...document.querySelectorAll('nav button')].map(el=>el.getBoundingClientRect());
      const cta=document.querySelector('.hero-copy > button')?.getBoundingClientRect();

      return {
        viewportHeight:innerHeight,
        viewportWidth:innerWidth,
        documentHeight:document.documentElement.scrollHeight,
        documentWidth:document.documentElement.scrollWidth,
        hero:rect('.hero'),
        cta,
        quickCards,
        navButtons,
      };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.hero?.height ?? 0).toBeGreaterThanOrEqual(metrics.viewportHeight*0.60);
    expect(metrics.hero?.height ?? 0).toBeLessThanOrEqual(metrics.viewportHeight*0.72);

    const pageScreens=metrics.documentHeight/metrics.viewportHeight;
    expect(pageScreens).toBeGreaterThanOrEqual(1.40);
    expect(pageScreens).toBeLessThanOrEqual(1.62);

    expect(metrics.cta?.height ?? 0).toBeGreaterThanOrEqual(48);

    for(const card of metrics.quickCards){
      expect(card.height).toBeGreaterThanOrEqual(100);
      expect(card.width).toBeGreaterThanOrEqual(150);
    }

    for(const button of metrics.navButtons){
      expect(button.height).toBeGreaterThanOrEqual(52);
    }
  });
}

test('primary home actions are direct taps',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');

  await expect(page.locator('.hero-copy > button')).toBeVisible();
  await expect(page.locator('.quick-card')).toHaveCount(4);
  await expect(page.locator('.featured-card')).toHaveCount(2);
  await expect(page.locator('.recent-card')).toBeVisible();
  await expect(page.locator('nav button')).toHaveCount(4);
});
