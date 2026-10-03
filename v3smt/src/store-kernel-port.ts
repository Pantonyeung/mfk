export const MFP_STORE_KERNEL_COMMAND_SCHEMA='mfp.store-kernel.command.v1' as const;
export const MFP_STORE_KERNEL_RESULT_SCHEMA='mfp.store-kernel.submission.result.v1' as const;
export const STORE_KERNEL_AUTHORITY='FORMAL_TRANSACTION_AUTHORITY' as const;

export interface MfpStoreKernelCommandEnvelope{
  readonly schema:typeof MFP_STORE_KERNEL_COMMAND_SCHEMA;
  readonly storeId:string;
  readonly deviceId:string;
  readonly staffSessionRef:string;
  readonly submissionId:string;
  readonly idempotencyKey:string;
  readonly commandType:string;
  readonly expectedRevision:string|number|null;
  readonly payload:unknown;
  readonly createdAt:string;
}

export type MfpStoreKernelResult=
  |Readonly<{
    schema:typeof MFP_STORE_KERNEL_RESULT_SCHEMA;
    submissionId:string;
    state:'COMMITTED';
    commitId:string;
    canonicalRevision:string|number;
    orderRef?:string;
  }>
  |Readonly<{
    schema:typeof MFP_STORE_KERNEL_RESULT_SCHEMA;
    submissionId:string;
    state:'REJECTED';
    rejectionCode:string;
  }>
  |Readonly<{
    schema:typeof MFP_STORE_KERNEL_RESULT_SCHEMA;
    submissionId:string;
    state:'UNKNOWN';
    readbackRequired:true;
    retryPermitted:boolean;
  }>;

export interface MfpStoreKernelTransport{
  submitCommand(command:MfpStoreKernelCommandEnvelope):Promise<MfpStoreKernelResult>;
  readSubmission(command:MfpStoreKernelCommandEnvelope):Promise<MfpStoreKernelResult>;
}

export type MfpOutboxStatus='PENDING'|'UNKNOWN'|'TERMINAL_OBSERVED';

export interface MfpOutboxRecord{
  readonly submissionId:string;
  readonly idempotencyKey:string;
  readonly fingerprint:string;
  readonly command:MfpStoreKernelCommandEnvelope;
  readonly status:MfpOutboxStatus;
  readonly updatedAt:string;
}

export interface MfpCommandOutbox{
  read(submissionId:string):Promise<MfpOutboxRecord|undefined>;
  write(record:MfpOutboxRecord):Promise<void>;
}

export interface MfpStoreKernelPort{
  submitFormalCommand(command:MfpStoreKernelCommandEnvelope):Promise<MfpStoreKernelResult>;
  readSubmission(submissionId:string):Promise<MfpStoreKernelResult>;
}

function text(value:unknown,code:string,max=240){
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max)throw new Error(code);
  return value;
}

function validRevision(value:unknown){
  return value===null
    ||typeof value==='string'&&Boolean(value.trim())&&value===value.trim()&&value.length<=240
    ||typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
}

function canonicalJson(value:unknown,seen=new Set<object>()):string{
  if(value===null)return 'null';
  if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('MFP_COMMAND_PAYLOAD_INVALID');
    return JSON.stringify(value);
  }
  if(typeof value!=='object')throw new Error('MFP_COMMAND_PAYLOAD_INVALID');
  if(seen.has(value))throw new Error('MFP_COMMAND_PAYLOAD_INVALID');
  seen.add(value);
  try{
    if(Array.isArray(value))return '['+value.map(item=>canonicalJson(item,seen)).join(',')+']';
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)throw new Error('MFP_COMMAND_PAYLOAD_INVALID');
    const record=value as Record<string,unknown>;
    return '{'+Object.keys(record).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(record[key],seen)).join(',')+'}';
  }finally{seen.delete(value);}
}

function snapshotPayload(value:unknown,seen=new Set<object>()):unknown{
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('MFP_COMMAND_PAYLOAD_INVALID');
    return value;
  }
  if(typeof value!=='object'||seen.has(value))throw new Error('MFP_COMMAND_PAYLOAD_INVALID');
  seen.add(value);
  try{
    if(Array.isArray(value)){
      const copy=new Array<unknown>(value.length);
      for(let index=0;index<copy.length;index++){
        if(index in value)copy[index]=snapshotPayload(value[index],seen);
      }
      return Object.freeze(copy);
    }
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)throw new Error('MFP_COMMAND_PAYLOAD_INVALID');
    const copy=Object.create(prototype) as Record<string,unknown>;
    for(const key of Object.keys(value)){
      Object.defineProperty(copy,key,{
        value:snapshotPayload((value as Record<string,unknown>)[key],seen),
        enumerable:true,
      });
    }
    return Object.freeze(copy);
  }finally{seen.delete(value);}
}

export function createMfpCommandEnvelope(input:MfpStoreKernelCommandEnvelope):MfpStoreKernelCommandEnvelope{
  const command={...input};
  if(command.schema!==MFP_STORE_KERNEL_COMMAND_SCHEMA)throw new Error('MFP_COMMAND_SCHEMA_INVALID');
  text(command.storeId,'MFP_COMMAND_STORE_ID_INVALID');
  text(command.deviceId,'MFP_COMMAND_DEVICE_ID_INVALID');
  text(command.staffSessionRef,'MFP_COMMAND_STAFF_SESSION_INVALID');
  text(command.submissionId,'MFP_COMMAND_SUBMISSION_ID_INVALID');
  text(command.idempotencyKey,'MFP_COMMAND_IDEMPOTENCY_KEY_INVALID');
  text(command.commandType,'MFP_COMMAND_TYPE_INVALID',160);
  if(!validRevision(command.expectedRevision))throw new Error('MFP_COMMAND_EXPECTED_REVISION_INVALID');
  if(!command.createdAt||!Number.isFinite(Date.parse(command.createdAt)))throw new Error('MFP_COMMAND_CREATED_AT_INVALID');
  // Capture caller-owned data before fingerprinting or the first asynchronous outbox operation.
  return Object.freeze({...command,payload:snapshotPayload(command.payload)});
}

function commandFingerprint(command:MfpStoreKernelCommandEnvelope){
  return canonicalJson({
    schema:command.schema,
    storeId:command.storeId,
    deviceId:command.deviceId,
    staffSessionRef:command.staffSessionRef,
    submissionId:command.submissionId,
    idempotencyKey:command.idempotencyKey,
    commandType:command.commandType,
    expectedRevision:command.expectedRevision,
    payload:command.payload,
  });
}

function unknownResult(submissionId:string):MfpStoreKernelResult{
  return Object.freeze({
    schema:MFP_STORE_KERNEL_RESULT_SCHEMA,
    submissionId,
    state:'UNKNOWN',
    readbackRequired:true,
    retryPermitted:false,
  });
}

function validatedResult(value:unknown,submissionId:string):MfpStoreKernelResult{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('MFP_STORE_KERNEL_RESULT_INVALID');
  const row=value as Record<string,unknown>;
  if(row.schema!==MFP_STORE_KERNEL_RESULT_SCHEMA||row.submissionId!==submissionId)throw new Error('MFP_STORE_KERNEL_RESULT_IDENTITY_INVALID');
  if(row.state==='COMMITTED'){
    text(row.commitId,'MFP_STORE_KERNEL_COMMIT_ID_INVALID');
    if(!validRevision(row.canonicalRevision)||row.canonicalRevision===null)throw new Error('MFP_STORE_KERNEL_CANONICAL_REVISION_INVALID');
    if(row.orderRef!==undefined)text(row.orderRef,'MFP_STORE_KERNEL_ORDER_REF_INVALID');
    return value as MfpStoreKernelResult;
  }
  if(row.state==='REJECTED'){
    text(row.rejectionCode,'MFP_STORE_KERNEL_REJECTION_CODE_INVALID');
    return value as MfpStoreKernelResult;
  }
  if(row.state==='UNKNOWN'&&row.readbackRequired===true&&typeof row.retryPermitted==='boolean')return value as MfpStoreKernelResult;
  throw new Error('MFP_STORE_KERNEL_RESULT_STATE_INVALID');
}

function withStatus(record:MfpOutboxRecord,status:MfpOutboxStatus,updatedAt:string):MfpOutboxRecord{
  return Object.freeze({...record,status,updatedAt});
}

export function createMfpStoreKernelPort(input:{
  readonly transport:MfpStoreKernelTransport;
  readonly outbox:MfpCommandOutbox;
  readonly now?:()=>string;
}):MfpStoreKernelPort{
  const now=input.now??(()=>new Date().toISOString());
  const inFlight=new Map<string,{fingerprint:string;promise:Promise<MfpStoreKernelResult>}>();

  const readCanonical=async(record:MfpOutboxRecord)=>{
    const submissionId=record.submissionId;
    try{
      const result=validatedResult(await input.transport.readSubmission(record.command),submissionId);
      await input.outbox.write(withStatus(record,result.state==='UNKNOWN'?'UNKNOWN':'TERMINAL_OBSERVED',now()));
      return {reached:true,result};
    }catch{
      const result=unknownResult(submissionId);
      await input.outbox.write(withStatus(record,'UNKNOWN',now()));
      return {reached:false,result};
    }
  };

  const submitStored=async(record:MfpOutboxRecord)=>{
    try{
      const result=validatedResult(await input.transport.submitCommand(record.command),record.submissionId);
      await input.outbox.write(withStatus(record,result.state==='UNKNOWN'?'UNKNOWN':'TERMINAL_OBSERVED',now()));
      return result;
    }catch{
      await input.outbox.write(withStatus(record,'UNKNOWN',now()));
      return unknownResult(record.submissionId);
    }
  };

  const execute=async(command:MfpStoreKernelCommandEnvelope,fingerprint:string)=>{
    const existing=await input.outbox.read(command.submissionId);
    if(existing){
      if(existing.idempotencyKey!==command.idempotencyKey||existing.fingerprint!==fingerprint){
        throw new Error('MFP_SUBMISSION_PAYLOAD_CONFLICT');
      }
      const readback=await readCanonical(existing);
      if(readback.result.state!=='UNKNOWN'||!readback.reached||!readback.result.retryPermitted)return readback.result;
      return submitStored(existing);
    }
    const record:MfpOutboxRecord=Object.freeze({
      submissionId:command.submissionId,
      idempotencyKey:command.idempotencyKey,
      fingerprint,
      command,
      status:'PENDING',
      updatedAt:now(),
    });
    await input.outbox.write(record);
    return submitStored(record);
  };

  return Object.freeze({
    submitFormalCommand(raw:MfpStoreKernelCommandEnvelope){
      let command:MfpStoreKernelCommandEnvelope;
      let fingerprint:string;
      try{
        command=createMfpCommandEnvelope(raw);
        fingerprint=commandFingerprint(command);
      }catch(error){return Promise.reject(error);}
      const active=inFlight.get(command.submissionId);
      if(active){
        return active.fingerprint===fingerprint
          ?active.promise
          :Promise.reject(new Error('MFP_SUBMISSION_PAYLOAD_CONFLICT'));
      }
      const promise=execute(command,fingerprint).finally(()=>{
        if(inFlight.get(command.submissionId)?.promise===promise)inFlight.delete(command.submissionId);
      });
      inFlight.set(command.submissionId,{fingerprint,promise});
      return promise;
    },
    async readSubmission(submissionId:string){
      text(submissionId,'MFP_COMMAND_SUBMISSION_ID_INVALID');
      const record=await input.outbox.read(submissionId);
      return record?(await readCanonical(record)).result:unknownResult(submissionId);
    },
  });
}

export function createMfpSurfacePorts(port:MfpStoreKernelPort){
  return Object.freeze({MFP_PAD:port,MFP_MOBILE:port});
}
