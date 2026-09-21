export function safeClone(value){
  if(typeof structuredClone==='function'){
    try{return structuredClone(value);}catch(_error){}
  }
  return JSON.parse(JSON.stringify(value));
}

export function createRenderQueue(renderFn){
  let scheduled=false;
  let rendering=false;
  let pending=false;
  function run(){
    scheduled=false;
    if(rendering){pending=true;return;}
    rendering=true;
    try{renderFn();}
    catch(error){window.dispatchEvent(new CustomEvent('morefun:runtime-error',{detail:error}));}
    finally{
      rendering=false;
      if(pending){pending=false;schedule();}
    }
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(run);
  }
  return {schedule,flush:run};
}

export function createStore(initialState,options={}){
  let state=options.normalize?options.normalize(initialState):safeClone(initialState);
  const listeners=new Set();
  function get(){return state;}
  function persist(){
    if(!options.storageKey)return;
    try{localStorage.setItem(options.storageKey,JSON.stringify(state));}
    catch(error){console.warn('STORE_PERSIST_FAILED',error);}
  }
  function set(updater){
    const draft=safeClone(state);
    const next=typeof updater==='function'?updater(draft):updater;
    state=options.normalize?options.normalize(next):next;
    persist();
    listeners.forEach(listener=>listener(state));
  }
  function subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}
  return {get,set,subscribe,persist};
}

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

export function positionAnchoredElement(card,anchor,{side='auto',gap=16,viewportPadding=12}={}){
  if(!card||!anchor||!anchor.isConnected)return;
  const anchorRect=anchor.getBoundingClientRect();
  const cardRect=card.getBoundingClientRect();
  if(!cardRect.width||!cardRect.height)return;

  const viewportWidth=document.documentElement.clientWidth||window.innerWidth;
  const viewportHeight=document.documentElement.clientHeight||window.innerHeight;
  const anchorCenterX=anchorRect.left+anchorRect.width/2;
  const anchorCenterY=anchorRect.top+anchorRect.height/2;
  const room={top:anchorRect.top,bottom:viewportHeight-anchorRect.bottom,left:anchorRect.left,right:viewportWidth-anchorRect.right};

  let resolved=side;
  if(side==='auto'){
    resolved=[['top',room.bottom],['bottom',room.top],['left',room.right],['right',room.left]]
      .sort((a,b)=>b[1]-a[1])[0][0];
  }

  let left=cardRect.left;
  let top=cardRect.top;
  if(resolved==='left'){
    left=anchorRect.right+gap;
    top=anchorCenterY-cardRect.height/2;
  }else if(resolved==='right'){
    left=anchorRect.left-cardRect.width-gap;
    top=anchorCenterY-cardRect.height/2;
  }else if(resolved==='bottom'){
    left=anchorCenterX-cardRect.width/2;
    top=anchorRect.top-cardRect.height-gap;
  }else{
    left=anchorCenterX-cardRect.width/2;
    top=anchorRect.bottom+gap;
  }

  left=clamp(left,viewportPadding,viewportWidth-cardRect.width-viewportPadding);
  top=clamp(top,viewportPadding,viewportHeight-cardRect.height-viewportPadding);

  card.style.position='fixed';
  card.style.left=left+'px';
  card.style.right='auto';
  card.style.top=top+'px';
  card.style.bottom='auto';
  card.classList.add('anchored-card');
  card.dataset.arrowSide=resolved;

  const placed=card.getBoundingClientRect();
  if(resolved==='top'||resolved==='bottom'){
    card.style.setProperty('--anchor-x',clamp(anchorCenterX-placed.left,24,placed.width-24)+'px');
  }else{
    card.style.setProperty('--anchor-y',clamp(anchorCenterY-placed.top,24,placed.height-24)+'px');
  }
}

export function createOverlayManager(){
  let overlay=null;
  function forceClose(){
    if(!overlay)return;
    const current=overlay;
    overlay=null;
    current.scrim.remove();
    current.panel.remove();
    if(current.onClose)current.onClose();
  }
  function requestClose(){
    if(!overlay)return;
    if(overlay.isDirty?.()){
      const message=overlay.confirmMessage||'你已經作出選擇，確定離開而不套用？';
      if(!window.confirm(message))return;
    }
    forceClose();
  }
  function open({anchor,content='',className='anchored-popover',side='auto',gap=14,onClose=null,isDirty=null,confirmMessage=''}={}){
    forceClose();
    const scrim=document.createElement('button');
    scrim.className='overlay-scrim';
    scrim.type='button';
    scrim.setAttribute('aria-label','關閉浮卡');
    const panel=document.createElement('section');
    panel.className=className;
    panel.innerHTML=content;
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');
    document.body.append(scrim,panel);
    overlay={scrim,panel,onClose,isDirty,confirmMessage};
    const position=()=>positionAnchoredElement(panel,anchor,{side,gap});
    requestAnimationFrame(()=>requestAnimationFrame(position));
    scrim.addEventListener('click',requestClose);
    panel.addEventListener('click',event=>event.stopPropagation());
    return {panel,close:forceClose,requestClose,position};
  }
  return {open,close:forceClose,requestClose,get panel(){return overlay?.panel||null;}};
}

export function installErrorBoundary(options={}){
  function handle(error){
    console.error('MORE_FUN_RUNTIME_ERROR',error);
    if(options.toast)options.toast('操作未完成，資料已保留，請再試一次');
    if(options.report)options.report(error);
  }
  window.addEventListener('error',event=>{event.preventDefault();handle(event.error||event.message);});
  window.addEventListener('unhandledrejection',event=>{event.preventDefault();handle(event.reason);});
  return handle;
}

export function createViewportFitter(stage,options={}){
  const width=options.width||1920;
  const height=options.height||1080;
  function fit(){
    const scale=Math.min(window.innerWidth/width,window.innerHeight/height);
    stage.style.transform='scale('+scale+')';
    stage.style.left=Math.max(0,(window.innerWidth-width*scale)/2)+'px';
    stage.style.top=Math.max(0,(window.innerHeight-height*scale)/2)+'px';
    stage.dataset.scale=scale.toFixed(6);
  }
  fit();
  return fit;
}
