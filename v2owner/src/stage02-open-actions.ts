import type {OwnerActionItem,OwnerActivityRecord} from './product-types';

export function getActionIncidentIdentity(action:OwnerActionItem):string{
  if(action.correlationId)return 'correlation:'+action.correlationId;
  if(action.incidentId)return 'incident:'+action.incidentId;
  return 'action:'+action.actionId;
}

export function selectOpenActions(actions:readonly OwnerActionItem[]):readonly OwnerActionItem[]{
  const open=actions.filter(item=>item.state!=='RESOLVED');
  const byIncident=new Map<string,OwnerActionItem>();

  for(const action of open){
    const identity=getActionIncidentIdentity(action);
    const current=byIncident.get(identity);
    if(!current||action.observedAt>current.observedAt)byIncident.set(identity,action);
  }

  return [...byIncident.values()];
}

export function selectActionHistory(
  action:OwnerActionItem,
  activity:readonly OwnerActivityRecord[],
):readonly OwnerActivityRecord[]{
  return activity
    .filter(record=>{
      if(action.correlationId)return record.correlationId===action.correlationId;
      if(action.incidentId)return record.incidentId===action.incidentId;
      return record.linkedActionId===action.actionId;
    })
    .sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
}
