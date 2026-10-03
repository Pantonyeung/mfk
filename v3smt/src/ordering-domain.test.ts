import {describe,expect,it} from 'vitest';

import {
  createMfpOrderingDomain,
  createMfpOrderingSurfaceDomains,
  type MfpOrderingCatalog,
  type MfpOrderingCombo,
  type MfpOrderingComboPool,
  type MfpOrderingProduct,
} from './ordering-domain.ts';

const fact=(factId:string,amountMinor:number)=>Object.freeze({
  factId,amountMinor,currency:'HKD',revision:'MENU-7',
});

const catalog:MfpOrderingCatalog=Object.freeze({
  source:Object.freeze({
    storeId:'MF01',port:'SMT',schemaVersion:1,appliedSeq:7,
    projectionHash:'projection-7',appliedAt:'2026-10-02T06:00:00.000Z',
  }),
  categories:Object.freeze([{id:'rice',label:'飯糰',position:10}]),
  products:Object.freeze([{
    productId:'P1',categoryId:'rice',name:'招牌飯糰',description:'即叫即製',imageUrl:'https://img.example/p1.webp',
    sellable:true,priceReady:true,publishedUnitPrice:fact('P1:BASE',3800),
    serviceModeAdjustments:Object.freeze({takeaway:fact('P1:TAKEAWAY',100)}),
    optionSets:Object.freeze([{
      id:'sauce',name:'醬汁',required:true,selection:'SINGLE' as const,min:1,max:1,
      options:Object.freeze([
        {id:'normal',name:'正常',defaultSelected:true,sellable:true,position:10,priceAdjustment:fact('O:NORMAL',0)},
        {id:'less',name:'少醬',defaultSelected:false,sellable:true,position:20,priceAdjustment:fact('O:LESS',-100)},
      ]),
    }]),
  }]),
  combos:Object.freeze([]),
  comboPools:Object.freeze([]),
});

describe('MFP V3 A4 shared ordering domain',()=>{
  it('normalizes the same Pad and Mobile selections into the same cart intent',()=>{
    const shared=createMfpOrderingDomain(catalog);
    const surfaces=createMfpOrderingSurfaceDomains(shared);
    const selection={
      cartLineId:'LINE-1',productId:'P1',quantity:2,
      optionSelections:{sauce:['less']},
    } as const;

    const padDraft=surfaces.MFP_PAD.addProduct(surfaces.MFP_PAD.createDraft('takeaway'),selection);
    const mobileDraft=surfaces.MFP_MOBILE.addProduct(surfaces.MFP_MOBILE.createDraft('takeaway'),selection);

    expect(surfaces.MFP_PAD).toBe(shared);
    expect(surfaces.MFP_MOBILE).toBe(shared);
    expect(shared.normalize(padDraft)).toEqual(shared.normalize(mobileDraft));
  });

  it('blocks unsellable and price-not-ready products',()=>{
    const base=catalog.products[0]!;
    for(const product of [
      {...base,sellable:false},
      {...base,priceReady:false,publishedUnitPrice:null},
    ] satisfies MfpOrderingProduct[]){
      const domain=createMfpOrderingDomain({...catalog,products:[product]});
      expect(()=>domain.addProduct(domain.createDraft('dine-in'),{
        cartLineId:'L',productId:'P1',quantity:1,optionSelections:{sauce:['normal']},
      })).toThrow(product.sellable?'MFP_ORDERING_PRICE_NOT_READY':'MFP_ORDERING_PRODUCT_UNSELLABLE');
    }
  });

  it('blocks unavailable options without silently replacing the selection',()=>{
    const base=catalog.products[0]!;
    const product={...base,optionSets:[{
      ...base.optionSets[0]!,options:base.optionSets[0]!.options.map(option=>option.id==='less'?{...option,sellable:false}:option),
    }]};
    const domain=createMfpOrderingDomain({...catalog,products:[product]});
    expect(()=>domain.addProduct(domain.createDraft('dine-in'),{
      cartLineId:'L',productId:'P1',quantity:1,optionSelections:{sauce:['less']},
    })).toThrow('MFP_ORDERING_OPTION_UNAVAILABLE');
  });

  it('enforces required, single and min/max option selection',()=>{
    const domain=createMfpOrderingDomain(catalog);
    expect(()=>domain.addProduct(domain.createDraft('dine-in'),{
      cartLineId:'L1',productId:'P1',quantity:1,optionSelections:{sauce:[]},
    })).toThrow('MFP_ORDERING_REQUIRED_SELECTION_UNRESOLVED');
    expect(()=>domain.addProduct(domain.createDraft('dine-in'),{
      cartLineId:'L2',productId:'P1',quantity:1,optionSelections:{sauce:['normal','less']},
    })).toThrow('MFP_ORDERING_OPTION_SINGLE_REQUIRED');
    const incomplete=domain.addProduct(domain.createDraft('dine-in'),{
      cartLineId:'L3',productId:'P1',quantity:1,optionSelections:{sauce:[]},
    },{allowIncomplete:true});
    expect(incomplete.lines[0]).toMatchObject({state:'INCOMPLETE',issues:['MFP_ORDERING_REQUIRED_SELECTION_UNRESOLVED']});
    expect(domain.normalize(incomplete).checkoutReady).toBe(false);
    const base=catalog.products[0]!;
    const multi:MfpOrderingProduct={...base,optionSets:[{
      id:'extras',name:'加配',required:false,selection:'MULTI',min:2,max:2,
      options:['A','B','C'].map((id,index)=>({
        id,name:id,defaultSelected:false,sellable:true,position:index,
        priceAdjustment:fact(`O:${id}`,0),
      })),
    }]};
    const multiDomain=createMfpOrderingDomain({...catalog,products:[multi]});
    expect(()=>multiDomain.addProduct(multiDomain.createDraft('dine-in'),{
      cartLineId:'MIN',productId:'P1',quantity:1,optionSelections:{extras:['A']},
    })).toThrow('MFP_ORDERING_REQUIRED_SELECTION_UNRESOLVED');
    expect(()=>multiDomain.addProduct(multiDomain.createDraft('dine-in'),{
      cartLineId:'MAX',productId:'P1',quantity:1,optionSelections:{extras:['A','B','C']},
    })).toThrow('MFP_ORDERING_OPTION_MAX_EXCEEDED');
  });

  it('previews positive and negative published adjustments without becoming Pricing Authority',()=>{
    const base=catalog.products[0]!;
    const product:MfpOrderingProduct={...base,optionSets:[{
      id:'extras',name:'加配',required:false,selection:'MULTI',min:0,max:2,
      options:[
        {id:'plus',name:'加餸',defaultSelected:false,sellable:true,position:10,priceAdjustment:fact('O:PLUS',200)},
        {id:'minus',name:'減飯',defaultSelected:false,sellable:true,position:20,priceAdjustment:fact('O:MINUS',-100)},
      ],
    }]};
    const domain=createMfpOrderingDomain({...catalog,products:[product]});
    const draft=domain.addProduct(domain.createDraft('dine-in'),{
      cartLineId:'L',productId:'P1',quantity:2,optionSelections:{extras:['plus','minus']},
    });
    expect(draft.lines[0]?.previewUnitMinor).toBe(3900);
    expect(domain.normalize(draft)).toMatchObject({
      pricing:'LOCAL_PREVIEW_FROM_PUBLISHED_FACTS',previewSubtotalMinor:7800,
    });
  });

  it('uses the same published service-mode facts on both surfaces',()=>{
    const shared=createMfpOrderingDomain(catalog);
    const surfaces=createMfpOrderingSurfaceDomains(shared);
    const add=(mode:'takeaway'|'dine-in')=>shared.normalize(shared.addProduct(shared.createDraft(mode),{
      cartLineId:'L',productId:'P1',quantity:1,optionSelections:{sauce:['normal']},
    }));
    expect(surfaces.MFP_PAD).toBe(surfaces.MFP_MOBILE);
    expect(add('takeaway').previewSubtotalMinor).toBe(3900);
    expect(add('dine-in').previewSubtotalMinor).toBe(3800);
  });

  it('enforces combo requirements and preserves pool/group/sub-pool/choice/product identities',()=>{
    const combo:MfpOrderingCombo={
      id:'C1',name:'一人餐',sellable:true,priceReady:true,publishedBasePrice:fact('C1:BASE',5000),
      serviceModeAdjustments:{},mainPoolId:'POOL-MAIN',addonPoolIds:[],
    };
    const pool:MfpOrderingComboPool={
      id:'POOL-MAIN',name:'主餐',kind:'MAIN_COURSE',groups:[{
        id:'GROUP-MAIN',name:'揀主餐',required:true,min:1,max:1,position:10,subPools:[{
          id:'BAND-1',name:'標準',sellable:true,position:10,priceAdjustment:fact('BAND-1',0),choices:[{
            id:'CHOICE-P1',type:'PRODUCT',productId:'P1',label:'招牌飯糰',sellable:true,position:10,
            priceAdjustment:fact('CHOICE-P1',200),
          }],
        }],
      }],
    };
    const domain=createMfpOrderingDomain({...catalog,combos:[combo],comboPools:[pool]});
    expect(()=>domain.addCombo(domain.createDraft('dine-in'),{cartLineId:'C',comboId:'C1',quantity:1}))
      .toThrow('MFP_ORDERING_COMBO_REQUIRED_SELECTION_UNRESOLVED');
    const draft=domain.addCombo(domain.createDraft('dine-in'),{
      cartLineId:'C',comboId:'C1',quantity:1,
      comboSelections:{'GROUP-MAIN':[{subPoolId:'BAND-1',choiceId:'CHOICE-P1'}]},
    });
    expect(draft.lines[0]?.comboSelections).toEqual([{
      poolId:'POOL-MAIN',groupId:'GROUP-MAIN',subPoolId:'BAND-1',choiceId:'CHOICE-P1',
      choiceType:'PRODUCT',productId:'P1',
    }]);
    expect(draft.lines[0]?.previewUnitMinor).toBe(5200);
  });

  it('quick defaults cannot hide unresolved required input',()=>{
    const base=catalog.products[0]!;
    const product={...base,optionSets:[{
      ...base.optionSets[0]!,options:base.optionSets[0]!.options.map(option=>({...option,defaultSelected:false})),
    }]};
    const domain=createMfpOrderingDomain({...catalog,products:[product]});
    const defaults=domain.defaultProductSelection('P1');
    expect(defaults).toEqual({sauce:[]});
    expect(()=>domain.addProduct(domain.createDraft('dine-in'),{
      cartLineId:'L',productId:'P1',quantity:1,optionSelections:defaults,
    })).toThrow('MFP_ORDERING_REQUIRED_SELECTION_UNRESOLVED');
  });

  it('changes quantity, edits and removes cart draft lines deterministically',()=>{
    const domain=createMfpOrderingDomain(catalog);
    const added=domain.addProduct(domain.createDraft('dine-in'),{
      cartLineId:'L',productId:'P1',quantity:1,optionSelections:{sauce:['normal']},
    });
    const quantity=domain.setQuantity(added,'L',3);
    const edited=domain.editProduct(quantity,{
      cartLineId:'L',productId:'P1',quantity:3,optionSelections:{sauce:['less']},
    });
    expect(edited.lines).toHaveLength(1);
    expect(edited.lines[0]).toMatchObject({cartLineId:'L',quantity:3,previewUnitMinor:3700});
    expect(domain.removeLine(edited,'L').lines).toEqual([]);
  });

  it('keeps the cart draft-only with no formal order, payment, fulfillment or print state',()=>{
    const domain=createMfpOrderingDomain(catalog);
    const intent=domain.normalize(domain.addProduct(domain.createDraft('dine-in'),{
      cartLineId:'L',productId:'P1',quantity:1,optionSelections:{sauce:['normal']},
    }));
    const serialized=JSON.stringify(intent);
    expect(intent).toMatchObject({schema:'mfp.ordering.intent.draft.v1',draftOnly:true,checkoutReady:true});
    expect(serialized).not.toMatch(/orderId|displayNumber|payment|fulfillment|print|COMMITTED/);
  });

  it('marks only materially affected lines for revalidation after a projection update',()=>{
    const domain=createMfpOrderingDomain(catalog);
    const draft=domain.addProduct(domain.createDraft('dine-in'),{
      cartLineId:'L',productId:'P1',quantity:1,optionSelections:{sauce:['normal']},
    });
    const base=catalog.products[0]!;
    const changed:MfpOrderingCatalog={
      ...catalog,
      source:{...catalog.source,appliedSeq:8,projectionHash:'projection-8'},
      products:[{...base,publishedUnitPrice:fact('P1:BASE',3900)}],
    };
    expect(domain.reconcile(draft,changed).lines[0]).toMatchObject({
      state:'REVALIDATION_REQUIRED',issues:['MFP_ORDERING_PROJECTION_CHANGED'],previewUnitMinor:3800,
    });
    const unsellable={...changed,products:[{...base,sellable:false}]};
    const stale=createMfpOrderingDomain(unsellable).reconcile(draft,unsellable);
    expect(()=>createMfpOrderingDomain(unsellable).setServiceMode(stale,'takeaway')).not.toThrow();
    expect(createMfpOrderingDomain(unsellable).setServiceMode(stale,'takeaway').lines[0])
      .toMatchObject({state:'REVALIDATION_REQUIRED',serviceMode:'takeaway',previewUnitMinor:3800});
    const unrelated={...changed,products:catalog.products};
    expect(domain.reconcile(draft,unrelated).lines[0]).toMatchObject({state:'READY',sourceProjection:{appliedSeq:8}});
  });
});
