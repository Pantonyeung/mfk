const STORAGE_KEY='mfk:owner:workspace:v1';

export interface OwnerChecklistItem {
  readonly id:string;
  readonly label:string;
  readonly done:boolean;
}

export interface OwnerLocalWorkspace {
  readonly schemaVersion:1;
  readonly storageKind:'LOCAL_NON_AUTHORITATIVE';
  readonly activeView:'today'|'queue'|'orders'|'more';
  readonly managerNote:string;
  readonly handoffNote:string;
  readonly checklist:readonly OwnerChecklistItem[];
  readonly updatedAt:string;
}

const DEFAULT_CHECKLIST:readonly OwnerChecklistItem[]=Object.freeze([
  Object.freeze({id:'OPENING',label:'開店檢查',done:false}),
  Object.freeze({id:'MIDDAY',label:'中段營運檢查',done:false}),
  Object.freeze({id:'CLOSING',label:'收店交接',done:false}),
]);

const DEFAULT_WORKSPACE:OwnerLocalWorkspace=Object.freeze({
  schemaVersion:1,
  storageKind:'LOCAL_NON_AUTHORITATIVE',
  activeView:'today',
  managerNote:'',
  handoffNote:'',
  checklist:DEFAULT_CHECKLIST,
  updatedAt:new Date(0).toISOString(),
});

function isRecord(value:unknown):value is Record<string,unknown>{
  return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
}

export function readOwnerLocalWorkspace():OwnerLocalWorkspace{
  if(typeof window==='undefined'||!window.localStorage)return DEFAULT_WORKSPACE;
  const raw=window.localStorage.getItem(STORAGE_KEY);
  if(!raw)return DEFAULT_WORKSPACE;
  try{
    const parsed:unknown=JSON.parse(raw);
    if(!isRecord(parsed)||parsed.schemaVersion!==1||parsed.storageKind!=='LOCAL_NON_AUTHORITATIVE')return DEFAULT_WORKSPACE;
    const activeView=['today','queue','orders','more'].includes(String(parsed.activeView))
      ?parsed.activeView as OwnerLocalWorkspace['activeView']
      :'today';
    const checklist=Array.isArray(parsed.checklist)
      ?parsed.checklist.filter(isRecord).map((item,index)=>Object.freeze({
          id:typeof item.id==='string'?item.id:`ITEM-${index}`,
          label:typeof item.label==='string'?item.label:'檢查項目',
          done:item.done===true,
        }))
      :DEFAULT_CHECKLIST;
    return Object.freeze({
      schemaVersion:1,
      storageKind:'LOCAL_NON_AUTHORITATIVE',
      activeView,
      managerNote:typeof parsed.managerNote==='string'?parsed.managerNote:'',
      handoffNote:typeof parsed.handoffNote==='string'?parsed.handoffNote:'',
      checklist:Object.freeze(checklist),
      updatedAt:typeof parsed.updatedAt==='string'?parsed.updatedAt:new Date(0).toISOString(),
    });
  }catch{
    return DEFAULT_WORKSPACE;
  }
}

export function writeOwnerLocalWorkspace(input:Omit<OwnerLocalWorkspace,'schemaVersion'|'storageKind'|'updatedAt'>):OwnerLocalWorkspace{
  const next:OwnerLocalWorkspace=Object.freeze({
    schemaVersion:1,
    storageKind:'LOCAL_NON_AUTHORITATIVE',
    activeView:input.activeView,
    managerNote:input.managerNote,
    handoffNote:input.handoffNote,
    checklist:Object.freeze(input.checklist.map(item=>Object.freeze({...item}))),
    updatedAt:new Date().toISOString(),
  });
  if(typeof window!=='undefined'&&window.localStorage){
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  }
  return next;
}
