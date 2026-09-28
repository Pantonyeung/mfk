import {readAdminSnapshotSection} from './admin-config-sync.ts';
import {readActiveStaffSession,staffAuthRequired} from './staff-auth.ts';
import {queueCashOpeningProjection} from './projection-outbox.ts';
import {
  createLocalCashOpening,
  latestCashOpeningForBusinessDate,
  readLocalCashOpenings,
  readLocalDayCloses,
  resolveBusinessWindow,
  suggestOpeningCashFromPreviousClose,
  writeLocalCashOpenings,
  type LocalCashOpening,
} from './local-operations.ts';

const listeners=new Set<()=>void>();
function emit(){for(const listener of listeners)listener();}

export interface CurrentCashOpeningState{
  readonly businessDate:string;
  readonly opening:LocalCashOpening|null;
  readonly suggestion:{
    readonly amountMinor:number;
    readonly sourceCloseId:string;
    readonly sourceCloseBusinessDate:string;
    readonly previousCountedCashMinor:number;
    readonly previousCashRemovedMinor:number;
  }|null;
}

export function subscribeCashOpening(listener:()=>void){
  listeners.add(listener);
  return()=>listeners.delete(listener);
}

export function readBusinessCutoff(){
  const config=readAdminSnapshotSection<{cutoff?:string}>('businessDay');
  const value=String(config?.cutoff??'05:00');
  const match=value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return match?{hour:Number(match[1]),minute:Number(match[2])}:{hour:5,minute:0};
}

function businessDateAt(now=Date.now()){
  const cutoff=readBusinessCutoff();
  return resolveBusinessWindow(now,cutoff.hour,cutoff.minute).businessDate;
}

export function readCurrentCashOpeningState(now=Date.now()):CurrentCashOpeningState{
  const businessDate=businessDateAt(now);
  return Object.freeze({
    businessDate,
    opening:latestCashOpeningForBusinessDate(businessDate,readLocalCashOpenings()),
    suggestion:suggestOpeningCashFromPreviousClose(businessDate,readLocalDayCloses()),
  });
}

export function cashOpeningRequired(now=Date.now()){
  if(staffAuthRequired()&&!readActiveStaffSession())return false;
  return !readCurrentCashOpeningState(now).opening;
}

export function confirmCashOpening(input:{
  readonly amountMinor:number;
  readonly note?:string;
  readonly now?:number;
}){
  const now=input.now??Date.now();
  const state=readCurrentCashOpeningState(now);
  if(state.opening)return state.opening;
  const session=readActiveStaffSession();
  const row=createLocalCashOpening({
    businessDate:state.businessDate,
    amountMinor:input.amountMinor,
    suggestion:state.suggestion,
    now,
    staffId:session?.staffId,
    staffName:session?.displayName,
    note:input.note,
  });
  const rows=readLocalCashOpenings();
  writeLocalCashOpenings([row,...rows.filter(item=>item.businessDate!==row.businessDate)]);
  queueCashOpeningProjection(row);
  emit();
  return row;
}
