import type {AdminSessionDraft,ComboDraft,ComboPoolDraft} from './admin-draft.tsx';

export const COMBO_R3_POOL_SOURCE=Object.freeze({
  title:'自選飯糰套餐',
  source:'Owner correction after live Combo review',
  dated:'2026-09-22',
  rule:'飯糰係 Main Course；A/B/C/D 四個獨立飯糰 Pool；小食 + 飲品共用一個 Add-on Pool。',
});

const ricePool=(id:string,name:string,productIds:readonly string[]):ComboPoolDraft=>Object.freeze({
  id,
  name,
  kind:'MAIN_COURSE',
  active:true,
  position:10,
  groups:Object.freeze([Object.freeze({
    id:id+'-group',
    name:'選擇飯糰',
    required:true,
    min:1,
    max:1,
    position:10,
    bands:Object.freeze([
      Object.freeze({id:id+'-included',name:'餐內飯糰',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:10}),
    ]),
    choices:Object.freeze(productIds.map((productId,index)=>Object.freeze({
      id:id+'-choice-'+String(index+1).padStart(3,'0'),
      choiceType:'PRODUCT' as const,
      productId,
      label:'',
      bandId:id+'-included',
      priceAdjustment:'0.00',
      priceStatus:'READY' as const,
      active:true,
      position:(index+1)*10,
    }))),
  })]),
});

export const COMBO_R3_POOLS:readonly ComboPoolDraft[]=Object.freeze([
  ricePool('combo-rice-pool-a','飯糰 Pool A',[
    '929da914-3778-532d-92da-3fec9a65eff7',
    'accafec8-2462-53c8-93d3-3b24cca1ca5f',
    '26810c6e-f8ca-59e6-b571-711228f2871c',
    'e1626d77-5a19-5c7c-9f38-a217d02a6142',
  ]),
  ricePool('combo-rice-pool-b','飯糰 Pool B',[
    '68f9d065-af5c-516a-a687-8b5d55637a83',
    '28e42244-5734-5512-b650-a66ff3bc3904',
    '1fc3ea7c-8db3-585f-a7b7-50ff5d5bbb87',
    '23006a4e-1f5b-5381-b923-0e4360a523e0',
    '2e7e0e31-1975-5333-92b2-8bf48534c2bc',
    'e53b06c0-6a87-5981-9ade-741f0f633918',
    '3a152a4c-637f-5cdd-acd2-26b5b4564fba',
    '0a06405e-78a5-53df-800d-a898f2f43ed4',
    '98db68c1-9789-5460-9f53-abfcbc29ec63',
  ]),
  ricePool('combo-rice-pool-c','飯糰 Pool C',[
    '349760e8-d263-57bc-9afb-5e60309b4829',
    '8a68132d-9c60-532a-970f-4c16a7b94414',
    '28b754d6-2b6e-51fc-92bc-e2a1049cb654',
    '33ec73cb-cdd2-5810-959b-af1af51c9846',
    'b2888781-1a6d-529e-931b-aadd4ca1ca5f',
    '94c2a6b0-eb94-5139-a715-912c9e874ba0',
  ]),
  ricePool('combo-rice-pool-d','飯糰 Pool D',[
    'a0f8d44c-c747-5cdd-9308-426c59c6b0dc',
    '01e4ace6-c067-5fe4-9300-6c383ae18d94',
    'f07aad75-acfd-53c3-a7ed-2ee87e4b39c3',
    '8a0ae5e5-1fee-57dd-bf8c-26bd657e760f',
    '17ad2de2-32d5-53b7-9721-89fc154b9685',
    'c525e128-e197-54c6-91b2-0ccd6c691bca',
    '7ab2adc6-81bc-53ed-ab04-ab782032cbb4',
    '3e24f54e-177c-5f89-bc73-f5fda171329b',
  ]),
  Object.freeze({
    id:'combo-addon-pool-shared',
    name:'共用小食／飲品 Pool',
    kind:'ADDON',
    active:true,
    position:50,
    groups:Object.freeze([
      Object.freeze({
        id:'combo-addon-snack',
        name:'選擇小食',
        required:true,
        min:1,
        max:1,
        position:10,
        bands:Object.freeze([
          Object.freeze({id:'snack-free',name:'免費小食',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:10}),
          Object.freeze({id:'snack-plus-3',name:'升級 +$3',priceAdjustment:'3.00',priceStatus:'READY',active:true,position:20}),
          Object.freeze({id:'snack-plus-5',name:'升級 +$5',priceAdjustment:'5.00',priceStatus:'READY',active:true,position:30}),
        ]),
        choices:Object.freeze([
          {id:'snack-free-cucumber',choiceType:'PRODUCT',productId:'3a007232-991f-5da7-bbb2-71331c320a5a',label:'',bandId:'snack-free',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:10},
          {id:'snack-free-beef-ball',choiceType:'PRODUCT',productId:'c6642a22-f1be-55f4-98d7-8ec5c06751e4',label:'',bandId:'snack-free',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:20},
          {id:'snack-free-yellow-ball',choiceType:'PRODUCT',productId:'aa99e791-c869-5427-a77d-841857bb34d4',label:'',bandId:'snack-free',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:30},
          {id:'snack-free-purple-ball',choiceType:'PRODUCT',productId:'96e4c655-526b-5af0-a37d-b1afc850c68f',label:'',bandId:'snack-free',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:40},
          {id:'snack-free-coconut',choiceType:'PRODUCT',productId:'8898de73-ef5f-57a9-8cab-6bad4f833440',label:'',bandId:'snack-free',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:50},
          {id:'snack-free-rice-cake',choiceType:'PRODUCT',productId:'fc0ee180-4407-5821-92b3-83e60643ec1a',label:'',bandId:'snack-free',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:60},

          {id:'snack-3-broccoli',choiceType:'PRODUCT',productId:'0d4f854f-7175-5498-a426-53e8973df902',label:'',bandId:'snack-plus-3',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:70},
          {id:'snack-3-sausage',choiceType:'PRODUCT',productId:'bb5da156-0b50-5201-9686-4b5919706543',label:'',bandId:'snack-plus-3',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:80},
          {id:'snack-3-dumpling',choiceType:'PRODUCT',productId:'2f3ffbb1-86f3-5836-923d-881842e8c5bd',label:'',bandId:'snack-plus-3',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:90},
          {id:'snack-3-mochi',choiceType:'PRODUCT',productId:'f1fd8dbd-d0eb-5a67-ada5-676128684980',label:'',bandId:'snack-plus-3',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:100},
          {id:'snack-3-sweet-potato',choiceType:'PRODUCT',productId:'d55e70da-aa0f-5f3e-b909-861520cc7242',label:'',bandId:'snack-plus-3',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:110},
          {id:'snack-3-chive-tofu',choiceType:'PRODUCT',productId:'684a7b1b-7291-54bc-95b2-7c413dfa50a7',label:'',bandId:'snack-plus-3',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:120},
          {id:'snack-3-mushroom',choiceType:'PRODUCT',productId:'ad041d6d-f02a-52d6-babd-48d95d338634',label:'',bandId:'snack-plus-3',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:130},

          {id:'snack-5-salt-chicken',choiceType:'PRODUCT',productId:'01c3ed11-3656-5786-a46b-2d90ce1413d5',label:'',bandId:'snack-plus-5',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:140},
          {id:'snack-5-squid',choiceType:'PRODUCT',productId:'7d2da626-9ec1-5294-93b8-5a32fb79cde0',label:'',bandId:'snack-plus-5',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:150},
          {id:'snack-5-cumin-chicken',choiceType:'PRODUCT',productId:'96fed250-6653-5c88-a125-b004f0304251',label:'',bandId:'snack-plus-5',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:160},
          {id:'snack-5-capelin',choiceType:'PRODUCT',productId:'bb8619db-f62d-5a6e-a038-cd96c2293da5',label:'',bandId:'snack-plus-5',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:170},
          {id:'snack-5-heavenly-chicken',choiceType:'PRODUCT',productId:'49d581cb-cbb9-54d0-8c47-43cede6c5e8c',label:'',bandId:'snack-plus-5',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:180},
        ]),
      }),
      Object.freeze({
        id:'combo-addon-drink',
        name:'選擇飲品',
        required:true,
        min:1,
        max:1,
        position:20,
        bands:Object.freeze([
          Object.freeze({id:'drink-no-drink',name:'唔飲嘢 · 減價',priceAdjustment:'',priceStatus:'OWNER_VALUE_REQUIRED',active:true,position:10}),
          Object.freeze({id:'drink-hot-free',name:'熱飲 · $0',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:20}),
          Object.freeze({id:'drink-cold-plus-3',name:'熱檸茶／熱檸水轉凍 · +$3',priceAdjustment:'3.00',priceStatus:'READY',active:true,position:30}),
          Object.freeze({id:'drink-special-plus-6',name:'特飲 · +$6',priceAdjustment:'6.00',priceStatus:'READY',active:true,position:40}),
          Object.freeze({id:'drink-special-plus-8',name:'特飲 · +$8',priceAdjustment:'8.00',priceStatus:'READY',active:true,position:50}),
          Object.freeze({id:'drink-special-plus-10',name:'特飲 · +$10',priceAdjustment:'10.00',priceStatus:'READY',active:true,position:60}),
        ]),
        choices:Object.freeze([
          {id:'drink-none',choiceType:'NONE',label:'唔飲嘢',bandId:'drink-no-drink',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:10},
          // Current catalog 未有可安全一對一對應嘅「熱檸茶／熱檸水」，所以 $0 / +$3 bands 暫時留空，禁止製造假 Product。
          {id:'drink-6-puer',choiceType:'PRODUCT',productId:'02d54674-feb5-571d-b8ac-2668bd2fc1d5',label:'',bandId:'drink-special-plus-6',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:20},
          {id:'drink-6-genmaicha',choiceType:'PRODUCT',productId:'ad3fe24f-2617-52d3-8416-031269e5f122',label:'',bandId:'drink-special-plus-6',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:30},
          {id:'drink-6-limited',choiceType:'PRODUCT',productId:'28bc7c84-0e43-5e32-a5c1-ea78b25a0abc',label:'',bandId:'drink-special-plus-6',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:40},
          {id:'drink-6-sparkling',choiceType:'PRODUCT',productId:'bf2334d9-5ffb-5d7d-b454-279cc640a23d',label:'',bandId:'drink-special-plus-6',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:50},
          {id:'drink-8-milk-tea',choiceType:'PRODUCT',productId:'dcf1a976-ec1d-5d24-bc64-ab9d0a15fa02',label:'',bandId:'drink-special-plus-8',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:60},
          {id:'drink-10-lemon-tea',choiceType:'PRODUCT',productId:'b3529ce7-9b4e-5d20-9e1e-e4ef68319561',label:'',bandId:'drink-special-plus-10',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:70},
        ]),
      }),
    ]),
  }),
]);

export const COMBO_R3_COMBOS:readonly ComboDraft[]=Object.freeze([
  Object.freeze({id:'combo-rice-set-a',name:'自選飯糰 A 餐',active:true,basePrice:'41.00',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,mainPoolId:'combo-rice-pool-a',addonPoolIds:Object.freeze(['combo-addon-pool-shared']),sections:Object.freeze([])}),
  Object.freeze({id:'combo-rice-set-b',name:'自選飯糰 B 餐',active:true,basePrice:'43.00',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,mainPoolId:'combo-rice-pool-b',addonPoolIds:Object.freeze(['combo-addon-pool-shared']),sections:Object.freeze([])}),
  Object.freeze({id:'combo-rice-set-c',name:'自選飯糰 C 餐',active:true,basePrice:'45.00',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,mainPoolId:'combo-rice-pool-c',addonPoolIds:Object.freeze(['combo-addon-pool-shared']),sections:Object.freeze([])}),
  Object.freeze({id:'combo-rice-set-d',name:'自選飯糰 D 餐',active:true,basePrice:'47.00',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,mainPoolId:'combo-rice-pool-d',addonPoolIds:Object.freeze(['combo-addon-pool-shared']),sections:Object.freeze([])}),
]);

export function applyComboR3PoolSeed<T extends AdminSessionDraft>(draft:T):T{
  const retiredIds=new Set(['combo-poster-purple-rice-20260530']);
  const preserved=draft.combos.filter(combo=>!retiredIds.has(combo.id)&&!COMBO_R3_COMBOS.some(seed=>seed.id===combo.id));
  const poolIds=new Set(COMBO_R3_POOLS.map(pool=>pool.id));
  const preservedPools=(draft.comboPools??[]).filter(pool=>!poolIds.has(pool.id));
  return {
    ...draft,
    combos:[...preserved,...COMBO_R3_COMBOS],
    comboPools:[...preservedPools,...COMBO_R3_POOLS],
  };
}
