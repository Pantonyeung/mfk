export type SmmStage6Filter='ALL'|'TAKEAWAY'|'DINE_IN'|'ATTENTION';
export interface SmmStage6Counts{
  readonly ALL:number;
  readonly TAKEAWAY:number;
  readonly DINE_IN:number;
  readonly ATTENTION:number;
}
export interface SmmStage6ConnectionPresentation{
  readonly kind:'LOADING'|'OFFLINE'|'STALE'|'PARTIAL'|'UNKNOWN'|'ERROR';
  readonly title:string;
  readonly detail:string;
}
export const SMM_STAGE6_PRIORITY:Readonly<Record<string,number>>;
export function smmStage6Priority(state:string):number;
export function smmStage6Sort<T extends {state:string;observedAt?:string;orderTime?:string;displayCode?:string;workId?:string}>(items:readonly T[]):readonly T[];
export function smmStage6StateLabel(state:string,statusLabel?:unknown):string;
export function smmStage6ServiceKind(item:unknown):'TAKEAWAY'|'DINE_IN'|'UNKNOWN';
export function smmStage6ItemCount(item:unknown):number|null;
export function smmStage6MatchesFilter(item:any,filter:SmmStage6Filter):boolean;
export function smmStage6Counts(items:readonly any[]):SmmStage6Counts;
export function smmStage6ConnectionState(connection:string,hasRows:boolean):SmmStage6ConnectionPresentation|null;
export function smmStage6DisplayCode(item:unknown,order?:unknown):string;
export function smmStage6Source(item:unknown,order?:unknown):string;
export function smmStage6ObservedTime(item:unknown,order?:unknown):string;
