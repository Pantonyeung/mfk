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
  logicalPrinters:[],
  printTemplates:{},
  printRules:{},
  productMedia:{p1:{publicUrl:'https://example.test/p1.webp'}},
  storeSettings:{storeCode:'MF01'},
  quickReasons:[],
  staff:[],
  channelPolicy:{},
  channelMapping:[],
  capacity:{},
  presentation:{},
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
    expect(readSmtAdminConfigLkg()?.snapshot.storeSettings).toEqual({storeCode:'MF01'});
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
