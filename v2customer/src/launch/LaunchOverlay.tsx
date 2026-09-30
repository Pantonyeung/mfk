import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {OFFICIAL_LOGO_URL,STAGE0_BENTO_URL,STAGE0_RICEBALL_URL,launchAssetFor,resolveLaunchVariant,type LaunchVariant} from './launch-config';
import './launch.css';

const SEEN_KEY='mfk.customer.launch.seen.v2';
const SESSION_VARIANT_KEY='mfk.customer.launch.variant.v2';
const UI0_VIDEO_PATH='/media/ui0/opening-mobile-v1.mp4';

function safeRead(storage:Storage,key:string){try{return storage.getItem(key)}catch{return null}}
function safeWrite(storage:Storage,key:string,value:string){try{storage.setItem(key,value)}catch{/* optional */}}

export function LaunchOverlay({onEnterHome}:{onEnterHome:()=>void}){
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
  const [videoUnavailable,setVideoUnavailable]=useState(false);
  const enterHomeRef=useRef(onEnterHome);

  useEffect(()=>{enterHomeRef.current=onEnterHome},[onEnterHome]);

  useEffect(()=>{
    const delay=mode==='reduced'?120:mode==='returning'?700:2500;
    let finished=false;
    const finish=()=>{
      if(finished)return;
      finished=true;
      if(typeof window!=='undefined')safeWrite(window.localStorage,SEEN_KEY,'1');
      enterHomeRef.current();
    };
    const timer=window.setTimeout(finish,delay);
    const guard=window.setTimeout(finish,2900);
    return()=>{window.clearTimeout(timer);window.clearTimeout(guard)};
  },[mode]);

  return <section
    className={'launch-overlay variant-'+variant+' mode-'+mode}
    role="dialog" aria-modal="true" aria-label="磨飯啟動畫面"
    data-launch-variant={variant} data-launch-mode={mode}
    style={{'--launch-accent':asset.accent} as CSSProperties}
  >
    {!reducedMotion&&!videoUnavailable?<video
      className="launch-opening-video"
      src={UI0_VIDEO_PATH}
      autoPlay muted playsInline preload="auto"
      aria-hidden="true"
      onError={()=>setVideoUnavailable(true)}
    />:null}
    <div className={"launch-brand-scene"+(!reducedMotion&&!videoUnavailable?" is-video-backed":"")} aria-hidden="true">
      <img className="launch-logo" src={OFFICIAL_LOGO_URL} alt=""/>
      <div className="launch-character-stage">
        <span className="launch-character-crop">
          <img className="launch-character-source-sheet" src={asset.characterSheetUrl} alt=""/>
        </span>
        <span className="launch-riceball"><img src={STAGE0_RICEBALL_URL} alt=""/></span>
        <span className="launch-bento"><img src={STAGE0_BENTO_URL} alt=""/></span>
      </div>
      <p className="launch-question">肚餓啦？</p>
      <p className="launch-story">用心手作，<br/>每一口都更幸福。</p>
    </div>

  </section>;
}
