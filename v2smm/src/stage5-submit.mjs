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

export function smmStage5DisplaySuffix(value){
  const text=smmStage5ConfirmedDisplayCode(value);
  if(!text)return '—';
  const digits=text.replace(/\D/g,'');
  return digits?digits.slice(-3).padStart(3,'0'):text;
}

export function smmStage5SharedState(connection,hasSession=true){
  if(!hasSession)return Object.freeze({kind:'EMPTY',icon:'◇',label:'暫無資料',detail:'未有正式提交工作。'});
  if(connection==='LOADING')return Object.freeze({kind:'LOADING',icon:'◌',label:'載入中…',detail:'正在讀取門店狀態。'});
  if(connection==='NOT_CONNECTED')return Object.freeze({kind:'OFFLINE',icon:'⌁',label:'離線中',detail:'傳輸通道未連接；交易結果狀態保持獨立。'});
  if(connection==='STALE')return Object.freeze({kind:'STALE',icon:'◷',label:'資料較舊',detail:'畫面使用最近一次讀回；不改寫提交結果。'});
  if(connection==='PARTIAL')return Object.freeze({kind:'PARTIAL',icon:'◫',label:'部分可用',detail:'部分門店資料未完整；不改寫提交結果。'});
  if(connection==='UNKNOWN')return Object.freeze({kind:'UNKNOWN',icon:'?',label:'連線狀態未明',detail:'只代表傳輸／資料狀態，唔等於交易 UNKNOWN。'});
  if(connection==='ERROR')return Object.freeze({kind:'ERROR',icon:'!',label:'發生錯誤',detail:'門店資料同步失敗；不會自動重新提交。'});
  return null;
}

export function smmStage5RepairPath(message){
  const code=String(message||'').toUpperCase();
  if(code.includes('SMM_PUBLISHED_PRICE_CHANGED')||code.includes('SMM_MENU_REVISION_CHANGED')){
    return Object.freeze({
      target:'CART',
      title:'部分商品或價格已更新',
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
    title:'門店未能接受今次訂單',
    detail:'返回結帳檢查目前資料；正式訂單未建立，可以修正後再處理。',
  });
}
