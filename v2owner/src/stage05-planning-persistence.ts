export const OWNER_COST_DEFINITIONS=Object.freeze([
  {key:'rent',label:'屋租'},
  {key:'water',label:'水'},
  {key:'electricity',label:'電'},
  {key:'gas',label:'煤氣'},
  {key:'labour',label:'人工'},
  {key:'other',label:'其他'},
] as const);

export type OwnerCostKey=(typeof OWNER_COST_DEFINITIONS)[number]['key'];

export interface OwnerCostPlanEntry{
  readonly plannedMinor:number|null;
  readonly actualToDateMinor:number|null;
}

export interface OwnerMonthlyPlan{
  readonly schemaVersion:1;
  readonly storageKind:'LOCAL_NON_AUTHORITATIVE_PLANNING';
  readonly month:string;
  readonly targetMinor:number|null;
  readonly costs:Readonly<Record<OwnerCostKey,OwnerCostPlanEntry>>;
  readonly updatedAt:string;
}

function storageKey(month:string){return 'mfk:owner:monthly-plan:v1:'+month;}
function validMonth(month:string){return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);}
function minor(value:unknown):number|null{
  if(value===null||value===undefined||value==='')return null;
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<0)return null;
  return Math.round(amount);
}
function blankCosts():Record<OwnerCostKey,OwnerCostPlanEntry>{
  return {
    rent:{plannedMinor:null,actualToDateMinor:null},
    water:{plannedMinor:null,actualToDateMinor:null},
    electricity:{plannedMinor:null,actualToDateMinor:null},
    gas:{plannedMinor:null,actualToDateMinor:null},
    labour:{plannedMinor:null,actualToDateMinor:null},
    other:{plannedMinor:null,actualToDateMinor:null},
  };
}
function emptyPlan(month:string):OwnerMonthlyPlan{
  return Object.freeze({
    schemaVersion:1,
    storageKind:'LOCAL_NON_AUTHORITATIVE_PLANNING',
    month:validMonth(month)?month:new Date().toISOString().slice(0,7),
    targetMinor:null,
    costs:Object.freeze(blankCosts()),
    updatedAt:new Date(0).toISOString(),
  });
}

export function readOwnerMonthlyPlan(month:string):OwnerMonthlyPlan{
  const fallback=emptyPlan(month);
  if(typeof window==='undefined'||!window.localStorage||!validMonth(month))return fallback;
  const raw=window.localStorage.getItem(storageKey(month));
  if(!raw)return fallback;
  try{
    const parsed=JSON.parse(raw) as Record<string,unknown>;
    if(parsed?.schemaVersion!==1||parsed?.storageKind!=='LOCAL_NON_AUTHORITATIVE_PLANNING'||parsed?.month!==month)return fallback;
    const rawCosts=parsed.costs&&typeof parsed.costs==='object'&&!Array.isArray(parsed.costs)
      ?parsed.costs as Record<string,unknown>
      :{};
    const costs=blankCosts();
    for(const {key} of OWNER_COST_DEFINITIONS){
      const entry=rawCosts[key]&&typeof rawCosts[key]==='object'&&!Array.isArray(rawCosts[key])
        ?rawCosts[key] as Record<string,unknown>
        :{};
      costs[key]=Object.freeze({
        plannedMinor:minor(entry.plannedMinor),
        actualToDateMinor:minor(entry.actualToDateMinor),
      });
    }
    return Object.freeze({
      schemaVersion:1,
      storageKind:'LOCAL_NON_AUTHORITATIVE_PLANNING',
      month,
      targetMinor:minor(parsed.targetMinor),
      costs:Object.freeze(costs),
      updatedAt:typeof parsed.updatedAt==='string'?parsed.updatedAt:fallback.updatedAt,
    });
  }catch{return fallback;}
}

export function writeOwnerMonthlyPlan(input:OwnerMonthlyPlan):OwnerMonthlyPlan{
  const month=validMonth(input.month)?input.month:new Date().toISOString().slice(0,7);
  const costs=blankCosts();
  for(const {key} of OWNER_COST_DEFINITIONS){
    const entry=input.costs[key];
    costs[key]=Object.freeze({
      plannedMinor:minor(entry?.plannedMinor),
      actualToDateMinor:minor(entry?.actualToDateMinor),
    });
  }
  const next:OwnerMonthlyPlan=Object.freeze({
    schemaVersion:1,
    storageKind:'LOCAL_NON_AUTHORITATIVE_PLANNING',
    month,
    targetMinor:minor(input.targetMinor),
    costs:Object.freeze(costs),
    updatedAt:new Date().toISOString(),
  });
  if(typeof window!=='undefined'&&window.localStorage){
    window.localStorage.setItem(storageKey(month),JSON.stringify(next));
  }
  return next;
}
