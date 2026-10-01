import {describe,expect,it} from 'vitest';
import {
  patchFormalKeetaPolicy,
  readFormalKeetaMappings,
  readFormalKeetaPolicy,
  removeFormalKeetaMapping,
  upsertFormalKeetaMapping,
  validateFormalKeetaMappings,
} from './formal-channel.ts';

function snapshot(){
  return {
    untouched:{keep:true},
    channelPolicy:{enabled:true,autoAccept:false,syncSellability:true,commissionPct:'25',displayName:'Keeta',lateCutoffMinutes:15,extra:'keep-policy'},
    channelMapping:[{
      mappingId:'keeta:sku-1',enabled:true,skuOpenItemCode:'sku-1',channelName:'Keeta Product',
      components:[{canonicalProductId:'p1',quantity:1}],optionMappings:[],extra:'keep-map',
    }],
    catalog:{
      products:[{id:'p1',name:'P1'},{id:'p2',name:'P2'}],
      channelMappings:{keeta:[{
        mappingId:'keeta:sku-1',enabled:true,skuOpenItemCode:'sku-1',channelName:'Keeta Product',
        components:[{canonicalProductId:'p1',quantity:1}],optionMappings:[],
      }],other:{keep:true}},
      extraCatalog:{keep:true},
    },
  } as Record<string,unknown>;
}

describe('formal Keeta config adapter',()=>{
  it('patches channel policy without dropping unknown fields',()=>{
    const next=patchFormalKeetaPolicy(snapshot(),{autoAccept:true,lateCutoffMinutes:12}) as any;
    expect(readFormalKeetaPolicy(next)).toMatchObject({autoAccept:true,lateCutoffMinutes:12});
    expect(next.channelPolicy.extra).toBe('keep-policy');
    expect(next.untouched.keep).toBe(true);
  });

  it('reads canonical mappings and validates production components',()=>{
    const mappings=readFormalKeetaMappings(snapshot());
    expect(mappings[0]).toMatchObject({mappingId:'keeta:sku-1',skuOpenItemCode:'sku-1',components:[{canonicalProductId:'p1',quantity:1}]});
    expect(validateFormalKeetaMappings(snapshot(),mappings)).toEqual([]);
  });

  it('upserts mapping into top-level and catalog compatibility shapes while preserving unknown fields',()=>{
    const current=readFormalKeetaMappings(snapshot())[0];
    const next=upsertFormalKeetaMapping(snapshot(),{...current,channelName:'Updated',components:[{canonicalProductId:'p2',quantity:2}]}) as any;
    expect(next.channelMapping[0]).toMatchObject({channelName:'Updated',extra:'keep-map'});
    expect(next.catalog.channelMappings.keeta[0]).toMatchObject({channelName:'Updated',components:[{canonicalProductId:'p2',quantity:2}]});
    expect(next.catalog.channelMappings.other.keep).toBe(true);
    expect(next.catalog.extraCatalog.keep).toBe(true);
  });

  it('removes mapping from both compatibility shapes',()=>{
    const next=removeFormalKeetaMapping(snapshot(),'keeta:sku-1') as any;
    expect(next.channelMapping).toEqual([]);
    expect(next.catalog.channelMappings.keeta).toEqual([]);
  });

  it('rejects missing provider alias or unknown product reference',()=>{
    const bad=[{mappingId:'m1',enabled:true,channelName:'Bad',components:[{canonicalProductId:'missing',quantity:1}],optionMappings:[]}];
    const errors=validateFormalKeetaMappings(snapshot(),bad as any);
    expect(errors.some(error=>error.includes('Provider Alias'))).toBe(true);
    expect(errors.some(error=>error.includes('不存在商品'))).toBe(true);
  });
});
