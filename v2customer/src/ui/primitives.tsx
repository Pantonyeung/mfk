import {createElement,useEffect,useLayoutEffect,useRef,useState,type ButtonHTMLAttributes,type CSSProperties,type ElementType,type PointerEvent as ReactPointerEvent,type ReactNode} from 'react';
import type {CustomerConnectionState} from '../product-types';

type ButtonVariant='primary'|'secondary'|'quiet'|'ghost'|'danger';

export function ActionButton({variant='primary',wide=false,loading=false,className='',children,disabled,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:ButtonVariant;wide?:boolean;loading?:boolean}){
  return <button className={`action-button ${variant}${wide?' wide':''} ${className}`.trim()} aria-busy={loading||undefined} disabled={disabled||loading} {...props}>{loading?<i className="button-loader" aria-hidden="true"/>:null}<span>{children}</span></button>;
}

export type ActionState='default'|'loading'|'pending'|'success'|'error'|'unknown'|'disabled';

export function StatefulAction({state='default',labels,onClick,disabled=false}:{
  state?:ActionState;
  labels:Partial<Record<ActionState,string>>&Pick<Record<ActionState,string>,'default'>;
  onClick?:()=>void;
  disabled?:boolean;
}){
  const finalState=disabled?'disabled':state;
  const label=labels[finalState]??labels.default;
  return <button className={`stateful-action state-${finalState}`} data-state={finalState} disabled={disabled||finalState==='disabled'||state==='loading'||state==='pending'||state==='success'} aria-busy={state==='loading'||state==='pending'} onClick={onClick}>
    <span className="stateful-action-copy" key={finalState}>{label}</span>
    {state==='loading'?<i className="stateful-loader" aria-hidden="true"/>:null}
  </button>;
}

export function AnimatedValue({children,className='',as='span'}:{children:ReactNode;className?:string;as?:ElementType}){
  return createElement(as,{className:`animated-value ${className}`.trim(),'aria-live':'polite'},<span key={String(children)}>{children}</span>);
}

export function QuantityStepper({label,quantity,onChange,min=0}:{label:string;quantity:number;onChange:(next:number)=>void;min?:number}){
  if(quantity<=0)return <button className="quantity-add" onClick={()=>onChange(1)}>加入</button>;
  return <div className="quantity-stepper" aria-label={`${label}數量`}>
    <button aria-label={`減少${label}`} onClick={()=>onChange(Math.max(min,quantity-1))}>減</button>
    <AnimatedValue>{quantity}</AnimatedValue>
    <button aria-label={`增加${label}`} onClick={()=>onChange(quantity+1)}>加</button>
  </div>;
}

export function ExpandingSearch({value,onChange}:{value:string;onChange:(value:string)=>void}){
  const [expanded,setExpanded]=useState(Boolean(value));
  const inputRef=useRef<HTMLInputElement>(null);
  const open=()=>{
    setExpanded(true);
    requestAnimationFrame(()=>inputRef.current?.focus());
  };
  return <div className={`expanding-search${expanded?' expanded':''}`} role="search">
    {!expanded?<button onClick={open} aria-label="開啟商品搜尋"><span>搜尋商品</span><small>名稱或關鍵字</small></button>:null}
    {expanded?<label><span>搜尋商品</span><input ref={inputRef} type="search" value={value} onChange={event=>onChange(event.target.value)} onBlur={()=>{if(!value)setExpanded(false)}} placeholder="輸入餐點名稱"/><button type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange('');setExpanded(false)}}>{value?'清除':'收起'}</button></label>:null}
  </div>;
}

export function CollapsingHeader({children}:{children:ReactNode}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;
        ref.current?.style.setProperty('--scroll-progress',String(Math.min(1,Math.max(0,window.scrollY/140))));
      });
    };
    update();
    window.addEventListener('scroll',update,{passive:true});
    return()=>{window.removeEventListener('scroll',update);if(frame)cancelAnimationFrame(frame)};
  },[]);
  return <div ref={ref} className="collapsing-header">{children}</div>;
}

export function CustomerHeader({storeName,connection,browserOnline,onHome,onService}:{
  storeName?:string;connection:CustomerConnectionState;browserOnline:boolean;onHome:()=>void;onService:()=>void;
}){
  const copy=!browserOnline
    ?'離線中'
    :connection==='READY'
      ?'店舖已連接'
      :connection==='LOADING'
        ?'更新中'
        :connection==='ERROR'
          ?'需要重試'
          :connection==='STALE'||connection==='PARTIAL'
            ?'資料待更新'
            :connection==='UNKNOWN'
              ?'狀態確認中'
              :'尚未連接';
  return <header className="app-header">
    <button className="brand-lockup" onClick={onHome} aria-label="返回磨飯首頁">
      <span className="brand-mark" aria-hidden="true">磨</span>
      <span><strong>磨飯</strong><small>{storeName||'自家點餐'}</small></span>
    </button>
    <button className="service-status" onClick={onService} aria-label={`查看服務狀態：${copy}`}>
      <i data-state={!browserOnline?'offline':connection.toLowerCase()} aria-hidden="true"/>
      <span>{copy}</span>
    </button>
  </header>;
}

export function StatusBanner({tone='info',title,detail,actionLabel,onAction}:{
  tone?:'info'|'warning'|'danger'|'offline';title:string;detail:string;actionLabel?:string;onAction?:()=>void;
}){
  return <section className={`status-banner ${tone}`} role={tone==='danger'?'alert':'status'}>
    <div><strong>{title}</strong><p>{detail}</p></div>
    {actionLabel&&onAction?<ActionButton variant="quiet" onClick={onAction}>{actionLabel}</ActionButton>:null}
  </section>;
}

export function PageIntro({kicker,title,detail,aside}:{kicker?:string;title:string;detail?:string;aside?:ReactNode}){
  return <header className="page-intro">
    <div>{kicker?<span className="kicker">{kicker}</span>:null}<h1>{title}</h1>{detail?<p>{detail}</p>:null}</div>
    {aside?<div className="page-intro-aside">{aside}</div>:null}
  </header>;
}

export function EmptyState({title,detail,children,compact=false}:{title:string;detail:string;children?:ReactNode;compact?:boolean}){
  return <section className={`empty-state${compact?' compact':''}`} role="status">
    <span className="empty-mark" aria-hidden="true"/>
    <h2>{title}</h2>
    <p>{detail}</p>
    {children?<div className="empty-actions">{children}</div>:null}
  </section>;
}

export function MenuSkeleton(){
  return <section className="skeleton-list" aria-busy="true" aria-label="正在同步菜單">
    {[0,1,2].map(item=><div className="skeleton-row" key={item}><i/><span><b/><small/></span></div>)}
  </section>;
}

export function BottomNavigation({active,cartCount,orderCount,onChange}:{
  active:'home'|'menu'|'cart'|'orders'|'more';cartCount:number;orderCount:number;onChange:(view:'home'|'menu'|'cart'|'orders')=>void;
}){
  const items=[
    {id:'home' as const,label:'首頁'},
    {id:'menu' as const,label:'點餐'},
    {id:'cart' as const,label:'購物籃',badge:cartCount},
    {id:'orders' as const,label:'訂單',badge:orderCount},
  ];
  return <nav className="bottom-navigation" aria-label="主要導覽">
    {items.map(item=><button key={item.id} className={active===item.id?'active':''} aria-current={active===item.id?'page':undefined} onClick={()=>onChange(item.id)}>
      <span>{item.label}</span>
      {item.badge?<b aria-label={`${item.badge} 項`}>{item.badge}</b>:null}
    </button>)}
  </nav>;
}

export interface ProductOriginRect {readonly top:number;readonly left:number;readonly width:number;readonly height:number}

export function ProductDialog({label,onClose,children,footer,origin}:{label:string;onClose:()=>void;children:ReactNode;footer?:ReactNode;origin?:ProductOriginRect|null}){
  const ref=useRef<HTMLDialogElement>(null);
  const surfaceRef=useRef<HTMLDivElement>(null);
  const restoreRef=useRef<HTMLElement|null>(null);
  const gestureRef=useRef({pointerId:-1,startY:0,lastY:0,lastAt:0,velocity:0});
  const [closing,setClosing]=useState(false);
  const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dismiss=()=>{
    if(reducedMotion()){onClose();return}
    setClosing(true);
  };
  useEffect(()=>{
    restoreRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const dialog=ref.current;
    if(dialog&&!dialog.open)dialog.showModal();
    return()=>restoreRef.current?.focus();
  },[]);
  useLayoutEffect(()=>{
    const surface=surfaceRef.current;
    if(!surface||!origin||reducedMotion())return;
    const destination=surface.getBoundingClientRect();
    const originCenterX=origin.left+origin.width/2;
    const originCenterY=origin.top+origin.height/2;
    const destinationCenterX=destination.left+destination.width/2;
    const destinationCenterY=destination.top+destination.height/2;
    surface.style.setProperty('--origin-x',`${originCenterX-destinationCenterX}px`);
    surface.style.setProperty('--origin-y',`${originCenterY-destinationCenterY}px`);
    surface.style.setProperty('--origin-scale',String(Math.max(.2,Math.min(1,origin.width/destination.width))));
    surface.dataset.motion='origin';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{surface.dataset.motion='settled'}));
  },[origin]);
  const pointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
    gestureRef.current={pointerId:event.pointerId,startY:event.clientY,lastY:event.clientY,lastAt:event.timeStamp,velocity:0};
    event.currentTarget.setPointerCapture(event.pointerId);
    surfaceRef.current?.classList.add('dragging');
  };
  const pointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const gesture=gestureRef.current;
    if(gesture.pointerId!==event.pointerId)return;
    const elapsed=Math.max(1,event.timeStamp-gesture.lastAt);
    gesture.velocity=(event.clientY-gesture.lastY)/elapsed*1000;
    gesture.lastY=event.clientY;
    gesture.lastAt=event.timeStamp;
    const raw=event.clientY-gesture.startY;
    const y=raw<0?raw*.18:raw;
    surfaceRef.current?.style.setProperty('--drag-y',`${Math.max(-28,y)}px`);
    ref.current?.style.setProperty('--sheet-progress',String(Math.max(0,Math.min(1,1-y/420))));
  };
  const pointerUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const gesture=gestureRef.current;
    if(gesture.pointerId!==event.pointerId)return;
    const distance=event.clientY-gesture.startY;
    gesture.pointerId=-1;
    surfaceRef.current?.classList.remove('dragging');
    if(distance>140||gesture.velocity>850){dismiss();return}
    surfaceRef.current?.style.setProperty('--drag-y','0px');
    ref.current?.style.setProperty('--sheet-progress','1');
  };
  return <dialog ref={ref} className={`product-dialog${closing?' closing':''}`} style={{'--sheet-progress':'1'} as CSSProperties} aria-label={label} onCancel={event=>{event.preventDefault();dismiss()}} onClick={event=>{if(event.target===ref.current)dismiss()}}>
    <div ref={surfaceRef} className="dialog-surface" onTransitionEnd={event=>{if(closing&&event.target===surfaceRef.current&&event.propertyName==='transform')onClose()}}>
      <div className="dialog-handle" aria-hidden="true" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}/>
      <button className="dialog-close" onClick={dismiss} aria-label="關閉商品詳情">關閉</button>
      <div className="dialog-content">{children}</div>
      {footer?<footer className="dialog-footer">{footer}</footer>:null}
    </div>
  </dialog>;
}
