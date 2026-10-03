/** Source-only option capability checks. The server and host remain the authorities. */
export interface FormalOptionIssue{path:string;code:string;message:string;severity:'ERROR'|'WARNING'}
export type FormalOptionCheckMode='PUBLISH'|'EDIT_SOURCE';
export const FORMAL_OPTION_SUPPORT={
  center:['sets','productLinks'],
  set:['id','name','required','forceShow','selection','min','max','allowQuantities','active','options'],
  option:['id','code','name','priceAdjustment','active','position','defaultSelected','priceStatus'],
  link:['productId','setId','defaultOptionIds'],
  unsupported:['allowQuantities=true'],
  maxRows:1000,
  maxIdentifierLength:160,
  extensionPolicy:'PRESERVE_AND_REPORT_UNVALIDATED',
  consumer:'EXISTING_NATIVE_PRODUCT_OPTIONS_ONLY',
} as const;

type Row=Record<string,unknown>;
const object=(value:unknown):Row|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:undefined;
const own=(value:Row,key:string)=>Object.hasOwn(value,key);
const escape=(key:string)=>key.replaceAll('~','~0').replaceAll('/','~1');
const nonempty=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
// Java String.length/trim and Character.isISOControl limits, without trimming or repairing input.
const nativeId=(value:string)=>value.length<=FORMAL_OPTION_SUPPORT.maxIdentifierLength&&value[0]!==' '&&value.at(-1)!==' '&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** Same signed decimal scale and safe-minor bounds as native exactMinor; no rounding. */
export function isFormalOptionPrice(value:unknown):value is string{
  if(typeof value!=='string')return false;
  const match=/^(-?)([0-9]{1,14})(?:\.([0-9]{1,2}))?$/.exec(value);
  if(!match)return false;
  const minor=BigInt(match[2])*100n+BigInt((match[3]??'').padEnd(2,'0'));
  return minor<=9007199254740991n;
}

/** Validate original JSON, never the coercing UI read model. Does not write or normalize. */
export function inspectFormalOptionReadiness(snapshot:Row,mode:FormalOptionCheckMode='PUBLISH'):FormalOptionIssue[]{
  const issues:FormalOptionIssue[]=[];
  const publish=mode==='PUBLISH';
  const issue=(path:string,code:string,message:string,severity:'ERROR'|'WARNING'='ERROR')=>issues.push({path,code,message,severity});
  const rows=(value:unknown,path:string,optional=false):Row[]=>{
    if(value===undefined&&optional)return [];
    if(!Array.isArray(value)){issue(path,'OPTION_ARRAY_REQUIRED','必須保留原始陣列，不能忽略或轉換。');return [];}
    if(publish&&value.length>FORMAL_OPTION_SUPPORT.maxRows)issue(path,'OPTION_NATIVE_ARRAY_LIMIT','原生選項流程每個陣列最多 1000 項；不會截斷原始資料。');
    return value.map((value,index)=>{
      const item=object(value);if(!item)issue(path+'/'+index,'OPTION_OBJECT_REQUIRED','必須是資料物件。');return item??{};
    });
  };
  const ids=(value:unknown,path:string,optional=false):string[]=>{
    if(value===undefined&&optional)return [];
    if(!Array.isArray(value)){issue(path,'OPTION_IDS_REQUIRED','必須是明確 ID 陣列。');return [];}
    if(publish&&value.length>FORMAL_OPTION_SUPPORT.maxRows)issue(path,'OPTION_NATIVE_ARRAY_LIMIT','原生選項流程每個陣列最多 1000 項；不會截斷原始資料。');
    const seen=new Set<string>();
    return value.flatMap((id,index)=>{
      if(!nonempty(id)){issue(path+'/'+index,'OPTION_ID_INVALID','ID 必須是非空字串。');return [];}
      if(publish&&!nativeId(id))issue(path+'/'+index,'OPTION_NATIVE_ID_INVALID','原生 ID 最多 160 字元，不能有首尾空格或控制字元。');
      if(seen.has(id))issue(path+'/'+index,'OPTION_ID_DUPLICATE','ID 重複。');seen.add(id);return [id];
    });
  };
  const extensions=(item:Row,fields:readonly string[],path:string)=>{
    if(!publish)return;
    for(const key of Object.keys(item))if(!fields.includes(key))issue(path+'/'+escape(key),'OPTION_EXTENSION_UNVALIDATED','擴充欄位會保留；本項檢查未驗證其功能。','WARNING');
  };
  const requiredText=(item:Row,key:string,path:string,required=true)=>{
    if((required||own(item,key))&&!nonempty(item[key]))issue(path+'/'+key,'OPTION_TEXT_INVALID','必須是非空字串。');
    const value=item[key];
    if(publish&&['id','productId','setId'].includes(key)&&nonempty(value)&&!nativeId(value))issue(path+'/'+key,'OPTION_NATIVE_ID_INVALID','原生 ID 最多 160 字元，不能有首尾空格或控制字元。');
  };
  const bool=(item:Row,key:string,path:string,required=false)=>{
    if((required||own(item,key))&&typeof item[key]!=='boolean')issue(path+'/'+key,'OPTION_BOOLEAN_INVALID','必須明確為 true 或 false。');
  };
  const indexById=(items:Row[],path:string)=>{
    const result=new Map<string,{row:Row;path:string}>();
    items.forEach((item,index)=>{
      const itemPath=path+'/'+index;requiredText(item,'id',itemPath);
      if(nonempty(item.id)){
        if(result.has(item.id))issue(itemPath+'/id','OPTION_ID_DUPLICATE','ID 重複，不能安全對應原始資料。');
        else result.set(item.id,{row:item,path:itemPath});
      }
    });return result;
  };
  const catalog=object(snapshot.catalog);
  const hasCenter=own(snapshot,'optionCenter');
  const hasLegacy=!!catalog&&own(catalog,'modifierGroups');
  // No option source is a legitimate absence. Unrelated domain readiness belongs elsewhere.
  const rawProducts=catalog?.products;
  const hasBindings=Array.isArray(rawProducts)&&rawProducts.some(value=>{const product=object(value);return !!product&&own(product,'modifierGroupIds');});
  if(!hasCenter&&!hasLegacy&&!hasBindings)return issues;
  if(!catalog)issue('/snapshot/catalog','OPTION_CATALOG_REQUIRED','選項映射需要商品目錄。');
  const products=rows(rawProducts,'/snapshot/catalog/products',true);
  const productIndex=indexById(products,'/snapshot/catalog/products');
  const productGroups=new Map<string,string[]>();
  products.forEach((product,index)=>{
    if(own(product,'modifierGroupIds'))productGroups.set(String(product.id),ids(product.modifierGroupIds,`/snapshot/catalog/products/${index}/modifierGroupIds`));
  });
  const center=object(snapshot.optionCenter);
  if(hasCenter&&!center)issue('/snapshot/optionCenter','OPTION_CENTER_INVALID','現有 optionCenter 格式錯誤；不可退回舊副本。');
  const setsPath=hasCenter?'/snapshot/optionCenter/sets':'/snapshot/catalog/modifierGroups';
  const sets=hasCenter?rows(center?.sets,setsPath):rows(catalog?.modifierGroups,setsPath,true);
  const setIndex=indexById(sets,setsPath);
  const optionIndexes=new Map<string,Map<string,{row:Row;path:string}>>();
  const checkSets=(values:Row[],path:string,canonical:boolean)=>{
    values.forEach((set,index)=>{
      const p=path+'/'+index;extensions(set,FORMAL_OPTION_SUPPORT.set,p);requiredText(set,'name',p,publish);
      for(const key of ['required','forceShow','allowQuantities','active'])bool(set,key,p,publish&&key!=='forceShow');
      if((publish||own(set,'selection'))&&set.selection!=='SINGLE'&&set.selection!=='MULTI')issue(p+'/selection','OPTION_SELECTION_INVALID','只支援 SINGLE 或 MULTI。');
      for(const key of ['min','max'])if((publish||own(set,key))&&(!Number.isSafeInteger(set[key])||Number(set[key])<0||Number(set[key])>999))issue(p+'/'+key,'OPTION_BOUND_INVALID','選擇數量必須是 0 至 999 的整數。');
      if(typeof set.min==='number'&&typeof set.max==='number'&&set.min>set.max)issue(p+'/max','OPTION_BOUND_INVALID','最多選擇不能少於最少選擇。');
      if(set.required===true&&typeof set.min==='number'&&set.min<1)issue(p+'/min','OPTION_REQUIRED_INVALID','必選組最少必須選擇一項。');
      if(set.selection==='SINGLE'&&((own(set,'max')&&set.max!==1)||set.allowQuantities===true))issue(p+'/max','OPTION_SINGLE_INVALID','單選組最多一項，不能使用數量選項。');
      if(publish&&set.allowQuantities===true)issue(p+'/allowQuantities','OPTION_QUANTITIES_UNSUPPORTED','目前原生選項流程未支援每個選項的數量。');
      const options=rows(set.options,p+'/options'),byId=indexById(options,p+'/options');
      if(canonical&&nonempty(set.id))optionIndexes.set(set.id,byId);
      const codes=new Set<string>();
      options.forEach((option,childIndex)=>{
        const op=p+'/options/'+childIndex;extensions(option,FORMAL_OPTION_SUPPORT.option,op);requiredText(option,'name',op,publish);requiredText(option,'code',op,publish);
        if(nonempty(option.code)){const code=option.code.trim().toUpperCase();if(codes.has(code))issue(op+'/code','OPTION_CODE_DUPLICATE','同組選項 Code 重複。');codes.add(code);}
        bool(option,'active',op,publish);bool(option,'defaultSelected',op);
        if(own(option,'position')&&(typeof option.position!=='number'||!Number.isFinite(option.position)))issue(op+'/position','OPTION_POSITION_INVALID','次序必須是有限數字。');
        if(publish&&own(option,'priceStatus')&&option.priceStatus!=='READY')issue(op+'/priceStatus','OPTION_PRICE_NOT_READY','明確價格狀態尚未 READY；不會替用數值或改写狀態。');
        const price=option.priceAdjustment;
        if(publish?!isFormalOptionPrice(price):(typeof price!=='string'||!price.trim()||!Number.isFinite(Number(price))))issue(op+'/priceAdjustment','OPTION_PRICE_INVALID',publish?'價格必須符合原生精確小數格式（最多兩位小數）；不會自動取整。':'價格來源無效，不能安全保留。');
      });
    });
  };
  checkSets(sets,setsPath,true);
  if(center)extensions(center,FORMAL_OPTION_SUPPORT.center,'/snapshot/optionCenter');
  const links=hasCenter?rows(center?.productLinks,'/snapshot/optionCenter/productLinks'):[];
  const linksByProduct=new Map<string,string[]>(),seenLinks=new Set<string>();
  links.forEach((link,index)=>{
    const p='/snapshot/optionCenter/productLinks/'+index;extensions(link,FORMAL_OPTION_SUPPORT.link,p);
    requiredText(link,'productId',p);requiredText(link,'setId',p);
    const product=productIndex.get(String(link.productId)),set=setIndex.get(String(link.setId));
    if(nonempty(link.productId)&&!product)issue(p+'/productId','OPTION_PRODUCT_NOT_FOUND','引用的商品不存在。');
    if(nonempty(link.setId)&&!set)issue(p+'/setId','OPTION_SET_NOT_FOUND','引用的選項組不存在。');
    const key=JSON.stringify([link.productId,link.setId]);if(seenLinks.has(key))issue(p,'OPTION_LINK_DUPLICATE','同一商品與選項組映射重複。');seenLinks.add(key);
    if(nonempty(link.productId)&&nonempty(link.setId))linksByProduct.set(link.productId,[...(linksByProduct.get(link.productId)??[]),link.setId]);
    const defaults=ids(link.defaultOptionIds,p+'/defaultOptionIds');
    if(set){
      const activeCount=[...(optionIndexes.get(String(link.setId))?.values()??[])].filter(option=>option.row.active===true).length;
      const unsatisfiable=product?.row.active!==false&&set.row.active===true&&Number(set.row.min)>activeCount;
      if(publish&&unsatisfiable)issue(set.path+'/min','OPTION_MIN_UNSATISFIABLE','啟用選項數量少於必選下限，沒有有效選擇可以完成此組。');
      if(publish&&product?.row.active!==false&&set.row.active!==true)issue(p+'/setId','OPTION_SET_INACTIVE','啟用商品不能引用停用選項組。');
      if(typeof set.row.max==='number'&&defaults.length>set.row.max)issue(p+'/defaultOptionIds','OPTION_DEFAULT_MAX','預設選項超過上限。');
      defaults.forEach((id,defaultIndex)=>{
        const option=optionIndexes.get(String(link.setId))?.get(id);
        if(!option)issue(p+'/defaultOptionIds/'+defaultIndex,'OPTION_DEFAULT_NOT_FOUND','預設選項不屬於此選項組。');
        else if(option.row.active===false)issue(p+'/defaultOptionIds/'+defaultIndex,'OPTION_DEFAULT_INACTIVE','預設選項已停用。');
      });
      // Empty/partial defaults deliberately stay explicit: the operator must complete required choices.
      if(publish&&!unsatisfiable&&defaults.length<Number(set.row.min))issue(p+'/defaultOptionIds','OPTION_SELECTION_REQUIRED','未有完整預設；下單時必須完成必選項。','WARNING');
    }
  });
  for(const [productId,groupIds] of productGroups){
    const p=productIndex.get(productId)?.path??'/snapshot/catalog/products';
    for(const [index,id] of groupIds.entries())if(!setIndex.has(id))issue(p+'/modifierGroupIds/'+index,'OPTION_SET_NOT_FOUND','引用的選項組不存在。');
    if(hasCenter&&!same([...groupIds].sort(),[...(linksByProduct.get(productId)??[])].sort()))issue(p+'/modifierGroupIds','OPTION_BINDING_MIRROR_CONFLICT','商品映射與 optionCenter 不一致。');
    if(publish&&!hasCenter&&groupIds.length)issue('/snapshot/optionCenter','OPTION_NATIVE_SOURCE_UNBOUND','商品含舊選項映射，但原生流程需要明確 optionCenter；不會自動建立。');
  }
  if(!hasCenter){
    // Legacy defaults may not be silently converted from malformed truthy values.
    for(const [productId,groupIds] of productGroups)for(const setId of groupIds){
      const set=setIndex.get(setId);if(!set)continue;
      const defaults=[...(optionIndexes.get(setId)?.values()??[])].filter(option=>option.row.defaultSelected===true);
      if(typeof set.row.max==='number'&&defaults.length>set.row.max)issue(set.path+'/options','OPTION_DEFAULT_MAX','舊預設選項超過上限。');
      for(const option of defaults)if(option.row.active===false)issue(option.path+'/defaultSelected','OPTION_DEFAULT_INACTIVE','舊預設選項已停用。');
    }
  }
  if(hasCenter&&hasLegacy){
    const mirrors=rows(catalog?.modifierGroups,'/snapshot/catalog/modifierGroups'),mirrorIndex=indexById(mirrors,'/snapshot/catalog/modifierGroups');
    checkSets(mirrors,'/snapshot/catalog/modifierGroups',false);
    {
      if(!same([...setIndex.keys()].sort(),[...mirrorIndex.keys()].sort()))issue('/snapshot/catalog/modifierGroups','OPTION_MIRROR_CONFLICT','選項組副本 ID 不一致。');
      for(const [id,entry] of mirrorIndex){
        const canonical=setIndex.get(id)?.row;if(!canonical)continue;
        if(publish)for(const key of FORMAL_OPTION_SUPPORT.set.filter(key=>key!=='options'))if(!same(entry.row[key],canonical[key]))issue(entry.path+'/'+key,'OPTION_MIRROR_CONFLICT','選項組副本與 optionCenter 不一致。');
        const canonicalOptions=optionIndexes.get(id)??new Map(),mirrorOptions=Array.isArray(entry.row.options)?entry.row.options:[];
        if(!same([...canonicalOptions.keys()].sort(),mirrorOptions.map(value=>String(object(value)?.id)).sort()))issue(entry.path+'/options','OPTION_MIRROR_CONFLICT','選項副本 ID 不一致。');
        mirrorOptions.forEach((raw,index)=>{const option=object(raw);if(!option)return;const authority=canonicalOptions.get(String(option.id))?.row;if(!authority)return;
          if(publish)for(const key of ['id','code','name','priceAdjustment','active'])if(!same(option[key],authority[key]))issue(entry.path+'/options/'+index+'/'+key,'OPTION_MIRROR_CONFLICT','選項副本與 optionCenter 不一致。');
        });
      }
    }
  }
  return issues;
}

export class FormalOptionReadinessError extends Error{
  readonly issues:readonly FormalOptionIssue[];
  constructor(issues:readonly FormalOptionIssue[]){
    super('FORMAL_OPTION_NOT_READY: '+issues.map(issue=>issue.path+' ['+issue.code+'] '+issue.message).join('；'));
    this.name='FormalOptionReadinessError';this.issues=issues;
  }
}
export function assertFormalOptionReadiness(snapshot:Row,mode:FormalOptionCheckMode='PUBLISH'){
  const errors=inspectFormalOptionReadiness(snapshot,mode).filter(issue=>issue.severity==='ERROR');
  if(errors.length)throw new FormalOptionReadinessError(errors);
}
