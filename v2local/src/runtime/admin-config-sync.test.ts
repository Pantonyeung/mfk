import {beforeEach,describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {
  SMT_ADMIN_CONFIG_LKG_KEY,
  SMT_ADMIN_CONFIG_STATUS_KEY,
  applyAdminConfigEnvelope,
  readSmtAdminConfigLkg,
  readSmtAdminSyncStatus,
} from './admin-config-sync.ts';
import {projectSyncedCombos,projectSyncedOrderingCatalog} from './admin-config-projection.ts';
import {capacityNoticeForCount,readSmtFrontlinePresentation,readSmtPrintConfig,readSmtQuickReasons,readSmtStoreSettings} from './admin-operational-config.ts';

function installStorage(){
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{
    configurable:true,
    value:{
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{values.set(key,String(value));},
      removeItem:(key:string)=>{values.delete(key);},
      clear:()=>values.clear(),
      key:(index:number)=>[...values.keys()][index]??null,
      get length(){return values.size;},
    },
  });
}

const snapshot={
  catalog:{
    categories:[{id:'cat-a',name:'主食',position:10,active:true}],
    products:[{
      id:'p1',name:'商品一',categoryId:'cat-a',active:true,basePrice:'10.00',
      takeawayAdjustment:'-0.50',takeawaySurchargeEnabled:true,legacySourcePosition:10,
    }],
    combos:[{
      id:'combo-a',name:'A餐',active:true,basePrice:'41.00',takeawayAdjustment:'0.00',
      mainPoolId:'main-a',addonPoolIds:['snack','drink'],sections:[],
    }],
    comboPools:[
      {id:'main-a',name:'主食A',kind:'MAIN_COURSE',active:true,position:10,groups:[{
        id:'main-g',name:'主食',required:true,min:1,max:1,position:10,
        bands:[{id:'main-free',name:'餐內',priceAdjustment:'0.00',active:true,position:10}],
        choices:[{id:'main-p1',choiceType:'PRODUCT',productId:'p1',label:'',bandId:'main-free',priceAdjustment:'0.00',active:true,position:10}],
      }]},
      {id:'snack',name:'小食',kind:'ADDON',addonKind:'SNACK',active:true,position:20,groups:[]},
      {id:'drink',name:'飲品',kind:'ADDON',addonKind:'DRINK',active:true,position:30,groups:[]},
    ],
  },
  optionCenter:{
    sets:[{
      id:'set-1',name:'份量',required:true,forceShow:true,selection:'SINGLE',min:1,max:1,allowQuantities:false,active:true,
      options:[
        {id:'normal',code:'NORMAL',name:'正常',priceAdjustment:'0.00',active:true,position:10},
        {id:'less',code:'LESS',name:'少啲',priceAdjustment:'-1.00',active:true,position:20},
      ],
    }],
    productLinks:[{productId:'p1',setId:'set-1',defaultOptionIds:['normal']}],
  },
  availability:{p1:{sellable:false,reason:'測試',updatedAt:'2026-09-22T09:00:00.000Z'}},
  businessDay:{cutoff:'05:00'},
  logicalPrinters:[
    {id:'logical-receipt',name:'收據機',type:'RECEIPT',active:true},
    {id:'logical-production',name:'製作單',type:'PRODUCTION',active:false},
  ],
  printTemplates:{receipt:'店名\n訂單編號'},
  printRules:{
    p1:{receipt:true,production:false,packing:true,label:false,dineIn:true,takeaway:false,labelPrinterIds:[]},
  },
  productMedia:{p1:{publicUrl:'https://example.test/p1.webp'}},
  storeSettings:{
    storeName:'磨飯測試店',storeCode:'MF01',currency:'HKD',timezone:'Asia/Hong_Kong',
    fulfillmentMinutes:18,lateArrivalMinutes:12,archiveHours:24,
    reminderAfterMinutes:4,reminderIntervalMinutes:3,repeatReminder:true,timeoutPriority:'URGENT',
    dineInEnabled:true,takeawayEnabled:false,paymentRefs:['CASH'],printRefs:['RECEIPT'],channelRefs:['KEETA'],
  },
  quickReasons:[
    {id:'cancel-1',scope:'CANCEL',label:'客人要求取消',active:true},
    {id:'cancel-off',scope:'CANCEL',label:'停用原因',active:false},
    {id:'reprint-1',scope:'REPRINT',label:'單據損壞',active:true},
  ],
  staff:[],
  channelPolicy:{},
  channelMapping:[],
  capacity:{dailyLimit:'100',warningAt:80,hardStop:true,note:'繁忙時段留意'},
  presentation:{
    frontline:{headline:'前線點單',showCategories:false,showImages:false,tabletColumns:5,mobileColumns:2,quickProductIds:['p1']},
  },
  inventory:[],
  loyalty:{},
  coupons:[],
  announcements:[],
} as const;

function envelope(revision:number,suffix=''){
  return createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision,
    publishedAt:'2026-09-22T09:00:0'+Math.min(9,revision)+'.000Z',
    adminFingerprint:'fnv1a32:admin'+revision,
    snapshot:suffix?{...snapshot,presentation:{suffix}}:snapshot,
  });
}

describe('SMT full Admin config LKG',()=>{
  beforeEach(()=>{
    installStorage();
    localStorage.removeItem(SMT_ADMIN_CONFIG_LKG_KEY);
    localStorage.removeItem(SMT_ADMIN_CONFIG_STATUS_KEY);
  });

  it('atomically applies a full Admin snapshot and survives readback',()=>{
    const row=envelope(2);
    const applied=applyAdminConfigEnvelope(row);
    expect(applied.disposition).toBe('APPLIED');
    expect(readSmtAdminConfigLkg()?.revision).toBe(2);
    expect(readSmtAdminConfigLkg()?.snapshot.storeSettings).toMatchObject({storeCode:'MF01',storeName:'磨飯測試店'});
    expect(readSmtAdminSyncStatus().state).toBe('SYNCED');
  });

  it('is idempotent, rejects same-revision conflicts, and ignores stale snapshots',()=>{
    const row=envelope(3);
    expect(applyAdminConfigEnvelope(row).disposition).toBe('APPLIED');
    expect(applyAdminConfigEnvelope(row).disposition).toBe('IDEMPOTENT');
    expect(applyAdminConfigEnvelope(envelope(2)).disposition).toBe('STALE');
    expect(()=>applyAdminConfigEnvelope(envelope(3,'different'))).toThrow('ADMIN_CONFIG_REVISION_CONFLICT');
    expect(readSmtAdminConfigLkg()?.revision).toBe(3);
  });

  it('projects remaining low-risk Admin operational settings into SMT consumers',()=>{
    const row=envelope(4);
    applyAdminConfigEnvelope(row);

    const store=readSmtStoreSettings();
    expect(store.storeName).toBe('磨飯測試店');
    expect(store.fulfillmentMinutes).toBe(18);
    expect(store.takeawayEnabled).toBe(false);
    expect(store.dineInEnabled).toBe(true);
    expect(store.timeoutPriority).toBe('URGENT');

    expect(readSmtQuickReasons('CANCEL').map(reason=>reason.label)).toEqual(['客人要求取消']);
    expect(readSmtQuickReasons('REPRINT').map(reason=>reason.label)).toEqual(['單據損壞']);

    const capacity=capacityNoticeForCount(80);
    expect(capacity).toMatchObject({dailyLimit:100,warningAt:80,currentCount:80,hardStopConfigured:true});
    expect(capacityNoticeForCount(79)).toBeNull();

    const presentation=readSmtFrontlinePresentation();
    expect(presentation.showCategories).toBe(false);
    expect(presentation.showImages).toBe(false);
    expect(presentation.quickProductIds).toEqual(['p1']);

    const print=readSmtPrintConfig();
    expect(print.logicalPrinters.map(row=>[row.id,row.active])).toEqual([
      ['logical-receipt',true],['logical-production',false],
    ]);
    expect(print.productRules.p1?.takeaway).toBe(false);
    expect(print.templateSpec.receipt).toBe('店名\n訂單編號');
  });

  it('projects Admin price, availability, Option Sets, media, and Combo pools into SMT',()=>{
    const row=envelope(4);
    applyAdminConfigEnvelope(row);

    const dineIn=projectSyncedOrderingCatalog('dine-in',row);
    const takeaway=projectSyncedOrderingCatalog('takeaway',row);
    expect(dineIn.categories).toEqual([{id:'cat-a',label:'主食',position:10}]);
    expect(dineIn.products[0]?.priceMinor).toBe(1000);
    expect(takeaway.products[0]?.priceMinor).toBe(1050);
    expect(takeaway.products[0]?.sellable).toBe(false);
    expect(takeaway.products[0]?.imageUrl).toBe('https://example.test/p1.webp');
    expect(takeaway.products[0]?.optionSets[0]?.name).toBe('份量');
    expect(takeaway.products[0]?.optionSets[0]?.options[1]?.priceAdjustmentMinor).toBe(-100);

    const combos=projectSyncedCombos(row);
    expect(combos.combos[0]?.name).toBe('A餐');
    expect(combos.combos[0]?.basePriceMinor).toBe(4100);
    expect(combos.pools.map(pool=>pool.id)).toEqual(['main-a','snack','drink']);
    expect(combos.pools[0]?.groups[0]?.subPools[0]?.choices[0]?.productId).toBe('p1');
  });
});
