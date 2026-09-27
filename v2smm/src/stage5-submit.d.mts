export type SmmStage5RepairTarget='CART'|'CHECKOUT'|'STAFF';
export interface SmmStage5RepairPath{
  readonly target:SmmStage5RepairTarget;
  readonly title:string;
  readonly detail:string;
}
export type SmmStage5SharedKind='LOADING'|'EMPTY'|'OFFLINE'|'STALE'|'PARTIAL'|'UNKNOWN'|'ERROR';
export interface SmmStage5SharedState{
  readonly kind:SmmStage5SharedKind;
  readonly icon:string;
  readonly label:string;
  readonly detail:string;
}
export function smmStage5SubmissionShortRef(submissionId:string):string;
export function smmStage5ConfirmedDisplayCode(value:unknown):string|null;
export function smmStage5DisplaySuffix(value:unknown):string;
export function smmStage5SharedState(connection:string,hasSession?:boolean):SmmStage5SharedState|null;
export function smmStage5RepairPath(message:unknown):SmmStage5RepairPath;
