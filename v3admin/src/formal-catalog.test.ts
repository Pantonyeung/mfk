import {describe,expect,it} from 'vitest';
import {
  createFormalCategory,
  moveFormalCategory,
  moveFormalProductWithinCategory,
  patchFormalCatalogProduct,
  patchFormalComboPrice,
  patchFormalModifierOptionPrice,
  readFormalCatalog,
  removeFormalCategory,
} from './formal-catalog.ts';

function snapshot(){
  return {
    untouched:{keep:true},
    catalog:{
      categories:[
        {id:'cat-a',name:'A',position:10,active:true,extra:'keep-a'},
        {id:'cat-b',name:'B',position:20,active:true},
      ],
      products:[
        {id:'p1',name:'P1',productCode:'P1',categoryId:'cat-a',basePrice:'10.00',active:true,legacySourcePosition:0,extra:'keep-p1'},
        {id:'p2',name:'P2',productCode:'P2',categoryId:'cat-b',basePrice:'20.00',active:true,legacySourcePosition:1},
        {id:'p3',name:'P3',productCode:'P3',categoryId:'cat-a',basePrice:'30.00',active:true,legacySourcePosition:2},
      ],
      modifierGroups:[{
        id:'g1',name:'Size',options:[
          {id:'o1',name:'Large',code:'L',priceAdjustment:'5.00',active:true,extra:'keep-o1'},
        ],
      }],
      combos:[{id:'c1',name:'Combo',basePrice:'50.00',active:true,extra:'keep-c1'}],
      unknownCatalogField:{keep:true},
    },
  } as Record<string,unknown>;
}

describe('formal catalog patches',()=>{
  it('patches product basics without dropping unknown snapshot fields',()=>{
    const next=patchFormalCatalogProduct(snapshot(),'p1',{name:'P1X',basePrice:'12.00'});
    expect((next.untouched as any).keep).toBe(true);
    const catalog=(next.catalog as any);
    expect(catalog.unknownCatalogField.keep).toBe(true);
    expect(catalog.products[0]).toMatchObject({name:'P1X',basePrice:'12.00',extra:'keep-p1'});
  });

  it('creates and reorders categories while preserving category payload',()=>{
    const created=createFormalCategory(snapshot(),{id:'cat-c',name:'C'});
    expect(readFormalCatalog(created).categories.map(item=>item.id)).toEqual(['cat-a','cat-b','cat-c']);
    const moved=moveFormalCategory(created,'cat-c',-1);
    expect(readFormalCatalog(moved).categories.sort((a,b)=>a.position-b.position).map(item=>item.id)).toEqual(['cat-a','cat-c','cat-b']);
    expect(((moved.catalog as any).categories.find((item:any)=>item.id==='cat-a')).extra).toBe('keep-a');
  });

  it('refuses to delete a category still referenced by products',()=>{
    expect(()=>removeFormalCategory(snapshot(),'cat-a')).toThrow('FORMAL_CATEGORY_IN_USE');
  });

  it('moves product order only among peers in the same category',()=>{
    const moved=moveFormalProductWithinCategory(snapshot(),'p3',-1);
    const ids=(moved.catalog as any).products.map((item:any)=>item.id);
    expect(ids).toEqual(['p3','p2','p1']);
    expect((moved.catalog as any).products[1].id).toBe('p2');
  });

  it('patches option and combo prices without replacing surrounding records',()=>{
    const optionNext=patchFormalModifierOptionPrice(snapshot(),'g1','o1','6.50');
    expect((optionNext.catalog as any).modifierGroups[0].options[0]).toMatchObject({priceAdjustment:'6.50',extra:'keep-o1'});
    const comboNext=patchFormalComboPrice(optionNext,'c1','55.00');
    expect((comboNext.catalog as any).combos[0]).toMatchObject({basePrice:'55.00',extra:'keep-c1'});
  });
});
