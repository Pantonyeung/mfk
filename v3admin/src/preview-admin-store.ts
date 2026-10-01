import {create} from 'zustand';

export type PreviewPrinterType='RECEIPT'|'PRODUCTION'|'PACKING'|'LABEL';

export interface PreviewPrinter{
  id:string;
  name:string;
  type:PreviewPrinterType;
  widthMm:number;
  active:boolean;
}

export interface PreviewPrintTemplate{
  id:string;
  name:string;
  content:string;
  active:boolean;
}

export interface PreviewPrintRule{
  id:string;
  name:string;
  event:string;
  printerIds:readonly string[];
  active:boolean;
}

export interface PreviewRole{
  id:string;
  name:string;
  permissions:readonly string[];
  active:boolean;
}

export interface PreviewStaff{
  id:string;
  loginId:string;
  name:string;
  roleId:string;
  scope:string;
  adminLogin:boolean;
  active:boolean;
}

export interface PreviewQuickReason{
  id:string;
  label:string;
  domain:'SOLD_OUT'|'ORDER_EXCEPTION'|'CASH'|'GENERAL';
  active:boolean;
}

export interface PreviewChannelMapping{
  id:string;
  providerItemId:string;
  channelName:string;
  productIds:readonly string[];
  status:'MAPPED'|'PENDING';
}

export interface PreviewChannelConfig{
  enabled:boolean;
  displayName:string;
  autoAccept:boolean;
  lateCutoffMinutes:number;
  syncSellability:boolean;
  commissionPct:number;
  providerShopId:string;
}

export interface PreviewCapacityPool{
  id:string;
  name:string;
  initialQty:number;
  remainingQty:number;
  productIds:readonly string[];
  active:boolean;
}

export interface PreviewDevice{
  id:string;
  name:string;
  kind:string;
  version:string;
  state:'可用'|'要留意'|'資料過期'|'無法連線';
  lastSeen:string;
}

export interface PreviewOtaRelease{
  id:string;
  version:string;
  label:string;
  approved:boolean;
  state:'可安裝'|'已安裝'|'已回復';
}

export interface PreviewSession{
  id:string;
  staffName:string;
  device:string;
  lastSeen:string;
  active:boolean;
}

export interface PreviewTrustedDevice{
  id:string;
  name:string;
  trusted:boolean;
  lastSeen:string;
}

export interface PreviewDraftChange{
  id:string;
  domain:string;
  object:string;
  changeType:'新增'|'修改'|'停用';
  valid:boolean;
}

export interface PreviewStoreSettings{
  storeName:string;
  storeCode:string;
  phone:string;
  address:string;
  timezone:string;
  currency:string;
  businessDayCutoff:string;
  reminderAfterMinutes:number;
  reminderIntervalMinutes:number;
}

export interface PreviewHours{
  closed:boolean;
  opensAt:string;
  closesAt:string;
}

export const PREVIEW_PERMISSION_OPTIONS=Object.freeze([
  {id:'VIEW_ORDERS',label:'查看訂單'},
  {id:'VIEW_REPORTS',label:'查看報表'},
  {id:'EDIT_CATALOG',label:'管理菜單'},
  {id:'EDIT_STORE',label:'管理門店設定'},
  {id:'EDIT_CHANNELS',label:'管理平台／渠道'},
  {id:'EDIT_PRINT',label:'管理打印'},
  {id:'PUBLISH_CONFIG',label:'發佈設定'},
  {id:'MANAGE_STAFF',label:'管理人員與權限'},
]);

function uid(prefix:string){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);}

const DEFAULT_HOURS:Record<string,PreviewHours>={
  MON:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  TUE:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  WED:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  THU:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  FRI:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  SAT:{closed:false,opensAt:'11:00',closesAt:'20:00'},
  SUN:{closed:false,opensAt:'11:00',closesAt:'20:00'},
};

interface PreviewAdminState{
  printers:PreviewPrinter[];
  templates:PreviewPrintTemplate[];
  printRules:PreviewPrintRule[];
  roles:PreviewRole[];
  staff:PreviewStaff[];
  quickReasons:PreviewQuickReason[];
  channelMappings:PreviewChannelMapping[];
  channelConfig:PreviewChannelConfig;
  storeSettings:PreviewStoreSettings;
  hours:Record<string,PreviewHours>;
  businessDayOpen:boolean;
  cashExpectedMinor:number;
  cashCountedMinor:number|null;
  cashNote:string;
  capacityPools:PreviewCapacityPool[];
  devices:PreviewDevice[];
  otaReleases:PreviewOtaRelease[];
  sessions:PreviewSession[];
  trustedDevices:PreviewTrustedDevice[];
  draftChanges:PreviewDraftChange[];
  previewPublishStage:'DRAFT'|'VALIDATED'|'IMPACT'|'PUBLISHED'|'READBACK';

  addPrinter():PreviewPrinter;
  updatePrinter(id:string,patch:Partial<Omit<PreviewPrinter,'id'>>):void;
  removePrinter(id:string):boolean;
  addTemplate():PreviewPrintTemplate;
  updateTemplate(id:string,patch:Partial<Omit<PreviewPrintTemplate,'id'>>):void;
  removeTemplate(id:string):boolean;
  addPrintRule():PreviewPrintRule;
  updatePrintRule(id:string,patch:Partial<Omit<PreviewPrintRule,'id'>>):void;
  removePrintRule(id:string):void;

  addRole():PreviewRole;
  updateRole(id:string,patch:Partial<Omit<PreviewRole,'id'>>):void;
  toggleRolePermission(roleId:string,permissionId:string,enabled:boolean):void;
  removeRole(id:string):boolean;
  addStaff():PreviewStaff;
  updateStaff(id:string,patch:Partial<Omit<PreviewStaff,'id'>>):void;
  removeStaff(id:string):void;

  addQuickReason():PreviewQuickReason;
  updateQuickReason(id:string,patch:Partial<Omit<PreviewQuickReason,'id'>>):void;
  removeQuickReason(id:string):void;

  updateChannelConfig(patch:Partial<PreviewChannelConfig>):void;
  addMapping():PreviewChannelMapping;
  updateMapping(id:string,patch:Partial<Omit<PreviewChannelMapping,'id'>>):void;
  removeMapping(id:string):void;

  updateStoreSettings(patch:Partial<PreviewStoreSettings>):void;
  updateHours(day:string,patch:Partial<PreviewHours>):void;
  setBusinessDayOpen(value:boolean):void;
  updateCash(patch:{countedMinor?:number|null;note?:string}):void;
  addCapacityPool():PreviewCapacityPool;
  updateCapacityPool(id:string,patch:Partial<Omit<PreviewCapacityPool,'id'>>):void;
  removeCapacityPool(id:string):void;
  updateDevice(id:string,patch:Partial<Omit<PreviewDevice,'id'>>):void;
  updateOtaRelease(id:string,patch:Partial<Omit<PreviewOtaRelease,'id'>>):void;
  revokeSession(id:string):void;
  setTrustedDevice(id:string,trusted:boolean):void;
  discardDraftChange(id:string):void;
  advancePreviewPublish():void;
}

export const usePreviewAdmin=create<PreviewAdminState>((set,get)=>({
  printers:[
    {id:'logical-receipt',name:'收據機',type:'RECEIPT',widthMm:80,active:true},
    {id:'logical-production',name:'廚房製作單機',type:'PRODUCTION',widthMm:80,active:true},
    {id:'logical-packing',name:'打包單機',type:'PACKING',widthMm:80,active:true},
    {id:'logical-label-1',name:'標籤機 1',type:'LABEL',widthMm:50,active:true},
    {id:'logical-label-2',name:'標籤機 2',type:'LABEL',widthMm:50,active:true},
  ],
  templates:[
    {id:'tpl-receipt',name:'收據模板',content:'店名\n訂單編號\n商品明細\n總額\n付款方式',active:true},
    {id:'tpl-production',name:'製作單模板',content:'訂單編號\n商品\n選項／備註',active:true},
    {id:'tpl-packing',name:'打包單模板',content:'訂單編號\n全單商品／件數',active:true},
    {id:'tpl-label',name:'標籤模板',content:'商品名稱\n選項\n訂單／取餐參考',active:true},
  ],
  printRules:[
    {id:'rule-receipt',name:'完成付款列印收據',event:'PAYMENT_CONFIRMED',printerIds:['logical-receipt'],active:true},
    {id:'rule-production',name:'新訂單列印製作單',event:'ORDER_CONFIRMED',printerIds:['logical-production'],active:true},
    {id:'rule-label-1',name:'商品標籤機 1',event:'PRODUCT_LABEL',printerIds:['logical-label-1'],active:true},
    {id:'rule-label-2',name:'商品標籤機 2',event:'PRODUCT_LABEL',printerIds:['logical-label-2'],active:true},
  ],
  roles:[
    {id:'OWNER',name:'老闆',permissions:PREVIEW_PERMISSION_OPTIONS.map(item=>item.id),active:true},
    {id:'MANAGER',name:'店長',permissions:['VIEW_ORDERS','VIEW_REPORTS','EDIT_CATALOG','EDIT_STORE','EDIT_CHANNELS','EDIT_PRINT'],active:true},
    {id:'VIEWER',name:'查看者',permissions:['VIEW_ORDERS','VIEW_REPORTS'],active:true},
  ],
  staff:[
    {id:'staff-owner',loginId:'owner',name:'老闆',roleId:'OWNER',scope:'MF01',adminLogin:true,active:true},
    {id:'staff-manager',loginId:'manager',name:'店長',roleId:'MANAGER',scope:'MF01',adminLogin:true,active:true},
    {id:'staff-accounting',loginId:'accounting',name:'會計',roleId:'VIEWER',scope:'MF01',adminLogin:true,active:true},
  ],
  quickReasons:[
    {id:'reason-soldout',label:'原料不足',domain:'SOLD_OUT',active:true},
    {id:'reason-supplier',label:'供應延誤',domain:'SOLD_OUT',active:true},
    {id:'reason-cash',label:'現金差額',domain:'CASH',active:true},
  ],
  channelMappings:[
    {id:'map-001',providerItemId:'KEETA-880123',channelName:'照燒雞紫米飯糰',productIds:['p-001'],status:'MAPPED'},
    {id:'map-002',providerItemId:'KEETA-880124',channelName:'吞拿魚紫米飯糰',productIds:['p-002'],status:'MAPPED'},
    {id:'map-003',providerItemId:'KEETA-880999',channelName:'二人套餐',productIds:['p-001','p-014'],status:'PENDING'},
  ],
  channelConfig:{
    enabled:true,
    displayName:'Keeta',
    autoAccept:true,
    lateCutoffMinutes:15,
    syncSellability:true,
    commissionPct:25,
    providerShopId:'721578302',
  },
  storeSettings:{
    storeName:'磨飯 More Fun',
    storeCode:'MF01',
    phone:'',
    address:'',
    timezone:'Asia/Hong_Kong',
    currency:'HKD',
    businessDayCutoff:'05:00',
    reminderAfterMinutes:5,
    reminderIntervalMinutes:5,
  },
  hours:{...DEFAULT_HOURS},
  businessDayOpen:true,
  cashExpectedMinor:284000,
  cashCountedMinor:null,
  cashNote:'',
  capacityPools:[
    {id:'pool-riceball',name:'飯糰每日產能',initialQty:180,remainingQty:74,productIds:['p-001','p-002','p-003','p-004'],active:true},
    {id:'pool-drink',name:'茶飲每日產能',initialQty:120,remainingQty:93,productIds:['p-014'],active:true},
  ],
  devices:[
    {id:'SMT-01',name:'Store Kernel',kind:'SMT',version:'v2.18.4',state:'可用',lastSeen:'剛剛'},
    {id:'SMM-01',name:'櫃檯 Android',kind:'SMM',version:'v2.18.4',state:'可用',lastSeen:'1 分鐘前'},
    {id:'KDS-02',name:'廚房顯示',kind:'KDS',version:'v2.17.9',state:'資料過期',lastSeen:'42 分鐘前'},
  ],
  otaReleases:[
    {id:'ota-2184',version:'v2.18.4',label:'目前批准版本',approved:true,state:'已安裝'},
    {id:'ota-2190',version:'v2.19.0-rc1',label:'候選版本',approved:true,state:'可安裝'},
  ],
  sessions:[
    {id:'session-owner',staffName:'老闆',device:'Safari · iPhone',lastSeen:'剛剛',active:true},
    {id:'session-manager',staffName:'店長',device:'Chrome · Mac',lastSeen:'8 分鐘前',active:true},
  ],
  trustedDevices:[
    {id:'trust-iphone',name:'老闆 iPhone',trusted:true,lastSeen:'剛剛'},
    {id:'trust-mac',name:'店長 Mac',trusted:true,lastSeen:'8 分鐘前'},
  ],
  draftChanges:[
    {id:'draft-product',domain:'菜單',object:'紫米飯糰・鹽麴雞',changeType:'修改',valid:true},
    {id:'draft-category',domain:'菜單',object:'茶飲',changeType:'修改',valid:true},
    {id:'draft-hours',domain:'門店設定',object:'營業時間',changeType:'修改',valid:true},
    {id:'draft-channel',domain:'渠道',object:'Keeta 接單規則',changeType:'修改',valid:true},
  ],
  previewPublishStage:'DRAFT',

  addPrinter(){
    const row:PreviewPrinter={id:uid('printer'),name:'新邏輯打印機',type:'RECEIPT',widthMm:80,active:true};
    set(state=>({printers:[...state.printers,row]}));return row;
  },
  updatePrinter(id,patch){set(state=>({printers:state.printers.map(item=>item.id===id?{...item,...patch}:item)}));},
  removePrinter(id){
    if(get().printRules.some(rule=>rule.printerIds.includes(id)))return false;
    set(state=>({printers:state.printers.filter(item=>item.id!==id)}));return true;
  },
  addTemplate(){
    const row:PreviewPrintTemplate={id:uid('tpl'),name:'新打印模板',content:'',active:true};
    set(state=>({templates:[...state.templates,row]}));return row;
  },
  updateTemplate(id,patch){set(state=>({templates:state.templates.map(item=>item.id===id?{...item,...patch}:item)}));},
  removeTemplate(id){set(state=>({templates:state.templates.filter(item=>item.id!==id)}));return true;},
  addPrintRule(){
    const row:PreviewPrintRule={id:uid('rule'),name:'新打印規則',event:'ORDER_CONFIRMED',printerIds:[],active:true};
    set(state=>({printRules:[...state.printRules,row]}));return row;
  },
  updatePrintRule(id,patch){set(state=>({printRules:state.printRules.map(item=>item.id===id?{...item,...patch}:item)}));},
  removePrintRule(id){set(state=>({printRules:state.printRules.filter(item=>item.id!==id)}));},

  addRole(){
    const row:PreviewRole={id:uid('role'),name:'新角色',permissions:[],active:true};
    set(state=>({roles:[...state.roles,row]}));return row;
  },
  updateRole(id,patch){set(state=>({roles:state.roles.map(item=>item.id===id?{...item,...patch}:item)}));},
  toggleRolePermission(roleId,permissionId,enabled){
    set(state=>({roles:state.roles.map(role=>{
      if(role.id!==roleId)return role;
      const permissions=new Set(role.permissions);if(enabled)permissions.add(permissionId);else permissions.delete(permissionId);
      return{...role,permissions:[...permissions]};
    })}));
  },
  removeRole(id){
    if(get().staff.some(item=>item.roleId===id))return false;
    set(state=>({roles:state.roles.filter(item=>item.id!==id)}));return true;
  },
  addStaff(){
    const roleId=get().roles[0]?.id??'';
    const row:PreviewStaff={id:uid('staff'),loginId:'',name:'新員工',roleId,scope:'MF01',adminLogin:false,active:true};
    set(state=>({staff:[...state.staff,row]}));return row;
  },
  updateStaff(id,patch){set(state=>({staff:state.staff.map(item=>item.id===id?{...item,...patch}:item)}));},
  removeStaff(id){set(state=>({staff:state.staff.filter(item=>item.id!==id)}));},

  addQuickReason(){
    const row:PreviewQuickReason={id:uid('reason'),label:'新原因',domain:'GENERAL',active:true};
    set(state=>({quickReasons:[...state.quickReasons,row]}));return row;
  },
  updateQuickReason(id,patch){set(state=>({quickReasons:state.quickReasons.map(item=>item.id===id?{...item,...patch}:item)}));},
  removeQuickReason(id){set(state=>({quickReasons:state.quickReasons.filter(item=>item.id!==id)}));},

  updateChannelConfig(patch){set(state=>({channelConfig:{...state.channelConfig,...patch}}));},
  addMapping(){
    const row:PreviewChannelMapping={id:uid('map'),providerItemId:'',channelName:'新 Keeta 商品',productIds:[],status:'PENDING'};
    set(state=>({channelMappings:[...state.channelMappings,row]}));return row;
  },
  updateMapping(id,patch){set(state=>({channelMappings:state.channelMappings.map(item=>item.id===id?{...item,...patch}:item)}));},
  removeMapping(id){set(state=>({channelMappings:state.channelMappings.filter(item=>item.id!==id)}));},

  updateStoreSettings(patch){set(state=>({storeSettings:{...state.storeSettings,...patch}}));},
  updateHours(day,patch){set(state=>({hours:{...state.hours,[day]:{...state.hours[day],...patch}}}));},
  setBusinessDayOpen(value){set({businessDayOpen:value});},
  updateCash(patch){set(state=>({cashCountedMinor:patch.countedMinor===undefined?state.cashCountedMinor:patch.countedMinor,cashNote:patch.note===undefined?state.cashNote:patch.note}));},
  addCapacityPool(){
    const row:PreviewCapacityPool={id:uid('pool'),name:'新產能 Pool',initialQty:100,remainingQty:100,productIds:[],active:false};
    set(state=>({capacityPools:[...state.capacityPools,row]}));return row;
  },
  updateCapacityPool(id,patch){set(state=>({capacityPools:state.capacityPools.map(item=>item.id===id?{...item,...patch}:item)}));},
  removeCapacityPool(id){set(state=>({capacityPools:state.capacityPools.filter(item=>item.id!==id)}));},
  updateDevice(id,patch){set(state=>({devices:state.devices.map(item=>item.id===id?{...item,...patch}:item)}));},
  updateOtaRelease(id,patch){set(state=>({otaReleases:state.otaReleases.map(item=>item.id===id?{...item,...patch}:item)}));},
  revokeSession(id){set(state=>({sessions:state.sessions.map(item=>item.id===id?{...item,active:false}:item)}));},
  setTrustedDevice(id,trusted){set(state=>({trustedDevices:state.trustedDevices.map(item=>item.id===id?{...item,trusted}:item)}));},
  discardDraftChange(id){set(state=>({draftChanges:state.draftChanges.filter(item=>item.id!==id),previewPublishStage:'DRAFT'}));},
  advancePreviewPublish(){set(state=>{
    const order=['DRAFT','VALIDATED','IMPACT','PUBLISHED','READBACK'] as const;
    const index=order.indexOf(state.previewPublishStage);
    return{previewPublishStage:order[Math.min(order.length-1,index+1)]};
  });},
}));
