export type ChoiceGroup={
  label:string;
  required?:boolean;
  min?:number;
  max?:number;
  options:string[];
};

export type Product={
  id:string;
  category:string;
  name:string;
  description:string;
  priceLabel:string;
  badge?:string;
  unavailable?:boolean;
  choiceGroups?:ChoiceGroup[];
  comboGroups?:ChoiceGroup[];
};

export const storeFixture={
  name:'磨飯 · 元朗',
  status:'營業中（展示）',
  eta:'約 15–20 分鐘',
  notice:'此頁資料只係 Customer migration fixture。',
};

export const categories=['人氣','飯團','便當','小食','飲品','套餐'] as const;

export const products:Product[]=[
  {
    id:'c-p1',category:'人氣',name:'招牌紫米飯團',description:'紫米、蛋、蔬菜與自選主料。',
    priceLabel:'$41 起',badge:'人氣',
    choiceGroups:[
      {label:'飯量',required:true,min:1,max:1,options:['正常飯','少飯','半飯']},
      {label:'口味',options:['正常','少辣','走醬']},
      {label:'加料',max:2,options:['加蛋','加菜','加脆脆']},
    ],
  },
  {
    id:'c-p2',category:'套餐',name:'飯團套餐',description:'飯團 + 必選小食 + 可選飲品。',
    priceLabel:'價錢展示 fixture',badge:'套餐',
    comboGroups:[
      {label:'飯團',required:true,min:1,max:1,options:['招牌紫米飯團','雞肉飯團','雙拼飯團']},
      {label:'小食',required:true,min:1,max:1,options:['鹽酥雞','薯角','時蔬']},
      {label:'飲品',max:1,options:['台式奶茶','冷泡茶','不需要飲品']},
    ],
  },
  {
    id:'c-p3',category:'便當',name:'肉燥便當',description:'紫米飯配肉燥、蛋與時蔬。',
    priceLabel:'$48',
    choiceGroups:[{label:'飯量',required:true,min:1,max:1,options:['正常飯','少飯','半飯']}],
  },
  {id:'c-p4',category:'飯團',name:'雞肉飯團',description:'雞肉主料配紫米飯。',priceLabel:'$43 起'},
  {id:'c-p5',category:'小食',name:'鹽酥雞',description:'即叫即炸小食。',priceLabel:'$24'},
  {id:'c-p6',category:'飲品',name:'台式奶茶',description:'凍飲。',priceLabel:'$12'},
  {id:'c-p7',category:'飲品',name:'冷泡茶',description:'無糖冷泡茶。',priceLabel:'$10'},
  {id:'c-p8',category:'套餐',name:'限定午餐',description:'展示 Own-channel unavailable / sellability shape。',priceLabel:'暫停供應',unavailable:true},
];

export const activeOrderFixture={
  orderRef:'展示單 C-102',
  pickupCode:'4821',
  phoneMasked:'**** 2218',
  items:['招牌紫米飯團 ×1','鹽酥雞 ×1','冷泡茶 ×1'],
  amountLabel:'$75（fixture）',
  promised:'展示：20:45',
};

export const historyFixtures=[
  {id:'h1',date:'9月20日',code:'展示單 C-094',summary:'招牌紫米飯團 · 冷泡茶',amountLabel:'$51（fixture）'},
  {id:'h2',date:'9月18日',code:'展示單 C-087',summary:'肉燥便當 · 鹽酥雞',amountLabel:'$72（fixture）'},
  {id:'h3',date:'9月16日',code:'展示單 C-079',summary:'飯團套餐',amountLabel:'價錢 fixture'},
];
