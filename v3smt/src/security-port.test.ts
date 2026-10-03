import {describe,expect,it,vi} from 'vitest';

import {
  createMfpSecurityPort,
  createMfpSecuritySurfacePorts,
  type MfpDeviceIdentity,
  type MfpDeviceMetadataStore,
  type MfpSecurityAuthority,
  type MfpSecurityPort,
  type MfpStaffLoginResult,
  type MfpStaffSession,
  type MfpStaffSessionState,
} from './security-port.ts';
import type {MfpStoreKernelPort,MfpStoreKernelResult} from './store-kernel-port.ts';

class MemoryDeviceStore implements MfpDeviceMetadataStore{
  device:MfpDeviceIdentity|undefined;
  readonly writes:MfpDeviceIdentity[]=[];
  async read(){return this.device;}
  async write(device:MfpDeviceIdentity){this.device=device;this.writes.push(device);}
}

const session=(
  state:MfpStaffSessionState,
  expiresAt='2026-10-02T10:00:00.000Z',
  overrides:Partial<MfpStaffSession>={},
):MfpStaffSession=>Object.freeze({
  state,
  staffSessionRef:'SESSION-OPAQUE-01',
  staffId:'STAFF-01',
  displayName:'店員甲',
  role:'STAFF',
  scope:'STORE',
  issuedAt:'2026-10-02T04:00:00.000Z',
  expiresAt,
  deviceId:'MFP-PAD-01',
  storeId:'MF01',
  sessionRevision:'SESSION-R1',
  ...overrides,
  permissions:Object.freeze([...(overrides.permissions??['ORDER_CREATE'])]),
});

const command=()=>({
  schema:'mfp.store-kernel.command.v1' as const,
  storeId:'MF01',
  submissionId:'SUB-01',
  idempotencyKey:'IDEMP-01',
  commandType:'ORDER_CREATE',
  expectedRevision:null,
  payload:{productId:'P1'},
  createdAt:'2026-10-02T06:00:00.000Z',
});

const committed:MfpStoreKernelResult=Object.freeze({
  schema:'mfp.store-kernel.submission.result.v1',
  submissionId:'SUB-01',
  state:'COMMITTED',
  commitId:'COMMIT-01',
  canonicalRevision:1,
});

function fixture(options:{
  deviceStatus?:MfpDeviceIdentity['status'];
  formalSession?:MfpStaffSession;
  loginResult?:MfpStaffLoginResult;
  readback?:MfpStaffSession;
  kernelResult?:MfpStoreKernelResult;
  metadataStore?:MemoryDeviceStore;
  now?:string;
  randomUUID?:()=>string;
}={}){
  const formalSession=options.formalSession??session('AUTHENTICATED');
  const authority:MfpSecurityAuthority={
    readDeviceAuthorization:vi.fn(async device=>Object.freeze({...device,status:options.deviceStatus??'AUTHORIZED'})),
    loginStaff:vi.fn(async()=>options.loginResult??{state:'AUTHENTICATED' as const,session:formalSession}),
    readStaffSession:vi.fn(async()=>options.readback??formalSession),
    logoutStaff:vi.fn(async()=>undefined),
  };
  const storeKernel:MfpStoreKernelPort={
    submitFormalCommand:vi.fn(async()=>options.kernelResult??committed),
    readSubmission:vi.fn(async()=>options.kernelResult??committed),
  };
  const metadataStore=options.metadataStore??new MemoryDeviceStore();
  const security=createMfpSecurityPort({
    storeId:'MF01',
    deviceClass:'PAD',
    metadataStore,
    authority,
    storeKernel,
    now:()=>options.now??'2026-10-02T06:00:00.000Z',
    randomUUID:options.randomUUID??(()=> '01'),
  });
  return {authority,formalSession,metadataStore,security,storeKernel};
}

async function authorizeAndLogin(value:{security:MfpSecurityPort}){
  await value.security.loadDevice();
  await value.security.refreshDeviceAuthorization();
  return value.security.loginStaff('STAFF-01','2468');
}

describe('MFP V3 A2 security port',()=>{
  it.each([
    ['EXPIRED','2026-10-02T05:59:59.000Z','MFP_STAFF_SESSION_EXPIRED'],
    ['REVOKED','2026-10-02T10:00:00.000Z','MFP_STAFF_SESSION_REVOKED'],
  ] as const)('fails closed for an %s staffSessionRef before Store Kernel submit',async(state,expiresAt,errorCode)=>{
    const formalSession=session('AUTHENTICATED',expiresAt);
    const authority:MfpSecurityAuthority={
      readDeviceAuthorization:vi.fn(async device=>Object.freeze({...device,status:'AUTHORIZED'})),
      loginStaff:vi.fn(async()=>({state:'AUTHENTICATED' as const,session:formalSession})),
      readStaffSession:vi.fn(async()=>session(state)),
      logoutStaff:vi.fn(async()=>undefined),
    };
    const storeKernel:MfpStoreKernelPort={
      submitFormalCommand:vi.fn(async()=>committed),
      readSubmission:vi.fn(async()=>committed),
    };
    const security=createMfpSecurityPort({
      storeId:'MF01',
      deviceClass:'PAD',
      metadataStore:new MemoryDeviceStore(),
      authority,
      storeKernel,
      now:()=> '2026-10-02T06:00:00.000Z',
      randomUUID:()=> '01',
    });

    await security.loadDevice();
    await security.refreshDeviceAuthorization();
    await security.loginStaff('STAFF-01','2468');
    if(state==='REVOKED')await security.refreshStaffSession();

    await expect(security.submitFormalCommand(command(),'ORDER_CREATE')).rejects.toThrow(errorCode);
    expect(storeKernel.submitFormalCommand).not.toHaveBeenCalled();
  });

  it('keeps the same deviceId and installationId across storage restore',async()=>{
    const metadataStore=new MemoryDeviceStore();
    let sequence=0;
    const first=fixture({metadataStore,randomUUID:()=>String(++sequence)}).security;
    const firstIdentity=await first.loadDevice();
    const second=fixture({metadataStore,randomUUID:()=>String(++sequence)}).security;
    const restored=await second.loadDevice();

    expect(restored.deviceId).toBe(firstIdentity.deviceId);
    expect(restored.installationId).toBe(firstIdentity.installationId);
    expect(restored.status).toBe('UNKNOWN');
    expect(sequence).toBe(2);
  });

  it.each(['REVOKED','UNKNOWN'] as const)('%s device cannot submit',async status=>{
    const value=fixture({deviceStatus:status});
    await value.security.loadDevice();
    await value.security.refreshDeviceAuthorization();

    await expect(value.security.submitFormalCommand(command(),'ORDER_CREATE'))
      .rejects.toThrow(status==='REVOKED'?'MFP_DEVICE_REVOKED':'MFP_DEVICE_UNKNOWN');
    expect(value.storeKernel.submitFormalCommand).not.toHaveBeenCalled();
  });

  it('returns only the opaque formal session issued by the auth authority',async()=>{
    const value=fixture();
    const result=await authorizeAndLogin(value);

    expect(result).toEqual({state:'AUTHENTICATED',session:value.formalSession});
    expect(result.state==='AUTHENTICATED'&&result.session.staffSessionRef).toBe('SESSION-OPAQUE-01');
    expect(JSON.stringify(result)).not.toContain('2468');
  });

  it('does not retain an already elapsed formal login session as active',async()=>{
    const value=fixture({formalSession:session('AUTHENTICATED','2026-10-02T05:59:59.000Z')});
    expect(await authorizeAndLogin(value)).toEqual({state:'EXPIRED'});
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'EXPIRED'});
  });

  it('returns UNAUTHORIZED for a wrong proof without creating a local session',async()=>{
    const value=fixture({loginResult:{state:'UNAUTHORIZED'}});
    expect(await authorizeAndLogin(value)).toEqual({state:'UNAUTHORIZED'});
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'UNAUTHORIZED'});
  });

  it('never persists the proof, session, permissions, PIN hash or verifier',async()=>{
    const value=fixture();
    await authorizeAndLogin(value);

    const durable=JSON.stringify(value.metadataStore.writes);
    expect(durable).not.toContain('2468');
    expect(durable).not.toContain('SESSION-OPAQUE-01');
    expect(durable).not.toContain('ORDER_CREATE');
    expect(durable.toLowerCase()).not.toMatch(/pin|hash|verifier/);
    expect(JSON.stringify(value.security.getSnapshot()).toLowerCase()).not.toMatch(/2468|pin|hash|verifier/);
  });

  it.each(['ORDER_CREATE','ORDER_READ','PRICE_OVERRIDE','SOLD_OUT_WRITE'])('admits %s only through the shared action-time gate',async permission=>{
    const value=fixture({formalSession:session('AUTHENTICATED',undefined,{permissions:['ORDER_CREATE','ORDER_READ','PRICE_OVERRIDE','SOLD_OUT_WRITE']})});
    await authorizeAndLogin(value);

    expect(await value.security.submitFormalCommand(command(),permission)).toEqual(committed);
    expect(value.storeKernel.submitFormalCommand).toHaveBeenCalledTimes(1);
  });

  it('fails closed for a missing permission before Store Kernel submit',async()=>{
    const value=fixture();
    await authorizeAndLogin(value);

    expect(()=>value.security.precheckAction('ORDER_CREATE')).not.toThrow();
    expect(()=>value.security.precheckAction('PRICE_OVERRIDE')).toThrow('MFP_PERMISSION_DENIED');
    await expect(value.security.submitFormalCommand(command(),'PRICE_OVERRIDE')).rejects.toThrow('MFP_PERMISSION_DENIED');
    expect(value.storeKernel.submitFormalCommand).not.toHaveBeenCalled();
  });

  it('admits valid authenticated STAFF checkout without a Manager-only granular permission',async()=>{
    const value=fixture({formalSession:session('AUTHENTICATED',undefined,{role:'STAFF',permissions:[]})});
    await authorizeAndLogin(value);

    expect(()=>value.security.precheckFrontlineAction()).not.toThrow();
    expect(await value.security.submitFrontlineFormalCommand(command())).toEqual(committed);
    expect(value.storeKernel.submitFormalCommand).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['EXPIRED',session('AUTHENTICATED','2026-10-02T05:59:59.000Z'),'MFP_STAFF_SESSION_EXPIRED'],
    ['REVOKED',session('REVOKED'),'MFP_STAFF_SESSION_REVOKED'],
    ['UNKNOWN',session('UNKNOWN'),'MFP_STAFF_SESSION_UNKNOWN'],
  ] as const)('keeps %s frontline sessions fail-closed',async(_label,formalSession,errorCode)=>{
    const value=fixture({formalSession});
    await value.security.loadDevice();await value.security.refreshDeviceAuthorization();
    await value.security.loginStaff('STAFF-01','2468');
    await expect(value.security.submitFrontlineFormalCommand(command())).rejects.toThrow(errorCode);
    expect(value.storeKernel.submitFormalCommand).not.toHaveBeenCalled();
  });

  it('keeps a definitive Store Kernel auth rejection as REJECTED/UNAUTHORIZED',async()=>{
    const rejected:MfpStoreKernelResult={
      schema:'mfp.store-kernel.submission.result.v1',
      submissionId:'SUB-01',
      state:'REJECTED',
      rejectionCode:'UNAUTHORIZED',
    };
    const value=fixture({kernelResult:rejected});
    await authorizeAndLogin(value);

    expect(await value.security.submitFormalCommand(command(),'ORDER_CREATE')).toEqual(rejected);
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'UNAUTHORIZED'});
  });

  it('changes an authorized device to UNKNOWN when authorization readback fails',async()=>{
    const value=fixture();
    await authorizeAndLogin(value);
    vi.mocked(value.authority.readDeviceAuthorization).mockRejectedValueOnce(new Error('OFFLINE'));

    await expect(value.security.refreshDeviceAuthorization()).rejects.toThrow('OFFLINE');
    expect(value.security.getSnapshot().device?.status).toBe('UNKNOWN');
    await expect(value.security.submitFormalCommand(command(),'ORDER_CREATE')).rejects.toThrow('MFP_DEVICE_UNKNOWN');
    expect(value.storeKernel.submitFormalCommand).not.toHaveBeenCalled();
  });

  it('clears a stale session as UNKNOWN when formal session readback fails',async()=>{
    const value=fixture();
    await authorizeAndLogin(value);
    vi.mocked(value.authority.readStaffSession).mockRejectedValueOnce(new Error('OFFLINE'));

    await expect(value.security.refreshStaffSession()).rejects.toThrow('OFFLINE');
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'UNKNOWN'});
    await expect(value.security.submitFormalCommand(command(),'ORDER_CREATE')).rejects.toThrow('MFP_STAFF_SESSION_UNKNOWN');
    expect(value.storeKernel.submitFormalCommand).not.toHaveBeenCalled();
  });

  it('gives MFP Pad and MFP Mobile the same security port instance',()=>{
    const port=fixture().security;
    const surfaces=createMfpSecuritySurfacePorts(port);
    expect(surfaces.MFP_PAD).toBe(port);
    expect(surfaces.MFP_MOBILE).toBe(port);
  });

  it('clears the active local session immediately on logout',async()=>{
    const value=fixture();
    await authorizeAndLogin(value);
    await value.security.logoutStaff();

    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'UNAUTHORIZED'});
    expect(value.authority.logoutStaff).toHaveBeenCalledTimes(1);
  });

  it.each(['EXPIRED','REVOKED','UNAUTHORIZED','UNKNOWN'] as const)('clears a stale local session when formal readback returns %s',async state=>{
    const value=fixture({readback:session(state)});
    await authorizeAndLogin(value);
    expect(await value.security.refreshStaffSession()).toBe(state);
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:state});
  });

  it('treats an elapsed AUTHENTICATED readback as EXPIRED',async()=>{
    const value=fixture({readback:session('AUTHENTICATED','2026-10-02T05:59:59.000Z')});
    await authorizeAndLogin(value);
    expect(await value.security.refreshStaffSession()).toBe('EXPIRED');
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'EXPIRED'});
  });

  it('binds exact deviceId and staffSessionRef without changing A1 idempotency identity',async()=>{
    const value=fixture();
    await authorizeAndLogin(value);
    await value.security.submitFormalCommand(command(),'ORDER_CREATE');

    expect(value.storeKernel.submitFormalCommand).toHaveBeenCalledWith(expect.objectContaining({
      deviceId:'MFP-PAD-01',
      staffSessionRef:'SESSION-OPAQUE-01',
      submissionId:'SUB-01',
      idempotencyKey:'IDEMP-01',
    }));
  });
});

describe('security asynchronous session ownership',()=>{
  function pending<T>(){let resolve!:(value:T)=>void;let reject!:(reason:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

  it('does not restore a login that completed after logout',async()=>{
    const value=fixture();await value.security.loadDevice();await value.security.refreshDeviceAuthorization();
    const login=pending<MfpStaffLoginResult>();vi.mocked(value.authority.loginStaff).mockReturnValueOnce(login.promise);
    const work=value.security.loginStaff('STAFF-01','2468');await value.security.logoutStaff();
    login.resolve({state:'AUTHENTICATED',session:value.formalSession});await work;
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'UNAUTHORIZED'});
    expect(()=>value.security.precheckFrontlineAction()).toThrow('MFP_STAFF_SESSION_UNAUTHORIZED');
  });

  it('does not restore a readback that completed after logout',async()=>{
    const value=fixture();await authorizeAndLogin(value);
    const readback=pending<MfpStaffSession>();vi.mocked(value.authority.readStaffSession).mockReturnValueOnce(readback.promise);
    const work=value.security.refreshStaffSession();await value.security.logoutStaff();
    readback.resolve(value.formalSession);await work;
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'UNAUTHORIZED'});
  });

  it('does not replace a newer login with an older rejected login',async()=>{
    const value=fixture();await value.security.loadDevice();await value.security.refreshDeviceAuthorization();
    const login=pending<MfpStaffLoginResult>();vi.mocked(value.authority.loginStaff).mockReturnValueOnce(login.promise);
    const old=value.security.loginStaff('STAFF-02','2468');await value.security.loginStaff('STAFF-01','2468');
    login.resolve({state:'UNAUTHORIZED'});await old;
    expect(value.security.getSnapshot()).toMatchObject({session:value.formalSession,sessionState:'AUTHENTICATED'});
  });

  it('does not clear a newer login when an old readback fails',async()=>{
    const value=fixture();await authorizeAndLogin(value);
    const readback=pending<MfpStaffSession>();vi.mocked(value.authority.readStaffSession).mockReturnValueOnce(readback.promise);
    const work=value.security.refreshStaffSession();await value.security.loginStaff('STAFF-01','2468');
    readback.reject(new Error('OFFLINE'));await expect(work).rejects.toThrow('OFFLINE');
    expect(value.security.getSnapshot()).toMatchObject({session:value.formalSession,sessionState:'AUTHENTICATED'});
  });

  it('does not clear a newer login when an old command is rejected as unauthorized',async()=>{
    const value=fixture();await authorizeAndLogin(value);
    const submitted=pending<MfpStoreKernelResult>();vi.mocked(value.storeKernel.submitFormalCommand).mockReturnValueOnce(submitted.promise);
    const work=value.security.submitFrontlineFormalCommand(command());await value.security.logoutStaff();await value.security.loginStaff('STAFF-01','2468');
    submitted.resolve({schema:'mfp.store-kernel.submission.result.v1',submissionId:'SUB-01',state:'REJECTED',rejectionCode:'UNAUTHORIZED'});await work;
    expect(value.security.getSnapshot()).toMatchObject({session:value.formalSession,sessionState:'AUTHENTICATED'});
  });

  it('fails closed on a login transport failure instead of retaining the prior session',async()=>{
    const value=fixture();await authorizeAndLogin(value);
    vi.mocked(value.authority.loginStaff).mockRejectedValueOnce(new Error('OFFLINE'));
    await expect(value.security.loginStaff('STAFF-02','2468')).rejects.toThrow('OFFLINE');
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'UNKNOWN'});
  });

  it('rejects a readback for a different opaque session',async()=>{
    const value=fixture();await authorizeAndLogin(value);
    vi.mocked(value.authority.readStaffSession).mockResolvedValueOnce(session('AUTHENTICATED',undefined,{staffSessionRef:'SESSION-OTHER'}));
    await expect(value.security.refreshStaffSession()).rejects.toThrow('MFP_STAFF_SESSION_IDENTITY_MISMATCH');
    expect(value.security.getSnapshot()).toMatchObject({session:null,sessionState:'UNKNOWN'});
  });
});
