import {createContext,useContext,useMemo,useState,type ReactNode} from 'react';
import {LEGACY_MF01_ADMIN_DRAFT} from './admin-menu-seed-mf01-v2.ts';
import {appendAdminAudit,readAdminStored,writeAdminStored} from './admin-local-store.ts';

export type ModifierSelection='SINGLE'|'MULTI';

export interface CategoryDraft{
  readonly id:string;
  readonly name:string;
  readonly position:number;
  readonly active:boolean;
}
export interface ProductDraft{
  readonly id:string;
  readonly name:string;
  readonly categoryId:string;
  readonly active:boolean;
  readonly basePrice:string;
  readonly takeawayAdjustment:string;
  readonly modifierGroupIds:readonly string[];
  readonly legacyBarcode?:string;
  readonly legacySourcePosition?:number;
  readonly productCode?:string;
  readonly shortName?:string;
  readonly description?:string;
  readonly sku?:string;
  readonly tags?:readonly string[];
  readonly imageRef?:string;
  readonly takeawaySurchargeEnabled?:boolean;
}
export interface ModifierOptionDraft{
  readonly id:string;
  readonly name:string;
  readonly priceAdjustment:string;
  readonly active:boolean;
  readonly defaultSelected:boolean;
  readonly code?:string;
}
export interface ModifierGroupDraft{
  readonly id:string;
  readonly name:string;
  readonly required:boolean;
  readonly selection:ModifierSelection;
  readonly min:number;
  readonly max:number;
  readonly active:boolean;
  readonly options:readonly ModifierOptionDraft[];
}
export interface ComboSectionDraft{
  readonly id:string;
  readonly name:string;
  readonly required:boolean;
  readonly min:number;
  readonly max:number;
  readonly childProductIds?:readonly string[];
  readonly priceAdjustment?:string;
}
export interface ComboDraft{
  readonly id:string;
  readonly name:string;
  readonly active:boolean;
  readonly basePrice:string;
  readonly takeawayAdjustment:string;
  readonly takeawaySurchargeEnabled?:boolean;
  readonly productId?:string;
  readonly sections:readonly ComboSectionDraft[];
}

export interface AdminSessionDraft{
  readonly categories:readonly CategoryDraft[];
  readonly products:readonly ProductDraft[];
  readonly modifierGroups:readonly ModifierGroupDraft[];
  readonly combos:readonly ComboDraft[];
}

interface AdminDraftContextValue{
  readonly draft:AdminSessionDraft;
  readonly dirty:boolean;
  readonly validationErrors:readonly string[];
  readonly addCategory:()=>void;
  readonly updateCategory:(id:string,patch:Partial<CategoryDraft>)=>void;
  readonly removeCategory:(id:string)=>void;
  readonly addProduct:()=>void;
  readonly updateProduct:(id:string,patch:Partial<ProductDraft>)=>void;
  readonly removeProduct:(id:string)=>void;
  readonly addModifierGroup:()=>void;
  readonly updateModifierGroup:(id:string,patch:Partial<ModifierGroupDraft>)=>void;
  readonly removeModifierGroup:(id:string)=>void;
  readonly addModifierOption:(groupId:string)=>void;
  readonly updateModifierOption:(groupId:string,optionId:string,patch:Partial<ModifierOptionDraft>)=>void;
  readonly removeModifierOption:(groupId:string,optionId:string)=>void;
  readonly addCombo:()=>void;
  readonly updateCombo:(id:string,patch:Partial<ComboDraft>)=>void;
  readonly removeCombo:(id:string)=>void;
  readonly addComboSection:(comboId:string)=>void;
  readonly updateComboSection:(comboId:string,sectionId:string,patch:Partial<ComboSectionDraft>)=>void;
  readonly removeComboSection:(comboId:string,sectionId:string)=>void;
  readonly moveCategory:(id:string,direction:-1|1)=>void;
  readonly moveProduct:(id:string,direction:-1|1)=>void;
  readonly validate:()=>readonly string[];
  readonly markClean:()=>void;
  readonly replaceDraft:(next:AdminSessionDraft,reason:string)=>void;
  readonly reset:()=>void;
}

const STORE_KEY='catalog-draft.v2';
const DIRTY_KEY='catalog-dirty.v1';

function normalizeDraft(input:AdminSessionDraft):AdminSessionDraft{
  return {
    categories:input.categories.map((row,index)=>({
      ...row,
      position:Number.isFinite(row.position)?row.position:(index+1)*10,
      active:row.active!==false,
    })),
    products:input.products.map((row,index)=>({
      ...row,
      productCode:row.productCode?.trim()||row.legacyBarcode?.trim()||row.id,
      shortName:row.shortName??'',
      description:row.description??'',
      sku:row.sku??'',
      tags:row.tags??[],
      imageRef:row.imageRef??'',
      takeawaySurchargeEnabled:row.takeawaySurchargeEnabled??false,
      takeawayAdjustment:row.takeawayAdjustment??'',
      modifierGroupIds:row.modifierGroupIds??[],
      legacySourcePosition:row.legacySourcePosition??index,
    })),
    modifierGroups:input.modifierGroups.map(group=>({
      ...group,
      options:group.options.map(option=>({...option,code:option.code??''})),
    })),
    combos:input.combos.map(combo=>({
      ...combo,
      takeawaySurchargeEnabled:combo.takeawaySurchargeEnabled??false,
      sections:combo.sections.map(section=>({
        ...section,
        childProductIds:section.childProductIds??[],
        priceAdjustment:section.priceAdjustment??'0.00',
      })),
    })),
  };
}

const INITIAL:AdminSessionDraft=normalizeDraft(LEGACY_MF01_ADMIN_DRAFT as unknown as AdminSessionDraft);

const AdminDraftContext=createContext<AdminDraftContextValue|null>(null);
const nextId=(prefix:string,count:number)=>prefix+'-'+String(count+1).padStart(3,'0');

export function validateAdminDraft(draft:AdminSessionDraft){
  const errors:string[]=[];
  const categoryIds=new Set(draft.categories.map(row=>row.id));
  const productIds=new Set(draft.products.map(row=>row.id));
  const modifierIds=new Set(draft.modifierGroups.map(row=>row.id));
  const categoryNames=new Set<string>();
  const productCodes=new Set<string>();

  for(const category of draft.categories){
    const name=category.name.trim();
    if(!name)errors.push('分類 '+category.id+' 未填名稱');
    if(name&&categoryNames.has(name))errors.push('分類名稱重複：'+name);
    categoryNames.add(name);
  }

  for(const product of draft.products){
    const label=product.name||product.id;
    const code=(product.productCode??'').trim();
    if(!product.name.trim())errors.push('商品 '+product.id+' 未填名稱');
    if(!code)errors.push('商品 '+label+' 未填 Product Code');
    if(code&&productCodes.has(code))errors.push('Product Code 重複：'+code);
    if(code)productCodes.add(code);
    if(product.active&&(!product.categoryId||!categoryIds.has(product.categoryId)))errors.push('商品 '+label+' 未選有效分類');
    if(!product.active&&product.categoryId&&!categoryIds.has(product.categoryId))errors.push('停用商品 '+label+' 分類無效');
    if(product.active&&!product.basePrice.trim())errors.push('商品 '+label+' 未填價格');
    if(product.basePrice.trim()&&(Number.isNaN(Number(product.basePrice))||Number(product.basePrice)<0))errors.push('商品 '+label+' 基本價格式錯誤');
    if(product.takeawayAdjustment.trim()&&Number.isNaN(Number(product.takeawayAdjustment)))errors.push('商品 '+label+' 外賣調整格式錯誤');
    for(const groupId of product.modifierGroupIds){
      if(!modifierIds.has(groupId))errors.push('商品 '+label+' 綁定咗不存在嘅選項組 '+groupId);
    }
  }

  for(const group of draft.modifierGroups){
    if(!group.name.trim())errors.push('選項組 '+group.id+' 未填名稱');
    if(group.min<0||group.max<group.min)errors.push('選項組 '+(group.name||group.id)+' 最少／最多選擇無效');
    if(group.required&&group.min<1)errors.push('必選組 '+(group.name||group.id)+' 最少選擇必須至少 1');
    if(group.selection==='SINGLE'&&group.max>1)errors.push('單選組 '+(group.name||group.id)+' 最多選擇不可大過 1');
    for(const option of group.options){
      if(!option.name.trim())errors.push('選項 '+option.id+' 未填名稱');
      if(option.priceAdjustment.trim()&&Number.isNaN(Number(option.priceAdjustment)))errors.push('選項 '+(option.name||option.id)+' 價格調整格式錯誤');
    }
  }

  for(const combo of draft.combos){
    const label=combo.name||combo.id;
    if(!combo.name.trim())errors.push('套餐 '+combo.id+' 未填名稱');
    if(combo.productId&&!productIds.has(combo.productId))errors.push('套餐 '+label+' 主商品不存在');
    if(combo.basePrice.trim()&&(Number.isNaN(Number(combo.basePrice))||Number(combo.basePrice)<0))errors.push('套餐 '+label+' 基本價格式錯誤');
    if(combo.takeawayAdjustment.trim()&&Number.isNaN(Number(combo.takeawayAdjustment)))errors.push('套餐 '+label+' 外賣調整格式錯誤');
    for(const section of combo.sections){
      if(!section.name.trim())errors.push('套餐區段 '+section.id+' 未填名稱');
      if(section.min<0||section.max<section.min)errors.push('套餐區段 '+(section.name||section.id)+' 最少／最多選擇無效');
      if(section.required&&section.min<1)errors.push('套餐區段 '+(section.name||section.id)+' 必選時最少選擇必須至少 1');
      if(section.priceAdjustment?.trim()&&Number.isNaN(Number(section.priceAdjustment)))errors.push('套餐區段 '+(section.name||section.id)+' 價格調整格式錯誤');
      for(const productId of section.childProductIds??[]){
        if(!productIds.has(productId))errors.push('套餐區段 '+(section.name||section.id)+' 包含不存在商品 '+productId);
      }
    }
  }
  return errors;
}

export function AdminDraftProvider({children}:{children:ReactNode}){
  const [draft,setDraft]=useState<AdminSessionDraft>(()=>normalizeDraft(readAdminStored<AdminSessionDraft>(STORE_KEY,INITIAL)));
  const [dirty,setDirty]=useState(()=>readAdminStored<boolean>(DIRTY_KEY,false));
  const [validationErrors,setValidationErrors]=useState<readonly string[]>([]);

  const persist=(next:AdminSessionDraft,nextDirty=true)=>{
    const normalized=normalizeDraft(next);
    writeAdminStored(STORE_KEY,normalized);
    writeAdminStored(DIRTY_KEY,nextDirty);
    setDraft(normalized);
    setDirty(nextDirty);
    setValidationErrors([]);
    return normalized;
  };

  const mutate=(action:string,target:string,fn:(current:AdminSessionDraft)=>AdminSessionDraft)=>{
    setDraft(current=>{
      const next=normalizeDraft(fn(current));
      writeAdminStored(STORE_KEY,next);
      writeAdminStored(DIRTY_KEY,true);
      appendAdminAudit({action,target});
      return next;
    });
    setDirty(true);
    setValidationErrors([]);
  };

  const addCategory=()=>mutate('新增分類','菜單',current=>({
    ...current,
    categories:[...current.categories,{id:nextId('category',current.categories.length),name:'新分類',position:(current.categories.length+1)*10,active:true}],
  }));

  const updateCategory=(id:string,patch:Partial<CategoryDraft>)=>mutate('修改分類',id,current=>({
    ...current,categories:current.categories.map(row=>row.id===id?{...row,...patch}:row),
  }));
  const removeCategory=(id:string)=>mutate('刪除分類',id,current=>({
    ...current,categories:current.categories.filter(row=>row.id!==id),
  }));

  const addProduct=()=>mutate('新增商品','菜單',current=>({
    ...current,
    products:[...current.products,{
      id:nextId('product',current.products.length),
      name:'新商品',
      productCode:nextId('P',current.products.length),
      shortName:'',
      description:'',
      sku:'',
      tags:[],
      imageRef:'',
      categoryId:current.categories[0]?.id??'',
      active:true,
      basePrice:'',
      takeawayAdjustment:'',
      takeawaySurchargeEnabled:false,
      modifierGroupIds:[],
      legacySourcePosition:current.products.length,
    }],
  }));

  const updateProduct=(id:string,patch:Partial<ProductDraft>)=>mutate('修改商品',id,current=>({
    ...current,products:current.products.map(row=>row.id===id?{...row,...patch}:row),
  }));
  const removeProduct=(id:string)=>mutate('刪除商品',id,current=>({
    ...current,products:current.products.filter(row=>row.id!==id),
  }));

  const addModifierGroup=()=>mutate('新增選項組','選項／加料',current=>({
    ...current,
    modifierGroups:[...current.modifierGroups,{
      id:nextId('modifier',current.modifierGroups.length),
      name:'新選項組',required:false,selection:'SINGLE',min:0,max:1,active:true,options:[],
    }],
  }));

  const updateModifierGroup=(id:string,patch:Partial<ModifierGroupDraft>)=>mutate('修改選項組',id,current=>({
    ...current,modifierGroups:current.modifierGroups.map(row=>row.id===id?{...row,...patch}:row),
  }));
  const removeModifierGroup=(id:string)=>mutate('刪除選項組',id,current=>({
    ...current,
    modifierGroups:current.modifierGroups.filter(row=>row.id!==id),
    products:current.products.map(product=>({...product,modifierGroupIds:product.modifierGroupIds.filter(groupId=>groupId!==id)})),
  }));

  const addModifierOption=(groupId:string)=>mutate('新增選項',groupId,current=>({
    ...current,
    modifierGroups:current.modifierGroups.map(group=>group.id===groupId?{
      ...group,
      options:[...group.options,{
        id:nextId(group.id+'-option',group.options.length),name:'新選項',code:'',priceAdjustment:'0.00',active:true,defaultSelected:false,
      }],
    }:group),
  }));

  const updateModifierOption=(groupId:string,optionId:string,patch:Partial<ModifierOptionDraft>)=>mutate('修改選項',optionId,current=>({
    ...current,
    modifierGroups:current.modifierGroups.map(group=>group.id===groupId?{
      ...group,options:group.options.map(option=>option.id===optionId?{...option,...patch}:option),
    }:group),
  }));
  const removeModifierOption=(groupId:string,optionId:string)=>mutate('刪除選項',optionId,current=>({
    ...current,
    modifierGroups:current.modifierGroups.map(group=>group.id===groupId?{
      ...group,options:group.options.filter(option=>option.id!==optionId),
    }:group),
  }));

  const addCombo=()=>mutate('新增套餐','套餐',current=>({
    ...current,
    combos:[...current.combos,{
      id:nextId('combo',current.combos.length),name:'新套餐',active:true,basePrice:'',takeawayAdjustment:'0.00',
      takeawaySurchargeEnabled:false,productId:undefined,sections:[],
    }],
  }));

  const updateCombo=(id:string,patch:Partial<ComboDraft>)=>mutate('修改套餐',id,current=>({
    ...current,combos:current.combos.map(row=>row.id===id?{...row,...patch}:row),
  }));
  const removeCombo=(id:string)=>mutate('刪除套餐',id,current=>({
    ...current,combos:current.combos.filter(row=>row.id!==id),
  }));

  const addComboSection=(comboId:string)=>mutate('新增套餐區段',comboId,current=>({
    ...current,
    combos:current.combos.map(combo=>combo.id===comboId?{
      ...combo,
      sections:[...combo.sections,{
        id:nextId(combo.id+'-section',combo.sections.length),name:'新區段',required:true,min:1,max:1,childProductIds:[],priceAdjustment:'0.00',
      }],
    }:combo),
  }));

  const updateComboSection=(comboId:string,sectionId:string,patch:Partial<ComboSectionDraft>)=>mutate('修改套餐區段',sectionId,current=>({
    ...current,
    combos:current.combos.map(combo=>combo.id===comboId?{
      ...combo,sections:combo.sections.map(section=>section.id===sectionId?{...section,...patch}:section),
    }:combo),
  }));
  const removeComboSection=(comboId:string,sectionId:string)=>mutate('刪除套餐區段',sectionId,current=>({
    ...current,
    combos:current.combos.map(combo=>combo.id===comboId?{
      ...combo,sections:combo.sections.filter(section=>section.id!==sectionId),
    }:combo),
  }));

  const move=<T extends {readonly id:string}>(rows:readonly T[],id:string,direction:-1|1)=>{
    const index=rows.findIndex(row=>row.id===id);
    const target=index+direction;
    if(index<0||target<0||target>=rows.length)return [...rows];
    const next=[...rows];
    const [row]=next.splice(index,1);
    if(row)next.splice(target,0,row);
    return next;
  };

  const moveCategory=(id:string,direction:-1|1)=>mutate('調整分類次序',id,current=>({
    ...current,categories:move(current.categories,id,direction).map((row,index)=>({...row,position:(index+1)*10})),
  }));
  const moveProduct=(id:string,direction:-1|1)=>mutate('調整商品次序',id,current=>({
    ...current,products:move(current.products,id,direction).map((row,index)=>({...row,legacySourcePosition:index})),
  }));

  const validate=()=>{
    const errors=validateAdminDraft(draft);
    setValidationErrors(errors);
    appendAdminAudit({action:'檢查菜單內容',target:'菜單草稿',after:{errors:errors.length}});
    return errors;
  };

  const markClean=()=>{
    writeAdminStored(DIRTY_KEY,false);
    setDirty(false);
  };

  const replaceDraft=(next:AdminSessionDraft,reason:string)=>{
    persist(next,true);
    appendAdminAudit({action:'取代菜單草稿',target:'菜單',reason});
  };

  const reset=()=>{
    persist(INITIAL,true);
    appendAdminAudit({action:'還原原始 MF01 菜單草稿',target:'菜單'});
  };

  const value=useMemo<AdminDraftContextValue>(()=>({
    draft,dirty,validationErrors,
    addCategory,updateCategory,removeCategory,
    addProduct,updateProduct,removeProduct,
    addModifierGroup,updateModifierGroup,removeModifierGroup,addModifierOption,updateModifierOption,removeModifierOption,
    addCombo,updateCombo,removeCombo,addComboSection,updateComboSection,removeComboSection,
    moveCategory,moveProduct,validate,markClean,replaceDraft,reset,
  }),[draft,dirty,validationErrors]);

  return <AdminDraftContext.Provider value={value}>{children}</AdminDraftContext.Provider>;
}

export function useAdminDraft(){
  const value=useContext(AdminDraftContext);
  if(!value)throw new Error('MFK_ADMIN_DRAFT_PROVIDER_MISSING');
  return value;
}
