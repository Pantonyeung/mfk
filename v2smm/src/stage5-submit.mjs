export function smmStage5SubmissionShortRef(submissionId){
  const compact=String(submissionId||'')
    .replace(/^SMM-/i,'')
    .replace(/[^A-Za-z0-9]/g,'')
    .toUpperCase();
  return compact.slice(-6)||'------';
}

export function smmStage5ConfirmedDisplayCode(value){
  const text=String(value||'').trim();
  if(!text||text.length>32)return null;
  if(/^SMM-/i.test(text))return null;
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text))return null;
  return text;
}

export function smmStage5RepairPath(message){
  const code=String(message||'').toUpperCase();
  if(code.includes('SMM_PUBLISHED_PRICE_CHANGED')||code.includes('SMM_MENU_REVISION_CHANGED')){
    return Object.freeze({
      target:'CART',
      title:'餐單／價格已更新',
      detail:'返回購物草稿確認最新內容同總額，再由結帳重新確認。',
    });
  }
  if(code.includes('SMM_DINING_TABLE_NOT_PUBLISHED')||code.includes('SMM_DINING_TARGET_REQUIRED')||code.includes('SMM_DINING_TARGET_INVALID')){
    return Object.freeze({
      target:'CHECKOUT',
      title:'堂食去向需要更新',
      detail:'返回結帳重新選擇目前可用餐枱或者輪候。',
    });
  }
  if(code.includes('SMM_STAFF_UNAUTHORIZED')||code.includes('SMM_LAN_DEVICE_NOT_TRUSTED')){
    return Object.freeze({
      target:'STAFF',
      title:'員工身份需要重新確認',
      detail:'到員工帳戶重新登入／確認可信裝置，再返回結帳。',
    });
  }
  return Object.freeze({
    target:'CHECKOUT',
    title:'訂單未被接受',
    detail:'返回結帳檢查目前資料；正式訂單未建立，可以修正後再處理。',
  });
}
