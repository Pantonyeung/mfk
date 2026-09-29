import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveKeetaProductMapping,resolveKeetaOptionMapping} from '../src/mapping.js';

test('maps one Keeta alias to one canonical production product',()=>{
  const result=resolveKeetaProductMapping({
    skuOpenItemCode:'KEETA-1234',spuOpenItemCode:'SPU-1234',providerSkuId:'12',providerSpuId:'34',
  },[{
    mappingId:'map-a',skuOpenItemCode:'KEETA-1234',channelProductName:'人氣之選鹽酥雞便當',
    components:[{canonicalProductId:'A',quantity:1}],
  }]);
  assert.deepEqual(result.components,[{canonicalProductId:'A',quantity:1,role:'PRODUCTION'}]);
  assert.equal(result.channelProductName,'人氣之選鹽酥雞便當');
});

test('maps one Keeta package to multiple canonical production products',()=>{
  const result=resolveKeetaProductMapping({
    skuOpenItemCode:'KEETA-2P',spuOpenItemCode:'SPU-2P',providerSkuId:'56',providerSpuId:'78',
  },[{
    mappingId:'map-2p',spuOpenItemCode:'SPU-2P',channelProductName:'二人餐',
    components:[
      {canonicalProductId:'A',quantity:1},
      {canonicalProductId:'B',quantity:1},
      {canonicalProductId:'C',quantity:1},
      {canonicalProductId:'D',quantity:1},
    ],
  }]);
  assert.deepEqual(result.components.map(x=>x.canonicalProductId),['A','B','C','D']);
});

test('maps selected Keeta drink option onto canonical option identity',()=>{
  const result=resolveKeetaOptionMapping({
    canonicalProductId:'A',providerGroupCode:'DRINK',providerOptionCode:'MILK_TEA',
  },[{
    canonicalProductId:'A',providerGroupCode:'DRINK',providerOptionCode:'MILK_TEA',
    canonicalOptionSetId:'drink-set',canonicalOptionId:'milk-tea',
  }]);
  assert.equal(result.canonicalOptionSetId,'drink-set');
  assert.equal(result.canonicalOptionId,'milk-tea');
});

test('fails closed when provider alias has no mapping',()=>{
  assert.throws(()=>resolveKeetaProductMapping({
    skuOpenItemCode:'UNKNOWN',spuOpenItemCode:'UNKNOWN',providerSkuId:'1',providerSpuId:'2',
  },[]),/KEETA_PRODUCT_MAPPING_NOT_FOUND/);
});
