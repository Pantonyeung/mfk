import type {OwnerActivityRecord,OwnerStaffPresence} from './product-types';

export function humanEmployeeCode(staff:OwnerStaffPresence){
  const loginId=String(staff.loginId||'').trim();
  return loginId||null;
}

export function selectStaffAuditHistory(
  activity:readonly OwnerActivityRecord[],
  staff:OwnerStaffPresence,
){
  const staffId=String(staff.staffId||'').trim();
  if(!staffId)return Object.freeze([]) as readonly OwnerActivityRecord[];
  return Object.freeze(activity.filter(record=>
    [record.actorStaffId,record.requesterStaffId,record.approverStaffId]
      .map(value=>String(value||'').trim())
      .some(value=>value===staffId)
  ));
}
