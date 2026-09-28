import type {SmmCartComboIntent,SmmCartLine,SmmCartRefreshAttention,SmmCartSelection} from './product-types';

export function smmLineTotalMinor(publishedUnitPriceMinor:number|undefined,quantity:number):number|null;

export function buildSmmCartRefreshAttention(input:{
  readonly menuRevision:string;
  readonly oldPublishedUnitPriceMinor?:number;
  readonly proposedPublishedUnitPriceMinor?:number;
  readonly proposedSelections?:readonly SmmCartSelection[];
  readonly proposedCombo?:SmmCartComboIntent;
  readonly configChanged:boolean;
  readonly canAccept:boolean;
  readonly detectedAt:string;
}):SmmCartRefreshAttention|null;

export function sameSmmCartRefreshAttention(
  left:SmmCartRefreshAttention|undefined|null,
  right:SmmCartRefreshAttention|undefined|null,
):boolean;

export function acceptSmmCartRefresh(
  cart:readonly SmmCartLine[],
  lineId:string,
):Readonly<{accepted:boolean;cart:readonly SmmCartLine[]}>;
