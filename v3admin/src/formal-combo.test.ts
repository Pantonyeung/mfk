import {describe,expect,it} from 'vitest';
import {
  addFormalCombo,
  addFormalComboPool,
  readFormalCombos,
  removeFormalComboPool,
  replaceFormalCombo,
  replaceFormalComboPool,
  validateFormalComboData,
} from './formal-combo.ts';

function snapshot(){
  return {
    untouched:{keep:true},
    catalog:{
      products:[
        {id:'p1',name:'P1',active:true},
        {id:'p2',name:'P2',active:true},
      ],
      combos:[
        {id:'c1',name:'Combo 1',active:true,basePrice:'50.00',takeawayAdjustment:'0.00',takeawaySurchargeEnabled:false,mainPoolId:'pool-main',addonPoolIds:['pool-drink'],extra:'keep-combo'},
      ],
      comboPools:[
        {
          id:'pool-main',name:'Main',kind:'MAIN_COURSE',active:true,position:10,extra:'keep-pool',
          groups:[{
            id:'g1',name:'Main group',required:true,min:1,max:1,position:10,
            bands:[{id:'b1',name:'Normal',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:10,extra:'keep-band'}],
            choices:[{id:'ch1',choiceType:'PRODUCT',productId:'p1',label:'',bandId:'b1',priceAdjustment:'0.00',priceStatus:'READY',active:true,position:10,extra:'keep-choice'}],
            extra:'keep-group',
          }],
        },
        {id:'pool-drink',name:'Drink',kind:'ADDON',addonKind:'DRINK',active:true,position:20,groups:[]},
      ],
      extraCatalog:{keep:true},
    },
  } as Record<string,unknown>;
}

describe('formal combo adapter',()=>{
  it('reads combo and reusable pool structure',()=>{
    const data=readFormalCombos(snapshot());
    expect(data.combos[0]).toMatchObject({id:'c1',mainPoolId:'pool-main',addonPoolIds:['pool-drink']});
    expect(data.pools[0].groups[0].choices[0]).toMatchObject({id:'ch1',productId:'p1',bandId:'b1'});
  });

  it('patches combo while retaining unknown fields',()=>{
    const data=readFormalCombos(snapshot());
    const next=replaceFormalCombo(snapshot(),{...data.combos[0],name:'Combo X',basePrice:'55.00'}) as any;
    expect(next.untouched.keep).toBe(true);
    expect(next.catalog.extraCatalog.keep).toBe(true);
    expect(next.catalog.combos[0]).toMatchObject({name:'Combo X',basePrice:'55.00',extra:'keep-combo'});
  });

  it('patches nested pool while retaining unknown nested fields',()=>{
    const data=readFormalCombos(snapshot());
    const pool=data.pools[0];
    const nextPool={
      ...pool,
      name:'Main X',
      groups:pool.groups.map(group=>({
        ...group,
        name:'Main Group X',
        bands:group.bands.map(band=>({...band,name:'Band X'})),
        choices:group.choices.map(choice=>({...choice,priceAdjustment:'2.00'})),
      })),
    };
    const next=replaceFormalComboPool(snapshot(),nextPool) as any;
    expect(next.catalog.comboPools[0]).toMatchObject({name:'Main X',extra:'keep-pool'});
    expect(next.catalog.comboPools[0].groups[0]).toMatchObject({name:'Main Group X',extra:'keep-group'});
    expect(next.catalog.comboPools[0].groups[0].bands[0]).toMatchObject({name:'Band X',extra:'keep-band'});
    expect(next.catalog.comboPools[0].groups[0].choices[0]).toMatchObject({priceAdjustment:'2.00',extra:'keep-choice'});
  });

  it('guards pool deletion while referenced by a combo',()=>{
    expect(()=>removeFormalComboPool(snapshot(),'pool-main')).toThrow('FORMAL_COMBO_POOL_IN_USE');
  });

  it('adds combo and pool and keeps data publish-valid',()=>{
    const withPool=addFormalComboPool(snapshot(),'pool-snack','ADDON','SNACK');
    const withCombo=addFormalCombo(withPool,'c2');
    const data=readFormalCombos(withCombo);
    expect(data.pools.some(pool=>pool.id==='pool-snack')).toBe(true);
    expect(data.combos.some(combo=>combo.id==='c2')).toBe(true);
    expect(validateFormalComboData(snapshot())).toEqual([]);
  });
});
