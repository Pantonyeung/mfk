import {createContext,useCallback,useContext,useEffect,useRef} from 'react';

type Blocker={blocked:()=>boolean;requestLeave:(proceed:()=>void,notice:string)=>void};
type Register=(blocker:Blocker)=>()=>void;
type Cursor={session:string;index:number;url:string};
const stateKey='mfpProductNavigation';
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function marker():Omit<Cursor,'url'>|null{
  const state=window.history.state,value=record(state)?state[stateKey]:null;
  return record(value)&&typeof value.session==='string'&&Number.isSafeInteger(value.index)?{session:value.session,index:Number(value.index)}:null;
}
const same=(a:Omit<Cursor,'url'>|null,b:Omit<Cursor,'url'>|null)=>!!a&&!!b&&a.session===b.session&&a.index===b.index;
const path=()=>window.location.pathname.replace(/\/$/,'')||'/admin/overview';
const unknownNotice='瀏覽器歷史已移到本次頁面以外的位置，無法安全還原原位置。你的編輯內容仍保留在此，網址可能已改變；可繼續編輯，或明確放棄後前往該頁。關閉前請先確認儲存結果。';

export const FormalProductNavigationContext=createContext<Register|null>(null);
export function useFormalProductNavigationBlocker(blocker:Blocker){
  const register=useContext(FormalProductNavigationContext),latest=useRef(blocker);latest.current=blocker;
  useEffect(()=>register?.({blocked:()=>latest.current.blocked(),requestLeave:(proceed,notice)=>latest.current.requestLeave(proceed,notice)}),[register]);
}

/** Product-edit guard at the existing shell navigation owner; no sentinel or persisted draft store. */
export function useFormalProductNavigationOwner(preview:boolean,apply:(nextPath:string)=>void){
  const applyRef=useRef(apply);applyRef.current=apply;
  const guard=useRef<Blocker|null>(null),cursor=useRef<Cursor|null>(null),mounted=useRef(false),sequence=useRef(0);
  const pendingUnknown=useRef<{url:string;sequence:number}|null>(null);
  const restore=useRef<{origin:Cursor;target:Cursor;sequence:number}|null>(null);
  const replay=useRef<{target:Cursor;sequence:number}|null>(null);
  const register=useCallback<Register>(blocker=>{
    guard.current=blocker;
    return()=>{
      if(guard.current!==blocker)return;
      guard.current=null;
      const pending=pendingUnknown.current;
      if(pending&&pending.sequence===sequence.current&&mounted.current&&window.location.href===pending.url){pendingUnknown.current=null;cursor.current=null;applyRef.current(path());}
    };
  },[]);
  useEffect(()=>{
    mounted.current=true;
    if(preview)return()=>{mounted.current=false;};
    // Tag only the currently loaded shell entry. Retain every pre-existing key; a foreign
    // reserved marker or non-object state stays untouched and uses the explicit fallback.
    if(!cursor.current){
      const state=window.history.state;
      if((state===null||record(state))&&!(record(state)&&Object.hasOwn(state,stateKey))){
        const anchor={session:crypto.randomUUID(),index:0,url:window.location.href};
        window.history.replaceState({...state,[stateKey]:{session:anchor.session,index:anchor.index}},'',anchor.url);cursor.current=anchor;
      }
    }
    const request=(proceed:()=>void,notice='')=>{
      if(guard.current?.blocked())guard.current.requestLeave(proceed,notice);else proceed();
    };
    const onPop=()=>{
      const targetMarker=marker(),url=window.location.href;
      if(replay.current&&same(targetMarker,replay.current.target)&&url===replay.current.target.url){
        const completed=replay.current;replay.current=null;
        if(completed.sequence===sequence.current){cursor.current=completed.target;applyRef.current(path());return;}
        // An old queued traversal can land after a newer explicit navigation. Restore
        // that newer owned position without replacing its route or pending decision.
        const latest=cursor.current;
        if(latest&&latest.session===completed.target.session&&latest.index!==completed.target.index){
          restore.current={origin:latest,target:completed.target,sequence:completed.sequence};
          window.history.go(latest.index-completed.target.index);
        }
        return;
      }
      const restoring=restore.current;
      if(restoring&&same(targetMarker,restoring.origin)&&url===restoring.origin.url){
        restore.current=null;
        // This is housekeeping for an earlier Back, not a new user decision.
        if(restoring.sequence!==sequence.current)return;
        const proceed=()=>{
          if(!mounted.current||sequence.current!==restoring.sequence||!same(marker(),restoring.origin)||window.location.href!==restoring.origin.url)return;
          replay.current={target:restoring.target,sequence:restoring.sequence};window.history.go(restoring.target.index-restoring.origin.index);
        };
        request(proceed);return;
      }
      // A newer traversal cancels stale restore/replay decisions. No guessed history delta.
      restore.current=null;replay.current=null;
      const attempt=++sequence.current;pendingUnknown.current=null;
      if(!guard.current?.blocked()){
        cursor.current=targetMarker?{...targetMarker,url}:null;applyRef.current(path());return;
      }
      const origin=cursor.current;
      if(origin&&targetMarker?.session===origin.session&&targetMarker.index!==origin.index){
        restore.current={origin,target:{...targetMarker,url},sequence:attempt};window.history.go(origin.index-targetMarker.index);return;
      }
      if(origin&&same(targetMarker,origin)&&url===origin.url)return;
      // Unknown/pre-session entries are not mutated. Keep the editor mounted until a choice.
      pendingUnknown.current={url,sequence:attempt};
      request(()=>{
        if(!mounted.current||sequence.current!==attempt||window.location.href!==url)return;
        pendingUnknown.current=null;cursor.current=null;applyRef.current(path());
      },unknownNotice);
    };
    window.addEventListener('popstate',onPop);
    return()=>{mounted.current=false;sequence.current++;restore.current=null;replay.current=null;window.removeEventListener('popstate',onPop);};
  },[preview]);
  const navigate=useCallback((nextPath:string)=>{
    const attempt=++sequence.current;pendingUnknown.current=null;
    const proceed=()=>{
      if(!mounted.current||sequence.current!==attempt)return;
      if(!preview){
        const previous=cursor.current;
        const adjacent=previous&&same(marker(),previous)&&window.location.href===previous.url;
        const next={session:adjacent?previous.session:crypto.randomUUID(),index:adjacent?previous.index+1:0};
        window.history.pushState({[stateKey]:next},'',nextPath);cursor.current={...next,url:window.location.href};
      }
      applyRef.current(nextPath);
    };
    if(guard.current?.blocked())guard.current.requestLeave(proceed,'');else proceed();
  },[preview]);
  return {register,navigate};
}
