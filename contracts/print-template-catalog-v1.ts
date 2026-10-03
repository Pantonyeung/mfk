/** Pure metadata/integrity contract. Renderer-specific validation remains a publisher gate. */
export const PRINT_TEMPLATE_CATALOG_SCHEMA='mfp.print-template-catalog.v1' as const;
export const PRINT_TEMPLATE_PROFILE_SCHEMA='mfp.print-template-profile.v1' as const;
export type PrintTemplateJobType='RECEIPT'|'PRODUCTION'|'PACKING'|'TABLE_TICKET'|'PRODUCT_LABEL'|'BAG_LABEL'|'CANCEL_NOTICE'|'DAILY_REPORT';
export type PrintTemplateJson=null|boolean|number|string|readonly PrintTemplateJson[]|{readonly [key:string]:PrintTemplateJson};
export interface PrintTemplateVersionInput{
  readonly templateId:string;
  readonly version:number;
  readonly jobType:PrintTemplateJobType;
  readonly name:string;
  readonly rendererId:string;
  readonly media:Readonly<{widthMm:number;heightMm?:number;dpi?:number}>;
  readonly definition:Readonly<Record<string,PrintTemplateJson>>;
}
export interface PrintTemplateVersion extends PrintTemplateVersionInput{readonly digest:string;}
export interface PrintTemplateCatalog{readonly schema:typeof PRINT_TEMPLATE_CATALOG_SCHEMA;readonly versions:readonly PrintTemplateVersion[];}
export interface PrintTemplateBinding{
  readonly logicalDestinationId:string;
  readonly jobType:PrintTemplateJobType;
  readonly templateId:string;
  readonly templateRevision:number;
  readonly templateDigest:string;
}
export interface PrintTemplateProfile{readonly schema:typeof PRINT_TEMPLATE_PROFILE_SCHEMA;readonly bindings:readonly PrintTemplateBinding[];}
export interface PrintLogicalDestination{readonly id:string;readonly type:string;}
const types=new Set<string>(['RECEIPT','PRODUCTION','PACKING','TABLE_TICKET','PRODUCT_LABEL','BAG_LABEL','CANCEL_NOTICE','DAILY_REPORT']);
export function printTemplateRecord(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error(code);
  return value as Record<string,unknown>;
}
export function printTemplateFields(row:Record<string,unknown>,allowed:readonly string[]){
  if(Object.keys(row).some(key=>!allowed.includes(key)))throw new Error('PRINT_TEMPLATE_UNKNOWN_FIELD');
}
export function printTemplateText(value:unknown,code:string){
  if(typeof value!=='string'||!value.trim()||value!==value.trim())throw new Error(code);
  return value;
}
function positive(value:unknown,code:string){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new Error(code);return value;}
function version(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw new Error('PRINT_TEMPLATE_VERSION_INVALID');return value;}
function digest(value:unknown){if(typeof value!=='string'||!/^sha256:[0-9a-f]{64}$/.test(value))throw new Error('PRINT_TEMPLATE_DIGEST_INVALID');return value;}
function jobType(value:unknown):PrintTemplateJobType{if(typeof value!=='string'||!types.has(value))throw new Error('PRINT_TEMPLATE_JOB_TYPE_INVALID');return value as PrintTemplateJobType;}
export function clonePrintTemplateJson(value:unknown):PrintTemplateJson{
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value))return Object.freeze(value.map(clonePrintTemplateJson));
  const row=printTemplateRecord(value,'PRINT_TEMPLATE_JSON_INVALID');
  return Object.freeze(Object.fromEntries(Object.keys(row).sort().map(key=>[key,clonePrintTemplateJson(row[key])])));
}
function parseInput(value:unknown,withDigest:boolean):PrintTemplateVersionInput{
  const row=printTemplateRecord(value,'PRINT_TEMPLATE_VERSION_INVALID');
  printTemplateFields(row,['templateId','version','jobType','name','rendererId','media','definition',...(withDigest?['digest']:[])]);
  const media=printTemplateRecord(row.media,'PRINT_TEMPLATE_MEDIA_INVALID');
  printTemplateFields(media,['widthMm','heightMm','dpi']);
  const definition=clonePrintTemplateJson(printTemplateRecord(row.definition,'PRINT_TEMPLATE_DEFINITION_INVALID')) as Readonly<Record<string,PrintTemplateJson>>;
  return Object.freeze({
    templateId:printTemplateText(row.templateId,'PRINT_TEMPLATE_ID_INVALID'),version:version(row.version),jobType:jobType(row.jobType),
    name:printTemplateText(row.name,'PRINT_TEMPLATE_NAME_INVALID'),rendererId:printTemplateText(row.rendererId,'PRINT_TEMPLATE_RENDERER_INVALID'),
    media:Object.freeze({widthMm:positive(media.widthMm,'PRINT_TEMPLATE_MEDIA_INVALID'),...(media.heightMm===undefined?{}:{heightMm:positive(media.heightMm,'PRINT_TEMPLATE_MEDIA_INVALID')}),...(media.dpi===undefined?{}:{dpi:positive(media.dpi,'PRINT_TEMPLATE_MEDIA_INVALID')})}),definition,
  });
}
async function fingerprint(value:PrintTemplateVersionInput){
  const bytes=new TextEncoder().encode(JSON.stringify(clonePrintTemplateJson(value)));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return 'sha256:'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function createPrintTemplateVersion(input:PrintTemplateVersionInput):Promise<PrintTemplateVersion>{
  const parsed=parseInput(input,false);
  return Object.freeze({...parsed,digest:await fingerprint(parsed)});
}
export async function validatePrintTemplateVersion(value:unknown):Promise<PrintTemplateVersion>{
  const parsed=parseInput(value,true);
  const claimed=digest((value as Record<string,unknown>).digest);
  if(claimed!==await fingerprint(parsed))throw new Error('PRINT_TEMPLATE_DIGEST_MISMATCH');
  return Object.freeze({...parsed,digest:claimed});
}
export async function validatePrintTemplateCatalog(value:unknown):Promise<PrintTemplateCatalog>{
  const row=printTemplateRecord(value,'PRINT_TEMPLATE_CATALOG_INVALID');
  printTemplateFields(row,['schema','versions']);
  if(row.schema!==PRINT_TEMPLATE_CATALOG_SCHEMA||!Array.isArray(row.versions))throw new Error('PRINT_TEMPLATE_CATALOG_INVALID');
  const versions=await Promise.all(row.versions.map(validatePrintTemplateVersion));
  const keys=new Set<string>();const families=new Map<string,string>();
  for(const item of versions){
    const key=JSON.stringify([item.templateId,item.version]);
    if(keys.has(key))throw new Error('PRINT_TEMPLATE_VERSION_DUPLICATE');keys.add(key);
    if(families.has(item.templateId)&&families.get(item.templateId)!==item.jobType)throw new Error('PRINT_TEMPLATE_JOB_TYPE_CONFLICT');
    families.set(item.templateId,item.jobType);
  }
  return Object.freeze({schema:PRINT_TEMPLATE_CATALOG_SCHEMA,versions:Object.freeze(versions.sort((a,b)=>a.templateId===b.templateId?a.version-b.version:a.templateId<b.templateId?-1:1))});
}
/** Append-only cache/history merge, not a publication or renderer. */
export async function mergePrintTemplateCatalogs(previous:PrintTemplateCatalog,incoming:PrintTemplateCatalog){
  const versions=[...previous.versions];
  for(const item of incoming.versions){
    const old=versions.find(v=>v.templateId===item.templateId&&v.version===item.version);
    if(old&&old.digest!==item.digest)throw new Error('PRINT_TEMPLATE_VERSION_IMMUTABLE');
    if(!old)versions.push(item);
  }
  return validatePrintTemplateCatalog({schema:PRINT_TEMPLATE_CATALOG_SCHEMA,versions});
}
export function validatePrintTemplateBinding(value:unknown):PrintTemplateBinding{
  const row=printTemplateRecord(value,'PRINT_TEMPLATE_BINDING_INVALID');
  printTemplateFields(row,['logicalDestinationId','jobType','templateId','templateRevision','templateDigest']);
  return Object.freeze({logicalDestinationId:printTemplateText(row.logicalDestinationId,'PRINT_TEMPLATE_DESTINATION_INVALID'),jobType:jobType(row.jobType),templateId:printTemplateText(row.templateId,'PRINT_TEMPLATE_ID_INVALID'),templateRevision:version(row.templateRevision),templateDigest:digest(row.templateDigest)});
}
export function resolvePrintTemplateBinding(catalog:PrintTemplateCatalog,value:unknown){
  const pin=validatePrintTemplateBinding(value);
  const template=catalog.versions.find(v=>v.templateId===pin.templateId&&v.version===pin.templateRevision);
  if(!template||template.digest!==pin.templateDigest||template.jobType!==pin.jobType)throw new Error('PRINT_TEMPLATE_PIN_MISMATCH');
  return template;
}
export function validatePrintTemplateProfile(value:unknown,catalog:PrintTemplateCatalog,destinations:readonly PrintLogicalDestination[]):PrintTemplateProfile{
  const row=printTemplateRecord(value,'PRINT_TEMPLATE_PROFILE_INVALID');
  printTemplateFields(row,['schema','bindings']);
  if(row.schema!==PRINT_TEMPLATE_PROFILE_SCHEMA||!Array.isArray(row.bindings))throw new Error('PRINT_TEMPLATE_PROFILE_INVALID');
  const bindings=row.bindings.map(validatePrintTemplateBinding);const keys=new Set<string>();
  if(new Set(destinations.map(d=>d.id)).size!==destinations.length)throw new Error('PRINT_TEMPLATE_DESTINATION_DUPLICATE');
  for(const binding of bindings){
    const key=JSON.stringify([binding.logicalDestinationId,binding.jobType]);
    if(keys.has(key))throw new Error('PRINT_TEMPLATE_PROFILE_DUPLICATE');keys.add(key);
    const destination=destinations.find(d=>d.id===binding.logicalDestinationId);
    if(!destination)throw new Error('PRINT_TEMPLATE_DESTINATION_MISSING');
    const expected=binding.jobType==='PRODUCT_LABEL'||binding.jobType==='BAG_LABEL'?'LABEL':binding.jobType==='TABLE_TICKET'||binding.jobType==='CANCEL_NOTICE'||binding.jobType==='DAILY_REPORT'?'RECEIPT':binding.jobType;
    if(destination.type!==expected)throw new Error('PRINT_TEMPLATE_DESTINATION_TYPE_MISMATCH');
    resolvePrintTemplateBinding(catalog,binding);
  }
  return Object.freeze({schema:PRINT_TEMPLATE_PROFILE_SCHEMA,bindings:Object.freeze(bindings)});
}
export function readPrintLogicalDestinations(value:unknown):readonly PrintLogicalDestination[]{
  if(!Array.isArray(value))throw new Error('PRINT_TEMPLATE_DESTINATIONS_INVALID');
  return Object.freeze(value.map(item=>{const row=printTemplateRecord(item,'PRINT_TEMPLATE_DESTINATIONS_INVALID');return Object.freeze({id:printTemplateText(row.id,'PRINT_TEMPLATE_DESTINATION_INVALID'),type:printTemplateText(row.type,'PRINT_TEMPLATE_DESTINATION_TYPE_INVALID')});}));
}
