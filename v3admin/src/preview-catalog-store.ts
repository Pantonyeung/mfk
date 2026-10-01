import {create} from 'zustand';

export type PreviewProductStatus='已發佈'|'草稿'|'待回讀'|'已停用';
export type PreviewOptionSelection='SINGLE'|'MULTI';

export interface PreviewProduct{
  id:string;
  name:string;
  code:string;
  category:string;
  priceMinor:number;
  status:PreviewProductStatus;
  printRule:string;
  updatedAt:string;
  description:string;
  customerImageUrl:string;
  channelImages:Readonly<Record<string,string>>;
  optionSetIds:readonly string[];
}

export interface PreviewOption{
  id:string;
  code:string;
  name:string;
  priceAdjustmentMinor:number;
  active:boolean;
}

export interface PreviewOptionSet{
  id:string;
  name:string;
  required:boolean;
  selection:PreviewOptionSelection;
  min:number;
  max:number;
  active:boolean;
  options:readonly PreviewOption[];
}

export interface PreviewComboChoice{
  id:string;
  productId?:string;
  label?:string;
  priceAdjustmentMinor:number;
  active:boolean;
}

export interface PreviewComboGroup{
  id:string;
  name:string;
  required:boolean;
  min:number;
  max:number;
  choices:readonly PreviewComboChoice[];
}

export interface PreviewCombo{
  id:string;
  name:string;
  active:boolean;
  basePriceMinor:number;
  groups:readonly PreviewComboGroup[];
}

export interface PreviewDiningTable{
  id:string;
  name:string;
  active:boolean;
  sortOrder:number;
  seats:number;
  area:string;
}

export const PREVIEW_PRODUCTS:PreviewProduct[]=[
  {id:'p-001',name:'紫米飯糰・照燒雞',code:'PRD000123',category:'飯糰',priceMinor:4200,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:42',description:'照燒雞配紫米飯糰。',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-002',name:'紫米飯糰・吞拿魚',code:'PRD000124',category:'飯糰',priceMinor:4000,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:41',description:'吞拿魚紫米飯糰。',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-003',name:'紫米飯糰・雞蛋沙律',code:'PRD000125',category:'飯糰',priceMinor:3800,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:40',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-004',name:'紫米飯糰・照燒牛肉',code:'PRD000126',category:'飯糰',priceMinor:4400,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:39',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-005',name:'紫米飯糰・鹽麴雞',code:'PRD000127',category:'飯糰',priceMinor:4200,status:'草稿',printRule:'製作單＋標籤',updatedAt:'今日 08:38',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-006',name:'紫米飯糰・粟米蟹柳',code:'PRD000128',category:'飯糰',priceMinor:3900,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:37',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-007',name:'紫米飯糰・日式咖喱雞',code:'PRD000129',category:'飯糰',priceMinor:4300,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:36',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-008',name:'紫米飯糰・芝士雞肉',code:'PRD000130',category:'飯糰',priceMinor:4400,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:35',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-009',name:'紫米飯糰・泡菜豬肉',code:'PRD000131',category:'飯糰',priceMinor:4500,status:'待回讀',printRule:'製作單＋標籤',updatedAt:'今日 08:34',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-010',name:'紫米飯糰・味噌三文魚',code:'PRD000132',category:'飯糰',priceMinor:4800,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:33',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-011',name:'紫米飯糰・黑椒牛肉',code:'PRD000133',category:'飯糰',priceMinor:4600,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:32',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-012',name:'紫米飯糰・南瓜雜菜',code:'PRD000134',category:'飯糰',priceMinor:3600,status:'已發佈',printRule:'製作單＋標籤',updatedAt:'今日 08:31',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice']},
  {id:'p-013',name:'香煎雞扒紫米飯',code:'PRD000135',category:'飯類',priceMinor:5200,status:'已發佈',printRule:'製作單＋打包單',updatedAt:'今日 08:29',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-rice','set-spice']},
  {id:'p-014',name:'無糖凍檸茶',code:'PRD000136',category:'茶飲',priceMinor:1800,status:'待回讀',printRule:'標籤',updatedAt:'昨日 21:06',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-ice']},
  {id:'p-015',name:'鹽酥雞小食',code:'PRD000137',category:'小食',priceMinor:2800,status:'草稿',printRule:'製作單',updatedAt:'今日 08:18',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:['set-spice']},
  {id:'p-016',name:'南瓜粟米湯',code:'PRD000138',category:'湯品',priceMinor:2600,status:'已停用',printRule:'製作單',updatedAt:'昨日 19:24',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:[]},
  {id:'p-017',name:'紫米豆乳布甸',code:'PRD000139',category:'甜品',priceMinor:2400,status:'已發佈',printRule:'打包單',updatedAt:'昨日 17:51',description:'',customerImageUrl:'',channelImages:{KEETA:''},optionSetIds:[]},
];

const OPTION_SETS:PreviewOptionSet[]=[
  {id:'set-rice',name:'飯量',required:true,selection:'SINGLE',min:1,max:1,active:true,options:[
    {id:'rice-normal',code:'RICE-N',name:'正常飯量',priceAdjustmentMinor:0,active:true},
    {id:'rice-less',code:'RICE-L',name:'少飯',priceAdjustmentMinor:0,active:true},
    {id:'rice-more',code:'RICE-M',name:'加飯',priceAdjustmentMinor:500,active:true},
  ]},
  {id:'set-spice',name:'辣度',required:false,selection:'SINGLE',min:0,max:1,active:true,options:[
    {id:'spice-none',code:'SP-0',name:'唔辣',priceAdjustmentMinor:0,active:true},
    {id:'spice-mid',code:'SP-1',name:'少辣',priceAdjustmentMinor:0,active:true},
    {id:'spice-hot',code:'SP-2',name:'大辣',priceAdjustmentMinor:0,active:true},
  ]},
  {id:'set-ice',name:'冰量',required:true,selection:'SINGLE',min:1,max:1,active:true,options:[
    {id:'ice-normal',code:'ICE-N',name:'正常冰',priceAdjustmentMinor:0,active:true},
    {id:'ice-less',code:'ICE-L',name:'少冰',priceAdjustmentMinor:0,active:true},
    {id:'ice-none',code:'ICE-0',name:'走冰',priceAdjustmentMinor:0,active:true},
  ]},
];

const DINING_TABLES:PreviewDiningTable[]=[
  {id:'T01',name:'1號枱',active:true,sortOrder:10,seats:2,area:'前場'},
  {id:'T02',name:'2號枱',active:true,sortOrder:20,seats:2,area:'前場'},
  {id:'T03',name:'3號枱',active:true,sortOrder:30,seats:4,area:'前場'},
  {id:'T04',name:'4號枱',active:true,sortOrder:40,seats:4,area:'後場'},
];

const COMBOS:PreviewCombo[]=[
  {id:'combo-lunch',name:'磨飯午市套餐',active:true,basePriceMinor:6800,groups:[
    {id:'combo-lunch-main',name:'主食',required:true,min:1,max:1,choices:[
      {id:'combo-main-1',productId:'p-013',priceAdjustmentMinor:0,active:true},
      {id:'combo-main-2',productId:'p-001',priceAdjustmentMinor:-800,active:true},
    ]},
    {id:'combo-lunch-drink',name:'飲品',required:true,min:1,max:1,choices:[
      {id:'combo-drink-1',productId:'p-014',priceAdjustmentMinor:0,active:true},
      {id:'combo-drink-none',label:'唔要飲品',priceAdjustmentMinor:-500,active:true},
    ]},
  ]},
];

function nextNumericCode(products:readonly PreviewProduct[]){
  const highest=products.reduce((max,item)=>{
    const match=/^PRD(\d+)$/.exec(item.code);
    return match?Math.max(max,Number(match[1])):max;
  },0);
  return 'PRD'+String(highest+1).padStart(6,'0');
}

function uid(prefix:string){
  return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
}

interface PreviewCatalogState{
  products:PreviewProduct[];
  optionSets:PreviewOptionSet[];
  combos:PreviewCombo[];
  diningTables:PreviewDiningTable[];
  createProduct(input:Omit<PreviewProduct,'id'|'code'|'updatedAt'|'status'>):PreviewProduct;
  updateProduct(id:string,patch:Partial<Omit<PreviewProduct,'id'|'code'>>):void;
  updateProductCustomerImage(id:string,url:string):void;
  updateProductChannelImage(id:string,channel:string,url:string):void;
  toggleProductOptionSet(productId:string,setId:string,enabled:boolean):void;
  createOptionSet():PreviewOptionSet;
  updateOptionSet(id:string,patch:Partial<Omit<PreviewOptionSet,'id'|'options'>>):void;
  addOption(setId:string):void;
  updateOption(setId:string,optionId:string,patch:Partial<Omit<PreviewOption,'id'>>):void;
  removeOption(setId:string,optionId:string):void;
  createCombo():PreviewCombo;
  updateCombo(id:string,patch:Partial<Omit<PreviewCombo,'id'|'groups'>>):void;
  addComboGroup(comboId:string):void;
  updateComboGroup(comboId:string,groupId:string,patch:Partial<Omit<PreviewComboGroup,'id'|'choices'>>):void;
  addComboChoice(comboId:string,groupId:string):void;
  updateComboChoice(comboId:string,groupId:string,choiceId:string,patch:Partial<Omit<PreviewComboChoice,'id'>>):void;
  removeComboChoice(comboId:string,groupId:string,choiceId:string):void;
  createDiningTable():PreviewDiningTable;
  updateDiningTable(id:string,patch:Partial<Omit<PreviewDiningTable,'id'>>):void;
  removeDiningTable(id:string):void;
}

export const usePreviewCatalog=create<PreviewCatalogState>((set,get)=>({
  products:[...PRODUCTS],
  optionSets:[...OPTION_SETS],
  combos:[...COMBOS],
  diningTables:[...DINING_TABLES],
  createProduct(input){
    const products=get().products;
    const product:PreviewProduct={
      ...input,
      id:uid('product'),
      code:nextNumericCode(products),
      updatedAt:'剛剛',
      status:'草稿',
    };
    set({products:[product,...products]});
    return product;
  },
  updateProduct(id,patch){
    set(state=>({products:state.products.map(item=>item.id===id?{...item,...patch,updatedAt:'剛剛',status:item.status==='已停用'&&patch.status===undefined?'已停用':'草稿'}:item)}));
  },
  updateProductCustomerImage(id,url){
    set(state=>({products:state.products.map(item=>item.id===id?{...item,customerImageUrl:url,updatedAt:'剛剛',status:'草稿'}:item)}));
  },
  updateProductChannelImage(id,channel,url){
    set(state=>({products:state.products.map(item=>item.id===id?{...item,channelImages:{...item.channelImages,[channel]:url},updatedAt:'剛剛',status:'草稿'}:item)}));
  },
  toggleProductOptionSet(productId,setId,enabled){
    set(state=>({products:state.products.map(item=>{
      if(item.id!==productId)return item;
      const current=new Set(item.optionSetIds);
      if(enabled)current.add(setId);else current.delete(setId);
      return{...item,optionSetIds:[...current],updatedAt:'剛剛',status:'草稿'};
    })}));
  },
  createOptionSet(){
    const next:PreviewOptionSet={id:uid('set'),name:'新選項組',required:false,selection:'SINGLE',min:0,max:1,active:true,options:[]};
    set(state=>({optionSets:[next,...state.optionSets]}));
    return next;
  },
  updateOptionSet(id,patch){
    set(state=>({optionSets:state.optionSets.map(item=>item.id===id?{...item,...patch}:item)}));
  },
  addOption(setId){
    set(state=>({optionSets:state.optionSets.map(item=>item.id!==setId?item:{...item,options:[...item.options,{id:uid('opt'),code:'OPT-'+String(item.options.length+1).padStart(2,'0'),name:'新子選項',priceAdjustmentMinor:0,active:true}]})}));
  },
  updateOption(setId,optionId,patch){
    set(state=>({optionSets:state.optionSets.map(item=>item.id!==setId?item:{...item,options:item.options.map(option=>option.id===optionId?{...option,...patch}:option)})}));
  },
  removeOption(setId,optionId){
    set(state=>({optionSets:state.optionSets.map(item=>item.id!==setId?item:{...item,options:item.options.filter(option=>option.id!==optionId)})}));
  },
  createCombo(){
    const combo:PreviewCombo={id:uid('combo'),name:'新套餐',active:true,basePriceMinor:0,groups:[]};
    set(state=>({combos:[combo,...state.combos]}));
    return combo;
  },
  updateCombo(id,patch){
    set(state=>({combos:state.combos.map(item=>item.id===id?{...item,...patch}:item)}));
  },
  addComboGroup(comboId){
    set(state=>({combos:state.combos.map(combo=>combo.id!==comboId?combo:{...combo,groups:[...combo.groups,{id:uid('group'),name:'新分組',required:true,min:1,max:1,choices:[]}]})}));
  },
  updateComboGroup(comboId,groupId,patch){
    set(state=>({combos:state.combos.map(combo=>combo.id!==comboId?combo:{...combo,groups:combo.groups.map(group=>group.id===groupId?{...group,...patch}:group)})}));
  },
  addComboChoice(comboId,groupId){
    set(state=>({combos:state.combos.map(combo=>combo.id!==comboId?combo:{...combo,groups:combo.groups.map(group=>group.id!==groupId?group:{...group,choices:[...group.choices,{id:uid('choice'),label:'新選擇',priceAdjustmentMinor:0,active:true}]})})}));
  },
  updateComboChoice(comboId,groupId,choiceId,patch){
    set(state=>({combos:state.combos.map(combo=>combo.id!==comboId?combo:{...combo,groups:combo.groups.map(group=>group.id!==groupId?group:{...group,choices:group.choices.map(choice=>choice.id===choiceId?{...choice,...patch}:choice)})})}));
  },
  removeComboChoice(comboId,groupId,choiceId){
    set(state=>({combos:state.combos.map(combo=>combo.id!==comboId?combo:{...combo,groups:combo.groups.map(group=>group.id!==groupId?group:{...group,choices:group.choices.filter(choice=>choice.id!==choiceId)})})}));
  },
  createDiningTable(){
    const existing=get().diningTables;
    const nextNo=existing.reduce((max,item)=>{const n=Number(item.id.replace(/\\D/g,''));return Number.isFinite(n)?Math.max(max,n):max;},0)+1;
    const next:PreviewDiningTable={id:'T'+String(nextNo).padStart(2,'0'),name:String(nextNo)+'號枱',active:true,sortOrder:(existing.length+1)*10,seats:2,area:'前場'};
    set({diningTables:[...existing,next]});
    return next;
  },
  updateDiningTable(id,patch){
    set(state=>({diningTables:state.diningTables.map(item=>item.id===id?{...item,...patch}:item)}));
  },
  removeDiningTable(id){
    set(state=>({diningTables:state.diningTables.filter(item=>item.id!==id)}));
  },
}));

export const PREVIEW_CATALOG_CATEGORIES=Object.freeze(['飯類','飯糰','便當','茶飲','小食','湯品','甜品']);
export const PREVIEW_CHANNELS=Object.freeze([{id:'KEETA',label:'Keeta'}]);
