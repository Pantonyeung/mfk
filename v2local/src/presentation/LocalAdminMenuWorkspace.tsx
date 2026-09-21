import {useEffect,useMemo,useState} from 'react';
import {
  discardLocalAdminMenuDraft,
  inspectLocalAdminMenuDraft,
  publishLocalAdminMenu,
  readLocalAdminMenu,
  readLocalAdminMenuDraft,
  resetLocalAdminMenuToSeed,
  saveLocalAdminMenuDraft,
  subscribeLocalAdminMenu,
  subscribeLocalAdminMenuDraft,
  type LocalAdminMenuCategory,
  type LocalAdminMenuProduct,
} from '../runtime/local-admin-menu.ts';
import './local-admin-menu-workspace.css';

type Draft={
  categories:LocalAdminMenuCategory[];
  products:LocalAdminMenuProduct[];
};

function copyDraft():Draft{
  const draft=readLocalAdminMenuDraft();
  return {
    categories:draft.categories.map(row=>({...row})),
    products:draft.products.map(row=>({...row})),
  };
}
function normalizePositions<T extends {position:number}>(rows:T[]):T[]{
  return rows.map((row,index)=>({...row,position:(index+1)*10}));
}

export function LocalAdminMenuWorkspace(){
  const initialActive=readLocalAdminMenu();
  const initialDraft=readLocalAdminMenuDraft();
  const [activeRevision,setActiveRevision]=useState(initialActive.revision);
  const [draftRevision,setDraftRevision]=useState(initialDraft.draftRevision);
  const [basePublishedRevision,setBasePublishedRevision]=useState(initialDraft.basePublishedRevision);
  const [draft,setDraft]=useState<Draft>(copyDraft);
  const [message,setMessage]=useState('Menu Admin 已獨立。修改先保存草稿，發布後 POS 先會轉版本。');
  const [dirty,setDirty]=useState(false);

  useEffect(()=>{
    const stopActive=subscribeLocalAdminMenu(()=>{
      const active=readLocalAdminMenu();
      setActiveRevision(active.revision);
    });
    const stopDraft=subscribeLocalAdminMenuDraft(()=>{
      const saved=readLocalAdminMenuDraft();
      setDraftRevision(saved.draftRevision);
      setBasePublishedRevision(saved.basePublishedRevision);
      if(!dirty)setDraft(copyDraft());
    });
    return()=>{stopActive();stopDraft();};
  },[dirty]);

  const orderedCategories=useMemo(
    ()=>[...draft.categories].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)),
    [draft.categories],
  );
  const orderedProducts=useMemo(
    ()=>[...draft.products].sort((a,b)=>a.categoryId.localeCompare(b.categoryId)||a.position-b.position||a.id.localeCompare(b.id)),
    [draft.products],
  );
  const validation=useMemo(()=>inspectLocalAdminMenuDraft(draft),[draft]);

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
  const addProduct=()=>{
    const used=new Set(draft.products.map(row=>row.id));
    let suffix=1;
    while(used.has('product-new-'+suffix))suffix+=1;
    const categoryId=orderedCategories[0]?.id;
    if(!categoryId){setMessage('請先建立至少一個分類。');return;}
    setDraft(current=>({
      ...current,
      products:[...current.products,{
        id:'product-new-'+suffix,
        name:'新商品',
        categoryId,
        position:(current.products.filter(row=>row.categoryId===categoryId).length+1)*10,
        active:false,
      }],
    }));
    setDirty(true);
  };
  const removeProduct=(id:string)=>{
    setDraft(current=>({...current,products:current.products.filter(row=>row.id!==id)}));
    setDirty(true);
  };

  const saveDraft=()=>{
    try{
      const saved=saveLocalAdminMenuDraft(draft,draftRevision);
      setDraftRevision(saved.draftRevision);
      setBasePublishedRevision(saved.basePublishedRevision);
      setDraft(copyDraft());
      setDirty(false);
      setMessage('草稿 D'+saved.draftRevision+' 已保存；POS 仍然使用 Menu R'+activeRevision+'。');
      return saved;
    }catch(error){
      const code=error instanceof Error?error.message:'ADMIN_MENU_DRAFT_SAVE_FAILED';
      setMessage(code==='ADMIN_MENU_DRAFT_REVISION_CONFLICT'?'草稿版本已變，請重新載入。':code);
      return null;
    }
  };

  const publish=()=>{
    try{
      let targetDraftRevision=draftRevision;
      if(dirty){
        const saved=saveLocalAdminMenuDraft(draft,draftRevision);
        targetDraftRevision=saved.draftRevision;
        setDraftRevision(saved.draftRevision);
        setDirty(false);
      }
      const published=publishLocalAdminMenu(targetDraftRevision,activeRevision);
      const nextDraft=readLocalAdminMenuDraft();
      setActiveRevision(published.revision);
      setDraftRevision(nextDraft.draftRevision);
      setBasePublishedRevision(nextDraft.basePublishedRevision);
      setDraft(copyDraft());
      setDirty(false);
      setMessage('Menu R'+published.revision+' 已發布；POS 已切換到呢個 Active Menu。');
    }catch(error){
      const code=error instanceof Error?error.message:'ADMIN_MENU_PUBLISH_FAILED';
      setMessage(code);
    }
  };

  const reload=()=>{
    const saved=readLocalAdminMenuDraft();
    setDraft(copyDraft());
    setDraftRevision(saved.draftRevision);
    setBasePublishedRevision(saved.basePublishedRevision);
    setActiveRevision(readLocalAdminMenu().revision);
    setDirty(false);
    setMessage('已重新載入草稿 D'+saved.draftRevision+'。');
  };
  const discard=()=>{
    try{
      const next=discardLocalAdminMenuDraft(draftRevision);
      setDraft(copyDraft());
      setDraftRevision(next.draftRevision);
      setBasePublishedRevision(next.basePublishedRevision);
      setDirty(false);
      setMessage('已放棄草稿；重新跟 Active Menu R'+activeRevision+'。');
    }catch(error){setMessage(error instanceof Error?error.message:'ADMIN_MENU_DRAFT_DISCARD_FAILED');}
  };
  const resetSeed=()=>{
    try{
      const next=resetLocalAdminMenuToSeed(draftRevision);
      setDraft(copyDraft());
      setDraftRevision(next.draftRevision);
      setBasePublishedRevision(next.basePublishedRevision);
      setDirty(false);
      setMessage('初始 Menu 已放入草稿 D'+next.draftRevision+'；未發布，POS 未變。');
    }catch(error){setMessage(error instanceof Error?error.message:'ADMIN_MENU_RESET_FAILED');}
  };

  return <section className="local-admin-menu">
    <header className="local-admin-menu-head">
      <div>
        <small>MFK ADMIN · MENU</small>
        <h2>Menu 管理</h2>
        <p>Admin 管 Menu；SMT 只讀 Active Menu。草稿唔會直接改交易畫面。</p>
      </div>
      <div className="local-admin-menu-version-pair">
        <div><span>ACTIVE</span><b>R{activeRevision}</b><small>POS 正在使用</small></div>
        <div><span>DRAFT</span><b>D{draftRevision}</b><small>base R{basePublishedRevision}</small></div>
      </div>
    </header>

    <div className={validation.ok?'local-admin-menu-validation valid':'local-admin-menu-validation invalid'}>
      <b>{validation.ok?'結構合法':'結構未通過'}</b>
      <span>{validation.ok?'可以保存／發布。':validation.errors.join(' · ')}</span>
      <em>{dirty?'有未保存修改':'草稿已保存'}</em>
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
        <header>
          <div><h3>商品</h3><span>{orderedProducts.length}</span></div>
          <button type="button" onClick={addProduct}>＋ 商品</button>
        </header>
        <div className="local-admin-product-list">
          {orderedProducts.map(product=><article key={product.id} className={product.active?'':'inactive'}>
            <div className="local-admin-product-main">
              <label><span>商品名稱</span><input value={product.name} onChange={event=>patchProduct(product.id,{name:event.target.value})}/></label>
              <small>{product.id}</small>
            </div>
            <label><span>分類</span><select value={product.categoryId} onChange={event=>patchProduct(product.id,{categoryId:event.target.value})}>{orderedCategories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label><span>排序</span><input type="number" min={0} max={9999} value={product.position} onChange={event=>patchProduct(product.id,{position:Number(event.target.value)||0})}/></label>
            <label className="local-admin-active"><input type="checkbox" checked={product.active} onChange={event=>patchProduct(product.id,{active:event.target.checked})}/><span>{product.active?'啟用':'停用'}</span></label>
            {product.id.startsWith('product-new-')?<button type="button" className="danger" onClick={()=>removeProduct(product.id)}>移除</button>:null}
          </article>)}
        </div>
      </section>
    </div>

    <footer className="local-admin-menu-footer">
      <p role="status">{message}</p>
      <div>
        <button type="button" onClick={reload}>重新載入</button>
        <button type="button" onClick={discard}>放棄草稿</button>
        <button type="button" onClick={resetSeed}>初始 Menu → 草稿</button>
        <button type="button" disabled={!dirty||!validation.ok} onClick={saveDraft}>保存草稿</button>
        <button className="primary" type="button" disabled={!validation.ok} onClick={publish}>發布到 POS</button>
      </div>
    </footer>
  </section>;
}
