import {describe,expect,it} from 'vitest';
import {
  MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
  MFK_SYNC_SCHEMA_VERSION,
  fingerprintMfkSyncValue,
  type MfkSyncCheckpointObject,
  type MfkSyncPort,
} from '../../contracts/checkpointed-delta-sync-v1.ts';
import {
  createMfkSyncCheckpoint,
  projectionHashForEntities,
  type MfkSyncEntityMap,
} from '../../sync/checkpointed-delta-sync.ts';
import {
  buildMfkSyncCheckpointObject,
  putMfkSyncCheckpointObject,
  readMfkSyncCheckpointObject,
  serializeMfkSyncCheckpoint,
} from '../../sync/immutable-checkpoint-store.ts';
import {AdminSyncStore} from '../worker.ts';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';

const at='2026-10-01T10:00:00.000Z';

function entities(value:number):MfkSyncEntityMap{
  const payload=Object.freeze({value});
  return Object.freeze({'TEST:ONE':Object.freeze({
    entityType:'TEST',entityId:'ONE',entityRevision:Math.max(1,value),payload,payloadHash:fingerprintMfkSyncValue(payload),
  })});
}

function checkpoint(seq=2200,value=seq,port:MfkSyncPort='SMT',storeId='MF01',createdAt=at){
  return createMfkSyncCheckpoint({storeId,port,checkpointSeq:seq,sourceCommitSeq:seq,entities:entities(value),createdAt});
}

function head(seq:number,value=seq,port:MfkSyncPort='SMT',observedAt=at){
  return{
    schema:'MFK_SYNC_HEAD_V1',protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,schemaVersion:MFK_SYNC_SCHEMA_VERSION,
    storeId:'MF01',port,headSeq:seq,journalFloorSeq:1,checkpointSeq:0,checkpointHash:'',
    projectionHash:projectionHashForEntities(entities(value)),sourceCommitSeq:seq,canonicalRevision:seq,
    canonicalFingerprint:'canonical-'+seq,canonicalPublishedAt:observedAt,adminFingerprint:'admin-'+seq,observedAt,
  };
}

function event(seq:number,port:MfkSyncPort='SMT'){
  const payload={value:seq};
  return{
    schema:'MFK_PORT_CHANGE_V1',protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,schemaVersion:MFK_SYNC_SCHEMA_VERSION,
    storeId:'MF01',port,portSeq:seq,sourceCommitSeq:seq,commitId:'commit-'+seq,
    entityType:'TEST',entityId:'ONE',entityRevision:seq,op:'UPSERT',payload,
    payloadHash:fingerprintMfkSyncValue(payload),createdAt:at,
  };
}

function headKey(port:MfkSyncPort){return 'sync:head:'+port;}
function eventKey(port:MfkSyncPort,seq:number){return 'sync:event:'+port+':'+String(seq).padStart(16,'0');}

function memoryStorage(initial:Record<string,unknown>={}){
  const values=new Map<string,any>(Object.entries(initial));
  const storage={
    get:async(key:string)=>values.get(key),
    put:async(key:string,value:unknown)=>{values.set(key,value);},
    delete:async(key:string)=>{values.delete(key);},
    list:async({prefix}:{prefix:string})=>new Map([...values.entries()].filter(([key])=>key.startsWith(prefix))),
    transaction:async(work:(storage:any)=>unknown)=>work(storage),
  };
  return{values,storage};
}

function customMetadata(metadata:MfkSyncCheckpointObject){
  return Object.fromEntries(Object.entries(metadata).map(([key,value])=>[key,String(value)]));
}

class MemoryR2{
  readonly objects=new Map<string,{bytes:Uint8Array;customMetadata:Record<string,string>}>();
  puts=0;
  putError:Error|null=null;
  dropPuts=false;
  beforePut:((key:string)=>Promise<void>)|null=null;

  async get(key:string){
    const value=this.objects.get(key);
    if(!value)return null;
    return{
      customMetadata:{...value.customMetadata},
      arrayBuffer:async()=>Uint8Array.from(value.bytes).buffer,
    };
  }

  async put(key:string,value:Uint8Array,options:any){
    if(this.putError)throw this.putError;
    if(this.beforePut)await this.beforePut(key);
    if(this.objects.has(key))return null;
    this.puts++;
    if(!this.dropPuts)this.objects.set(key,{bytes:Uint8Array.from(value),customMetadata:{...options.customMetadata}});
    return{};
  }
}

function storeWith(storage:any,bucket:MemoryR2,extraEnv:Record<string,unknown>={}){
  return new AdminSyncStore({storage,getWebSockets:()=>[]},{SYNC_CHECKPOINTS:bucket,...extraEnv} as never);
}

async function gzip(bytes:Uint8Array){
  const stream=new CompressionStream('gzip');
  const output=new Response(stream.readable).arrayBuffer();
  const writer=stream.writable.getWriter();
  await writer.write(bytes);await writer.close();
  return new Uint8Array(await output);
}

async function sha256(bytes:Uint8Array){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

async function objectForPayload(bucket:MemoryR2,base:MfkSyncCheckpointObject,payload:Uint8Array,overrides:Partial<MfkSyncCheckpointObject>={}){
  const compressed=await gzip(payload),hash=await sha256(compressed);
  const metadata={...base,...overrides,objectKey:`checkpoints/test/${hash}.json.gz`,compressedBytes:compressed.byteLength,uncompressedBytes:payload.byteLength,objectSha256:hash} as MfkSyncCheckpointObject;
  bucket.objects.set(metadata.objectKey,{bytes:compressed,customMetadata:customMetadata(metadata)});
  return metadata;
}

describe('R2 immutable checkpoint objects',()=>{
  it('uses deterministic canonical bytes, gzip, SHA-256 and a scoped content-addressed key',async()=>{
    const value=checkpoint();
    const first=await buildMfkSyncCheckpointObject(value),second=await buildMfkSyncCheckpointObject(value);
    expect([...first.plain]).toEqual([...serializeMfkSyncCheckpoint(value)]);
    expect([...first.compressed]).toEqual([...second.compressed]);
    expect(first.metadata).toEqual(second.metadata);
    expect(first.metadata.objectKey).toMatch(/^checkpoints\/v1\/MF01\/SMT\/0000000000002200\/[0-9a-f]{64}\.json\.gz$/);
    expect(first.metadata).toMatchObject({compression:'gzip',checkpointHash:value.checkpointHash,projectionHash:value.projectionHash});
    expect(first.metadata.objectSha256).not.toBe(value.checkpointHash);
  });

  it('idempotently reuses the same immutable object for the same checkpoint',async()=>{
    const bucket=new MemoryR2(),value=checkpoint();
    const first=await putMfkSyncCheckpointObject(bucket,value),second=await putMfkSyncCheckpointObject(bucket,value);
    expect(first.metadata.objectKey).toBe(second.metadata.objectKey);
    expect(first.reused).toBe(false);expect(second.reused).toBe(true);expect(bucket.puts).toBe(1);
  });

  it('rejects a compressed-object SHA mismatch',async()=>{
    const bucket=new MemoryR2(),stored=await putMfkSyncCheckpointObject(bucket,checkpoint());
    bucket.objects.get(stored.metadata.objectKey)!.bytes[0]^=0xff;
    await expect(readMfkSyncCheckpointObject(bucket,stored.metadata)).rejects.toThrow('SYNC_CHECKPOINT_OBJECT_SHA256_MISMATCH');
  });

  it('rejects corrupt gzip even when its SHA-256 metadata matches',async()=>{
    const bucket=new MemoryR2(),base=(await buildMfkSyncCheckpointObject(checkpoint())).metadata;
    const bytes=new TextEncoder().encode('not-gzip'),hash=await sha256(bytes);
    const metadata={...base,objectKey:`checkpoints/test/${hash}.json.gz`,compressedBytes:bytes.byteLength,objectSha256:hash};
    bucket.objects.set(metadata.objectKey,{bytes,customMetadata:customMetadata(metadata)});
    await expect(readMfkSyncCheckpointObject(bucket,metadata)).rejects.toThrow('SYNC_CHECKPOINT_OBJECT_GZIP_CORRUPT');
  });

  it('rejects malformed checkpoint JSON',async()=>{
    const bucket=new MemoryR2(),base=(await buildMfkSyncCheckpointObject(checkpoint())).metadata;
    const metadata=await objectForPayload(bucket,base,new TextEncoder().encode('{bad json'));
    await expect(readMfkSyncCheckpointObject(bucket,metadata)).rejects.toThrow('SYNC_CHECKPOINT_OBJECT_JSON_INVALID');
  });

  it.each([
    ['store','OTHER','storeId','SYNC_CHECKPOINT_OBJECT_STORE_MISMATCH'],
    ['port','SMM','port','SYNC_CHECKPOINT_OBJECT_PORT_MISMATCH'],
    ['seq',2199,'checkpointSeq','SYNC_CHECKPOINT_OBJECT_SEQ_MISMATCH'],
  ])('rejects a checkpoint with the wrong %s identity',async(_label,wrong,field,code)=>{
    const original=checkpoint(),wrongCheckpoint=createMfkSyncCheckpoint({
      storeId:field==='storeId'?String(wrong):original.storeId,
      port:field==='port'?wrong as MfkSyncPort:original.port,
      checkpointSeq:field==='checkpointSeq'?Number(wrong):original.checkpointSeq,
      sourceCommitSeq:original.sourceCommitSeq,entities:entities(original.checkpointSeq),createdAt:original.createdAt,
    });
    const wrongBuilt=await buildMfkSyncCheckpointObject(wrongCheckpoint),bucket=new MemoryR2();
    const metadata={...wrongBuilt.metadata,[field]:(original as any)[field]} as MfkSyncCheckpointObject;
    bucket.objects.set(metadata.objectKey,{bytes:wrongBuilt.compressed,customMetadata:customMetadata(metadata)});
    await expect(readMfkSyncCheckpointObject(bucket,metadata)).rejects.toThrow(String(code));
  });

  it('rejects the wrong schemaVersion and projectionHash',async()=>{
    const original=checkpoint(),parsed=JSON.parse(new TextDecoder().decode(serializeMfkSyncCheckpoint(original)));
    const base=(await buildMfkSyncCheckpointObject(original)).metadata,bucket=new MemoryR2();
    parsed.schemaVersion=2;
    const schemaMetadata=await objectForPayload(bucket,base,new TextEncoder().encode(JSON.stringify(parsed)));
    await expect(readMfkSyncCheckpointObject(bucket,schemaMetadata)).rejects.toThrow('SYNC_CHECKPOINT_SCHEMA_VERSION_INVALID');

    const wrong=checkpoint(2200,999),wrongBuilt=await buildMfkSyncCheckpointObject(wrong);
    const projectionMetadata={...wrongBuilt.metadata,projectionHash:base.projectionHash};
    bucket.objects.set(projectionMetadata.objectKey,{bytes:wrongBuilt.compressed,customMetadata:customMetadata(projectionMetadata)});
    await expect(readMfkSyncCheckpointObject(bucket,projectionMetadata)).rejects.toThrow('SYNC_CHECKPOINT_OBJECT_PROJECTION_HASH_MISMATCH');
  });
});

describe('Admin checkpoint pointer and compaction',()=>{
  it('writes and reads back the first R2 checkpoint before advancing the DO pointer',async()=>{
    const {values,storage}=memoryStorage({[headKey('SMT')]:head(2200)}),bucket=new MemoryR2(),store=storeWith(storage,bucket);
    const result=await store.maybeBuildSyncCheckpoint('SMT',entities(2200),head(2200));
    expect(result).toMatchObject({state:'READY'});
    expect(bucket.puts).toBe(1);
    expect(values.get(headKey('SMT'))).toMatchObject({headSeq:2200,checkpointSeq:2200,checkpointCompression:'gzip'});
    const pointer=values.get('sync:checkpoint-pointer:SMT');
    expect((await readMfkSyncCheckpointObject(bucket,pointer.current)).checkpoint.checkpointSeq).toBe(2200);
    expect(await store.readSyncCheckpoint('SMT','2200')).toMatchObject({status:200,body:{checkpointSeq:2200}});
  });

  it('keeps publish green and the pointer/journal unchanged when R2 PUT fails',async()=>{
    const {values,storage}=memoryStorage(),bucket=new MemoryR2();bucket.putError=new Error('R2_PUT_TIMEOUT');
    const tasks:Promise<unknown>[]=[];
    const state={storage,getWebSockets:()=>[],waitUntil:(task:Promise<unknown>)=>tasks.push(task)};
    const store=new AdminSyncStore(state as never,{SYNC_CHECKPOINTS:bucket} as never);
    const result=await store.publishEnvelope(createMfkAdminConfigEnvelope({storeId:'MF01',revision:1,publishedAt:at,adminFingerprint:'admin',snapshot:{catalog:{products:[{id:'P1'}]}}}));
    expect(result.body).toMatchObject({state:'PUBLISHED'});
    await Promise.all(tasks);
    expect(values.has('sync:checkpoint-pointer:SMT')).toBe(false);
    expect([...values.keys()].some(key=>key.startsWith('sync:event:SMT:'))).toBe(true);
    expect(values.get('sync:checkpoint-error:SMT')).toMatchObject({code:'CHECKPOINT_BUILD_FAILED',reason:'R2_PUT_TIMEOUT'});
  });

  it('does not advance the pointer when R2 GET/readback fails',async()=>{
    const {values,storage}=memoryStorage({[headKey('SMT')]:head(10),[eventKey('SMT',10)]:event(10)}),bucket=new MemoryR2();bucket.dropPuts=true;
    const result=await storeWith(storage,bucket).maybeBuildSyncCheckpoint('SMT',entities(10),head(10));
    expect(result).toMatchObject({state:'FAILED',code:'SYNC_CHECKPOINT_OBJECT_NOT_FOUND'});
    expect(values.has('sync:checkpoint-pointer:SMT')).toBe(false);
    expect(values.has(eventKey('SMT',10))).toBe(true);
  });

  it('rejects a corrupt current object without moving its pointer',async()=>{
    const {values,storage}=memoryStorage({[headKey('SMT')]:head(10)}),bucket=new MemoryR2(),store=storeWith(storage,bucket);
    await store.maybeBuildSyncCheckpoint('SMT',entities(10),head(10));
    const pointer=values.get('sync:checkpoint-pointer:SMT');
    const applied={appliedSeq:9};values.set('sync:applied:SMT:DEVICE-1',applied);
    bucket.objects.get(pointer.current.objectKey)!.bytes[0]^=0xff;
    const result=await store.readSyncCheckpoint('SMT','10');
    expect(result).toMatchObject({status:503,body:{code:'SYNC_CHECKPOINT_READ_FAILED'}});
    expect(values.get('sync:checkpoint-pointer:SMT')).toEqual(pointer);
    expect(values.get('sync:applied:SMT:DEVICE-1')).toBe(applied);
  });

  it('prevents a stale compactor from rewinding a newer pointer',async()=>{
    const {values,storage}=memoryStorage({[headKey('SMT')]:head(2180)}),bucket=new MemoryR2(),store=storeWith(storage,bucket);
    let release!:()=>void,started!:()=>void;
    const waiting=new Promise<void>(resolve=>{started=resolve;});
    const gate=new Promise<void>(resolve=>{release=resolve;});
    bucket.beforePut=async key=>{if(key.includes('/0000000000002180/')){started();await gate;}};
    const old=store.maybeBuildSyncCheckpoint('SMT',entities(2180),head(2180));
    await waiting;
    values.set(headKey('SMT'),head(2200));
    await store.maybeBuildSyncCheckpoint('SMT',entities(2200),head(2200));
    release();
    expect(await old).toMatchObject({state:'STALE',checkpointSeq:2200});
    expect(values.get('sync:checkpoint-pointer:SMT').current.checkpointSeq).toBe(2200);
  });

  it('preserves Head 2183 and tail 2181-2183 when checkpoint 2180 finishes after publishes',async()=>{
    const {values,storage}=memoryStorage({[headKey('SMT')]:head(2180)}),bucket=new MemoryR2(),store=storeWith(storage,bucket);
    let release!:()=>void,started!:()=>void;
    const waiting=new Promise<void>(resolve=>{started=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
    bucket.beforePut=async key=>{if(key.includes('/0000000000002180/')){started();await gate;}};
    const building=store.maybeBuildSyncCheckpoint('SMT',entities(2180),head(2180));
    await waiting;
    values.set(headKey('SMT'),head(2183,2183));
    for(let seq=2181;seq<=2183;seq++)values.set(eventKey('SMT',seq),event(seq));
    release();await building;
    expect(values.get(headKey('SMT'))).toMatchObject({headSeq:2183,projectionHash:head(2183,2183).projectionHash,checkpointSeq:2180});
    expect([2181,2182,2183].every(seq=>values.has(eventKey('SMT',seq)))).toBe(true);
  });

  it('uses checkpoint 2180 plus tail 2181-2200 for a client at 1045',async()=>{
    const {values,storage}=memoryStorage({[headKey('SMT')]:head(2180)}),bucket=new MemoryR2(),store=storeWith(storage,bucket);
    await store.maybeBuildSyncCheckpoint('SMT',entities(2180),head(2180));
    const currentHead={...values.get(headKey('SMT')),...head(2200,2200),checkpointSeq:2180,checkpointHash:values.get(headKey('SMT')).checkpointHash,journalFloorSeq:2181};
    values.set(headKey('SMT'),currentHead);
    for(let seq=2181;seq<=2200;seq++)values.set(eventKey('SMT',seq),event(seq));
    expect(await store.readSyncChanges('SMT',1045)).toMatchObject({status:409,body:{code:'SYNC_CHECKPOINT_REQUIRED'}});
    expect(await store.readSyncCheckpoint('SMT','2180')).toMatchObject({status:200,body:{checkpointSeq:2180}});
    const tail=await store.readSyncChanges('SMT',2180);
    expect(tail).toMatchObject({status:200,body:{fromExclusive:2180,toInclusive:2200}});
    expect((tail.body as any).changes).toHaveLength(20);
  });

  it('keeps a real previous generation and reconstructs current when its object is missing',async()=>{
    const oldAt='2026-09-29T00:00:00.000Z';
    const {values,storage}=memoryStorage({[headKey('SMT')]:head(180,180,'SMT',oldAt)}),bucket=new MemoryR2(),store=storeWith(storage,bucket);
    await store.maybeBuildSyncCheckpoint('SMT',entities(180),head(180,180,'SMT',oldAt));
    for(let seq=181;seq<=200;seq++)values.set(eventKey('SMT',seq),event(seq));
    values.set(headKey('SMT'),{...values.get(headKey('SMT')),...head(200),checkpointSeq:180,checkpointHash:values.get(headKey('SMT')).checkpointHash,journalFloorSeq:181});
    await store.maybeBuildSyncCheckpoint('SMT',entities(200),head(200));
    const pointer=values.get('sync:checkpoint-pointer:SMT');
    expect(pointer).toMatchObject({current:{checkpointSeq:200},previous:{checkpointSeq:180}});
    expect(values.get(headKey('SMT')).journalFloorSeq).toBe(181);
    bucket.objects.delete(pointer.current.objectKey);
    const recovered=await store.readSyncCheckpoint('SMT','200');
    expect(recovered).toMatchObject({status:200,body:{checkpointSeq:200,checkpointHash:pointer.current.checkpointHash}});
    expect(values.get('sync:checkpoint-error:SMT')).toMatchObject({code:'CHECKPOINT_CURRENT_FALLBACK_TO_PREVIOUS'});
  });

  it('preserves legacy DO checkpoints until an R2 pointer exists',async()=>{
    const legacy=checkpoint(5),legacyHead={...head(5),checkpointSeq:5,checkpointHash:legacy.checkpointHash};
    const {storage}=memoryStorage({[headKey('SMT')]:legacyHead,'sync:checkpoint:SMT:0000000000000005':legacy});
    expect(await storeWith(storage,new MemoryR2()).readSyncCheckpoint('SMT','5')).toMatchObject({status:200,body:{checkpointSeq:5}});
  });

  it('compacts only sync transport journal and preserves commercial/audit/version history',async()=>{
    const sentinel={proof:'required'};
    const {values,storage}=memoryStorage({
      [headKey('CUSTOMER')]:head(10,10,'CUSTOMER'),
      [eventKey('CUSTOMER',1)]:event(1,'CUSTOMER'),
      'admin-browser:version:fingerprint':sentinel,
      'admin:published:fingerprint':sentinel,
      'customer-order:submission-1':sentinel,
      'sync:commit:0000000000000001':sentinel,
    });
    await storeWith(storage,new MemoryR2()).maybeBuildSyncCheckpoint('CUSTOMER',entities(10),head(10,10,'CUSTOMER'));
    expect(values.has(eventKey('CUSTOMER',1))).toBe(false);
    for(const key of ['admin-browser:version:fingerprint','admin:published:fingerprint','customer-order:submission-1','sync:commit:0000000000000001'])expect(values.get(key)).toBe(sentinel);
  });

  it('never compacts KEETA deltas beyond ProviderAppliedSeq',async()=>{
    const initial:{[key:string]:unknown}={[headKey('KEETA')]:head(400,400,'KEETA')};
    for(let seq=390;seq<=400;seq++)initial[eventKey('KEETA',seq)]=event(seq,'KEETA');
    const {values,storage}=memoryStorage(initial),bucket=new MemoryR2();
    const keeta={idFromName:()=>({}),get:()=>({fetch:async()=>new Response(JSON.stringify({providerAppliedSeq:395}),{headers:{'content-type':'application/json'}})})};
    await storeWith(storage,bucket,{KEETA_RUNTIME:keeta}).maybeBuildSyncCheckpoint('KEETA',entities(400),head(400,400,'KEETA'));
    expect(values.get(headKey('KEETA')).journalFloorSeq).toBe(396);
    expect([396,397,398,399,400].every(seq=>values.has(eventKey('KEETA',seq)))).toBe(true);
    expect([390,391,392,393,394,395].every(seq=>!values.has(eventKey('KEETA',seq)))).toBe(true);
  });
});
