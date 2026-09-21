import {createMfkAdminMenuIndexRevision,type MfkAdminMenuIndexRevision} from '../../contracts/admin-menu-index-v1.ts';
import {validateAdminDraft,type AdminSessionDraft} from './admin-draft.tsx';

export function buildAdminMenuIndexRevisionFromDraft(
  draft:AdminSessionDraft,
  baseRevision:number,
  publishedAt=new Date().toISOString(),
):MfkAdminMenuIndexRevision{
  const errors=validateAdminDraft(draft);
  if(errors.length)throw new Error('ADMIN_MENU_INDEX_DRAFT_INVALID:'+errors.join('|'));

  const activeCategories=[...draft.categories]
    .filter(row=>row.active)
    .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  if(activeCategories.length===0)throw new Error('ADMIN_MENU_INDEX_ACTIVE_CATEGORY_REQUIRED');
  const activeIds=new Set(activeCategories.map(row=>row.id));

  const activeProducts=[...draft.products]
    .filter(row=>row.active&&activeIds.has(row.categoryId))
    .sort((a,b)=>{
      const ac=activeCategories.find(category=>category.id===a.categoryId)?.position??9999;
      const bc=activeCategories.find(category=>category.id===b.categoryId)?.position??9999;
      return ac-bc||a.id.localeCompare(b.id);
    });
  if(activeProducts.length===0)throw new Error('ADMIN_MENU_INDEX_ACTIVE_PRODUCT_REQUIRED');

  return createMfkAdminMenuIndexRevision({
    baseRevision,
    publishedAt,
    categories:activeCategories.map(row=>({id:row.id,label:row.name,position:row.position})),
    products:activeProducts.map((row,index)=>({
      id:row.id,
      label:row.name,
      categoryId:row.categoryId,
      position:(index+1)*10,
      enabled:true,
    })),
  });
}
