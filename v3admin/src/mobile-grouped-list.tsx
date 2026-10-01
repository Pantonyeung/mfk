import {useMemo,useState,type ReactNode} from 'react';

export type MobileGroupedItem={
  id:string;
  group:string;
};

export function MobileGroupedPager<T extends MobileGroupedItem>({
  items,
  pageSize=10,
  renderItem,
  emptyLabel='目前未有資料',
}:{
  items:readonly T[];
  pageSize?:number;
  renderItem:(item:T)=>ReactNode;
  emptyLabel?:string;
}){
  const groups=useMemo(()=>{
    const map=new Map<string,T[]>();
    for(const item of items){
      const group=item.group||'未分類';
      const list=map.get(group)??[];
      list.push(item);
      map.set(group,list);
    }
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],'zh-HK'));
  },[items]);
  const [openGroup,setOpenGroup]=useState<string|null>(groups[0]?.[0]??null);
  const [pageByGroup,setPageByGroup]=useState<Record<string,number>>({});

  if(!groups.length)return <div className="v3-mobile-group-empty">{emptyLabel}</div>;

  return <div className="v3-mobile-grouped-list">
    {groups.map(([group,groupItems])=>{
      const isOpen=openGroup===group;
      const pageCount=Math.max(1,Math.ceil(groupItems.length/pageSize));
      const rawPage=pageByGroup[group]??1;
      const page=Math.min(rawPage,pageCount);
      const start=(page-1)*pageSize;
      const visible=groupItems.slice(start,start+pageSize);
      return <section key={group} className="v3-mobile-group" data-open={isOpen?'true':'false'}>
        <button
          type="button"
          className="v3-mobile-group-trigger"
          aria-expanded={isOpen}
          onClick={()=>{
            setOpenGroup(current=>current===group?null:group);
            setPageByGroup(current=>({...current,[group]:1}));
          }}
        >
          <span><strong>{group}</strong><small>{groupItems.length} 項</small></span>
          <span className="v3-mobile-group-chevron" aria-hidden="true">{isOpen?'−':'＋'}</span>
        </button>
        {isOpen?<div className="v3-mobile-group-panel">
          <div className="v3-mobile-group-items">{visible.map(renderItem)}</div>
          {pageCount>1?<nav className="v3-mobile-pagination" aria-label={group+' 分頁'}>
            <button type="button" disabled={page<=1} onClick={()=>setPageByGroup(current=>({...current,[group]:Math.max(1,page-1)}))}>上一頁</button>
            <span>第 {page} / {pageCount} 頁</span>
            <button type="button" disabled={page>=pageCount} onClick={()=>setPageByGroup(current=>({...current,[group]:Math.min(pageCount,page+1)}))}>下一頁</button>
          </nav>:null}
        </div>:null}
      </section>;
    })}
  </div>;
}
