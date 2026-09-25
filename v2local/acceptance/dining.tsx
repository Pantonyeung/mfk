import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Route,Routes} from 'react-router';
import {RuntimeDiningWorkspace,type DiningCheckoutRequest} from '../src/presentation/RuntimeDiningWorkspace.tsx';
import type {CleanSmtCoreRuntimePort,LocalDiningHoldDetail} from '../src/runtime/local-runtime.ts';

// Deliberately in-memory test data. No production runtime, network consumer, printer or storage import.
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const at=(minutes:number)=>new Date(Date.now()-minutes*60000).toISOString();
const line=(lineIndex:number,id:string,name:string,qty:number,unitMinor:number)=>({lineIndex,id,name,qty,paidQty:0,remainingQty:qty,unitMinor});
const make=(holdId:string,codeLabel:string,assignedTable:string|undefined,lines:LocalDiningHoldDetail['lines'],minutes:number,partySize=4):LocalDiningHoldDetail=>({
  holdId,codeLabel,assignedTable,createdAt:at(minutes),partySize,note:'示例資料',
  totalMinor:lines.reduce((s,x)=>s+x.qty*x.unitMinor,0),paidMinor:0,
  remainingMinor:lines.reduce((s,x)=>s+x.remainingQty*x.unitMinor,0),lines,payments:[],
});
let holds:Record<string,LocalDiningHoldDetail>={
  H1:make('H1','D001','T01',[line(0,'rice','飯團甲',5,4100),line(1,'snack','小食甲',2,1800),line(2,'tea','奶茶甲',3,1600)],32),
  H2:make('H2','D002','T02',[line(0,'bento','便當乙',1,5200)],10,2),
  HW:make('HW','W001',undefined,[line(0,'wait-rice','輪候飯團',2,4100)],20,2),
  HE:make('HE','W002',undefined,[],1,2),
};
let revision=1;
const listeners=new Set<()=>void>();
const calls={checkout:[] as DiningCheckoutRequest[],assign:[] as string[],remove:[] as string[],create:0,clear:[] as string[]};
const delay:Record<string,number>={};
function emit(){revision+=1;for(const fn of listeners)fn();}
function detail(id:string){const row=holds[id];if(!row)throw new Error('DINING_HOLD_NOT_FOUND');return row;}
const runtime={
  subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
  readDining:async()=>({businessDate:'2026-09-25',revision,
    queue:Object.values(holds).filter(x=>!x.assignedTable).map(x=>({id:x.holdId,codeLabel:x.codeLabel,partySize:x.partySize,statusLabel:'待安排座位'})),
    tables:Array.from({length:9},(_,i)=>{
      const id='T'+String(i+1).padStart(2,'0');const row=Object.values(holds).find(x=>x.assignedTable===id);
      return row?{id,label:String(i+1),areaLabel:'堂食',state:row.remainingMinor===0?'settled':'occupied',holdId:row.holdId,startedAt:row.createdAt,partySize:row.partySize,outstandingLabel:row.codeLabel,itemCount:row.lines.reduce((s,x)=>s+x.qty,0),itemSummary:row.lines.map(x=>x.name).join('、'),totalMinor:row.totalMinor,paidMinor:row.paidMinor,remainingMinor:row.remainingMinor}
        :{id,label:String(i+1),areaLabel:'堂食',state:'available'};
    }),
  }),
  readDiningHold:async(id:string)=>{const result=copy(detail(id));if(delay[id])await new Promise(r=>setTimeout(r,delay[id]));return result;},
  createDiningWait:async(input:{partySize:number;note:string})=>{calls.create+=1;const id='NEW'+calls.create;holds[id]={...make(id,'W00'+(calls.create+2),undefined,[],0,input.partySize),note:input.note};emit();return copy(holds[id]);},
  assignDiningTable:async(id:string,tableId:string)=>{if(Object.values(holds).some(x=>x.assignedTable===tableId))throw new Error('TABLE_OCCUPIED');calls.assign.push(id+':'+tableId);holds[id]={...detail(id),assignedTable:tableId};emit();},
  removeDiningWait:async(id:string)=>{calls.remove.push(id);delete holds[id];emit();},
  unassignDiningTable:async(id:string)=>{holds[id]={...detail(id),assignedTable:undefined};emit();},
  clearDiningHold:async(id:string)=>{calls.clear.push(id);if(detail(id).remainingMinor>0)throw new Error('UNPAID');delete holds[id];emit();},
} as unknown as CleanSmtCoreRuntimePort;

(window as any).__diningProof={calls,emit,delay,
  mutate:(id:string,patch:Partial<LocalDiningHoldDetail>,notify=false)=>{holds[id]={...detail(id),...patch};if(notify)emit();},
  snapshot:()=>copy(holds),
};
const warning=new URLSearchParams(location.search).get('warning');
const optionalProps=warning==='none'?{}:{warningMinutes:30};
function App(){return <MemoryRouter><Routes>
  <Route path="/" element={<RuntimeDiningWorkspace {...optionalProps} runtime={runtime} onCheckout={request=>{calls.checkout.push(copy(request));}}/>}/>
  <Route path="/checkout" element={<main style={{padding:32}}><h1>已交回同一 Checkout 入口</h1><p>此頁只核對交接資料，不收款、不建立正式交易。</p><pre data-testid="checkout-readback">{JSON.stringify(calls.checkout.at(-1),null,2)}</pre></main>}/>
</Routes></MemoryRouter>;}
createRoot(document.getElementById('root')!).render(<App/>);
