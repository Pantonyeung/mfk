import {describe,expect,it,vi} from 'vitest';

import {
  MFP_SYNC_PROTOCOL,
  applyMfpSyncChangeBatch,
  createMfpSyncCoordinator,
  createMfpSyncSurfacePorts,
  fingerprintMfpSyncValue,
  projectionHashForMfpSyncEntities,
  type MfpSyncActiveProjection,
  type MfpSyncChange,
  type MfpSyncChangeBatch,
  type MfpSyncCheckpoint,
  type MfpSyncDoorbell,
  type MfpSyncEntities,
  type MfpSyncEntity,
  type MfpSyncHead,
  type MfpSyncProjectionStore,
  type MfpSyncRequestContext,
  type MfpSyncTransport,
} from './sync-port.ts';

function deferred<T>(){
  let resolve!:(value:T)=>void;
  let reject!:(reason?:unknown)=>void;
  const promise=new Promise<T>((done,fail)=>{resolve=done;reject=fail;});
  return {promise,resolve,reject};
}

const context:MfpSyncRequestContext=Object.freeze({
  storeId:'MF01',clientId:'MFP-INSTALLATION-01',deviceId:'MFP-PAD-01',
});

function entity(id:string,payload:Readonly<Record<string,unknown>>,entityRevision=1):MfpSyncEntity{
  return Object.freeze({
    entityType:'PRODUCT',entityId:id,entityRevision,payload,
    payloadHash:fingerprintMfpSyncValue(payload),
  });
}

function entities(...values:MfpSyncEntity[]):MfpSyncEntities{
  return Object.freeze(Object.fromEntries(values.map(value=>[`${value.entityType}:${value.entityId}`,value])));
}

function projection(
  appliedSeq:number,
  currentEntities:MfpSyncEntities=Object.freeze({}),
  checkpointSeq=Math.max(0,appliedSeq-1),
):MfpSyncActiveProjection{
  return Object.freeze({
    storeId:'MF01',port:'SMT',schemaVersion:1,appliedSeq,checkpointSeq,
    projectionHash:projectionHashForMfpSyncEntities(currentEntities),
    entities:currentEntities,appliedAt:'2026-10-02T06:00:00.000Z',
  });
}

function headFor(current:MfpSyncActiveProjection,overrides:Partial<MfpSyncHead>={}):MfpSyncHead{
  return Object.freeze({
    schema:'MFK_SYNC_HEAD_V1',protocol:MFP_SYNC_PROTOCOL,
    storeId:'MF01',port:'SMT',schemaVersion:1,headSeq:current.appliedSeq,journalFloorSeq:1,
    checkpointSeq:current.checkpointSeq,checkpointHash:'checkpoint-'+current.checkpointSeq,
    projectionHash:current.projectionHash,observedAt:'2026-10-02T06:01:00.000Z',...overrides,
  });
}

function change(portSeq:number,value:MfpSyncEntity):MfpSyncChange{
  return Object.freeze({
    schema:'MFK_PORT_CHANGE_V1',protocol:MFP_SYNC_PROTOCOL,
    storeId:'MF01',port:'SMT',schemaVersion:1,portSeq,sourceCommitSeq:portSeq,
    commitId:'COMMIT-'+portSeq,entityType:value.entityType,entityId:value.entityId,
    entityRevision:value.entityRevision,op:'UPSERT',payload:value.payload,
    payloadHash:value.payloadHash,createdAt:'2026-10-02T06:01:00.000Z',
  });
}

function batch(fromExclusive:number,changes:readonly MfpSyncChange[],headSeq:number):MfpSyncChangeBatch{
  return Object.freeze({
    schema:'MFK_SYNC_CHANGE_BATCH_V1',protocol:MFP_SYNC_PROTOCOL,
    storeId:'MF01',port:'SMT',fromExclusive,
    toInclusive:changes.at(-1)?.portSeq??fromExclusive,
    headSeq,journalFloorSeq:1,changes:Object.freeze(changes),observedAt:'2026-10-02T06:01:00.000Z',
  });
}

function checkpoint(checkpointSeq:number,currentEntities:MfpSyncEntities):MfpSyncCheckpoint{
  const ordered=Object.keys(currentEntities).sort().map(key=>currentEntities[key]!);
  const projectionHash=projectionHashForMfpSyncEntities(currentEntities);
  const sourceCommitSeq=checkpointSeq;
  const checkpointHash=fingerprintMfpSyncValue({
    storeId:'MF01',port:'SMT',checkpointSeq,sourceCommitSeq,projectionHash,
    entities:ordered.map(value=>({
      entityType:value.entityType,entityId:value.entityId,
      entityRevision:value.entityRevision,payloadHash:value.payloadHash,
    })),
  });
  return Object.freeze({
    schema:'MFK_SYNC_CHECKPOINT_V1',protocol:MFP_SYNC_PROTOCOL,
    storeId:'MF01',port:'SMT',schemaVersion:1,checkpointSeq,sourceCommitSeq,
    projectionHash,checkpointHash,entities:Object.freeze(ordered),
    createdAt:'2026-10-02T06:01:00.000Z',
  });
}

class MemorySyncStore implements MfpSyncProjectionStore{
  readonly commits:MfpSyncActiveProjection[]=[];
  constructor(public current:MfpSyncActiveProjection|null=null){}
  async readActive(){return this.current;}
  async commitAtomically(candidate:MfpSyncActiveProjection){this.commits.push(candidate);this.current=candidate;}
}

function transport(overrides:Partial<MfpSyncTransport>={}):MfpSyncTransport{
  const empty=projection(0);
  return {
    readHead:vi.fn(async()=>headFor(empty)),
    readChanges:vi.fn(async afterSeq=>({kind:'DELTA' as const,batch:batch(afterSeq,[],afterSeq)})),
    readCheckpoint:vi.fn(async()=>{throw new Error('MFP_SYNC_CHECKPOINT_UNEXPECTED');}),
    ackApplied:vi.fn(async()=>undefined),
    connectDoorbell:vi.fn(()=>()=>undefined),
    ...overrides,
  };
}

function coordinator(options:{
  store?:MfpSyncProjectionStore;
  transport?:MfpSyncTransport;
  readRequestContext?:()=>Promise<MfpSyncRequestContext>;
}={}){
  return createMfpSyncCoordinator({
    store:options.store??new MemorySyncStore(),transport:options.transport??transport(),
    readRequestContext:options.readRequestContext??(async()=>context),
    now:()=> '2026-10-02T06:01:00.000Z',
  });
}

describe('MFP V3 A3 sync coordinator',()=>{
  it('coalesces WebSocket open + initial doorbell + online + resume into one bounded catch-up',async()=>{
    const current=projection(5);
    const pendingHead=deferred<MfpSyncHead>();
    const wire=transport({readHead:vi.fn(()=>pendingHead.promise)});
    const sync=coordinator({store:new MemorySyncStore(current),transport:wire});
    await sync.restore();

    const open=sync.webSocketOpened();
    const doorbell=sync.doorbellReceived({
      type:'PORT_HEAD_AVAILABLE',port:'SMT',advertisedHeadSeq:5,observedAt:'2026-10-02T06:01:00.000Z',
    });
    const online=sync.networkOnline();
    const resume=sync.resumed();

    expect(open).toBe(doorbell);
    expect(open).toBe(online);
    expect(open).toBe(resume);
    await Promise.resolve();
    expect(wire.readHead).toHaveBeenCalledTimes(1);

    pendingHead.resolve(headFor(current));
    await open;

    expect(wire.readHead).toHaveBeenCalledTimes(1);
    expect(wire.readChanges).not.toHaveBeenCalled();
    expect(wire.readCheckpoint).not.toHaveBeenCalled();
    expect(sync.getSnapshot()).toMatchObject({state:'READY',headSeq:5,appliedSeq:5});
  });

  it('does zero periodic business polling while connected and idle',async()=>{
    vi.useFakeTimers();
    try{
      const current=projection(5);
      const wire=transport({readHead:vi.fn(async()=>headFor(current))});
      const sync=coordinator({store:new MemorySyncStore(current),transport:wire});
      await sync.restore();
      await sync.webSocketOpened();
      await vi.advanceTimersByTimeAsync(24*60*60*1000);
      expect(wire.readHead).toHaveBeenCalledTimes(1);
    }finally{vi.useRealTimers();}
  });

  it('pulls only changes after AppliedSeq and ACKs after atomic delta apply',async()=>{
    const before=projection(2,entities(entity('P1',{price:10},1)),1);
    const nextEntity=entity('P1',{price:11},2);
    const afterEntities=entities(nextEntity);
    const expected=projection(3,afterEntities,1);
    const delta=batch(2,[change(3,nextEntity)],3);
    const store=new MemorySyncStore(before);
    const wire=transport({
      readHead:vi.fn(async()=>headFor(expected)),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:delta})),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();
    await sync.networkOnline();

    expect(wire.readChanges).toHaveBeenCalledWith(2,context);
    expect(wire.readCheckpoint).not.toHaveBeenCalled();
    expect(store.current).toMatchObject({appliedSeq:3,projectionHash:expected.projectionHash});
    expect(wire.ackApplied).toHaveBeenCalledWith(expect.objectContaining({
      schema:'MFK_SYNC_APPLIED_ACK_V1',protocol:MFP_SYNC_PROTOCOL,storeId:'MF01',port:'SMT',
      clientId:'MFP-INSTALLATION-01',appliedSeq:3,projectionHash:expected.projectionHash,checkpointSeq:1,
    }),context);
    expect(sync.getSnapshot()).toMatchObject({state:'READY',appliedSeq:3,lastAckAt:'2026-10-02T06:01:00.000Z'});
  });

  it('applies a duplicate delta idempotently',()=>{
    const before=entities(entity('P1',{price:10},1));
    const next=entity('P1',{price:11},2);
    const delta=batch(2,[change(3,next)],3);
    const first=applyMfpSyncChangeBatch(before,2,delta);
    const duplicate=applyMfpSyncChangeBatch(first.entities,first.appliedSeq,delta);
    expect(duplicate).toEqual(first);
  });

  it('fails closed on an out-of-order or gapped delta',async()=>{
    const before=projection(2,entities(entity('P1',{price:10},1)),1);
    const next=entity('P1',{price:12},2);
    const invalid=batch(2,[change(4,next)],4);
    const expected=projection(4,entities(next),1);
    const store=new MemorySyncStore(before);
    const wire=transport({
      readHead:vi.fn(async()=>headFor(expected)),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:invalid})),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();

    await expect(sync.networkOnline()).rejects.toThrow('MFP_SYNC_CHANGE_BATCH_NON_CONTIGUOUS');
    expect(store.current).toBe(before);
    expect(store.commits).toHaveLength(0);
    expect(sync.getSnapshot()).toMatchObject({state:'RECOVERING',appliedSeq:2});
  });

  it('fails closed on an unsupported canonical wire schema',async()=>{
    const current=projection(5);
    const invalid={...headFor(current),schema:'NOT_MFK_SYNC_HEAD_V1'} as unknown as MfpSyncHead;
    const store=new MemorySyncStore(current);
    const sync=coordinator({store,transport:transport({readHead:vi.fn(async()=>invalid)})});
    await sync.restore();
    await expect(sync.networkOnline()).rejects.toThrow('MFP_SYNC_HEAD_SCHEMA_INVALID');
    expect(store.current).toBe(current);
    expect(sync.getSnapshot()).toMatchObject({state:'RECOVERING',appliedSeq:5});
  });

  it('rejects a delta payload hash mismatch without changing the LKG',async()=>{
    const before=projection(2,entities(entity('P1',{price:10},1)),1);
    const next=entity('P1',{price:11},2);
    const corrupt=Object.freeze({...change(3,next),payloadHash:'corrupt'});
    const expected=projection(3,entities(next),1);
    const store=new MemorySyncStore(before);
    const sync=coordinator({store,transport:transport({
      readHead:vi.fn(async()=>headFor(expected)),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(2,[corrupt],3)})),
    })});
    await sync.restore();
    await expect(sync.networkOnline()).rejects.toThrow('MFP_SYNC_CHANGE_PAYLOAD_HASH_MISMATCH');
    expect(store.current).toBe(before);
    expect(store.commits).toHaveLength(0);
  });

  it('recovers from checkpoint plus a short verified tail',async()=>{
    const before=projection(1,entities(entity('P1',{price:10},1)),0);
    const checkpointEntities=entities(entity('P1',{price:14},4));
    const base=checkpoint(4,checkpointEntities);
    const finalEntity=entity('P1',{price:15},5);
    const finalEntities=entities(finalEntity);
    const expected=projection(5,finalEntities,4);
    const wire=transport({
      readHead:vi.fn(async()=>headFor(expected,{journalFloorSeq:4,checkpointSeq:4,checkpointHash:base.checkpointHash})),
      readCheckpoint:vi.fn(async()=>base),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(4,[change(5,finalEntity)],5)})),
    });
    const store=new MemorySyncStore(before);
    const sync=coordinator({store,transport:wire});
    await sync.restore();
    await sync.networkOnline();

    expect(wire.readCheckpoint).toHaveBeenCalledWith(4,context);
    expect(wire.readChanges).toHaveBeenCalledWith(4,context);
    expect(store.current).toMatchObject({appliedSeq:5,checkpointSeq:4,projectionHash:expected.projectionHash});
    expect(sync.getSnapshot()).toMatchObject({state:'READY',appliedSeq:5});
  });

  it('keeps the previous LKG when checkpoint hash verification fails',async()=>{
    const before=projection(1,entities(entity('P1',{price:10},1)),0);
    const valid=checkpoint(4,entities(entity('P1',{price:14},4)));
    const corrupt=Object.freeze({...valid,checkpointHash:'corrupt'});
    const expected=projection(4,entities(entity('P1',{price:14},4)),4);
    const store=new MemorySyncStore(before);
    const wire=transport({
      readHead:vi.fn(async()=>headFor(expected,{journalFloorSeq:4,checkpointSeq:4,checkpointHash:valid.checkpointHash})),
      readCheckpoint:vi.fn(async()=>corrupt),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();

    await expect(sync.networkOnline()).rejects.toThrow('MFP_SYNC_CHECKPOINT_HASH_MISMATCH');
    expect(store.current).toBe(before);
    expect(sync.getSnapshot()).toMatchObject({state:'RECOVERING',appliedSeq:1});
  });

  it('publishes AppliedSeq last, after atomic commit and before ACK',async()=>{
    const before=projection(2,entities(entity('P1',{price:10},1)),1);
    const next=entity('P1',{price:11},2);
    const expected=projection(3,entities(next),1);
    const commitGate=deferred<void>();
    const commitStarted=deferred<void>();
    const events:string[]=[];
    const store:MfpSyncProjectionStore={
      readActive:async()=>before,
      async commitAtomically(){events.push('commit:start');commitStarted.resolve();await commitGate.promise;events.push('commit:end');},
    };
    const wire=transport({
      readHead:vi.fn(async()=>headFor(expected)),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(2,[change(3,next)],3)})),
      ackApplied:vi.fn(async()=>{events.push('ack');}),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();
    const catchUp=sync.networkOnline();
    await commitStarted.promise;

    expect(sync.getSnapshot().appliedSeq).toBe(2);
    expect(wire.ackApplied).not.toHaveBeenCalled();
    commitGate.resolve();
    await catchUp;
    expect(events).toEqual(['commit:start','commit:end','ack']);
    expect(sync.getSnapshot().appliedSeq).toBe(3);
  });

  it('preserves the previous LKG and AppliedSeq when a crash occurs before commit',async()=>{
    const before=projection(2,entities(entity('P1',{price:10},1)),1);
    const next=entity('P1',{price:11},2);
    const expected=projection(3,entities(next),1);
    const store=new MemorySyncStore(before);
    store.commitAtomically=vi.fn(async()=>{throw new Error('SIMULATED_CRASH_BEFORE_COMMIT');});
    const wire=transport({
      readHead:vi.fn(async()=>headFor(expected)),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(2,[change(3,next)],3)})),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();

    await expect(sync.networkOnline()).rejects.toThrow('SIMULATED_CRASH_BEFORE_COMMIT');
    expect(store.current).toBe(before);
    expect(sync.getSnapshot()).toMatchObject({state:'RECOVERING',appliedSeq:2});
    expect(wire.ackApplied).not.toHaveBeenCalled();
  });

  it('restores only the last valid durable projection after restart',async()=>{
    const lkg=projection(8,entities(entity('P1',{price:18},8)),6);
    const store=new MemorySyncStore(lkg);
    const restarted=coordinator({store});
    await restarted.restore();
    expect(restarted.getSnapshot()).toMatchObject({state:'LOCAL_LKG',appliedSeq:8,lkgAvailable:true,lastAppliedAt:lkg.appliedAt});
  });

  it('rejects a partial or corrupt durable candidate instead of activating it on restart',async()=>{
    const corrupt={...projection(8),projectionHash:'corrupt'};
    const restarted=coordinator({store:new MemorySyncStore(corrupt)});
    await expect(restarted.restore()).rejects.toThrow('MFP_SYNC_LKG_PROJECTION_HASH_MISMATCH');
    expect(restarted.getSnapshot()).toMatchObject({state:'UNINITIALIZED',appliedSeq:null,lkgAvailable:false});
  });

  it('recovers a missed Doorbell through reconnect HEAD catch-up',async()=>{
    const before=projection(2,entities(entity('P1',{price:10},1)),1);
    const next=entity('P1',{price:11},2);
    const expected=projection(3,entities(next),1);
    const wire=transport({
      readHead:vi.fn(async()=>headFor(expected)),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(2,[change(3,next)],3)})),
    });
    const sync=coordinator({store:new MemorySyncStore(before),transport:wire});
    await sync.restore();
    await sync.webSocketOpened();
    expect(sync.getSnapshot()).toMatchObject({state:'READY',appliedSeq:3});
  });

  it('does not mark READY merely because WebSocket opened',async()=>{
    const current=projection(5);
    const pendingHead=deferred<MfpSyncHead>();
    const sync=coordinator({store:new MemorySyncStore(current),transport:transport({readHead:vi.fn(()=>pendingHead.promise)})});
    await sync.restore();
    const catchUp=sync.webSocketOpened();
    await Promise.resolve();
    expect(sync.getSnapshot()).toMatchObject({connection:'CONNECTED',state:'CONNECTING',appliedSeq:5});
    pendingHead.resolve(headFor(current));
    await catchUp;
  });

  it('never treats Doorbell payload as canonical projection truth',async()=>{
    const current=projection(5,entities(entity('P1',{price:10},1)),4);
    const store=new MemorySyncStore(current);
    const wire=transport({readHead:vi.fn(async()=>headFor(current))});
    const sync=coordinator({store,transport:wire});
    await sync.restore();
    await sync.doorbellReceived({
      type:'PORT_HEAD_AVAILABLE',port:'SMT',advertisedHeadSeq:5,observedAt:'2026-10-02T06:01:00.000Z',
      canonicalProjection:{PRODUCT:{price:999}},
    } as MfpSyncDoorbell);
    expect(store.current).toBe(current);
    expect(store.commits).toHaveLength(0);
    expect(sync.getSnapshot()).toMatchObject({state:'READY',headSeq:5,appliedSeq:5});
  });

  it('coalesces a newer advertised head during flight without losing it',async()=>{
    const before=projection(5,entities(entity('P1',{price:10},1)),4);
    const next=entity('P1',{price:11},2);
    const expected=projection(6,entities(next),4);
    const firstHead=deferred<MfpSyncHead>();
    const readHead=vi.fn()
      .mockImplementationOnce(()=>firstHead.promise)
      .mockResolvedValueOnce(headFor(expected));
    const wire=transport({
      readHead,
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(5,[change(6,next)],6)})),
    });
    const sync=coordinator({store:new MemorySyncStore(before),transport:wire});
    await sync.restore();
    const open=sync.webSocketOpened();
    await Promise.resolve();
    expect(sync.doorbellReceived({
      type:'PORT_HEAD_AVAILABLE',port:'SMT',advertisedHeadSeq:6,observedAt:'2026-10-02T06:01:00.000Z',
    })).toBe(open);
    firstHead.resolve(headFor(before));
    await open;

    expect(readHead).toHaveBeenCalledTimes(2);
    expect(wire.readChanges).toHaveBeenCalledTimes(1);
    expect(sync.getSnapshot()).toMatchObject({state:'READY',headSeq:6,appliedSeq:6});
  });

  it('bounds trailing reconciliation when advertised heads keep outrunning canonical HEAD',async()=>{
    const current=projection(5);
    const wire=transport({readHead:vi.fn(async()=>headFor(current))});
    const sync=coordinator({store:new MemorySyncStore(current),transport:wire});
    await sync.restore();
    await sync.doorbellReceived({
      type:'PORT_HEAD_AVAILABLE',port:'SMT',advertisedHeadSeq:99,observedAt:'2026-10-02T06:01:00.000Z',
    });
    expect(wire.readHead).toHaveBeenCalledTimes(2);
    expect(sync.getSnapshot()).toMatchObject({state:'BEHIND',headSeq:5,appliedSeq:5});
  });

  it('fails closed before transport when device/auth context is rejected',async()=>{
    const current=projection(5);
    const wire=transport();
    const sync=coordinator({
      store:new MemorySyncStore(current),transport:wire,
      readRequestContext:async()=>{throw new Error('MFP_DEVICE_REVOKED');},
    });
    await sync.restore();
    await expect(sync.networkOnline()).rejects.toThrow('MFP_DEVICE_REVOKED');
    expect(wire.readHead).not.toHaveBeenCalled();
    expect(sync.getSnapshot()).toMatchObject({state:'ERROR',appliedSeq:5,lkgAvailable:true});
  });

  it('keeps LKG available and truthfully OFFLINE until reconnect catches up',async()=>{
    const current=projection(5);
    const wire=transport({readHead:vi.fn(async()=>headFor(current))});
    const sync=coordinator({store:new MemorySyncStore(current),transport:wire});
    await sync.restore();
    sync.networkOffline();
    expect(sync.getSnapshot()).toMatchObject({connection:'OFFLINE',state:'OFFLINE',appliedSeq:5,lkgAvailable:true});
    await expect(sync.manualCatchUp()).rejects.toThrow('MFP_SYNC_OFFLINE');
    expect(wire.readHead).not.toHaveBeenCalled();
    await sync.networkOnline();
    expect(sync.getSnapshot()).toMatchObject({connection:'DISCONNECTED',state:'READY',appliedSeq:5});
  });

  it('gives MFP Pad and MFP Mobile the same sync coordinator instance',()=>{
    const sync=coordinator();
    const surfaces=createMfpSyncSurfacePorts(sync);
    expect(surfaces.MFP_PAD).toBe(sync);
    expect(surfaces.MFP_MOBILE).toBe(sync);
  });
});

describe('MFP V3 sync convergence regressions',()=>{
  it('preserves a newer entity when a stale DELETE arrives at the next port sequence',()=>{
    const current=entities(entity('P1',{price:15},5));
    const staleDelete:MfpSyncChange={...change(2,entity('P1',{},4)),op:'DELETE',payload:undefined,
      payloadHash:fingerprintMfpSyncValue({entityType:'PRODUCT',entityId:'P1',op:'DELETE'})};
    const result=applyMfpSyncChangeBatch(current,1,batch(1,[staleDelete],2));
    expect(result.entities).toEqual(current);
    expect(result.appliedSeq).toBe(2);
  });

  it('rechecks canonical HEAD when an unsequenced doorbell arrives during ACK',async()=>{
    const before=projection(0);
    const next=entity('P1',{price:11});
    const expected=projection(1,entities(next),0);
    const ackStarted=deferred<void>();
    const ackGate=deferred<void>();
    const store=new MemorySyncStore(before);
    const wire=transport({
      readHead:vi.fn().mockResolvedValueOnce(headFor(before)).mockResolvedValue(headFor(expected)),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(0,[change(1,next)],1)})),
      ackApplied:vi.fn().mockImplementationOnce(async()=>{ackStarted.resolve();await ackGate.promise;}),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();
    const startup=sync.startup();
    await ackStarted.promise;
    expect(sync.doorbellReceived({type:'PORT_HEAD_AVAILABLE',port:'SMT',observedAt:'2026-10-02T06:01:00.000Z'})).toBe(startup);
    ackGate.resolve();
    await startup;
    expect(store.current?.appliedSeq).toBe(1);
    expect(sync.getSnapshot()).toMatchObject({state:'READY',headSeq:1,appliedSeq:1});
    expect(wire.readHead).toHaveBeenCalledTimes(2);
  });

  it('converges when a valid delta advances beyond the just-read canonical HEAD',async()=>{
    const before=projection(1,entities(entity('P1',{price:10},5)),0);
    const atTwo=entity('P1',{price:11},6);
    const atThree=entity('P1',{price:12},7);
    const store=new MemorySyncStore(before);
    const wire=transport({
      readHead:vi.fn().mockResolvedValueOnce(headFor(projection(2,entities(atTwo),0)))
        .mockResolvedValue(headFor(projection(3,entities(atThree),0))),
      readChanges:vi.fn(async afterSeq=>({kind:'DELTA' as const,batch:batch(afterSeq,
        [change(2,atTwo),change(3,atThree)].filter(item=>item.portSeq>afterSeq),3)})),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();
    await expect(sync.startup()).resolves.toBeUndefined();
    expect(store.current).toMatchObject({appliedSeq:3,entities:entities(atThree)});
    expect(sync.getSnapshot()).toMatchObject({state:'READY',headSeq:3,appliedSeq:3});
    expect(wire.ackApplied).toHaveBeenLastCalledWith(expect.objectContaining({appliedSeq:3}),context);
  });

  it('schedules one event-driven continuation for a new doorbell during the second pass',async()=>{
    vi.useFakeTimers();
    try{
      const atOne=entity('P1',{price:11},1);
      const atTwo=entity('P1',{price:12},2);
      const states=[projection(0),projection(1,entities(atOne),0),projection(2,entities(atTwo),0)];
      let reads=0;
      const store=new MemorySyncStore();
      const wire=transport({
        readHead:vi.fn(async()=>headFor(states[Math.min(reads++,2)]!)),
        readChanges:vi.fn(async afterSeq=>({kind:'DELTA' as const,batch:batch(afterSeq,
          [change(afterSeq+1,afterSeq===0?atOne:atTwo)],afterSeq+1)})),
        ackApplied:vi.fn(async ack=>{
          if(ack.appliedSeq<2)void sync.doorbellReceived({type:'PORT_HEAD_AVAILABLE',port:'SMT',
            advertisedHeadSeq:ack.appliedSeq+1,observedAt:'2026-10-02T06:01:00.000Z'});
        }),
      });
      const sync=coordinator({store,transport:wire});
      await sync.startup();
      expect(wire.readHead).toHaveBeenCalledTimes(2);
      expect(sync.getSnapshot()).toMatchObject({state:'BEHIND',appliedSeq:1});
      expect(vi.getTimerCount()).toBe(1);
      await vi.runOnlyPendingTimersAsync();
      expect(store.current?.appliedSeq).toBe(2);
      expect(sync.getSnapshot()).toMatchObject({state:'READY',headSeq:2,appliedSeq:2});
      expect(wire.readHead).toHaveBeenCalledTimes(3);
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(24*60*60*1000);
      expect(wire.readHead).toHaveBeenCalledTimes(3);
    }finally{vi.useRealTimers();}
  });
});

describe('MFP V3 sync convergence safety boundaries',()=>{
  it('still applies a current DELETE and a later UPSERT in source sequence order',()=>{
    const current=entities(entity('P1',{price:15},5));
    const deleted:MfpSyncChange={...change(2,entity('P1',{},6)),op:'DELETE',payload:undefined,
      payloadHash:fingerprintMfpSyncValue({entityType:'PRODUCT',entityId:'P1',op:'DELETE'})};
    const removed=applyMfpSyncChangeBatch(current,1,batch(1,[deleted],2));
    expect(removed.entities).toEqual({});
    const newer=entity('P1',{price:17},7);
    expect(applyMfpSyncChangeBatch(removed.entities,2,batch(2,[change(3,newer)],3)))
      .toEqual({entities:entities(newer),appliedSeq:3});
  });

  it('still rejects a malformed stale DELETE before ignoring its older revision',()=>{
    const current=entities(entity('P1',{price:15},5));
    const corrupt:MfpSyncChange={...change(2,entity('P1',{},4)),op:'DELETE',payload:undefined,payloadHash:'corrupt'};
    expect(()=>applyMfpSyncChangeBatch(current,1,batch(1,[corrupt],2)))
      .toThrow('MFP_SYNC_CHANGE_PAYLOAD_HASH_MISMATCH');
  });

  it.each([
    ['protocol',{protocol:'MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL_V2'},'MFP_SYNC_CHANGE_SCHEMA_INVALID'],
    ['schema',{schema:'MFK_PORT_CHANGE_V2'},'MFP_SYNC_CHANGE_SCHEMA_INVALID'],
    ['identity',{storeId:'OTHER'},'MFP_SYNC_CHANGE_BATCH_NON_CONTIGUOUS'],
    ['sequence',{portSeq:4},'MFP_SYNC_CHANGE_BATCH_NON_CONTIGUOUS'],
    ['payload hash',{payloadHash:'corrupt'},'MFP_SYNC_CHANGE_PAYLOAD_HASH_MISMATCH'],
  ])('rejects an invalid ahead-of-HEAD %s without committing the valid prefix',async(_name,overrides,error)=>{
    const before=projection(1,entities(entity('P1',{price:10},1)),0);
    const atTwo=entity('P1',{price:11},2);
    const atThree=entity('P1',{price:12},3);
    const invalid={...change(3,atThree),...overrides} as MfpSyncChange;
    const store=new MemorySyncStore(before);
    const wire=transport({
      readHead:vi.fn(async()=>headFor(projection(2,entities(atTwo),0))),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(1,[change(2,atTwo),invalid],4)})),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();
    await expect(sync.startup()).rejects.toThrow(error);
    expect(store.current).toBe(before);
    expect(store.commits).toHaveLength(0);
    expect(wire.ackApplied).not.toHaveBeenCalled();
  });

  it('still checks the HEAD projection hash before committing a valid advanced batch prefix',async()=>{
    const before=projection(1,entities(entity('P1',{price:10},1)),0);
    const atTwo=entity('P1',{price:11},2);
    const atThree=entity('P1',{price:12},3);
    const store=new MemorySyncStore(before);
    const wire=transport({
      readHead:vi.fn(async()=>headFor(projection(2,entities(atTwo),0),{projectionHash:'corrupt'})),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(1,[change(2,atTwo),change(3,atThree)],3)})),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();
    await expect(sync.startup()).rejects.toThrow('MFP_SYNC_PROJECTION_HASH_MISMATCH');
    expect(store.current).toBe(before);
    expect(store.commits).toHaveLength(0);
    expect(wire.ackApplied).not.toHaveBeenCalled();
  });

  it('does not poll a static advertised head that canonical HEAD has not reached',async()=>{
    vi.useFakeTimers();
    try{
      const current=projection(5);
      const wire=transport({readHead:vi.fn(async()=>headFor(current))});
      const sync=coordinator({store:new MemorySyncStore(current),transport:wire});
      await sync.restore();
      await sync.doorbellReceived({type:'PORT_HEAD_AVAILABLE',port:'SMT',advertisedHeadSeq:99,
        observedAt:'2026-10-02T06:01:00.000Z'});
      expect(sync.getSnapshot()).toMatchObject({state:'BEHIND',appliedSeq:5});
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(24*60*60*1000);
      expect(wire.readHead).toHaveBeenCalledTimes(2);
    }finally{vi.useRealTimers();}
  });

  it('continues after a newly observed canonical delta tail outruns the second HEAD',async()=>{
    vi.useFakeTimers();
    try{
      const versions=[1,2,3,4].map(revision=>entity('P1',{price:10+revision},revision));
      const states=versions.map((value,index)=>projection(index+1,entities(value),0));
      let read=0;
      const store=new MemorySyncStore(states[0]);
      const wire=transport({
        readHead:vi.fn(async()=>headFor(states[Math.min(++read,3)]!)),
        readChanges:vi.fn(async afterSeq=>{
          const to=Math.min(afterSeq+2,4);
          return {kind:'DELTA' as const,batch:batch(afterSeq,versions.slice(afterSeq,to)
            .map((value,index)=>change(afterSeq+index+1,value)),to)};
        }),
      });
      const sync=coordinator({store,transport:wire});
      await sync.restore();
      await sync.startup();
      expect(store.current?.appliedSeq).toBe(3);
      expect(sync.getSnapshot().state).toBe('BEHIND');
      expect(vi.getTimerCount()).toBe(1);
      await vi.runOnlyPendingTimersAsync();
      expect(store.current?.appliedSeq).toBe(4);
      expect(sync.getSnapshot()).toMatchObject({state:'READY',headSeq:4,appliedSeq:4});
      expect(wire.readHead).toHaveBeenCalledTimes(3);
      expect(vi.getTimerCount()).toBe(0);
    }finally{vi.useRealTimers();}
  });
});

function pendingContinuation(options:{unsequenced?:boolean;failure?:string}={}){
  const atOne=entity('P1',{price:11},1);
  const atTwo=entity('P1',{price:12},2);
  const states=[projection(0),projection(1,entities(atOne),0),projection(2,entities(atTwo),0)];
  let reads=0;
  const store=new MemorySyncStore();
  const wire=transport({
    readHead:vi.fn(async()=>{
      if(reads>=2&&options.failure)throw new Error(options.failure);
      return headFor(states[Math.min(reads++,2)]!);
    }),
    readChanges:vi.fn(async afterSeq=>({kind:'DELTA' as const,batch:batch(afterSeq,
      [change(afterSeq+1,afterSeq===0?atOne:atTwo)],afterSeq+1)})),
    ackApplied:vi.fn(async ack=>{
      if(ack.appliedSeq>=2)return;
      for(let event=0;event<(options.unsequenced?20:1);event++)void sync.doorbellReceived({
        type:'PORT_HEAD_AVAILABLE',port:'SMT',observedAt:'2026-10-02T06:01:00.000Z',
        ...(options.unsequenced?{}:{advertisedHeadSeq:ack.appliedSeq+1}),
      });
    }),
  });
  const sync=coordinator({store,transport:wire});
  return {sync,store,wire};
}

describe('MFP V3 yielded continuation boundaries',()=>{
  it('coalesces repeated headless invalidations during both ACKs into one continuation',async()=>{
    vi.useFakeTimers();
    try{
      const {sync,store,wire}=pendingContinuation({unsequenced:true});
      await sync.startup();
      expect(vi.getTimerCount()).toBe(1);
      await vi.runOnlyPendingTimersAsync();
      expect(store.current?.appliedSeq).toBe(2);
      expect(sync.getSnapshot().state).toBe('READY');
      expect(wire.readHead).toHaveBeenCalledTimes(3);
      expect(vi.getTimerCount()).toBe(0);
    }finally{vi.useRealTimers();}
  });

  it('cancels the queued continuation while offline and recovers on reconnect',async()=>{
    vi.useFakeTimers();
    try{
      const {sync,store,wire}=pendingContinuation();
      await sync.startup();
      expect(vi.getTimerCount()).toBe(1);
      sync.networkOffline();
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(24*60*60*1000);
      expect(wire.readHead).toHaveBeenCalledTimes(2);
      expect(sync.getSnapshot()).toMatchObject({state:'OFFLINE',appliedSeq:1});
      await sync.networkOnline();
      expect(store.current?.appliedSeq).toBe(2);
      expect(sync.getSnapshot().state).toBe('READY');
    }finally{vi.useRealTimers();}
  });

  it('coalesces a manual catch-up with the pending continuation',async()=>{
    vi.useFakeTimers();
    try{
      const {sync,wire}=pendingContinuation();
      await sync.startup();
      expect(vi.getTimerCount()).toBe(1);
      await sync.manualCatchUp();
      expect(sync.getSnapshot()).toMatchObject({state:'READY',appliedSeq:2});
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(24*60*60*1000);
      expect(wire.readHead).toHaveBeenCalledTimes(3);
    }finally{vi.useRealTimers();}
  });

  it.each([
    ['MFP_DEVICE_REVOKED','ERROR'],
    ['SIMULATED_TRANSPORT_FAILURE','RECOVERING'],
  ])('preserves LKG and stops without auto-retry when continuation fails with %s',async(failure,state)=>{
    vi.useFakeTimers();
    try{
      const {sync,store,wire}=pendingContinuation({failure});
      await sync.startup();
      const lkg=store.current;
      await vi.runOnlyPendingTimersAsync();
      expect(store.current).toBe(lkg);
      expect(sync.getSnapshot()).toMatchObject({state,appliedSeq:1,lastError:failure});
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(24*60*60*1000);
      expect(wire.readHead).toHaveBeenCalledTimes(3);
    }finally{vi.useRealTimers();}
  });

  it('does not poll when canonical HEAD stays behind a previously returned tail',async()=>{
    vi.useFakeTimers();
    try{
      const before=projection(1,entities(entity('P1',{price:10},1)),0);
      const atTwo=entity('P1',{price:11},2);
      const atThree=entity('P1',{price:12},3);
      const store=new MemorySyncStore(before);
      const wire=transport({
        readHead:vi.fn(async()=>headFor(projection(2,entities(atTwo),0))),
        readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(1,[change(2,atTwo),change(3,atThree)],3)})),
      });
      const sync=coordinator({store,transport:wire});
      await sync.restore();
      await sync.startup();
      expect(store.current).toMatchObject({appliedSeq:2,entities:entities(atTwo)});
      expect(sync.getSnapshot()).toMatchObject({state:'BEHIND',headSeq:2,appliedSeq:2});
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(24*60*60*1000);
      expect(wire.readHead).toHaveBeenCalledTimes(2);
    }finally{vi.useRealTimers();}
  });
});

describe('MFP V3 same-store canonical HEAD monotonicity',()=>{
  it('rejects a regressive HEAD before checkpoint rollback and recovers on a later fresh HEAD',async()=>{
    const before=projection(5,entities(entity('P1',{price:500},5)),5);
    const older=entities(entity('P1',{price:400},4));
    const staleCheckpoint=checkpoint(4,older);
    const next=entity('P1',{price:600},6);
    const after=projection(6,entities(next),5);
    const store=new MemorySyncStore(before);
    const wire=transport({
      readHead:vi.fn()
        .mockResolvedValueOnce(headFor(projection(4,older,4),{checkpointHash:staleCheckpoint.checkpointHash}))
        .mockResolvedValue(headFor(after)),
      readCheckpoint:vi.fn(async()=>staleCheckpoint),
      readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(5,[change(6,next)],6)})),
    });
    const sync=coordinator({store,transport:wire});
    await sync.restore();
    await expect(sync.startup()).rejects.toThrow('MFP_SYNC_HEAD_REGRESSION');
    expect(store.current).toBe(before);
    expect(store.commits).toHaveLength(0);
    expect(wire.readCheckpoint).not.toHaveBeenCalled();
    expect(wire.readChanges).not.toHaveBeenCalled();
    expect(wire.ackApplied).not.toHaveBeenCalled();
    expect(sync.getSnapshot()).toMatchObject({state:'RECOVERING',appliedSeq:5,lkgAvailable:true,lastError:'MFP_SYNC_HEAD_REGRESSION'});
    await sync.manualCatchUp();
    expect(store.current).toMatchObject({appliedSeq:6,entities:entities(next)});
    expect(sync.getSnapshot()).toMatchObject({state:'READY',headSeq:6,appliedSeq:6,lastError:null});
  });

  it('preserves the just-committed prefix when the second catch-up HEAD regresses',async()=>{
    vi.useFakeTimers();
    try{
      const original=entity('P1',{price:100},1);
      const next=entity('P1',{price:200},2);
      const before=projection(1,entities(original),1);
      const newer=projection(2,entities(next),1);
      const staleCheckpoint=checkpoint(1,entities(original));
      const store=new MemorySyncStore(before);
      const wire=transport({
        readHead:vi.fn().mockResolvedValueOnce(headFor(newer))
          .mockResolvedValue(headFor(before,{checkpointHash:staleCheckpoint.checkpointHash})),
        readChanges:vi.fn(async()=>({kind:'DELTA' as const,batch:batch(1,[change(2,next)],2)})),
        readCheckpoint:vi.fn(async()=>staleCheckpoint),
        ackApplied:vi.fn(async()=>{
          void sync.doorbellReceived({type:'PORT_HEAD_AVAILABLE',port:'SMT',advertisedHeadSeq:3,
            observedAt:'2026-10-02T06:01:00.000Z'});
        }),
      });
      const sync=coordinator({store,transport:wire});
      await sync.restore();
      await expect(sync.startup()).rejects.toThrow('MFP_SYNC_HEAD_REGRESSION');
      expect(store.current).toMatchObject({appliedSeq:2,entities:entities(next)});
      expect(store.commits.map(value=>value.appliedSeq)).toEqual([2]);
      expect(wire.readCheckpoint).not.toHaveBeenCalled();
      expect(wire.ackApplied).toHaveBeenCalledTimes(1);
      expect(sync.getSnapshot()).toMatchObject({state:'RECOVERING',appliedSeq:2,lastError:'MFP_SYNC_HEAD_REGRESSION'});
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(24*60*60*1000);
      expect(wire.readHead).toHaveBeenCalledTimes(2);
    }finally{vi.useRealTimers();}
  });
});
