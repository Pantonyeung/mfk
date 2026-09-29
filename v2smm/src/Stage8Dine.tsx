import {useMemo,useState} from 'react';
import type {SmmConnectionState,SmmDineSession,SmmDiningTableDefinition} from './product-types';
import {StageXState} from './StageXState';

type Filter='ALL'|'OCCUPIED'|'EMPTY'|'WAITING';
type Surface='OVERVIEW'|'DETAIL'|'WAITING'|'CLEAR';
type Row={key:string;table:SmmDiningTableDefinition|null;label:string;session:SmmDineSession|null;custody:boolean};

const isWaiting=(s:SmmDineSession)=>String(s.state||'').toUpperCase().includes('WAIT')||String(s.tableLabel||'').includes('輪候');
const money=(v:number|undefined)=>Number.isFinite(Number(v))?'HK$'+(Number(v)/100).toFixed(2):'—';
const time=(v:string|undefined)=>{const d=new Date(v||'');return Number.isFinite(d.getTime())?d.toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false}):'—'};
const elapsed=(v:string|undefined)=>{const n=Math.max(0,Math.floor((Date.now()-new Date(v||'').getTime())/60000));return Number.isFinite(n)?(n<60?n+' 分鐘':Math.floor(n/60)+' 小時 '+n%60+' 分'):'—'};

export function Stage8DineView({connection,sessions,tables,onStartOrder,onStartWaiting,onRefresh}:{
  connection:SmmConnectionState;
  sessions:readonly SmmDineSession[];
  tables:readonly SmmDiningTableDefinition[];
  onStartOrder:(table:SmmDiningTableDefinition,covers:number)=>void;
  onStartWaiting:(covers:number)=>void;
  onRefresh:()=>Promise<void>|void;
}){
  const [filter,setFilter]=useState<Filter>('ALL');
  const [surface,setSurface]=useState<Surface>('OVERVIEW');
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [covers,setCovers]=useState(2);
  const waiting=useMemo(()=>sessions.filter(isWaiting),[sessions]);
  const rows=useMemo<Row[]>(()=>{
    const active=sessions.filter(s=>!isWaiting(s));
    const used=new Set<string>();
    const result:Row[]=tables.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(table=>{
      const session=active.find(s=>s.tableLabel===table.label)||null;
      if(session)used.add(session.sessionId);
      return {key:'table:'+table.tableId,table,label:table.label,session,custody:false};
    });
    active.forEach(session=>{if(!used.has(session.sessionId))result.push({key:'custody:'+session.sessionId,table:null,label:session.tableLabel||'已停用枱',session,custody:true})});
    return result;
  },[sessions,tables]);
  const occupied=rows.filter(r=>Boolean(r.session)).length;
  const empty=rows.filter(r=>!r.session).length;
  const selected=selectedKey?rows.find(r=>r.key===selectedKey)||null:null;
  const visible=filter==='ALL'?rows:filter==='EMPTY'?rows.filter(r=>!r.session):filter==='OCCUPIED'?rows.filter(r=>Boolean(r.session)):[];
  const open=(row:Row)=>{setSelectedKey(row.key);setCovers(row.session?.covers||2);setSurface('DETAIL')};

  if(surface==='WAITING')return <section className="stage8-page stage8-subscreen" data-stage8-visual="8.4_WAITING">
    <header className="stage8-subheader"><button onClick={()=>setSurface('OVERVIEW')} aria-label="返回堂食總覽">‹</button><div><strong>輪候管理</strong><small>{waiting.length} 組等候中</small></div><button className="stage8-text-button" onClick={()=>void onRefresh()}>更新</button></header>
    <div className="stage8-wait-tabs"><button className="active">輪候中 <b>{waiting.length}</b></button><button disabled>已安排</button></div>
    {waiting.length?<div className="stage8-wait-list">{waiting.map((s,i)=><article className="stage8-wait-card" key={s.sessionId}><div className="stage8-wait-code"><strong>{'W'+String(i+1).padStart(3,'0')}</strong><span>{s.covers} 位</span></div><div className="stage8-wait-copy"><strong>{s.itemSummary||'堂食輪候'}</strong><span>已等候 {elapsed(s.openedAt)} · {time(s.openedAt)} 登記</span><small>座位安排請喺收銀機處理</small></div><button disabled>安排餐枱</button></article>)}</div>:<StageXState kind="EMPTY" title="暫時冇輪候" detail="有堂食輪候時會喺呢度顯示。"/>}
    <section className="stage8-new-wait"><div><strong>新增輪候點單</strong><span>記低人數後進入正常點單流程。</span></div><Stepper value={covers} setValue={setCovers}/><button className="stage8-primary" disabled={connection!=='READY'} onClick={()=>onStartWaiting(covers)}>加入輪候後點單</button></section>
  </section>;

  if(surface==='CLEAR'&&selected?.session){
    const s=selected.session;
    const paid=s.remainingMinor===0;
    const itemClear=Boolean(s.lines?.length)&&s.lines!.every(line=>line.remainingQty===0);
    const completed=/CLOSE|COMPLETE/i.test(String(s.state));
    return <section className="stage8-page stage8-subscreen" data-stage8-visual="8.5_CLEAR_REVIEW">
      <header className="stage8-subheader"><button onClick={()=>setSurface('DETAIL')} aria-label="返回餐枱詳情">‹</button><div><strong>清枱前檢查</strong><small>{selected.label}</small></div><span/></header>
      <div className="stage8-clear-art" aria-hidden="true"><Stage8ActionIcon slot="STAGE8_CLEAR_ICON"/></div>
      <div className="stage8-clear-copy"><h2>確認餐枱可以交回使用？</h2><p>以下資料只作核對。清枱操作目前仍要喺收銀機完成。</p></div>
      <div className="stage8-checklist"><Check ok={completed} label="訂單已完成"/><Check ok={paid} label="款項已處理"/><Check ok={itemClear} label="沒有未處理項目"/><Check ok={false} label="餐枱可重新使用" pending="完成清枱後確認"/></div>
      <footer className="stage8-footer"><button onClick={()=>setSurface('DETAIL')}>返回</button><button className="stage8-primary" disabled>確認清枱</button><small>手機暫未開放清枱操作</small></footer>
    </section>;
  }

  if(surface==='DETAIL'&&selected){
    const s=selected.session;
    return <section className="stage8-page stage8-subscreen" data-stage8-visual="8.2_TABLE_DETAIL">
      <header className="stage8-subheader"><button onClick={()=>setSurface('OVERVIEW')} aria-label="返回堂食總覽">‹</button><div><strong>{selected.label}</strong><small>{s?s.covers+' 位 · 開枱 '+time(s.openedAt):'空枱'}</small></div><span className={'stage8-table-status '+(selected.custody?'custody':s?'occupied':'empty')}>{selected.custody?'已停用 · 使用中':s?'使用中':'空枱'}</span></header>
      {selected.custody?<StageXState compact kind="PARTIAL" title="餐枱已不在現行設定" detail="進行中記錄會保留至完成，避免遺失資料。"/>:null}
      <section className="stage8-detail-actions"><ActionSlot name={s?'加單':'開始點單'} note={s?'繼續加入商品':'選好人數後點單'} slot="STAGE8_ADD_ORDER_ICON" disabled={!selected.table||connection!=='READY'} onClick={()=>selected.table&&onStartOrder(selected.table,s?.covers||covers)}/><ActionSlot name="結帳" note="請到收銀機處理" slot="STAGE8_CHECKOUT_ICON" disabled/><ActionSlot name="清枱檢查" note="只讀核對" slot="STAGE8_CLEAR_ICON" disabled={!s} onClick={()=>s&&setSurface('CLEAR')}/></section>
      {!s&&selected.table?<section className="stage8-covers-card"><div><strong>用餐人數</strong><span>開始點單前記低今次人數</span></div><Stepper value={covers} setValue={setCovers}/><button className="stage8-primary" disabled={connection!=='READY'} onClick={()=>onStartOrder(selected.table!,covers)}>前往點單</button></section>:null}
      {s?<><section className="stage8-info-strip"><span>開枱 {time(s.openedAt)}</span><span>已使用 {elapsed(s.openedAt)}</span><span>{s.covers} 位</span></section><section className="stage8-items-card"><h2>已點餐點</h2>{s.lines?.length?s.lines.map(line=><div className="stage8-item-line" key={line.lineIndex}><div><strong>{line.name}</strong><small>{line.qty} 件 · 未結 {line.remainingQty}</small></div><b>{money(line.unitMinor*line.qty)}</b></div>):<p>{s.itemSummary||'暫時未有商品明細'}</p>}</section><section className="stage8-money-card"><div><span>餐枱總額</span><strong>{money(s.totalMinor)}</strong></div><div><span>已結</span><strong>{money(s.paidMinor)}</strong></div><div className="due"><span>未結</span><strong>{money(s.remainingMinor)}</strong></div></section><button className="stage8-clear-review" onClick={()=>setSurface('CLEAR')}>查看清枱前檢查</button></>:null}
    </section>;
  }

  return <section className="stage8-page" data-stage8-visual="8.1_OVERVIEW">
    <header className="stage8-header"><div><span>堂食</span><h1>餐枱總覽</h1><small>門店餐枱、使用狀態同輪候一眼睇清</small></div><button onClick={()=>void onRefresh()}>更新</button></header>
    {connection==='LOADING'?<StageXState compact kind="LOADING" title="正在更新堂食資料"/>:connection==='NOT_CONNECTED'?<StageXState compact kind="OFFLINE" title="堂食資料暫時離線"/>:connection==='ERROR'?<StageXState compact kind="ERROR" title="堂食資料暫時未能更新" onPrimary={()=>void onRefresh()}/>:null}
    <section className="stage8-summary"><div><small>使用中</small><strong>{occupied}</strong></div><div><small>空枱</small><strong>{empty}</strong></div><div><small>輪候</small><strong>{waiting.length}</strong></div></section>
    <div className="stage8-filters">{([['ALL','全部',rows.length+waiting.length],['OCCUPIED','使用中',occupied],['EMPTY','空枱',empty],['WAITING','輪候',waiting.length]] as const).map(([v,l,n])=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{l}<b>{n}</b></button>)}</div>
    {filter==='WAITING'?<div className="stage8-wait-preview">{waiting.length?waiting.map((s,i)=><button key={s.sessionId} onClick={()=>setSurface('WAITING')}><strong>{'W'+String(i+1).padStart(3,'0')}</strong><span>{s.covers} 位 · 已等候 {elapsed(s.openedAt)}</span><small>{s.itemSummary||'等待安排餐枱'}</small></button>):<StageXState kind="EMPTY" title="暫時冇輪候"/>}<button className="stage8-primary" onClick={()=>setSurface('WAITING')}>管理輪候</button></div>:visible.length?<div className="stage8-table-grid">{visible.map(r=><button key={r.key} className={'stage8-table-card '+(r.custody?'custody':r.session?'occupied':'empty')} onClick={()=>open(r)}><span className="stage8-table-top"><strong>{r.label}</strong><em>{r.custody?'保留中':r.session?'使用中':'空枱'}</em></span>{r.session?<><span>{r.session.covers} 位 · {elapsed(r.session.openedAt)}</span><small>{r.session.itemSummary||'堂食進行中'}</small><b>{money(r.session.totalMinor)}</b></>:<><span>可開始新堂食單</span><small>點入揀人數</small><b>＋ 點單</b></>}</button>)}</div>:<StageXState kind="EMPTY" title="目前冇符合條件嘅餐枱" detail="轉換篩選條件再睇。"/>}
    <button className="stage8-wait-entry" onClick={()=>setSurface('WAITING')}><span>輪候管理</span><b>{waiting.length}</b><small>查看等候中客人及新增輪候點單</small></button>
  </section>;
}

function Stage8ActionIcon({slot}:{slot:string}){
  const common={viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  if(slot==='STAGE8_ADD_ORDER_ICON')return <svg {...common}><path d="M5 4h10v16H5zM8 8h4M8 12h4"/><path d="M18 10v8M14 14h8"/></svg>;
  if(slot==='STAGE8_CHECKOUT_ICON')return <svg {...common}><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6"/></svg>;
  return <svg {...common}><path d="M14 3l-2 8M10 11l-5 8M12 11l5 8M7 16h8"/></svg>;
}

function Stepper({value,setValue}:{value:number;setValue:(value:number)=>void}){return <div className="stage8-stepper"><button onClick={()=>setValue(Math.max(1,value-1))}>−</button><b>{value} 位</b><button onClick={()=>setValue(Math.min(30,value+1))}>＋</button></div>}
function Check({ok,label,pending}:{ok:boolean;label:string;pending?:string}){return <div className={ok?'ok':'pending'}><span/><strong>{label}</strong><small>{ok?'已符合':pending||'待確認'}</small></div>}
function ActionSlot({name,note,slot,disabled,onClick}:{name:string;note:string;slot:string;disabled?:boolean;onClick?:()=>void}){return <button type="button" className="stage8-action-card" disabled={disabled} onClick={onClick}><span className="stage8-action-slot" aria-hidden="true"><Stage8ActionIcon slot={slot}/></span><strong>{name}</strong><small>{note}</small></button>}
