import {useEffect,useMemo,useState} from 'react';
import {
  readLocalAdminMenu,
  resetLocalAdminMenu,
  saveLocalAdminMenu,
  subscribeLocalAdminMenu,
  type LocalAdminMenuCategory,
  type LocalAdminMenuProduct,
} from '../runtime/local-admin-menu.ts';
import './local-admin-menu-workspace.css';

type Draft={
  categories:LocalAdminMenuCategory[];
  products:LocalAdminMenuProduct[];
};

function copyDraft():Draft{
  const menu=readLocalAdminMenu();
  return {
    categories:menu.categories.map(row=>({...row})),
    products:menu.products.map(row=>({...row})),
  };
}
function normalizePositions<T extends {position:number}>(rows:T[]):T[]{
  return rows.map((row,index)=>({...row,position:(index+1)*10}));
}

export function LocalAdminMenuWorkspace(){
  const [snapshotRevision,setSnapshotRevision]=useState(()=>readLocalAdminMenu().revision);
  const [draft,setDraft]=useState<Draft>(copyDraft);
  const [baseRevision,setBaseRevision]=useState(snapshotRevision);
  const [message,setMessage]=useState('第一批只管理 Menu 結構；Pricing／Modifier／Combo 未接。');
  const [dirty,setDirty]=useState(false);

  useEffect(()=>subscribeLocalAdminMenu(()=>{
    const menu=readLocalAdminMenu();
    setSnapshotRevision(menu.revision);
    if(!dirty){
      setDraft(copyDraft());
      setBaseRevision(menu.revision);
    }
  }),[dirty]);

  const orderedCategories=useMemo(
    ()=>[...draft.categories].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)),
    [draft.categories],
  );
  const orderedProducts=useMemo(
    ()=>[...draft.products].sort((a,b)=>a.categoryId.localeCompare(b.categoryId)||a.position-b.position||a.id.localeCompare(b.id)),
    [draft.products],
  );

  const patchCategory=(id:string,patch:Partial<LocalAdminMenuCategory>)=>{
    setDraft(current=>({...current,categories:current.categories.map(row=>row.id===id?{...row,...patch}:row)}));
    setDirty(true);
  };
  const moveCategory=(id:string,delta:-1|1)=>{
    setDraft(current=>{
      const rows=[...current.categories].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
      const index=rows.findIndex(row=>row.id===id);
      const target=index+delta;
      if(index<0||target<0||target>=rows.length)return current;
      [rows[index],rows[target]]=[rows[target]!,rows[index]!];
      return {...current,categories:normalizePositions(rows)};
    });
    setDirty(true);
  };
  const addCategory=()=>{
    const used=new Set(draft.categories.map(row=>row.id));
    let suffix=1;
    while(used.has('cat-new-'+suffix))suffix+=1;
    setDraft(current=>({
      ...current,
      categories:[...current.categories,{id:'cat-new-'+suffix,name:'新分類',position:(current.categories.length+1)*10}],
    }));
    setDirty(true);
  };
  const removeCategory=(id:string)=>{
    if(draft.products.some(row=>row.categoryId===id)){
      setMessage('呢個分類仲有商品，先將商品移去其他分類。');
      return;
    }
    setDraft(current=>({...current,categories:current.categories.filter(row=>row.id!==id)}));
    setDirty(true);
  };
  const patchProduct=(id:string,patch:Partial<LocalAdminMenuProduct>)=>{
    setDraft(current=>({...current,products:current.products.map(row=>row.id===id?{...row,...patch}:row)}));
    setDirty(true);
  };

  const save=()=>{
    try{
      const saved=saveLocalAdminMenu(draft,baseRevision);
      setBaseRevision(saved.revision);
      setSnapshotRevision(saved.revision);
      setDraft(copyDraft());
      setDirty(false);
      setMessage('Menu R'+saved.revision+' 已保存。本機 POS 即時使用新 Menu。');
    }catch(error){
      const code=error instanceof Error?error.message:'ADMIN_MENU_SAVE_FAILED';
      setMessage(code==='ADMIN_MENU_REVISION_CONFLICT'?'版本已變更，請重新載入再修改。':code);
    }
  };
  const reload=()=>{
    const menu=readLocalAdminMenu();
    setDraft(copyDraft());
    setBaseRevision(menu.revision);
    setSnapshotRevision(menu.revision);
    setDirty(false);
    setMessage('已重新載入 Menu R'+menu.revision+'。');
  };
  const reset=()=>{
    try{
      const next=resetLocalAdminMenu(baseRevision);
      setDraft(copyDraft());
      setBaseRevision(next.revision);
      setSnapshotRevision(next.revision);
      setDirty(false);
      setMessage('已建立新版本並恢復初始 Menu：R'+next.revision+'。');
    }catch(error){
      setMessage(error instanceof Error?error.message:'ADMIN_MENU_RESET_FAILED');
    }
  };

  return <section className="local-admin-menu">
    <header className="local-admin-menu-head">
      <div><small>MFK LOCAL ADMIN · MENU AUTHORITY</small><h2>Menu 管理</h2><p>呢一批只負責分類、商品名稱、排序同啟用狀態。資料完全留喺 MFK 本機。</p></div>
      <div className="local-admin-menu-revision"><span>ACTIVE REVISION</span><b>R{snapshotRevision}</b><small>{dirty?'有未保存修改':'已同步'}</small></div>
    </header>

    <div className="local-admin-menu-scope">
      <b>今批已接：Menu</b>
      <span>未接：Pricing · Modifier · Combo · Rules · Order Mapping</span>
    </div>

    <div className="local-admin-menu-grid">
      <section className="local-admin-categories">
        <header><div><h3>分類</h3><span>{orderedCategories.length}</span></div><button type="button" onClick={addCategory}>＋ 分類</button></header>
        <div className="local-admin-category-list">
          {orderedCategories.map((category,index)=><article key={category.id}>
            <div className="local-admin-row-order"><button disabled={index===0} onClick={()=>moveCategory(category.id,-1)}>↑</button><button disabled={index===orderedCategories.length-1} onClick={()=>moveCategory(category.id,1)}>↓</button></div>
            <label><span>名稱</span><input value={category.name} onChange={event=>patchCategory(category.id,{name:event.target.value})}/></label>
            <small>{category.id}</small>
            <button className="danger" type="button" onClick={()=>removeCategory(category.id)}>刪除</button>
          </article>)}
        </div>
      </section>

      <section className="local-admin-products">
        <header><div><h3>商品</h3><span>{orderedProducts.length}</span></div><small>Product ID 先沿用 SMT 現有 ID；新增商品留下一批 Pricing 一齊接。</small></header>
        <div className="local-admin-product-list">
          {orderedProducts.map(product=><article key={product.id} className={product.active?'':'inactive'}>
            <div className="local-admin-product-main">
              <label><span>商品名稱</span><input value={product.name} onChange={event=>patchProduct(product.id,{name:event.target.value})}/></label>
              <small>{product.id}</small>
            </div>
            <label><span>分類</span><select value={product.categoryId} onChange={event=>patchProduct(product.id,{categoryId:event.target.value})}>{orderedCategories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label><span>排序</span><input type="number" min={0} max={9999} value={product.position} onChange={event=>patchProduct(product.id,{position:Number(event.target.value)||0})}/></label>
            <label className="local-admin-active"><input type="checkbox" checked={product.active} onChange={event=>patchProduct(product.id,{active:event.target.checked})}/><span>{product.active?'啟用':'停用'}</span></label>
          </article>)}
        </div>
      </section>
    </div>

    <footer className="local-admin-menu-footer">
      <p role="status">{message}</p>
      <div><button type="button" onClick={reload}>重新載入</button><button type="button" onClick={reset}>恢復初始 Menu</button><button className="primary" type="button" disabled={!dirty} onClick={save}>保存 Menu R{baseRevision+1}</button></div>
    </footer>
  </section>;
}
