import {
  MFK_CUSTOMER_COMMERCIAL_FRESHNESS_SCHEMA,
  MFK_CUSTOMER_COMMERCIAL_PROOF_TTL_MS,
  validateMfkCustomerCommercialFreshnessProof,
  type MfkCustomerCommercialFreshnessProof,
} from '../contracts/customer-commercial-freshness-v1.ts';

export interface CustomerCommercialProofKey{
  readonly keyId:string;
  readonly secretHex:string;
}
export interface CustomerCommercialProofKeyring{
  readonly current:CustomerCommercialProofKey;
  readonly previous:readonly CustomerCommercialProofKey[];
}
export interface CustomerCommercialProofIdentity{
  readonly storeId:string;
  readonly customerPortSeq:number;
  readonly projectionHash:string;
  readonly canonicalRevision:number;
  readonly canonicalFingerprint:string;
}

const encoder=new TextEncoder();
function bytesFromHex(value:string){
  if(!/^[0-9a-f]{64,}$/i.test(value)||value.length%2)throw new Error('CUSTOMER_COMMERCIAL_PROOF_KEY_INVALID');
  const output=new Uint8Array(value.length/2);
  for(let index=0;index<output.length;index++)output[index]=Number.parseInt(value.slice(index*2,index*2+2),16);
  return output;
}
function base64Url(bytes:Uint8Array){
  let binary='';
  for(const value of bytes)binary+=String.fromCharCode(value);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function bytesFromBase64Url(value:string){
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('CUSTOMER_COMMERCIAL_PROOF_TOKEN_INVALID');
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
  let binary:string;
  try{binary=atob(padded);}catch{throw new Error('CUSTOMER_COMMERCIAL_PROOF_TOKEN_INVALID');}
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
function keyValue(value:unknown):CustomerCommercialProofKey{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('CUSTOMER_COMMERCIAL_PROOF_KEY_INVALID');
  const row=value as Record<string,unknown>;
  const keyId=String(row.keyId||'').trim();
  const secretHex=String(row.secretHex||'').trim();
  if(!/^[A-Za-z0-9._-]{1,64}$/.test(keyId))throw new Error('CUSTOMER_COMMERCIAL_PROOF_KEY_ID_INVALID');
  bytesFromHex(secretHex);
  return Object.freeze({keyId,secretHex:secretHex.toLowerCase()});
}
export function parseCustomerCommercialProofKeyring(raw:unknown):CustomerCommercialProofKeyring{
  let value:unknown=raw;
  if(typeof raw==='string')try{value=JSON.parse(raw);}catch{throw new Error('CUSTOMER_COMMERCIAL_PROOF_KEYRING_INVALID');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('CUSTOMER_COMMERCIAL_PROOF_KEYRING_INVALID');
  const row=value as Record<string,unknown>;
  const current=keyValue(row.current);
  const previous=Array.isArray(row.previous)?row.previous.map(keyValue):[];
  if(previous.length>1||previous.some(key=>key.keyId===current.keyId))throw new Error('CUSTOMER_COMMERCIAL_PROOF_KEYRING_INVALID');
  return Object.freeze({current,previous:Object.freeze(previous)});
}
function claimsFor(identity:CustomerCommercialProofIdentity,keyId:string,nowMs:number){
  return Object.freeze({
    schema:MFK_CUSTOMER_COMMERCIAL_FRESHNESS_SCHEMA,
    keyId,
    storeId:identity.storeId,
    customerPortSeq:identity.customerPortSeq,
    projectionHash:identity.projectionHash,
    canonicalRevision:identity.canonicalRevision,
    canonicalFingerprint:identity.canonicalFingerprint,
    issuedAt:new Date(nowMs).toISOString(),
    expiresAt:new Date(nowMs+MFK_CUSTOMER_COMMERCIAL_PROOF_TTL_MS).toISOString(),
  });
}
async function cryptoKey(key:CustomerCommercialProofKey,usage:'sign'|'verify'){
  return crypto.subtle.importKey('raw',bytesFromHex(key.secretHex),{name:'HMAC',hash:'SHA-256'},false,[usage]);
}
export async function issueCustomerCommercialFreshnessProof(
  identity:CustomerCommercialProofIdentity,
  keyring:CustomerCommercialProofKeyring,
  nowMs=Date.now(),
):Promise<MfkCustomerCommercialFreshnessProof>{
  const claims=claimsFor(identity,keyring.current.keyId,nowMs);
  const payload=encoder.encode(JSON.stringify(claims));
  const signature=await crypto.subtle.sign('HMAC',await cryptoKey(keyring.current,'sign'),payload);
  return validateMfkCustomerCommercialFreshnessProof({...claims,freshnessToken:base64Url(payload)+'.'+base64Url(new Uint8Array(signature))});
}
export async function verifyCustomerCommercialFreshnessProof(
  input:unknown,
  keyring:CustomerCommercialProofKeyring,
  expected:CustomerCommercialProofIdentity,
  serverReceivedAtMs=Date.now(),
){
  const proof=validateMfkCustomerCommercialFreshnessProof(input);
  if(proof.storeId!==expected.storeId)throw new Error('CUSTOMER_COMMERCIAL_PROOF_STORE_MISMATCH');
  if(proof.customerPortSeq!==expected.customerPortSeq)throw new Error('CUSTOMER_COMMERCIAL_PROOF_PORT_SEQ_MISMATCH');
  if(proof.projectionHash!==expected.projectionHash)throw new Error('CUSTOMER_COMMERCIAL_PROOF_HASH_MISMATCH');
  if(proof.canonicalRevision!==expected.canonicalRevision||proof.canonicalFingerprint!==expected.canonicalFingerprint)throw new Error('CUSTOMER_COMMERCIAL_PROOF_CANONICAL_MISMATCH');
  if(Date.parse(proof.expiresAt)<=serverReceivedAtMs)throw new Error('CUSTOMER_COMMERCIAL_PROOF_EXPIRED');
  if(Date.parse(proof.issuedAt)>serverReceivedAtMs+30_000)throw new Error('CUSTOMER_COMMERCIAL_PROOF_NOT_YET_VALID');
  const key=[keyring.current,...keyring.previous].find(value=>value.keyId===proof.keyId);
  if(!key)throw new Error('CUSTOMER_COMMERCIAL_PROOF_KEY_UNKNOWN');
  const parts=proof.freshnessToken.split('.');
  if(parts.length!==2)throw new Error('CUSTOMER_COMMERCIAL_PROOF_TOKEN_INVALID');
  const payload=bytesFromBase64Url(parts[0]!);
  const signature=bytesFromBase64Url(parts[1]!);
  let claims:unknown;
  try{claims=JSON.parse(new TextDecoder().decode(payload));}catch{throw new Error('CUSTOMER_COMMERCIAL_PROOF_TOKEN_INVALID');}
  const expectedClaims=claimsFor(expected,proof.keyId,Date.parse(proof.issuedAt));
  if(JSON.stringify(claims)!==JSON.stringify(expectedClaims)||proof.expiresAt!==expectedClaims.expiresAt)throw new Error('CUSTOMER_COMMERCIAL_PROOF_SIGNATURE_INVALID');
  const valid=await crypto.subtle.verify('HMAC',await cryptoKey(key,'verify'),signature,payload);
  if(!valid)throw new Error('CUSTOMER_COMMERCIAL_PROOF_SIGNATURE_INVALID');
  return proof;
}
