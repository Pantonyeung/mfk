import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {projectCanonicalCombos} from '../../contracts/admin-combo-projection-v1.ts';

describe('Admin Combo cross-port projection',()=>{
  it('projects Combo, Pool and drink child choices from one Admin snapshot',()=>{
    const projected=projectCanonicalCombos({
      snapshot:{
        catalog:{
          combos:[{
            id:'combo-a',name:'A 餐',basePrice:'41.00',active:true,
            mainPoolId:'main-a',addonPoolIds:['snack','drink'],
          }],
          comboPools:[
            {
              id:'main-a',name:'A 主餐',kind:'MAIN_COURSE',active:true,
              groups:[{
                id:'main-group',name:'主餐',required:true,min:1,max:1,
                bands:[{id:'main-band',name:'餐內',priceAdjustment:'0.00',active:true,position:10}],
                choices:[{
                  id:'main-choice',choiceType:'PRODUCT',productId:'rice-a',bandId:'main-band',
                  label:'',priceAdjustment:'0.00',active:true,position:10,
                }],
              }],
            },
            {
              id:'drink',name:'飲品',kind:'ADDON',addonKind:'DRINK',active:true,
              groups:[{
                id:'drink-group',name:'飲品',required:true,min:1,max:1,
                bands:[
                  {id:'none-band',name:'唔飲嘢',priceAdjustment:'-1.00',active:true,position:10},
                  {id:'milk-band',name:'奶茶',priceAdjustment:'8.00',active:true,position:20},
                ],
                choices:[
                  {id:'none',choiceType:'NONE',label:'唔飲嘢',bandId:'none-band',priceAdjustment:'0.00',active:true,position:10},
                  {id:'milk',choiceType:'PRODUCT',productId:'milk-tea',label:'',bandId:'milk-band',priceAdjustment:'0.00',active:true,position:20},
                ],
              }],
            },
          ],
        },
      },
    } as any);

    expect(projected.combos).toEqual([expect.objectContaining({
      id:'combo-a',basePriceMinor:4100,mainPoolId:'main-a',addonPoolIds:['snack','drink'],
    })]);
    const drink=projected.pools.find(pool=>pool.id==='drink');
    expect(drink?.addonKind).toBe('DRINK');
    expect(drink?.groups[0]?.subPools.map(pool=>pool.priceAdjustmentMinor)).toEqual([-100,800]);
    expect(drink?.groups[0]?.subPools.flatMap(pool=>pool.choices).map(choice=>choice.type)).toEqual(['NONE','PRODUCT']);
  });

  it('Customer snapshot publishes the same Combo and drink projection plus exact product binding',()=>{
    const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
    expect(worker).toContain("projectCanonicalCombos(active)");
    expect(worker).toContain("const customerCombos=comboData.combos.map");
    expect(worker).toContain("const customerComboPools=comboData.pools.map");
    expect(worker).toContain("combos:customerCombos");
    expect(worker).toContain("comboPools:customerComboPools");
    expect(worker).toContain("matches.length===1?matches[0].id:undefined");
    expect(worker).toContain("choice.type==='PRODUCT'&&choice.productId===productId");
    expect(worker).not.toContain("includes('套餐')");
  });
});
