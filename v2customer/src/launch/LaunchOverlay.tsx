import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import {OFFICIAL_LOGO_URL,launchAssetFor,resolveLaunchVariant,type LaunchVariant} from './launch-config';
import './launch.css';

const SEEN_KEY='mfk.customer.launch.seen.v2';
const SESSION_VARIANT_KEY='mfk.customer.launch.variant.v2';

function safeRead(storage:Storage,key:string){
  try{return storage.getItem(key)}catch{return null}
}
function safeWrite(storage:Storage,key:string,value:string){
  try{storage.setItem(key,value)}catch{/* launch storage is optional and never blocks Customer routing */}
}

export function LaunchOverlay({onEnterHome,onEnterMember}:{onEnterHome:()=>void;onEnterMember:()=>void}){
  const reducedMotion=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  const returning=useMemo(()=>typeof window!=='undefined'&&safeRead(window.localStorage,SEEN_KEY)==='1',[]);
  const [variant]=useState<LaunchVariant>(()=>{
    if(typeof window==='undefined')return 'male';
    const existing=safeRead(window.sessionStorage,SESSION_VARIANT_KEY);
    const chosen=resolveLaunchVariant(existing);
    safeWrite(window.sessionStorage,SESSION_VARIANT_KEY,chosen);
    return chosen;
  });
  const asset=launchAssetFor(variant);
  const mode=reducedMotion?'reduced':returning?'returning':'first';
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    const delay=mode==='reduced'?650:mode==='returning'?1100:3300;
    const timer=window.setTimeout(()=>setReady(true),delay);
    const guard=window.setTimeout(()=>setReady(true),4500);
    return()=>{window.clearTimeout(timer);window.clearTimeout(guard)};
  },[mode]);

  const finish=(target:'home'|'member')=>{
    if(typeof window!=='undefined')safeWrite(window.localStorage,SEEN_KEY,'1');
    if(target==='home')onEnterHome();
    else onEnterMember();
  };

  return <section
    className={'launch-overlay variant-'+variant+' mode-'+mode+(ready?' is-ready':'')}
    role="dialog"
    aria-modal="true"
    aria-label="磨飯啟動畫面"
    data-launch-variant={variant}
    data-launch-mode={mode}
    style={{'--launch-accent':asset.accent} as CSSProperties}
  >
    <div className="launch-brand-scene" aria-hidden="true">
      <span className="launch-logo-fallback">磨飯</span>
      <img className="launch-logo" src={OFFICIAL_LOGO_URL} alt="" onError={()=>setReady(true)}/>
      <div className="launch-character-stage">
        <img className="launch-character" src={asset.characterUrl} alt="" onError={()=>setReady(true)}/>
        <span className="launch-rice-ball"><i/><i/><i/><i/></span>
      </div>
      <p className="launch-story">用心手作，每一口都更幸福。</p>
    </div>

    <div className="launch-actions" aria-hidden={!ready}>
      <p className="launch-slogan">美味，從這裡開始。</p>
      <div className="launch-action-row">
        <button className="launch-primary" tabIndex={ready?0:-1} disabled={!ready} onClick={()=>finish('home')}>進入主頁</button>
        <button className="launch-secondary" tabIndex={ready?0:-1} disabled={!ready} onClick={()=>finish('member')}>進入會員頁</button>
      </div>
    </div>
  </section>;
}
