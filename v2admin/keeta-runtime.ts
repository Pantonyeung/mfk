import {buildKeetaMenuProjection} from './keeta-menu-projection.ts';
import {buildKeetaSellabilityProjection,buildKeetaWeeklyHoursProjection,chunkKeetaSpuStatus} from './keeta-store-projection.ts';
import {MFK_KEETA_ORDER_INTENT_SCHEMA,validateMfkKeetaOrderAck} from '../contracts/keeta-order-intake-v1.ts';
import {normalizeKeetaStandardProviderOrderFacts} from '../integrations/keeta/src/order-facts.js';
const KEETA_AUTHORIZE_URL='https://merchant.mykeeta.com/m/web/openapi/authorize';
const KEETA_TOKEN_URL='https://open.mykeeta.com/api/open/base/oauth/token';
const KEETA_MENU_SYNC_URL='https://open.mykeeta.com/api/open/product/menu/sync';
const KEETA_ORDER_CONFIRM_URL='https://open.mykeeta.com/api/open/order/confirm';
const KEETA_ORDER_READY_URL='https://open.mykeeta.com/api/open/order/prepare';
const KEETA_ORDER_GET_URL='https://open.mykeeta.com/api/open/order/get';
const KEETA_REFUND_AGREE_URL='https://open.mykeeta.com/api/open/order/agree';
const KEETA_REFUND_REJECT_URL='https://open.mykeeta.com/api/open/order/reject';
const KEETA_PARTIAL_REFUND_PREVIEW_URL='https://open.mykeeta.com/api/open/order/refund/part/products/preview';
const KEETA_PARTIAL_REFUND_APPLY_URL='https://open.mykeeta.com/api/open/order/refund/part/apply';
const KEETA_SPU_STATUS_URL='https://open.mykeeta.com/api/open/product/spustatus/batchupdatebycode';
const KEETA_STORE_HOURS_GET_URL='https://open.mykeeta.com/api/open/scm/shop/business/hour/effective/get';
const KEETA_STORE_HOURS_UPDATE_URL='https://open.mykeeta.com/api/open/scm/shop/business/hour/effective/update';
const KEETA_STORE_DETAILS_URL='https://open.mykeeta.com/api/open/scm/shop/base/get';
const KEETA_STORE_REST_URL='https://open.mykeeta.com/api/open/scm/shop/status/rest';
const KEETA_STORE_OPEN_URL='https://open.mykeeta.com/api/open/scm/shop/status/open';
const TOKEN_REFRESH_WINDOW_MS=5*24*60*60*1000;
const TOKEN_REFRESH_MIN_INTERVAL_MS=60_000;
const TOKEN_REFRESH_RETRY_MS=5*60*1000;
const OAUTH_STATE_TTL_MS=10*60*1000;

const KEETA_WEBHOOK_EVENTS=Object.freeze({
  1:'OAUTH2_AUTHORIZATION_CODE',
  1001:'ORDER_PLACEMENT',
  1002:'ORDER_ACCEPTANCE',
  1003:'ORDER_COMPLETION',
  1004:'ORDER_CANCELLATION',
  1005:'REFUND_INITIATION',
  1006:'DELIVERY_STATUS_UPDATE',
  1007:'PARTIAL_REFUND_INITIATION',
  1008:'OBSERVED_SYSTEM_ORDER_CANCELLATION',
  1101:'STORE_BUSINESS_HOURS_CHANGE',
  1102:'STORE_STATUS_CHANGE',
  1201:'PICTURE_BIND_TASK_COMPLETION',
  1202:'MENU_SYNC_TASK_COMPLETION',
  1301:'STORE_AUTHORIZATION_ADDED',
  1302:'STORE_AUTHORIZATION_REMOVED',
  1303:'BRAND_AUTHORIZATION_REVOKED',
});

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const encoder=new TextEncoder();
const decoder=new TextDecoder();

function json(value,status=200,extra={}){
  return new Response(JSON.stringify(value),{status,headers:{...JSON_HEADERS,...extra}});
}
function record(value,code){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value;
}
function nonEmpty(value,code){
  if(typeof value!=='string'||!value.trim())throw new Error(code);
  return value.trim();
}
function positiveInt(value,code){
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<=0)throw new Error(code);
  return parsed;
}

function keetaOrderPlacementIdentity(message){
  let root;
  try{root=JSON.parse(nonEmpty(message,'KEETA_ORDER_MESSAGE_REQUIRED'));}
  catch{throw new Error('KEETA_ORDER_MESSAGE_INVALID_JSON');}
  const messageRow=record(root,'KEETA_ORDER_MESSAGE_INVALID');
  const orderInfo=messageRow.orderInfo&&typeof messageRow.orderInfo==='object'&&!Array.isArray(messageRow.orderInfo)
    ?messageRow.orderInfo
    :messageRow;
  const baseOrder=orderInfo.baseOrder&&typeof orderInfo.baseOrder==='object'&&!Array.isArray(orderInfo.baseOrder)
    ?orderInfo.baseOrder
    :null;
  if(!baseOrder)throw new Error('KEETA_ORDER_BASE_ORDER_REQUIRED');
  const raw=baseOrder.orderViewIdStr??baseOrder.orderViewId;
  const providerOrderId=nonEmpty(String(raw??''),'KEETA_PROVIDER_ORDER_ID_REQUIRED');
  return Object.freeze({providerOrderId,rawMessage:JSON.stringify(messageRow)});
}

function keetaCommercialSnapshot(rawMessage,capturedAt,evidenceRef){
  let parsed;
  try{parsed=JSON.parse(rawMessage);}catch{throw new Error('KEETA_COMMERCIAL_MESSAGE_INVALID_JSON');}
  const facts=normalizeKeetaStandardProviderOrderFacts({
    orderInfo:parsed,
    providerCapturedAt:capturedAt,
    providerEvidenceRef:evidenceRef,
  });
  return Object.freeze({
    providerOrderId:facts.providerOrderId,
    providerOrderCode:facts.providerOrderCode,
    snapshot:facts.providerCommercialSnapshot,
  });
}

function providerOrderInfoFromReceipt(receipt){
  const data=record(receipt?.data,'KEETA_ORDER_GET_DATA_REQUIRED');
  return record(data.orderInfo,'KEETA_ORDER_GET_ORDER_INFO_REQUIRED');
}
function keetaOrderLifecycleIdentity(message){
  let root;
  try{root=JSON.parse(nonEmpty(message,'KEETA_ORDER_EVENT_MESSAGE_REQUIRED'));}
  catch{throw new Error('KEETA_ORDER_EVENT_MESSAGE_INVALID_JSON');}
  const row=record(root,'KEETA_ORDER_EVENT_MESSAGE_INVALID');
  const raw=row.orderViewIdStr??row.orderViewId;
  const providerOrderId=nonEmpty(String(raw??''),'KEETA_ORDER_EVENT_PROVIDER_ORDER_ID_REQUIRED');
  return Object.freeze({providerOrderId,rawMessage:JSON.stringify(row)});
}

function keetaAfterSaleIdentity(message){
  let root;
  try{root=JSON.parse(nonEmpty(message,'KEETA_AFTER_SALE_MESSAGE_REQUIRED'));}
  catch{throw new Error('KEETA_AFTER_SALE_MESSAGE_INVALID_JSON');}
  const row=record(root,'KEETA_AFTER_SALE_MESSAGE_INVALID');
  const providerOrderId=nonEmpty(String(row.orderViewIdStr??row.orderViewId??''),'KEETA_AFTER_SALE_PROVIDER_ORDER_ID_REQUIRED');
  const afterSaleOrderId=nonEmpty(String(row.afterSaleOrderId??''),'KEETA_AFTER_SALE_ID_REQUIRED');
  return Object.freeze({
    providerOrderId,
    afterSaleOrderId,
    providerStatus:Number.isFinite(Number(row.status))?Number(row.status):null,
    refundAmountMinor:Number.isFinite(Number(row.money))?Number(row.money):null,
    currency:typeof row.currency==='string'?row.currency:null,
    rawMessage:JSON.stringify(row),
  });
}
function bytesToHex(bytes){
  return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function sha256Hex(value){
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}
function stable(value){
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    const row=value;
    return '{'+Object.keys(row).sort().map(key=>JSON.stringify(key)+':'+stable(row[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}
function signatureValue(value){
  if(value===null)return 'null';
  if(value===undefined)return '';
  if(typeof value==='object')return JSON.stringify(value);
  return String(value);
}

export function buildKeetaRuntimeSignaturePreimage(url,params,appSecret){
  const endpoint=nonEmpty(url,'KEETA_SIGNATURE_URL_REQUIRED');
  const secret=nonEmpty(appSecret,'KEETA_APP_SECRET_UNAVAILABLE');
  const row=record(params,'KEETA_SIGNATURE_PARAMS_INVALID');
  const ordered=Object.keys(row)
    .filter(key=>key!=='sig')
    .sort()
    .map(key=>key+'='+signatureValue(row[key]))
    .join('&');
  return endpoint+'?'+ordered+secret;
}

export async function signKeetaRuntimeParams(url,params,appSecret){
  const preimage=buildKeetaRuntimeSignaturePreimage(url,params,appSecret);
  return Object.freeze({...params,sig:await sha256Hex(preimage)});
}

function parseTokenMaterial(input){
  const parsed=typeof input==='string'?JSON.parse(input):record(input,'KEETA_TOKEN_RESPONSE_INVALID_SHAPE');
  const row=record(parsed,'KEETA_TOKEN_RESPONSE_INVALID_SHAPE');

  if(Number.isInteger(Number(row.code))&&Number(row.code)!==0){
    const providerCode=Number(row.code);
    if(providerCode===115000260)throw new Error('KEETA_AUTHORIZATION_CANCELLED_115000260');
    if(providerCode>=115000100&&providerCode<=115000199)throw new Error('KEETA_PROVIDER_SIGNATURE_ERROR_'+providerCode);
    if(providerCode>=115000200&&providerCode<=115000399)throw new Error('KEETA_PROVIDER_BUSINESS_ERROR_'+providerCode);
    if(providerCode>=315000100&&providerCode<=315000199)throw new Error('KEETA_PROVIDER_SERVER_ERROR_'+providerCode);
    throw new Error('KEETA_PROVIDER_ERROR_'+providerCode);
  }

  if(typeof row.accessToken!=='string'||!row.accessToken
    ||row.tokenType!=='bearer'
    ||!Number.isFinite(Number(row.expiresIn))||Number(row.expiresIn)<=0
    ||typeof row.refreshToken!=='string'||!row.refreshToken
    ||typeof row.scope!=='string'
    ||!Number.isFinite(Number(row.issuedAtTime))||Number(row.issuedAtTime)<0){
    throw new Error('KEETA_TOKEN_RESPONSE_INVALID_SHAPE');
  }
  return Object.freeze({
    accessToken:row.accessToken,
    tokenType:'bearer',
    expiresIn:Number(row.expiresIn),
    refreshToken:row.refreshToken,
    scope:row.scope,
    issuedAtTime:Number(row.issuedAtTime),
  });
}

function tokenAssessment(token,nowMs=Date.now()){
  const expiresAtMs=token.issuedAtTime+token.expiresIn*1000;
  const refreshAtMs=expiresAtMs-TOKEN_REFRESH_WINDOW_MS;
  return Object.freeze({
    disposition:nowMs>=expiresAtMs?'EXPIRED':nowMs>=refreshAtMs?'REFRESH_DUE':'VALID',
    expiresAtMs,
    refreshAtMs,
  });
}

function decodeBase64(value,code){
  try{
    const binary=atob(nonEmpty(value,code));
    return Uint8Array.from(binary,char=>char.charCodeAt(0));
  }catch{throw new Error(code)}
}
function encodeBase64(value){
  let binary='';
  for(const byte of value)binary+=String.fromCharCode(byte);
  return btoa(binary);
}
function toArrayBuffer(value){
  const copy=new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
async function importEncryptionKey(raw){
  const bytes=decodeBase64(raw,'KEETA_TOKEN_ENCRYPTION_KEY_INVALID');
  if(bytes.byteLength!==32)throw new Error('KEETA_TOKEN_ENCRYPTION_KEY_INVALID');
  return crypto.subtle.importKey('raw',toArrayBuffer(bytes),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encryptToken(rawKey,token){
  const key=await importEncryptionKey(rawKey);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(token)));
  return Object.freeze({ciphertext:encodeBase64(new Uint8Array(ciphertext)),iv:encodeBase64(iv)});
}
async function decryptToken(rawKey,row){
  const key=await importEncryptionKey(rawKey);
  try{
    const clear=await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:toArrayBuffer(decodeBase64(row.iv,'KEETA_TOKEN_IV_INVALID'))},
      key,
      toArrayBuffer(decodeBase64(row.ciphertext,'KEETA_TOKEN_CIPHERTEXT_INVALID')),
    );
    return parseTokenMaterial(decoder.decode(clear));
  }catch(error){
    if(error instanceof Error&&error.message.startsWith('KEETA_TOKEN_'))throw error;
    throw new Error('KEETA_TOKEN_DECRYPT_FAILED');
  }
}

function configStatus(env){
  const appId=Number(env.KEETA_APP_ID);
  const providerShopId=Number(env.KEETA_PROVIDER_SHOP_ID);
  const redirectUri=String(env.KEETA_OAUTH_REDIRECT_URI||'https://admin.morefunos.com/api/keeta/oauth/callback');
  let redirectValid=false;
  try{redirectValid=new URL(redirectUri).protocol==='https:';}catch{}
  let encryptionKeyValid=false;
  try{encryptionKeyValid=decodeBase64(String(env.KEETA_TOKEN_ENCRYPTION_KEY||''),'KEETA_TOKEN_ENCRYPTION_KEY_INVALID').byteLength===32;}catch{}
  return Object.freeze({
    appIdConfigured:Number.isSafeInteger(appId)&&appId>0,
    appSecretConfigured:typeof env.KEETA_APP_SECRET==='string'&&env.KEETA_APP_SECRET.length>0,
    encryptionKeyConfigured:encryptionKeyValid,
    providerShopConfigured:Number.isSafeInteger(providerShopId)&&providerShopId>0,
    redirectUriConfigured:redirectValid,
    redirectUri,
  });
}

export function assessKeetaRuntimeReadiness(env){
  const config=configStatus(env);
  const missing=[];
  if(!config.appIdConfigured)missing.push('KEETA_APP_ID');
  if(!config.appSecretConfigured)missing.push('KEETA_APP_SECRET');
  if(!config.encryptionKeyConfigured)missing.push('KEETA_TOKEN_ENCRYPTION_KEY');
  if(!config.providerShopConfigured)missing.push('KEETA_PROVIDER_SHOP_ID');
  if(!config.redirectUriConfigured)missing.push('KEETA_OAUTH_REDIRECT_URI');
  return Object.freeze({
    ready:missing.length===0,
    missing:Object.freeze(missing),
    config,
  });
}

function requireRuntimeConfig(env){
  const readiness=assessKeetaRuntimeReadiness(env);
  if(!readiness.ready)throw new Error('KEETA_RUNTIME_CONFIG_INCOMPLETE:'+readiness.missing.join(','));
  return Object.freeze({
    appId:positiveInt(env.KEETA_APP_ID,'KEETA_APP_ID_UNAVAILABLE'),
    appSecret:nonEmpty(env.KEETA_APP_SECRET,'KEETA_APP_SECRET_UNAVAILABLE'),
    encryptionKey:nonEmpty(env.KEETA_TOKEN_ENCRYPTION_KEY,'KEETA_TOKEN_ENCRYPTION_KEY_UNAVAILABLE'),
    providerShopId:positiveInt(env.KEETA_PROVIDER_SHOP_ID,'KEETA_PROVIDER_SHOP_ID_UNAVAILABLE'),
    redirectUri:new URL(env.KEETA_OAUTH_REDIRECT_URI||'https://admin.morefunos.com/api/keeta/oauth/callback').toString(),
  });
}

async function sendSignedProviderRequest({url,params,appSecret}){
  const signed=await signKeetaRuntimeParams(url,params,appSecret);
  const response=await fetch(url,{
    method:'POST',
    headers:{'content-type':'application/json; charset=utf-8'},
    body:JSON.stringify(signed),
  });
  if(response.status!==200)throw new Error('KEETA_HTTP_STATUS_'+response.status);
  return response.text();
}

function isProviderAccessTokenMissing(error){
  const message=error instanceof Error?error.message:String(error||'');
  return message.includes('115000200')||/access token does not exist/i.test(message);
}

async function submitKeetaMenuSync(config,token,payload){
  const raw=await sendSignedProviderRequest({
    url:KEETA_MENU_SYNC_URL,
    params:{
      accessToken:token.accessToken,
      appId:config.appId,
      choiceGroupList:payload.choiceGroupList,
      shopCategoryList:payload.shopCategoryList,
      shopId:config.providerShopId,
      spuList:payload.spuList,
      spuSequenceCodeMap:payload.spuSequenceCodeMap,
      timestamp:Math.floor(Date.now()/1000),
    },
    appSecret:config.appSecret,
  });
  let body;
  try{body=JSON.parse(raw);}catch{throw new Error('KEETA_MENU_SYNC_RESPONSE_INVALID_JSON');}
  const row=record(body,'KEETA_MENU_SYNC_RESPONSE_INVALID');
  const code=Number(row.code);
  if(!Number.isSafeInteger(code))throw new Error('KEETA_MENU_SYNC_RESPONSE_CODE_INVALID');
  if(code!==0)throw new Error('KEETA_MENU_SYNC_PROVIDER_'+code+':'+String(row.message||''));
  return positiveInt(row.data,'KEETA_MENU_SYNC_TASK_ID_INVALID');
}

function parseKeetaMenuCompletionMessage(message,eventId,providerShopId){
  let row;
  try{row=record(JSON.parse(message),'KEETA_MENU_COMPLETION_INVALID');}
  catch(error){throw new Error(error instanceof Error?error.message:'KEETA_MENU_COMPLETION_INVALID_JSON');}
  if(positiveInt(row.shopId,'KEETA_MENU_COMPLETION_SHOP_ID_INVALID')!==providerShopId){
    throw new Error('KEETA_MENU_COMPLETION_SHOP_ID_MISMATCH');
  }
  const errorsRaw=eventId===1202?row.errorSpuDTOList:row.errorList;
  const errors=Array.isArray(errorsRaw)?errorsRaw.map(item=>record(item,'KEETA_MENU_COMPLETION_ERROR_INVALID')):[];
  return Object.freeze({
    taskId:positiveInt(row.taskId,'KEETA_MENU_COMPLETION_TASK_ID_INVALID'),
    mainTaskId:row.mainTaskId==null?null:positiveInt(row.mainTaskId,'KEETA_MENU_COMPLETION_MAIN_TASK_ID_INVALID'),
    pictureTaskId:row.pictureTaskId==null?null:positiveInt(row.pictureTaskId,'KEETA_MENU_COMPLETION_PICTURE_TASK_ID_INVALID'),
    errors:Object.freeze(errors.map(item=>Object.freeze({
      openItemCode:typeof item.openItemCode==='string'?item.openItemCode:null,
      code:Number.isFinite(Number(item.code))?Number(item.code):null,
      message:typeof item.message==='string'?item.message:null,
    }))),
  });
}

function providerOrderIdentity(providerOrderId){
  return positiveInt(providerOrderId,'KEETA_PROVIDER_ORDER_ID_INVALID');
}

async function sendKeetaOrderCommand(config,token,action,providerOrderId){
  const endpoint=action==='CONFIRM'?KEETA_ORDER_CONFIRM_URL:action==='READY'?KEETA_ORDER_READY_URL:null;
  if(!endpoint)throw new Error('KEETA_PROVIDER_COMMAND_UNSUPPORTED');
  const signed=await signKeetaRuntimeParams(endpoint,{
    accessToken:token.accessToken,
    appId:config.appId,
    orderViewId:providerOrderIdentity(providerOrderId),
    shopId:config.providerShopId,
    timestamp:Math.floor(Date.now()/1000),
  },config.appSecret);
  let response;
  try{
    response=await fetch(endpoint,{
      method:'POST',
      headers:{'content-type':'application/json; charset=utf-8'},
      body:JSON.stringify(signed),
    });
  }catch(error){
    throw Object.assign(new Error('KEETA_PROVIDER_COMMAND_TRANSPORT_UNKNOWN'),{cause:error,unknown:true});
  }
  if(response.status!==200){
    throw Object.assign(new Error('KEETA_PROVIDER_COMMAND_HTTP_UNKNOWN_'+response.status),{unknown:true});
  }
  let row;
  try{row=record(JSON.parse(await response.text()),'KEETA_PROVIDER_COMMAND_RESPONSE_INVALID');}
  catch(error){throw Object.assign(new Error(error instanceof Error?error.message:'KEETA_PROVIDER_COMMAND_RESPONSE_INVALID'),{unknown:true});}
  const code=Number(row.code);
  if(!Number.isSafeInteger(code))throw Object.assign(new Error('KEETA_PROVIDER_COMMAND_CODE_INVALID'),{unknown:true});
  if(code!==0){
    const error=new Error('KEETA_PROVIDER_COMMAND_REJECTED_'+code+':'+String(row.message||''));
    Object.assign(error,{providerRejected:true,providerCode:code});
    throw error;
  }
  return Object.freeze({code,message:String(row.message||'Success'),data:row.data??null});
}

async function readKeetaProviderOrder(config,token,providerOrderId){
  const raw=await sendSignedProviderRequest({
    url:KEETA_ORDER_GET_URL,
    params:{
      accessToken:token.accessToken,
      appId:config.appId,
      orderViewId:providerOrderIdentity(providerOrderId),
      shopId:config.providerShopId,
      timestamp:Math.floor(Date.now()/1000),
    },
    appSecret:config.appSecret,
  });
  let row;
  try{row=record(JSON.parse(raw),'KEETA_ORDER_GET_RESPONSE_INVALID');}
  catch(error){throw new Error(error instanceof Error?error.message:'KEETA_ORDER_GET_RESPONSE_INVALID_JSON');}
  const code=Number(row.code);
  if(!Number.isSafeInteger(code))throw new Error('KEETA_ORDER_GET_RESPONSE_CODE_INVALID');
  if(code!==0)throw new Error('KEETA_ORDER_GET_PROVIDER_'+code+':'+String(row.message||''));
  return Object.freeze({code,message:String(row.message||'Success'),data:row.data??null});
}


async function keetaProviderJson(config,token,url,params){
  const raw=await sendSignedProviderRequest({
    url,
    params:{
      accessToken:token.accessToken,
      appId:config.appId,
      ...params,
      timestamp:Math.floor(Date.now()/1000),
    },
    appSecret:config.appSecret,
  });
  let row;
  try{row=record(JSON.parse(raw),'KEETA_PROVIDER_RESPONSE_INVALID');}
  catch(error){throw new Error(error instanceof Error?error.message:'KEETA_PROVIDER_RESPONSE_INVALID_JSON');}
  const code=Number(row.code);
  if(!Number.isSafeInteger(code))throw new Error('KEETA_PROVIDER_RESPONSE_CODE_INVALID');
  if(code!==0)throw new Error('KEETA_PROVIDER_'+code+':'+String(row.message||''));
  return Object.freeze({code,message:String(row.message||'Success'),data:row.data??null,errorList:Array.isArray(row.errorList)?row.errorList:[]});
}

async function syncKeetaSellability(config,token,snapshot){
  const projection=buildKeetaSellabilityProjection(snapshot);
  if(!projection.enabled)throw new Error('KEETA_SELLABILITY_SYNC_DISABLED_BY_PUBLISHED_CONFIG');
  const results=[];
  for(const [status,codes] of [[1,projection.available],[0,projection.unavailable]]){
    for(const batch of chunkKeetaSpuStatus(codes)){
      if(batch.length===0)continue;
      const receipt=await keetaProviderJson(config,token,KEETA_SPU_STATUS_URL,{
        shopId:config.providerShopId,
        spuOpenItemCodeList:batch,
        status,
        needLinkage:0,
      });
      results.push(Object.freeze({status,count:batch.length,receipt}));
    }
  }
  return Object.freeze({projection,results:Object.freeze(results)});
}

async function readKeetaStore(config,token){
  const [details,hours]=await Promise.all([
    keetaProviderJson(config,token,KEETA_STORE_DETAILS_URL,{shopId:config.providerShopId}),
    keetaProviderJson(config,token,KEETA_STORE_HOURS_GET_URL,{shopId:config.providerShopId}),
  ]);
  return Object.freeze({observedAt:new Date().toISOString(),details,hours});
}

async function sendKeetaRefundDecision(config,token,input){
  const decision=nonEmpty(input.decision,'KEETA_REFUND_DECISION_REQUIRED');
  if(decision!=='APPROVE'&&decision!=='REJECT')throw new Error('KEETA_REFUND_DECISION_INVALID');
  const endpoint=decision==='APPROVE'?KEETA_REFUND_AGREE_URL:KEETA_REFUND_REJECT_URL;
  const params={
    accessToken:token.accessToken,
    appId:config.appId,
    orderViewId:providerOrderIdentity(input.providerOrderId),
    shopId:config.providerShopId,
    ...(decision==='REJECT'?{
      rejectCode:positiveInt(input.rejectCode,'KEETA_REFUND_REJECT_CODE_REQUIRED'),
      ...(typeof input.rejectReason==='string'&&input.rejectReason.trim()?{rejectReason:input.rejectReason.trim()}:{}),
    }:{}),
    timestamp:Math.floor(Date.now()/1000),
  };
  if(decision==='REJECT'&&![100000,100001,100002].includes(params.rejectCode))throw new Error('KEETA_REFUND_REJECT_CODE_INVALID');
  if(decision==='REJECT'&&params.rejectCode===100000&&!params.rejectReason)throw new Error('KEETA_REFUND_REJECT_REASON_REQUIRED');

  const signed=await signKeetaRuntimeParams(endpoint,params,config.appSecret);
  let response;
  try{
    response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify(signed)});
  }catch(error){
    throw Object.assign(new Error('KEETA_REFUND_DECISION_TRANSPORT_UNKNOWN'),{cause:error,unknown:true});
  }
  if(response.status!==200)throw Object.assign(new Error('KEETA_REFUND_DECISION_HTTP_UNKNOWN_'+response.status),{unknown:true});
  let row;
  try{row=record(JSON.parse(await response.text()),'KEETA_REFUND_DECISION_RESPONSE_INVALID');}
  catch(error){throw Object.assign(new Error(error instanceof Error?error.message:'KEETA_REFUND_DECISION_RESPONSE_INVALID'),{unknown:true});}
  const code=Number(row.code);
  if(!Number.isSafeInteger(code))throw Object.assign(new Error('KEETA_REFUND_DECISION_CODE_INVALID'),{unknown:true});
  if(code!==0){
    const error=new Error('KEETA_REFUND_DECISION_REJECTED_'+code+':'+String(row.message||''));
    Object.assign(error,{providerRejected:true});
    throw error;
  }
  return Object.freeze({code,message:String(row.message||'Success')});
}

function normalizePartialRefundProducts(value){
  if(!Array.isArray(value))throw new Error('KEETA_PARTIAL_REFUND_PRODUCTS_REQUIRED');
  return Object.freeze(value.map(item=>{
    const row=record(item,'KEETA_PARTIAL_REFUND_PRODUCT_INVALID');
    return Object.freeze({
      orderProductId:positiveInt(row.orderProductId,'KEETA_PARTIAL_REFUND_ORDER_PRODUCT_ID_INVALID'),
      refundCount:positiveInt(row.refundCount,'KEETA_PARTIAL_REFUND_COUNT_INVALID'),
    });
  }));
}

async function previewKeetaPartialRefund(config,token,providerOrderId,products){
  return keetaProviderJson(config,token,KEETA_PARTIAL_REFUND_PREVIEW_URL,{
    orderViewId:providerOrderIdentity(providerOrderId),
    shopId:config.providerShopId,
    products,
  });
}

async function applyKeetaPartialRefund(config,token,providerOrderId,products,partRefundType,partRefundReason){
  const type=positiveInt(partRefundType,'KEETA_PARTIAL_REFUND_TYPE_REQUIRED');
  if(![200000,200001,200002,200003,200004].includes(type))throw new Error('KEETA_PARTIAL_REFUND_TYPE_INVALID');
  if(type===200000&&!(typeof partRefundReason==='string'&&partRefundReason.trim()))throw new Error('KEETA_PARTIAL_REFUND_REASON_REQUIRED');
  return keetaProviderJson(config,token,KEETA_PARTIAL_REFUND_APPLY_URL,{
    orderViewId:providerOrderIdentity(providerOrderId),
    shopId:config.providerShopId,
    products,
    partRefundType:type,
    ...(typeof partRefundReason==='string'&&partRefundReason.trim()?{partRefundReason:partRefundReason.trim()}:{}),
  });
}
async function exchangeAuthorizationCode(config,code){
  const raw=await sendSignedProviderRequest({
    url:KEETA_TOKEN_URL,
    params:{
      appId:config.appId,
      timestamp:Math.floor(Date.now()/1000),
      grantType:'authorization_code',
      code:nonEmpty(code,'KEETA_OAUTH_CODE_REQUIRED'),
    },
    appSecret:config.appSecret,
  });
  return parseTokenMaterial(raw);
}

async function completeAuthorizationCode(config,store,stateValue,code,callbackAt,{allowMissingState=false}={}){
  if(stateValue){
    const key='oauth:state:'+stateValue;
    const saved=await store.state.storage.get(key);
    if(!saved||saved.consumed===true||Date.now()-Number(saved.createdAt)>OAUTH_STATE_TTL_MS){
      throw new Error('KEETA_OAUTH_STATE_INVALID_OR_REUSED');
    }
    await store.state.storage.put(key,{...saved,consumed:true,consumedAt:Date.now()});
  }else if(!allowMissingState){
    throw new Error('KEETA_OAUTH_STATE_REQUIRED');
  }
  const token=await exchangeAuthorizationCode(config,code);
  await store.saveToken(token);
  await store.state.storage.put('connection',{
    canonicalStoreId:'MF01',
    providerShopId:config.providerShopId,
    authorizedAt:callbackAt,
    tokenSource:'OAUTH_CALLBACK',
  });
  await store.state.storage.put('provider:authorization',{
    state:'AUTHORIZED',
    eventId:1,
    source:'TOKEN_EXCHANGE',
    observedAt:callbackAt,
  });
  await store.state.storage.put('oauth:callback-status',{
    lastCallbackAt:callbackAt,
    lastCallbackResult:'CONNECTED',
    lastCallbackError:null,
  });
  return token;
}

async function refreshToken(config,refreshToken){
  let lastError;
  for(let attempt=1;attempt<=3;attempt+=1){
    try{
      const raw=await sendSignedProviderRequest({
        url:KEETA_TOKEN_URL,
        params:{
          appId:config.appId,
          timestamp:Math.floor(Date.now()/1000),
          grantType:'refresh_token',
          refreshToken:nonEmpty(refreshToken,'KEETA_TOKEN_REFRESH_INPUT_INVALID'),
        },
        appSecret:config.appSecret,
      });
      return parseTokenMaterial(raw);
    }catch(error){
      lastError=error;
      if(!(error instanceof TypeError)||attempt===3)throw error;
    }
  }
  throw lastError??new Error('KEETA_TOKEN_REFRESH_FAILED');
}

function authorizationUrl(config,state){
  const url=new URL(KEETA_AUTHORIZE_URL);
  url.searchParams.set('responseType','authorization_code');
  url.searchParams.set('appId',String(config.appId));
  url.searchParams.set('redirectUri',config.redirectUri);
  url.searchParams.set('state',state);
  url.searchParams.set('scope','all');
  return url.toString();
}

async function verifyWebhookSignature(requestUrl,body,appSecret){
  if(typeof body.sig!=='string'||!/^[0-9a-fA-F]{64}$/.test(body.sig))throw new Error('KEETA_WEBHOOK_SIGNATURE_INVALID');
  const expected=(await sha256Hex(buildKeetaRuntimeSignaturePreimage(requestUrl,body,appSecret))).toLowerCase();
  const actual=body.sig.toLowerCase();
  if(expected.length!==actual.length)throw new Error('KEETA_WEBHOOK_SIGNATURE_INVALID');
  let diff=0;
  for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);
  if(diff!==0)throw new Error('KEETA_WEBHOOK_SIGNATURE_INVALID');
  return true;
}

function validateWebhookBody(body){
  const row=record(body,'KEETA_WEBHOOK_BODY_INVALID');
  const eventId=positiveInt(row.eventId,'KEETA_WEBHOOK_EVENT_ID_INVALID');
  if(!Object.prototype.hasOwnProperty.call(KEETA_WEBHOOK_EVENTS,eventId))throw new Error('KEETA_WEBHOOK_EVENT_UNKNOWN');
  if(eventId===1){
    return Object.freeze({
      eventId,
      eventName:KEETA_WEBHOOK_EVENTS[eventId],
      appId:positiveInt(row.appId,'KEETA_WEBHOOK_APP_ID_INVALID'),
      code:nonEmpty(row.code,'KEETA_OAUTH_CODE_REQUIRED'),
      state:typeof row.state==='string'?row.state.trim():'',
      timestamp:positiveInt(row.timestamp,'KEETA_WEBHOOK_TIMESTAMP_INVALID'),
      sig:nonEmpty(row.sig,'KEETA_WEBHOOK_SIGNATURE_REQUIRED'),
    });
  }
  return Object.freeze({
    eventId,
    eventName:KEETA_WEBHOOK_EVENTS[eventId],
    appId:positiveInt(row.appId,'KEETA_WEBHOOK_APP_ID_INVALID'),
    messageId:nonEmpty(row.messageId,'KEETA_WEBHOOK_MESSAGE_ID_REQUIRED'),
    shopId:positiveInt(row.shopId,'KEETA_WEBHOOK_PROVIDER_SHOP_ID_INVALID'),
    message:typeof row.message==='string'?row.message:(()=>{throw new Error('KEETA_WEBHOOK_MESSAGE_INVALID')})(),
    timestamp:positiveInt(row.timestamp,'KEETA_WEBHOOK_TIMESTAMP_INVALID'),
    sig:nonEmpty(row.sig,'KEETA_WEBHOOK_SIGNATURE_REQUIRED'),
  });
}

export class KeetaRuntimeStore{
  constructor(state,env){this.state=state;this.env=env;}

  async scheduleTokenRefresh(assessment,now=Date.now()){
    const nextRefreshAtMs=Math.max(now+TOKEN_REFRESH_MIN_INTERVAL_MS,assessment.refreshAtMs);
    if(typeof this.state.storage.setAlarm==='function')await this.state.storage.setAlarm(nextRefreshAtMs);
    const current=await this.state.storage.get('oauth:auto-refresh')||{};
    await this.state.storage.put('oauth:auto-refresh',{
      ...current,
      state:'SCHEDULED',
      nextRefreshAtMs,
      updatedAt:now,
    });
    return nextRefreshAtMs;
  }

  async saveToken(token){
    const config=requireRuntimeConfig(this.env);
    const encrypted=await encryptToken(config.encryptionKey,token);
    const assessment=tokenAssessment(token);
    await this.state.storage.put('oauth:token',{
      ...encrypted,
      expiresAtMs:assessment.expiresAtMs,
      updatedAt:Date.now(),
    });
    await this.state.storage.delete('oauth:provider-token-invalid');
    await this.scheduleTokenRefresh(assessment);
    return assessment;
  }

  async loadToken(){
    const config=requireRuntimeConfig(this.env);
    const row=await this.state.storage.get('oauth:token');
    if(!row)throw new Error('KEETA_OAUTH_TOKEN_NOT_FOUND');
    return decryptToken(config.encryptionKey,row);
  }

  async refreshPersistedToken(reason='LIFECYCLE'){
    const config=requireRuntimeConfig(this.env);
    const now=Date.now();
    const lock=await this.state.storage.get('oauth:refresh-lock');
    if(lock&&now-Number(lock)<TOKEN_REFRESH_MIN_INTERVAL_MS)throw new Error('KEETA_TOKEN_REFRESH_RATE_LIMITED');
    await this.state.storage.put('oauth:refresh-lock',now);
    const before=await this.state.storage.get('oauth:auto-refresh')||{};
    await this.state.storage.put('oauth:auto-refresh',{
      ...before,
      state:'REFRESHING',
      lastReason:reason,
      lastAttemptAt:now,
      updatedAt:now,
    });
    try{
      const currentToken=await this.loadToken();
      const refreshed=await refreshToken(config,currentToken.refreshToken);
      await this.saveToken(refreshed);
      const refreshedAt=new Date().toISOString();
      const connection=await this.state.storage.get('connection')||{};
      await this.state.storage.put('connection',{...connection,tokenSource:'OAUTH_REFRESH',refreshedAt});
      const after=await this.state.storage.get('oauth:auto-refresh')||{};
      await this.state.storage.put('oauth:auto-refresh',{
        ...after,
        state:'SCHEDULED',
        lastReason:reason,
        lastSuccessAt:refreshedAt,
        lastError:null,
        updatedAt:Date.now(),
      });
      return refreshed;
    }catch(error){
      const failedAt=Date.now();
      const errorCode=error instanceof Error?error.message:'KEETA_TOKEN_REFRESH_FAILED';
      const authorizationCancelled=errorCode==='KEETA_AUTHORIZATION_CANCELLED_115000260';
      const latest=await this.state.storage.get('oauth:auto-refresh')||{};
      if(authorizationCancelled){
        await this.state.storage.put('oauth:provider-token-invalid',{
          state:'REAUTH_REQUIRED',
          code:errorCode,
          observedAt:new Date(failedAt).toISOString(),
        });
        await this.state.storage.put('oauth:auto-refresh',{
          ...latest,
          state:'REAUTH_REQUIRED',
          nextRefreshAtMs:null,
          lastReason:reason,
          lastError:errorCode,
          updatedAt:failedAt,
        });
      }else{
        const retryAt=failedAt+TOKEN_REFRESH_RETRY_MS;
        if(typeof this.state.storage.setAlarm==='function')await this.state.storage.setAlarm(retryAt);
        await this.state.storage.put('oauth:auto-refresh',{
          ...latest,
          state:'RETRY_SCHEDULED',
          nextRefreshAtMs:retryAt,
          lastReason:reason,
          lastError:errorCode,
          updatedAt:failedAt,
        });
      }
      throw error;
    }finally{
      await this.state.storage.delete('oauth:refresh-lock');
    }
  }

  async recoverProviderAccessToken(currentToken,sourceError){
    if(!isProviderAccessTokenMissing(sourceError))throw sourceError;
    const observedAt=new Date().toISOString();
    await this.state.storage.put('oauth:provider-token-invalid',{
      state:'INVALID',
      code:sourceError instanceof Error?sourceError.message:String(sourceError),
      observedAt,
    });
    try{
      return await this.refreshPersistedToken('PROVIDER_REJECTED_ACCESS_TOKEN');
    }catch(error){
      await this.state.storage.put('oauth:provider-token-invalid',{
        state:'REAUTH_REQUIRED',
        code:error instanceof Error?error.message:'KEETA_TOKEN_REFRESH_FAILED',
        sourceCode:sourceError instanceof Error?sourceError.message:String(sourceError),
        observedAt:new Date().toISOString(),
      });
      throw new Error('KEETA_ACCESS_TOKEN_REAUTHORIZE_REQUIRED');
    }
  }

  async usableToken(){
    const authorization=await this.state.storage.get('provider:authorization');
    const connection=await this.state.storage.get('connection')||{};
    const authorizationObservedAt=Date.parse(String(authorization?.observedAt||''))||0;
    const tokenAuthorizedAt=Date.parse(String(connection.authorizedAt||''))||0;
    const removalIsNewerThanToken=(authorization?.state==='REMOVED'||authorization?.state==='REVOKED')
      && authorizationObservedAt>=tokenAuthorizedAt;
    if(removalIsNewerThanToken){
      throw new Error('KEETA_ACCESS_TOKEN_REAUTHORIZE_REQUIRED');
    }
    const token=await this.loadToken();
    const assessment=tokenAssessment(token);
    if(assessment.disposition==='VALID'){
      await this.scheduleTokenRefresh(assessment);
      return token;
    }

    try{
      return await this.refreshPersistedToken('LIFECYCLE_'+assessment.disposition);
    }catch(error){
      if(assessment.disposition==='REFRESH_DUE')return token;
      await this.state.storage.put('oauth:provider-token-invalid',{
        state:'REAUTH_REQUIRED',
        code:error instanceof Error?error.message:'KEETA_TOKEN_REFRESH_FAILED',
        observedAt:new Date().toISOString(),
      });
      throw new Error('KEETA_ACCESS_TOKEN_REAUTHORIZE_REQUIRED');
    }
  }

  async alarm(){
    try{
      const token=await this.loadToken();
      const assessment=tokenAssessment(token);
      if(assessment.disposition==='VALID'){
        await this.scheduleTokenRefresh(assessment);
        return;
      }
      await this.refreshPersistedToken('DURABLE_OBJECT_ALARM');
    }catch(error){
      if(error instanceof Error&&error.message==='KEETA_OAUTH_TOKEN_NOT_FOUND')return;
      // refreshPersistedToken already schedules a bounded retry and records sanitized diagnostics.
    }
  }

  async status(){
    const readiness=assessKeetaRuntimeReadiness(this.env);
    const tokenRow=await this.state.storage.get('oauth:token');
    const connection=await this.state.storage.get('connection')||{};
    const callbackStatus=await this.state.storage.get('oauth:callback-status')||{};
    const journal=await this.state.storage.get('webhook:status')||{};
    const providerTokenInvalid=await this.state.storage.get('oauth:provider-token-invalid');
    const autoRefresh=await this.state.storage.get('oauth:auto-refresh')||{};
    const providerAuthorization=await this.state.storage.get('provider:authorization')||null;
    const scheduledAlarmAt=typeof this.state.storage.getAlarm==='function'
      ?await this.state.storage.getAlarm()
      :null;
    let tokenState='NOT_CONNECTED';
    let expiresAt=null;
    if(tokenRow){
      expiresAt=Number(tokenRow.expiresAtMs)||null;
      tokenState=providerTokenInvalid?.state==='REAUTH_REQUIRED'
        ?'REAUTH_REQUIRED'
        :expiresAt&&Date.now()>=expiresAt?'EXPIRED':'CONNECTED';
    }
    return Object.freeze({
      provider:'KEETA',
      market:'HONG_KONG',
      canonicalStoreId:'MF01',
      providerShopId:readiness.config.providerShopConfigured?Number(this.env.KEETA_PROVIDER_SHOP_ID):null,
      readyForAuthorization:readiness.ready,
      missingConfig:readiness.missing,
      oauth:{
        state:tokenState,
        expiresAt:expiresAt?new Date(expiresAt).toISOString():null,
        lastCallbackAt:callbackStatus.lastCallbackAt??null,
        lastCallbackResult:callbackStatus.lastCallbackResult??null,
        lastCallbackError:callbackStatus.lastCallbackError??null,
        lastCallbackMethod:callbackStatus.lastCallbackMethod??null,
        lastCallbackParamNames:Array.isArray(callbackStatus.lastCallbackParamNames)?callbackStatus.lastCallbackParamNames:[],
        tokenSource:tokenRow?(connection.tokenSource??'OAUTH_CALLBACK'):null,
        providerValidation:providerTokenInvalid??null,
        authorization:providerAuthorization?{
          state:providerAuthorization.state,
          eventId:providerAuthorization.eventId,
          observedAt:providerAuthorization.observedAt,
        }:null,
        autoRefresh:{
          state:tokenRow?(autoRefresh.state??'SCHEDULED'):'NOT_CONFIGURED',
          nextRefreshAt:scheduledAlarmAt?new Date(Number(scheduledAlarmAt)).toISOString():null,
          lastSuccessAt:autoRefresh.lastSuccessAt??null,
          lastError:autoRefresh.lastError??null,
        },
      },
      webhook:{
        callbackUrl:'https://admin.morefunos.com/api/keeta/webhook',
        lastAcceptedAt:journal.lastAcceptedAt??null,
        lastEventId:journal.lastEventId??null,
        lastMessageId:journal.lastMessageId??null,
        lastSignatureFailureAt:journal.lastSignatureFailureAt??null,
        acceptedCount:Number(journal.acceptedCount)||0,
        duplicateCount:Number(journal.duplicateCount)||0,
        conflictCount:Number(journal.conflictCount)||0,
      },
      knownExternalBlocker:(Number(journal.acceptedCount)||0)>0?null:'KEETA_LIVE_WEBHOOK_SIGNING_SEMANTICS_MISMATCH',
      automaticOrderMutation:false,
      providerCommandActivation:false,
    });
  }

  async fetch(request){
    const url=new URL(request.url);

    if(url.pathname==='/admin/status'&&(request.method==='GET'||request.method==='POST')){
      return json(await this.status());
    }

    if(url.pathname==='/admin/oauth/begin'&&request.method==='POST'){
      try{
        const config=requireRuntimeConfig(this.env);
        const state=crypto.randomUUID();
        await this.state.storage.put('oauth:state:'+state,{createdAt:Date.now(),consumed:false});
        return json({
          state:'AUTHORIZATION_REQUIRED',
          authorizationUrl:authorizationUrl(config,state),
          redirectUri:config.redirectUri,
        });
      }catch(error){
        return json({code:error instanceof Error?error.message:'KEETA_OAUTH_BEGIN_FAILED'},409);
      }
    }

    if(url.pathname==='/oauth/callback'&&request.method==='GET'){
      const callbackAt=new Date().toISOString();
      const callbackParamNames=[...new Set([...url.searchParams.keys()])].sort();
      try{
        const config=requireRuntimeConfig(this.env);
        const stateValue=url.searchParams.get('state')||'';
        const code=nonEmpty(url.searchParams.get('code')||'','KEETA_OAUTH_CODE_REQUIRED');
        const signedGet=url.searchParams.has('sig')||url.searchParams.has('timestamp')||url.searchParams.has('appId');
        if(signedGet){
          const callbackParams=Object.fromEntries(url.searchParams.entries());
          const appId=positiveInt(callbackParams.appId,'KEETA_OAUTH_APP_ID_INVALID');
          if(appId!==config.appId)throw new Error('KEETA_OAUTH_APP_ID_MISMATCH');
          const timestamp=positiveInt(callbackParams.timestamp,'KEETA_OAUTH_TIMESTAMP_INVALID');
          if(Math.abs(Date.now()-timestamp)>10*60*1000)throw new Error('KEETA_OAUTH_CODE_NOTIFICATION_STALE');
          const externalUrl=new URL(request.headers.get('x-mfk-keeta-external-url')||request.url);
          externalUrl.search='';
          await verifyWebhookSignature(externalUrl.toString(),callbackParams,config.appSecret);
        }
        await completeAuthorizationCode(config,this,stateValue,code,callbackAt,{allowMissingState:signedGet});
        await this.state.storage.put('oauth:callback-status',{
          lastCallbackAt:callbackAt,
          lastCallbackResult:'CONNECTED',
          lastCallbackError:null,
          lastCallbackMethod:'GET',
          lastCallbackParamNames:callbackParamNames,
        });
        return Response.redirect('https://admin.morefunos.com/admin/channels?keeta=connected',302);
      }catch(error){
        const errorCode=error instanceof Error?error.message:'KEETA_OAUTH_CALLBACK_FAILED';
        await this.state.storage.put('oauth:callback-status',{
          lastCallbackAt:callbackAt,
          lastCallbackResult:'FAILED',
          lastCallbackError:errorCode,
          lastCallbackMethod:'GET',
          lastCallbackParamNames:callbackParamNames,
        });
        const code=encodeURIComponent(errorCode);
        return Response.redirect('https://admin.morefunos.com/admin/channels?keeta_error='+code,302);
      }
    }

    if(url.pathname==='/oauth/callback'&&request.method==='POST'){
      const callbackAt=new Date().toISOString();
      let callbackParamNames=[];
      try{
        const config=requireRuntimeConfig(this.env);
        const body=record(await request.json(),'KEETA_OAUTH_CODE_NOTIFICATION_INVALID');
        callbackParamNames=Object.keys(body).sort();
        const appId=positiveInt(body.appId,'KEETA_OAUTH_APP_ID_INVALID');
        if(appId!==config.appId)throw new Error('KEETA_OAUTH_APP_ID_MISMATCH');
        const code=nonEmpty(body.code,'KEETA_OAUTH_CODE_REQUIRED');
        const stateValue=typeof body.state==='string'?body.state.trim():'';
        const timestamp=positiveInt(body.timestamp,'KEETA_OAUTH_TIMESTAMP_INVALID');
        if(Math.abs(Date.now()-timestamp)>10*60*1000)throw new Error('KEETA_OAUTH_CODE_NOTIFICATION_STALE');
        const externalCallbackUrl=request.headers.get('x-mfk-keeta-external-url')||request.url;
        await verifyWebhookSignature(externalCallbackUrl,body,config.appSecret);
        await completeAuthorizationCode(config,this,stateValue,code,callbackAt,{allowMissingState:true});
        await this.state.storage.put('oauth:callback-status',{
          lastCallbackAt:callbackAt,
          lastCallbackResult:'CONNECTED',
          lastCallbackError:null,
          lastCallbackMethod:'POST',
          lastCallbackParamNames:callbackParamNames,
        });
        return json({code:0,message:'Success'});
      }catch(error){
        const errorCode=error instanceof Error?error.message:'KEETA_OAUTH_CALLBACK_FAILED';
        await this.state.storage.put('oauth:callback-status',{
          lastCallbackAt:callbackAt,
          lastCallbackResult:'FAILED',
          lastCallbackError:errorCode,
          lastCallbackMethod:'POST',
          lastCallbackParamNames:callbackParamNames,
        });
        return json({code:errorCode},401);
      }
    }

    if(url.pathname==='/admin/token/import-test'&&request.method==='POST'){
      try{
        const config=requireRuntimeConfig(this.env);
        const body=record(await request.json(),'KEETA_TEST_TOKEN_IMPORT_INVALID');
        const importedToken=parseTokenMaterial(body);
        if(importedToken.issuedAtTime>Date.now()+10*60*1000)throw new Error('KEETA_TEST_TOKEN_IMPORT_ISSUED_AT_INVALID');

        let token=importedToken;
        let assessment=tokenAssessment(token);
        let tokenSource='TEST_PROVIDER_PORTAL_IMPORT';
        if(assessment.disposition==='EXPIRED'){
          token=await refreshToken(config,importedToken.refreshToken);
          assessment=await this.saveToken(token);
          tokenSource='TEST_PROVIDER_PORTAL_REFRESH';
        }else{
          assessment=await this.saveToken(token);
        }

        const importedAt=new Date().toISOString();
        await this.state.storage.put('connection',{
          canonicalStoreId:'MF01',
          providerShopId:config.providerShopId,
          authorizedAt:importedAt,
          tokenSource,
        });
        return json({
          state:'CONNECTED',
          source:tokenSource,
          expiresAt:new Date(assessment.expiresAtMs).toISOString(),
        });
      }catch(error){
        return json({code:error instanceof Error?error.message:'KEETA_TEST_TOKEN_IMPORT_FAILED'},409);
      }
    }

    if(url.pathname==='/admin/token/readiness'&&request.method==='POST'){
      try{
        const config=requireRuntimeConfig(this.env);
        let token=await this.usableToken();
        try{
          await keetaProviderJson(config,token,KEETA_STORE_DETAILS_URL,{shopId:config.providerShopId});
        }catch(error){
          token=await this.recoverProviderAccessToken(token,error);
          await keetaProviderJson(config,token,KEETA_STORE_DETAILS_URL,{shopId:config.providerShopId});
        }
        await this.state.storage.delete('oauth:provider-token-invalid');
        return json({state:'TOKEN_USABLE_PROVIDER_CONFIRMED'});
      }catch(error){
        return json({state:'TOKEN_UNAVAILABLE',code:error instanceof Error?error.message:'KEETA_TOKEN_UNAVAILABLE'},409);
      }
    }


    if(url.pathname==='/admin/menu/preview'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_MENU_PREVIEW_INPUT_INVALID');
        const revision=positiveInt(body.revision,'KEETA_MENU_ADMIN_REVISION_INVALID');
        const adminFingerprint=nonEmpty(body.adminFingerprint,'KEETA_MENU_ADMIN_FINGERPRINT_REQUIRED');
        const projection=buildKeetaMenuProjection(body.snapshot);
        const snapshotFingerprint=await sha256Hex(stable(projection.payload));
        return json({
          state:'READY',
          revision,
          adminFingerprint,
          snapshotFingerprint,
          summary:projection.summary,
          destructiveOmissionSemantics:'FULL_SNAPSHOT_OMISSIONS_DELETE_PROVIDER_ENTITIES',
        });
      }catch(error){
        return json({state:'BLOCKED',code:error instanceof Error?error.message:'KEETA_MENU_PREVIEW_FAILED'},409);
      }
    }

    if(url.pathname==='/admin/menu/sync'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_MENU_SYNC_INPUT_INVALID');
        const revision=positiveInt(body.revision,'KEETA_MENU_ADMIN_REVISION_INVALID');
        const adminFingerprint=nonEmpty(body.adminFingerprint,'KEETA_MENU_ADMIN_FINGERPRINT_REQUIRED');
        const projection=buildKeetaMenuProjection(body.snapshot);
        const snapshotFingerprint=await sha256Hex(stable(projection.payload));
        const config=requireRuntimeConfig(this.env);
        let token=await this.usableToken();
        let taskId;
        try{
          taskId=await submitKeetaMenuSync(config,token,projection.payload);
        }catch(error){
          token=await this.recoverProviderAccessToken(token,error);
          taskId=await submitKeetaMenuSync(config,token,projection.payload);
        }
        const submittedAt=new Date().toISOString();
        const row=Object.freeze({
          state:'SUBMITTED',
          provider:'KEETA',
          canonicalStoreId:'MF01',
          providerShopId:Number(this.env.KEETA_PROVIDER_SHOP_ID),
          taskId,
          adminRevision:revision,
          adminFingerprint,
          snapshotFingerprint,
          summary:projection.summary,
          submittedAt,
          completion:null,
          pictureCompletion:null,
        });
        await this.state.storage.put('menu:sync:task:'+taskId,row);
        await this.state.storage.put('menu:sync:latest',row);
        return json(row);
      }catch(error){
        return json({state:'FAILED',code:error instanceof Error?error.message:'KEETA_MENU_SYNC_FAILED'},409);
      }
    }

    if(url.pathname==='/admin/menu/status'&&(request.method==='GET'||request.method==='POST')){
      const latest=await this.state.storage.get('menu:sync:latest');
      return latest?json(latest):json({state:'NEVER_SYNCED',provider:'KEETA',canonicalStoreId:'MF01'});
    }


    if(url.pathname==='/admin/sellability/preview'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_SELLABILITY_PREVIEW_INPUT_INVALID');
        const revision=positiveInt(body.revision,'KEETA_SELLABILITY_ADMIN_REVISION_INVALID');
        const adminFingerprint=nonEmpty(body.adminFingerprint,'KEETA_SELLABILITY_ADMIN_FINGERPRINT_REQUIRED');
        const projection=buildKeetaSellabilityProjection(body.snapshot);
        return json({
          state:projection.enabled?'READY':'DISABLED',
          revision,adminFingerprint,
          total:projection.total,
          available:projection.available.length,
          unavailable:projection.unavailable.length,
        });
      }catch(error){
        return json({state:'BLOCKED',code:error instanceof Error?error.message:'KEETA_SELLABILITY_PREVIEW_FAILED'},409);
      }
    }

    if(url.pathname==='/admin/sellability/sync'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_SELLABILITY_SYNC_INPUT_INVALID');
        const revision=positiveInt(body.revision,'KEETA_SELLABILITY_ADMIN_REVISION_INVALID');
        const adminFingerprint=nonEmpty(body.adminFingerprint,'KEETA_SELLABILITY_ADMIN_FINGERPRINT_REQUIRED');
        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const result=await syncKeetaSellability(config,token,body.snapshot);
        const row=Object.freeze({
          state:'COMPLETED',provider:'KEETA',canonicalStoreId:'MF01',
          providerShopId:config.providerShopId,adminRevision:revision,adminFingerprint,
          total:result.projection.total,available:result.projection.available.length,
          unavailable:result.projection.unavailable.length,
          batches:result.results,completedAt:new Date().toISOString(),
        });
        await this.state.storage.put('sellability:sync:latest',row);
        return json(row);
      }catch(error){
        const row=Object.freeze({state:'FAILED',code:error instanceof Error?error.message:'KEETA_SELLABILITY_SYNC_FAILED',updatedAt:new Date().toISOString()});
        await this.state.storage.put('sellability:sync:latest',row);
        return json(row,409);
      }
    }

    if(url.pathname==='/admin/sellability/status'&&(request.method==='GET'||request.method==='POST')){
      const row=await this.state.storage.get('sellability:sync:latest');
      return row?json(row):json({state:'NEVER_SYNCED',provider:'KEETA'});
    }

    if(url.pathname==='/admin/store/preview'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_STORE_PREVIEW_INPUT_INVALID');
        const revision=positiveInt(body.revision,'KEETA_STORE_ADMIN_REVISION_INVALID');
        const adminFingerprint=nonEmpty(body.adminFingerprint,'KEETA_STORE_ADMIN_FINGERPRINT_REQUIRED');
        const businessHourOfTheWeek=buildKeetaWeeklyHoursProjection(body.snapshot);
        return json({state:'READY',revision,adminFingerprint,businessHourOfTheWeek});
      }catch(error){
        return json({state:'BLOCKED',code:error instanceof Error?error.message:'KEETA_STORE_PREVIEW_FAILED'},409);
      }
    }

    if(url.pathname==='/admin/store/hours/sync'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_STORE_HOURS_SYNC_INPUT_INVALID');
        const revision=positiveInt(body.revision,'KEETA_STORE_ADMIN_REVISION_INVALID');
        const adminFingerprint=nonEmpty(body.adminFingerprint,'KEETA_STORE_ADMIN_FINGERPRINT_REQUIRED');
        const businessHourOfTheWeek=buildKeetaWeeklyHoursProjection(body.snapshot);
        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const receipt=await keetaProviderJson(config,token,KEETA_STORE_HOURS_UPDATE_URL,{
          shopId:config.providerShopId,businessHourOfTheWeek,
        });
        const readback=await readKeetaStore(config,token);
        const row=Object.freeze({
          state:'COMPLETED',provider:'KEETA',adminRevision:revision,adminFingerprint,
          completedAt:new Date().toISOString(),receipt,readback,
        });
        await this.state.storage.put('store:sync:latest',row);
        return json(row);
      }catch(error){
        const row=Object.freeze({state:'FAILED',code:error instanceof Error?error.message:'KEETA_STORE_HOURS_SYNC_FAILED',updatedAt:new Date().toISOString()});
        await this.state.storage.put('store:sync:latest',row);
        return json(row,409);
      }
    }

    if(url.pathname==='/admin/store/readback'&&request.method==='POST'){
      try{
        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const readback=await readKeetaStore(config,token);
        await this.state.storage.put('store:readback:latest',readback);
        return json({state:'OBSERVED',readback});
      }catch(error){
        return json({state:'FAILED',code:error instanceof Error?error.message:'KEETA_STORE_READBACK_FAILED'},409);
      }
    }

    if((url.pathname==='/admin/store/status/rest'||url.pathname==='/admin/store/status/open')&&request.method==='POST'){
      try{
        const action=url.pathname.endsWith('/rest')?'REST':'OPEN';
        const desiredStatus=action==='REST'?4:3;
        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const before=await readKeetaStore(config,token);
        const currentStatus=Number(before.details?.data?.status);
        if(currentStatus===desiredStatus){
          const row=Object.freeze({state:'IDEMPOTENT',action,observedAt:new Date().toISOString(),readback:before});
          await this.state.storage.put('store:operation:latest',row);
          return json(row);
        }
        const endpoint=action==='REST'?KEETA_STORE_REST_URL:KEETA_STORE_OPEN_URL;
        const receipt=await keetaProviderJson(config,token,endpoint,{shopId:config.providerShopId});
        const after=await readKeetaStore(config,token);
        const row=Object.freeze({state:'COMPLETED',action,completedAt:new Date().toISOString(),receipt,readback:after});
        await this.state.storage.put('store:operation:latest',row);
        return json(row);
      }catch(error){
        const row=Object.freeze({state:'FAILED',code:error instanceof Error?error.message:'KEETA_STORE_OPERATION_FAILED',updatedAt:new Date().toISOString()});
        await this.state.storage.put('store:operation:latest',row);
        return json(row,409);
      }
    }

    if(url.pathname==='/admin/store/status'&&(request.method==='GET'||request.method==='POST')){
      const [sync,operation,readback]=await Promise.all([
        this.state.storage.get('store:sync:latest'),
        this.state.storage.get('store:operation:latest'),
        this.state.storage.get('store:readback:latest'),
      ]);
      return json({state:'AVAILABLE',sync:sync??null,operation:operation??null,readback:readback??null});
    }

    if(url.pathname==='/admin/orders/intake'&&(request.method==='GET'||request.method==='POST')){
      const rows=await this.state.storage.list({prefix:'order:intent:'});
      const lastSmtPull=await this.state.storage.get('smt:intake:last-pull')||null;
      const items=[...rows.values()]
        .filter(Boolean)
        .map(row=>Object.freeze({
          provider:'KEETA',
          canonicalStoreId:'MF01',
          providerOrderId:String(row.providerOrderId||''),
          providerMessageId:String(row.providerMessageId||''),
          providerPushedAt:String(row.providerPushedAt||''),
          receivedAt:String(row.receivedAt||''),
          state:row.state==='COMMITTED'?'COMMITTED':'PENDING_SMT',
          canonicalOrderId:row.canonicalOrderId?String(row.canonicalOrderId):null,
          canonicalDisplay:row.canonicalDisplay?String(row.canonicalDisplay):null,
          committedAt:row.committedAt?String(row.committedAt):null,
        }))
        .sort((a,b)=>String(b.receivedAt).localeCompare(String(a.receivedAt)))
        .slice(0,200);
      return json({
        state:'AVAILABLE',
        provider:'KEETA',
        canonicalStoreId:'MF01',
        pending:items.filter(row=>row.state==='PENDING_SMT').length,
        committed:items.filter(row=>row.state==='COMMITTED').length,
        lastSmtPull,
        items,
      });
    }

    if(url.pathname==='/admin/commercial/list'&&(request.method==='GET'||request.method==='POST')){
      const rows=await this.state.storage.list({prefix:'commercial:order:'});
      const items=[...rows.values()]
        .filter(Boolean)
        .sort((a,b)=>String(b.providerConfirmedAt||b.capturedAt).localeCompare(String(a.providerConfirmedAt||a.capturedAt)))
        .slice(0,200);
      return json({
        state:'AVAILABLE',
        provider:'KEETA',
        canonicalStoreId:'MF01',
        items,
      });
    }

    if(url.pathname==='/admin/commercial/refresh'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_COMMERCIAL_REFRESH_INPUT_INVALID');
        const providerOrderId=nonEmpty(String(body.providerOrderId??''),'KEETA_COMMERCIAL_PROVIDER_ORDER_ID_REQUIRED');
        const intent=await this.state.storage.get('order:intent:'+providerOrderId);
        if(!intent||intent.state!=='COMMITTED')throw new Error('KEETA_COMMERCIAL_REQUIRES_COMMITTED_ORDER');
        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const receipt=await readKeetaProviderOrder(config,token,providerOrderId);
        const orderInfo=providerOrderInfoFromReceipt(receipt);
        const capturedAt=new Date().toISOString();
        const facts=normalizeKeetaStandardProviderOrderFacts({
          orderInfo,
          providerCapturedAt:capturedAt,
          providerEvidenceRef:'KEETA_ORDER_GET:'+providerOrderId+':'+capturedAt,
        });
        if(facts.providerOrderId!==providerOrderId)throw new Error('KEETA_COMMERCIAL_PROVIDER_ORDER_ID_MISMATCH');
        const current=await this.state.storage.get('commercial:order:'+providerOrderId);
        const row=Object.freeze({
          ...current,
          state:'PROVIDER_CONFIRMED',
          provider:'KEETA',
          canonicalStoreId:'MF01',
          providerShopId:config.providerShopId,
          providerOrderId,
          providerOrderCode:facts.providerOrderCode,
          canonicalOrderId:intent.canonicalOrderId,
          canonicalDisplay:intent.canonicalDisplay,
          snapshot:facts.providerCommercialSnapshot,
          providerConfirmedAt:capturedAt,
          latestEvidenceRef:'KEETA_ORDER_GET:'+providerOrderId+':'+capturedAt,
        });
        await this.state.storage.put('commercial:order:'+providerOrderId,row);
        return json(row);
      }catch(error){
        return json({state:'FAILED',code:error instanceof Error?error.message:'KEETA_COMMERCIAL_REFRESH_FAILED'},409);
      }
    }

    if(url.pathname==='/smt/orders/pending'&&request.method==='GET'){
      const rows=await this.state.storage.list({prefix:'order:intent:'});
      const intents=[...rows.values()]
        .filter(row=>row&&row.state==='PENDING_SMT')
        .sort((a,b)=>String(a.receivedAt).localeCompare(String(b.receivedAt)))
        .slice(0,20);
      await this.state.storage.put('smt:intake:last-pull',{
        deviceId:String(url.searchParams.get('deviceId')||''),
        observedAt:new Date().toISOString(),
        pendingCount:intents.length,
      });
      return json({schema:'MFK_KEETA_ORDER_PENDING_BATCH_V1',storeId:'MF01',orders:intents});
    }

    if(url.pathname==='/smt/orders/ack'&&request.method==='POST'){
      try{
        const ack=validateMfkKeetaOrderAck(await request.json());
        const key='order:intent:'+ack.providerOrderId;
        const current=await this.state.storage.get(key);
        if(!current)return json({code:'KEETA_ORDER_INTENT_NOT_FOUND'},404);
        if(current.providerMessageId!==ack.providerMessageId){
          return json({code:'KEETA_ORDER_ACK_MESSAGE_ID_MISMATCH'},409);
        }
        if(current.state==='COMMITTED'){
          if(current.canonicalOrderId!==ack.canonicalOrderId||current.canonicalDisplay!==ack.canonicalDisplay){
            return json({code:'KEETA_ORDER_ACK_CANONICAL_CONFLICT'},409);
          }
          return json({state:'IDEMPOTENT',order:current});
        }
        const committed=Object.freeze({
          ...current,
          state:'COMMITTED',
          canonicalOrderId:ack.canonicalOrderId,
          canonicalDisplay:ack.canonicalDisplay,
          committedAt:ack.committedAt,
        });
        await this.state.storage.put(key,committed);
        const commercialKey='commercial:order:'+ack.providerOrderId;
        const commercial=await this.state.storage.get(commercialKey);
        if(commercial){
          await this.state.storage.put(commercialKey,Object.freeze({
            ...commercial,
            canonicalOrderId:ack.canonicalOrderId,
            canonicalDisplay:ack.canonicalDisplay,
            linkedAt:new Date().toISOString(),
          }));
        }
        return json({state:'ACKED',order:committed});
      }catch(error){
        return json({code:error instanceof Error?error.message:'KEETA_ORDER_ACK_INVALID'},400);
      }
    }

    if(url.pathname==='/smt/orders/events/pending'&&request.method==='GET'){
      const rows=await this.state.storage.list({prefix:'order:event:'});
      const events=[...rows.values()]
        .filter(row=>row&&row.state==='PENDING_SMT')
        .sort((a,b)=>String(a.receivedAt).localeCompare(String(b.receivedAt)))
        .slice(0,50);
      return json({schema:'MFK_KEETA_ORDER_EVENT_BATCH_V1',storeId:'MF01',events});
    }

    if(url.pathname==='/smt/orders/events/ack'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_ORDER_EVENT_ACK_INVALID');
        const providerMessageId=nonEmpty(body.providerMessageId,'KEETA_ORDER_EVENT_MESSAGE_ID_REQUIRED');
        const providerOrderId=nonEmpty(String(body.providerOrderId??''),'KEETA_ORDER_EVENT_PROVIDER_ORDER_ID_REQUIRED');
        const canonicalOrderId=nonEmpty(body.canonicalOrderId,'KEETA_CANONICAL_ORDER_ID_REQUIRED');
        const eventKey='order:event:'+providerMessageId;
        const event=await this.state.storage.get(eventKey);
        if(!event)return json({code:'KEETA_ORDER_EVENT_NOT_FOUND'},404);
        if(event.providerOrderId!==providerOrderId)return json({code:'KEETA_ORDER_EVENT_PROVIDER_ID_MISMATCH'},409);
        const intent=await this.state.storage.get('order:intent:'+providerOrderId);
        if(!intent||intent.state!=='COMMITTED')return json({code:'KEETA_ORDER_EVENT_ORDER_NOT_COMMITTED'},409);
        if(intent.canonicalOrderId!==canonicalOrderId)return json({code:'KEETA_ORDER_EVENT_CANONICAL_MISMATCH'},409);
        if(event.state==='LINKED'){
          if(event.canonicalOrderId!==canonicalOrderId)return json({code:'KEETA_ORDER_EVENT_ACK_CONFLICT'},409);
          return json({state:'IDEMPOTENT',event});
        }
        const linked=Object.freeze({...event,state:'LINKED',canonicalOrderId,linkedAt:new Date().toISOString()});
        await this.state.storage.put(eventKey,linked);
        return json({state:'ACKED',event:linked});
      }catch(error){
        return json({code:error instanceof Error?error.message:'KEETA_ORDER_EVENT_ACK_FAILED'},400);
      }
    }

    if(url.pathname==='/smt/orders/after-sales/pending'&&request.method==='GET'){
      const rows=await this.state.storage.list({prefix:'after-sale:event:'});
      const events=[...rows.values()]
        .filter(row=>row&&row.state==='PENDING_SMT')
        .sort((a,b)=>String(a.receivedAt).localeCompare(String(b.receivedAt)))
        .slice(0,50);
      return json({schema:'MFK_KEETA_AFTER_SALE_BATCH_V1',storeId:'MF01',events});
    }

    if(url.pathname==='/smt/orders/after-sales/ack'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_AFTER_SALE_ACK_INVALID');
        const providerMessageId=nonEmpty(body.providerMessageId,'KEETA_AFTER_SALE_MESSAGE_ID_REQUIRED');
        const providerOrderId=nonEmpty(String(body.providerOrderId??''),'KEETA_AFTER_SALE_PROVIDER_ORDER_ID_REQUIRED');
        const afterSaleOrderId=nonEmpty(String(body.afterSaleOrderId??''),'KEETA_AFTER_SALE_ID_REQUIRED');
        const canonicalOrderId=nonEmpty(body.canonicalOrderId,'KEETA_CANONICAL_ORDER_ID_REQUIRED');
        const eventKey='after-sale:event:'+providerMessageId;
        const event=await this.state.storage.get(eventKey);
        if(!event)return json({code:'KEETA_AFTER_SALE_EVENT_NOT_FOUND'},404);
        if(event.providerOrderId!==providerOrderId||event.afterSaleOrderId!==afterSaleOrderId){
          return json({code:'KEETA_AFTER_SALE_EVENT_IDENTITY_MISMATCH'},409);
        }
        const intent=await this.state.storage.get('order:intent:'+providerOrderId);
        if(!intent||intent.state!=='COMMITTED')return json({code:'KEETA_AFTER_SALE_ORDER_NOT_COMMITTED'},409);
        if(intent.canonicalOrderId!==canonicalOrderId)return json({code:'KEETA_AFTER_SALE_CANONICAL_MISMATCH'},409);
        if(event.state==='LINKED'){
          if(event.canonicalOrderId!==canonicalOrderId)return json({code:'KEETA_AFTER_SALE_ACK_CONFLICT'},409);
          return json({state:'IDEMPOTENT',event});
        }
        const linked=Object.freeze({...event,state:'LINKED',canonicalOrderId,linkedAt:new Date().toISOString()});
        await this.state.storage.put(eventKey,linked);
        const caseKey='after-sale:case:'+afterSaleOrderId;
        const current=await this.state.storage.get(caseKey);
        await this.state.storage.put(caseKey,Object.freeze({...current,canonicalOrderId,linkedAt:new Date().toISOString()}));
        return json({state:'ACKED',event:linked});
      }catch(error){
        return json({code:error instanceof Error?error.message:'KEETA_AFTER_SALE_ACK_FAILED'},400);
      }
    }

    if(url.pathname==='/smt/orders/after-sales/decision'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_REFUND_DECISION_INPUT_INVALID');
        const providerOrderId=nonEmpty(String(body.providerOrderId??''),'KEETA_AFTER_SALE_PROVIDER_ORDER_ID_REQUIRED');
        const canonicalOrderId=nonEmpty(body.canonicalOrderId,'KEETA_CANONICAL_ORDER_ID_REQUIRED');
        const afterSaleOrderId=nonEmpty(String(body.afterSaleOrderId??''),'KEETA_AFTER_SALE_ID_REQUIRED');
        const decision=nonEmpty(body.decision,'KEETA_REFUND_DECISION_REQUIRED');
        if(decision!=='APPROVE'&&decision!=='REJECT')throw new Error('KEETA_REFUND_DECISION_INVALID');
        const intent=await this.state.storage.get('order:intent:'+providerOrderId);
        if(!intent||intent.state!=='COMMITTED'||intent.canonicalOrderId!==canonicalOrderId){
          throw new Error('KEETA_REFUND_DECISION_CANONICAL_ORDER_MISMATCH');
        }
        const afterSale=await this.state.storage.get('after-sale:case:'+afterSaleOrderId);
        if(!afterSale||afterSale.providerOrderId!==providerOrderId)throw new Error('KEETA_AFTER_SALE_CASE_NOT_FOUND');

        const key='after-sale:decision:'+afterSaleOrderId;
        const existing=await this.state.storage.get(key);
        if(existing?.state==='SUCCESS'){
          if(existing.decision!==decision)return json({state:'CONFLICT',code:'KEETA_REFUND_DECISION_ALREADY_FINAL',decision:existing},409);
          return json({state:'IDEMPOTENT',decision:existing});
        }
        if(existing?.state==='UNKNOWN'){
          return json({state:'UNKNOWN',code:'KEETA_REFUND_DECISION_UNKNOWN_READBACK_REQUIRED',decision:existing},409);
        }

        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const requestedAt=new Date().toISOString();
        try{
          const receipt=await sendKeetaRefundDecision(config,token,{
            providerOrderId,decision,rejectCode:body.rejectCode,rejectReason:body.rejectReason,
          });
          const row=Object.freeze({
            state:'SUCCESS',provider:'KEETA',providerOrderId,canonicalOrderId,afterSaleOrderId,
            decision,requestedAt,completedAt:new Date().toISOString(),receipt,
          });
          await this.state.storage.put(key,row);
          return json({state:'SUCCESS',decision:row});
        }catch(error){
          const rejected=Boolean(error&&typeof error==='object'&&error.providerRejected===true);
          const unknown=Boolean(error&&typeof error==='object'&&error.unknown===true);
          const row=Object.freeze({
            state:rejected?'REJECTED':unknown?'UNKNOWN':'FAILED',
            provider:'KEETA',providerOrderId,canonicalOrderId,afterSaleOrderId,decision,
            requestedAt,updatedAt:new Date().toISOString(),
            code:error instanceof Error?error.message:'KEETA_REFUND_DECISION_FAILED',
          });
          await this.state.storage.put(key,row);
          return json({state:row.state,code:row.code,decision:row},409);
        }
      }catch(error){
        return json({code:error instanceof Error?error.message:'KEETA_REFUND_DECISION_INVALID'},409);
      }
    }

    if(url.pathname==='/smt/orders/partial-refund/preview'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_PARTIAL_REFUND_PREVIEW_INPUT_INVALID');
        const providerOrderId=nonEmpty(String(body.providerOrderId??''),'KEETA_AFTER_SALE_PROVIDER_ORDER_ID_REQUIRED');
        const canonicalOrderId=nonEmpty(body.canonicalOrderId,'KEETA_CANONICAL_ORDER_ID_REQUIRED');
        const intent=await this.state.storage.get('order:intent:'+providerOrderId);
        if(!intent||intent.state!=='COMMITTED'||intent.canonicalOrderId!==canonicalOrderId){
          throw new Error('KEETA_PARTIAL_REFUND_CANONICAL_ORDER_MISMATCH');
        }
        const products=normalizePartialRefundProducts(Array.isArray(body.products)?body.products:[]);
        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const receipt=await previewKeetaPartialRefund(config,token,providerOrderId,products);
        const fingerprint=await sha256Hex(stable(products));
        const row=Object.freeze({
          state:'PREVIEWED',providerOrderId,canonicalOrderId,products,fingerprint,
          previewedAt:new Date().toISOString(),receipt,
        });
        await this.state.storage.put('partial-refund:preview:'+providerOrderId,row);
        return json(row);
      }catch(error){
        return json({state:'FAILED',code:error instanceof Error?error.message:'KEETA_PARTIAL_REFUND_PREVIEW_FAILED'},409);
      }
    }

    if(url.pathname==='/smt/orders/partial-refund/apply'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_PARTIAL_REFUND_APPLY_INPUT_INVALID');
        const providerOrderId=nonEmpty(String(body.providerOrderId??''),'KEETA_AFTER_SALE_PROVIDER_ORDER_ID_REQUIRED');
        const canonicalOrderId=nonEmpty(body.canonicalOrderId,'KEETA_CANONICAL_ORDER_ID_REQUIRED');
        const intent=await this.state.storage.get('order:intent:'+providerOrderId);
        if(!intent||intent.state!=='COMMITTED'||intent.canonicalOrderId!==canonicalOrderId){
          throw new Error('KEETA_PARTIAL_REFUND_CANONICAL_ORDER_MISMATCH');
        }
        const products=normalizePartialRefundProducts(body.products);
        const fingerprint=await sha256Hex(stable(products));
        const preview=await this.state.storage.get('partial-refund:preview:'+providerOrderId);
        if(!preview||preview.fingerprint!==fingerprint)throw new Error('KEETA_PARTIAL_REFUND_PREVIEW_REQUIRED');
        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const receipt=await applyKeetaPartialRefund(
          config,token,providerOrderId,products,body.partRefundType,body.partRefundReason,
        );
        const row=Object.freeze({
          state:'APPLIED',providerOrderId,canonicalOrderId,products,fingerprint,
          partRefundType:Number(body.partRefundType),partRefundReason:typeof body.partRefundReason==='string'?body.partRefundReason:null,
          appliedAt:new Date().toISOString(),receipt,
        });
        await this.state.storage.put('partial-refund:apply:'+providerOrderId,row);
        return json(row);
      }catch(error){
        return json({state:'FAILED',code:error instanceof Error?error.message:'KEETA_PARTIAL_REFUND_APPLY_FAILED'},409);
      }
    }

    if(url.pathname==='/smt/orders/command'&&request.method==='POST'){
      let providerOrderId='';
      let canonicalOrderId='';
      let action='';
      try{
        const body=record(await request.json(),'KEETA_PROVIDER_COMMAND_INPUT_INVALID');
        providerOrderId=nonEmpty(String(body.providerOrderId??''),'KEETA_PROVIDER_ORDER_ID_REQUIRED');
        canonicalOrderId=nonEmpty(body.canonicalOrderId,'KEETA_CANONICAL_ORDER_ID_REQUIRED');
        action=nonEmpty(body.action,'KEETA_PROVIDER_COMMAND_ACTION_REQUIRED');
        if(action!=='CONFIRM'&&action!=='READY')throw new Error('KEETA_PROVIDER_COMMAND_UNSUPPORTED');

        const intent=await this.state.storage.get('order:intent:'+providerOrderId);
        if(!intent||intent.state!=='COMMITTED')throw new Error('KEETA_PROVIDER_COMMAND_REQUIRES_COMMITTED_ORDER');
        if(intent.canonicalOrderId!==canonicalOrderId)throw new Error('KEETA_PROVIDER_COMMAND_CANONICAL_ORDER_MISMATCH');

        const commandKey='order:command:'+providerOrderId+':'+action;
        const existing=await this.state.storage.get(commandKey);
        if(existing?.state==='SUCCESS'){
          return json({state:'IDEMPOTENT',command:existing});
        }
        if(existing?.state==='UNKNOWN'){
          return json({state:'UNKNOWN',code:'KEETA_PROVIDER_COMMAND_UNKNOWN_READBACK_REQUIRED',command:existing},409);
        }

        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const requestedAt=new Date().toISOString();
        try{
          const receipt=await sendKeetaOrderCommand(config,token,action,providerOrderId);
          const row=Object.freeze({
            state:'SUCCESS',
            provider:'KEETA',
            providerOrderId,
            canonicalOrderId,
            action,
            requestedAt,
            completedAt:new Date().toISOString(),
            receipt,
          });
          await this.state.storage.put(commandKey,row);
          return json({state:'SUCCESS',command:row});
        }catch(error){
          const rejected=Boolean(error&&typeof error==='object'&&error.providerRejected===true);
          const unknown=Boolean(error&&typeof error==='object'&&error.unknown===true);
          const row=Object.freeze({
            state:rejected?'REJECTED':unknown?'UNKNOWN':'FAILED',
            provider:'KEETA',
            providerOrderId,
            canonicalOrderId,
            action,
            requestedAt,
            updatedAt:new Date().toISOString(),
            code:error instanceof Error?error.message:'KEETA_PROVIDER_COMMAND_FAILED',
          });
          await this.state.storage.put(commandKey,row);
          return json({state:row.state,code:row.code,command:row},409);
        }
      }catch(error){
        return json({code:error instanceof Error?error.message:'KEETA_PROVIDER_COMMAND_INVALID'},409);
      }
    }

    if(url.pathname==='/smt/orders/readback'&&request.method==='POST'){
      try{
        const body=record(await request.json(),'KEETA_ORDER_READBACK_INPUT_INVALID');
        const providerOrderId=nonEmpty(String(body.providerOrderId??''),'KEETA_PROVIDER_ORDER_ID_REQUIRED');
        const canonicalOrderId=nonEmpty(body.canonicalOrderId,'KEETA_CANONICAL_ORDER_ID_REQUIRED');
        const intent=await this.state.storage.get('order:intent:'+providerOrderId);
        if(!intent||intent.state!=='COMMITTED')throw new Error('KEETA_ORDER_READBACK_REQUIRES_COMMITTED_ORDER');
        if(intent.canonicalOrderId!==canonicalOrderId)throw new Error('KEETA_ORDER_READBACK_CANONICAL_ORDER_MISMATCH');
        const config=requireRuntimeConfig(this.env);
        const token=await this.usableToken();
        const receipt=await readKeetaProviderOrder(config,token,providerOrderId);
        const row=Object.freeze({
          provider:'KEETA',
          providerOrderId,
          canonicalOrderId,
          observedAt:new Date().toISOString(),
          receipt,
        });
        await this.state.storage.put('order:readback:'+providerOrderId,row);
        return json({state:'OBSERVED',readback:row});
      }catch(error){
        return json({state:'FAILED',code:error instanceof Error?error.message:'KEETA_ORDER_READBACK_FAILED'},409);
      }
    }

    if(url.pathname==='/webhook'&&request.method==='POST'){
      const config=requireRuntimeConfig(this.env);
      let body;
      try{body=JSON.parse(await request.text());}
      catch{return json({code:'KEETA_WEBHOOK_JSON_INVALID'},400);}
      const status=await this.state.storage.get('webhook:status')||{};
      try{
        const envelope=validateWebhookBody(body);
        if(envelope.appId!==config.appId)throw new Error('KEETA_WEBHOOK_APP_ID_MISMATCH');
        const externalWebhookUrl=request.headers.get('x-mfk-keeta-external-url')||request.url;
        await verifyWebhookSignature(externalWebhookUrl,body,config.appSecret);

        if(envelope.eventId===1){
          if(Math.abs(Date.now()-envelope.timestamp)>10*60*1000)throw new Error('KEETA_OAUTH_CODE_NOTIFICATION_STALE');
          const callbackAt=new Date().toISOString();
          await completeAuthorizationCode(config,this,envelope.state,envelope.code,callbackAt,{allowMissingState:true});
          await this.state.storage.put('oauth:callback-status',{
            lastCallbackAt:callbackAt,
            lastCallbackResult:'CONNECTED',
            lastCallbackError:null,
            lastCallbackMethod:'EVENT_1',
            lastCallbackParamNames:['appId','code','eventId','sig','state','timestamp'],
          });
          const latest=await this.state.storage.get('webhook:status')||{};
          await this.state.storage.put('webhook:status',{
            ...latest,
            acceptedCount:(Number(latest.acceptedCount)||0)+1,
            lastAcceptedAt:callbackAt,
            lastEventId:1,
            lastMessageId:null,
          });
          return json({code:0,message:'Success',data:{}});
        }

        if(envelope.shopId!==config.providerShopId)throw new Error('KEETA_PROVIDER_SHOP_BINDING_MISMATCH');

        const fingerprint=await sha256Hex(stable({
          eventId:envelope.eventId,
          appId:envelope.appId,
          messageId:envelope.messageId,
          shopId:envelope.shopId,
          message:envelope.message,
          timestamp:envelope.timestamp,
        }));
        const dedupKey='webhook:dedup:'+envelope.messageId;
        const existing=await this.state.storage.get(dedupKey);
        if(existing){
          if(existing.fingerprint!==fingerprint){
            await this.state.storage.put('webhook:status',{
              ...status,
              conflictCount:(Number(status.conflictCount)||0)+1,
              lastConflictAt:new Date().toISOString(),
            });
            return json({code:'KEETA_WEBHOOK_IDENTITY_CONFLICT'},409);
          }
          await this.state.storage.put('webhook:status',{
            ...status,
            duplicateCount:(Number(status.duplicateCount)||0)+1,
            lastAcceptedAt:new Date().toISOString(),
            lastEventId:envelope.eventId,
            lastMessageId:envelope.messageId,
          });
          return json({code:0,message:'Success',data:{}});
        }

        const acceptedAt=new Date().toISOString();
        await this.state.storage.put(dedupKey,{fingerprint,acceptedAt,eventId:envelope.eventId});
        await this.state.storage.put('webhook:event:'+envelope.messageId,{
          provider:'KEETA',
          canonicalStoreId:'MF01',
          providerShopId:envelope.shopId,
          eventId:envelope.eventId,
          eventName:envelope.eventName,
          messageId:envelope.messageId,
          providerPushedAt:new Date(envelope.timestamp*1000).toISOString(),
          receivedAt:acceptedAt,
          message:envelope.message,
          fingerprint,
          authorityBoundary:'PROVIDER_EVIDENCE_ONLY_NO_MFK_MUTATION',
        });
        if(envelope.eventId===1301||envelope.eventId===1302||envelope.eventId===1303){
          const authorizationState=envelope.eventId===1301?'AUTHORIZED':envelope.eventId===1302?'REMOVED':'REVOKED';
          await this.state.storage.put('provider:authorization',Object.freeze({
            state:authorizationState,
            eventId:envelope.eventId,
            messageId:envelope.messageId,
            observedAt:acceptedAt,
          }));
          if(authorizationState!=='AUTHORIZED'){
            await this.state.storage.put('oauth:provider-token-invalid',{
              state:'REAUTH_REQUIRED',
              code:authorizationState==='REMOVED'?'KEETA_PROVIDER_AUTHORIZATION_REMOVED':'KEETA_PROVIDER_AUTHORIZATION_REVOKED',
              observedAt:acceptedAt,
            });
          }
        }
        if(envelope.eventId===1001){
          const placement=keetaOrderPlacementIdentity(envelope.message);
          const intentKey='order:intent:'+placement.providerOrderId;
          const existingIntent=await this.state.storage.get(intentKey);
          if(!existingIntent){
            await this.state.storage.put(intentKey,Object.freeze({
              schema:MFK_KEETA_ORDER_INTENT_SCHEMA,
              storeId:'MF01',
              provider:'KEETA',
              providerShopId:envelope.shopId,
              providerOrderId:placement.providerOrderId,
              providerMessageId:envelope.messageId,
              providerPushedAt:new Date(envelope.timestamp*1000).toISOString(),
              receivedAt:acceptedAt,
              fingerprint,
              rawMessage:placement.rawMessage,
              state:'PENDING_SMT',
            }));
          }
          try{
            const commercial=keetaCommercialSnapshot(
              placement.rawMessage,
              acceptedAt,
              'KEETA_WEBHOOK:'+envelope.messageId,
            );
            if(commercial.providerOrderId!==placement.providerOrderId){
              throw new Error('KEETA_COMMERCIAL_PROVIDER_ORDER_ID_MISMATCH');
            }
            const commercialKey='commercial:order:'+placement.providerOrderId;
            const existingCommercial=await this.state.storage.get(commercialKey);
            if(!existingCommercial){
              await this.state.storage.put(commercialKey,Object.freeze({
                state:'WEBHOOK_CAPTURED',
                provider:'KEETA',
                canonicalStoreId:'MF01',
                providerShopId:envelope.shopId,
                providerOrderId:commercial.providerOrderId,
                providerOrderCode:commercial.providerOrderCode,
                snapshot:commercial.snapshot,
                capturedAt:acceptedAt,
                latestEvidenceRef:'KEETA_WEBHOOK:'+envelope.messageId,
                providerConfirmedAt:null,
                canonicalOrderId:null,
                canonicalDisplay:null,
              }));
            }
          }catch(error){
            await this.state.storage.put('commercial:issue:'+placement.providerOrderId,Object.freeze({
              provider:'KEETA',
              providerOrderId:placement.providerOrderId,
              providerMessageId:envelope.messageId,
              code:error instanceof Error?error.message:'KEETA_COMMERCIAL_CAPTURE_FAILED',
              observedAt:acceptedAt,
              authorityBoundary:'COMMERCIAL_EVIDENCE_FAILURE_MUST_NOT_REJECT_ORDER_WEBHOOK',
            }));
          }
        }
        if([1002,1003,1004,1006,1008].includes(envelope.eventId)){
          const lifecycle=keetaOrderLifecycleIdentity(envelope.message);
          const eventKey='order:event:'+envelope.messageId;
          const existingEvent=await this.state.storage.get(eventKey);
          if(!existingEvent){
            await this.state.storage.put(eventKey,Object.freeze({
              schema:'MFK_KEETA_ORDER_EVENT_V1',
              storeId:'MF01',
              provider:'KEETA',
              providerShopId:envelope.shopId,
              providerOrderId:lifecycle.providerOrderId,
              providerMessageId:envelope.messageId,
              eventId:envelope.eventId,
              eventName:envelope.eventName,
              providerPushedAt:new Date(envelope.timestamp*1000).toISOString(),
              receivedAt:acceptedAt,
              fingerprint,
              rawMessage:lifecycle.rawMessage,
              state:'PENDING_SMT',
            }));
          }
        }

        if(envelope.eventId===1005||envelope.eventId===1007){
          const afterSale=keetaAfterSaleIdentity(envelope.message);
          const eventKey='after-sale:event:'+envelope.messageId;
          const eventRow=Object.freeze({
            schema:'MFK_KEETA_AFTER_SALE_EVENT_V1',
            storeId:'MF01',
            provider:'KEETA',
            providerShopId:envelope.shopId,
            providerOrderId:afterSale.providerOrderId,
            afterSaleOrderId:afterSale.afterSaleOrderId,
            providerMessageId:envelope.messageId,
            eventId:envelope.eventId,
            eventName:envelope.eventName,
            providerPushedAt:new Date(envelope.timestamp*1000).toISOString(),
            receivedAt:acceptedAt,
            fingerprint,
            rawMessage:afterSale.rawMessage,
            providerStatus:afterSale.providerStatus,
            refundAmountMinor:afterSale.refundAmountMinor,
            currency:afterSale.currency,
            state:'PENDING_SMT',
          });
          if(!(await this.state.storage.get(eventKey)))await this.state.storage.put(eventKey,eventRow);
          await this.state.storage.put('after-sale:case:'+afterSale.afterSaleOrderId,Object.freeze({
            provider:'KEETA',
            providerShopId:envelope.shopId,
            providerOrderId:afterSale.providerOrderId,
            afterSaleOrderId:afterSale.afterSaleOrderId,
            latestEventId:envelope.eventId,
            latestMessageId:envelope.messageId,
            providerStatus:afterSale.providerStatus,
            refundAmountMinor:afterSale.refundAmountMinor,
            currency:afterSale.currency,
            rawMessage:afterSale.rawMessage,
            updatedAt:acceptedAt,
          }));
        }
        await this.state.storage.put('webhook:status',{
          ...status,
          acceptedCount:(Number(status.acceptedCount)||0)+1,
          lastAcceptedAt:acceptedAt,
          lastEventId:envelope.eventId,
          lastMessageId:envelope.messageId,
        });

        if(envelope.eventId===1202||envelope.eventId===1201){
          const completion=parseKeetaMenuCompletionMessage(envelope.message,envelope.eventId,config.providerShopId);
          const menuTaskId=envelope.eventId===1202?completion.taskId:completion.mainTaskId;
          if(menuTaskId){
            const taskKey='menu:sync:task:'+menuTaskId;
            const current=await this.state.storage.get(taskKey);
            if(current){
              const updated=Object.freeze({
                ...current,
                ...(envelope.eventId===1202?{
                  state:completion.errors.length?'PARTIAL':'COMPLETED',
                  completion:Object.freeze({
                    messageId:envelope.messageId,
                    completedAt:acceptedAt,
                    taskId:completion.taskId,
                    pictureTaskId:completion.pictureTaskId,
                    errors:completion.errors,
                  }),
                }:{
                  pictureCompletion:Object.freeze({
                    messageId:envelope.messageId,
                    completedAt:acceptedAt,
                    taskId:completion.taskId,
                    mainTaskId:completion.mainTaskId,
                    errors:completion.errors,
                  }),
                }),
              });
              await this.state.storage.put(taskKey,updated);
              const latest=await this.state.storage.get('menu:sync:latest');
              if(latest&&Number(latest.taskId)===Number(menuTaskId)){
                await this.state.storage.put('menu:sync:latest',updated);
              }
            }
          }
        }
        return json({code:0,message:'Success',data:{}});
      }catch(error){
        const code=error instanceof Error?error.message:'KEETA_WEBHOOK_REJECTED';
        if(code==='KEETA_WEBHOOK_SIGNATURE_INVALID'){
          await this.state.storage.put('webhook:status',{
            ...status,
            lastSignatureFailureAt:new Date().toISOString(),
          });
        }
        return json({code},401);
      }
    }

    return json({code:'NOT_FOUND'},404);
  }
}
