import {selectActionHistory,selectOpenActions} from './stage02-open-actions';
import type {
  OwnerActionItem,
  OwnerActivityRecord,
  OwnerReadModelSnapshot,
} from './product-types';

export interface OwnerActionQueueRowViewModel {
  readonly action:OwnerActionItem;
  readonly ownerDomain:string;
  readonly elapsedLabel:string;
  readonly safeNextStepLabel:string|null;
  readonly state:'OPEN'|'PENDING_READBACK'|'UNKNOWN';
}

export interface OwnerActionQueueViewModel {
  readonly openCount:number;
  readonly urgentCount:number;
  readonly attentionCount:number;
  readonly infoCount:number;
  readonly rows:readonly OwnerActionQueueRowViewModel[];
}

export interface OwnerActionDetailViewModel {
  readonly row:OwnerActionQueueRowViewModel;
  readonly history:readonly OwnerActivityRecord[];
}

const severityRank:Record<OwnerActionItem['severity'],number>={
  URGENT:3,
  ATTENTION:2,
  INFO:1,
};

function normalizeState(item:OwnerActionItem):OwnerActionQueueRowViewModel['state']{
  if(item.state==='PENDING_READBACK')return 'PENDING_READBACK';
  if(item.state==='UNKNOWN')return 'UNKNOWN';
  return 'OPEN';
}

export function buildOwnerActionQueueViewModel(snapshot:OwnerReadModelSnapshot|null):OwnerActionQueueViewModel{
  const open=selectOpenActions(snapshot?.actions??[])
    .map(action=>({
      action,
      ownerDomain:action.ownerDomain??action.domain,
      elapsedLabel:action.elapsedLabel??'未有讀回',
      safeNextStepLabel:action.safeNextStepLabel??action.actionLabel??null,
      state:normalizeState(action),
    }))
    .sort((a,b)=>severityRank[b.action.severity]-severityRank[a.action.severity]||a.action.observedAt.localeCompare(b.action.observedAt));

  return {
    openCount:open.length,
    urgentCount:open.filter(row=>row.action.severity==='URGENT').length,
    attentionCount:open.filter(row=>row.action.severity==='ATTENTION').length,
    infoCount:open.filter(row=>row.action.severity==='INFO').length,
    rows:open,
  };
}

export function buildOwnerActionDetailViewModel(
  row:OwnerActionQueueRowViewModel,
  activity:readonly OwnerActivityRecord[],
):OwnerActionDetailViewModel{
  const history=selectActionHistory(row.action,activity);
  return {row,history};
}
