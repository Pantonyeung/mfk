import {useEffect} from 'react';
import {createMfkRuntimeReadyOnce,type MfkRuntimeReadyBridge} from './runtime-carrier-boundary.ts';

const signalRuntimeReadyOnce=createMfkRuntimeReadyOnce();

type RuntimeReadyWindow=Window&{moreFunNative?:MfkRuntimeReadyBridge};

export function RuntimeReadyActivation(){
  useEffect(()=>{
    const target=window as RuntimeReadyWindow;
    signalRuntimeReadyOnce(new URL(target.location.href),target.moreFunNative);
  },[]);
  return null;
}
