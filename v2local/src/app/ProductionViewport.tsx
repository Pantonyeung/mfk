import{useLayoutEffect,useState,type CSSProperties,type ReactNode}from'react';
import{computeProductionViewportLayout,SMT_GOLDEN_HEIGHT,SMT_GOLDEN_WIDTH}from'./production-viewport-layout';

function readViewport(){return computeProductionViewportLayout(window.innerWidth,window.innerHeight);}

export function ProductionViewport({children}:{children:ReactNode}){
  const[layout,setLayout]=useState(readViewport);
  useLayoutEffect(()=>{
    let baseline=readViewport();
    setLayout(baseline);
    const sync=()=>{
      const next=readViewport();
      const focused=document.activeElement;
      const textInput=focused instanceof HTMLInputElement||focused instanceof HTMLTextAreaElement;
      const keyboardLikeHeightDrop=next.viewportWidth===baseline.viewportWidth&&next.viewportHeight<baseline.viewportHeight*0.82;
      if(textInput&&keyboardLikeHeightDrop)return;
      baseline=next;
      setLayout(next);
    };
    window.addEventListener('resize',sync);
    window.addEventListener('orientationchange',sync);
    return()=>{
      window.removeEventListener('resize',sync);
      window.removeEventListener('orientationchange',sync);
    };
  },[]);
  const style={
    '--smt-production-scale':String(layout.scale),
    width:`${SMT_GOLDEN_WIDTH}px`,
    height:`${SMT_GOLDEN_HEIGHT}px`,
    left:`${layout.left}px`,
    top:`${layout.top}px`,
    transform:`scale(${layout.scale})`,
  }as CSSProperties;
  return <div className="smt-production-viewport" data-production-viewport="1920x1080" data-viewport-width={layout.viewportWidth} data-viewport-height={layout.viewportHeight} data-production-scale={layout.scale} data-production-left={layout.left} data-production-top={layout.top}>
    <div className="smt-production-canvas fidelity-frame" style={style}>{children}</div>
  </div>;
}
