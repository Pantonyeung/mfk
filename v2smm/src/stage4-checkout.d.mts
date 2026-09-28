import type {SmmDiningTableDefinition,SmmDiningTarget,SmmServiceMode,SmmTender} from './product-types';

export const SMM_STAGE4_TENDERS:readonly Readonly<{value:SmmTender;label:string}>[];

export function smmStage4TenderLabel(value:SmmTender):string;

export function smmStage4DiningTargetStatus(
  serviceMode:SmmServiceMode,
  target:SmmDiningTarget|null,
  tables:readonly SmmDiningTableDefinition[],
):Readonly<{required:boolean;valid:boolean;label:string}>;

export function smmStage4CheckoutReady(input:{
  readonly cartLength:number;
  readonly totalMinor:number|undefined|null;
  readonly hasAttention:boolean;
  readonly tender?:SmmTender;
  readonly serviceMode:SmmServiceMode;
  readonly diningTargetValid:boolean;
}):boolean;
