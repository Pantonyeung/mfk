import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HoldCartWorkspace,initialHoldModeForLines,type WorkspaceCartLine} from '../src/features/ordering/OrderingCenterWorkspaces.tsx';
import '../src/features/ordering/ordering-center-workspaces.css';

const tables=Array.from({length:9},(_,index)=>({
  id:index===8?'outdoor':String(index+1),
  label:index===8?'戶外桌':String(index+1)+' 號枱',
  occupied:index===2,
  ...(index===2?{codeLabel:'P023'}:{}),
}));

const takeaway:WorkspaceCartLine[]=[
  {id:'a',productId:'a',name:'外賣飯團',qty:1,unitMinor:4100,serviceMode:'takeaway'},
  {id:'b',productId:'b',name:'外賣飲品',qty:1,unitMinor:1600,serviceMode:'takeaway'},
];
const mixed:WorkspaceCartLine[]=[
  {id:'a',productId:'a',name:'堂食飯團',qty:1,unitMinor:4100,serviceMode:'dine-in'},
  {id:'b',productId:'b',name:'外賣飲品',qty:1,unitMinor:1600,serviceMode:'takeaway'},
];

function Harness(){
  const [scenario,setScenario]=useState<'takeaway'|'mixed'>('takeaway');
  const lines=scenario==='mixed'?mixed:takeaway;
  return <main style={{padding:20,height:'100vh',boxSizing:'border-box',background:'#edf2f8'}}>
    <div style={{display:'flex',gap:8,marginBottom:12}}>
      <button id="scenario-takeaway" onClick={()=>setScenario('takeaway')}>全外賣</button>
      <button id="scenario-mixed" onClick={()=>setScenario('mixed')}>混合單</button>
    </div>
    <section style={{height:'calc(100% - 50px)',maxWidth:1100,margin:'0 auto',background:'#fff',borderRadius:16,overflow:'hidden'}}>
      <HoldCartWorkspace
        key={scenario}
        lines={lines}
        totalMinor={5700}
        tables={tables}
        initialMode={initialHoldModeForLines(lines)}
        onHoldWaiting={()=>undefined}
        onHoldQueue={()=>undefined}
        onHoldTable={()=>undefined}
      />
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Harness/>);
