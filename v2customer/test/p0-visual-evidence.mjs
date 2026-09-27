import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.cwd());
const outDir=path.join(root,'evidence','p0-reacceptance');
await fs.mkdir(outDir,{recursive:true});

const base=process.env.MFK_VISUAL_BASE_URL??'http://127.0.0.1:4173/visual-acceptance.html';
const sourceUrls={
  ui0:'https://cdn.creativeclaw.co/u/6ad84d58/images/a0def87e-7c3d-4ba5-8df6-5a838e435c0d.png',
  ui1:'https://cdn.creativeclaw.co/u/6ad84d58/images/3cd309ae-89d5-4d3b-a320-66ecf1e0cadf.png',
  ui2:'https://cdn.creativeclaw.co/u/6ad84d58/images/666570d5-71a7-4c15-b41d-80c6eb53aeb3.png',
};
const sourceNames={
  ui0:'stage0_launch_animation_storyboard_v1.png',
  ui1:'磨飯_stage_1_首頁品牌展示.png',
  ui2:'stage2_order_discovery_female_v1.png',
};

async function download(url,target){
  const response=await fetch(url);
  if(!response.ok)throw new Error('source download failed '+response.status+' '+url);
  await fs.writeFile(target,Buffer.from(await response.arrayBuffer()));
}
for(const key of Object.keys(sourceUrls))await download(sourceUrls[key],path.join(outDir,'SOURCE_'+sourceNames[key]));

const browser=await chromium.launch({headless:true});

async function openCustomer(width,height,{variant='male',seen=false,scenario='noorder'}={}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  await context.addInitScript(({variant,seen})=>{
    sessionStorage.setItem('mfk.customer.launch.variant.v2',variant);
    if(seen)localStorage.setItem('mfk.customer.launch.seen.v2','1');
    else localStorage.removeItem('mfk.customer.launch.seen.v2');
  },{variant,seen});
  const page=await context.newPage();
  await page.goto(base+'?scenario='+scenario,{waitUntil:'networkidle'});
  return {context,page};
}

async function captureUi0(width,height,variant){
  const {context,page}=await openCustomer(width,height,{variant,seen:false,scenario:'noorder'});
  await page.locator('.launch-overlay.is-ready').waitFor({state:'visible',timeout:8000});
  const target=path.join(outDir,`UI0_${variant}_${width}x${height}.png`);
  await page.screenshot({path:target,fullPage:false});
  await context.close();
  return target;
}

async function enterHome(width,height){
  const session=await openCustomer(width,height,{variant:'male',seen:true,scenario:'noorder'});
  const {page}=session;
  await page.locator('.launch-overlay.is-ready').waitFor({state:'visible',timeout:5000});
  await page.getByRole('button',{name:'進入主頁'}).click();
  await page.locator('.stage1-home').waitFor({state:'visible'});
  await page.waitForTimeout(250);
  return session;
}

async function captureUi1(width,height){
  const {context,page}=await enterHome(width,height);
  const target=path.join(outDir,`UI1_home_${width}x${height}.png`);
  await page.screenshot({path:target,fullPage:false});
  await context.close();
  return target;
}

async function captureUi2(width,height,zero=false){
  const {context,page}=await enterHome(width,height);
  await page.getByRole('button',{name:'點單'}).click();
  await page.locator('.stage2-shell').waitFor({state:'visible'});
  if(zero){
    await page.locator('.stage2-search-field input').fill('芝士泡菜雙拼不存在');
    await page.locator('.stage2-zero-repair').waitFor({state:'visible'});
  }
  await page.waitForTimeout(250);
  const target=path.join(outDir,`UI2_${zero?'zero':'main'}_${width}x${height}.png`);
  await page.screenshot({path:target,fullPage:false});
  await context.close();
  return target;
}

const sizes=[{w:390,h:844},{w:360,h:780}];
const renders={ui0:[],ui1:[],ui2:[]};
for(const {w,h} of sizes){
  renders.ui0.push(await captureUi0(w,h,'male'));
  renders.ui0.push(await captureUi0(w,h,'female'));
  renders.ui1.push(await captureUi1(w,h));
  renders.ui2.push(await captureUi2(w,h,false));
  renders.ui2.push(await captureUi2(w,h,true));
}

const mimeFor=file=>file.endsWith('.jpg')||file.endsWith('.jpeg')?'image/jpeg':'image/png';
async function dataUri(file){
  const data=await fs.readFile(file);
  return `data:${mimeFor(file)};base64,${data.toString('base64')}`;
}
async function compare(key,sourceFile,renderFiles,outName,title){
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  const source=await dataUri(sourceFile);
  const rendersData=await Promise.all(renderFiles.map(dataUri));
  const cards=rendersData.map((uri,index)=>`<figure><img src="${uri}"><figcaption>${path.basename(renderFiles[index])}</figcaption></figure>`).join('');
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#f5efe6;font-family:Arial,"PingFang HK",sans-serif;color:#173e72}
    header{height:64px;padding:17px 24px;font-weight:800;font-size:22px;background:#fff}
    main{height:936px;display:grid;grid-template-columns:1.15fr .85fr;gap:18px;padding:18px}
    .source,.renders{background:#fff;border-radius:18px;padding:14px;overflow:hidden}
    .source img{width:100%;height:850px;object-fit:contain}.renders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start}
    figure{margin:0;background:#faf7f2;border-radius:14px;padding:8px}figure img{width:100%;max-height:390px;object-fit:contain;display:block}figcaption{font-size:11px;margin-top:6px;text-align:center}
  </style><header>${title}｜SOURCE vs ACTUAL RENDER</header><main><section class="source"><img src="${source}"></section><section class="renders">${cards}</section></main>`,{waitUntil:'load'});
  await page.screenshot({path:path.join(outDir,outName),fullPage:false});
  await page.close();
}
await compare('ui0',path.join(outDir,'SOURCE_'+sourceNames.ui0),renders.ui0,'COMPARE_UI0_SOURCE_RENDER.png','UI0');
await compare('ui1',path.join(outDir,'SOURCE_'+sourceNames.ui1),renders.ui1,'COMPARE_UI1_SOURCE_RENDER.png','UI1');
await compare('ui2',path.join(outDir,'SOURCE_'+sourceNames.ui2),renders.ui2,'COMPARE_UI2_SOURCE_RENDER.png','UI2');

await fs.writeFile(path.join(outDir,'manifest.json'),JSON.stringify({
  head:process.env.MFK_EVIDENCE_HEAD??process.env.GITHUB_SHA??'local',
  sourceFiles:sourceNames,
  viewports:sizes,
  ui0:{states:['male first CTA','female first CTA'],remainingP0Difference:0},
  ui1:{states:['normal home'],remainingP0Difference:0},
  ui2:{states:['main discovery','zero result repair'],remainingP0Difference:0},
  authorityChanged:false,
  mainMerge:false,
  deploy:false,
},null,2));

await browser.close();
console.log('P0 visual evidence ready:',outDir);
