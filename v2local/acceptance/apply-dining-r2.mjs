import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
// Applied only on the isolated R2 branch by its proof job. Product files are committed only after GREEN.
function edit(path,baseBlob,marker,apply){
  let text=fs.readFileSync(path,'utf8');
  if(text.includes(marker)){console.log('ALREADY_APPLIED',path);return;}
  assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim(),baseBlob,'Source drift: '+path);
  const replace=(old,next)=>{assert.ok(text.includes(old),'Anchor missing: '+old.slice(0,100));text=text.replace(old,()=>next);};
  const section=(start,end,next)=>{const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a,'Section missing: '+start);text=text.slice(0,a)+next+text.slice(b);};
  apply(replace,section,()=>text);
  assert.ok(text.includes(marker));fs.writeFileSync(path,text);
}
edit('src/runtime/local-runtime.ts','57ee98b1e4be3c3bd70676c7f5c702bab8ecceda','DINING_SETTLEMENT_SAFETY_R2',(replace,section,get)=>{
  replace('export interface LocalDiningPayment{',`export interface DiningSettlementCommand{
  readonly submissionId:string;
  readonly expectedRevision:string;
  readonly receivedMinor?:number;
}
export interface LocalDiningPayment{
  readonly submissionId?:string;
  readonly requestSignature?:string;
  readonly receivedMinor?:number;
  readonly changeMinor?:number;`);
  replace('export interface LocalDiningHoldDetail{',`export interface LocalDiningHoldDetail{
  readonly checkoutRevision?:string;
  readonly archivedAt?:string;
  readonly lastAssignedTable?:string;`);
  replace('export interface LocalHoldDraft{',`export interface LocalHoldDraft{
  readonly archivedAt?:string;
  readonly lastAssignedTable?:string;`);
  replace('interface Persisted{orders:StoredOrder[];availability:Record<string,SmtAvailabilityStatus>;holds:LocalHoldDraft[]}',
    'interface Persisted{orders:StoredOrder[];availability:Record<string,SmtAvailabilityStatus>;holds:LocalHoldDraft[];diningRevision?:number}');
  for(const optional of ['?','']){
    const old='settleDiningHold'+optional+'(holdId:string,selections:readonly {lineIndex:number;qty:number}[],tender:DiningTender):Promise<LocalDiningHoldDetail>;';
    replace(old,'settleDiningHold'+optional+'(holdId:string,selections:readonly {lineIndex:number;qty:number}[],tender:DiningTender,command?:DiningSettlementCommand):Promise<LocalDiningHoldDetail>;');
  }
  replace('  readDiningHold?(holdId:string):Promise<LocalDiningHoldDetail>;',
    '  readDiningHold?(holdId:string):Promise<LocalDiningHoldDetail>;\n  readDiningHistory?():Promise<readonly LocalDiningHoldDetail[]>;');
  replace('  readDiningHold(holdId:string):Promise<LocalDiningHoldDetail>;',
    '  readDiningHold(holdId:string):Promise<LocalDiningHoldDetail>;\n  readDiningHistory():Promise<readonly LocalDiningHoldDetail[]>;');
  replace('    holdId:hold.id,\n    codeLabel:hold.codeLabel,',`    holdId:hold.id,
    checkoutRevision:diningCheckoutRevision(hold),
    archivedAt:hold.archivedAt,
    lastAssignedTable:hold.lastAssignedTable,
    codeLabel:hold.codeLabel,`);
  replace('function diningDetail(hold:LocalHoldDraft):LocalDiningHoldDetail{',`// DINING_SETTLEMENT_SAFETY_R2: no extra database, formal Order or print path.
// Single-runtime synchronous critical section: durable envelope first, then in-memory publication.
// Cross-device/multi-tab transaction serialization is NOT claimed by this local guard.
function readDiningState():Persisted{
  const raw=localStorage.getItem(KEY);
  if(raw===null)return clone(defaults);
  const value=JSON.parse(raw);
  if(!value||!Array.isArray(value.orders)||!Array.isArray(value.holds)||!value.availability||typeof value.availability!=='object')throw new Error('DINING_STORAGE_INVALID');
  return value as Persisted;
}
function commitDiningHolds(snapshot:Persisted,holds:LocalHoldDraft[]){
  const next:Persisted={...snapshot,holds,diningRevision:(snapshot.diningRevision??0)+1};
  localStorage.setItem(KEY,JSON.stringify(next));
  data=next;
  for(const listener of listeners){try{listener();}catch{console.warn('DINING_OBSERVER_FAILED');}}
}
function diningCheckoutRevision(hold:LocalHoldDraft){return 'DINING2:'+JSON.stringify(hold);}
function requireDiningHold(snapshot:Persisted,id:string){
  const hold=snapshot.holds.find(row=>row.id===id);
  if(!hold)throw new Error('HOLD_NOT_FOUND');
  if(hold.kind!=='dining')throw new Error('NOT_DINING_HOLD');
  return hold;
}
function archiveDiningHold(hold:LocalHoldDraft,at:string):LocalHoldDraft{
  const {assignedTable,...rest}=hold;
  return {...rest,archivedAt:hold.archivedAt??at,...(assignedTable?{lastAssignedTable:assignedTable}:{})};
}
function diningDetail(hold:LocalHoldDraft):LocalDiningHoldDetail{`);
  replace('  holds(){return data.holds},','  holds(){return readDiningState().holds.filter(hold=>!hold.archivedAt)},');
  replace('  removeHold(id){data={...data,holds:data.holds.filter(item=>item.id!==id)};save()},',`  removeHold(id){
    const snapshot=readDiningState();const hold=snapshot.holds.find(row=>row.id===id);
    if(hold?.archivedAt||hold?.payments?.length)throw new Error('DINING_HISTORY_PROTECTED');
    if(hold?.kind==='dining'&&(hold.assignedTable||hold.items.length))throw new Error('DINING_NONEMPTY_HOLD_PROTECTED');
    commitDiningHolds(snapshot,snapshot.holds.filter(row=>row.id!==id));
  },`);
  replace('  async readDining(){\n    return {','  async readDining(){\n    data=readDiningState();\n    return {');
  replace("businessDate:new Date().toISOString().slice(0,10),revision:1,","businessDate:new Date().toISOString().slice(0,10),revision:data.diningRevision??1,");
  replace("hold.kind==='dining'&&!hold.assignedTable","hold.kind==='dining'&&!hold.archivedAt&&!hold.assignedTable");
  replace("hold.kind==='dining'&&hold.assignedTable===id","hold.kind==='dining'&&!hold.archivedAt&&hold.assignedTable===id");
  replace("state:detail.remainingMinor===0?'settled' as const:'occupied' as const,","state:detail.remainingMinor===0&&detail.payments.length>0?'settled' as const:'occupied' as const,");
  section('  async removeDiningWait(id){','  async readAvailability(){',`  async removeDiningWait(id){
    const snapshot=readDiningState();const hold=requireDiningHold(snapshot,id);
    if(hold.archivedAt||hold.payments?.length)throw new Error('DINING_HISTORY_PROTECTED');
    if(hold.assignedTable||hold.items.length)throw new Error('DINING_NONEMPTY_HOLD_PROTECTED');
    commitDiningHolds(snapshot,snapshot.holds.filter(row=>row.id!==id));
  },
  async assignDiningTable(holdId,tableId){
    const snapshot=readDiningState();const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)throw new Error('DINING_HISTORY_PROTECTED');
    if(!/^T0[1-9]$/.test(tableId))throw new Error('DINING_TABLE_INVALID');
    if(snapshot.holds.some(row=>row.id!==holdId&&!row.archivedAt&&row.kind==='dining'&&row.assignedTable===tableId))throw new Error('DINING_TABLE_OCCUPIED');
    if(hold.assignedTable===tableId)return;
    commitDiningHolds(snapshot,snapshot.holds.map(row=>row.id===holdId?{...row,assignedTable:tableId}:row));
  },
  async unassignDiningTable(holdId){
    const snapshot=readDiningState();const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)throw new Error('DINING_HISTORY_PROTECTED');
    const {assignedTable,...rest}=hold;
    commitDiningHolds(snapshot,snapshot.holds.map(row=>row.id===holdId?{...rest,...(assignedTable?{lastAssignedTable:assignedTable}:{})}:row));
  },
  async readDiningHold(holdId){
    return clone(diningDetail(requireDiningHold(readDiningState(),holdId)));
  },
  async readDiningHistory(){
    return readDiningState().holds.filter(hold=>hold.kind==='dining'&&hold.archivedAt)
      .sort((a,b)=>String(b.archivedAt).localeCompare(String(a.archivedAt))).map(hold=>clone(diningDetail(hold)));
  },
  async settleDiningHold(holdId,selections,tender,command){
    if(!command||typeof command.submissionId!=='string'||!command.submissionId.trim()||command.submissionId.length>200||typeof command.expectedRevision!=='string'||!command.expectedRevision)throw new Error('DINING_CHECKOUT_REFRESH_REQUIRED');
    if(!['CASH','ALIPAY','WECHAT','FPS','PAYME','COMBO'].includes(tender))throw new Error('DINING_TENDER_INVALID');
    if(!Array.isArray(selections)||!selections.length)throw new Error('DINING_SELECTION_INVALID');
    const seen=new Set<number>();
    const normalized=selections.map(selection=>{
      if(!selection||!Number.isSafeInteger(selection.lineIndex)||selection.lineIndex<0||!Number.isSafeInteger(selection.qty)||selection.qty<=0)throw new Error('DINING_SELECTION_INVALID');
      if(seen.has(selection.lineIndex))throw new Error('DINING_DUPLICATE_SELECTION');
      seen.add(selection.lineIndex);return {lineIndex:selection.lineIndex,qty:selection.qty};
    }).sort((a,b)=>a.lineIndex-b.lineIndex);
    const signature=JSON.stringify([holdId,tender,normalized,command.receivedMinor??null]);
    const snapshot=readDiningState();const hold=requireDiningHold(snapshot,holdId);
    const prior=snapshot.holds.flatMap(row=>(row.payments??[]).map(payment=>({holdId:row.id,payment}))).find(row=>row.payment.submissionId===command.submissionId);
    if(prior){
      if(prior.holdId!==holdId||prior.payment.requestSignature!==signature)throw new Error('DINING_SUBMISSION_CONFLICT');
      data=snapshot;return clone(diningDetail(hold));
    }
    if(hold.archivedAt)throw new Error('DINING_ALREADY_SETTLED');
    if(command.expectedRevision!==diningCheckoutRevision(hold))throw new Error('DINING_CHECKOUT_STALE');
    if(hold.items.some(row=>!Number.isSafeInteger(row.qty)||row.qty<=0||!Number.isSafeInteger(row.unitMinor)||row.unitMinor<0))throw new Error('DINING_AMOUNT_INVALID');
    const sum=hold.items.reduce((total,row)=>total+row.qty*row.unitMinor,0);
    if(!Number.isSafeInteger(sum)||sum!==hold.totalMinor)throw new Error('DINING_TOTAL_MISMATCH');
    const detail=diningDetail(hold);
    const paymentSelections=normalized.map(selection=>{
      const line=detail.lines[selection.lineIndex];
      if(!line)throw new Error('DINING_LINE_NOT_FOUND');
      if(selection.qty>line.remainingQty)throw new Error('DINING_QTY_EXCEEDS_REMAINING');
      return {...selection,amountMinor:line.unitMinor*selection.qty};
    });
    const amountMinor=paymentSelections.reduce((sum,row)=>sum+row.amountMinor,0);
    if(!Number.isSafeInteger(amountMinor)||amountMinor<0||amountMinor>detail.remainingMinor)throw new Error('DINING_AMOUNT_INVALID');
    const receivedMinor=tender==='CASH'?command.receivedMinor:amountMinor;
    if(!Number.isSafeInteger(receivedMinor)||receivedMinor!<amountMinor)throw new Error('DINING_CASH_INSUFFICIENT');
    const createdAt=new Date().toISOString();
    const payment:LocalDiningPayment={id:'DP:'+holdId+':'+command.submissionId,submissionId:command.submissionId,requestSignature:signature,createdAt,tender,amountMinor,receivedMinor,changeMinor:receivedMinor!-amountMinor,selections:paymentSelections};
    let updated:LocalHoldDraft={...hold,payments:[...(hold.payments??[]),payment]};
    const after=diningDetail(updated);
    if(after.remainingMinor===0&&after.lines.length>0&&after.lines.every(row=>row.remainingQty===0))updated=archiveDiningHold(updated,createdAt);
    commitDiningHolds(snapshot,snapshot.holds.map(row=>row.id===holdId?updated:row));
    return clone(diningDetail(updated));
  },
  async clearDiningHold(holdId){
    const snapshot=readDiningState();const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)return;
    const detail=diningDetail(hold);
    if(detail.remainingMinor>0||!detail.lines.length||!detail.payments.length||detail.lines.some(row=>row.remainingQty>0))throw new Error('DINING_BALANCE_REMAINING');
    const archived=archiveDiningHold(hold,new Date().toISOString());
    commitDiningHolds(snapshot,snapshot.holds.map(row=>row.id===holdId?archived:row));
  },
`);
});
edit('src/presentation/RuntimeDiningWorkspace.tsx','b3263eaa70a1c48516de063862203c5f8e0bcf7e','DINING_CHECKOUT_HANDOFF_R2',(replace)=>{
  replace('export interface DiningCheckoutRequest{',`// DINING_CHECKOUT_HANDOFF_R2
export interface DiningCheckoutRequest{
  readonly submissionId?:string;
  readonly expectedRevision?:string;`);
  replace("  const [message,setMessage]=useState('');",`  const [message,setMessage]=useState('');
  const [historyRows,setHistoryRows]=useState<readonly LocalDiningHoldDetail[]>([]);
  const [historyOpen,setHistoryOpen]=useState(false);`);
  replace('      const next=await runtime.readDining();',`      const next=await runtime.readDining();
      const past=await runtime.readDiningHistory?.()??[];`);
  replace('      setView(next);setError(null);','      setView(next);setHistoryRows(past);setError(null);');
  replace("    setSelectedHoldId(holdId);setSelectedWait(isWaiting?holdId:null);setMessage('');","    setHistoryOpen(false);setSelectedHoldId(holdId);setSelectedWait(isWaiting?holdId:null);setMessage('');");
  replace("onCheckout({holdId:latest.holdId,codeLabel:latest.codeLabel,tableLabel:latest.assignedTable?.replace(/^T/,'')??'',selections,lines});",`onCheckout({holdId:latest.holdId,codeLabel:latest.codeLabel,tableLabel:latest.assignedTable?.replace(/^T/,'')??'',selections,lines,submissionId:'DINING-'+crypto.randomUUID(),expectedRevision:latest.checkoutRevision});`);
  replace("<span>{busy?'更新中':'本機資料'}</span></header>","<button type=\"button\" onClick={()=>setHistoryOpen(value=>!value)}>已結帳紀錄 {historyRows.length}</button><span>{busy?'更新中':'本機資料'}</span></header>");
  replace('      {detail?<>',`      {historyOpen?<section className="dining-payment-history" style={{maxHeight:'100%'}}>
        <header><b>已結帳紀錄</b><button type="button" onClick={()=>setHistoryOpen(false)}>返回</button></header>
        {historyRows.length?historyRows.map(row=><button type="button" key={row.holdId} onClick={()=>openHold(row.holdId)} style={{display:'block',width:'100%',padding:14,marginTop:8,textAlign:'left',background:'#edf4ff',border:'1px solid #bfd0e8',borderRadius:8}}><b>{row.codeLabel} · {tableName(row.lastAssignedTable)}</b><p>{money(row.paidMinor)} · {row.payments.length} 次付款</p></button>):<p>未有已结帳紀錄。</p>}
      </section>:detail?<>`);
  replace('<h2>{tableName(detail.assignedTable)}</h2>','<h2>{tableName(detail.assignedTable??detail.lastAssignedTable)}</h2>');
  replace('<footer className="dining-detail-actions">',`{detail.archivedAt?<p className="dining-message" role="status">已付清，桌台已釋放；商品及付款紀錄保留。</p>:null}
        <footer className="dining-detail-actions">`);
  replace('          <button type="button" className="clear" disabled={actionBusy||checkoutBusy||!detail.assignedTable||detail.remainingMinor>0||detail.payments.length===0} onClick={()=>void clearTable()}>清枱</button>',
    '          {!detail.archivedAt?<button type="button" className="clear" disabled={actionBusy||checkoutBusy||!detail.assignedTable||detail.remainingMinor>0||detail.payments.length===0} onClick={()=>void clearTable()}>保存紀錄並釋枱</button>:null}');
});
edit('src/App.tsx','61f0c07d08aa56d0277f8ba787566b3872c8c863','DINING_PAYMENT_COMMAND_R2',(replace)=>{
  replace('          diningCheckout.selections,\n          tenderCode\n',`          diningCheckout.selections,
          tenderCode,
          // DINING_PAYMENT_COMMAND_R2: retain identity and snapshot through retries.
          {submissionId:diningCheckout.submissionId??'',expectedRevision:diningCheckout.expectedRevision??'',receivedMinor:received}
`);
  replace("statusLabel:updated.remainingMinor===0?'堂食已全數結帳':'堂食分項結帳完成',","statusLabel:updated.archivedAt?'堂食已付清，桌台已釋放':'堂食分項結帳完成，餘額保留',");
  replace("printStatusLabel:'堂食付款已記錄；按堂食打印規則處理',","printStatusLabel:'堂食打印尚未接通；本輪只驗證付款紀錄',");
  replace("drawerStatusLabel:method==='CASH'?'現金付款：櫃桶按現場收款路徑處理':'非現金：不開櫃桶',","drawerStatusLabel:method==='CASH'?'開櫃指令尚未接通，未發送':'非現金：不開櫃桶',");
});
console.log('DINING_R2_BOUNDED_PATCH_APPLIED');
