import {FORMAL_OPTION_SUPPORT,inspectFormalOptionReadiness} from './formal-option-readiness.ts';

type Row=Record<string,unknown>;
export interface LinkedOptionMirrorDiagnostic{code:string;path:string;ids?:string[];message:string}
export interface LinkedOptionMirrorSummary{canonicalSets:number;legacySets:number;bindingConflicts:number}
export interface LinkedOptionMirrorPlan{
  state:'READY'|'UNCHANGED'|'BLOCKED';
  /** Exact local comparison token. Never render or log this snapshot-bearing value. */
  baseline:string;
  summary:LinkedOptionMirrorSummary;
  diagnostics:LinkedOptionMirrorDiagnostic[];
  changedPaths:string[];
  snapshot?:Row;
}

// Only these fields are redundant mirrors under the existing strict readiness contract.
const SET_FIELDS=['id','name','required','forceShow','selection','min','max','allowQuantities','active'] as const;
const OPTION_FIELDS=['id','code','name','priceAdjustment','active'] as const;
const object=(value:unknown):Row|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:undefined;
const own=(value:Row,key:string)=>Object.hasOwn(value,key);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const safeId=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=FORMAL_OPTION_SUPPORT.maxIdentifierLength&&value[0]!==' '&&value.at(-1)!==' '&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);

/** Reject values JSON cloning would silently omit/coerce, including accessors and cycles. */
function jsonSafe(value:unknown,ancestors=new Set<object>()):boolean{
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value)&&!Object.is(value,-0);
  if(typeof value!=='object'||ancestors.has(value))return false;
  if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
  if(Object.getOwnPropertySymbols(value).length)return false;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const keys=Object.keys(descriptors).filter(key=>!(Array.isArray(value)&&key==='length'));
  if(Array.isArray(value)&&(keys.length!==value.length||keys.some((key,index)=>key!==String(index))))return false;
  ancestors.add(value);
  const valid=keys.every(key=>{const d=descriptors[key];return d.enumerable&&own(d as unknown as Row,'value')&&jsonSafe(d.value,ancestors);});
  ancestors.delete(value);return valid;
}

/** Exact raw readset: a present optionCenter supersedes both redundant catalog mirrors.
 * Equality is stronger than a normalized display/catalog comparison: no authority, price,
 * defaults, field presence, ordering, or unrelated facts may change.
 */
function authorityProjection(snapshot:Row):Row{
  const result=clone(snapshot),catalog=object(result.catalog);
  if(catalog&&own(result,'optionCenter')){
    delete catalog.modifierGroups;
    if(Array.isArray(catalog.products))for(const product of catalog.products){const row=object(product);if(row)delete row.modifierGroupIds;}
  }
  return result;
}

/** Structural paths, including individual append locations; never collapses changed arrays. */
function differences(before:unknown,after:unknown,path='/snapshot'):string[]{
  if(same(before,after))return [];
  if(Array.isArray(before)&&Array.isArray(after)){
    const result:string[]=[];
    for(let index=0;index<Math.max(before.length,after.length);index++){
      if(index>=before.length||index>=after.length)result.push(path+'/'+index);
      else result.push(...differences(before[index],after[index],path+'/'+index));
    }
    return result;
  }
  const left=object(before),right=object(after);
  if(left&&right){
    const result:string[]=[];
    for(const key of new Set([...Object.keys(left),...Object.keys(right)])){
      const child=path+'/'+key.replaceAll('~','~0').replaceAll('/','~1');
      if(!own(left,key)||!own(right,key))result.push(child);
      else result.push(...differences(left[key],right[key],child));
    }
    return result;
  }
  return [path];
}

// Independent structural boundary, separate from the paths recorded by construction.
function allowedMirrorPath(path:string):boolean{
  if(/^\/snapshot\/catalog\/products\/\d+\/modifierGroupIds\/\d+$/.test(path))return true;
  if(/^\/snapshot\/catalog\/modifierGroups\/\d+(?:\/options\/\d+)?$/.test(path))return true;
  const setField=/^\/snapshot\/catalog\/modifierGroups\/\d+\/([^/]+)$/.exec(path);
  if(setField&&(SET_FIELDS as readonly string[]).includes(setField[1]))return true;
  const optionField=/^\/snapshot\/catalog\/modifierGroups\/\d+\/options\/\d+\/([^/]+)$/.exec(path);
  return !!optionField&&(OPTION_FIELDS as readonly string[]).includes(optionField[1]);
}

/** Pure preparation only: no storage, transport, draft creation, or publication. */
export function planLinkedOptionMirrors(snapshot:Row):LinkedOptionMirrorPlan{
  const diagnostics:LinkedOptionMirrorDiagnostic[]=[];
  const summary:LinkedOptionMirrorSummary={canonicalSets:0,legacySets:0,bindingConflicts:0};
  let baseline='',hasBlockers=false;
  const report=(code:string,path:string,message:string,ids?:unknown[],blocking=true)=>{
    if(blocking)hasBlockers=true;
    const safeIds=ids?.filter(safeId);
    const diagnostic={code,path,message,...(safeIds?.length?{ids:safeIds}:{})};
    if(!diagnostics.some(existing=>existing.code===code&&existing.path===path))diagnostics.push(diagnostic);
  };
  const blocked=():LinkedOptionMirrorPlan=>({state:'BLOCKED',baseline,summary,diagnostics,changedPaths:[]});
  try{
    if(!object(snapshot)||!jsonSafe(snapshot))throw new Error('invalid JSON');
    baseline=JSON.stringify(snapshot);
  }catch{
    report('LINKED_MIRROR_JSON_INVALID','/snapshot','來源含無法逐值保留的 JSON 資料。');return blocked();
  }
  const readiness=(value:Row)=>{
    // ERROR paths are composed only from known modeled fields/numeric indices.
    // Unknown extension WARNING paths and their arbitrary keys are never disclosed.
    for(const mode of ['EDIT_SOURCE','PUBLISH'] as const)for(const issue of inspectFormalOptionReadiness(value,mode)){
      if(issue.severity==='ERROR')report(issue.code,issue.path,'原始選項資料未通過既有嚴格檢查。');
    }
  };
  const catalog=object(snapshot.catalog),center=object(snapshot.optionCenter);
  summary.canonicalSets=Array.isArray(center?.sets)?center.sets.length:0;
  summary.legacySets=Array.isArray(catalog?.modifierGroups)?catalog.modifierGroups.length:0;
  if(!own(snapshot,'optionCenter')){
    readiness(snapshot);
    return hasBlockers?blocked():{state:'UNCHANGED',baseline,summary,diagnostics,changedPaths:[],snapshot:clone(snapshot)};
  }
  if(!center){readiness(snapshot);return blocked();}

  // Validate raw authority without letting already-known mirror conflicts mask defects.
  const authority=authorityProjection(snapshot);
  readiness(authority);
  if(hasBlockers)return blocked();
  // The strict checks above establish catalog/sets/links and canonical identities.
  if(!catalog||!Array.isArray(center.sets)||!Array.isArray(center.productLinks)){
    report('LINKED_MIRROR_AUTHORITY_CHANGED','/snapshot/optionCenter','無法確認既有選項權威資料。');return blocked();
  }
  const sets=center.sets as Row[],links=center.productLinks as Row[];
  const bySet=new Map(sets.map(set=>[set.id as string,set]));
  const linksByProduct=new Map<string,string[]>();
  for(const link of links){const id=link.productId as string;linksByProduct.set(id,[...(linksByProduct.get(id)??[]),link.setId as string]);}
  const next=clone(snapshot),nextCatalog=next.catalog as Row;
  const permitted=new Set<string>();
  const rows=(value:unknown,path:string):Row[]=>{
    if(!Array.isArray(value)){report('OPTION_ARRAY_REQUIRED',path,'必須保留明確資料陣列。');return [];}
    const seen=new Set<string>();
    return value.flatMap((entry,index)=>{
      const p=path+'/'+index,item=object(entry);
      if(!item){report('OPTION_OBJECT_REQUIRED',p,'必須是原始資料物件。');return [];}
      if(!safeId(item.id)){report('OPTION_NATIVE_ID_INVALID',p+'/id','ID 無法安全對應既有原始資料。');return [];}
      if(seen.has(item.id))report('OPTION_ID_DUPLICATE',p+'/id','ID 重複，不能安全對應。',[item.id]);
      seen.add(item.id);return [item];
    });
  };
  const reconcile=(target:Row,raw:Row,fields:readonly string[],path:string)=>{
    for(const field of fields){
      if(!own(raw,field)&&own(target,field)){
        report('LINKED_MIRROR_FIELD_PRESENCE_CONFLICT',path+'/'+field,'權威欄位不存在，不能刪除副本中的既有事實。',[raw.id]);
      }else if(own(raw,field)&&(!own(target,field)||!same(raw[field],target[field]))){
        target[field]=clone(raw[field]);permitted.add(path+'/'+field);
        report('OPTION_MIRROR_CONFLICT',path+'/'+field,'已辨識副本欄位差異；計畫只採用原始權威值。',[raw.id],false);
      }
    }
  };
  if(own(catalog,'modifierGroups')){
    const groupPath='/snapshot/catalog/modifierGroups';
    // Reject malformed PRESENT legacy values before replacement. A missing scalar may
    // be added, but replacing an object/invalid fact would silently erase legacy data.
    for(const issue of inspectFormalOptionReadiness(snapshot,'PUBLISH')){
      if(issue.severity!=='ERROR'||issue.code==='OPTION_MIRROR_CONFLICT'||!issue.path.startsWith(groupPath))continue;
      const segments=issue.path.slice('/snapshot/'.length).split('/');
      let value:unknown=snapshot,present=true;
      for(const segment of segments){
        if(value===null||typeof value!=='object'||!Object.hasOwn(value,segment)){present=false;break;}
        value=(value as Row)[segment];
      }
      if(present)report(issue.code,issue.path,'副本原始值格式不安全；不會刪除或覆蓋既有事實。');
    }
    const legacy=rows(catalog.modifierGroups,groupPath);
    for(const [index,group] of legacy.entries())rows(group.options,groupPath+'/'+index+'/options');
    if(hasBlockers)return blocked();
    const nextGroups=nextCatalog.modifierGroups as Row[];
    legacy.forEach((group,index)=>{
      const path=groupPath+'/'+index,raw=bySet.get(group.id as string);
      if(!raw){report('LINKED_MIRROR_LEGACY_SET_ORPHAN',path,'副本有權威來源不存在的選項組；不會刪除或提升為權威。',[group.id]);return;}
      const options=rows(group.options,path+'/options');
      if(hasBlockers)return;
      const codes=new Set<string>();
      options.forEach((option,childIndex)=>{
        if(typeof option.code!=='string'||!option.code.trim())return;
        const code=option.code.trim().toUpperCase();
        if(codes.has(code))report('OPTION_CODE_DUPLICATE',path+'/options/'+childIndex+'/code','副本選項 Code 重複，不能安全對應。',[group.id,option.id]);
        codes.add(code);
      });
      if(hasBlockers)return;
      const rawOptions=raw.options as Row[],byOption=new Map(rawOptions.map(option=>[option.id as string,option]));
      const target=nextGroups[index],targetOptions=target.options as Row[];
      reconcile(target,raw,SET_FIELDS,path);
      options.forEach((option,childIndex)=>{
        const optionPath=path+'/options/'+childIndex,authorityOption=byOption.get(option.id as string);
        if(!authorityOption){report('LINKED_MIRROR_LEGACY_OPTION_ORPHAN',optionPath,'副本有權威來源不存在的選項；不會刪除或提升為權威。',[group.id,option.id]);return;}
        reconcile(targetOptions[childIndex],authorityOption,OPTION_FIELDS,optionPath);
      });
      const existingIds=new Set(options.map(option=>option.id));
      for(const option of rawOptions)if(!existingIds.has(option.id)){
        const addedPath=path+'/options/'+targetOptions.length;
        permitted.add(addedPath);targetOptions.push(clone(option));
        report('OPTION_MIRROR_CONFLICT',addedPath,'副本缺少此權威選項；計畫只追加原始選項。',[group.id,option.id],false);
      }
    });
    const existingIds=new Set(legacy.map(group=>group.id));
    for(const set of sets)if(!existingIds.has(set.id)){
      const addedPath=groupPath+'/'+nextGroups.length;
      permitted.add(addedPath);nextGroups.push(clone(set));
      report('OPTION_MIRROR_CONFLICT',addedPath,'副本缺少此權威選項組；計畫只追加原始選項組。',[set.id],false);
    }
  }
  if(Array.isArray(catalog.products))catalog.products.forEach((value,index)=>{
    const product=value as Row;if(!own(product,'modifierGroupIds'))return;
    const path='/snapshot/catalog/products/'+index+'/modifierGroupIds',groups=product.modifierGroupIds;
    if(!Array.isArray(groups)){report('OPTION_IDS_REQUIRED',path,'商品副本必須是明確 ID 陣列。');return;}
    const expected=linksByProduct.get(product.id as string)??[];
    if(!same([...groups].sort(),[...expected].sort())){
      summary.bindingConflicts++;
      report('OPTION_BINDING_MIRROR_CONFLICT',path,'商品副本映射不同；列出商品 ID 及缺少的權威選項組 ID。',[product.id,...expected.filter(id=>!groups.includes(id))],false);
    }
    const seen=new Set<string>();
    groups.forEach((id,childIndex)=>{
      const p=path+'/'+childIndex;
      if(!safeId(id)){report('OPTION_NATIVE_ID_INVALID',p,'ID 無法安全對應既有原始資料。');return;}
      if(seen.has(id))report('OPTION_ID_DUPLICATE',p,'商品副本 ID 重複。',[product.id,id]);
      seen.add(id);
      if(!expected.includes(id))report('LINKED_MIRROR_LEGACY_BINDING_ORPHAN',p,'商品副本有權威連結不存在的映射；不會刪除。',[product.id,id]);
    });
    const nextGroups=((nextCatalog.products as Row[])[index].modifierGroupIds) as unknown[];
    for(const id of expected)if(!seen.has(id)){permitted.add(path+'/'+nextGroups.length);nextGroups.push(id);}
  });
  if(hasBlockers)return blocked();

  // Independent preservation and structural-diff gates, in addition to both strict validators.
  if(!same(snapshot.optionCenter,next.optionCenter)||!same(authorityProjection(snapshot),authorityProjection(next))){
    report('LINKED_MIRROR_AUTHORITY_CHANGED','/snapshot','選項權威或非副本資料有差異；不提供草稿。');return blocked();
  }
  const changedPaths=differences(snapshot,next).sort();
  if(changedPaths.some(path=>!allowedMirrorPath(path)||!permitted.has(path))){
    report('LINKED_MIRROR_UNSAFE_DIFF','/snapshot','差異包含未批准的結構路徑；不提供草稿。');return blocked();
  }
  readiness(next);
  if(hasBlockers)return blocked();
  return {state:changedPaths.length?'READY':'UNCHANGED',baseline,summary,diagnostics,changedPaths,snapshot:next};
}

/** Recheck current facts and recompute the candidate; never trust a previously returned object. */
export function applyLinkedOptionMirrorPlan(current:Row,baseline:string):Row{
  const plan=planLinkedOptionMirrors(current);
  if(plan.baseline!==baseline)throw new Error('LINKED_MIRROR_PLAN_STALE');
  if(plan.state!=='READY'||!plan.snapshot)throw new Error('LINKED_MIRROR_PLAN_NOT_READY');
  return plan.snapshot;
}
