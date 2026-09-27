import type {OwnerMonthlyPlanCanonical,OwnerMonthlyPlanCostLine,OwnerMonthlyPlanSaveInput} from './product-types';

export const OWNER_COST_DEFINITIONS=Object.freeze([
  {key:'rent',costLineId:'RENT',category:'RENT',label:'屋租'},
  {key:'water',costLineId:'UTILITIES_WATER',category:'UTILITIES_WATER',label:'水'},
  {key:'electricity',costLineId:'UTILITIES_ELECTRICITY',category:'UTILITIES_ELECTRICITY',label:'電'},
  {key:'gas',costLineId:'UTILITIES_GAS',category:'UTILITIES_GAS',label:'煤氣'},
  {key:'labour',costLineId:'LABOR',category:'LABOR',label:'人工'},
  {key:'other',costLineId:'OTHER',category:'OTHER',label:'其他'},
] as const);

export type OwnerCostKey=(typeof OWNER_COST_DEFINITIONS)[number]['key'];

export interface OwnerCostPlanEntry{
  readonly plannedMinor:number|null;
  readonly actualToDateMinor:number|null;
  readonly note?:string;
}

export interface OwnerMonthlyPlanDraft{
  readonly schemaVersion:1;
  readonly storageKind:'LOCAL_PLANNING_DRAFT_CACHE';
  readonly monthKey:string;
  readonly targetMinor:number|null;
  readonly costs:Readonly<Record<OwnerCostKey,OwnerCostPlanEntry>>;
  readonly note:string;
  readonly baseRevision:number;
  readonly updatedAt:string;
}

const STORAGE_PREFIX='mfk:owner:monthly-plan-draft-cache:v1:';

function storageKey(monthKey:string){return STORAGE_PREFIX+monthKey;}
export function validOwnerPlanningMonth(monthKey:string){return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey);}
function minor(value:unknown):number|null{
  if(value===null||value===undefined||value==='')return null;
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<0)return null;
  const rounded=Math.round(amount);
  return Number.isSafeInteger(rounded)?rounded:null;
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
function emptyDraft(monthKey:string):OwnerMonthlyPlanDraft{
  return Object.freeze({
    schemaVersion:1,
    storageKind:'LOCAL_PLANNING_DRAFT_CACHE',
    monthKey:validOwnerPlanningMonth(monthKey)?monthKey:new Date().toISOString().slice(0,7),
    targetMinor:null,
    costs:Object.freeze(blankCosts()),
    note:'',
    baseRevision:0,
    updatedAt:new Date(0).toISOString(),
  });
}

export function readOwnerMonthlyPlanDraft(monthKey:string):OwnerMonthlyPlanDraft{
  const fallback=emptyDraft(monthKey);
  if(typeof window==='undefined'||!window.localStorage||!validOwnerPlanningMonth(monthKey))return fallback;
  const raw=window.localStorage.getItem(storageKey(monthKey));
  if(!raw)return fallback;
  try{
    const parsed=JSON.parse(raw) as Record<string,unknown>;
    if(parsed?.schemaVersion!==1||parsed?.storageKind!=='LOCAL_PLANNING_DRAFT_CACHE'||parsed?.monthKey!==monthKey)return fallback;
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
        ...(typeof entry.note==='string'&&entry.note.trim()?{note:entry.note.trim().slice(0,500)}:{}),
      });
    }
    const baseRevision=Math.max(0,Math.floor(Number(parsed.baseRevision)||0));
    return Object.freeze({
      schemaVersion:1,
      storageKind:'LOCAL_PLANNING_DRAFT_CACHE',
      monthKey,
      targetMinor:minor(parsed.targetMinor),
      costs:Object.freeze(costs),
      note:typeof parsed.note==='string'?parsed.note.slice(0,1000):'',
      baseRevision,
      updatedAt:typeof parsed.updatedAt==='string'?parsed.updatedAt:fallback.updatedAt,
    });
  }catch{return fallback;}
}

export function writeOwnerMonthlyPlanDraft(input:OwnerMonthlyPlanDraft):OwnerMonthlyPlanDraft{
  const monthKey=validOwnerPlanningMonth(input.monthKey)?input.monthKey:new Date().toISOString().slice(0,7);
  const costs=blankCosts();
  for(const {key} of OWNER_COST_DEFINITIONS){
    const entry=input.costs[key];
    costs[key]=Object.freeze({
      plannedMinor:minor(entry?.plannedMinor),
      actualToDateMinor:minor(entry?.actualToDateMinor),
      ...(typeof entry?.note==='string'&&entry.note.trim()?{note:entry.note.trim().slice(0,500)}:{}),
    });
  }
  const next:OwnerMonthlyPlanDraft=Object.freeze({
    schemaVersion:1,
    storageKind:'LOCAL_PLANNING_DRAFT_CACHE',
    monthKey,
    targetMinor:minor(input.targetMinor),
    costs:Object.freeze(costs),
    note:String(input.note||'').slice(0,1000),
    baseRevision:Math.max(0,Math.floor(Number(input.baseRevision)||0)),
    updatedAt:new Date().toISOString(),
  });
  if(typeof window!=='undefined'&&window.localStorage){
    window.localStorage.setItem(storageKey(monthKey),JSON.stringify(next));
  }
  return next;
}

export function ownerMonthlyPlanDraftFromCanonical(plan:OwnerMonthlyPlanCanonical):OwnerMonthlyPlanDraft{
  const costs=blankCosts();
  for(const definition of OWNER_COST_DEFINITIONS){
    const line=plan.costLines.find(item=>item.costLineId===definition.costLineId);
    if(!line)continue;
    costs[definition.key]=Object.freeze({
      plannedMinor:minor(line.plannedMonthlyMinor),
      actualToDateMinor:minor(line.actualToDateMinor),
      ...(line.note?{note:String(line.note).slice(0,500)}:{}),
    });
  }
  return Object.freeze({
    schemaVersion:1,
    storageKind:'LOCAL_PLANNING_DRAFT_CACHE',
    monthKey:plan.monthKey,
    targetMinor:minor(plan.monthlyRevenueTargetMinor),
    costs:Object.freeze(costs),
    note:String(plan.note||'').slice(0,1000),
    baseRevision:Math.max(0,Math.floor(plan.revision)),
    updatedAt:plan.updatedAt,
  });
}

export function ownerMonthlyPlanCostLinesFromDraft(draft:OwnerMonthlyPlanDraft):readonly OwnerMonthlyPlanCostLine[]{
  return Object.freeze(OWNER_COST_DEFINITIONS.map(definition=>{
    const entry=draft.costs[definition.key];
    return Object.freeze({
      costLineId:definition.costLineId,
      category:definition.category,
      label:definition.label,
      plannedMonthlyMinor:minor(entry.plannedMinor),
      actualToDateMinor:minor(entry.actualToDateMinor),
      ...(entry.note?{note:String(entry.note).slice(0,500)}:{}),
    });
  }));
}

export function ownerMonthlyPlanSaveInputFromDraft(
  draft:OwnerMonthlyPlanDraft,
  operationId:string,
):OwnerMonthlyPlanSaveInput{
  return Object.freeze({
    monthKey:draft.monthKey,
    monthlyRevenueTargetMinor:minor(draft.targetMinor),
    costLines:ownerMonthlyPlanCostLinesFromDraft(draft),
    ...(draft.note.trim()?{note:draft.note.trim()}:{}),
    expectedRevision:draft.baseRevision,
    operationId,
  });
}
