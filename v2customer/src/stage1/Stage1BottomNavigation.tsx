export type Stage1NavView='home'|'menu'|'cart'|'orders'|'more';

export function Stage1BottomNavigation({
  active,
  cartCount,
  orderCount,
  onChange,
}:{
  active:Stage1NavView;
  cartCount:number;
  orderCount:number;
  onChange:(next:Stage1NavView)=>void;
}){
  const items=[
    {id:'home' as const,label:'首頁'},
    {id:'menu' as const,label:'點單'},
    {id:'cart' as const,label:'記憶罐',badge:cartCount},
    {id:'orders' as const,label:'訂單',badge:orderCount},
    {id:'more' as const,label:'會員'},
  ];
  return <nav className="stage1-bottom-nav" aria-label="主要導覽">
    {items.map(item=><button
      key={item.id}
      className={active===item.id?'is-active':''}
      data-center={item.id==='cart'||undefined}
      aria-current={active===item.id?'page':undefined}
      onClick={()=>onChange(item.id)}
    >
      <span>{item.label}</span>
      {item.badge?<b aria-label={item.badge+' 項'}>{item.badge}</b>:null}
    </button>)}
  </nav>;
}
