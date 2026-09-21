import {describe,expect,it} from 'vitest';
import {readAdminPublishedMenu} from './admin-menu-read.ts';

describe('admin published menu read-only',()=>{
  it('projects product identity, Admin category and media without pricing semantics',async()=>{
    const fetcher=(async()=>new Response(JSON.stringify({
      publishSequence:8,
      catalogVersion:'catalog-r8',
      products:[
        {productId:'p-1',name:'原味飯團',categoryId:'cat-riceball',categoryName:'飯團',imageRef:'media:products/p-1.webp',priceMinor:9999},
        {productId:'p-2',name:'新商品',categoryId:'cat-new',categoryName:'新品'},
      ],
      combos:[],
    }),{status:200,headers:{'content-type':'application/json'}})) as typeof fetch;

    await expect(readAdminPublishedMenu(fetcher)).resolves.toMatchObject({
      catalogVersion:'catalog-r8',
      products:[
        {id:'p-1',name:'原味飯團',category:'飯團',imageRef:'media:products/p-1.webp'},
        {id:'p-2',name:'新商品',category:'新品'},
      ],
    });
  });

  it('fails closed if the canonical catalog identity is missing',async()=>{
    const fetcher=(async()=>new Response(JSON.stringify({products:[{productId:'p-1',name:'原味飯團'}]}),{status:200})) as typeof fetch;
    await expect(readAdminPublishedMenu(fetcher)).rejects.toThrow('ADMIN_MENU_PROJECTION_INVALID');
  });
});
