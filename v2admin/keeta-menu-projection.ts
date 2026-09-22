export interface KeetaMenuProjectionResult{
  readonly payload:{
    readonly shopCategoryList:readonly Record<string,unknown>[];
    readonly choiceGroupList:readonly Record<string,unknown>[];
    readonly spuList:readonly Record<string,unknown>[];
    readonly spuSequenceCodeMap:Readonly<Record<string,readonly string[]>>;
  };
  readonly summary:{
    readonly categories:number;
    readonly choiceGroups:number;
    readonly options:number;
    readonly spus:number;
    readonly skus:number;
  };
  readonly issues:readonly string[];
}

const record=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const array=(value:unknown)=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const decimal=(value:unknown,code:string)=>{
  const raw=String(value??'').trim();
  const amount=Number(raw);
  if(!raw||!Number.isFinite(amount))throw new Error(code);
  return amount.toFixed(2);
};
const safeCode=(prefix:string,value:string)=>prefix+':'+value.replace(/[^A-Za-z0-9._:-]/g,'_');

function effectiveTakeawayPrice(product:Record<string,unknown>){
  const base=Number(product.basePrice);
  if(!Number.isFinite(base)||base<0)throw new Error('KEETA_MENU_PRODUCT_PRICE_INVALID:'+String(product.id??''));
  const surcharge=product.takeawaySurchargeEnabled===true?Number(product.takeawayAdjustment||0):0;
  if(!Number.isFinite(surcharge))throw new Error('KEETA_MENU_TAKEAWAY_ADJUSTMENT_INVALID:'+String(product.id??''));
  const value=base+surcharge;
  if(value<0)throw new Error('KEETA_MENU_TAKEAWAY_PRICE_NEGATIVE:'+String(product.id??''));
  return value.toFixed(2);
}

export function buildKeetaMenuProjection(adminSnapshot:unknown):KeetaMenuProjectionResult{
  const root=record(adminSnapshot);
  if(!root)throw new Error('KEETA_MENU_ADMIN_SNAPSHOT_REQUIRED');
  const catalog=record(root.catalog);
  if(!catalog)throw new Error('KEETA_MENU_CATALOG_REQUIRED');
  const optionCenter=record(root.optionCenter);

  const categories=array(catalog.categories).map(record).filter(Boolean) as Record<string,unknown>[];
  const products=array(catalog.products).map(record).filter(Boolean) as Record<string,unknown>[];
  const sets=array(optionCenter?.sets).map(record).filter(Boolean) as Record<string,unknown>[];
  const links=array(optionCenter?.productLinks).map(record).filter(Boolean) as Record<string,unknown>[];

  const issues:string[]=[];
  const categoryById=new Map<string,Record<string,unknown>>();
  const categoryCodes=new Map<string,string>();
  const categoryNames=new Set<string>();
  for(const category of categories){
    const id=text(category.id),name=text(category.name);
    if(!id)issues.push('KEETA_MENU_CATEGORY_ID_REQUIRED');
    if(!name)issues.push('KEETA_MENU_CATEGORY_NAME_REQUIRED');
    if(name&&categoryNames.has(name))issues.push('KEETA_MENU_CATEGORY_NAME_DUPLICATE:'+name);
    if(name)categoryNames.add(name);
    if(id){
      categoryById.set(id,category);
      categoryCodes.set(id,safeCode('CAT',id));
    }
  }

  const productCodes=new Set<string>();
  for(const product of products){
    const id=text(product.id);
    const code=text(product.productCode)||id;
    if(!id)issues.push('KEETA_MENU_PRODUCT_ID_REQUIRED');
    if(!code)issues.push('KEETA_MENU_PRODUCT_CODE_REQUIRED:'+id);
    if(code&&productCodes.has(code))issues.push('KEETA_MENU_PRODUCT_CODE_DUPLICATE:'+code);
    if(code)productCodes.add(code);
    const categoryId=text(product.categoryId);
    if(!categoryById.has(categoryId))issues.push('KEETA_MENU_PRODUCT_CATEGORY_REQUIRED:'+id);
    try{decimal(product.basePrice,'KEETA_MENU_PRODUCT_PRICE_INVALID:'+id);}catch(error){issues.push(error instanceof Error?error.message:String(error));}
  }

  const setById=new Map<string,Record<string,unknown>>();
  for(const set of sets){
    const id=text(set.id);
    if(!id){issues.push('KEETA_MENU_OPTION_SET_ID_REQUIRED');continue;}
    setById.set(id,set);
  }
  const linksByProduct=new Map<string,string[]>();
  for(const link of links){
    const productId=text(link.productId),setId=text(link.setId);
    if(!productId||!setId)continue;
    if(!setById.has(setId)){issues.push('KEETA_MENU_OPTION_SET_LINK_INVALID:'+productId+':'+setId);continue;}
    linksByProduct.set(productId,[...(linksByProduct.get(productId)??[]),setId]);
  }

  if(categories.length>100)issues.push('KEETA_MENU_CATEGORY_LIMIT_EXCEEDED');
  if(sets.length>2000)issues.push('KEETA_MENU_CHOICE_GROUP_LIMIT_EXCEEDED');
  if(products.length>2000)issues.push('KEETA_MENU_SPU_LIMIT_EXCEEDED');

  const shopCategoryList=categories
    .slice()
    .sort((a,b)=>Number(a.position||0)-Number(b.position||0))
    .map(category=>Object.freeze({
      openItemCode:categoryCodes.get(text(category.id))!,
      name:text(category.name),
      sourceLanguageType:'zh-HK',
      type:0,
    }));

  let optionCount=0;
  const choiceGroupList=sets.map(set=>{
    const setId=text(set.id);
    const options=array(set.options).map(record).filter(Boolean) as Record<string,unknown>[];
    optionCount+=options.length;
    const choiceGroupSkuList=options.map(option=>{
      const optionId=text(option.code)||text(option.id);
      if(!optionId)issues.push('KEETA_MENU_OPTION_CODE_REQUIRED:'+setId);
      const price=decimal(option.priceAdjustment??'0','KEETA_MENU_OPTION_PRICE_INVALID:'+setId+':'+optionId);
      return Object.freeze({
        openItemCode:safeCode('OPT',setId+':'+optionId),
        name:text(option.name)||optionId,
        sourceLanguageType:'zh-HK',
        price,
        pickPrice:price,
        canteenPrice:price,
        currency:'HKD',
        status:option.active===false?0:1,
      });
    });
    return Object.freeze({
      openItemCode:safeCode('GRP',setId),
      name:text(set.name)||setId,
      sourceLanguageType:'zh-HK',
      minNumber:Math.max(0,Number(set.min)||0),
      maxNumber:Math.max(0,Number(set.max)||0),
      repeatable:set.allowQuantities===true?1:0,
      choiceGroupSkuList:Object.freeze(choiceGroupSkuList),
    });
  });
  if(optionCount>10000)issues.push('KEETA_MENU_CHOICE_GROUP_SKU_LIMIT_EXCEEDED');

  const activeProducts=products.filter(product=>product.active!==false);
  const spuList=activeProducts.map(product=>{
    const id=text(product.id);
    const productCode=text(product.productCode)||id;
    const categoryId=text(product.categoryId);
    const categoryCode=categoryCodes.get(categoryId);
    const linkedSets=linksByProduct.get(id)??array(product.modifierGroupIds).map(value=>String(value));
    const groupCodes=linkedSets.filter(setId=>setById.has(setId)).map(setId=>safeCode('GRP',setId));
    const price=effectiveTakeawayPrice(product);
    const description=text(product.description);
    const imageRef=text(product.imageRef);
    return Object.freeze({
      openItemCode:safeCode('SPU',productCode),
      name:text(product.name)||productCode,
      sourceLanguageType:'zh-HK',
      status:1,
      isSpecialty:0,
      ...(description?{description,descSourceLanguageType:'zh-HK'}:{}),
      ...(imageRef&&/^https?:\/\//i.test(imageRef)?{pictureList:[{url:imageRef}]}:{}),
      shopCategoryOpenItemCodeList:categoryCode?[categoryCode]:[],
      userGetModeList:['delivery','pickup'],
      skuList:[Object.freeze({
        openItemCode:productCode,
        spec:'',
        sourceLanguageType:'zh-HK',
        price,
        pickPrice:price,
        canteenPrice:decimal(product.basePrice,'KEETA_MENU_PRODUCT_PRICE_INVALID:'+id),
        currency:'HKD',
        choiceGroupOpenItemCodeList:groupCodes,
      })],
    });
  });

  const spuSequenceCodeMap:Record<string,readonly string[]>={};
  for(const category of categories.slice().sort((a,b)=>Number(a.position||0)-Number(b.position||0))){
    const categoryId=text(category.id);
    const code=categoryCodes.get(categoryId);
    if(!code)continue;
    spuSequenceCodeMap[code]=Object.freeze(activeProducts
      .filter(product=>text(product.categoryId)===categoryId)
      .map(product=>safeCode('SPU',text(product.productCode)||text(product.id))));
  }

  if(issues.length)throw new Error([...new Set(issues)].join(','));
  return Object.freeze({
    payload:Object.freeze({
      shopCategoryList:Object.freeze(shopCategoryList),
      choiceGroupList:Object.freeze(choiceGroupList),
      spuList:Object.freeze(spuList),
      spuSequenceCodeMap:Object.freeze(spuSequenceCodeMap),
    }),
    summary:Object.freeze({
      categories:shopCategoryList.length,
      choiceGroups:choiceGroupList.length,
      options:optionCount,
      spus:spuList.length,
      skus:spuList.length,
    }),
    issues:Object.freeze([]),
  });
}
