import {
  MFK_SYNC_CHECKPOINT_COMPRESSION,
  MFK_SYNC_SCHEMA_VERSION,
  fingerprintMfkSyncValue,
  validateMfkSyncCheckpoint,
  validateMfkSyncCheckpointObject,
  type MfkSyncCheckpoint,
  type MfkSyncCheckpointObject,
} from '../contracts/checkpointed-delta-sync-v1.ts';
import {entityMapFromCheckpoint,projectionHashForEntities} from './checkpointed-delta-sync.ts';

type CheckpointBucketObject={
  readonly customMetadata?:Readonly<Record<string,string>>;
  arrayBuffer():Promise<ArrayBuffer>;
};

type CheckpointBucket={
  get(key:string):Promise<CheckpointBucketObject|null>;
  put(key:string,value:Uint8Array,options:Readonly<Record<string,unknown>>):Promise<unknown>;
};

function canonicalJson(value:unknown):string{
  if(value===null||typeof value!=='object'){
    const encoded=JSON.stringify(value);
    if(encoded===undefined)throw new Error('SYNC_CHECKPOINT_SERIALIZATION_INVALID');
    return encoded;
  }
  if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
  const row=value as Record<string,unknown>;
  return '{'+Object.keys(row).filter(key=>row[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(row[key])).join(',')+'}';
}

function logicalCheckpointHash(checkpoint:MfkSyncCheckpoint){
  return fingerprintMfkSyncValue({
    storeId:checkpoint.storeId,
    port:checkpoint.port,
    checkpointSeq:checkpoint.checkpointSeq,
    sourceCommitSeq:checkpoint.sourceCommitSeq,
    projectionHash:checkpoint.projectionHash,
    entities:checkpoint.entities.map(entity=>({
      entityType:entity.entityType,
      entityId:entity.entityId,
      entityRevision:entity.entityRevision,
      payloadHash:entity.payloadHash,
    })),
  });
}

function validateLogicalCheckpoint(checkpoint:MfkSyncCheckpoint){
  if(projectionHashForEntities(entityMapFromCheckpoint(checkpoint))!==checkpoint.projectionHash)throw new Error('SYNC_CHECKPOINT_PROJECTION_HASH_MISMATCH');
  if(logicalCheckpointHash(checkpoint)!==checkpoint.checkpointHash)throw new Error('SYNC_CHECKPOINT_LOGICAL_HASH_MISMATCH');
  return checkpoint;
}

async function transform(bytes:Uint8Array,stream:CompressionStream|DecompressionStream){
  const output=new Response(stream.readable).arrayBuffer();
  const writer=stream.writable.getWriter();
  const input=(async()=>{await writer.write(bytes);await writer.close();})();
  const [buffer]=await Promise.all([output,input]);
  return new Uint8Array(buffer);
}

async function sha256(bytes:Uint8Array){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hex=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  return{digest,hex};
}

function sameBytes(left:Uint8Array,right:Uint8Array){
  if(left.byteLength!==right.byteLength)return false;
  for(let index=0;index<left.byteLength;index++)if(left[index]!==right[index])return false;
  return true;
}

export function serializeMfkSyncCheckpoint(checkpoint:MfkSyncCheckpoint){
  return new TextEncoder().encode(canonicalJson(validateLogicalCheckpoint(validateMfkSyncCheckpoint(checkpoint))));
}

export function mfkSyncCheckpointObjectKey(checkpoint:MfkSyncCheckpoint,objectSha256:string){
  const store=encodeURIComponent(checkpoint.storeId);
  const seq=String(checkpoint.checkpointSeq).padStart(16,'0');
  return `checkpoints/v${checkpoint.schemaVersion}/${store}/${checkpoint.port}/${seq}/${objectSha256}.json.gz`;
}

export async function buildMfkSyncCheckpointObject(checkpoint:MfkSyncCheckpoint){
  const value=validateLogicalCheckpoint(validateMfkSyncCheckpoint(checkpoint));
  const plain=serializeMfkSyncCheckpoint(value);
  const compressed=await transform(plain,new CompressionStream(MFK_SYNC_CHECKPOINT_COMPRESSION));
  const objectDigest=await sha256(compressed);
  const metadata=validateMfkSyncCheckpointObject({
    schema:'MFK_SYNC_CHECKPOINT_OBJECT_V1',
    schemaVersion:MFK_SYNC_SCHEMA_VERSION,
    storeId:value.storeId,
    port:value.port,
    checkpointSeq:value.checkpointSeq,
    sourceCommitSeq:value.sourceCommitSeq,
    projectionHash:value.projectionHash,
    checkpointHash:value.checkpointHash,
    objectKey:mfkSyncCheckpointObjectKey(value,objectDigest.hex),
    compression:MFK_SYNC_CHECKPOINT_COMPRESSION,
    compressedBytes:compressed.byteLength,
    uncompressedBytes:plain.byteLength,
    objectSha256:objectDigest.hex,
    createdAt:value.createdAt,
  });
  return Object.freeze({checkpoint:value,plain,compressed,metadata,objectDigest:objectDigest.digest});
}

function storageMetadata(metadata:MfkSyncCheckpointObject):Record<string,string>{
  return{
    schema:metadata.schema,
    schemaVersion:String(metadata.schemaVersion),
    storeId:metadata.storeId,
    port:metadata.port,
    checkpointSeq:String(metadata.checkpointSeq),
    sourceCommitSeq:String(metadata.sourceCommitSeq),
    projectionHash:metadata.projectionHash,
    checkpointHash:metadata.checkpointHash,
    objectKey:metadata.objectKey,
    compression:metadata.compression,
    compressedBytes:String(metadata.compressedBytes),
    uncompressedBytes:String(metadata.uncompressedBytes),
    objectSha256:metadata.objectSha256,
    createdAt:metadata.createdAt,
  };
}

export async function readMfkSyncCheckpointObject(bucket:CheckpointBucket,metadataInput:MfkSyncCheckpointObject){
  const metadata=validateMfkSyncCheckpointObject(metadataInput);
  const object=await bucket.get(metadata.objectKey);
  if(!object)throw new Error('SYNC_CHECKPOINT_OBJECT_NOT_FOUND');
  const expectedStorageMetadata=storageMetadata(metadata);
  for(const [key,value] of Object.entries(expectedStorageMetadata)){
    if(object.customMetadata?.[key]!==value)throw new Error('SYNC_CHECKPOINT_OBJECT_METADATA_MISMATCH:'+key);
  }
  const compressed=new Uint8Array(await object.arrayBuffer());
  if(compressed.byteLength!==metadata.compressedBytes)throw new Error('SYNC_CHECKPOINT_OBJECT_SIZE_MISMATCH');
  if((await sha256(compressed)).hex!==metadata.objectSha256)throw new Error('SYNC_CHECKPOINT_OBJECT_SHA256_MISMATCH');
  let plain:Uint8Array;
  try{plain=await transform(compressed,new DecompressionStream(MFK_SYNC_CHECKPOINT_COMPRESSION));}
  catch{throw new Error('SYNC_CHECKPOINT_OBJECT_GZIP_CORRUPT');}
  if(plain.byteLength!==metadata.uncompressedBytes)throw new Error('SYNC_CHECKPOINT_OBJECT_UNCOMPRESSED_SIZE_MISMATCH');
  let parsed:unknown;
  try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));}
  catch{throw new Error('SYNC_CHECKPOINT_OBJECT_JSON_INVALID');}
  const checkpoint=validateLogicalCheckpoint(validateMfkSyncCheckpoint(parsed));
  if(checkpoint.storeId!==metadata.storeId)throw new Error('SYNC_CHECKPOINT_OBJECT_STORE_MISMATCH');
  if(checkpoint.port!==metadata.port)throw new Error('SYNC_CHECKPOINT_OBJECT_PORT_MISMATCH');
  if(checkpoint.checkpointSeq!==metadata.checkpointSeq)throw new Error('SYNC_CHECKPOINT_OBJECT_SEQ_MISMATCH');
  if(checkpoint.schemaVersion!==metadata.schemaVersion)throw new Error('SYNC_CHECKPOINT_OBJECT_SCHEMA_VERSION_MISMATCH');
  if(checkpoint.sourceCommitSeq!==metadata.sourceCommitSeq)throw new Error('SYNC_CHECKPOINT_OBJECT_SOURCE_COMMIT_MISMATCH');
  if(checkpoint.projectionHash!==metadata.projectionHash)throw new Error('SYNC_CHECKPOINT_OBJECT_PROJECTION_HASH_MISMATCH');
  if(checkpoint.checkpointHash!==metadata.checkpointHash)throw new Error('SYNC_CHECKPOINT_OBJECT_LOGICAL_HASH_MISMATCH');
  if(checkpoint.createdAt!==metadata.createdAt)throw new Error('SYNC_CHECKPOINT_OBJECT_CREATED_AT_MISMATCH');
  if(metadata.objectKey!==mfkSyncCheckpointObjectKey(checkpoint,metadata.objectSha256))throw new Error('SYNC_CHECKPOINT_OBJECT_KEY_MISMATCH');
  return Object.freeze({checkpoint,compressed,plain,metadata});
}

export async function putMfkSyncCheckpointObject(bucket:CheckpointBucket,checkpoint:MfkSyncCheckpoint){
  const built=await buildMfkSyncCheckpointObject(checkpoint);
  const existing=await bucket.get(built.metadata.objectKey);
  if(!existing){
    await bucket.put(built.metadata.objectKey,built.compressed,{
      onlyIf:new Headers({'if-none-match':'*'}),
      sha256:built.objectDigest,
      httpMetadata:{contentType:'application/json',contentEncoding:MFK_SYNC_CHECKPOINT_COMPRESSION,cacheControl:'private, max-age=31536000, immutable'},
      customMetadata:storageMetadata(built.metadata),
    });
  }
  const readback=await readMfkSyncCheckpointObject(bucket,built.metadata);
  if(!sameBytes(readback.compressed,built.compressed))throw new Error('SYNC_CHECKPOINT_OBJECT_READBACK_BYTES_MISMATCH');
  return Object.freeze({checkpoint:readback.checkpoint,metadata:built.metadata,reused:Boolean(existing)});
}
