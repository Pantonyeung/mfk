import {describe,expect,it} from 'vitest';
import {
  createMfpCommandEnvelope,createMfpStoreKernelPort,
  type MfpCommandOutbox,type MfpOutboxRecord,type MfpStoreKernelCommandEnvelope,type MfpStoreKernelResult,
} from './store-kernel-port.ts';

const command=(payload:unknown):MfpStoreKernelCommandEnvelope=>({
  schema:'mfp.store-kernel.command.v1',storeId:'MF01',deviceId:'PAD-01',
  staffSessionRef:'SESSION-01',submissionId:'SUB-01',idempotencyKey:'IDEMP-01',
  commandType:'ORDER_CREATE',expectedRevision:7,payload,createdAt:'2026-10-03T00:00:00.000Z',
});
const unknown=(retryPermitted=false):MfpStoreKernelResult=>({
  schema:'mfp.store-kernel.submission.result.v1',submissionId:'SUB-01',
  state:'UNKNOWN',readbackRequired:true,retryPermitted,
});
const committed:MfpStoreKernelResult={
  schema:'mfp.store-kernel.submission.result.v1',submissionId:'SUB-01',
  state:'COMMITTED',commitId:'COMMIT-01',canonicalRevision:8,
};
function deferred(){
  let resolve!:()=>void;
  const promise=new Promise<void>(done=>{resolve=done;});
  return {promise,resolve};
}
class MemoryOutbox implements MfpCommandOutbox{
  record?:MfpOutboxRecord;
  async read(){return this.record;}
  async write(record:MfpOutboxRecord){this.record=record;}
}
const originalPayload=()=>({lines:[{quantity:1,options:[{code:'A'}]}],note:{text:'original'}});

describe('immutable formal submission snapshot',()=>{
  it('detaches and deeply freezes nested objects and arrays without freezing caller data',()=>{
    const payload=originalPayload();
    const raw=command(payload);
    const snapshot=createMfpCommandEnvelope(raw);
    const captured=snapshot.payload as typeof payload;
    expect(captured).not.toBe(payload);
    expect(captured.lines).not.toBe(payload.lines);
    expect(captured.lines[0]).not.toBe(payload.lines[0]);
    expect(captured.lines[0].options[0]).not.toBe(payload.lines[0].options[0]);
    for(const value of [snapshot,captured,captured.lines,captured.lines[0],captured.lines[0].options,captured.lines[0].options[0],captured.note]){
      expect(Object.isFrozen(value)).toBe(true);
    }
    for(const value of [raw,payload,payload.lines,payload.lines[0],payload.lines[0].options,payload.lines[0].options[0],payload.note]){
      expect(Object.isFrozen(value)).toBe(false);
    }
    payload.lines[0].quantity=2;
    payload.lines[0].options.push({code:'B'});
    payload.note.text='changed';
    expect(captured).toEqual(originalPayload());
    expect(Reflect.set(captured.lines[0],'quantity',3)).toBe(false);
    expect(Reflect.set(captured.lines,'1',{quantity:3,options:[]})).toBe(false);
  });

  it.each(['read','write'] as const)('binds fingerprint, durable command and transport to the pre-%s snapshot',async(stage)=>{
    const payload=originalPayload();
    const raw=command(payload);
    const entered=deferred(),release=deferred();
    let record:MfpOutboxRecord|undefined;
    let sent:MfpStoreKernelCommandEnvelope|undefined;
    const port=createMfpStoreKernelPort({
      outbox:{
        async read(){if(stage==='read'){entered.resolve();await release.promise;}return undefined;},
        async write(value){record=value;if(stage==='write'&&value.status==='PENDING'){entered.resolve();await release.promise;}},
      },
      transport:{async submitCommand(value){sent=value;return unknown();},async readSubmission(){return unknown();}},
    });
    const pending=port.submitFormalCommand(raw);
    await entered.promise;
    payload.lines[0].quantity=2;
    payload.lines[0].options[0].code='B';
    payload.lines.push({quantity:9,options:[]});
    payload.note.text='changed';
    release.resolve();
    await pending;
    expect(record?.command.payload).toEqual(originalPayload());
    expect(sent?.payload).toEqual(originalPayload());
    expect(JSON.parse(record!.fingerprint).payload).toEqual(sent?.payload);
    expect(sent).toBe(record?.command);
    expect(Object.isFrozen(sent?.payload)).toBe(true);
  });

  it('retains the initial snapshot when changed nested input conflicts with an in-flight submission',async()=>{
    const gate=deferred();
    const outbox=new MemoryOutbox();
    const payload=originalPayload();
    const raw=command(payload);
    let sent:MfpStoreKernelCommandEnvelope|undefined;
    const port=createMfpStoreKernelPort({
      outbox:{read:async()=>{await gate.promise;return undefined;},write:value=>outbox.write(value)},
      transport:{async submitCommand(value){sent=value;return unknown();},async readSubmission(){return unknown();}},
    });
    const first=port.submitFormalCommand(raw);
    const duplicate=port.submitFormalCommand(command(originalPayload()));
    expect(duplicate).toBe(first);
    payload.lines[0].quantity=2;
    await expect(port.submitFormalCommand(raw)).rejects.toThrow('MFP_SUBMISSION_PAYLOAD_CONFLICT');
    gate.resolve();
    await first;
    expect(sent?.payload).toEqual(originalPayload());
    expect(JSON.parse(outbox.record!.fingerprint).payload).toEqual(sent?.payload);
  });

  it.each(['readback','retry'] as const)('recovers the original immutable command through %s after response loss and caller mutation',async(mode)=>{
    const payload=originalPayload();
    const outbox=new MemoryOutbox();
    const calls:{kind:string;command:MfpStoreKernelCommandEnvelope}[]=[];
    const port=createMfpStoreKernelPort({outbox,transport:{
      async submitCommand(value){
        calls.push({kind:'submit',command:value});
        if(calls.length===1)throw new Error('RESPONSE_LOST');
        return committed;
      },
      async readSubmission(value){calls.push({kind:'read',command:value});return mode==='retry'?unknown(true):committed;},
    }});
    expect(await port.submitFormalCommand(command(payload))).toEqual(unknown());
    payload.lines[0].quantity=2;
    payload.lines[0].options.push({code:'B'});
    payload.note.text='changed';
    const result=mode==='retry'
      ?await port.submitFormalCommand(command(originalPayload()))
      :await port.readSubmission('SUB-01');
    expect(result).toEqual(committed);
    expect(calls.map(call=>call.kind)).toEqual(mode==='retry'?['submit','read','submit']:['submit','read']);
    for(const call of calls){
      expect(call.command.payload).toEqual(originalPayload());
      expect(call.command.idempotencyKey).toBe('IDEMP-01');
      expect(call.command.staffSessionRef).toBe('SESSION-01');
      expect(JSON.parse(outbox.record!.fingerprint).payload).toEqual(call.command.payload);
    }
  });

  it('captures enumerable getters once so fingerprint and sent data cannot diverge',async()=>{
    let payloadReads=0,quantityReads=0;
    const raw={...command(null),get payload(){payloadReads++;return {line:{get quantity(){return ++quantityReads;}}};}};
    const outbox=new MemoryOutbox();
    let sent:MfpStoreKernelCommandEnvelope|undefined;
    const port=createMfpStoreKernelPort({outbox,transport:{
      async submitCommand(value){sent=value;return unknown();},async readSubmission(){return unknown();},
    }});
    await port.submitFormalCommand(raw);
    expect(payloadReads).toBe(1);
    expect(quantityReads).toBe(1);
    expect(sent?.payload).toEqual({line:{quantity:1}});
    expect(JSON.parse(outbox.record!.fingerprint).payload).toEqual(sent?.payload);
  });

  it('preserves supported scalar values, null-prototype records and literal prototype keys',()=>{
    const nullRecord=Object.assign(Object.create(null),{n:-0,values:[null,'',true,false,2.5]});
    const literal=JSON.parse('{"__proto__":{"quantity":1},"constructor":"literal"}');
    const payload={nullRecord,literal};
    const captured=createMfpCommandEnvelope(command(payload)).payload as typeof payload;
    expect(Object.getPrototypeOf(captured.nullRecord)).toBe(null);
    expect(Object.is(captured.nullRecord.n,-0)).toBe(true);
    expect(captured.nullRecord.values).toEqual([null,'',true,false,2.5]);
    expect(Object.hasOwn(captured.literal,'__proto__')).toBe(true);
    expect(Object.getPrototypeOf(captured.literal)).toBe(Object.prototype);
    expect(JSON.stringify(captured)).toBe(JSON.stringify(payload));
    expect(Object.isFrozen(captured.literal.__proto__)).toBe(true);
  });

  it('accepts shared non-cyclic references as detached immutable data',()=>{
    const shared={quantity:1};
    const captured=createMfpCommandEnvelope(command({first:shared,second:[shared]})).payload as {first:typeof shared;second:typeof shared[]};
    shared.quantity=2;
    expect(captured).toEqual({first:{quantity:1},second:[{quantity:1}]});
    expect(captured.first).not.toBe(shared);
    expect(captured.second[0]).not.toBe(shared);
    expect(Object.isFrozen(captured.first)).toBe(true);
    expect(Object.isFrozen(captured.second[0])).toBe(true);
  });

  it.each([
    ['undefined',undefined],['nested undefined',{value:undefined}],['array undefined',[undefined]],
    ['NaN',NaN],['infinity',{value:Infinity}],['negative infinity',[-Infinity]],
    ['bigint',1n],['function',()=>1],['symbol',Symbol('invalid')],
    ['date',new Date('2026-10-03T00:00:00Z')],['map',new Map()],['regexp',/invalid/],
  ])('keeps %s outside the supported payload contract',async(_name,payload)=>{
    let reads=0,writes=0,submits=0;
    const port=createMfpStoreKernelPort({
      outbox:{async read(){reads++;return undefined;},async write(){writes++;}},
      transport:{async submitCommand(){submits++;return unknown();},async readSubmission(){return unknown();}},
    });
    await expect(port.submitFormalCommand(command(payload))).rejects.toThrow('MFP_COMMAND_PAYLOAD_INVALID');
    expect({reads,writes,submits}).toEqual({reads:0,writes:0,submits:0});
  });

  it('rejects cycles without changing or freezing caller objects',()=>{
    const payload:{child?:unknown}={};
    payload.child=[payload];
    expect(()=>createMfpCommandEnvelope(command(payload))).toThrow('MFP_COMMAND_PAYLOAD_INVALID');
    expect(Object.isFrozen(payload)).toBe(false);
    expect(Object.isFrozen(payload.child)).toBe(false);
  });

  it('still requires the same staff session for retry and does not silently reauthorize',async()=>{
    const outbox=new MemoryOutbox();
    let reads=0,submits=0;
    const port=createMfpStoreKernelPort({outbox,transport:{
      async submitCommand(){submits++;return unknown();},async readSubmission(){reads++;return committed;},
    }});
    await port.submitFormalCommand(command(originalPayload()));
    await expect(port.submitFormalCommand({...command(originalPayload()),staffSessionRef:'SESSION-02'}))
      .rejects.toThrow('MFP_SUBMISSION_PAYLOAD_CONFLICT');
    expect({reads,submits}).toEqual({reads:0,submits:1});
  });
});
