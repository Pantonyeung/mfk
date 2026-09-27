import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import {OFFICIAL_LOGO_URL,STAGE0_BENTO_URL,STAGE0_RICEBALL_URL,launchAssetFor,resolveLaunchVariant,type LaunchVariant} from './launch-config';
import './launch.css';

const SEEN_KEY='mfk.customer.launch.seen.v2';
const SESSION_VARIANT_KEY='mfk.customer.launch.variant.v2';

function safeRead(storage:Storage,key:string){try{return storage.getItem(key)}catch{return null}}
function safeWrite(storage:Storage,key:string,value:string){try{storage.setItem(key,value)}catch{/* optional */}}

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
    const delay=mode==='reduced'?700:mode==='returning'?1150:3300;
    const timer=window.setTimeout(()=>setReady(true),delay);
    const guard=window.setTimeout(()=>setReady(true),4200);
    return()=>{window.clearTimeout(timer);window.clearTimeout(guard)};
  },[mode]);

  const finish=(target:'home'|'member')=>{
    if(typeof window!=='undefined')safeWrite(window.localStorage,SEEN_KEY,'1');
    target==='home'?onEnterHome():onEnterMember();
  };
  const assetFailed=()=>setReady(true);

  return <section
    className={'launch-overlay variant-'+variant+' mode-'+mode+(ready?' is-ready':'')}
    role="dialog" aria-modal="true" aria-label="磨飯啟動畫面"
    data-launch-variant={variant} data-launch-mode={mode}
    style={{'--launch-accent':asset.accent} as CSSProperties}
  >
    <div className="launch-brand-scene" aria-hidden="true">
      <img className="launch-logo" src={OFFICIAL_LOGO_URL} alt="" onError={assetFailed}/>
      <p className="launch-brand-line">手作・輕食</p>

      <div className="launch-character-stage">
        <img className="launch-character" src={asset.characterUrl} alt="" onError={assetFailed}/>
        <p className="launch-hungry">肚餓啦？</p>
        <span className="launch-riceball"><img src={STAGE0_RICEBALL_URL} alt="" onError={assetFailed}/></span>
        <span className="launch-bento"><img src={STAGE0_BENTO_URL} alt="" onError={assetFailed}/></span>
      </div>

      <p className="launch-story">用心手作，<br/>每一口都更幸福。</p>
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
