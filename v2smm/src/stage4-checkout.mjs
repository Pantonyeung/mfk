export const SMM_STAGE4_TENDERS=Object.freeze([
  Object.freeze({value:'CASH',label:'現金'}),
  Object.freeze({value:'ALIPAY',label:'AlipayHK'}),
  Object.freeze({value:'WECHAT',label:'WeChat Pay HK'}),
  Object.freeze({value:'FPS',label:'FPS'}),
  Object.freeze({value:'PAYME',label:'PayMe'}),
]);

export function smmStage4TenderLabel(value){
  return SMM_STAGE4_TENDERS.find(row=>row.value===value)?.label??'未選';
}

export function smmStage4DiningTargetStatus(serviceMode,target,tables){
  if(serviceMode!=='DINE_IN'){
    return Object.freeze({required:false,valid:true,label:'不適用'});
  }
  if(!target){
    return Object.freeze({required:true,valid:false,label:'未選擇堂食去向'});
  }
  const covers=Number(target.covers);
  if(!Number.isSafeInteger(covers)||covers<1||covers>30){
    return Object.freeze({required:true,valid:false,label:'堂食人數無效'});
  }
  if(target.kind==='WAITING'){
    return Object.freeze({required:true,valid:true,label:`輪候 · ${covers} 位`});
  }
  if(target.kind==='TABLE'){
    const table=(tables??[]).find(row=>row.tableId===target.tableId);
    if(!table)return Object.freeze({required:true,valid:false,label:'餐枱已不可用，請重新選擇'});
    return Object.freeze({required:true,valid:true,label:`${table.label} · ${covers} 位`});
  }
  return Object.freeze({required:true,valid:false,label:'堂食去向無效'});
}

export function smmStage4CheckoutReady(input){
  const tenderValid=input.serviceMode==='DINE_IN'||SMM_STAGE4_TENDERS.some(row=>row.value===input.tender);
  const total=Number(input.totalMinor);
  return Boolean(
    input.cartLength>0&&
    Number.isSafeInteger(total)&&
    total>=0&&
    !input.hasAttention&&
    tenderValid&&
    input.diningTargetValid
  );
}
