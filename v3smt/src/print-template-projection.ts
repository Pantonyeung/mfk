import {validateMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {mergePrintTemplateCatalogs,printTemplateFields,printTemplateRecord,printTemplateText,readPrintLogicalDestinations,resolvePrintTemplateBinding,validatePrintTemplateCatalog,validatePrintTemplateProfile,type PrintLogicalDestination,type PrintTemplateBinding,type PrintTemplateCatalog,type PrintTemplateJobType,type PrintTemplateProfile} from '../../contracts/print-template-catalog-v1.ts';

export const MFP_PRINT_TEMPLATE_PROJECTION_SCHEMA='mfp.print-template-projection.v1' as const;
export interface MfpPrintTemplateProjection{
  readonly schema:typeof MFP_PRINT_TEMPLATE_PROJECTION_SCHEMA;
  readonly storeId:string;
  readonly publishedAt:string;
  readonly publishedFingerprint:string;
  readonly catalog:PrintTemplateCatalog;
  readonly profile:PrintTemplateProfile;
  readonly logicalDestinations:readonly PrintLogicalDestination[];
}
export interface MfpPrintTemplateProjectionOptions{readonly storeId:string;readonly supportedRendererIds:readonly string[];}
export interface MfpPrintPresentation{readonly quantitySummaryEnabled:boolean;}
export interface MfpPrintTemplateJobPin extends PrintTemplateBinding{readonly storeId:string;readonly presentation:MfpPrintPresentation;}
function assertStore(storeId:unknown,options:MfpPrintTemplateProjectionOptions){
  if(storeId!==options.storeId)throw new Error('PRINT_TEMPLATE_STORE_MISMATCH');
}
function supported(catalog:PrintTemplateCatalog,options:MfpPrintTemplateProjectionOptions){
  if(catalog.versions.some(v=>!options.supportedRendererIds.includes(v.rendererId)))throw new Error('PRINT_TEMPLATE_RENDERER_UNSUPPORTED');
}
function presentation(value:unknown):MfpPrintPresentation{
  const row=printTemplateRecord(value,'PRINT_PRESENTATION_REQUIRED');printTemplateFields(row,['quantitySummaryEnabled']);
  if(typeof row.quantitySummaryEnabled!=='boolean')throw new Error('PRINT_PRESENTATION_REQUIRED');
  return Object.freeze({quantitySummaryEnabled:row.quantitySummaryEnabled});
}
/** Validate a caller-owned retained cache. This module creates no storage or queue authority. */
export async function readMfpPrintTemplateProjection(value:unknown,options:MfpPrintTemplateProjectionOptions):Promise<MfpPrintTemplateProjection>{
  const row=printTemplateRecord(value,'PRINT_TEMPLATE_PROJECTION_INVALID');
  printTemplateFields(row,['schema','storeId','publishedAt','publishedFingerprint','catalog','profile','logicalDestinations']);
  if(row.schema!==MFP_PRINT_TEMPLATE_PROJECTION_SCHEMA)throw new Error('PRINT_TEMPLATE_PROJECTION_INVALID');assertStore(row.storeId,options);
  const publishedAt=printTemplateText(row.publishedAt,'PRINT_TEMPLATE_PUBLISHED_AT_INVALID');
  if(!Number.isFinite(Date.parse(publishedAt)))throw new Error('PRINT_TEMPLATE_PUBLISHED_AT_INVALID');
  const catalog=await validatePrintTemplateCatalog(row.catalog);supported(catalog,options);
  const logicalDestinations=readPrintLogicalDestinations(row.logicalDestinations);
  const profile=validatePrintTemplateProfile(row.profile,catalog,logicalDestinations);
  return Object.freeze({schema:MFP_PRINT_TEMPLATE_PROJECTION_SCHEMA,storeId:options.storeId,publishedAt,publishedFingerprint:printTemplateText(row.publishedFingerprint,'PRINT_TEMPLATE_FINGERPRINT_REQUIRED'),catalog,profile,logicalDestinations});
}
/** Pull only from the existing authenticated Admin envelope provider; doorbells are not input truth.
 * Throws before returning a replacement on invalid data, leaving the caller's LKG unchanged.
 */
export async function projectMfpPrintTemplates(previous:MfpPrintTemplateProjection|null,value:unknown,options:MfpPrintTemplateProjectionOptions):Promise<MfpPrintTemplateProjection>{
  const envelope=validateMfkAdminConfigEnvelope(value);assertStore(envelope.storeId,options);
  const old=previous?await readMfpPrintTemplateProjection(previous,options):null;
  if(old&&Date.parse(envelope.publishedAt)<Date.parse(old.publishedAt))throw new Error('PRINT_TEMPLATE_PUBLICATION_STALE');
  if(old&&Date.parse(envelope.publishedAt)===Date.parse(old.publishedAt)&&envelope.fingerprint!==old.publishedFingerprint)throw new Error('PRINT_TEMPLATE_PUBLICATION_CONFLICT');
  const incoming=await validatePrintTemplateCatalog(envelope.snapshot.printTemplateCatalog);
  const logicalDestinations=readPrintLogicalDestinations(envelope.snapshot.logicalPrinters);
  // The active profile must resolve in the incoming publication, not be silently repaired from cache.
  const profile=validatePrintTemplateProfile(envelope.snapshot.printTemplateProfile,incoming,logicalDestinations);
  const catalog=old?await mergePrintTemplateCatalogs(old.catalog,incoming):incoming;supported(catalog,options);
  return Object.freeze({schema:MFP_PRINT_TEMPLATE_PROJECTION_SCHEMA,storeId:envelope.storeId,publishedAt:envelope.publishedAt,publishedFingerprint:envelope.fingerprint,catalog,profile,logicalDestinations});
}
/** The host freezes this alongside the immutable line/render snapshot when creating its canonical job. */
export function pinMfpPrintTemplateForJob(state:MfpPrintTemplateProjection,logicalDestinationId:string,jobType:PrintTemplateJobType,flags:MfpPrintPresentation):MfpPrintTemplateJobPin{
  const binding=state.profile.bindings.find(b=>b.logicalDestinationId===logicalDestinationId&&b.jobType===jobType);
  if(!binding)throw new Error('PRINT_TEMPLATE_PROFILE_BINDING_MISSING');
  resolvePrintTemplateBinding(state.catalog,binding);
  return Object.freeze({...binding,storeId:state.storeId,presentation:presentation(flags)});
}
/** Reprints use the original pin, never today's active profile or renamed product/category data. */
export function resolveMfpPinnedPrintTemplate(state:MfpPrintTemplateProjection,value:MfpPrintTemplateJobPin){
  const row=printTemplateRecord(value,'PRINT_TEMPLATE_JOB_PIN_INVALID');
  printTemplateFields(row,['storeId','logicalDestinationId','jobType','templateId','templateRevision','templateDigest','presentation']);
  if(row.storeId!==state.storeId)throw new Error('PRINT_TEMPLATE_STORE_MISMATCH');
  presentation(row.presentation);
  const {storeId:_store,presentation:_presentation,...binding}=row;
  return resolvePrintTemplateBinding(state.catalog,binding);
}
