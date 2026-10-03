/** This acceptance shell has no authenticated Customer providers or activation flag. */
export const CUSTOMER_ACCEPTANCE=Object.freeze({
  mode:'acceptance-preview',
  orderSubmission:false,
  paymentProofUpload:false,
  paymentConfirmation:false,
  notice:'菜單、價格、營業狀態、會員及訂單均為示範資料；瀏覽及記憶罐只供驗收。正式資料、身份、付款、落單及訂單狀態服務未接駁，不能送出訂單、上載憑證或確認收款。'
} as const);
