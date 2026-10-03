import {describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {createPrintTemplateVersion,type PrintTemplateVersion} from '../../contracts/print-template-catalog-v1.ts';
import {projectMfpPrintTemplates,pinMfpPrintTemplateForJob,resolveMfpPinnedPrintTemplate,readMfpPrintTemplateProjection} from './print-template-projection.ts';

const version=(n:number)=>createPrintTemplateVersion({templateId:'receipt',version:n,jobType:'RECEIPT',name:'收據',rendererId:'fixture.template.v1',media:{widthMm:80,dpi:203},definition:{title:'V'+n}});
const pin=(v:PrintTemplateVersion)=>({logicalDestinationId:'receipt-main',jobType:v.jobType,templateId:v.templateId,templateRevision:v.version,templateDigest:v.digest});
const envelope=(versions:PrintTemplateVersion[],active:PrintTemplateVersion,revision=1,storeId='MF01')=>createMfkAdminConfigEnvelope({storeId,revision,publishedAt:`2026-10-03T06:${String(revision).padStart(2,'0')}:00Z`,adminFingerprint:'admin-test',snapshot:{catalog:{},logicalPrinters:[{id:'receipt-main',type:'RECEIPT'}],printRules:{p1:{receipt:true}},printTemplateCatalog:{schema:'mfp.print-template-catalog.v1',versions},printTemplateProfile:{schema:'mfp.print-template-profile.v1',bindings:[pin(active)]}}});
const options={storeId:'MF01',supportedRendererIds:['fixture.template.v1']};

describe('MFP Admin-owned template projection',()=>{
  it('keeps the active Admin profile when V3 and V10 become available and sorts versions numerically',async()=>{
    const [v2,v3,v10]=await Promise.all([version(2),version(3),version(10)]);
    const first=await projectMfpPrintTemplates(null,envelope([v2],v2),options);
    const refreshed=await projectMfpPrintTemplates(first,envelope([v10,v3,v2],v2,2),options);
    expect(refreshed.catalog.versions.map(v=>v.version)).toEqual([2,3,10]);
    expect(pinMfpPrintTemplateForJob(refreshed,'receipt-main','RECEIPT',{quantitySummaryEnabled:true})).toEqual({...pin(v2),storeId:'MF01',presentation:{quantitySummaryEnabled:true}});
    expect(first.catalog.versions).toHaveLength(1);
  });

  it('changes active version only from an Admin profile and resolves old job pins independently for reprints',async()=>{
    const [v2,v3]=await Promise.all([version(2),version(3)]);
    const first=await projectMfpPrintTemplates(null,envelope([v2],v2),options);
    const oldJobPin=pinMfpPrintTemplateForJob(first,'receipt-main','RECEIPT',{quantitySummaryEnabled:true});
    const changed=await projectMfpPrintTemplates(first,envelope([v3],v3,2),options);
    expect(pinMfpPrintTemplateForJob(changed,'receipt-main','RECEIPT',{quantitySummaryEnabled:true}).templateRevision).toBe(3);
    expect(resolveMfpPinnedPrintTemplate(changed,oldJobPin).version).toBe(2);
    expect(changed.catalog.versions.map(v=>v.version)).toEqual([2,3]);
  });

  it('validates retained cache after a restart and preserves LKG after an invalid or stale canonical pull',async()=>{
    const v2=await version(2);
    const first=await projectMfpPrintTemplates(null,envelope([v2],v2,2),options);
    const persisted=JSON.parse(JSON.stringify(first));
    const restored=await readMfpPrintTemplateProjection(persisted,options);
    expect(restored).toEqual(first);
    await expect(projectMfpPrintTemplates(restored,envelope([v2],v2,1),options)).rejects.toThrow('PRINT_TEMPLATE_PUBLICATION_STALE');
    await expect(projectMfpPrintTemplates(restored,{...envelope([v2],v2,3),fingerprint:'corrupt'},options)).rejects.toThrow('ADMIN_CONFIG_FINGERPRINT_MISMATCH');
    expect(pinMfpPrintTemplateForJob(restored,'receipt-main','RECEIPT',{quantitySummaryEnabled:true}).templateRevision).toBe(2);
    persisted.catalog.versions[0].definition.title='tampered';
    await expect(readMfpPrintTemplateProjection(persisted,options)).rejects.toThrow('PRINT_TEMPLATE_DIGEST_MISMATCH');
  });

  it('rejects same version replacement and cross-store cache or job pins',async()=>{
    const v2=await version(2);
    const first=await projectMfpPrintTemplates(null,envelope([v2],v2),options);
    const {digest:_digest,...base}=v2;
    const changed=await createPrintTemplateVersion({...base,definition:{title:'Changed'}});
    await expect(projectMfpPrintTemplates(first,envelope([changed],changed,2),options)).rejects.toThrow('PRINT_TEMPLATE_VERSION_IMMUTABLE');
    await expect(projectMfpPrintTemplates(first,envelope([v2],v2,2,'OTHER'),options)).rejects.toThrow('PRINT_TEMPLATE_STORE_MISMATCH');
    expect(()=>resolveMfpPinnedPrintTemplate(first,{...pin(v2),storeId:'OTHER',presentation:{quantitySummaryEnabled:true}})).toThrow('PRINT_TEMPLATE_STORE_MISMATCH');
  });

  it('never auto-selects an absent profile, unknown renderer or invented route',async()=>{
    const v2=await version(2);
    const original=envelope([v2],v2);
    const noProfile=createMfkAdminConfigEnvelope({...original,snapshot:{...original.snapshot,printTemplateProfile:undefined}});
    await expect(projectMfpPrintTemplates(null,noProfile,options)).rejects.toThrow('PRINT_TEMPLATE_PROFILE_INVALID');
    await expect(projectMfpPrintTemplates(null,original,{...options,supportedRendererIds:[]})).rejects.toThrow('PRINT_TEMPLATE_RENDERER_UNSUPPORTED');
    const state=await projectMfpPrintTemplates(null,original,options);
    expect(()=>pinMfpPrintTemplateForJob(state,'invented','RECEIPT',{quantitySummaryEnabled:true})).toThrow('PRINT_TEMPLATE_PROFILE_BINDING_MISSING');
    expect(()=>resolveMfpPinnedPrintTemplate(state,{...pin(v2),storeId:'MF01',presentation:{quantitySummaryEnabled:true},templateDigest:'sha256:'+'0'.repeat(64)})).toThrow('PRINT_TEMPLATE_PIN_MISMATCH');
  });

  it('pins the local presentation toggle once and never lets a later toggle rewrite the original job',async()=>{
    const v2=await version(2);
    const state=await projectMfpPrintTemplates(null,envelope([v2],v2),options);
    const flags={quantitySummaryEnabled:true};
    const original=pinMfpPrintTemplateForJob(state,'receipt-main','RECEIPT',flags);
    flags.quantitySummaryEnabled=false;
    const later=pinMfpPrintTemplateForJob(state,'receipt-main','RECEIPT',flags);
    expect(original.presentation.quantitySummaryEnabled).toBe(true);
    expect(later.presentation.quantitySummaryEnabled).toBe(false);
    expect(Object.isFrozen(original.presentation)).toBe(true);
    expect(resolveMfpPinnedPrintTemplate(state,original)).toEqual(v2);
    expect(()=>pinMfpPrintTemplateForJob(state,'receipt-main','RECEIPT',undefined as any)).toThrow('PRINT_PRESENTATION_REQUIRED');
  });
});
