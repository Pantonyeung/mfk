import {describe,expect,it} from 'vitest';
import {createPrintTemplateVersion,validatePrintTemplateCatalog} from '../../contracts/print-template-catalog-v1.ts';
import {appendFormalPrintTemplateVersion,writeFormalPrintTemplateProfile,inspectLegacyPrintTemplateInputs} from './formal-print-template-catalog.ts';

const definition={title:'  收據\n',sections:[{kind:'items',widthDots:576}],showComboRelationship:false};
const input=(version=2)=>({templateId:'receipt-standard',version,jobType:'RECEIPT' as const,name:'收據',rendererId:'fixture.template.v1',media:{widthMm:80,dpi:203},definition});
const snapshot=()=>({catalog:{products:[{id:'p1'}]},logicalPrinters:[{id:'receipt-main',type:'RECEIPT',widthMm:80}],printRules:{p1:{receipt:true,label:false}},printTemplates:{receipt:'  LEGACY\n',label:'OLD LABEL',extra:{keep:true}},untouched:{keep:true}});

describe('Admin immutable template catalog adapters',()=>{
  it('appends exact numeric versions while preserving all legacy content, routing and unknown siblings',async()=>{
    const before=snapshot();
    const v2=await createPrintTemplateVersion(input(2));
    const first=await appendFormalPrintTemplateVersion(before,v2);
    const second=await appendFormalPrintTemplateVersion(first,await createPrintTemplateVersion(input(10)));
    expect((second.printTemplateCatalog as any).versions.map((v:any)=>v.version)).toEqual([2,10]);
    expect(second.printTemplates).toEqual(before.printTemplates);
    expect(second.printRules).toEqual(before.printRules);
    expect(second.logicalPrinters).toEqual(before.logicalPrinters);
    expect(second.untouched).toEqual({keep:true});
    expect(v2.definition).toEqual(definition);
    expect(v2.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(v2.digest).toBe('sha256:344bb2243cccfb2536a064ae83e67379913c5d19b581b78f98dfa6b8b0fe569a');
    expect(before).not.toHaveProperty('printTemplateCatalog');
  });

  it('treats an exact append replay as idempotent but rejects mutation of a published identity',async()=>{
    const v2=await createPrintTemplateVersion(input());
    const before=await appendFormalPrintTemplateVersion(snapshot(),v2);
    expect(await appendFormalPrintTemplateVersion(before,v2)).toEqual(before);
    const altered=await createPrintTemplateVersion({...input(),definition:{title:'Changed'}});
    await expect(appendFormalPrintTemplateVersion(before,altered)).rejects.toThrow('PRINT_TEMPLATE_VERSION_IMMUTABLE');
    expect((before.printTemplateCatalog as any).versions[0].digest).toBe(v2.digest);
  });

  it('requires explicit Admin profile changes and references the exact digest and logical destination',async()=>{
    const v2=await createPrintTemplateVersion(input());
    const draft=await appendFormalPrintTemplateVersion(snapshot(),v2);
    const binding={logicalDestinationId:'receipt-main',jobType:'RECEIPT' as const,templateId:v2.templateId,templateRevision:v2.version,templateDigest:v2.digest};
    const selected=await writeFormalPrintTemplateProfile(draft,[binding]);
    const withV3=await appendFormalPrintTemplateVersion(selected,await createPrintTemplateVersion(input(3)));
    expect(withV3.printTemplateProfile).toEqual(selected.printTemplateProfile);
    await expect(writeFormalPrintTemplateProfile(draft,[{...binding,logicalDestinationId:'invented-route'}])).rejects.toThrow('PRINT_TEMPLATE_DESTINATION_MISSING');
    await expect(writeFormalPrintTemplateProfile(draft,[{...binding,templateDigest:'sha256:'+'0'.repeat(64)}])).rejects.toThrow('PRINT_TEMPLATE_PIN_MISMATCH');
    await expect(writeFormalPrintTemplateProfile(draft,[binding,binding])).rejects.toThrow('PRINT_TEMPLATE_PROFILE_DUPLICATE');
    await expect(writeFormalPrintTemplateProfile(draft,[{...binding,host:'192.0.2.1'} as any])).rejects.toThrow('PRINT_TEMPLATE_UNKNOWN_FIELD');
  });

  it('rejects content tampering, duplicate versions, unknown fields and coercible revision strings',async()=>{
    const v2=await createPrintTemplateVersion(input());
    const cat=(versions:unknown[])=>({schema:'mfp.print-template-catalog.v1',versions});
    await expect(validatePrintTemplateCatalog(cat([{...v2,definition:{title:'tampered'}}]))).rejects.toThrow('PRINT_TEMPLATE_DIGEST_MISMATCH');
    await expect(validatePrintTemplateCatalog(cat([v2,v2]))).rejects.toThrow('PRINT_TEMPLATE_VERSION_DUPLICATE');
    await expect(createPrintTemplateVersion({...input(),version:'2'} as any)).rejects.toThrow('PRINT_TEMPLATE_VERSION_INVALID');
    await expect(createPrintTemplateVersion({...input(),host:'192.0.2.1'} as any)).rejects.toThrow('PRINT_TEMPLATE_UNKNOWN_FIELD');
  });

  it('uses canonical property order for digesting without normalizing content whitespace or media',async()=>{
    const a=await createPrintTemplateVersion(input());
    const b=await createPrintTemplateVersion({...input(),definition:{showComboRelationship:false,sections:[{widthDots:576,kind:'items'}],title:'  收據\n'}});
    expect(a.digest).toBe(b.digest);
    const changed=await createPrintTemplateVersion({...input(),media:{widthMm:58,dpi:203}});
    expect(a.digest).not.toBe(changed.digest);
    expect(Object.isFrozen(a.definition)).toBe(true);
    expect(Object.isFrozen(a.definition.sections)).toBe(true);
  });

  it('inventories supplied legacy values without inventing a label subtype, media or missing meal voucher',()=>{
    const original={...snapshot(),printTemplates:{receipt:'RAW',label:{format:'unknown',widthMm:50},mealVoucher:'VOUCHER',custom:'CUSTOM'}};
    const before=JSON.stringify(original);
    const inventory=inspectLegacyPrintTemplateInputs(original);
    expect(inventory.inputs.map(row=>row.sourceKey)).toEqual(['receipt','label','mealVoucher','custom']);
    expect(inventory.inputs.find(row=>row.sourceKey==='label')?.status).toBe('EXPLICIT_MAPPING_REQUIRED');
    expect(inventory.inputs.find(row=>row.sourceKey==='mealVoucher')?.value).toBe('VOUCHER');
    expect(inventory.missingSourceKeys).toContain('bagLabel');
    expect(inventory.inputs.find(row=>row.sourceKey==='receipt')).not.toHaveProperty('widthMm');
    expect(JSON.stringify(original)).toBe(before);
  });
});
