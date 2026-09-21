import {comboPriceFromSelection} from './combo-rules.js';

export function updateCartLineQuantity(cart,lineId,delta,drinkSlotsByProduct={}){
  return cart.flatMap(line=>{
    if(line.lineId!==lineId)return [line];
    const qty=Number(line.qty||0)+Number(delta||0);
    if(qty<=0)return [];
    const slotsPerUnit=line.lineType==='combo'?1:Number(drinkSlotsByProduct[line.productId]||0);
    return [{...line,qty,total:Number(line.unitPrice||0)*qty,drinkSlots:slotsPerUnit*qty,drinkAssignments:(line.drinkAssignments||[]).slice(0,slotsPerUnit*qty)}];
  });
}

function takeOne(cart,lineId){
  let taken=null;
  const remaining=cart.flatMap(line=>{
    if(line.lineId!==lineId)return [line];
    taken={...line,qty:1,total:Number(line.unitPrice||0),drinkAssignments:(line.drinkAssignments||[]).slice(0,1)};
    if(Number(line.qty||0)<=1)return [];
    return [{...line,qty:line.qty-1,total:Number(line.unitPrice||0)*(line.qty-1),drinkAssignments:(line.drinkAssignments||[]).slice(1)}];
  });
  return {taken,remaining};
}

function component(role,line,source='cart'){
  if(!line)return null;
  return {
    role,source,productId:line.productId||line.drinkId||'',name:line.name||'',image:line.image||'',
    category:line.category||'',categories:Array.isArray(line.categories)?line.categories:[],
    unitPrice:Number(line.unitPrice??line.price??0),options:{...(line.options||{})},selection:line.selection||'',
    drinkId:line.drinkId||line.productId||'',studentDiscountEligible:line.studentDiscountEligible===true,
    specialDrinkSurcharge:Number(line.specialDrinkSurcharge)||0
  };
}

export function combineRiceballSet(cart,selection,options={}){
  let result=[...cart];
  const mainResult=takeOne(result,selection.mainLineId);
  if(!mainResult.taken)return result;
  result=mainResult.remaining;
  const snackResult=takeOne(result,selection.snackLineId);
  if(!snackResult.taken)return cart;
  result=snackResult.remaining;
  let drink=null;
  if(selection.drinkLineId){
    const drinkResult=takeOne(result,selection.drinkLineId);
    drink=drinkResult.taken;
    result=drinkResult.remaining;
  }else if(selection.quickDrink){
    const quickId=selection.quickDrink.drinkId||selection.quickDrink.selection?.drinkId||selection.quickDrink.productId||selection.quickDrink.id;
    drink={...selection.quickDrink,productId:quickId,drinkId:quickId,unitPrice:Number(selection.quickDrink.unitPrice??selection.quickDrink.price??0)};
  }
  const mainComponent=component('main',mainResult.taken);
  const snackComponent=component('snack',snackResult.taken);
  const drinkComponent=component('drink',drink,selection.quickDrink?'quick':'cart');
  const components=[mainComponent,snackComponent,drinkComponent].filter(Boolean);
  const singleTotal=components.reduce((sum,item)=>sum+item.unitPrice,0);
  const pricing=comboPriceFromSelection({main:mainComponent,snack:snackComponent,drink:drinkComponent});
  if(!pricing.basePrice)return cart;
  const comboPrice=pricing.total;
  const missingRoles=drink?[]:['drink'];
  const drinkAssignments=drink?[{drinkId:drink.drinkId||drink.productId,name:drink.name,image:drink.image||'',sweetness:'',ice:'',source:selection.quickDrink?'quick':'cart',studentDiscountEligible:drink.studentDiscountEligible===true,specialDrinkSurcharge:Number(drink.specialDrinkSurcharge)||0}]:[];
  result.push({
    lineId:options.lineId||'riceball-combo-'+Date.now(),lineType:'combo',productId:'riceball-combo',name:'飯糰套餐',category:'飯糰套餐',
    image:mainResult.taken.image||'',qty:1,unitPrice:comboPrice,total:comboPrice,required:['drink'],drinkSlots:1,drinkAssignments,
    options:{},createdOrder:Number(options.createdOrder||Date.now()),
    combo:{id:options.comboId||'combo-'+Date.now(),kind:'riceball-set',source:options.source||'custom',components,missingRoles,singleTotal,comboPrice,basePrice:pricing.basePrice,snackSurcharge:pricing.snackSurcharge,drinkSurcharge:pricing.drinkSurcharge,discount:Math.max(0,singleTotal-comboPrice)}
  });
  return result;
}

export function dissolveRiceballSet(cart,comboLineId,options={}){
  const makeId=options.idFactory||((role)=>'line-'+role+'-'+Date.now());
  return cart.flatMap(line=>{
    if(line.lineId!==comboLineId||line.lineType!=='combo')return [line];
    const qty=Math.max(1,Number(line.qty||1));
    return (line.combo?.components||[]).map(item=>({
      lineId:makeId(item.role),lineType:'product',productId:item.productId,name:item.name,image:item.image||'',
      category:item.role==='main'?'飯團':item.role==='snack'?'小食':'飲品',qty,
      unitPrice:Number(item.unitPrice||0),total:Number(item.unitPrice||0)*qty,options:{...(item.options||{})},
      required:[],drinkSlots:0,drinkAssignments:[],createdOrder:Number(line.createdOrder||Date.now())
    }));
  });
}

export const ORDER_AUTO_COMPLETE_MS=30*60*1000;
export function acceptPendingOrder(order,acceptedAt=Date.now()){return {...order,status:'running',acceptedAt,autoCompleteAt:acceptedAt+ORDER_AUTO_COMPLETE_MS};}
export function completeExpiredOrders(orders,now=Date.now()){return orders.map(order=>order.status==='running'&&Number(order.autoCompleteAt)<=now?{...order,status:'completed',completedAt:now}:order);}
export function createWhatsAppLink(phone,message){const normalized=String(phone||'').replace(/\D/g,'');return 'https://wa.me/'+normalized+'?text='+encodeURIComponent(String(message||''));}
