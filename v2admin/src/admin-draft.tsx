import {createContext,useContext,useMemo,useState,type ReactNode} from 'react';

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
}
export interface ModifierOptionDraft{
  readonly id:string;
  readonly name:string;
  readonly priceAdjustment:string;
  readonly active:boolean;
  readonly defaultSelected:boolean;
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
}
export interface ComboDraft{
  readonly id:string;
  readonly name:string;
  readonly active:boolean;
  readonly basePrice:string;
  readonly takeawayAdjustment:string;
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
  readonly addProduct:()=>void;
  readonly updateProduct:(id:string,patch:Partial<ProductDraft>)=>void;
  readonly addModifierGroup:()=>void;
  readonly updateModifierGroup:(id:string,patch:Partial<ModifierGroupDraft>)=>void;
  readonly addModifierOption:(groupId:string)=>void;
  readonly updateModifierOption:(groupId:string,optionId:string,patch:Partial<ModifierOptionDraft>)=>void;
  readonly addCombo:()=>void;
  readonly updateCombo:(id:string,patch:Partial<ComboDraft>)=>void;
  readonly addComboSection:(comboId:string)=>void;
  readonly updateComboSection:(comboId:string,sectionId:string,patch:Partial<ComboSectionDraft>)=>void;
  readonly moveCategory:(id:string,direction:-1|1)=>void;
  readonly moveProduct:(id:string,direction:-1|1)=>void;
  readonly validate:()=>readonly string[];
  readonly reset:()=>void;
}

const EMPTY:AdminSessionDraft=Object.freeze({
  categories:[],
  products:[],
  modifierGroups:[],
  combos:[],
});

const AdminDraftContext=createContext<AdminDraftContextValue|null>(null);
const nextId=(prefix:string,count:number)=>prefix+'-'+String(count+1).padStart(3,'0');

export function AdminDraftProvider({children}:{children:ReactNode}){
  const [draft,setDraft]=useState<AdminSessionDraft>(EMPTY);
  const [dirty,setDirty]=useState(false);
  const [validationErrors,setValidationErrors]=useState<readonly string[]>([]);

  const mutate=(fn:(current:AdminSessionDraft)=>AdminSessionDraft)=>{
    setDraft(current=>fn(current));
    setDirty(true);
    setValidationErrors([]);
  };

  const addCategory=()=>mutate(current=>({
    ...current,
    categories:[...current.categories,{id:nextId('category',current.categories.length),name:'',position:(current.categories.length+1)*10,active:true}],
  }));

  const updateCategory=(id:string,patch:Partial<CategoryDraft>)=>mutate(current=>({
    ...current,
    categories:current.categories.map(row=>row.id===id?{...row,...patch}:row),
  }));

  const addProduct=()=>mutate(current=>({
    ...current,
    products:[...current.products,{
      id:nextId('product',current.products.length),
      name:'',
      categoryId:current.categories[0]?.id??'',
      active:true,
      basePrice:'',
      takeawayAdjustment:'0.00',
      modifierGroupIds:[],
    }],
  }));

  const updateProduct=(id:string,patch:Partial<ProductDraft>)=>mutate(current=>({
    ...current,
    products:current.products.map(row=>row.id===id?{...row,...patch}:row),
  }));

  const addModifierGroup=()=>mutate(current=>({
    ...current,
    modifierGroups:[...current.modifierGroups,{
      id:nextId('modifier',current.modifierGroups.length),
      name:'',
      required:false,
      selection:'SINGLE',
      min:0,
      max:1,
      active:true,
      options:[],
    }],
  }));

  const updateModifierGroup=(id:string,patch:Partial<ModifierGroupDraft>)=>mutate(current=>({
    ...current,
    modifierGroups:current.modifierGroups.map(row=>row.id===id?{...row,...patch}:row),
  }));

  const addModifierOption=(groupId:string)=>mutate(current=>({
    ...current,
    modifierGroups:current.modifierGroups.map(group=>group.id===groupId?{
      ...group,
      options:[...group.options,{
        id:nextId(group.id+'-option',group.options.length),
        name:'',
        priceAdjustment:'0.00',
        active:true,
        defaultSelected:false,
      }],
    }:group),
  }));

  const updateModifierOption=(groupId:string,optionId:string,patch:Partial<ModifierOptionDraft>)=>mutate(current=>({
    ...current,
    modifierGroups:current.modifierGroups.map(group=>group.id===groupId?{
      ...group,
      options:group.options.map(option=>option.id===optionId?{...option,...patch}:option),
    }:group),
  }));

  const addCombo=()=>mutate(current=>({
    ...current,
    combos:[...current.combos,{
      id:nextId('combo',current.combos.length),
      name:'',
      active:true,
      basePrice:'',
      takeawayAdjustment:'0.00',
      sections:[],
    }],
  }));

  const updateCombo=(id:string,patch:Partial<ComboDraft>)=>mutate(current=>({
    ...current,
    combos:current.combos.map(row=>row.id===id?{...row,...patch}:row),
  }));

  const addComboSection=(comboId:string)=>mutate(current=>({
    ...current,
    combos:current.combos.map(combo=>combo.id===comboId?{
      ...combo,
      sections:[...combo.sections,{
        id:nextId(combo.id+'-section',combo.sections.length),
        name:'',
        required:true,
        min:1,
        max:1,
      }],
    }:combo),
  }));

  const updateComboSection=(comboId:string,sectionId:string,patch:Partial<ComboSectionDraft>)=>mutate(current=>({
    ...current,
    combos:current.combos.map(combo=>combo.id===comboId?{
      ...combo,
      sections:combo.sections.map(section=>section.id===sectionId?{...section,...patch}:section),
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

  const moveCategory=(id:string,direction:-1|1)=>mutate(current=>({
    ...current,
    categories:move(current.categories,id,direction).map((row,index)=>({...row,position:(index+1)*10})),
  }));

  const moveProduct=(id:string,direction:-1|1)=>mutate(current=>({
    ...current,
    products:move(current.products,id,direction),
  }));

  const validate=()=>{
    const errors:string[]=[];
    const categoryIds=new Set(draft.categories.map(row=>row.id));
    const categoryNames=new Set<string>();
    for(const category of draft.categories){
      const name=category.name.trim();
      if(!name)errors.push('分類 '+category.id+' 未填名稱');
      if(name&&categoryNames.has(name))errors.push('分類名稱重複：'+name);
      categoryNames.add(name);
    }
    for(const product of draft.products){
      if(!product.name.trim())errors.push('商品 '+product.id+' 未填名稱');
      if(!product.categoryId||!categoryIds.has(product.categoryId))errors.push('商品 '+(product.name||product.id)+' 未選有效分類');
      if(product.basePrice.trim()&&Number.isNaN(Number(product.basePrice)))errors.push('商品 '+(product.name||product.id)+' 基本價格式錯誤');
      if(product.takeawayAdjustment.trim()&&Number.isNaN(Number(product.takeawayAdjustment)))errors.push('商品 '+(product.name||product.id)+' 外賣調整格式錯誤');
    }
    for(const group of draft.modifierGroups){
      if(!group.name.trim())errors.push('選項組 '+group.id+' 未填名稱');
      if(group.min<0||group.max<group.min)errors.push('選項組 '+(group.name||group.id)+' Min / Max 無效');
      if(group.required&&group.min<1)errors.push('必選組 '+(group.name||group.id)+' Min 必須至少 1');
      for(const option of group.options){
        if(!option.name.trim())errors.push('選項 '+option.id+' 未填名稱');
        if(option.priceAdjustment.trim()&&Number.isNaN(Number(option.priceAdjustment)))errors.push('選項 '+(option.name||option.id)+' 價格調整格式錯誤');
      }
    }
    for(const combo of draft.combos){
      if(!combo.name.trim())errors.push('套餐 '+combo.id+' 未填名稱');
      if(combo.basePrice.trim()&&Number.isNaN(Number(combo.basePrice)))errors.push('套餐 '+(combo.name||combo.id)+' 基本價格式錯誤');
      for(const section of combo.sections){
        if(!section.name.trim())errors.push('套餐區段 '+section.id+' 未填名稱');
        if(section.min<0||section.max<section.min)errors.push('套餐區段 '+(section.name||section.id)+' Min / Max 無效');
      }
    }
    setValidationErrors(errors);
    return errors;
  };

  const reset=()=>{
    setDraft(EMPTY);
    setDirty(false);
    setValidationErrors([]);
  };

  const value=useMemo<AdminDraftContextValue>(()=>({
    draft,dirty,validationErrors,
    addCategory,updateCategory,
    addProduct,updateProduct,
    addModifierGroup,updateModifierGroup,addModifierOption,updateModifierOption,
    addCombo,updateCombo,addComboSection,updateComboSection,
    moveCategory,moveProduct,validate,reset,
  }),[draft,dirty,validationErrors]);

  return <AdminDraftContext.Provider value={value}>{children}</AdminDraftContext.Provider>;
}

export function useAdminDraft(){
  const value=useContext(AdminDraftContext);
  if(!value)throw new Error('MFK_ADMIN_DRAFT_PROVIDER_MISSING');
  return value;
}
