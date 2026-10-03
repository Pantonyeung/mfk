import {afterEach,describe,expect,it,vi} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {prepareV3BusinessConfigurationExtract} from './business-config-extract.ts';

const snapshot=()=>({
  catalog:{categories:[{id:'cat1'}],products:[{id:'p1',price:'18.50',active:true,extension:{customBusinessFlag:'kept'}}],combos:[{id:'combo1',choices:['p1']}],futureCatalogPolicy:{keep:['exact',0,false]}},
  optionCenter:{sets:[{id:'set1',defaultSelected:true}]},
  logicalPrinters:[{id:'printer1',type:'PRODUCTION',unknownBusinessSetting:7}],
  printTemplates:{production:{text:'商品名稱'},showComboRelationship:true},
  printRules:{p1:{production:true,labelPrinterIds:['printer1']}},
  printTemplateCatalog:{schema:'mfp.print-template-catalog.v1',versions:[],futureField:{keep:true}},
  printTemplateProfile:{schema:'mfp.print-template-profile.v1',bindings:[]},
  staff:[{id:'staff-secret',pin:'112233'}],staffAuth:{password:'do-not-export'},
  customers:[{email:'private@example.test'}],transactionHistory:[{amount:99}],unselectedBusiness:{keepOutside:true},
});
const envelope=(value:Record<string,unknown>=snapshot())=>createMfkAdminConfigEnvelope({storeId:'MF01',revision:27,publishedAt:'2026-10-03T05:00:00.000Z',adminFingerprint:'fnv1a32:5dabb5d9',snapshot:value});
function serve(value:unknown,status=200){const fetcher=vi.fn(async()=>new Response(JSON.stringify(value),{status}));vi.stubGlobal('fetch',fetcher);return fetcher;}
const prepare=()=>prepareV3BusinessConfigurationExtract({storeId:'MF01',sessionToken:'session-only-for-existing-read'});
afterEach(()=>vi.unstubAllGlobals());

describe('selected canonical business configuration extract',()=>{
  it('reads only the authenticated active endpoint and preserves exact selected unknown business fields',async()=>{
    const active=envelope(),fetcher=serve(active),before=JSON.stringify(active);
    const result=await prepare();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toBe('/api/admin-browser/active?storeId=MF01');
    expect(init).toMatchObject({method:'GET',cache:'no-store',credentials:'include'});
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get('x-mfk-admin-session')).toBe('session-only-for-existing-read');
    expect(result.artifactKind).toBe('selected business configuration extract');
    expect(result.sections).toEqual(Object.fromEntries(Object.entries(active.snapshot).filter(([key])=>['catalog','optionCenter','logicalPrinters','printTemplates','printRules','printTemplateCatalog','printTemplateProfile'].includes(key))));
    expect(JSON.stringify(active)).toBe(before);
    expect(result.source).toMatchObject({schema:active.schema,storeId:'MF01',revision:27,publishedAt:active.publishedAt,adminFingerprint:active.adminFingerprint,canonicalFingerprint:active.fingerprint,kind:'AUTHENTICATED_CANONICAL_ACTIVE_READ'});
    expect(result.source.canonicalFingerprint).not.toBe(result.source.adminFingerprint);
    expect(result.inventory.catalog).toMatchObject({kind:'object',collections:{products:1,combos:1,categories:1}});
    expect(result.inventory.logicalPrinters).toMatchObject({kind:'array',entries:1});
    expect(result.exclusions.topLevelFields).toEqual(['customers','staff','staffAuth','transactionHistory','unselectedBusiness']);
    expect(JSON.stringify(result)).not.toMatch(/112233|do-not-export|private@example|session-only-for-existing-read/);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(result.sections)));
    expect(result.selectedSectionsChecksum.value).toBe('sha256:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''));
    expect(result.selectedSectionsChecksum.serialization).toBe('UTF-8 JSON.stringify(sections)');
  });
  it.each(['catalog'])('fails closed on missing required section %s',async key=>{
    const source=snapshot() as Record<string,unknown>;delete source[key];
    if(key==='catalog'){serve({...envelope(),snapshot:source});}else{serve(envelope(source));}
    await expect(prepare()).rejects.toThrow(/CATALOG_REQUIRED|SECTION_MISSING|CANONICAL_READ_FAILED/);
  });
  it.each(['optionCenter','logicalPrinters','printTemplates','printRules','printTemplateCatalog','printTemplateProfile'])('preserves canonical absence of optional %s without synthesizing it',async key=>{
    const source=snapshot() as Record<string,unknown>;delete source[key];
    const active=envelope(source);serve(active);const result=await prepare();
    expect(Object.hasOwn(result.sections,key)).toBe(false);expect(Object.hasOwn(result.inventory,key)).toBe(false);
    expect(result.absentOptionalSections).toEqual([key]);expect(result.selectedSections).not.toContain(key);
    expect([...result.selectedSections,...result.absentOptionalSections].sort()).toEqual(['catalog','optionCenter','logicalPrinters','printTemplates','printRules','printTemplateCatalog','printTemplateProfile'].sort());
    expect(result.source.canonicalFingerprint).toBe(active.fingerprint);expect(result.source.adminFingerprint).toBe(active.adminFingerprint);
    for(const present of result.selectedSections)expect(result.sections[present]).toEqual(source[present]);
  });
  it('retains exact legacy option/default facts in catalog when every optional section is absent',async()=>{
    const catalog={products:[{id:'p1',basePrice:'18.50',modifierGroupIds:['g1'],unknownBusinessField:'kept'}],combos:[{id:'c1',basePrice:'28.00'}],modifierGroups:[{id:'g1',options:[{id:'o1',priceAdjustment:'0.00',defaultSelected:true,active:true}]}]};
    const active=envelope({catalog});serve(active);const result=await prepare();
    expect(result.sections).toEqual({catalog});expect(result.selectedSections).toEqual(['catalog']);
    expect(result.absentOptionalSections).toEqual(['optionCenter','logicalPrinters','printTemplates','printRules','printTemplateCatalog','printTemplateProfile']);
    expect(result.source.canonicalFingerprint).toBe(active.fingerprint);
  });
  it.each([
    ['optionCenter',{}],['logicalPrinters',[]],['printTemplates',{}],['printRules',{}],
    ['printTemplateCatalog',{schema:'mfp.print-template-catalog.v1',versions:[]}],
    ['printTemplateProfile',{schema:'mfp.print-template-profile.v1',bindings:[]}],
  ] as const)('distinguishes present-empty %s from absent',async(key,value)=>{
    serve(envelope({...snapshot(),[key]:value}));const present=await prepare();
    const absentSource=snapshot() as Record<string,unknown>;delete absentSource[key];serve(envelope(absentSource));const absent=await prepare();
    expect(present.sections[key]).toEqual(value);expect(present.selectedSections).toContain(key);expect(present.absentOptionalSections).not.toContain(key);
    expect(Object.hasOwn(present.inventory,key)).toBe(true);expect(Object.hasOwn(absent.sections,key)).toBe(false);expect(absent.absentOptionalSections).toContain(key);
    expect(present.selectedSectionsChecksum.value).not.toBe(absent.selectedSectionsChecksum.value);
    expect(present.source.canonicalFingerprint).not.toBe(absent.source.canonicalFingerprint);
  });
  it.each(['optionCenter','logicalPrinters','printTemplates','printRules','printTemplateCatalog','printTemplateProfile'])('still rejects present-null optional %s rather than treating it as absent',async key=>{
    serve(envelope({...snapshot(),[key]:null}));await expect(prepare()).rejects.toThrow('BUSINESS_EXTRACT_SECTION_INVALID:'+key);
  });
  it.each([null,42,'not-a-section'])('rejects malformed business section %s',async value=>{
    serve(envelope({...snapshot(),optionCenter:value}));await expect(prepare()).rejects.toThrow('SECTION_INVALID');
  });
  it.each(['password','passwordHash','PIN','pin_hash','accessToken','sessionToken','api_key','credentials','staffAuth','customerEmail','customers','transactionHistory','email','phoneNumber','customerFullName','customerEmailAddress','customerPhoneNumber','orderHistory','staffRecords','auth','contactName'])('blocks nested excluded field %s instead of redacting it',async key=>{
    serve(envelope({...snapshot(),catalog:{products:[{id:'p1',extension:{[key]:'sensitive-test-value'}}]}}));
    await expect(prepare()).rejects.toThrow('BUSINESS_EXTRACT_EXCLUDED_PATH:/catalog/products/0/extension/'+key);
  });
  it('blocks credential-bearing URLs within business data without displaying the secret',async()=>{
    serve(envelope({...snapshot(),catalog:{products:[{imageUrl:'https://user:secret@example.test/image'}]}}));
    await expect(prepare()).rejects.toThrow('BUSINESS_EXTRACT_EXCLUDED_PATH:/catalog/products/0/imageUrl');
  });
  it('retains ordinary Basic product names but blocks actual Basic credentials and generic URL tokens',async()=>{
    serve(envelope({...snapshot(),catalog:{products:[{id:'p1',name:'Basic Burger'}]}}));
    expect((await prepare()).sections.catalog).toEqual({products:[{id:'p1',name:'Basic Burger'}]});
    for(const value of ['Basic dXNlcjpwYXNzd29yZA==','https://example.test/image?token=private-token','https://example.test/image?%74oken=private-token','Bearer abc']){
      serve(envelope({...snapshot(),catalog:{products:[{id:'p1',imageUrl:value}]}}));
      await expect(prepare()).rejects.toThrow('BUSINESS_EXTRACT_EXCLUDED_PATH:/catalog/products/0/imageUrl');
    }
  });
  it.each([
    {catalog:{products:'broken'}}, {catalog:{products:[null]}}, {catalog:{combos:[]}},
    {optionCenter:{sets:42}}, {optionCenter:{sets:[null]}},
    {logicalPrinters:[null,42,'bad']}, {printRules:{p1:'broken'}},
    {printTemplateCatalog:{schema:'mfp.print-template-catalog.v1',versions:[null]}},
    {printTemplateProfile:{schema:'mfp.print-template-profile.v1',bindings:[42]}},
  ])('rejects malformed declared collections and rule records',async patch=>{
    serve(envelope({...snapshot(),...patch}));await expect(prepare()).rejects.toThrow('SECTION_INVALID');
  });
  it.each(['printTemplateCatalog','printTemplateProfile'])('rejects undeclared versioned schema in %s',async key=>{
    serve(envelope({...snapshot(),[key]:{schema:'invented.v99'}}));await expect(prepare()).rejects.toThrow('SECTION_SCHEMA_INVALID');
  });
  it('records the same configured request target used by the existing canonical read seam',async()=>{
    vi.stubEnv('VITE_MFK_ADMIN_API_BASE','https://canonical.example.test');
    vi.stubGlobal('location',{origin:'https://admin.example.test'});
    try{
      const fetcher=serve(envelope()),result=await prepare();
      expect(result.source.endpointPath).toBe('/api/admin-browser/active');
      expect(result.source.requestUrl).toBe('https://canonical.example.test/api/admin-browser/active?storeId=MF01');
      expect(fetcher.mock.calls[0][0]).toBe(result.source.requestUrl);
    }finally{vi.unstubAllEnvs();}
  });
  it('resolves relative API provenance using the same document base as browser fetch',async()=>{
    vi.stubEnv('VITE_MFK_ADMIN_API_BASE','backend');
    vi.stubGlobal('location',{origin:'https://admin.example.test',href:'https://admin.example.test/admin/publish/versions'});
    vi.stubGlobal('document',{baseURI:'https://admin.example.test/console/'});
    try{
      const fetcher=serve(envelope()),result=await prepare();
      expect(fetcher.mock.calls[0][0]).toBe('backend/api/admin-browser/active?storeId=MF01');
      expect(result.source.requestUrl).toBe('https://admin.example.test/console/backend/api/admin-browser/active?storeId=MF01');
    }finally{vi.unstubAllEnvs();}
  });
  it('does not invent absent optional print sections',async()=>{
    const source=snapshot();delete (source as any).printTemplateCatalog;delete (source as any).printTemplateProfile;serve(envelope(source));
    const result=await prepare();expect(Object.keys(result.sections)).toHaveLength(5);
    expect(result.absentOptionalSections).toEqual(['printTemplateCatalog','printTemplateProfile']);
  });
  it.each([
    ()=>({...envelope(),fingerprint:'fnv1a32:unverified'}),
    ()=>({...envelope(),adminFingerprint:''}),
    ()=>({...envelope(),publishedAt:'invalid'}),
    ()=>({...envelope(),revision:'27'}),
    ()=>({...envelope(),storeId:'another-store'}),
    ()=>({...envelope(),schema:'MFK_ADMIN_DRAFT_V1'}),
    ()=>({...envelope(),draftId:'mutable-draft'}),
    ()=>({...envelope(),previewMode:true}),
    ()=>envelope({...snapshot(),preview:true}),
  ])('rejects missing/invalid identity, preview or draft confusion',async make=>{
    serve(make());await expect(prepare()).rejects.toThrow();
  });
  it('does not read without authenticated store context',async()=>{
    const fetcher=serve(envelope());
    await expect(prepareV3BusinessConfigurationExtract({storeId:'MF01',sessionToken:''})).rejects.toThrow('SESSION_REQUIRED');
    await expect(prepareV3BusinessConfigurationExtract({storeId:'PREVIEW',sessionToken:'s'})).rejects.toThrow('PREVIEW');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('never echoes excluded values from provider or nested-field rejection errors',async()=>{
    serve({message:'request failed: '+JSON.stringify({staffAuth:{password:'private-provider-value'}})},500);
    await expect(prepare()).rejects.toThrow(/^BUSINESS_EXTRACT_CANONICAL_READ_FAILED$/);
    serve(envelope({...snapshot(),catalog:{products:[{id:'p1',password:'private-nested-value'}]}}));
    await expect(prepare()).rejects.toThrow(/^BUSINESS_EXTRACT_EXCLUDED_PATH:\/catalog\/products\/0\/password$/);
  });
  it('rejects failed fresh read instead of exporting stale cached input',async()=>{
    serve({code:'EXPIRED_SESSION'},401);await expect(prepare()).rejects.toThrow('BUSINESS_EXTRACT_CANONICAL_READ_FAILED');
  });
});
