import {expect,test} from '@playwright/test';

const widths=[
  {name:'360',width:360,height:800},
  {name:'390',width:390,height:844},
  {name:'412',width:412,height:915},
  {name:'430',width:430,height:932},
] as const;

for(const size of widths){
  test(`long home visual ${size.name}`,async({page})=>{
    await page.setViewportSize({width:size.width,height:size.height});
    await page.goto('/');
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('.shell')).toBeVisible();
    await expect(page).toHaveScreenshot(`long-home-${size.name}.png`,{
      fullPage:true,
      animations:'disabled',
      maxDiffPixelRatio:0.05,
    });
  });
}

test('long home has no horizontal page scroll',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  expect(overflow).toBeFalsy();
});
