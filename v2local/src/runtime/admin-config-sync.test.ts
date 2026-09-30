import {beforeEach,describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../../contracts/admin-config-sync-v1.ts';
import {
  SMT_ADMIN_CONFIG_LKG_KEY,
  SMT_ADMIN_CONFIG_STATUS_KEY,
  SMT_ADMIN_TIME_FIRST_CUTOVER_KEY,
  applyAdminConfigEnvelope,
  clearLegacySmtAdminConfigForTimeFirstCutover,
  readSmtAdminConfigLkg,
  readSmtAdminSyncStatus,
} from './admin-config-sync.ts';
import {projectSyncedCombos,projectSyncedOrderingCatalog} from './admin-config-projection.ts';
import {normalizeRuntimeAvailabilityForBusinessDay} from './local-runtime.ts';
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

  it('is idempotent, rejects same-time conflicts, and ignores older publish times',()=>{
    const row=envelope(3);
    expect(applyAdminConfigEnvelope(row).disposition).toBe('APPLIED');
    expect(applyAdminConfigEnvelope(row).disposition).toBe('IDEMPOTENT');
    expect(applyAdminConfigEnvelope(envelope(2)).disposition).toBe('STALE');
    expect(()=>applyAdminConfigEnvelope(envelope(3,'different'))).toThrow('ADMIN_CONFIG_PUBLISHED_AT_CONFLICT');
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

  it('projects Admin price/config while SMT runtime availability remains locally authoritative',()=>{
    const row=envelope(4);
    applyAdminConfigEnvelope(row);

    const dineIn=projectSyncedOrderingCatalog('dine-in',row);
    const takeaway=projectSyncedOrderingCatalog('takeaway',row);
    expect(dineIn.categories).toEqual([{id:'cat-a',label:'主食',position:10}]);
    expect(dineIn.products[0]?.priceMinor).toBe(1000);
    expect(takeaway.products[0]?.priceMinor).toBe(1050);
    // Admin snapshot.availability is no longer the store-runtime sold-out authority.
    expect(takeaway.products[0]?.sellable).toBe(true);
    localStorage.setItem('mfk.v2local.runtime.v1',JSON.stringify({orders:[],holds:[],availability:{p1:'soldout'}}));
    expect(projectSyncedOrderingCatalog('takeaway',row).products[0]?.sellable).toBe(false);
    const disabledRow=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:5,publishedAt:'2026-09-22T09:00:05.000Z',adminFingerprint:'fnv1a32:admin5',
      snapshot:{...snapshot,catalog:{...snapshot.catalog,products:snapshot.catalog.products.map(product=>({...product,active:false}))}},
    });
    expect(projectSyncedOrderingCatalog('takeaway',disabledRow).products).toHaveLength(0);
    expect(takeaway.products[0]?.imageUrl).toBe('https://example.test/p1.webp');
    expect(takeaway.products[0]?.optionSets[0]?.name).toBe('份量');
    expect(takeaway.products[0]?.optionSets[0]?.options[1]?.priceAdjustmentMinor).toBe(-100);

    const combos=projectSyncedCombos(row);
    expect(combos.combos[0]?.name).toBe('A餐');
    expect(combos.combos[0]?.basePriceMinor).toBe(4100);
    expect(combos.pools.map(pool=>pool.id)).toEqual(['main-a','snack','drink']);
    expect(combos.pools[0]?.groups[0]?.subPools[0]?.choices[0]?.productId).toBe('p1');
  });
  it('resets SOLD_OUT at next Business Day but preserves PAUSED',()=>{
    expect(normalizeRuntimeAvailabilityForBusinessDay(
      {p1:'soldout',p2:'paused',p3:'available'},'2026-09-28','2026-09-29',
    )).toEqual({p1:'available',p2:'paused',p3:'available'});
    expect(normalizeRuntimeAvailabilityForBusinessDay(
      {p1:'soldout',p2:'paused'},'2026-09-29','2026-09-29',
    )).toEqual({p1:'soldout',p2:'paused'});
  });

  it('rejects a late replay whose canonical publishedAt is older than the active release',()=>{
    const r11=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:11,publishedAt:'2026-09-29T03:00:00.000Z',adminFingerprint:'admin-r11',
      snapshot:{catalog:{products:[]}},
    });
    const r12=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:12,publishedAt:'2026-09-29T04:00:00.000Z',adminFingerprint:'admin-r12',
      snapshot:{catalog:{products:[]}},
    });
    expect(applyAdminConfigEnvelope(r11).disposition).toBe('APPLIED');
    expect(applyAdminConfigEnvelope(r12).disposition).toBe('APPLIED');
    expect(applyAdminConfigEnvelope(r11)).toMatchObject({disposition:'STALE',revision:12});
    expect(readSmtAdminConfigLkg()?.revision).toBe(12);
    expect(readSmtAdminConfigLkg()?.publishedAt).toBe('2026-09-29T04:00:00.000Z');
  });

  it('rejects a numerically newer revision carrying an older canonical publish time',()=>{
    const current=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:20,publishedAt:'2026-09-29T05:00:00.000Z',adminFingerprint:'admin-r20',
      snapshot:{catalog:{products:[]}},
    });
    const impossible=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:21,publishedAt:'2026-09-29T04:59:59.000Z',adminFingerprint:'admin-r21',
      snapshot:{catalog:{products:[]}},
    });
    expect(applyAdminConfigEnvelope(current).disposition).toBe('APPLIED');
    expect(applyAdminConfigEnvelope(impossible)).toMatchObject({disposition:'STALE',revision:20});
  });

  it('applies a lower diagnostic revision when its canonical publish time is newer',()=>{
    const older=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:23,publishedAt:'2026-09-29T05:00:00.000Z',adminFingerprint:'admin-old',
      snapshot:{catalog:{products:[{id:'old'}]}},
    });
    const newer=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:22,publishedAt:'2026-09-29T06:00:00.000Z',adminFingerprint:'admin-new',
      snapshot:{catalog:{products:[{id:'new'}]}},
    });
    expect(applyAdminConfigEnvelope(older).disposition).toBe('APPLIED');
    expect(applyAdminConfigEnvelope(newer)).toMatchObject({disposition:'APPLIED',revision:22});
    expect(readSmtAdminConfigLkg()?.publishedAt).toBe('2026-09-29T06:00:00.000Z');
    expect((readSmtAdminConfigLkg()?.snapshot.catalog as {products?:{id:string}[]}).products?.[0]?.id).toBe('new');
  });

  it('clears the legacy SMT Admin LKG exactly once without touching transaction storage',()=>{
    const old=createMfkAdminConfigEnvelope({
      storeId:'MF01',revision:23,publishedAt:'2026-09-29T05:00:00.000Z',adminFingerprint:'admin-r23',
      snapshot:{catalog:{products:[{id:'old'}]}},
    });
    localStorage.setItem(SMT_ADMIN_CONFIG_LKG_KEY,JSON.stringify(old));
    localStorage.setItem(SMT_ADMIN_CONFIG_STATUS_KEY,JSON.stringify({state:'SYNCED',revision:23,fingerprint:old.fingerprint,updatedAt:old.publishedAt}));
    localStorage.setItem('mfk.v2local.runtime.v1',JSON.stringify({orders:[{id:'ORDER-1'}],holds:[],availability:{}}));

    expect(clearLegacySmtAdminConfigForTimeFirstCutover()).toBe(true);
    expect(localStorage.getItem(SMT_ADMIN_CONFIG_LKG_KEY)).toBeNull();
    expect(localStorage.getItem(SMT_ADMIN_CONFIG_STATUS_KEY)).toBeNull();
    expect(localStorage.getItem('mfk.v2local.runtime.v1')).toContain('ORDER-1');
    expect(localStorage.getItem(SMT_ADMIN_TIME_FIRST_CUTOVER_KEY)).toContain('admin-r23');

    localStorage.setItem(SMT_ADMIN_CONFIG_LKG_KEY,JSON.stringify(old));
    expect(clearLegacySmtAdminConfigForTimeFirstCutover()).toBe(false);
    expect(localStorage.getItem(SMT_ADMIN_CONFIG_LKG_KEY)).not.toBeNull();
  });

});
