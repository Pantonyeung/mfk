export const MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA='MFK_CUSTOMER_QUOTE_REQUEST_V1' as const;
export const MFK_CUSTOMER_ORDER_INTENT_SCHEMA='MFK_CUSTOMER_ORDER_INTENT_V1' as const;
export const MFK_CUSTOMER_ORDER_ACK_SCHEMA='MFK_CUSTOMER_ORDER_ACK_V1' as const;

export interface CustomerCloudSelection{
  readonly optionGroupId:string;
  readonly optionId:string;
  readonly optionName:string;
}

export type CustomerCloudComboChoiceType='PRODUCT'|'LABEL'|'NONE';

export interface CustomerCloudComboSelection{
  readonly poolId:string;
  readonly groupId:string;
  readonly subPoolId:string;
  readonly choiceId:string;
  readonly choiceType:CustomerCloudComboChoiceType;
  readonly choiceLabel:string;
  readonly productId?:string;
  readonly publishedAdjustmentMinor:number;
}

export interface CustomerCloudComboIntent{
  readonly comboId:string;
  readonly comboName:string;
  readonly publishedBasePriceMinor:number;
  readonly selections:readonly CustomerCloudComboSelection[];
}

export interface CustomerCloudCartLine{
  readonly lineId:string;
  readonly productId:string;
  readonly productName:string;
  readonly quantity:number;
  readonly selectedVariationId?:string;
  readonly selectedVariationName?:string;
  readonly selections:readonly CustomerCloudSelection[];
  readonly combo?:CustomerCloudComboIntent;
  readonly note?:string;
  readonly publishedUnitPriceMinor?:number;
}
export interface CustomerReorderIntentSelection{
  readonly optionGroupId:string;
  readonly optionId:string;
  readonly optionName:string;
}

export interface CustomerReorderIntentComboSelection{
  readonly poolId:string;
  readonly groupId:string;
  readonly subPoolId:string;
  readonly choiceId:string;
  readonly choiceType:CustomerCloudComboChoiceType;
  readonly choiceLabel:string;
  readonly productId?:string;
}

export interface CustomerReorderIntentCombo{
  readonly comboId:string;
  readonly comboName:string;
  readonly selections:readonly CustomerReorderIntentComboSelection[];
}

export interface CustomerReorderIntentLine{
  readonly productId:string;
  readonly productName:string;
  readonly quantity:number;
  readonly selectedVariationId?:string;
  readonly selectedVariationName?:string;
  readonly selections:readonly CustomerReorderIntentSelection[];
  readonly combo?:CustomerReorderIntentCombo;
  readonly note?:string;
}

export interface CustomerReorderHistoryPriceFact{
  readonly intentIndex:number;
  readonly historicalPublishedUnitMinor?:number;
}

export function customerReorderHistoryPriceFactsFromCart(
  cart:readonly CustomerCloudCartLine[],
):readonly CustomerReorderHistoryPriceFact[]{
  return Object.freeze(cart.map((line,intentIndex)=>Object.freeze({
    intentIndex,
    ...(Number.isSafeInteger(Number(line.publishedUnitPriceMinor))&&Number(line.publishedUnitPriceMinor)>=0
      ?{historicalPublishedUnitMinor:Number(line.publishedUnitPriceMinor)}
      :{}),
  })));
}

export function customerReorderIntentFromCart(
  cart:readonly CustomerCloudCartLine[],
):readonly CustomerReorderIntentLine[]{
  return Object.freeze(cart.map(line=>Object.freeze({
    productId:line.productId,
    productName:line.productName,
    quantity:line.quantity,
    ...(line.selectedVariationId?{selectedVariationId:line.selectedVariationId}:{}),
    ...(line.selectedVariationName?{selectedVariationName:line.selectedVariationName}:{}),
    selections:Object.freeze(line.selections.map(selection=>Object.freeze({
      optionGroupId:selection.optionGroupId,
      optionId:selection.optionId,
      optionName:selection.optionName,
    }))),
    ...(line.combo?{combo:Object.freeze({
      comboId:line.combo.comboId,
      comboName:line.combo.comboName,
      selections:Object.freeze(line.combo.selections.map(selection=>Object.freeze({
        poolId:selection.poolId,
        groupId:selection.groupId,
        subPoolId:selection.subPoolId,
        choiceId:selection.choiceId,
        choiceType:selection.choiceType,
        choiceLabel:selection.choiceLabel,
        ...(selection.productId?{productId:selection.productId}:{}),
      }))),
    })}:{}),
    ...(line.note?{note:line.note}:{}),
  })));
}

export interface CustomerCloudCheckout{
  readonly name:string;
  readonly phone:string;
  readonly paymentMethod?:'PAY_AT_STORE'|'ELECTRONIC';
  readonly paymentChannelId?:string;
  readonly paymentChannelLabel?:string;
  readonly paymentEvidenceRef?:string;
}
export interface MfkCustomerQuoteRequest{
  readonly schema:typeof MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA;
  readonly storeId:'MF01';
  readonly requestId:string;
  readonly createdAt:string;
  readonly cart:readonly CustomerCloudCartLine[];
}
export interface MfkCustomerOrderIntent{
  readonly schema:typeof MFK_CUSTOMER_ORDER_INTENT_SCHEMA;
  readonly storeId:'MF01';
  readonly submissionId:string;
  readonly menuRevision:string;
  readonly idempotencyKey:string;
  readonly createdAt:string;
  readonly updatedAt:string;
  readonly cart:readonly CustomerCloudCartLine[];
  readonly checkout:CustomerCloudCheckout;
}

function object(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}
function text(value:unknown,code:string,max=240){
  if(typeof value!=='string')throw new Error(code);
  const out=value.trim();
  if(!out||out.length>max)throw new Error(code);
  return out;
}
function instant(value:unknown,code:string){
  const out=text(value,code,80);
  if(!Number.isFinite(Date.parse(out)))throw new Error(code);
  return out;
}
function qty(value:unknown,code:string){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1||n>99)throw new Error(code);
  return n;
}
function money(value:unknown,code:string){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw new Error(code);
  return n;
}
function signedMoney(value:unknown,code:string){
  const n=Number(value);
  if(!Number.isSafeInteger(n))throw new Error(code);
  return n;
}
function onlyKeys(row:Record<string,unknown>,allowed:readonly string[],code:string){
  const allow=new Set(allowed);
  if(Object.keys(row).some(key=>!allow.has(key)))throw new Error(code);
}
function optionalText(value:unknown,max=240){
  if(value===undefined||value===null||value==='')return undefined;
  return text(value,'CUSTOMER_OPTIONAL_TEXT_INVALID',max);
}
function selection(value:unknown,index:number):CustomerCloudSelection{
  const row=object(value,'CUSTOMER_SELECTION_INVALID_'+index);
  return Object.freeze({
    optionGroupId:text(row.optionGroupId,'CUSTOMER_SELECTION_GROUP_INVALID_'+index,120),
    optionId:text(row.optionId,'CUSTOMER_SELECTION_ID_INVALID_'+index,120),
    optionName:text(row.optionName,'CUSTOMER_SELECTION_NAME_INVALID_'+index,160),
  });
}

function comboSelection(value:unknown,index:number):CustomerCloudComboSelection{
  const row=object(value,'CUSTOMER_COMBO_SELECTION_INVALID_'+index);
  onlyKeys(row,['poolId','groupId','subPoolId','choiceId','choiceType','choiceLabel','productId','publishedAdjustmentMinor'],'CUSTOMER_COMBO_SELECTION_UNKNOWN_'+index);
  const choiceType:CustomerCloudComboChoiceType=
    row.choiceType==='PRODUCT'?'PRODUCT':
    row.choiceType==='LABEL'?'LABEL':
    row.choiceType==='NONE'?'NONE':
    (()=>{throw new Error('CUSTOMER_COMBO_CHOICE_TYPE_INVALID_'+index)})();
  const productId=optionalText(row.productId,160);
  if(choiceType==='PRODUCT'&&!productId)throw new Error('CUSTOMER_COMBO_PRODUCT_ID_REQUIRED_'+index);
  return Object.freeze({
    poolId:text(row.poolId,'CUSTOMER_COMBO_POOL_ID_INVALID_'+index,160),
    groupId:text(row.groupId,'CUSTOMER_COMBO_GROUP_ID_INVALID_'+index,160),
    subPoolId:text(row.subPoolId,'CUSTOMER_COMBO_SUBPOOL_ID_INVALID_'+index,160),
    choiceId:text(row.choiceId,'CUSTOMER_COMBO_CHOICE_ID_INVALID_'+index,160),
    choiceType,
    choiceLabel:text(row.choiceLabel,'CUSTOMER_COMBO_CHOICE_LABEL_INVALID_'+index,200),
    ...(productId?{productId}:{}),
    publishedAdjustmentMinor:signedMoney(row.publishedAdjustmentMinor,'CUSTOMER_COMBO_ADJUSTMENT_INVALID_'+index),
  });
}

function comboIntent(value:unknown,lineIndex:number):CustomerCloudComboIntent{
  const row=object(value,'CUSTOMER_COMBO_INVALID_'+lineIndex);
  onlyKeys(row,['comboId','comboName','publishedBasePriceMinor','selections'],'CUSTOMER_COMBO_UNKNOWN_'+lineIndex);
  if(!Array.isArray(row.selections)||row.selections.length>40)throw new Error('CUSTOMER_COMBO_SELECTIONS_INVALID_'+lineIndex);
  return Object.freeze({
    comboId:text(row.comboId,'CUSTOMER_COMBO_ID_INVALID_'+lineIndex,160),
    comboName:text(row.comboName,'CUSTOMER_COMBO_NAME_INVALID_'+lineIndex,200),
    publishedBasePriceMinor:money(row.publishedBasePriceMinor,'CUSTOMER_COMBO_BASE_PRICE_INVALID_'+lineIndex),
    selections:Object.freeze(row.selections.map((item,index)=>comboSelection(item,index))),
  });
}

function line(value:unknown,index:number):CustomerCloudCartLine{
  const row=object(value,'CUSTOMER_CART_LINE_INVALID_'+index);
  if(!Array.isArray(row.selections))throw new Error('CUSTOMER_CART_SELECTIONS_INVALID_'+index);
  const variationId=optionalText(row.selectedVariationId,120);
  const variationName=optionalText(row.selectedVariationName,160);
  return Object.freeze({
    lineId:text(row.lineId,'CUSTOMER_CART_LINE_ID_INVALID_'+index,160),
    productId:text(row.productId,'CUSTOMER_CART_PRODUCT_ID_INVALID_'+index,120),
    productName:text(row.productName,'CUSTOMER_CART_PRODUCT_NAME_INVALID_'+index,200),
    quantity:qty(row.quantity,'CUSTOMER_CART_QTY_INVALID_'+index),
    ...(variationId?{selectedVariationId:variationId}:{}),
    ...(variationName?{selectedVariationName:variationName}:{}),
    selections:Object.freeze(row.selections.map(selection)),
    ...(row.combo!==undefined?{combo:comboIntent(row.combo,index)}:{}),
    ...(optionalText(row.note,240)?{note:optionalText(row.note,240)}:{}),
    ...(Number.isSafeInteger(Number(row.publishedUnitPriceMinor))&&Number(row.publishedUnitPriceMinor)>=0?{publishedUnitPriceMinor:Number(row.publishedUnitPriceMinor)}:{}),
  });
}
function cart(value:unknown){
  if(!Array.isArray(value)||value.length<1||value.length>100)throw new Error('CUSTOMER_CART_INVALID');
  return Object.freeze(value.map(line));
}

export function validateMfkCustomerQuoteRequest(input:unknown):MfkCustomerQuoteRequest{
  const row=object(input,'CUSTOMER_QUOTE_REQUEST_INVALID');
  if(row.schema!==MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA)throw new Error('CUSTOMER_QUOTE_SCHEMA_INVALID');
  if(row.storeId!=='MF01')throw new Error('CUSTOMER_STORE_INVALID');
  return Object.freeze({
    schema:MFK_CUSTOMER_QUOTE_REQUEST_SCHEMA,
    storeId:'MF01',
    requestId:text(row.requestId,'CUSTOMER_QUOTE_REQUEST_ID_INVALID',160),
    createdAt:instant(row.createdAt,'CUSTOMER_QUOTE_CREATED_AT_INVALID'),
    cart:cart(row.cart),
  });
}

export function validateMfkCustomerOrderIntent(input:unknown):MfkCustomerOrderIntent{
  const row=object(input,'CUSTOMER_ORDER_INTENT_INVALID');
  if(row.schema!==MFK_CUSTOMER_ORDER_INTENT_SCHEMA)throw new Error('CUSTOMER_ORDER_SCHEMA_INVALID');
  if(row.storeId!=='MF01')throw new Error('CUSTOMER_STORE_INVALID');
  const checkout=object(row.checkout,'CUSTOMER_CHECKOUT_INVALID');
  const phone=text(checkout.phone,'CUSTOMER_PHONE_INVALID',40);
  const paymentChannelId=checkout.paymentMethod==='ELECTRONIC'?String(checkout.paymentChannelId||'').trim().toUpperCase():'';
  const paymentChannelLabel=checkout.paymentMethod==='ELECTRONIC'?String(checkout.paymentChannelLabel||'').trim():'';
  if(checkout.paymentMethod==='ELECTRONIC'&&!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(paymentChannelId))throw new Error('CUSTOMER_PAYMENT_CHANNEL_INVALID');
  if(checkout.paymentMethod==='ELECTRONIC'&&(!paymentChannelLabel||paymentChannelLabel.length>120))throw new Error('CUSTOMER_PAYMENT_CHANNEL_LABEL_INVALID');
  if(phone.replace(/\D/g,'').length<8)throw new Error('CUSTOMER_PHONE_INVALID');
  return Object.freeze({
    schema:MFK_CUSTOMER_ORDER_INTENT_SCHEMA,
    storeId:'MF01',
    submissionId:text(row.submissionId,'CUSTOMER_SUBMISSION_ID_INVALID',180),
    menuRevision:text(row.menuRevision,'CUSTOMER_MENU_REVISION_REQUIRED',180),
    idempotencyKey:text(row.idempotencyKey,'CUSTOMER_IDEMPOTENCY_KEY_INVALID',220),
    createdAt:instant(row.createdAt,'CUSTOMER_CREATED_AT_INVALID'),
    updatedAt:instant(row.updatedAt,'CUSTOMER_UPDATED_AT_INVALID'),
    cart:cart(row.cart),
    checkout:Object.freeze({
      name:typeof checkout.name==='string'?checkout.name.trim().slice(0,120):'',
      phone,
      paymentMethod:checkout.paymentMethod==='ELECTRONIC'?'ELECTRONIC':'PAY_AT_STORE',
      ...(checkout.paymentMethod==='ELECTRONIC'?{paymentChannelId,paymentChannelLabel}:{}),
      ...(checkout.paymentMethod==='ELECTRONIC'&&optionalText(checkout.paymentEvidenceRef,500)?{paymentEvidenceRef:optionalText(checkout.paymentEvidenceRef,500)}:{}),
    }),
  });
}
