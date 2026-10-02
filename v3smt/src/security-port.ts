import type {RuntimeStaffIdentity} from '../../contracts/staff-auth-v1.ts';
import type {
  MfpStoreKernelCommandEnvelope,
  MfpStoreKernelPort,
  MfpStoreKernelResult,
} from './store-kernel-port.ts';

export type MfpDeviceClass='PAD'|'MOBILE';
export type MfpDeviceStatus='AUTHORIZED'|'REVOKED'|'UNKNOWN';
export type MfpStaffSessionState='AUTHENTICATED'|'EXPIRED'|'REVOKED'|'UNAUTHORIZED'|'UNKNOWN';
export type MfpStaffRole=RuntimeStaffIdentity['role'];
export type MfpStaffScope=RuntimeStaffIdentity['scope'];

export const MFP_STAFF_SESSION_MAX_LIFETIME_MS=12*60*60*1000;

export interface MfpDeviceIdentity{
  readonly deviceId:string;
  readonly storeId:string;
  readonly deviceClass:MfpDeviceClass;
  readonly installationId:string;
  readonly createdAt:string;
  readonly lastSeenAt:string;
  readonly status:MfpDeviceStatus;
}

export interface MfpStaffSession{
  readonly state:MfpStaffSessionState;
  readonly staffSessionRef:string;
  readonly staffId:string;
  readonly displayName:string;
  readonly role:MfpStaffRole;
  readonly scope:MfpStaffScope;
  readonly permissions:readonly string[];
  readonly issuedAt:string;
  readonly expiresAt:string;
  readonly deviceId:string;
  readonly storeId:string;
  readonly sessionRevision?:string|number;
}

export interface MfpDeviceMetadataStore{
  read(storeId:string,deviceClass:MfpDeviceClass):Promise<MfpDeviceIdentity|undefined>;
  write(device:MfpDeviceIdentity):Promise<void>;
}

export type MfpStaffLoginResult=
  |Readonly<{state:'AUTHENTICATED';session:MfpStaffSession}>
  |Readonly<{state:'EXPIRED'|'REVOKED'|'UNAUTHORIZED'|'UNKNOWN'}>;

export interface MfpSecurityAuthority{
  readDeviceAuthorization(device:MfpDeviceIdentity):Promise<MfpDeviceIdentity>;
  loginStaff(input:Readonly<{staffId:string;proof:string;deviceId:string;storeId:string}>):Promise<MfpStaffLoginResult>;
  readStaffSession(input:Readonly<{staffSessionRef:string;deviceId:string;storeId:string}>):Promise<MfpStaffSession>;
  logoutStaff(input:Readonly<{staffSessionRef:string;deviceId:string;storeId:string}>):Promise<void>;
}

type UnboundCommand=Omit<MfpStoreKernelCommandEnvelope,'deviceId'|'staffSessionRef'>;

export interface MfpSecurityPort{
  getSnapshot():Readonly<{
    device:MfpDeviceIdentity|null;
    session:MfpStaffSession|null;
    sessionState:MfpStaffSessionState;
  }>;
  loadDevice():Promise<MfpDeviceIdentity>;
  refreshDeviceAuthorization():Promise<MfpDeviceIdentity>;
  loginStaff(staffId:string,proof:string):Promise<MfpStaffLoginResult>;
  refreshStaffSession():Promise<MfpStaffSessionState>;
  logoutStaff():Promise<void>;
  precheckAction(requiredPermission:string):void;
  submitFormalCommand(command:UnboundCommand,requiredPermission:string):Promise<MfpStoreKernelResult>;
}

export function isMfpFrontlineSessionEligible(
  snapshot:ReturnType<MfpSecurityPort['getSnapshot']>,
  now=Date.now(),
){
  const {device,session,sessionState}=snapshot;
  return device?.status==='AUTHORIZED'
    &&sessionState==='AUTHENTICATED'
    &&session?.state==='AUTHENTICATED'
    &&session.deviceId===device.deviceId
    &&session.storeId===device.storeId
    &&Date.parse(session.expiresAt)>now;
}

function text(value:unknown,code:string,max=240){
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max)throw new Error(code);
  return value;
}

function timestamp(value:unknown,code:string){
  text(value,code);
  const parsed=Date.parse(value as string);
  if(!Number.isFinite(parsed))throw new Error(code);
  return parsed;
}

function validateDevice(value:MfpDeviceIdentity,expected:{storeId:string;deviceClass:MfpDeviceClass},code='MFP_DEVICE_IDENTITY_INVALID'){
  text(value.deviceId,code);
  text(value.installationId,code);
  if(value.storeId!==expected.storeId||value.deviceClass!==expected.deviceClass)throw new Error(code);
  timestamp(value.createdAt,code);
  timestamp(value.lastSeenAt,code);
  if(!['AUTHORIZED','REVOKED','UNKNOWN'].includes(value.status))throw new Error(code);
  return Object.freeze({...value});
}

function validateSession(value:MfpStaffSession,device:MfpDeviceIdentity){
  if(!['AUTHENTICATED','EXPIRED','REVOKED','UNAUTHORIZED','UNKNOWN'].includes(value.state))throw new Error('MFP_STAFF_SESSION_INVALID');
  text(value.staffSessionRef,'MFP_STAFF_SESSION_INVALID');
  text(value.staffId,'MFP_STAFF_SESSION_INVALID');
  text(value.displayName,'MFP_STAFF_SESSION_INVALID');
  if(!['STAFF','MANAGER','OWNER','VIEWER'].includes(value.role))throw new Error('MFP_STAFF_SESSION_INVALID');
  if(!['STORE','MULTI_STORE','REPORT_ONLY'].includes(value.scope))throw new Error('MFP_STAFF_SESSION_INVALID');
  if(value.deviceId!==device.deviceId||value.storeId!==device.storeId)throw new Error('MFP_STAFF_SESSION_CONTEXT_MISMATCH');
  const issuedAt=timestamp(value.issuedAt,'MFP_STAFF_SESSION_INVALID');
  const expiresAt=timestamp(value.expiresAt,'MFP_STAFF_SESSION_INVALID');
  if(expiresAt<=issuedAt||expiresAt-issuedAt>MFP_STAFF_SESSION_MAX_LIFETIME_MS)throw new Error('MFP_STAFF_SESSION_LIFETIME_INVALID');
  if(!Array.isArray(value.permissions)||value.permissions.some(permission=>typeof permission!=='string'||!permission.trim()))throw new Error('MFP_STAFF_SESSION_INVALID');
  return Object.freeze({...value,permissions:Object.freeze([...new Set(value.permissions)])});
}

function effectiveSessionState(value:MfpStaffSession,now:string):MfpStaffSessionState{
  return value.state==='AUTHENTICATED'&&Date.parse(value.expiresAt)<=Date.parse(now)?'EXPIRED':value.state;
}

export function createMfpSecurityPort(input:{
  readonly storeId:string;
  readonly deviceClass:MfpDeviceClass;
  readonly metadataStore:MfpDeviceMetadataStore;
  readonly authority:MfpSecurityAuthority;
  readonly storeKernel?:MfpStoreKernelPort;
  readonly now?:()=>string;
  readonly randomUUID?:()=>string;
}):MfpSecurityPort{
  text(input.storeId,'MFP_DEVICE_STORE_ID_INVALID');
  const now=input.now??(()=>new Date().toISOString());
  const randomUUID=input.randomUUID??(()=>crypto.randomUUID());
  let device:MfpDeviceIdentity|undefined;
  let session:MfpStaffSession|undefined;
  let sessionState:MfpStaffSessionState='UNAUTHORIZED';

  const persistIdentity=async(value:MfpDeviceIdentity)=>{
    await input.metadataStore.write(Object.freeze({...value,status:'UNKNOWN'}));
  };

  const requireDevice=()=>{
    if(!device)throw new Error('MFP_DEVICE_IDENTITY_REQUIRED');
    return device;
  };

  const precheck=(requiredPermission:string)=>{
    const currentDevice=requireDevice();
    if(currentDevice.status==='REVOKED')throw new Error('MFP_DEVICE_REVOKED');
    if(currentDevice.status!=='AUTHORIZED')throw new Error('MFP_DEVICE_UNKNOWN');
    if(!session){
      if(sessionState==='EXPIRED')throw new Error('MFP_STAFF_SESSION_EXPIRED');
      if(sessionState==='REVOKED')throw new Error('MFP_STAFF_SESSION_REVOKED');
      if(sessionState==='UNKNOWN')throw new Error('MFP_STAFF_SESSION_UNKNOWN');
      if(sessionState==='UNAUTHORIZED')throw new Error('MFP_STAFF_SESSION_UNAUTHORIZED');
      throw new Error('MFP_STAFF_SESSION_REQUIRED');
    }
    if(Date.parse(session.expiresAt)<=Date.parse(now())){
      session=undefined;
      sessionState='EXPIRED';
      throw new Error('MFP_STAFF_SESSION_EXPIRED');
    }
    if(session.state==='REVOKED')throw new Error('MFP_STAFF_SESSION_REVOKED');
    if(session.state!=='AUTHENTICATED')throw new Error('MFP_STAFF_SESSION_UNAUTHORIZED');
    if(session.deviceId!==currentDevice.deviceId)throw new Error('MFP_STAFF_SESSION_DEVICE_MISMATCH');
    if(session.storeId!==currentDevice.storeId)throw new Error('MFP_STAFF_SESSION_STORE_MISMATCH');
    text(requiredPermission,'MFP_REQUIRED_PERMISSION_INVALID',160);
    if(!session.permissions.includes(requiredPermission))throw new Error('MFP_PERMISSION_DENIED');
    return {currentDevice,currentSession:session};
  };

  return Object.freeze({
    getSnapshot(){
      return Object.freeze({device:device??null,session:session??null,sessionState});
    },
    async loadDevice(){
      const seenAt=now();
      const stored=await input.metadataStore.read(input.storeId,input.deviceClass);
      device=stored
        ?validateDevice({...stored,lastSeenAt:seenAt,status:'UNKNOWN'},input)
        :validateDevice({
          deviceId:`MFP-${input.deviceClass}-${randomUUID()}`,
          storeId:input.storeId,
          deviceClass:input.deviceClass,
          installationId:`MFP-INSTALLATION-${randomUUID()}`,
          createdAt:seenAt,
          lastSeenAt:seenAt,
          status:'UNKNOWN',
        },input);
      await persistIdentity(device);
      return device;
    },
    async refreshDeviceAuthorization(){
      const current=requireDevice();
      try{
        device=validateDevice(await input.authority.readDeviceAuthorization(current),input,'MFP_DEVICE_AUTHORIZATION_INVALID');
        if(device.deviceId!==current.deviceId||device.installationId!==current.installationId)throw new Error('MFP_DEVICE_AUTHORIZATION_IDENTITY_MISMATCH');
        await persistIdentity(device);
        return device;
      }catch(error){
        device=Object.freeze({...current,lastSeenAt:now(),status:'UNKNOWN'});
        try{await persistIdentity(device);}catch{/* In-memory UNKNOWN still fails closed. */}
        throw error;
      }
    },
    async loginStaff(staffId:string,proof:string){
      const current=requireDevice();
      if(current.status!=='AUTHORIZED')throw new Error(current.status==='REVOKED'?'MFP_DEVICE_REVOKED':'MFP_DEVICE_UNKNOWN');
      text(staffId,'MFP_STAFF_ID_INVALID');
      text(proof,'MFP_STAFF_PROOF_INVALID');
      const result=await input.authority.loginStaff({staffId,proof,deviceId:current.deviceId,storeId:current.storeId});
      if(result.state!=='AUTHENTICATED'){
        session=undefined;
        sessionState=result.state;
        return Object.freeze({state:result.state});
      }
      const formalSession=validateSession(result.session,current);
      sessionState=effectiveSessionState(formalSession,now());
      session=sessionState==='AUTHENTICATED'?formalSession:undefined;
      return session?Object.freeze({state:'AUTHENTICATED' as const,session}):Object.freeze({state:sessionState as Exclude<MfpStaffSessionState,'AUTHENTICATED'>});
    },
    async refreshStaffSession(){
      const current=requireDevice();
      if(!session)throw new Error('MFP_STAFF_SESSION_REQUIRED');
      try{
        const readback=validateSession(await input.authority.readStaffSession({
          staffSessionRef:session.staffSessionRef,
          deviceId:current.deviceId,
          storeId:current.storeId,
        }),current);
        sessionState=effectiveSessionState(readback,now());
        session=sessionState==='AUTHENTICATED'?readback:undefined;
        return sessionState;
      }catch(error){
        session=undefined;
        sessionState='UNKNOWN';
        throw error;
      }
    },
    async logoutStaff(){
      const current=requireDevice();
      const active=session;
      session=undefined;
      sessionState='UNAUTHORIZED';
      if(active)await input.authority.logoutStaff({
        staffSessionRef:active.staffSessionRef,
        deviceId:current.deviceId,
        storeId:current.storeId,
      });
    },
    precheckAction(requiredPermission:string){precheck(requiredPermission);},
    async submitFormalCommand(command:UnboundCommand,requiredPermission:string){
      const {currentDevice,currentSession}=precheck(requiredPermission);
      if(!input.storeKernel)throw new Error('MFP_STORE_KERNEL_BINDING_UNAVAILABLE');
      const result=await input.storeKernel.submitFormalCommand(Object.freeze({
        ...command,
        deviceId:currentDevice.deviceId,
        staffSessionRef:currentSession.staffSessionRef,
      }));
      if(result.state==='REJECTED'&&(result.rejectionCode==='UNAUTHORIZED'||result.rejectionCode.endsWith('_UNAUTHORIZED'))){
        session=undefined;
        sessionState='UNAUTHORIZED';
      }
      return result;
    },
  });
}

export function createMfpSecuritySurfacePorts(port:MfpSecurityPort){
  return Object.freeze({MFP_PAD:port,MFP_MOBILE:port});
}
