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
}

export const usePreviewAdmin=create<PreviewAdminState>((set,get)=>({
  printers:[
    {id:'logical-receipt',name:'收據機',type:'RECEIPT',widthMm:80,active:true},
    {id:'logical-production',name:'廚房製作單機',type:'PRODUCTION',widthMm:80,active:true},
    {id:'logical-packing',name:'打包單機',type:'PACKING',widthMm:80,active:true},
    {id:'logical-riceball-label',name:'飯糰標籤',type:'LABEL',widthMm:50,active:true},
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
    {id:'rule-label',name:'飯糰商品列印標籤',event:'PRODUCT_LABEL',printerIds:['logical-riceball-label'],active:true},
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
}));
