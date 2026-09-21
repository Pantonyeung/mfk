export type Product = {
  id:string;
  category:string;
  name:string;
  price:string;
  tone:string;
  unavailable?:boolean;
  modifierGroups?:{label:string;required?:boolean;options:string[]}[];
  comboGroups?:{label:string;required?:boolean;options:string[]}[];
};

export const categories=['人氣','飯團','套餐','便當','小食','飲品'] as const;

export const products:Product[]=[
  {id:'p1',category:'人氣',name:'紫米飯團',price:'$41 起',tone:'米',modifierGroups:[{label:'飯底',required:true,options:['原味紫米','少飯','半飯']},{label:'加料',options:['加蛋','加菜','加醬']}]},
  {id:'p2',category:'人氣',name:'飯團套餐',price:'等待 Quote',tone:'套',comboGroups:[{label:'飯團',required:true,options:['紫米飯團','雞肉飯團','雙拼飯團']},{label:'小食',required:true,options:['鹽酥雞','薯角','時蔬']},{label:'飲品',options:['台式奶茶','冷泡茶','不需要飲品']}]},
  {id:'p3',category:'便當',name:'肉燥便當',price:'$48',tone:'便',modifierGroups:[{label:'飯量',required:true,options:['正常飯','少飯','半飯']},{label:'配菜',options:['正常','走蛋']}]},
  {id:'p4',category:'小食',name:'鹽酥雞',price:'$24',tone:'鹽'},
  {id:'p5',category:'飲品',name:'台式奶茶',price:'$12',tone:'茶'},
  {id:'p6',category:'套餐',name:'限定午餐',price:'暫停供應',tone:'限',unavailable:true,comboGroups:[{label:'主食',required:true,options:['便當','飯團']},{label:'飲品',options:['奶茶','冷泡茶']}]},
  {id:'p7',category:'飯團',name:'雞肉飯團',price:'$43 起',tone:'雞',modifierGroups:[{label:'飯底',required:true,options:['原味紫米','少飯','半飯']},{label:'口味',options:['正常','少辣','走醬']}]},
  {id:'p8',category:'飲品',name:'冷泡茶',price:'$10',tone:'冷'},
];

export const workTickets=[
  {code:'021',source:'Keeta',age:'2 分鐘',status:'製作中',items:'紫米飯團 ×2 · 鹽酥雞',route:'飯團位、炸物位',packing:'可以打包',eta:'約 6 分鐘'},
  {code:'020',source:'現場',age:'5 分鐘',status:'待製作',items:'肉燥便當 ×1',route:'飯餐位',packing:'未可打包',eta:'約 4 分鐘'},
  {code:'019',source:'自家客戶端',age:'8 分鐘',status:'需處理',items:'飯團套餐 ×1',route:'未完成 Routing',packing:'打包需處理',eta:'UNKNOWN'},
];

export const orderRows=[
  {code:'021',source:'Keeta',time:'20:31',status:'進行中',amount:'$96',items:'3 件',readback:'KNOWN',note:'少辣'},
  {code:'020',source:'現場',time:'20:27',status:'進行中',amount:'$48',items:'1 件',readback:'KNOWN'},
  {code:'019',source:'自家客戶端',time:'20:23',status:'待確認',amount:'等待 readback',items:'2 件',readback:'UNKNOWN'},
  {code:'018',source:'電話',time:'20:15',status:'已完成',amount:'$65',items:'2 件',readback:'PARTIAL'},
];

export const dineSessions=[
  {table:'A1',covers:2,orders:1,opened:'19:42'},
  {table:'B2',covers:3,orders:2,opened:'20:05'},
];
