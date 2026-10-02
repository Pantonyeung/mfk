export type MfpOrderingSurface='MFP_PAD'|'MFP_MOBILE';
export type MfpServiceMode='takeaway'|'dine-in';
export type MfpDraftLineState='READY'|'INCOMPLETE'|'REVALIDATION_REQUIRED';

export interface MfpOrderingProjectionIdentity{
  readonly storeId:string;
  readonly port:'SMT';
  readonly schemaVersion:1;
  readonly appliedSeq:number;
  readonly projectionHash:string;
  readonly appliedAt:string;
}

export interface MfpPublishedMoneyFact{
  readonly factId:string;
  readonly amountMinor:number;
  readonly currency:string;
  readonly revision:string|number;
}

export interface MfpOrderingCategory{
  readonly id:string;
  readonly label:string;
  readonly position:number;
}

export interface MfpOrderingOption{
  readonly id:string;
  readonly name:string;
  readonly defaultSelected:boolean;
  readonly sellable:boolean;
  readonly position:number;
  readonly priceAdjustment:MfpPublishedMoneyFact;
}

export interface MfpOrderingOptionSet{
  readonly id:string;
  readonly name:string;
  readonly required:boolean;
  readonly selection:'SINGLE'|'MULTI';
  readonly min:number;
  readonly max:number;
  readonly options:readonly MfpOrderingOption[];
}

export interface MfpOrderingProduct{
  readonly productId:string;
  readonly categoryId:string;
  readonly name:string;
  readonly description?:string;
  readonly imageUrl?:string;
  readonly sellable:boolean;
  readonly priceReady:boolean;
  readonly publishedUnitPrice:MfpPublishedMoneyFact|null;
  readonly serviceModeAdjustments:Readonly<Partial<Record<MfpServiceMode,MfpPublishedMoneyFact>>>;
  readonly optionSets:readonly MfpOrderingOptionSet[];
}

export interface MfpOrderingComboChoice{
  readonly id:string;
  readonly type:'PRODUCT'|'LABEL'|'NONE';
  readonly productId?:string;
  readonly label:string;
  readonly sellable:boolean;
  readonly position:number;
  readonly priceAdjustment:MfpPublishedMoneyFact;
}

export interface MfpOrderingComboSubPool{
  readonly id:string;
  readonly name:string;
  readonly sellable:boolean;
  readonly position:number;
  readonly priceAdjustment:MfpPublishedMoneyFact;
  readonly choices:readonly MfpOrderingComboChoice[];
}

export interface MfpOrderingComboGroup{
  readonly id:string;
  readonly name:string;
  readonly required:boolean;
  readonly min:number;
  readonly max:number;
  readonly position:number;
  readonly subPools:readonly MfpOrderingComboSubPool[];
}

export interface MfpOrderingComboPool{
  readonly id:string;
  readonly name:string;
  readonly kind:'MAIN_COURSE'|'ADDON';
  readonly addonKind?:'SNACK'|'DRINK';
  readonly groups:readonly MfpOrderingComboGroup[];
}

export interface MfpOrderingCombo{
  readonly id:string;
  readonly name:string;
  readonly sellable:boolean;
  readonly priceReady:boolean;
  readonly publishedBasePrice:MfpPublishedMoneyFact|null;
  readonly serviceModeAdjustments:Readonly<Partial<Record<MfpServiceMode,MfpPublishedMoneyFact>>>;
  readonly mainPoolId?:string;
  readonly addonPoolIds:readonly string[];
}

export interface MfpOrderingCatalog{
  readonly source:MfpOrderingProjectionIdentity;
  readonly categories:readonly MfpOrderingCategory[];
  readonly products:readonly MfpOrderingProduct[];
  readonly combos:readonly MfpOrderingCombo[];
  readonly comboPools:readonly MfpOrderingComboPool[];
}

export interface MfpOptionSelection{
  readonly optionSetId:string;
  readonly optionIds:readonly string[];
}

export interface MfpComboChoiceSelection{
  readonly poolId:string;
  readonly groupId:string;
  readonly subPoolId:string;
  readonly choiceId:string;
  readonly choiceType:'PRODUCT'|'LABEL'|'NONE';
  readonly productId?:string;
}

export interface MfpMaterialPriceFact extends MfpPublishedMoneyFact{
  readonly role:'PRODUCT_BASE'|'SERVICE_MODE'|'OPTION'|'COMBO_BASE'|'COMBO_SUB_POOL'|'COMBO_CHOICE';
  readonly sourceId:string;
}

export interface MfpOrderingDraftLine{
  readonly cartLineId:string;
  readonly kind:'PRODUCT'|'COMBO';
  readonly productId:string|null;
  readonly comboId:string|null;
  readonly displayName:string;
  readonly quantity:number;
  readonly serviceMode:MfpServiceMode;
  readonly optionSelections:readonly MfpOptionSelection[];
  readonly comboSelections:readonly MfpComboChoiceSelection[];
  readonly materialPriceFacts:readonly MfpMaterialPriceFact[];
  readonly previewUnitMinor:number|null;
  readonly state:MfpDraftLineState;
  readonly issues:readonly string[];
  readonly sourceProjection:MfpOrderingProjectionIdentity;
}

export interface MfpOrderingDraft{
  readonly draftOnly:true;
  readonly serviceMode:MfpServiceMode;
  readonly lines:readonly MfpOrderingDraftLine[];
}

export interface MfpProductSelectionInput{
  readonly cartLineId:string;
  readonly productId:string;
  readonly quantity:number;
  readonly optionSelections?:Readonly<Record<string,readonly string[]>>;
}

export interface MfpComboSelectionInput{
  readonly cartLineId:string;
  readonly comboId:string;
  readonly quantity:number;
  readonly comboSelections?:Readonly<Record<string,readonly Readonly<{subPoolId:string;choiceId:string}>[]>>;
}

export interface MfpNormalizedOrderingIntent{
  readonly schema:'mfp.ordering.intent.draft.v1';
  readonly draftOnly:true;
  readonly pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS';
  readonly serviceMode:MfpServiceMode;
  readonly checkoutReady:boolean;
  readonly previewSubtotalMinor:number|null;
  readonly lines:readonly MfpOrderingDraftLine[];
}

export interface MfpOrderingDomain{
  readonly catalog:MfpOrderingCatalog;
  createDraft(serviceMode:MfpServiceMode):MfpOrderingDraft;
  defaultProductSelection(productId:string):Readonly<Record<string,readonly string[]>>;
  addProduct(draft:MfpOrderingDraft,input:MfpProductSelectionInput,options?:Readonly<{allowIncomplete?:boolean}>):MfpOrderingDraft;
  editProduct(draft:MfpOrderingDraft,input:MfpProductSelectionInput,options?:Readonly<{allowIncomplete?:boolean}>):MfpOrderingDraft;
  addCombo(draft:MfpOrderingDraft,input:MfpComboSelectionInput,options?:Readonly<{allowIncomplete?:boolean}>):MfpOrderingDraft;
  editCombo(draft:MfpOrderingDraft,input:MfpComboSelectionInput,options?:Readonly<{allowIncomplete?:boolean}>):MfpOrderingDraft;
  setQuantity(draft:MfpOrderingDraft,cartLineId:string,quantity:number):MfpOrderingDraft;
  removeLine(draft:MfpOrderingDraft,cartLineId:string):MfpOrderingDraft;
  setServiceMode(draft:MfpOrderingDraft,serviceMode:MfpServiceMode):MfpOrderingDraft;
  reconcile(draft:MfpOrderingDraft,nextCatalog:MfpOrderingCatalog):MfpOrderingDraft;
  normalize(draft:MfpOrderingDraft):MfpNormalizedOrderingIntent;
}

function validQuantity(value:number){
  if(!Number.isSafeInteger(value)||value<1||value>999)throw new Error('MFP_ORDERING_QUANTITY_INVALID');
  return value;
}

function materialFact(role:MfpMaterialPriceFact['role'],sourceId:string,fact:MfpPublishedMoneyFact):MfpMaterialPriceFact{
  return Object.freeze({...fact,role,sourceId});
}

function issue(code:string,allowIncomplete:boolean,issues:string[]){
  if(!allowIncomplete)throw new Error(code);
  issues.push(code);
}

function productLine(
  catalog:MfpOrderingCatalog,
  serviceMode:MfpServiceMode,
  input:MfpProductSelectionInput,
  allowIncomplete:boolean,
):MfpOrderingDraftLine{
  validQuantity(input.quantity);
  const product=catalog.products.find(row=>row.productId===input.productId);
  if(!product)throw new Error('MFP_ORDERING_PRODUCT_NOT_FOUND');
  if(!product.sellable)throw new Error('MFP_ORDERING_PRODUCT_UNSELLABLE');
  if(!product.priceReady||!product.publishedUnitPrice)throw new Error('MFP_ORDERING_PRICE_NOT_READY');
  const supplied=input.optionSelections??{};
  const knownSetIds=new Set(product.optionSets.map(set=>set.id));
  if(Object.keys(supplied).some(setId=>!knownSetIds.has(setId)))throw new Error('MFP_ORDERING_OPTION_SET_UNKNOWN');
  const issues:string[]=[];
  const selections:MfpOptionSelection[]=[];
  const facts:MfpMaterialPriceFact[]=[materialFact('PRODUCT_BASE',product.productId,product.publishedUnitPrice)];
  const serviceAdjustment=product.serviceModeAdjustments[serviceMode];
  if(serviceAdjustment)facts.push(materialFact('SERVICE_MODE',`${product.productId}:${serviceMode}`,serviceAdjustment));

  for(const set of product.optionSets){
    const optionIds=[...new Set(supplied[set.id]??[])];
    const selected=optionIds.map(optionId=>{
      const option=set.options.find(row=>row.id===optionId);
      if(!option)throw new Error('MFP_ORDERING_OPTION_UNKNOWN');
      if(!option.sellable)throw new Error('MFP_ORDERING_OPTION_UNAVAILABLE');
      return option;
    });
    const minimum=Math.max(set.required?1:0,set.min);
    const maximum=Math.max(minimum,set.max);
    if(set.selection==='SINGLE'&&selected.length>1)issue('MFP_ORDERING_OPTION_SINGLE_REQUIRED',allowIncomplete,issues);
    if(selected.length<minimum)issue('MFP_ORDERING_REQUIRED_SELECTION_UNRESOLVED',allowIncomplete,issues);
    if(selected.length>maximum)issue('MFP_ORDERING_OPTION_MAX_EXCEEDED',allowIncomplete,issues);
    const ordered=set.options.filter(option=>optionIds.includes(option.id));
    selections.push(Object.freeze({optionSetId:set.id,optionIds:Object.freeze(ordered.map(option=>option.id))}));
    for(const option of ordered)facts.push(materialFact('OPTION',`${set.id}:${option.id}`,option.priceAdjustment));
  }

  return Object.freeze({
    cartLineId:input.cartLineId,kind:'PRODUCT',productId:product.productId,comboId:null,
    displayName:product.name,quantity:input.quantity,serviceMode,
    optionSelections:Object.freeze(selections),comboSelections:Object.freeze([]),
    materialPriceFacts:Object.freeze(facts),
    previewUnitMinor:facts.reduce((sum,fact)=>sum+fact.amountMinor,0),
    state:issues.length?'INCOMPLETE':'READY',issues:Object.freeze(issues),sourceProjection:catalog.source,
  });
}

function comboGroups(catalog:MfpOrderingCatalog,combo:MfpOrderingCombo){
  const poolIds=[combo.mainPoolId,...combo.addonPoolIds].filter((id):id is string=>Boolean(id));
  return poolIds.map(poolId=>{
    const pool=catalog.comboPools.find(row=>row.id===poolId);
    if(!pool)throw new Error('MFP_ORDERING_COMBO_POOL_NOT_FOUND');
    return pool.groups.map(group=>({pool,group}));
  }).flat();
}

function comboLine(
  catalog:MfpOrderingCatalog,
  serviceMode:MfpServiceMode,
  input:MfpComboSelectionInput,
  allowIncomplete:boolean,
):MfpOrderingDraftLine{
  validQuantity(input.quantity);
  const combo=catalog.combos.find(row=>row.id===input.comboId);
  if(!combo)throw new Error('MFP_ORDERING_COMBO_NOT_FOUND');
  if(!combo.sellable)throw new Error('MFP_ORDERING_COMBO_UNSELLABLE');
  if(!combo.priceReady||!combo.publishedBasePrice)throw new Error('MFP_ORDERING_PRICE_NOT_READY');
  const groups=comboGroups(catalog,combo);
  const supplied=input.comboSelections??{};
  const knownGroupIds=new Set(groups.map(({group})=>group.id));
  if(Object.keys(supplied).some(groupId=>!knownGroupIds.has(groupId)))throw new Error('MFP_ORDERING_COMBO_GROUP_UNKNOWN');
  const issues:string[]=[];
  const selections:MfpComboChoiceSelection[]=[];
  const facts:MfpMaterialPriceFact[]=[materialFact('COMBO_BASE',combo.id,combo.publishedBasePrice)];
  const serviceAdjustment=combo.serviceModeAdjustments[serviceMode];
  if(serviceAdjustment)facts.push(materialFact('SERVICE_MODE',`${combo.id}:${serviceMode}`,serviceAdjustment));

  for(const {pool,group} of groups){
    const selected=[...new Map((supplied[group.id]??[]).map(row=>[`${row.subPoolId}:${row.choiceId}`,row])).values()];
    const minimum=Math.max(group.required?1:0,group.min);
    const maximum=Math.max(minimum,group.max);
    if(selected.length<minimum)issue('MFP_ORDERING_COMBO_REQUIRED_SELECTION_UNRESOLVED',allowIncomplete,issues);
    if(selected.length>maximum)issue('MFP_ORDERING_COMBO_MAX_EXCEEDED',allowIncomplete,issues);
    for(const raw of selected){
      const subPool=group.subPools.find(row=>row.id===raw.subPoolId);
      if(!subPool)throw new Error('MFP_ORDERING_COMBO_SUB_POOL_UNKNOWN');
      if(!subPool.sellable)throw new Error('MFP_ORDERING_COMBO_CHOICE_UNAVAILABLE');
      const choice=subPool.choices.find(row=>row.id===raw.choiceId);
      if(!choice)throw new Error('MFP_ORDERING_COMBO_CHOICE_UNKNOWN');
      if(!choice.sellable)throw new Error('MFP_ORDERING_COMBO_CHOICE_UNAVAILABLE');
      if(choice.type==='PRODUCT'&&!choice.productId)throw new Error('MFP_ORDERING_COMBO_PRODUCT_ID_REQUIRED');
      if(choice.type==='PRODUCT'&&!catalog.products.some(product=>product.productId===choice.productId&&product.sellable)){
        throw new Error('MFP_ORDERING_COMBO_PRODUCT_UNAVAILABLE');
      }
      selections.push(Object.freeze({
        poolId:pool.id,groupId:group.id,subPoolId:subPool.id,choiceId:choice.id,
        choiceType:choice.type,...(choice.productId?{productId:choice.productId}:{}),
      }));
      facts.push(materialFact('COMBO_SUB_POOL',`${pool.id}:${group.id}:${subPool.id}`,subPool.priceAdjustment));
      facts.push(materialFact('COMBO_CHOICE',`${pool.id}:${group.id}:${subPool.id}:${choice.id}`,choice.priceAdjustment));
    }
  }

  return Object.freeze({
    cartLineId:input.cartLineId,kind:'COMBO',productId:null,comboId:combo.id,
    displayName:combo.name,quantity:input.quantity,serviceMode,
    optionSelections:Object.freeze([]),comboSelections:Object.freeze(selections),
    materialPriceFacts:Object.freeze(facts),
    previewUnitMinor:facts.reduce((sum,fact)=>sum+fact.amountMinor,0),
    state:issues.length?'INCOMPLETE':'READY',issues:Object.freeze(issues),sourceProjection:catalog.source,
  });
}

function replaceLine(draft:MfpOrderingDraft,line:MfpOrderingDraftLine,requireExisting:boolean){
  const index=draft.lines.findIndex(row=>row.cartLineId===line.cartLineId);
  if(requireExisting&&index<0)throw new Error('MFP_ORDERING_CART_LINE_NOT_FOUND');
  if(!requireExisting&&index>=0)throw new Error('MFP_ORDERING_CART_LINE_ID_CONFLICT');
  const lines=index<0?[...draft.lines,line]:draft.lines.map((row,current)=>current===index?line:row);
  return Object.freeze({...draft,lines:Object.freeze(lines)});
}

function selectedOptions(line:MfpOrderingDraftLine){
  return Object.freeze(Object.fromEntries(line.optionSelections.map(row=>[row.optionSetId,row.optionIds])));
}

function selectedComboChoices(line:MfpOrderingDraftLine){
  const out:Record<string,{subPoolId:string;choiceId:string}[]>={};
  for(const row of line.comboSelections)(out[row.groupId]??=[]).push({subPoolId:row.subPoolId,choiceId:row.choiceId});
  return Object.freeze(out);
}

function rebuildLine(catalog:MfpOrderingCatalog,line:MfpOrderingDraftLine){
  return line.kind==='PRODUCT'
    ?productLine(catalog,line.serviceMode,{
      cartLineId:line.cartLineId,productId:line.productId!,quantity:line.quantity,
      optionSelections:selectedOptions(line),
    },true)
    :comboLine(catalog,line.serviceMode,{
      cartLineId:line.cartLineId,comboId:line.comboId!,quantity:line.quantity,
      comboSelections:selectedComboChoices(line),
    },true);
}

function materialSignature(line:MfpOrderingDraftLine){
  return JSON.stringify({
    kind:line.kind,productId:line.productId,comboId:line.comboId,
    optionSelections:line.optionSelections,comboSelections:line.comboSelections,
    materialPriceFacts:line.materialPriceFacts,
  });
}

export function createMfpOrderingDomain(catalog:MfpOrderingCatalog):MfpOrderingDomain{
  const domain:MfpOrderingDomain={
    catalog,
    createDraft(serviceMode){return Object.freeze({draftOnly:true,serviceMode,lines:Object.freeze([])});},
    defaultProductSelection(productId){
      const product=catalog.products.find(row=>row.productId===productId);
      if(!product)throw new Error('MFP_ORDERING_PRODUCT_NOT_FOUND');
      return Object.freeze(Object.fromEntries(product.optionSets.map(set=>[
        set.id,Object.freeze(set.options.filter(option=>option.sellable&&option.defaultSelected).map(option=>option.id)),
      ])));
    },
    addProduct(draft,input,options){
      return replaceLine(draft,productLine(catalog,draft.serviceMode,input,Boolean(options?.allowIncomplete)),false);
    },
    editProduct(draft,input,options){
      return replaceLine(draft,productLine(catalog,draft.serviceMode,input,Boolean(options?.allowIncomplete)),true);
    },
    addCombo(draft,input,options){
      return replaceLine(draft,comboLine(catalog,draft.serviceMode,input,Boolean(options?.allowIncomplete)),false);
    },
    editCombo(draft,input,options){
      return replaceLine(draft,comboLine(catalog,draft.serviceMode,input,Boolean(options?.allowIncomplete)),true);
    },
    setQuantity(draft,cartLineId,quantity){
      validQuantity(quantity);
      if(!draft.lines.some(line=>line.cartLineId===cartLineId))throw new Error('MFP_ORDERING_CART_LINE_NOT_FOUND');
      return Object.freeze({...draft,lines:Object.freeze(draft.lines.map(line=>line.cartLineId===cartLineId?Object.freeze({...line,quantity}):line))});
    },
    removeLine(draft,cartLineId){
      if(!draft.lines.some(line=>line.cartLineId===cartLineId))throw new Error('MFP_ORDERING_CART_LINE_NOT_FOUND');
      return Object.freeze({...draft,lines:Object.freeze(draft.lines.filter(line=>line.cartLineId!==cartLineId))});
    },
    setServiceMode(draft,serviceMode){
      const lines=draft.lines.map(line=>{
        try{return rebuildLine(catalog,Object.freeze({...line,serviceMode}));}
        catch{return Object.freeze({
          ...line,serviceMode,state:'REVALIDATION_REQUIRED' as const,
          issues:Object.freeze([...new Set([...line.issues,'MFP_ORDERING_PROJECTION_CHANGED'])]),
        });}
      });
      return Object.freeze({draftOnly:true,serviceMode,lines:Object.freeze(lines)});
    },
    reconcile(draft,nextCatalog){
      const lines=draft.lines.map(line=>{
        try{
          const rebuilt=rebuildLine(nextCatalog,line);
          if(rebuilt.state!=='READY'||materialSignature(rebuilt)!==materialSignature(line)){
            return Object.freeze({...line,state:'REVALIDATION_REQUIRED' as const,issues:Object.freeze(['MFP_ORDERING_PROJECTION_CHANGED'])});
          }
          return rebuilt;
        }catch{
          return Object.freeze({...line,state:'REVALIDATION_REQUIRED' as const,issues:Object.freeze(['MFP_ORDERING_PROJECTION_CHANGED'])});
        }
      });
      return Object.freeze({...draft,lines:Object.freeze(lines)});
    },
    normalize(draft){
      const ready=draft.lines.length>0&&draft.lines.every(line=>line.state==='READY');
      const subtotal=draft.lines.every(line=>line.previewUnitMinor!==null)
        ?draft.lines.reduce((sum,line)=>sum+line.previewUnitMinor!*line.quantity,0)
        :null;
      return Object.freeze({
        schema:'mfp.ordering.intent.draft.v1',draftOnly:true,
        pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS',serviceMode:draft.serviceMode,
        checkoutReady:ready,previewSubtotalMinor:subtotal,lines:draft.lines,
      });
    },
  };
  return Object.freeze(domain);
}

export function createMfpOrderingSurfaceDomains(domain:MfpOrderingDomain){
  return Object.freeze({MFP_PAD:domain,MFP_MOBILE:domain});
}
