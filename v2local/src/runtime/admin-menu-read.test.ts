import {describe,expect,it} from 'vitest';
import {normalizeAdminMenuEnvelope,readAdminPublishedMenu} from './admin-menu-read.ts';

const envelope={
  ok:true,
  value:{
    storeId:'store-1',
    catalogRevision:'cat-12',
    categories:[
      {categoryId:'c1',name:'飯團',position:1,revision:2},
      {categoryId:'c2',name:'飲品',position:2,revision:1},
    ],
    products:[
      {productId:'p1',name:'原味飯團',revision:3,categoryMemberships:[{categoryId:'c1',position:1}]},
      {productId:'p2',name:'台式奶茶',revision:4,categoryMemberships:[{categoryId:'c2',position:1}]},
    ],
  },
};

describe('admin menu readback',()=>{
  it('accepts menu-only canonical readback',()=>{
    const value=normalizeAdminMenuEnvelope(envelope);
    expect(value.storeId).toBe('store-1');
    expect(value.catalogRevision).toBe('cat-12');
    expect(value.categories.map(item=>item.name)).toEqual(['飯團','飲品']);
    expect(value.products.map(item=>item.name)).toEqual(['原味飯團','台式奶茶']);
  });

  it('rejects unknown category membership',()=>{
    expect(()=>normalizeAdminMenuEnvelope({
      ...envelope,
      value:{
        ...envelope.value,
        products:[
          {productId:'p1',name:'X',revision:1,categoryMemberships:[{categoryId:'missing',position:0}]},
        ],
      },
    })).toThrow('ADMIN_MENU_PRODUCT_CATEGORY_UNKNOWN_missing');
  });

  it('fetches the dedicated menu readback endpoint shape',async()=>{
    const fetcher=(async()=>new Response(JSON.stringify(envelope),{status:200,headers:{'content-type':'application/json'}})) as typeof fetch;
    await expect(readAdminPublishedMenu(fetcher,'https://example.test/api/smt/menu-readback')).resolves.toMatchObject({
      storeId:'store-1',
      catalogRevision:'cat-12',
    });
  });
});
