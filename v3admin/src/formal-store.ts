export type FormalStoreDay='MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN';

export interface FormalWeeklyHours{
  closed:boolean;
  opensAt:string;
  closesAt:string;
}
export interface FormalDiningTable{
  id:string;
  name:string;
  active:boolean;
  sortOrder:number;
  retirementStatus?:'PLANNED_RETIREMENT'|'RETIRED';
}
export interface FormalStoreSettings{
  storeName:string;
  storeCode:string;
  currency:string;
  timezone:string;
  dineInEnabled:boolean;
  takeawayEnabled:boolean;
  lateArrivalMinutes:number;
  fulfillmentMinutes:number;
  archiveHours:number;
  diningOverdueMinutes:number;
  reminderAfterMinutes:number;
  reminderIntervalMinutes:number;
  repeatReminder:boolean;
  timeoutPriority:'NORMAL'|'HIGH'|'URGENT';
  weeklyHours:Record<FormalStoreDay,FormalWeeklyHours>;
  diningTables:FormalDiningTable[];
}
export interface FormalBusinessDayConfig{
  cutoff:string;
  postCloseCorrectionRoles:string[];
  cashTolerance:string;
  requireCloseApproval:boolean;
}

const DAYS:FormalStoreDay[]=['MON','TUE','WED','THU','FRI','SAT','SUN'];
const DEFAULT_HOURS:FormalWeeklyHours={closed:false,opensAt:'11:00',closesAt:'20:00'};

function row(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown){return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'?value:'';}
function num(value:unknown,fallback:number){const n=Number(value);return Number.isFinite(n)?n:fallback;}

export function readFormalStoreSettings(snapshot:Record<string,unknown>):FormalStoreSettings{
  const settings=row(snapshot.storeSettings);
  const hours=row(settings.weeklyHours);
  const weeklyHours={} as Record<FormalStoreDay,FormalWeeklyHours>;
  for(const day of DAYS){
    const value=row(hours[day]);
    weeklyHours[day]={
      closed:value.closed===true,
      opensAt:text(value.opensAt)||DEFAULT_HOURS.opensAt,
      closesAt:text(value.closesAt)||DEFAULT_HOURS.closesAt,
    };
  }
  return{
    storeName:text(settings.storeName),
    storeCode:text(settings.storeCode)||'MF01',
    currency:text(settings.currency)||'HKD',
    timezone:text(settings.timezone)||'Asia/Hong_Kong',
    dineInEnabled:settings.dineInEnabled!==false,
    takeawayEnabled:settings.takeawayEnabled!==false,
    lateArrivalMinutes:num(settings.lateArrivalMinutes,15),
    fulfillmentMinutes:num(settings.fulfillmentMinutes,20),
    archiveHours:num(settings.archiveHours,24),
    diningOverdueMinutes:num(settings.diningOverdueMinutes,35),
    reminderAfterMinutes:num(settings.reminderAfterMinutes,5),
    reminderIntervalMinutes:num(settings.reminderIntervalMinutes,5),
    repeatReminder:settings.repeatReminder!==false,
    timeoutPriority:settings.timeoutPriority==='NORMAL'||settings.timeoutPriority==='URGENT'?settings.timeoutPriority:'HIGH',
    weeklyHours,
    diningTables:list(settings.diningTables).map((value,index)=>{
      const item=row(value);
      const retirementStatus=item.retirementStatus==='PLANNED_RETIREMENT'||item.retirementStatus==='RETIRED'?item.retirementStatus:undefined;
      return{
        id:text(item.id),
        name:text(item.name),
        active:item.active!==false,
        sortOrder:num(item.sortOrder,index+1),
        retirementStatus,
      };
    }).filter(item=>item.id).sort((a,b)=>a.sortOrder-b.sortOrder),
  };
}

export function patchFormalStoreSettings(snapshot:Record<string,unknown>,patch:Partial<Omit<FormalStoreSettings,'weeklyHours'|'diningTables'>>){
  const settings=row(snapshot.storeSettings);
  return{...snapshot,storeSettings:{...settings,...patch}};
}

export function patchFormalWeeklyHours(snapshot:Record<string,unknown>,day:FormalStoreDay,patch:Partial<FormalWeeklyHours>){
  const settings=row(snapshot.storeSettings);
  const weeklyHours=row(settings.weeklyHours);
  const current=row(weeklyHours[day]);
  return{...snapshot,storeSettings:{...settings,weeklyHours:{...weeklyHours,[day]:{...current,...patch}}}};
}

export function addFormalDiningTable(snapshot:Record<string,unknown>,id:string){
  const settings=row(snapshot.storeSettings);
  const tables=list(settings.diningTables);
  const now=new Date().toISOString();
  const next={
    id,
    name:'新枱',
    active:true,
    sortOrder:tables.length+1,
    versions:[{
      versionId:'V1',
      label:'新枱',
      requestedAt:now,
      requestedBy:'ADMIN',
      sourceRevision:0,
      status:'ACTIVE',
      effectiveAt:now,
    }],
  };
  return{...snapshot,storeSettings:{...settings,diningTables:[...tables,next]}};
}

export function patchFormalDiningTable(snapshot:Record<string,unknown>,tableId:string,patch:Partial<Pick<FormalDiningTable,'name'|'active'|'sortOrder'>>){
  const settings=row(snapshot.storeSettings);
  let found=false;
  const tables=list(settings.diningTables).map(value=>{
    const item=row(value);
    if(text(item.id)!==tableId)return value;
    found=true;
    const next={...item,...patch};
    if(typeof patch.name==='string'&&patch.name.trim()&&patch.name!==text(item.name)){
      const versions=list(item.versions);
      const at=new Date().toISOString();
      const versionId='V'+String(versions.length+1);
      next.versions=[
        ...versions.map(value=>{
          const version=row(value);
          return version.status==='ACTIVE'||version.status==='PLANNED'?{...version,status:'SUPERSEDED'}:version;
        }),
        {versionId,label:patch.name.trim(),requestedAt:at,requestedBy:'ADMIN',sourceRevision:0,status:'ACTIVE',effectiveAt:at},
      ];
    }
    return next;
  });
  if(!found)throw new Error('FORMAL_DINING_TABLE_NOT_FOUND');
  return{...snapshot,storeSettings:{...settings,diningTables:tables}};
}

export function moveFormalDiningTable(snapshot:Record<string,unknown>,tableId:string,direction:-1|1){
  const settings=row(snapshot.storeSettings);
  const tables=[...list(settings.diningTables)].sort((a,b)=>num(row(a).sortOrder,0)-num(row(b).sortOrder,0));
  const index=tables.findIndex(value=>text(row(value).id)===tableId),target=index+direction;
  if(index<0||target<0||target>=tables.length)return snapshot;
  [tables[index],tables[target]]=[tables[target],tables[index]];
  const normalized=tables.map((value,idx)=>({...row(value),sortOrder:idx+1}));
  return{...snapshot,storeSettings:{...settings,diningTables:normalized}};
}

export function readFormalBusinessDay(snapshot:Record<string,unknown>):FormalBusinessDayConfig{
  const config=row(snapshot.businessDay);
  return{
    cutoff:text(config.cutoff)||'05:00',
    postCloseCorrectionRoles:list(config.postCloseCorrectionRoles).map(String).filter(Boolean),
    cashTolerance:text(config.cashTolerance)||'0.00',
    requireCloseApproval:config.requireCloseApproval!==false,
  };
}

export function patchFormalBusinessDay(snapshot:Record<string,unknown>,patch:Partial<FormalBusinessDayConfig>){
  const config=row(snapshot.businessDay);
  return{...snapshot,businessDay:{...config,...patch}};
}

export const FORMAL_TABLE_RETIREMENT_GAP=Object.freeze({
  status:'READBACK_GUARD_REQUIRED',
  requirement:'fresh /dining-occupancy readback with activeSessionCount=0 before permanent retirement',
});
