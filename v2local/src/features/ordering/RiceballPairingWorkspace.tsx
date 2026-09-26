import {useEffect,useMemo,useState} from 'react';
import type {SyncedCombo,SyncedComboPool} from '../../runtime/admin-config-projection.ts';
import {
  DrinkSupplementWorkspace,
  type WorkspaceCartLine,
  type WorkspaceDrinkSupplementChoice,
  type WorkspaceProduct,
} from './OrderingCenterWorkspaces.tsx';
import {
  buildRiceballPairingDraft,
  existingPairingGroups,
  pairingAssignmentsFromDraft,
  pairingGroupFromDetail,
  pairingPriceForAssignment,
  pairingRoleFromDetail,
  nextPairingStartIndex,
  standalonePriceForLine,
  swapPairingSnack,
} from './riceball-pairing-model.ts';
import './riceball-pairing-workspace.css';

const money=(minor:number)=>(minor<0?'-':'')+String.fromCharCode(36)+(Math.abs(minor)/100).toFixed(2);

export function RiceballPairingWorkspace({
  cart,products,combos,pools,blockedLineIds,
  onApply,onRestore,
  drinkChoices,onAddDrink,onConfigureDrink,
}:{
  cart:readonly (WorkspaceCartLine&{readonly serviceMode:'takeaway'|'dine-in'})[];
  products:readonly WorkspaceProduct[];
  combos:readonly SyncedCombo[];
  pools:readonly SyncedComboPool[];
  blockedLineIds:ReadonlySet<string>;
  onApply:(assignments:Readonly<Record<string,string|undefined>>)=>void;
  onRestore:(label:string)=>void;
  drinkChoices:readonly WorkspaceDrinkSupplementChoice[];
  onAddDrink:(choiceId:string,qty:number,targetLineId?:string)=>void;
  onConfigureDrink:(choiceId:string,qty:number,targetLineId?:string)=>void;
}){
  const existing=existingPairingGroups(cart);
  const startIndex=nextPairingStartIndex(cart);
  const draft=useMemo(
    ()=>buildRiceballPairingDraft(cart,products,combos,pools,blockedLineIds,startIndex),
    [cart,products,combos,pools,blockedLineIds,startIndex],
  );
  const draftKey=draft.slots.map(slot=>slot.id+':'+(slot.defaultSnackUnitId??'')).join('|')+'//'+draft.snacks.map(snack=>snack.id).join('|');
  const [assignments,setAssignments]=useState<Record<string,string|undefined>>(()=>({...pairingAssignmentsFromDraft(draft)}));
  const [activeSlotId,setActiveSlotId]=useState(draft.slots[0]?.id??'');
  useEffect(()=>{
    setAssignments({...pairingAssignmentsFromDraft(draft)});
    setActiveSlotId(draft.slots[0]?.id??'');
  },[draftKey]);

  const activeSlot=draft.slots.find(slot=>slot.id===activeSlotId)??draft.slots[0];
  const assignedSnackIds=new Set(Object.values(assignments).filter((id):id is string=>Boolean(id)));
  const pairCount=draft.slots.filter(slot=>Boolean(assignments[slot.id])).length;
  const mainLineIds=new Set(draft.slots.map(slot=>slot.main.lineId));
  const drinkTargetCart=cart.filter(line=>mainLineIds.has(line.id)||pairingRoleFromDetail(line.detail)==='MAIN');

  const snackOwner=(snackId:string)=>{
    const slot=draft.slots.find(row=>assignments[row.id]===snackId);
    return slot?.label;
  };

  return <div className="riceball-pairing-workspace">
    <header className="pairing-title">
      <div><small>ADMIN COMBO PAIRING</small><h2>飯團待組區</h2><p>按落單次序先 A↔A、B↔B、C↔C；客人指定時撳另一個小食即時交換。剩低主餐／小食保持單點。</p></div>
      <strong>{pairCount} 組可建立</strong>
    </header>

    {existing.length?<section className="pairing-existing">
      <header><b>已建立套餐</b><span>{existing.length} 組</span></header>
      <div>{existing.map(label=>{
        const rows=cart.filter(line=>pairingGroupFromDetail(line.detail)===label);
        return <article key={label}>
          <div><b>{label} 組</b><span>{rows.map(line=>line.name).join(' + ')}</span></div>
          <strong>{money(rows.reduce((sum,line)=>sum+line.unitMinor*line.qty,0))}</strong>
          <button type="button" onClick={()=>onRestore(label)}>拆回單點</button>
        </article>;
      })}</div>
    </section>:null}

    {draft.slots.length?<div className="pairing-layout">
      <section className="pairing-slots">
        <header><b>主餐組別</b><span>{draft.slots.length} 個飯團／主餐</span></header>
        {draft.slots.map(slot=>{
          const snackId=assignments[slot.id];
          const snack=snackId?draft.snacks.find(row=>row.id===snackId):undefined;
          const price=pairingPriceForAssignment(cart,products,combos,pools,draft,slot.id,snackId);
          const sourceLine=cart.find(line=>line.id===slot.main.lineId);
          return <button type="button" key={slot.id} className={'pairing-slot-card'+(activeSlot?.id===slot.id?' active':'')} onClick={()=>setActiveSlotId(slot.id)}>
            <strong>{slot.label} 組</strong>
            <div><b>{slot.main.name}</b><small>{slot.comboName} · 套餐底 {money(slot.comboBaseMinor)}</small></div>
            <div className="pairing-slot-snack"><span>{snack?.name??'未配小食／保持單點'}</span>{price?<em>{price.snackAdjustmentMinor===0?'小食免費':(price.snackAdjustmentMinor>0?'+':'')+money(price.snackAdjustmentMinor)}</em>:null}</div>
            <b className="pairing-slot-price">{price?money(price.totalMinor):money(sourceLine?standalonePriceForLine(sourceLine,products):0)}</b>
          </button>;
        })}
      </section>

      <section className="pairing-snacks">
        <header><b>小食 List</b><span>撳一下配去 {activeSlot?.label??'—'} 組；已配小食會同原有小食交換</span></header>
        <div>{draft.snacks.map(snack=>{
          const owner=snackOwner(snack.id);
          const compatible=Boolean(activeSlot?.compatibleSnackUnitIds.includes(snack.id));
          return <button
            type="button"
            key={snack.id}
            disabled={!activeSlot||!compatible}
            className={owner?'assigned':''}
            onClick={()=>{
              if(!activeSlot)return;
              setAssignments(current=>({...swapPairingSnack(draft,current,activeSlot.id,snack.id)}));
            }}
          >
            <b>{snack.name}</b>
            <span>{owner?owner+' 組':'單點'}</span>
          </button>;
        })}</div>
        <footer>
          <span>未配小食 {draft.snacks.filter(snack=>!assignedSnackIds.has(snack.id)).length} 件；未有小食嘅主餐會保持單點。</span>
          <button type="button" disabled={!pairCount} onClick={()=>onApply(assignments)}>建立 {pairCount} 組套餐</button>
        </footer>
      </section>
    </div>:<div className="pairing-empty"><b>目前冇可配對飯團／主餐</b><span>只會按 Admin Combo Main Pool / Snack Pool Product ID 判斷，唔靠名稱估。</span></div>}

    <section className="pairing-drink">
      <header><b>飲品</b><span>沿用 A3c：可跳過，冇揀唔改價</span></header>
      <DrinkSupplementWorkspace
        cart={drinkTargetCart}
        choices={drinkChoices}
        onAdd={onAddDrink}
        onConfigure={onConfigureDrink}
      />
    </section>
  </div>;
}
