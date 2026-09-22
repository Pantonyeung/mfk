import { signKeetaShape } from './signature.js';
import { normalizeKeetaProviderResponse } from './response.js';
import { parseKeetaTokenMaterial } from './auth.js';

export async function sendKeetaSignedJsonRuntime({
  url,
  params,
  appSecret,
  fetcher=fetch,
}){
  if(typeof url!=='string'||!url.startsWith('https://'))throw new Error('KEETA_HTTPS_REQUIRED');
  const signed=signKeetaShape(url,params,appSecret);
  const response=await fetcher(url,{
    method:'POST',
    headers:{'content-type':'application/json; charset=utf-8'},
    body:JSON.stringify({...params,sig:signed.sig}),
  });
  if(response.status!==200)throw new Error('KEETA_HTTP_STATUS_'+response.status);
  return normalizeKeetaProviderResponse(await response.text());
}

export async function exchangeKeetaAuthorizationCodeRuntime({
  appId,
  code,
  timestamp,
  appSecret,
  fetcher=fetch,
}){
  if(!Number.isSafeInteger(appId)||appId<=0)throw new Error('KEETA_TOKEN_REQUEST_INPUT_INVALID');
  if(!Number.isSafeInteger(timestamp)||timestamp<=0)throw new Error('KEETA_TOKEN_REQUEST_INPUT_INVALID');
  if(typeof code!=='string'||!code.trim())throw new Error('KEETA_AUTHORIZATION_CODE_INPUT_INVALID');
  const url='https://open.mykeeta.com/api/open/base/oauth/token';
  const signed=signKeetaShape(url,{
    appId,
    timestamp,
    grantType:'authorization_code',
    code:code.trim(),
  },appSecret);
  const response=await fetcher(url,{
    method:'POST',
    headers:{'content-type':'application/json; charset=utf-8'},
    body:JSON.stringify({
      appId,
      timestamp,
      grantType:'authorization_code',
      code:code.trim(),
      sig:signed.sig,
    }),
  });
  if(response.status!==200)throw new Error('KEETA_HTTP_STATUS_'+response.status);
  return parseKeetaTokenMaterial(await response.text());
}

export async function refreshKeetaTokenRuntime({
  appId,
  refreshToken,
  timestamp,
  appSecret,
  fetcher=fetch,
}){
  if(!Number.isSafeInteger(appId)||appId<=0)throw new Error('KEETA_TOKEN_REQUEST_INPUT_INVALID');
  if(!Number.isSafeInteger(timestamp)||timestamp<=0)throw new Error('KEETA_TOKEN_REQUEST_INPUT_INVALID');
  if(typeof refreshToken!=='string'||!refreshToken.trim())throw new Error('KEETA_TOKEN_REFRESH_INPUT_INVALID');
  const url='https://open.mykeeta.com/api/open/base/oauth/token';
  const signed=signKeetaShape(url,{
    appId,
    timestamp,
    grantType:'refresh_token',
    refreshToken:refreshToken.trim(),
  },appSecret);
  const response=await fetcher(url,{
    method:'POST',
    headers:{'content-type':'application/json; charset=utf-8'},
    body:JSON.stringify({
      appId,
      timestamp,
      grantType:'refresh_token',
      refreshToken:refreshToken.trim(),
      sig:signed.sig,
    }),
  });
  if(response.status!==200)throw new Error('KEETA_HTTP_STATUS_'+response.status);
  return parseKeetaTokenMaterial(await response.text());
}
