import {validateMfkAdminConfigEnvelope,type MfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {readFormalOptionCenter,validateFormalOptionCenter} from './formal-option-center.ts';

/** Caller-supplied observations, not proof of authentication. No network or persistence occurs here. */
export interface CanonicalObservation{
  mode:'canonical'|'preview'|'unverified';
  endpoint?:string;
  envelope?:unknown;
}
export interface FieldDifference{
  path:string;
  kind:'added'|'removed'|'changed';
  before?:unknown;
  after?:unknown;
}
export interface ProjectionInspection{
  status:'BLOCKED'|'NO_CHANGE'|'ADDITIVE_OPTION_CENTER';
  issues:string[];
  diff:FieldDifference[];
  /** An in-memory review artifact only. Never a publish envelope or a write command. */
  proposedSnapshot:Record<string,unknown>|null;
}
export type MigrationClassification='PREVIEW_NOT_CANONICAL'|'IDENTITY_UNVERIFIED'|'INVALID_CANONICAL'|'CANONICAL_IDENTITY_REVIEW_REQUIRED'|'CANONICAL_DIFF_REVIEW_REQUIRED'|'NO_COPY_REQUIRED';
function row(value:unknown):Record<string,unknown>|null{
  return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function escaped(value:string){return value.replaceAll('~','~0').replaceAll('/','~1');}
function differences(before:unknown,after:unknown,path=''):FieldDifference[]{
  if(Object.is(before,after))return [];
  const a=row(before),b=row(after);
  if((a&&b)||(Array.isArray(before)&&Array.isArray(after))){
    const left=before as Record<string,unknown>,right=after as Record<string,unknown>;
    return [...new Set([...Object.keys(left),...Object.keys(right)])].sort().flatMap(key=>{
      const next=path+'/'+escaped(key);
      if(!Object.hasOwn(left,key))return [{path:next,kind:'added' as const,after:structuredClone(right[key])}];
      if(!Object.hasOwn(right,key))return [{path:next,kind:'removed' as const,before:structuredClone(left[key])}];
      return differences(left[key],right[key],next);
    });
  }
  return [{path,kind:'changed',before:structuredClone(before),after:structuredClone(after)}];
}
function blocked(issues:string[]):ProjectionInspection{return {status:'BLOCKED',issues,diff:[],proposedSnapshot:null};}
function supportedOptionPrice(value:unknown){
  if(typeof value!=='string')return false;
  const match=/^([-+]?)(\d+)(?:\.(\d+))?$/.exec(value);
  if(!match||!Number.isFinite(Number(value)))return false;
  const fraction=match[3]??'';
  if(/[1-9]/.test(fraction.slice(2)))return false;
  // Guard the existing SMT moneyMinor (round(Number(value)*100)) boundary.
  // Compare exact source cents without emitting or replacing any price value.
  const exact=(BigInt(match[2])*100n+BigInt((fraction+'00').slice(0,2)))*(match[1]==='-'?-1n:1n);
  const projected=Math.round(Number(value)*100);
  return Number.isSafeInteger(projected)&&BigInt(projected)===exact;
}
function identity(observation:CanonicalObservation,envelope:MfkAdminConfigEnvelope){
  const {schema,storeId,revision,publishedAt,adminFingerprint,fingerprint}=envelope;
  return {endpoint:observation.endpoint!,schema,storeId,revision,publishedAt,adminFingerprint,fingerprint};
}
function requireJson(value:unknown,ancestors=new Set<object>()):void{
  if(value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return;
  if(typeof value!=='object'||ancestors.has(value))throw new Error('NON_JSON_INPUT');
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw new Error('NON_JSON_INPUT');
  ancestors.add(value);
  for(const child of Object.values(value))requireJson(child,ancestors);
  ancestors.delete(value);
}

/** Inspect the existing canonical shape. An unsupported center never falls back to legacy. */
function inspectProjection(snapshot:Readonly<Record<string,unknown>>):ProjectionInspection{
  const issues:string[]=[];
  const catalog=row(snapshot.catalog);
  if(!catalog||!Array.isArray(catalog.products)||!Array.isArray(catalog.modifierGroups))return blocked(['CATALOG_PRODUCTS_AND_MODIFIER_GROUPS_REQUIRED']);
  const existing=Object.hasOwn(snapshot,'optionCenter');
  const center=existing?row(snapshot.optionCenter):null;
  if(existing&&(!center||!Array.isArray(center.sets)||!Array.isArray(center.productLinks)))return blocked(['UNSUPPORTED_OPTION_CENTER_SHAPE']);
  const groups=existing?center!.sets as unknown[]:catalog.modifierGroups;
  const products=catalog.products;
  const ids=(values:unknown[],path:string)=>{
    const seen=new Set<string>();
    values.forEach((value,index)=>{
      const id=row(value)?.id;
      if(typeof id!=='string'||!id.trim()||seen.has(id))issues.push(path+'/'+index+': MISSING_OR_DUPLICATE_ID');
      else seen.add(id);
    });
    return seen;
  };
  const productIds=ids(products,'/catalog/products');
  const setIds=ids(groups,existing?'/optionCenter/sets':'/catalog/modifierGroups');
  const state=readFormalOptionCenter(snapshot as Record<string,unknown>);
  for(const [index,value] of groups.entries()){
    const group=row(value)??{};
    const path=(existing?'/optionCenter/sets/':'/catalog/modifierGroups/')+index;
    const normalized=state.sets.find(set=>set.id===group.id);
    if(!normalized)continue;
    for(const key of ['id','name','required','forceShow','selection','min','max','allowQuantities','active'] as const){
      if(!Object.is(group[key],normalized[key]))issues.push(path+'/'+key+': UNSUPPORTED_OR_LOSSY_MAPPING');
    }
    for(const key of ['min','max'] as const){
      if(!Number.isSafeInteger(group[key])||(group[key] as number)<0)issues.push(path+'/'+key+': NONNEGATIVE_SAFE_INTEGER_REQUIRED');
    }
    if(!Array.isArray(group.options)){issues.push(path+'/options: OPTIONS_REQUIRED');continue;}
    ids(group.options,path+'/options');
    for(const [optionIndex,optionValue] of group.options.entries()){
      const option=row(optionValue)??{};
      const normalizedOption=normalized.options.find(child=>child.id===option.id);
      if(!normalizedOption)continue;
      for(const key of ['id','code','name','priceAdjustment','active'] as const){
        if(!Object.is(option[key],normalizedOption[key]))issues.push(path+'/options/'+optionIndex+'/'+key+': UNSUPPORTED_OR_LOSSY_MAPPING');
      }
      if(!supportedOptionPrice(option.priceAdjustment)){
        issues.push(path+'/options/'+optionIndex+'/priceAdjustment: EXACT_SAFE_MINOR_UNIT_DECIMAL_REQUIRED');
      }
      // Legacy array order -> (index+1)*10 is the existing V2/V3 presentation adapter,
      // not a guessed price/default. Explicit source positions must survive unchanged.
      if((existing||Object.hasOwn(option,'position'))&&(!Number.isSafeInteger(option.position)||!Object.is(option.position,normalizedOption.position)))issues.push(path+'/options/'+optionIndex+'/position: SAFE_INTEGER_PRESERVATION_REQUIRED');
      if(!existing&&typeof option.defaultSelected!=='boolean')issues.push(path+'/options/'+optionIndex+'/defaultSelected: EXPLICIT_BOOLEAN_REQUIRED');
    }
  }
  if(existing){
    const linkIds=new Set<string>();
    for(const [index,value] of (center!.productLinks as unknown[]).entries()){
      const link=row(value)??{};
      const key=JSON.stringify([link.productId,link.setId]);
      const defaults=link.defaultOptionIds;
      if(typeof link.productId!=='string'||!productIds.has(link.productId)||typeof link.setId!=='string'||!setIds.has(link.setId)||linkIds.has(key))issues.push('/optionCenter/productLinks/'+index+': INVALID_OR_DUPLICATE_LINK');
      linkIds.add(key);
      if(!Array.isArray(defaults)||defaults.some(id=>typeof id!=='string'||!id)||new Set(defaults).size!==defaults.length)issues.push('/optionCenter/productLinks/'+index+'/defaultOptionIds: EXPLICIT_UNIQUE_IDS_REQUIRED');
    }
  }else{
    for(const [index,value] of products.entries()){
      const product=row(value)??{};
      const links=product.modifierGroupIds;
      if(!Array.isArray(links)||links.some(id=>typeof id!=='string'||!setIds.has(id))||new Set(links).size!==links.length)issues.push('/catalog/products/'+index+'/modifierGroupIds: INVALID_OR_DUPLICATE_REFERENCE');
      if(Object.keys(product).some(key=>/default|optionSets|optionLinks/i.test(key)))issues.push('/catalog/products/'+index+': UNSUPPORTED_PRODUCT_OPTION_POLICY');
    }
  }
  issues.push(...validateFormalOptionCenter(state));
  if(issues.length)return blocked(issues);
  const proposedSnapshot=structuredClone(snapshot) as Record<string,unknown>;
  if(existing)return {status:'NO_CHANGE',issues:[],diff:[],proposedSnapshot};
  // Add the view only. Never call the write/mirroring helper during migration inspection:
  // that could normalize or overwrite compatibility fields in the original catalog.
  proposedSnapshot.optionCenter={
    sets:state.sets.map(set=>{
      const raw=groups.find(value=>row(value)?.id===set.id) as Record<string,unknown>;
      return {...structuredClone(raw),...set,options:set.options.map(option=>{
        const original=(raw.options as unknown[]).find(value=>row(value)?.id===option.id);
        return {...structuredClone(row(original)!),...option};
      })};
    }),
    productLinks:structuredClone(state.productLinks),
  };
  return {status:'ADDITIVE_OPTION_CENTER',issues:[],diff:differences(snapshot,proposedSnapshot),proposedSnapshot};
}

/** Pure diagnostic. Its classification never grants permission to publish or migrate. */
export function inspectCanonicalMigration(input:{source:CanonicalObservation;target:CanonicalObservation}){
  const {source,target}=input;
  let sourceEnvelope:MfkAdminConfigEnvelope|undefined,targetEnvelope:MfkAdminConfigEnvelope|undefined;
  let classification:MigrationClassification='IDENTITY_UNVERIFIED';
  let canonicalDiff:FieldDifference[]=[];
  let projection=blocked(['CANONICAL_SOURCE_AND_TARGET_EVIDENCE_REQUIRED']);
  const validationIssues:string[]=[];
  // Validate each side independently so a failed target still reports the verified source identity.
  for(const [label,observation] of [['source',source],['target',target]] as const){
    if(observation.mode!=='canonical'||!observation.endpoint)continue;
    try{
      requireJson(observation.envelope);
      const envelope=validateMfkAdminConfigEnvelope(observation.envelope);
      if(label==='source')sourceEnvelope=envelope;else targetEnvelope=envelope;
    }catch(error){validationIssues.push(label+': '+(error instanceof Error?error.message:'INVALID_INPUT'));}
  }
  if(source.mode==='preview'||target.mode==='preview')classification='PREVIEW_NOT_CANONICAL';
  else if(validationIssues.length){classification='INVALID_CANONICAL';projection=blocked(validationIssues);}
  else if(sourceEnvelope&&targetEnvelope){
    canonicalDiff=differences(source.envelope,target.envelope);
    if(source.endpoint!==target.endpoint||sourceEnvelope.storeId!==targetEnvelope.storeId){
      classification='CANONICAL_IDENTITY_REVIEW_REQUIRED';projection=blocked(['SOURCE_TARGET_ENDPOINT_OR_STORE_MISMATCH']);
    }else if(canonicalDiff.length){
      classification='CANONICAL_DIFF_REVIEW_REQUIRED';projection=blocked(['CANONICAL_OBSERVATIONS_DIFFER: NO_OVERWRITE_PROPOSED']);
    }else{
      classification='NO_COPY_REQUIRED';projection=inspectProjection(sourceEnvelope.snapshot);
    }
  }
  return {
    classification,writePerformed:false as const,
    sourceIdentity:sourceEnvelope?identity(source,sourceEnvelope):null,
    targetIdentity:targetEnvelope?identity(target,targetEnvelope):null,
    canonicalDiff,projection,
  };
}
