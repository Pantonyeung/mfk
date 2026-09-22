import type {AdminSessionDraft,ComboDraft,ComboPoolDraft} from './admin-draft.tsx';
import {COMBO_R3_COMBOS,COMBO_R3_POOLS} from './admin-combo-pool-seed-r3.ts';

export const COMBO_R4_SOURCE=Object.freeze({
  source:'Owner final Combo pool clarification',
  dated:'2026-09-22',
  rule:'A/B/C/D main pools + separate shared Snack big pool + separate shared Drink big pool; each price child-pool owns its own choices.',
});

function correctedRicePools():readonly ComboPoolDraft[]{
  return COMBO_R3_POOLS
    .filter(pool=>pool.kind==='MAIN_COURSE')
    .map(pool=>Object.freeze({
      ...pool,
      groups:Object.freeze(pool.groups.map(group=>Object.freeze({
        ...group,
        bands:Object.freeze(group.bands.map(band=>Object.freeze({...band}))),
        choices:Object.freeze(group.choices.map(choice=>Object.freeze({
          ...choice,
          productId:choice.productId==='b2888781-1a6d-529e-931b-aadd4ca1ca5f'
            ?'b2888781-1a6d-529e-931b-aadd4ca1ca5f'
            :choice.productId,
        }))),
      }))),
    }));
}

const snackChoices=[
  {id:'snack-free-cucumber',productId:'3a007232-991f-5da7-bbb2-71331c320a5a',bandId:'snack-free'},
  {id:'snack-free-beef-ball',productId:'c6642a22-f1be-55f4-98d7-8ec5c06751e4',bandId:'snack-free'},
  {id:'snack-free-yellow-ball',productId:'aa99e791-c869-5427-a77d-841857bb34d4',bandId:'snack-free'},
  {id:'snack-free-purple-ball',productId:'96e4c655-526b-5af0-a37d-b1afc850c68f',bandId:'snack-free'},
  {id:'snack-free-coconut',productId:'8898de73-ef5f-57a9-8cab-6bad4f833440',bandId:'snack-free'},
  {id:'snack-free-rice-cake',productId:'fc0ee180-4407-5821-92b3-83e60643ec1a',bandId:'snack-free'},

  {id:'snack-3-broccoli',productId:'0d4f854f-7175-5498-a426-53e8973df902',bandId:'snack-plus-3'},
  {id:'snack-3-sausage',productId:'bb5da156-0b50-5201-9686-4b5919706543',bandId:'snack-plus-3'},
  {id:'snack-3-dumpling',productId:'2f3ffbb1-86f3-5836-923d-881842e8c5bd',bandId:'snack-plus-3'},
  {id:'snack-3-mochi',productId:'f1fd8dbd-d0eb-5a67-ada5-676128684980',bandId:'snack-plus-3'},
  {id:'snack-3-sweet-potato',productId:'d55e70da-aa0f-5f3e-b909-861520cc7242',bandId:'snack-plus-3'},
  {id:'snack-3-chive-tofu',productId:'684a7b1b-7291-54bc-95b2-7c413dfa50a7',bandId:'snack-plus-3'},
  {id:'snack-3-mushroom',productId:'ad041d6d-f02a-52d6-babd-48d95d338634',bandId:'snack-plus-3'},

  {id:'snack-5-salt-chicken',productId:'01c3ed11-3656-5786-a46b-2d90ce1413d5',bandId:'snack-plus-5'},
  {id:'snack-5-squid',productId:'7d2da626-9ec1-5294-93b8-5a32fb79cde0',bandId:'snack-plus-5'},
  {id:'snack-5-cumin-chicken',productId:'96fed250-6653-5c88-a125-b004f0304251',bandId:'snack-plus-5'},
  {id:'snack-5-capelin',productId:'bb8619db-f62d-5a6e-a038-cd96c2293da5',bandId:'snack-plus-5'},
  {id:'snack-5-heavenly-chicken',productId:'49d581cb-cbb9-54d0-8c47-43cede6c5e8c',bandId:'snack-plus-5'},
] as const;

const snackPool:ComboPoolDraft=Object.freeze({
  id:'combo-snack-pool-shared',
  name:'共用小食 Pool',
  kind:'ADDON',
  addonKind:'SNACK',
  active:true,
  position:50,
  groups:Object.freeze([Object.freeze({
    id:'combo-snack-group',
    name:'小食',
    required:true,
    min:1,
    max:1,
    position:10,
    bands:Object.freeze([
      Object.freeze({id:'snack-free',name:'免費小食 Pool',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:10}),
      Object.freeze({id:'snack-plus-3',name:'+$3 小食 Pool',priceAdjustment:'3.00',priceStatus:'READY',active:true,position:20}),
      Object.freeze({id:'snack-plus-5',name:'+$5 小食 Pool',priceAdjustment:'5.00',priceStatus:'READY',active:true,position:30}),
    ]),
    choices:Object.freeze(snackChoices.map((choice,index)=>Object.freeze({
      ...choice,
      choiceType:'PRODUCT' as const,
      label:'',
      priceAdjustment:'0.00',
      priceStatus:'READY' as const,
      active:true,
      position:(index+1)*10,
    }))),
  })]),
});

const drinkPool:ComboPoolDraft=Object.freeze({
  id:'combo-drink-pool-shared',
  name:'共用飲品 Pool',
  kind:'ADDON',
  addonKind:'DRINK',
  active:true,
  position:60,
  groups:Object.freeze([Object.freeze({
    id:'combo-drink-group',
    name:'飲品',
    required:true,
    min:1,
    max:1,
    position:10,
    bands:Object.freeze([
      Object.freeze({id:'drink-no-drink',name:'唔飲嘢 Pool',priceAdjustment:'-1.00',priceStatus:'READY',active:true,position:10}),
      Object.freeze({id:'drink-hot-free',name:'熱檸茶／熱檸水免費 Pool',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:20}),
      Object.freeze({id:'drink-cold-plus-3',name:'凍檸茶／凍檸水 +$3 Pool',priceAdjustment:'3.00',priceStatus:'READY',active:true,position:30}),
      Object.freeze({id:'drink-special-plus-6',name:'特飲 +$6 Pool',priceAdjustment:'6.00',priceStatus:'READY',active:true,position:40}),
      Object.freeze({id:'drink-special-plus-8',name:'特飲 +$8 Pool',priceAdjustment:'8.00',priceStatus:'READY',active:true,position:50}),
      Object.freeze({id:'drink-special-plus-10',name:'特飲 +$10 Pool',priceAdjustment:'10.00',priceStatus:'READY',active:true,position:60}),
    ]),
    choices:Object.freeze([
      Object.freeze({id:'drink-none',choiceType:'NONE' as const,label:'唔飲嘢',bandId:'drink-no-drink',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:10}),

      // Current catalog has no exact canonical rows for these four drinks. Keep explicit Combo-only LABEL choices instead of inventing Products.
      Object.freeze({id:'drink-hot-lemon-tea',choiceType:'LABEL' as const,label:'熱檸茶',bandId:'drink-hot-free',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:20}),
      Object.freeze({id:'drink-hot-lemon-water',choiceType:'LABEL' as const,label:'熱檸水',bandId:'drink-hot-free',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:30}),
      Object.freeze({id:'drink-cold-lemon-tea',choiceType:'LABEL' as const,label:'凍檸茶',bandId:'drink-cold-plus-3',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:40}),
      Object.freeze({id:'drink-cold-lemon-water',choiceType:'LABEL' as const,label:'凍檸水',bandId:'drink-cold-plus-3',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:50}),

      Object.freeze({id:'drink-6-genmaicha',choiceType:'PRODUCT' as const,productId:'ad3fe24f-2617-52d3-8416-031269e5f122',label:'',bandId:'drink-special-plus-6',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:60}),
      Object.freeze({id:'drink-6-puer',choiceType:'PRODUCT' as const,productId:'02d54674-feb5-571d-b8ac-2668bd2fc1d5',label:'',bandId:'drink-special-plus-6',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:70}),
      Object.freeze({id:'drink-6-limited',choiceType:'PRODUCT' as const,productId:'28bc7c84-0e43-5e32-a5c1-ea78b25a0abc',label:'',bandId:'drink-special-plus-6',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:80}),
      Object.freeze({id:'drink-6-sparkling',choiceType:'PRODUCT' as const,productId:'bf2334d9-5ffb-5d7d-b454-279cc640a23d',label:'',bandId:'drink-special-plus-6',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:90}),
      Object.freeze({id:'drink-8-milk-tea',choiceType:'PRODUCT' as const,productId:'dcf1a976-ec1d-5d24-bc64-ab9d0a15fa02',label:'',bandId:'drink-special-plus-8',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:100}),

      // Owner calls this 手打檸檬茶, but current catalog has no exact canonical Product row. Keep it explicit as a Combo-only LABEL choice.
      Object.freeze({id:'drink-10-handmade-lemon-tea',choiceType:'LABEL' as const,label:'手打檸檬茶',bandId:'drink-special-plus-10',priceAdjustment:'0.00',priceStatus:'READY' as const,active:true,position:110}),
    ]),
  })]),
});

export const COMBO_R4_POOLS:readonly ComboPoolDraft[]=Object.freeze([
  ...correctedRicePools(),
  snackPool,
  drinkPool,
]);

export const COMBO_R4_COMBOS:readonly ComboDraft[]=Object.freeze(
  COMBO_R3_COMBOS.map(combo=>Object.freeze({
    ...combo,
    addonPoolIds:Object.freeze(['combo-snack-pool-shared','combo-drink-pool-shared']),
  })),
);

export function applyComboR4NestedPoolSeed<T extends AdminSessionDraft>(draft:T):T{
  const comboIds=new Set(COMBO_R4_COMBOS.map(combo=>combo.id));
  const retiredPoolIds=new Set([
    'combo-addon-pool-shared',
    'combo-snack-pool-shared',
    'combo-drink-pool-shared',
    ...COMBO_R4_POOLS.filter(pool=>pool.kind==='MAIN_COURSE').map(pool=>pool.id),
  ]);
  const preservedCombos=draft.combos.filter(combo=>!comboIds.has(combo.id)&&combo.id!=='combo-poster-purple-rice-20260530');
  const preservedPools=(draft.comboPools??[]).filter(pool=>!retiredPoolIds.has(pool.id));
  return {
    ...draft,
    combos:[...preservedCombos,...COMBO_R4_COMBOS],
    comboPools:[...preservedPools,...COMBO_R4_POOLS],
  };
}
