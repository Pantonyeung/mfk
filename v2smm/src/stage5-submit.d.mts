export type SmmStage5RepairTarget='CART'|'CHECKOUT'|'STAFF';
export interface SmmStage5RepairPath{
  readonly target:SmmStage5RepairTarget;
  readonly title:string;
  readonly detail:string;
}
export function smmStage5SubmissionShortRef(submissionId:string):string;
export function smmStage5ConfirmedDisplayCode(value:unknown):string|null;
export function smmStage5RepairPath(message:unknown):SmmStage5RepairPath;
