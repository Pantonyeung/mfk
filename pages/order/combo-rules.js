const normalize=value=>String(value??'')
  .trim()
  .replace(/\s+/g,'')
  .replace(/[＋+]/g,'＋')
  .replace(/飯糰/g,'飯團');

const riceballTiers=[
  {tier:'A',basePrice:41,names:['古早味','菠蘿','鹹蛋黃','芝士']},
  {tier:'B',basePrice:43,names:['麻醬雞絲','芥末雞絲','麻辣雞絲','檸檬雞絲','吞拿魚','鹹牛肉','芒果菠蘿','海蜇','泡菜']},
  {tier:'C',basePrice:45,names:['蜜糖芥末雞絲','火辣雞絲','芝士泡菜','蟹柳','麻辣海蜇','蟹籽']},
  {tier:'D',basePrice:47,names:['鰻魚','招牌雞粒','多春魚','蝦肉','八爪魚','椒麻雞','黑松露雞絲','天婦炸蝦']}
];

const comboSnacks=[
  {surcharge:0,names:['涼拌青瓜','滋味牛丸','芋頭番薯波波','豆豆紫薯波波','酥皮椰奶','QQ米餅']},
  {surcharge:3,names:['涼拌西蘭花','台灣一口腸','韭菜餃','流心黑糖麻糬','香辣地瓜條','韭菜豆腐餃','粒粒雞髀菇']},
  {surcharge:5,names:['古早鹽酥雞','鹽酥雞','魷魚波波','孜味脆雞','海苔多春魚','天神炸雞']}
];

export const drinkUpgradeRules={noDrink:-1,servedHot:0,servedIced:3,coldBrewOrSparkling:6,taiwanMilkTea:8,handLemonTea:10};

function findByName(groups,name){
  const target=normalize(name);
  for(const group of groups){
    const matched=group.names.find(item=>target===normalize(item)||target.includes(normalize(item))||normalize(item).includes(target));
    if(matched)return group;
  }
  return null;
}

export function resolveRiceballComboRule(product={}){
  const categoryText=normalize([product.category,...(product.categories||[])].join('|'));
  if(!categoryText.includes('飯團')||categoryText.includes('飯團套餐'))return null;
  const tier=findByName(riceballTiers,product.name);
  return tier?{role:'riceball_main',comboEligible:true,comboTier:tier.tier,comboBasePrice:tier.basePrice}:null;
}

export function resolveSnackComboRule(product={}){
  const categoryText=normalize([product.category,...(product.categories||[])].join('|'));
  const matched=findByName(comboSnacks,product.name);
  if(matched)return {role:'combo_snack',comboEligible:true,comboSurcharge:matched.surcharge};
  if(categoryText.includes('小食'))return {role:'single_snack',comboEligible:false,comboSurcharge:0};
  return null;
}

export function resolveDrinkUpgradeRule(product={}){
  const name=normalize(product.name);
  if(name.includes('不需要飲品')||name.includes('無需飲品'))return {role:'combo_drink',specialDrinkSurcharge:-1};
  if(name.includes('熱水')||name.includes('熱檸水')||name.includes('隨餐熱飲'))return {role:'combo_drink',specialDrinkSurcharge:0};
  if(name.includes('凍檸茶')||name.includes('凍檸水')||name.includes('轉凍'))return {role:'combo_drink',specialDrinkSurcharge:3};
  if(name.includes('冷泡')||name.includes('氣泡水'))return {role:'combo_drink',specialDrinkSurcharge:6};
  if(name.includes('台式奶茶'))return {role:'combo_drink',specialDrinkSurcharge:8};
  if(name.includes('手打檸檬茶'))return {role:'combo_drink',specialDrinkSurcharge:10};
  return null;
}

export function resolveTemporaryComboRule(product={}){
  return resolveRiceballComboRule(product)||resolveSnackComboRule(product)||resolveDrinkUpgradeRule(product)||null;
}

export function comboPriceFromSelection({main,snack,drink}={}){
  const mainRule=resolveRiceballComboRule(main||{})||{};
  const snackRule=resolveSnackComboRule(snack||{})||{};
  const drinkRule=resolveDrinkUpgradeRule(drink||{})||{};
  const basePrice=Number(mainRule.comboBasePrice||0);
  const snackSurcharge=Number(snackRule.comboSurcharge||0);
  const drinkSurcharge=Number(drink?.specialDrinkSurcharge??drinkRule.specialDrinkSurcharge??0);
  return {basePrice,snackSurcharge,drinkSurcharge,total:basePrice+snackSurcharge+drinkSurcharge};
}
