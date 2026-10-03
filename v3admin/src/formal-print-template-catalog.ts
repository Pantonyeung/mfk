import {PRINT_TEMPLATE_CATALOG_SCHEMA,PRINT_TEMPLATE_PROFILE_SCHEMA,clonePrintTemplateJson,mergePrintTemplateCatalogs,readPrintLogicalDestinations,validatePrintTemplateCatalog,validatePrintTemplateProfile,validatePrintTemplateVersion,type PrintTemplateBinding} from '../../contracts/print-template-catalog-v1.ts';

/** Prepare existing Formal Server Draft data only; never publishes or mutates a server. */
export async function appendFormalPrintTemplateVersion(snapshot:Record<string,unknown>,value:unknown):Promise<Record<string,unknown>>{
  const previous=await validatePrintTemplateCatalog(snapshot.printTemplateCatalog??{schema:PRINT_TEMPLATE_CATALOG_SCHEMA,versions:[]});
  const version=await validatePrintTemplateVersion(value);
  const catalog=await mergePrintTemplateCatalogs(previous,{schema:PRINT_TEMPLATE_CATALOG_SCHEMA,versions:[version]});
  return {...snapshot,printTemplateCatalog:catalog};
}
/** Admin profile is authoritative. Product eligibility/routing remain existing snapshot fields. */
export async function writeFormalPrintTemplateProfile(snapshot:Record<string,unknown>,bindings:readonly PrintTemplateBinding[]):Promise<Record<string,unknown>>{
  const catalog=await validatePrintTemplateCatalog(snapshot.printTemplateCatalog);
  const profile=validatePrintTemplateProfile({schema:PRINT_TEMPLATE_PROFILE_SCHEMA,bindings},catalog,readPrintLogicalDestinations(snapshot.logicalPrinters));
  return {...snapshot,printTemplateProfile:profile};
}
/** Lossless source inventory only. Legacy label meaning/renderer/media require an explicit mapping. */
export function inspectLegacyPrintTemplateInputs(snapshot:Record<string,unknown>){
  const raw=snapshot.printTemplates;
  const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  const settings=new Set(['showComboRelationship','separateFoodDrinkCount']);
  const keys=['receipt','production','packing','productLabel','bagLabel','mealVoucher'];
  return Object.freeze({
    inputs:Object.freeze(Object.entries(source).filter(([key])=>!settings.has(key)).map(([sourceKey,value])=>Object.freeze({sourceKey,value:clonePrintTemplateJson(value),status:'EXPLICIT_MAPPING_REQUIRED' as const}))),
    settings:clonePrintTemplateJson(Object.fromEntries(Object.entries(source).filter(([key])=>settings.has(key)))),
    missingSourceKeys:Object.freeze(keys.filter(key=>!Object.hasOwn(source,key))),
    sourceStatus:raw===undefined?'SOURCE_MISSING' as const:raw&&typeof raw==='object'&&!Array.isArray(raw)?'SOURCE_PRESENT' as const:'SOURCE_FORMAT_UNKNOWN' as const,
    ...(raw===undefined?{}:{rawSource:clonePrintTemplateJson(raw)}),
  });
}
