import {describe,expect,it} from 'vitest';
import {
  addFormalOptionSet,
  readFormalOptionCenter,
  removeFormalOptionSet,
  replaceFormalOptionSet,
  writeFormalOptionCenter,
  type FormalOptionCenterState,
} from './formal-option-center.ts';

function snapshot(){
  return {
    untouched:{keep:true},
    catalog:{
      products:[
        {id:'p1',name:'P1',modifierGroupIds:['set-a'],extra:'keep-p1'},
        {id:'p2',name:'P2',modifierGroupIds:[]},
      ],
      modifierGroups:[{
        id:'set-a',name:'Size',required:false,forceShow:false,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,
        options:[{id:'o1',code:'S',name:'Small',priceAdjustment:'0.00',active:true,defaultSelected:false,extra:'keep-o1'}],
        extra:'keep-set',
      }],
      extraCatalog:{keep:true},
    },
    optionCenter:{
      sets:[{
        id:'set-a',name:'Size',required:false,forceShow:false,selection:'SINGLE',min:0,max:1,allowQuantities:false,active:true,
        options:[{id:'o1',code:'S',name:'Small',priceAdjustment:'0.00',active:true,position:10}],
      }],
      productLinks:[{productId:'p1',setId:'set-a',defaultOptionIds:[]}],
      extraCenter:{keep:true},
    },
  } as Record<string,unknown>;
}

describe('formal option center adapter',()=>{
  it('derives legacy defaults from explicit source selections without changing source IDs',()=>{
    const source=snapshot() as any;
    delete source.optionCenter;
    source.catalog.modifierGroups[0].options[0].defaultSelected=true;
    const before=structuredClone(source);
    expect(readFormalOptionCenter(source).productLinks).toEqual([
      {productId:'p1',setId:'set-a',defaultOptionIds:['o1']},
    ]);
    expect(source).toEqual(before);
  });

  it('retains explicit per-product defaults when canonical optionCenter already exists',()=>{
    const source=snapshot() as any;
    source.catalog.modifierGroups[0].options[0].defaultSelected=true;
    expect(readFormalOptionCenter(source).productLinks[0].defaultOptionIds).toEqual([]);
  });

  it('reads current optionCenter state',()=>{
    const state=readFormalOptionCenter(snapshot());
    expect(state.sets[0]).toMatchObject({id:'set-a',name:'Size'});
    expect(state.productLinks).toEqual([{productId:'p1',setId:'set-a',defaultOptionIds:[]}]);
  });

  it('writes optionCenter and mirrors legacy catalog without dropping unknown fields',()=>{
    const state=readFormalOptionCenter(snapshot());
    const nextState:FormalOptionCenterState={
      sets:[{...state.sets[0],name:'Portion',options:[{...state.sets[0].options[0],name:'Normal'}]}],
      productLinks:[{productId:'p2',setId:'set-a',defaultOptionIds:[]}],
    };
    const next=writeFormalOptionCenter(snapshot(),nextState) as any;
    expect(next.untouched.keep).toBe(true);
    expect(next.optionCenter.extraCenter.keep).toBe(true);
    expect(next.catalog.extraCatalog.keep).toBe(true);
    expect(next.catalog.modifierGroups[0]).toMatchObject({name:'Portion',extra:'keep-set'});
    expect(next.catalog.modifierGroups[0].options[0]).toMatchObject({name:'Normal',extra:'keep-o1'});
    expect(next.catalog.products[0]).toMatchObject({id:'p1',modifierGroupIds:[],extra:'keep-p1'});
    expect(next.catalog.products[1]).toMatchObject({id:'p2',modifierGroupIds:['set-a']});
  });

  it('adds, replaces and guards removal of option sets',()=>{
    const added=addFormalOptionSet(snapshot(),'set-new');
    expect(readFormalOptionCenter(added).sets.some(set=>set.id==='set-new')).toBe(true);
    const center=readFormalOptionCenter(snapshot());
    expect(()=>removeFormalOptionSet(snapshot(),'set-a')).toThrow('FORMAL_OPTION_SET_IN_USE');
    const replaced=replaceFormalOptionSet(snapshot(),{...center.sets[0],name:'New name'},['p1','p2']);
    expect(readFormalOptionCenter(replaced).sets[0].name).toBe('New name');
    expect(readFormalOptionCenter(replaced).productLinks.filter(link=>link.setId==='set-a').map(link=>link.productId).sort()).toEqual(['p1','p2']);
  });
});
