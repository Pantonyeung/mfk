export type FormalStaffRole='STAFF'|'MANAGER'|'OWNER'|'VIEWER';
export type FormalStaffScope='STORE'|'MULTI_STORE'|'REPORT_ONLY';

export interface FormalStaff{
  id:string;
  loginId:string;
  name:string;
  role:FormalStaffRole;
  scope:FormalStaffScope;
  adminLogin:boolean;
  active:boolean;
  permissions:string[];
  hasPinVerifier:boolean;
}

export const FORMAL_STAFF_PERMISSIONS=Object.freeze([
  ['ORDER_REVIEW','查看訂單'],
  ['ORDER_CORRECTION','更正訂單／付款'],
  ['ADMIN_CONFIG','修改後台設定'],
  ['PUBLISH_CONFIG','建立設定版本'],
  ['REPORT_VIEW','查看報表'],
  ['REPORT_EXPORT','匯出報表'],
  ['STAFF_MANAGE','管理員工'],
] as const);

function row(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function list(value:unknown){return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'?value:'';}

export function readFormalStaff(snapshot:Record<string,unknown>):FormalStaff[]{
  return list(snapshot.staff).map(value=>{
    const item=row(value);
    const role:FormalStaffRole=['MANAGER','OWNER','VIEWER'].includes(String(item.role))?item.role as FormalStaffRole:'STAFF';
    const scope:FormalStaffScope=['MULTI_STORE','REPORT_ONLY'].includes(String(item.scope))?item.scope as FormalStaffScope:'STORE';
    return{
      id:text(item.id)||text(item.staffId),
      loginId:text(item.loginId),
      name:text(item.name),
      role,
      scope,
      adminLogin:item.adminLogin===true,
      active:item.active!==false,
      permissions:list(item.permissions).map(String).filter(Boolean),
      hasPinVerifier:Boolean(item.pinVerifier&&typeof item.pinVerifier==='object'&&!Array.isArray(item.pinVerifier)),
    };
  }).filter(item=>item.id);
}

export function addFormalStaff(snapshot:Record<string,unknown>,id:string){
  const staff=list(snapshot.staff);
  const next={
    id,
    loginId:'',
    name:'',
    role:'STAFF',
    scope:'STORE',
    adminLogin:false,
    active:false,
    permissions:['ORDER_REVIEW'],
  };
  return{...snapshot,staff:[...staff,next]};
}

export function patchFormalStaff(snapshot:Record<string,unknown>,staffId:string,patch:Partial<Omit<FormalStaff,'id'|'hasPinVerifier'>>){
  let found=false;
  const staff=list(snapshot.staff).map(value=>{
    const item=row(value);
    const id=text(item.id)||text(item.staffId);
    if(id!==staffId)return value;
    found=true;
    const next={...item,...patch};
    if(patch.active===true||patch.adminLogin===true){
      const hasVerifier=Boolean(item.pinVerifier&&typeof item.pinVerifier==='object'&&!Array.isArray(item.pinVerifier));
      if(!hasVerifier)throw new Error('FORMAL_STAFF_PIN_VERIFIER_REQUIRED');
    }
    return next;
  });
  if(!found)throw new Error('FORMAL_STAFF_NOT_FOUND');
  return{...snapshot,staff};
}

export function removeFormalStaff(snapshot:Record<string,unknown>,staffId:string){
  const current=readFormalStaff(snapshot).find(item=>item.id===staffId);
  if(current?.role==='OWNER'&&current.active)throw new Error('FORMAL_ACTIVE_OWNER_REMOVE_FORBIDDEN');
  return{...snapshot,staff:list(snapshot.staff).filter(value=>(text(row(value).id)||text(row(value).staffId))!==staffId)};
}

export function validateFormalStaff(snapshot:Record<string,unknown>){
  const staff=readFormalStaff(snapshot);
  const errors:string[]=[];
  const ids=new Set<string>(),loginIds=new Set<string>();
  for(const person of staff){
    if(ids.has(person.id))errors.push('Internal Staff ID 重複：'+person.id);else ids.add(person.id);
    if(!person.name.trim())errors.push('員工 '+person.id+' 未填名稱');
    if(person.loginId){
      if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(person.loginId))errors.push('登入編號格式錯誤：'+person.loginId);
      if(loginIds.has(person.loginId))errors.push('登入編號重複：'+person.loginId);else loginIds.add(person.loginId);
    }else if(person.active||person.adminLogin)errors.push('員工 '+(person.name||person.id)+' 未填登入編號');
    if((person.active||person.adminLogin)&&!person.hasPinVerifier)errors.push('員工 '+(person.name||person.id)+' 未有已發布 PIN Verifier');
  }
  return errors;
}

export const FORMAL_STAFF_AUTH_GAP=Object.freeze({
  pinChange:'V3 does not write plaintext PIN into Formal Draft. A dedicated verifier-generation/change seam is required.',
  sessionManagement:'Session/trusted-device mutation is security runtime state, not Admin config snapshot.',
});
