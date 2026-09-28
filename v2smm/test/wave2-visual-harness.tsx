import {createRoot} from 'react-dom/client';
import {Stage7OrdersView} from '../src/Stage7Orders';
import {Stage8DineView} from '../src/Stage8Dine';
import {Stage9MoreView} from '../src/Stage9More';
import {StageXState} from '../src/StageXState';
import '../src/styles.css';
import '../src/stage7.css';
import '../src/stage8.css';
import '../src/stage9.css';
import '../src/stagex.css';

const observedAt='2026-09-28T12:00:00+08:00';
const stage=new URLSearchParams(location.search).get('stage')||'7';

const orders=[
  {
    orderId:'order-028',displayCode:'#028',source:'Keeta',sourceGroup:'THIRD_PARTY',lifecycle:'PREPARING',
    fulfillmentLabel:'製作中',itemSummary:'招牌紫米飯糰 · 台式奶茶',itemCount:2,effectiveAmountLabel:'$132',amountLabel:'$132',
    observedAt,orderTime:'2026-09-28T11:42:00+08:00',readback:'CONFIRMED',tenderLabel:'Keeta 已付款',
    customerPhone:'9123 4567',customerPhonePermitted:true,externalRef:'K-48271',
    items:[{quantity:1,name:'招牌紫米飯糰',amountLabel:'$84'},{quantity:1,name:'台式奶茶',amountLabel:'$48'}],
    timeline:[{label:'已收到訂單',detail:'Keeta',at:'2026-09-28T11:42:00+08:00'},{label:'製作中',detail:'店舖已開始處理',at:'2026-09-28T11:43:00+08:00'}],
  },
  {
    orderId:'order-029',displayCode:'#029',source:'SMM',sourceGroup:'SMM',lifecycle:'READY',
    fulfillmentLabel:'準備完成 / 可取餐',itemSummary:'台式肉燥便當',itemCount:1,effectiveAmountLabel:'$49',amountLabel:'$49',
    observedAt,orderTime:'2026-09-28T11:47:00+08:00',readback:'CONFIRMED',tenderLabel:'現金',
    customerPhonePermitted:false,items:[{quantity:1,name:'台式肉燥便當',amountLabel:'$49'}],
    timeline:[{label:'已收到訂單',detail:'店員點單',at:'2026-09-28T11:47:00+08:00'}],
  },
];

const tables=[
  {tableId:'T-A1',label:'A1',sortOrder:1},
  {tableId:'T-A2',label:'A2',sortOrder:2},
  {tableId:'T-B1',label:'B1',sortOrder:3},
  {tableId:'T-B2',label:'B2',sortOrder:4},
];

const sessions=[
  {
    sessionId:'S-A1',tableLabel:'A1',covers:2,openedAt:'2026-09-28T11:20:00+08:00',state:'OPEN',
    itemSummary:'招牌紫米飯糰 · 台式奶茶',totalMinor:13200,paidMinor:0,remainingMinor:13200,
    lines:[{lineIndex:0,name:'招牌紫米飯糰',qty:1,remainingQty:1,unitMinor:8400},{lineIndex:1,name:'台式奶茶',qty:1,remainingQty:1,unitMinor:4800}],
  },
  {
    sessionId:'S-B2',tableLabel:'B2',covers:3,openedAt:'2026-09-28T11:38:00+08:00',state:'OPEN',
    itemSummary:'便當 · 飯團套餐',totalMinor:19600,paidMinor:9800,remainingMinor:9800,
    lines:[{lineIndex:0,name:'台式肉燥便當',qty:2,remainingQty:1,unitMinor:4900},{lineIndex:1,name:'紫米套餐',qty:1,remainingQty:1,unitMinor:9800}],
  },
  {
    sessionId:'S-W1',tableLabel:'輪候',covers:2,openedAt:'2026-09-28T11:50:00+08:00',state:'WAITING',
    itemSummary:'2 位',totalMinor:0,paidMinor:0,remainingMinor:0,lines:[],
  },
];

function Evidence(){
  if(stage==='7')return <Stage7OrdersView connection="READY" rows={orders as never} onRefresh={()=>{}}/>;
  if(stage==='8')return <Stage8DineView connection="READY" sessions={sessions as never} tables={tables as never} onStartOrder={()=>{}} onStartWaiting={()=>{}} onRefresh={()=>{}}/>;
  if(stage==='9')return <Stage9MoreView tool={null} setTool={()=>{}} statuses={{
    staff:'店長 A',connection:'Internet',channels:'3 條渠道',business:'2026-09-28',printing:'3 部設備',
    capacity:'正常',reporting:'已更新',refunds:'目前冇待跟進',diagnostics:'已連接',
  }}/>;
  return <main style={{display:'grid',gap:10}}>
    <StageXState kind="LOADING"/>
    <StageXState kind="EMPTY"/>
    <StageXState kind="OFFLINE"/>
    <StageXState kind="STALE" onPrimary={()=>{}}/>
    <StageXState kind="PARTIAL" onPrimary={()=>{}}/>
    <StageXState kind="UNKNOWN" onPrimary={()=>{}}/>
    <StageXState kind="ERROR" onPrimary={()=>{}}/>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Evidence/>);
