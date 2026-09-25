import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const marker='DINING_REAL_CHECKOUT_R3';
const paths=['src/App.tsx','src/features/checkout/CheckoutWorkspace.tsx','src/features/checkout/checkout-workspace-model.ts'];
const hashes=['2e7eca6fa3b63f56a9cd0ca80e59880dc9c26203','b5e506cd70d85040359030d84f2a634c29831081','645610082db406c57858e18fc5ea3712e201dd9c'];
const sources=await Promise.all(paths.map(p=>fs.readFile(p,'utf8')));
if(sources.every(s=>s.includes(marker))){console.log('DINING_R3_ALREADY_APPLIED');process.exit(0);}
for(let i=0;i<paths.length;i++){const b=Buffer.from(sources[i]);const hash=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');if(hash!==hashes[i])throw new Error('BASE_MISMATCH:'+paths[i]);}
function replace(source,before,after){if(source.split(before).length!==2)throw new Error('PATCH_ANCHOR_NOT_UNIQUE:'+before.slice(0,100));return source.replace(before,()=>after);}
let [app,workspace,model]=sources;
const helper=`// DINING_REAL_CHECKOUT_R3: this is only a resumable UI intent, never Order/Payment truth.
import type {DiningCheckoutRequest} from '../../presentation/RuntimeDiningWorkspace.tsx';
export const DINING_CHECKOUT_UI_KEY='mfk.smt.dining-checkout-ui.v1';
function valid(value:unknown):value is DiningCheckoutRequest{
  if(!value||typeof value!=='object')return false;
  const row=value as DiningCheckoutRequest;
  if(typeof row.holdId!=='string'||!row.holdId||typeof row.codeLabel!=='string'||typeof row.tableLabel!=='string'||typeof row.submissionId!=='string'||!row.submissionId||row.submissionId.length>200||typeof row.expectedRevision!=='string'||!row.expectedRevision)return false;
  if(!Array.isArray(row.selections)||!row.selections.length||!Array.isArray(row.lines)||row.lines.length!==row.selections.length)return false;
  const indexes=new Set<number>();
  for(const selected of row.selections){
    if(!selected||!Number.isSafeInteger(selected.lineIndex)||selected.lineIndex<0||!Number.isSafeInteger(selected.qty)||selected.qty<=0||indexes.has(selected.lineIndex))return false;
    indexes.add(selected.lineIndex);
    const matching=row.lines.filter(line=>line.lineIndex===selected.lineIndex);
    if(matching.length!==1)return false;
    const line=matching[0];
    if(typeof line.id!=='string'||!line.id||typeof line.name!=='string'||line.qty!==selected.qty||!Number.isSafeInteger(line.unitMinor)||line.unitMinor<0)return false;
  }
  return true;
}
export function readDiningCheckoutUiSession(storage:Pick<Storage,'getItem'>=localStorage):DiningCheckoutRequest|null{
  try{const parsed=JSON.parse(storage.getItem(DINING_CHECKOUT_UI_KEY)||'null');return parsed?.version===1&&valid(parsed.request)?parsed.request:null;}catch{return null;}
}
export function saveDiningCheckoutUiSession(request:DiningCheckoutRequest,storage:Pick<Storage,'setItem'>=localStorage){
  if(!valid(request))throw new Error('DINING_CHECKOUT_REFRESH_REQUIRED');
  storage.setItem(DINING_CHECKOUT_UI_KEY,JSON.stringify({version:1,request}));
}
export function clearDiningCheckoutUiSession(storage:Pick<Storage,'removeItem'>=localStorage){storage.removeItem(DINING_CHECKOUT_UI_KEY);}
export function diningCheckoutLocation(tableLabel:string){
  if(!tableLabel)return '輪候';
  const n=Number(tableLabel.replace(/^T/,''));
  return n===9?'戶外桌':Number.isInteger(n)&&n>=1&&n<=8?n+' 號枱':'原桌台';
}
export function diningCheckoutCart(request:DiningCheckoutRequest){
  return request.lines.map((line,index)=>{
    const parts=line.name.split('｜');const name=parts.shift()||line.name;
    return {id:'dining-checkout-'+request.holdId+'-'+line.lineIndex+'-'+index,productId:line.id,name,qty:line.qty,unitMinor:line.unitMinor,serviceMode:'dine-in' as const,detail:parts.length?parts.join('｜'):undefined};
  });
}
`;
app=replace(app,"import {CheckoutWorkspace} from './features/checkout/CheckoutWorkspace.tsx';",`import {CheckoutWorkspace} from './features/checkout/CheckoutWorkspace.tsx';
// DINING_REAL_CHECKOUT_R3
import {readDiningCheckoutUiSession,saveDiningCheckoutUiSession,clearDiningCheckoutUiSession,diningCheckoutCart,diningCheckoutLocation} from './features/checkout/dining-checkout-ui-session.ts';`);
app=replace(app,"import {localRuntime,type DiningTender} from './runtime/local-runtime.ts';","import {localRuntime,type DiningTender,type LocalDiningHoldDetail,type LocalDiningPayment} from './runtime/local-runtime.ts';");
app=replace(app,"  const checkoutCommitBusyRef=useRef(false);",`  const checkoutCommitBusyRef=useRef(false);
  const [diningRecovering,setDiningRecovering]=useState(Boolean(diningCheckout));
  const [diningRequiresRefresh,setDiningRequiresRefresh]=useState(false);
  const [checkoutFailure,setCheckoutFailure]=useState<string|undefined>();`);
app=replace(app,"  const settlementMode=channel==='walk-in'?'LOCAL_PAYMENT' as const:'CHANNEL_INFO' as const;","  const settlementMode=diningCheckout||channel==='walk-in'?'LOCAL_PAYMENT' as const:'CHANNEL_INFO' as const;");
app=replace(app,"  const confirmEnabled=cart.length>0&&formalFastLaneBlockers===0&&(settlementMode==='LOCAL_PAYMENT'?localPaymentReady:channelRequiredReady);","  const confirmEnabled=cart.length>0&&!diningRecovering&&!diningRequiresRefresh&&formalFastLaneBlockers===0&&(settlementMode==='LOCAL_PAYMENT'?localPaymentReady:channelRequiredReady);");
app=replace(app,"      {id:'keeta',label:'Keeta',selected:channel==='keeta'},\n    ],",`      {id:'keeta',label:'Keeta',selected:channel==='keeta'},
    ].map(item=>({...item,id:item.id as CheckoutChannelId,enabled:!diningCheckout,label:diningCheckout&&item.id==='walk-in'?'堂食':item.label})),`);
app=replace(app,"    validationMessage,statusMessage:printStatus,completionReview:completion,","    validationMessage,statusMessage:printStatus,completionReview:completion,failureMessage:checkoutFailure,");
const beforeConfirm="  const confirm=async()=>{";
const prepare=`  const showDiningReceipt=(updated:LocalDiningHoldDetail,payment:LocalDiningPayment)=>{
    if(!diningCheckout)return;
    const place=diningCheckoutLocation(diningCheckout.tableLabel);
    const cashPayment=payment.tender==='CASH';
    setCompletion({
      heading:'堂食付款已記錄',
      helperLabel:'已保存原單付款紀錄；此預覽尚未連接正式訂單及堂食打印。',
      displayOrderCode:updated.codeLabel,
      sourceLabel:'堂食 · '+place,
      tenderLabel:methodLabels[payment.tender]??payment.tender,
      dueLabel:money(payment.amountMinor),
      ...(cashPayment?{receivedLabel:money(payment.receivedMinor??payment.amountMinor),changeLabel:money(payment.changeMinor??0)}:{}),
      statusLabel:updated.archivedAt?(diningCheckout.tableLabel?'堂食已付清，桌台已釋放':'輪候單已付清，紀錄已保留'):'堂食分項結帳完成，餘額保留 '+money(updated.remainingMinor),
      printStatusLabel:'堂食打印尚未接通，未發送',
      drawerStatusLabel:cashPayment?'開櫃指令尚未接通，未發送':'非現金：不開櫃桶',
      canCorrectPayment:false,correctionMethods:[],
    });
    setState('success');setCheckoutFailure(undefined);
    setPrintStatus('堂食 · '+place+' · 已保存付款，未結 '+money(updated.remainingMinor));
  };
  const diningError=(cause:unknown)=>{
    const code=cause instanceof Error?cause.message:String(cause);
    const refresh=/DINING_(CHECKOUT_STALE|CHECKOUT_REFRESH_REQUIRED|TOTAL_MISMATCH|SUBMISSION_CONFLICT|ALREADY_SETTLED|LINE_NOT_FOUND|QTY_EXCEEDS_REMAINING|STORAGE_INVALID)|HOLD_NOT_FOUND/.test(code);
    setDiningRequiresRefresh(refresh);setState('failure');
    setCheckoutFailure(refresh?'堂食單已更新或結帳資料已失效，請返回堂食重新核對；不會另建付款。':code==='DINING_CASH_INSUFFICIENT'?'現金收款不足，請重新核對實收金額。':'未能保存或核對堂食付款，請在此頁重試；不會重新派發付款身份。');
  };
  useEffect(()=>{
    if(!diningCheckout)return;
    let active=true;setDiningRecovering(true);
    void localRuntime.readDiningHold(diningCheckout.holdId).then(detail=>{
      if(!active)return;
      const payment=detail.payments.find(row=>row.submissionId===diningCheckout.submissionId);
      if(payment){showDiningReceipt(detail,payment);return;}
      if(detail.checkoutRevision!==diningCheckout.expectedRevision)throw new Error('DINING_CHECKOUT_STALE');
    }).catch(cause=>{if(active)diningError(cause);}).finally(()=>{if(active)setDiningRecovering(false);});
    return()=>{active=false;};
  },[diningCheckout?.holdId,diningCheckout?.submissionId]);

`;
app=replace(app,beforeConfirm,prepare+beforeConfirm);
const start=app.indexOf('        setCompletion({',app.indexOf('// DINING_PAYMENT_COMMAND_R2'));
const end=app.indexOf('\n        return;',start);
if(start<0||end<0)throw new Error('DINING_COMPLETION_BOUNDS');
app=app.slice(0,start)+`        const payment=updated.payments.find(row=>row.submissionId===diningCheckout.submissionId);
        if(!payment)throw new Error('DINING_PAYMENT_READBACK_UNKNOWN');
        showDiningReceipt(updated,payment);`+app.slice(end);
app=replace(app,"    }catch{\n      setState('failure');\n    }finally{\n      checkoutCommitBusyRef.current=false;",`    }catch(cause){
      if(diningCheckout)diningError(cause);else setState('failure');
    }finally{
      checkoutCommitBusyRef.current=false;`);
app=replace(app,"    onSelectChannel:setChannel,","    onSelectChannel:next=>{if(!diningCheckout)setChannel(next);},");
app=replace(app,"  const [cart,setCartState]=useState<CartLine[]>([]);\n  const [serviceMode,setServiceMode]=useState<ServiceMode>('takeaway');\n  const [diningCheckout,setDiningCheckout]=useState<DiningCheckoutRequest|null>(null);",`  const [diningCheckout,setDiningCheckout]=useState<DiningCheckoutRequest|null>(()=>readDiningCheckoutUiSession());
  const [cart,setCartState]=useState<CartLine[]>(()=>diningCheckout?diningCheckoutCart(diningCheckout):[]);
  const [serviceMode,setServiceMode]=useState<ServiceMode>(diningCheckout?'dine-in':'takeaway');`);
app=replace(app,"  const prepareDiningCheckout=(request:DiningCheckoutRequest)=>{",`  const prepareDiningCheckout=(request:DiningCheckoutRequest)=>{
    // Save ONLY resumable UI intent before navigation. The runtime revalidates every payment.
    saveDiningCheckoutUiSession(request);`);
app=replace(app,"onDiningCheckoutDone={()=>setDiningCheckout(null)}","onDiningCheckoutDone={()=>{clearDiningCheckoutUiSession();setDiningCheckout(null);}}");
model=replace(model,"export interface CheckoutChannelViewModel {","// DINING_REAL_CHECKOUT_R3\nexport interface CheckoutChannelViewModel {\n  readonly enabled?:boolean;");
model=replace(model,"  readonly completionReview?:{","  readonly completionReview?:{\n    readonly heading?:string;\n    readonly helperLabel?:string;");
workspace=replace(workspace,"disabled={processing||success} onClick={()=>actions.onSelectChannel(channel.id)}","disabled={processing||success||channel.enabled===false} onClick={()=>actions.onSelectChannel(channel.id)}");
workspace=replace(workspace,"<h2>交易已完成</h2><p>正式交易已提交；打印／櫃桶狀態會喺下面更新。</p>","<h2>{view.completionReview.heading??'交易已完成'}</h2><p>{view.completionReview.helperLabel??'正式交易已提交；打印／櫃桶狀態會喺下面更新。'}</p>");
workspace='// DINING_REAL_CHECKOUT_R3\n'+workspace;
await fs.writeFile('src/features/checkout/dining-checkout-ui-session.ts',helper);
for(let i=0;i<paths.length;i++)await fs.writeFile(paths[i],[app,workspace,model][i]);
console.log('DINING_R3_BOUNDED_PATCH_APPLIED');
