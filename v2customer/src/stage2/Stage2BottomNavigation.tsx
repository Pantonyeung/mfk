export type Stage2NavView='home'|'menu'|'cart'|'orders'|'more';

const glyph=(id:Stage2NavView)=>{
  if(id==='home')return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2 12 4l8 7.2V20h-5v-5H9v5H4Z"/></svg>;
  if(id==='menu')return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9"/></svg>;
  if(id==='cart')return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10l1 12H6L7 8Zm2 0a3 3 0 0 1 6 0"/></svg>;
  if(id==='orders')return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16H7zM9.5 9h5M9.5 13h5M9.5 17h3"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M6 20c.5-4 2.5-6 6-6s5.5 2 6 6"/></svg>;
};

export function Stage2BottomNavigation({active,cartCount,orderCount,onChange}:{active:Stage2NavView;cartCount:number;orderCount:number;onChange:(next:Stage2NavView)=>void}){
  const items=[
    {id:'home' as const,label:'首頁'},
    {id:'menu' as const,label:'點單'},
    {id:'cart' as const,label:'記憶罐',badge:cartCount},
    {id:'orders' as const,label:'訂單',badge:orderCount},
    {id:'more' as const,label:'會員'},
  ];
  return <nav className="stage2-bottom-nav" aria-label="主要導覽">
    {items.map(item=><button key={item.id} className={active===item.id?'is-active':''} data-center={item.id==='cart'||undefined} aria-current={active===item.id?'page':undefined} onClick={()=>onChange(item.id)}>
      <i className="stage2-nav-icon">{glyph(item.id)}</i>
      <span>{item.label}</span>
      {item.badge?<b aria-label={item.badge+' 項'}>{item.badge}</b>:null}
    </button>)}
  </nav>;
}
