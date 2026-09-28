import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {createServer} from 'vite';

const ROOT=path.resolve(new URL('..',import.meta.url).pathname);
const observedAt='2026-09-28T12:10:00+08:00';
const snapshot={
  globalState:'FRESH',
  store:{storeId:'MF01',storeName:'磨飯－元朗',businessDate:'2026-09-28',operatingStatus:'營業中',observedAt,freshness:'CURRENT'},
  today:{salesLabel:'HK$ 6,842',orderCount:86,averageOrderLabel:'HK$ 79.6',comparisonLabel:'較上週同日 +12%',staffNow:3,scheduledStaffCount:4,onBreakStaffCount:0,abnormalStaffCount:0},
  insight:{topProductLabel:'紫米飯團 C · 18 份',currentHourTrendLabel:'午市較上週同日 +9%',observedAt,freshness:'CURRENT'},
  liveOrders:{activeCount:12,attentionCount:2,readyCount:4,observedAt,recentOrders:[]},
  dineIn:{activeCheckCount:3,unpaidCheckCount:2,estimatedOpenAmountLabel:'HK$ 246',includedInEffectiveSales:false,observedAt,openChecks:[]},
  readiness:[],
  actions:[
    {actionId:'a1',severity:'URGENT',domain:'CHANNEL',title:'Keeta 接單連接中斷',detail:'最近 7 分鐘未能正常接收新單。',target:'Keeta',certainty:'CONFIRMED',safeNextStepLabel:'查看渠道狀態',elapsedLabel:'7 分鐘',state:'OPEN',observedAt},
    {actionId:'a2',severity:'ATTENTION',domain:'PRINT',title:'製作單打印需要處理',detail:'其中一條打印路線未完成。',target:'訂單 002',certainty:'PARTIAL',safeNextStepLabel:'查看打印狀態',elapsedLabel:'4 分鐘',state:'OPEN',observedAt},
  ],
  orders:[],
  channels:[
    {channelId:'keeta',name:'Keeta',acceptingOrders:true,desiredState:'OPEN',observedState:'OPEN',health:'HEALTHY',mode:'NORMAL',cause:'provider',observedAt,freshness:'CURRENT',readback:'CONFIRMED',controls:{pause:true,resume:false,snooze:true,busy:true}},
    {channelId:'own',name:'自家網站／App',acceptingOrders:true,desiredState:'OPEN',observedState:'OPEN',health:'HEALTHY',mode:'NORMAL',cause:'policy',observedAt,freshness:'CURRENT',readback:'CONFIRMED',controls:{pause:true,resume:false,snooze:true,busy:true}},
  ],
  sellability:[],
  staff:[
    {staffId:'s1',loginId:'E001',name:'陳小明',role:'店長',presence:'在崗',schedule:'10:00–20:00',capabilitySummary:'店舖營運'},
    {staffId:'s2',loginId:'E002',name:'李小美',role:'廚房',presence:'在崗',schedule:'10:00–16:00',capabilitySummary:'廚房製作'},
  ],
  devices:[
    {deviceId:'d1',name:'SMT 主機',kind:'SMT',health:'HEALTHY',lastSeen:observedAt,binding:'店內主機',affected:'未見明確影響'},
    {deviceId:'d2',name:'SMM 平板',kind:'SMM_TABLET',health:'HEALTHY',lastSeen:observedAt,binding:'流動點餐',affected:'未見明確影響'},
    {deviceId:'d3',name:'收據打印機',kind:'PRINTER_RECEIPT',health:'HEALTHY',lastSeen:observedAt,binding:'收據',jobs:'待處理 0',affected:'未見明確影響'},
    {deviceId:'d4',name:'廚房打印機',kind:'PRINTER_PRODUCTION',health:'OFFLINE',lastSeen:'2026-09-28T11:58:00+08:00',binding:'廚房製作',jobs:'1 項需要處理',affected:'訂單 002'},
    {deviceId:'d5',name:'打包打印機',kind:'PRINTER_PACKING',health:'HEALTHY',lastSeen:observedAt,binding:'打包',jobs:'待處理 0',affected:'未見明確影響'},
    {deviceId:'d6',name:'商品 Label 機',kind:'LABEL',health:'DEGRADED',lastSeen:'2026-09-28T12:04:00+08:00',binding:'商品標籤',jobs:'1 項待確認',affected:'商品標籤'},
    {deviceId:'d7',name:'網絡路由器',kind:'ROUTER',health:'HEALTHY',lastSeen:observedAt,binding:'店內網絡',affected:'未見明確影響'},
  ],
  reports:[
    {reportId:'R1',name:'今日營業',value:'HK$ 6,842',compare:'較上週同日 +12%',freshness:'12:10 更新'},
    {reportId:'R2',name:'時段分析',value:'午市 +9%',compare:'較上週同日',freshness:'12:10 更新'},
    {reportId:'R3',name:'商品表現',value:'紫米飯團 C',compare:'18 份',freshness:'12:10 更新'},
    {reportId:'R4',name:'渠道表現',value:'店內 64%',compare:'外部渠道 36%',freshness:'12:10 更新'},
    {reportId:'R5',name:'付款方式',value:'FPS 46%',compare:'現金 31%',freshness:'12:10 更新'},
    {reportId:'R6',name:'交易調整',value:'HK$ 82',compare:'3 項',freshness:'12:10 更新'},
    {reportId:'R7',name:'員工與工時',value:'3 人',compare:'目前在崗',freshness:'12:10 更新'},
    {reportId:'R8',name:'營運健康',value:'2 項',compare:'需要留意',freshness:'12:10 更新'},
  ],
  campaigns:[],settlements:[],
  cash:{expectedLabel:'HK$ 1,840',actualLabel:'HK$ 1,820',varianceLabel:'-$20',closeoutState:'營業中',observedAt},
  inventory:[],notifications:[],
  activity:[
    {activityId:'h1',title:'渠道狀態已檢查',actor:'陳小明',actorStaffId:'s1',target:'Keeta',result:'仍需處理',detail:'等待店內跟進',observedAt},
    {activityId:'h2',title:'打印狀態已檢查',actor:'張大文',actorStaffId:'s3',target:'訂單 002',result:'部分完成',detail:'廚房打印需要處理',observedAt:'2026-09-28T12:06:00+08:00'},
    {activityId:'h3',title:'商品供應已更新',actor:'系統',target:'紫米飯團 C',result:'完成',detail:'目前已售罄',observedAt:'2026-09-28T12:02:00+08:00'},
  ],
  observedAt,
};
const session={staffId:'owner',loginId:'owner',displayName:'Panton',role:'OWNER',scope:'STORE',permissions:['OWNER_READ'],sessionToken:'x'.repeat(64)};

function chromePath(){
  return ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitJson(url,attempts=60){
  let last;
  for(let i=0;i<attempts;i++){
    try{const res=await fetch(url);if(res.ok)return await res.json();last=new Error('HTTP '+res.status)}catch(error){last=error}
    await sleep(100);
  }
  throw last??new Error('Chrome debugging endpoint unavailable');
}

function cdp(socketUrl){
  const ws=new WebSocket(socketUrl);
  let seq=0;
  const pending=new Map();
  const opened=new Promise((resolve,reject)=>{
    ws.addEventListener('open',()=>resolve());
    ws.addEventListener('error',event=>reject(event.error??new Error('WebSocket error')));
  });
  ws.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(!message.id)return;
    const waiter=pending.get(message.id);
    if(!waiter)return;
    pending.delete(message.id);
    if(message.error)waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  return {
    opened,
    send:async(method,params={})=>{
      await opened;
      const id=++seq;
      const promise=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
      ws.send(JSON.stringify({id,method,params}));
      return promise;
    },
    close:()=>ws.close(),
  };
}

async function waitText(client,textValue){
  for(let i=0;i<80;i++){
    const result=await client.send('Runtime.evaluate',{expression:'document.body&&document.body.innerText.includes('+JSON.stringify(textValue)+')',returnByValue:true});
    if(result?.result?.value===true)return;
    await sleep(100);
  }
  const body=await client.send('Runtime.evaluate',{expression:'document.body?document.body.innerText.slice(0,1200):"NO_BODY"',returnByValue:true});
  throw new Error('Rendered text not found: '+textValue+' | BODY: '+String(body?.result?.value??''));
}

test('Wave2 FINAL screens render at 390 and 440 with 360 minimum width', {timeout:90000}, async()=>{
  const chrome=chromePath();
  assert.ok(chrome,'Chrome/Chromium is required for rendered visual acceptance');
  const server=await createServer({root:ROOT,logLevel:'silent',server:{host:'127.0.0.1',port:0}});
  await server.listen();
  const address=server.httpServer.address();
  assert.ok(address&&typeof address==='object');
  const appPort=address.port;
  const browser=spawn(chrome,[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',
    '--user-data-dir=/tmp/mfk-owner-wave2-'+process.pid,'about:blank',
  ],{stdio:['ignore','ignore','pipe']});
  let browserError='';
  browser.stderr.on('data',chunk=>{browserError+=String(chunk)});
  try{
    let debugPort=0;
    for(let i=0;i<80;i++){
      const match=browserError.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if(match){debugPort=Number(match[1]);break}
      if(browser.exitCode!==null)throw new Error('Chrome exited before debug endpoint: '+browserError.slice(-1200));
      await sleep(100);
    }
    if(!debugPort)throw new Error('Chrome debug endpoint unavailable: '+browserError.slice(-1200));
    const res=await fetch('http://127.0.0.1:'+debugPort+'/json/new?about:blank',{method:'PUT'});
    if(!res.ok)throw new Error('Cannot create Chrome target '+res.status);
    const pageInfo=await res.json();
    const client=cdp(pageInfo.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    const initSource='window.__MFK_OWNER_PRODUCT_PORT__={portId:"MFK_OWNER_PORT_V1",readOwnerSession:async()=>('+JSON.stringify(session)+'),readSnapshot:async()=>('+JSON.stringify(snapshot)+'),readChannels:async()=>('+JSON.stringify(snapshot.channels)+'),readSellability:async()=>('+JSON.stringify(snapshot.sellability)+'),requestAdminDeepLink:async()=>({state:"NOT_CONNECTED",message:"Admin 導航暫未連接"})};';
    await client.send('Page.addScriptToEvaluateOnNewDocument',{source:initSource});

    const screens=[
      ['/devices','設備狀態','DEVICE'],
      ['/reports','固定報表','REPORTS'],
      ['/manager-log','經理日誌','MANAGER_LOG'],
      ['/activity','活動紀錄','ACTIVITY_AUDIT'],
      ['/more','磨飯－元朗','MORE'],
    ];
    for(const [route,needle,name] of screens){
      for(const width of [360,390,440]){
        await client.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
        await client.send('Page.navigate',{url:'http://127.0.0.1:'+appPort+route});
        await waitText(client,needle);
        const overflow=await client.send('Runtime.evaluate',{expression:'Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)',returnByValue:true});
        assert.ok((overflow?.result?.value??999)<=1,name+' horizontal overflow at '+width);
        if(width===390||width===440){
          const shot=await client.send('Page.captureScreenshot',{format:'jpeg',quality:62,fromSurface:true,captureBeyondViewport:false});
          assert.ok(shot?.data?.length>5000,name+' screenshot missing at '+width);
          console.log('WAVE2_RENDER_IMAGE|'+name+'_'+width+'|'+shot.data);
        }
      }
    }
    client.close();
  }finally{
    browser.kill('SIGTERM');
    await server.close();
  }
  assert.equal(browserError.includes("DevToolsActivePort file doesn't exist"),false);
});
