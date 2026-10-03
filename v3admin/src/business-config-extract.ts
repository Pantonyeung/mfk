import type {MfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {PRINT_TEMPLATE_CATALOG_SCHEMA,PRINT_TEMPLATE_PROFILE_SCHEMA} from '../../contracts/print-template-catalog-v1.ts';
import {readV3CanonicalAdminActive,v3AdminCanonicalActiveRequestUrl} from './canonical.ts';

// The envelope requires catalog only; absent optional data must stay absent.
const REQUIRED_SECTIONS=['catalog'] as const;
const OPTIONAL_SECTIONS=['optionCenter','logicalPrinters','printTemplates','printRules','printTemplateCatalog','printTemplateProfile'] as const;
const SELECTED_SECTIONS=[...REQUIRED_SECTIONS,...OPTIONAL_SECTIONS] as const;
type Json=null|boolean|number|string|Json[]|{[key:string]:Json};
type SectionInventory={kind:'array'|'object';entries:number;collections:Record<string,number>};

// Conservative field-name screening: ambiguous sensitive-looking extensions block the
// entire extract. Nothing is silently redacted or reconstructed from editor models.
function excludedKey(key:string){
  const words=key.replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().split(/[^a-z0-9]+/);
  const compact=words.join('');
  return /password|passwd|passphrase|secret|credential|session|token|privatekey|apikey|authorization|cookie/.test(compact)
    ||words.includes('pin')||/^pin(?:hash|salt|code|digest)$/.test(compact)
    ||/^(?:customer|staff|employee)(?:.*(?:name|email|phone|address|record|profile|auth|contact).*|s)$/.test(compact)
    ||/^(?:order|payment|transaction)(?:history|records?)$/.test(compact)
    ||/^(?:auth|authentication|oauth|login|users|userprofile|contact(?:details|person|name|email|phone|address))$/.test(compact)
    ||/^(?:staff|staffauth|customers?|customerrecords?|customername|customeremail|customerphone|customeraddress|email|emailaddress|phone|phonenumber|address|dateofbirth|dob|ssn|transactions?|transactionhistory|orders?|payments?|paymenthistory)$/.test(compact);
}
function excludedText(value:string){
  try{const url=new URL(value);if([...url.searchParams.keys()].some(excludedKey))return true;}catch{/* Ordinary business text is not a URL. */}
  const basic=value.match(/^\s*Basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i);
  if(basic){try{if(atob(basic[1]).includes(':'))return true;}catch{/* Not an encoded Basic credential. */}}
  return /\bBearer\s+[A-Za-z0-9+/_=.-]+/i.test(value)
    ||/(?:^|\n)\s*authorization\s*:\s*(?:Basic|Bearer)\s+\S+/i.test(value)
    ||/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(value)
    ||/[a-z][a-z0-9+.-]*:\/\/[^/\s]*@/i.test(value)
    ||/[?&](?:token|access[_-]?token|api[_-]?key|password|secret|session[_-]?token)=/i.test(value);
}
function pointer(key:string){return key.replace(/~/g,'~0').replace(/\//g,'~1');}
function copyBusinessJson(value:unknown,path:string):Json{
  if(typeof value==='string'){
    if(excludedText(value))throw new Error('BUSINESS_EXTRACT_EXCLUDED_PATH:'+path);
    return value;
  }
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value))return value.map((item,index)=>copyBusinessJson(item,path+'/'+index));
  if(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value))){
    return Object.fromEntries(Object.entries(value).map(([key,item])=>{
      const next=path+'/'+pointer(key);
      if(excludedKey(key))throw new Error('BUSINESS_EXTRACT_EXCLUDED_PATH:'+next);
      return [key,copyBusinessJson(item,next)];
    }));
  }
  throw new Error('BUSINESS_EXTRACT_JSON_INVALID:'+path);
}
function inventory(value:Json):SectionInventory{
  if(Array.isArray(value))return {kind:'array',entries:value.length,collections:{}};
  const row=value as Record<string,Json>;
  return {kind:'object',entries:Object.keys(row).length,collections:Object.fromEntries(Object.entries(row).filter(([,item])=>Array.isArray(item)).map(([key,item])=>[key,(item as Json[]).length]))};
}

function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value&&typeof value==='object'&&!Array.isArray(value));}
function assertRows(value:unknown,path:string){
  if(!Array.isArray(value)||value.some(item=>!isRecord(item)))throw new Error('BUSINESS_EXTRACT_SECTION_INVALID:'+path);
}
/** Shape guards only. Never run editor normalizers or reinterpret historical values. */
function assertDeclaredCollections(key:string,value:unknown,snapshot:Readonly<Record<string,unknown>>){
  if(key==='logicalPrinters'){assertRows(value,key);return;}
  const row=value as Record<string,unknown>;
  if(key==='catalog'){
    assertRows(row.products,'catalog/products');
    for(const field of ['categories','combos','modifierGroups'])if(Object.hasOwn(row,field))assertRows(row[field],'catalog/'+field);
  }
  if(key==='optionCenter')for(const field of ['sets','productLinks'])if(Object.hasOwn(row,field))assertRows(row[field],'optionCenter/'+field);
  if(key==='printTemplateCatalog')assertRows(row.versions,'printTemplateCatalog/versions');
  if(key==='printTemplateProfile')assertRows(row.bindings,'printTemplateProfile/bindings');
  if(key==='printRules'){
    const catalog=snapshot.catalog as Record<string,unknown>;
    const items=[...(catalog.products as Record<string,unknown>[]),...((catalog.combos??[]) as Record<string,unknown>[])];
    for(const item of items)if(typeof item.id==='string'&&Object.hasOwn(row,item.id)&&!isRecord(row[item.id]))throw new Error('BUSINESS_EXTRACT_SECTION_INVALID:printRules/'+pointer(item.id));
  }
}

/** One fresh authenticated GET. No draft/cache/preview input and no server mutation. */
export async function prepareV3BusinessConfigurationExtract(input:{storeId:string;sessionToken:string}){
  if(!input.sessionToken)throw new Error('V3_ADMIN_SESSION_REQUIRED');
  if(!input.storeId.trim()||/^preview(?:$|[_-])/i.test(input.storeId))throw new Error('BUSINESS_EXTRACT_PREVIEW_OR_STORE_INVALID');
  const configuredRequestUrl=v3AdminCanonicalActiveRequestUrl(input.storeId);
  const browserBase=typeof document!=='undefined'?document.baseURI:typeof location!=='undefined'?(location.href||location.origin):undefined;
  const requestUrl=browserBase?new URL(configuredRequestUrl,browserBase).href:configuredRequestUrl;
  if(excludedText(requestUrl))throw new Error('BUSINESS_EXTRACT_SOURCE_URL_INVALID');
  let canonical:MfkAdminConfigEnvelope;
  try{canonical=await readV3CanonicalAdminActive(input);}
  catch{throw new Error('BUSINESS_EXTRACT_CANONICAL_READ_FAILED');}
  const sections:Record<string,Json>={};
  const absentOptionalSections:string[]=[];
  for(const key of SELECTED_SECTIONS){
    if(!Object.hasOwn(canonical.snapshot,key)){
      if((REQUIRED_SECTIONS as readonly string[]).includes(key))throw new Error('BUSINESS_EXTRACT_SECTION_MISSING:'+key);
      absentOptionalSections.push(key);continue;
    }
    const value=canonical.snapshot[key];
    if(!value||typeof value!=='object'||(key==='logicalPrinters'?!Array.isArray(value):Array.isArray(value)))throw new Error('BUSINESS_EXTRACT_SECTION_INVALID:'+key);
    if(key==='printTemplateCatalog'||key==='printTemplateProfile'){
      const row=value as Record<string,unknown>;
      const expected=key==='printTemplateCatalog'?PRINT_TEMPLATE_CATALOG_SCHEMA:PRINT_TEMPLATE_PROFILE_SCHEMA;
      const collection=key==='printTemplateCatalog'?'versions':'bindings';
      if(row.schema!==expected||!Array.isArray(row[collection]))throw new Error('BUSINESS_EXTRACT_SECTION_SCHEMA_INVALID:'+key);
    }
    assertDeclaredCollections(key,value,canonical.snapshot);
    sections[key]=copyBusinessJson(value,'/'+key);
  }
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(sections)));
  return {
    schema:'MFP_ADMIN_SELECTED_BUSINESS_CONFIG_EXTRACT_V1' as const,
    artifactKind:'selected business configuration extract' as const,
    capturedAt:new Date().toISOString(),
    source:{kind:'AUTHENTICATED_CANONICAL_ACTIVE_READ' as const,endpointPath:'/api/admin-browser/active',requestUrl,schema:canonical.schema,storeId:canonical.storeId,revision:canonical.revision,publishedAt:canonical.publishedAt,adminFingerprint:canonical.adminFingerprint,canonicalFingerprint:canonical.fingerprint,identityVerification:'Existing envelope FNV-1a32 integrity check; authenticated active read; not a cryptographic signature'},
    selectedSections:Object.keys(sections),
    absentOptionalSections,
    exclusions:{topLevelFields:Object.keys(canonical.snapshot).filter(key=>!(SELECTED_SECTIONS as readonly string[]).includes(key)).sort(),policy:'Only selected business sections. Staff/authentication, credentials, customer records and transaction history are excluded. Sensitive-looking nested fields block preparation; opaque values are not semantically classified.',completeness:'SELECTED_SECTIONS_ONLY_NOT_FULL_SYSTEM_BACKUP' as const},
    inventory:Object.fromEntries(Object.entries(sections).map(([key,value])=>[key,inventory(value)])),
    selectedSectionsChecksum:{algorithm:'SHA-256' as const,serialization:'UTF-8 JSON.stringify(sections)' as const,value:'sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')},
    sections,
  };
}
export type V3BusinessConfigurationExtract=Awaited<ReturnType<typeof prepareV3BusinessConfigurationExtract>>;
