import {useEffect,useMemo,useState} from 'react';
import {launchAssetFor,resolveLaunchVariant,type LaunchVariant} from './launch-config';
import './launch.css';

const SEEN_KEY='mfk.customer.launch.seen.v1';
const SESSION_VARIANT_KEY='mfk.customer.launch.variant.v1';

function safeRead(storage:Storage,key:string){
  try{return storage.getItem(key)}catch{return null}
}
function safeWrite(storage:Storage,key:string,value:string){
  try{storage.setItem(key,value)}catch{/* storage is an enhancement, never a launch blocker */}
}

export function LaunchOverlay({onEnterHome,onEnterMember}:{onEnterHome:()=>void;onEnterMember:()=>void}){
  const reducedMotion=useMemo(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  const returning=useMemo(()=>typeof window!=='undefined'&&safeRead(window.localStorage,SEEN_KEY)==='1',[]);
  const [variant]=useState<LaunchVariant>(()=>{
    if(typeof window==='undefined')return 'hybrid';
    const existing=safeRead(window.sessionStorage,SESSION_VARIANT_KEY);
    const chosen=resolveLaunchVariant(existing);
    safeWrite(window.sessionStorage,SESSION_VARIANT_KEY,chosen);
    return chosen;
  });
  const asset=launchAssetFor(variant);
  const [ready,setReady]=useState(reducedMotion||returning);

  useEffect(()=>{
    if(ready)return;
    const guard=window.setTimeout(()=>setReady(true),6500);
    return()=>window.clearTimeout(guard);
  },[ready]);

  useEffect(()=>{
    if(!returning||reducedMotion)return;
    const fast=window.setTimeout(()=>setReady(true),250);
    return()=>window.clearTimeout(fast);
  },[returning,reducedMotion]);

  const finish=(target:'home'|'member')=>{
    if(typeof window!=='undefined')safeWrite(window.localStorage,SEEN_KEY,'1');
    if(target==='home')onEnterHome();
    else onEnterMember();
  };

  return <section className={'launch-overlay variant-'+variant+(ready?' is-ready':'')} role="dialog" aria-modal="true" aria-label="磨飯啟動畫面" data-launch-variant={variant}>
    <div className="launch-media" aria-hidden="true">
      {asset.poster?<img className="launch-poster" src={asset.poster} alt=""/>:null}
      {!reducedMotion&&!returning&&asset.videoUrl?<video className="launch-video" src={asset.videoUrl} poster={asset.poster??undefined} autoPlay muted playsInline preload="auto" onEnded={()=>setReady(true)} onError={()=>setReady(true)}/>:null}
      <div className="launch-vignette"/>
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
