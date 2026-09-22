import type {ComboDraft} from './admin-draft.tsx';

export const POSTER_COMBO_SOURCE=Object.freeze({
  title:'自選紫米套餐',
  source:'Owner supplied poster',
  dated:'2026-05-30',
  rule:'飯糰 + 小食 + 飲品，各 1 款',
});

export const POSTER_COMBO_SEED:ComboDraft=Object.freeze({
  id:'combo-poster-purple-rice-20260530',
  name:'自選紫米套餐',
  active:true,
  basePrice:'41.00',
  takeawayAdjustment:'0.00',
  takeawaySurchargeEnabled:false,
  sections:Object.freeze([
    Object.freeze({
      id:'combo-poster-riceball',
      name:'選擇飯糰',
      required:true,
      min:1,
      max:1,
      position:10,
      bands:Object.freeze([
        Object.freeze({id:'rice-set-a',name:'Set A · 茹素輕盈',priceAdjustment:'0.00',active:true,position:10}),
        Object.freeze({id:'rice-set-b',name:'Set B · 充滿元氣',priceAdjustment:'2.00',active:true,position:20}),
        Object.freeze({id:'rice-set-c',name:'Set C · 活力滿分',priceAdjustment:'4.00',active:true,position:30}),
        Object.freeze({id:'rice-set-d',name:'Set D · 店主推薦',priceAdjustment:'6.00',active:true,position:40}),
      ]),
      choices:Object.freeze([
        // Set A
        {id:'rice-a-original',productId:'929da914-3778-532d-92da-3fec9a65eff7',bandId:'rice-set-a',priceAdjustment:'0.00',active:true,position:10},
        {id:'rice-a-pineapple',productId:'accafec8-2462-53c8-93d3-3b24cca1ca5f',bandId:'rice-set-a',priceAdjustment:'0.00',active:true,position:20},
        {id:'rice-a-salted-egg',productId:'26810c6e-f8ca-59e6-b571-711228f2871c',bandId:'rice-set-a',priceAdjustment:'0.00',active:true,position:30},
        {id:'rice-a-cheese',productId:'e1626d77-5a19-5c7c-9f38-a217d02a6142',bandId:'rice-set-a',priceAdjustment:'0.00',active:true,position:40},
        // Set B
        {id:'rice-b-sesame-chicken',productId:'68f9d065-af5c-516a-a687-8b5d55637a83',bandId:'rice-set-b',priceAdjustment:'0.00',active:true,position:50},
        {id:'rice-b-wasabi-chicken',productId:'28e42244-5734-5512-b650-a66ff3bc3904',bandId:'rice-set-b',priceAdjustment:'0.00',active:true,position:60},
        {id:'rice-b-spicy-chicken',productId:'1fc3ea7c-8db3-585f-a7b7-50ff5d5bbb87',bandId:'rice-set-b',priceAdjustment:'0.00',active:true,position:70},
        {id:'rice-b-lemon-chicken',productId:'23006a4e-1f5b-5381-b923-0e4360a523e0',bandId:'rice-set-b',priceAdjustment:'0.00',active:true,position:80},
        {id:'rice-b-tuna',productId:'2e7e0e31-1975-5333-92b2-8bf48534c2bc',bandId:'rice-set-b',priceAdjustment:'0.00',active:true,position:90},
        {id:'rice-b-corned-beef',productId:'e53b06c0-6a87-5981-9ade-741f0f633918',bandId:'rice-set-b',priceAdjustment:'0.00',active:true,position:100},
        {id:'rice-b-mango-pineapple',productId:'3a152a4c-637f-5cdd-acd2-26b5b4564fba',bandId:'rice-set-b',priceAdjustment:'0.00',active:true,position:110},
        {id:'rice-b-jellyfish',productId:'0a06405e-78a5-53df-800d-a898f2f43ed4',bandId:'rice-set-b',priceAdjustment:'0.00',active:true,position:120},
        {id:'rice-b-kimchi',productId:'98db68c1-9789-5460-9f53-abfcbc29ec63',bandId:'rice-set-b',priceAdjustment:'0.00',active:true,position:130},
        // Set C
        {id:'rice-c-honey-mustard',productId:'349760e8-d263-57bc-9afb-5e60309b4829',bandId:'rice-set-c',priceAdjustment:'0.00',active:true,position:140},
        {id:'rice-c-fire-spicy',productId:'8a68132d-9c60-532a-970f-4c16a7b94414',bandId:'rice-set-c',priceAdjustment:'0.00',active:true,position:150},
        {id:'rice-c-cheese-kimchi',productId:'28b754d6-2b6e-51fc-92bc-e2a1049cb654',bandId:'rice-set-c',priceAdjustment:'0.00',active:true,position:160},
        {id:'rice-c-crab-stick',productId:'33ec73cb-cdd2-5810-959b-af1af51c9846',bandId:'rice-set-c',priceAdjustment:'0.00',active:true,position:170},
        {id:'rice-c-spicy-jellyfish',productId:'b2888781-1a6d-529e-931b-aadd4ca74194',bandId:'rice-set-c',priceAdjustment:'0.00',active:true,position:180},
        {id:'rice-c-crab-roe',productId:'94c2a6b0-eb94-5139-a715-912c9e874ba0',bandId:'rice-set-c',priceAdjustment:'0.00',active:true,position:190},
        // Set D
        {id:'rice-d-eel',productId:'a0f8d44c-c747-5cdd-9308-426c59c6b0dc',bandId:'rice-set-d',priceAdjustment:'0.00',active:true,position:200},
        {id:'rice-d-chicken',productId:'01e4ace6-c067-5fe4-9300-6c383ae18d94',bandId:'rice-set-d',priceAdjustment:'0.00',active:true,position:210},
        {id:'rice-d-capelin',productId:'f07aad75-acfd-53c3-a7ed-2ee87e4b39c3',bandId:'rice-set-d',priceAdjustment:'0.00',active:true,position:220},
        {id:'rice-d-conch',productId:'8a0ae5e5-1fee-57dd-bf8c-26bd657e760f',bandId:'rice-set-d',priceAdjustment:'0.00',active:true,position:230},
        {id:'rice-d-octopus',productId:'17ad2de2-32d5-53b7-9721-89fc154b9685',bandId:'rice-set-d',priceAdjustment:'0.00',active:true,position:240},
        {id:'rice-d-pepper-chicken',productId:'c525e128-e197-54c6-91b2-0ccd6c691bca',bandId:'rice-set-d',priceAdjustment:'0.00',active:true,position:250},
        {id:'rice-d-black-truffle',productId:'7ab2adc6-81bc-53ed-ab04-ab782032cbb4',bandId:'rice-set-d',priceAdjustment:'0.00',active:true,position:260},
        {id:'rice-d-tempura-shrimp',productId:'3e24f54e-177c-5f89-bc73-f5fda171329b',bandId:'rice-set-d',priceAdjustment:'0.00',active:true,position:270},
      ]),
    }),
    Object.freeze({
      id:'combo-poster-snack',
      name:'選擇小食',
      required:true,
      min:1,
      max:1,
      position:20,
      bands:Object.freeze([
        Object.freeze({id:'snack-included',name:'隨餐小食 · 套餐內含',priceAdjustment:'0.00',active:true,position:10}),
        Object.freeze({id:'snack-plus-3',name:'滋味升級 · +$3',priceAdjustment:'3.00',active:true,position:20}),
        Object.freeze({id:'snack-plus-5',name:'夯爆美味 · +$5',priceAdjustment:'5.00',active:true,position:30}),
      ]),
      choices:Object.freeze([
        {id:'snack-cucumber',productId:'3a007232-991f-5da7-bbb2-71331c320a5a',bandId:'snack-included',priceAdjustment:'0.00',active:true,position:10},
        {id:'snack-beef-ball',productId:'c6642a22-f1be-55f4-98d7-8ec5c06751e4',bandId:'snack-included',priceAdjustment:'0.00',active:true,position:20},
        {id:'snack-yellow-ball',productId:'aa99e791-c869-5427-a77d-841857bb34d4',bandId:'snack-included',priceAdjustment:'0.00',active:true,position:30},
        {id:'snack-purple-ball',productId:'96e4c655-526b-5af0-a37d-b1afc850c68f',bandId:'snack-included',priceAdjustment:'0.00',active:true,position:40},
        {id:'snack-coconut',productId:'8898de73-ef5f-57a9-8cab-6bad4f833440',bandId:'snack-included',priceAdjustment:'0.00',active:true,position:50},
        {id:'snack-rice-cake',productId:'fc0ee180-4407-5821-92b3-83e60643ec1a',bandId:'snack-included',priceAdjustment:'0.00',active:true,position:60},

        {id:'snack-broccoli',productId:'0d4f854f-7175-5498-a426-53e8973df902',bandId:'snack-plus-3',priceAdjustment:'0.00',active:true,position:70},
        {id:'snack-sausage',productId:'bb5da156-0b50-5201-9686-4b5919706543',bandId:'snack-plus-3',priceAdjustment:'0.00',active:true,position:80},
        {id:'snack-dumpling',productId:'2f3ffbb1-86f3-5836-923d-881842e8c5bd',bandId:'snack-plus-3',priceAdjustment:'0.00',active:true,position:90},
        {id:'snack-mochi',productId:'f1fd8dbd-d0eb-5a67-ada5-676128684980',bandId:'snack-plus-3',priceAdjustment:'0.00',active:true,position:100},
        {id:'snack-sweet-potato',productId:'d55e70da-aa0f-5f3e-b909-861520cc7242',bandId:'snack-plus-3',priceAdjustment:'0.00',active:true,position:110},
        {id:'snack-chive-tofu',productId:'684a7b1b-7291-54bc-95b2-7c413dfa50a7',bandId:'snack-plus-3',priceAdjustment:'0.00',active:true,position:120},
        {id:'snack-mushroom',productId:'ad041d6d-f02a-52d6-babd-48d95d338634',bandId:'snack-plus-3',priceAdjustment:'0.00',active:true,position:130},

        {id:'snack-salt-chicken',productId:'01c3ed11-3656-5786-a46b-2d90ce1413d5',bandId:'snack-plus-5',priceAdjustment:'0.00',active:true,position:140},
        {id:'snack-squid',productId:'7d2da626-9ec1-5294-93b8-5a32fb79cde0',bandId:'snack-plus-5',priceAdjustment:'0.00',active:true,position:150},
        {id:'snack-cumin-chicken',productId:'96fed250-6653-5c88-a125-b004f0304251',bandId:'snack-plus-5',priceAdjustment:'0.00',active:true,position:160},
        {id:'snack-capelin',productId:'bb8619db-f62d-5a6e-a038-cd96c2293da5',bandId:'snack-plus-5',priceAdjustment:'0.00',active:true,position:170},
        {id:'snack-heavenly-chicken',productId:'49d581cb-cbb9-54d0-8c47-43cede6c5e8c',bandId:'snack-plus-5',priceAdjustment:'0.00',active:true,position:180},
      ]),
    }),
    Object.freeze({
      id:'combo-poster-drink',
      name:'選擇飲品',
      required:true,
      min:1,
      max:1,
      position:30,
      bands:Object.freeze([
        // 海報有「隨餐飲品」及「升級加冰 +$3」，但 current catalog 未有可安全對應嘅熱檸水／熱檸茶 Product。
        Object.freeze({id:'drink-included',name:'隨餐飲品',priceAdjustment:'0.00',active:true,position:10}),
        Object.freeze({id:'drink-plus-3',name:'升級加冰 · +$3',priceAdjustment:'3.00',active:true,position:20}),
        Object.freeze({id:'drink-plus-6',name:'暢飲升級 · +$6',priceAdjustment:'6.00',active:true,position:30}),
        Object.freeze({id:'drink-plus-8',name:'夯爆升級 · +$8',priceAdjustment:'8.00',active:true,position:40}),
        Object.freeze({id:'drink-plus-10',name:'夯爆升級 · +$10',priceAdjustment:'10.00',active:true,position:50}),
      ]),
      choices:Object.freeze([
        {id:'drink-puer',productId:'02d54674-feb5-571d-b8ac-2668bd2fc1d5',bandId:'drink-plus-6',priceAdjustment:'0.00',active:true,position:10},
        {id:'drink-genmaicha',productId:'ad3fe24f-2617-52d3-8416-031269e5f122',bandId:'drink-plus-6',priceAdjustment:'0.00',active:true,position:20},
        {id:'drink-limited-tea',productId:'28bc7c84-0e43-5e32-a5c1-ea78b25a0abc',bandId:'drink-plus-6',priceAdjustment:'0.00',active:true,position:30},
        {id:'drink-sparkling',productId:'bf2334d9-5ffb-5d7d-b454-279cc640a23d',bandId:'drink-plus-6',priceAdjustment:'0.00',active:true,position:40},
        {id:'drink-milk-tea',productId:'dcf1a976-ec1d-5d24-bc64-ab9d0a15fa02',bandId:'drink-plus-8',priceAdjustment:'0.00',active:true,position:50},
        // Current catalog 「爆檸·檸茶」係 poster 手打檸檬茶位最接近嘅 canonical Product；保留 canonical 名稱，唔改 Product identity。
        {id:'drink-lemon-tea',productId:'b3529ce7-9b4e-5d20-9e1e-e4ef68319561',bandId:'drink-plus-10',priceAdjustment:'0.00',active:true,position:60},
      ]),
    }),
  ]),
});

export function addPosterComboSeed<T extends {readonly combos:readonly ComboDraft[]}>(draft:T):T{
  if(draft.combos.some(combo=>combo.id===POSTER_COMBO_SEED.id))return draft;
  return {...draft,combos:[...draft.combos,POSTER_COMBO_SEED]} as T;
}
