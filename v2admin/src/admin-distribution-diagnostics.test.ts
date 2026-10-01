import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {
  buildMfkAdminDistributionDiagnostics,
  type MfkAdminDistributionDiagnosticsInput,
} from '../../contracts/admin-distribution-diagnostics-v1.ts';
import {AdminSyncStore} from '../worker.ts';
import {
  MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
  MFK_SYNC_SCHEMA_VERSION,
  type MfkSyncAppliedAck,
  type MfkSyncHead,
  type MfkSyncPort,
} from '../../contracts/checkpointed-delta-sync-v1.ts';

const NOW='2026-10-01T15:00:00.000Z';
const PUBLISHED_AT='2026-10-01T14:59:00.000Z';
const FRESHNESS_MS=5*60*1000;
const PORTS=['SMT','SMM','CUSTOMER','KEETA'] as const;

function head(port:MfkSyncPort,headSeq=10,overrides:Partial<MfkSyncHead>={}):MfkSyncHead{
  return {
    schema:'MFK_SYNC_HEAD_V1',protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,schemaVersion:MFK_SYNC_SCHEMA_VERSION,
    storeId:'MF01',port,headSeq,journalFloorSeq:1,checkpointSeq:8,checkpointHash:'checkpoint-'+port,
    checkpointObjectKey:'checkpoints/'+port,checkpointObjectSha256:'a'.repeat(64),checkpointCompression:'gzip',
    checkpointSchemaVersion:MFK_SYNC_SCHEMA_VERSION,checkpointCreatedAt:PUBLISHED_AT,projectionHash:'projection-'+port,
    sourceCommitSeq:781,canonicalRevision:2201,canonicalFingerprint:'canonical-fingerprint',canonicalPublishedAt:PUBLISHED_AT,
    adminFingerprint:'admin-fingerprint',observedAt:PUBLISHED_AT,...overrides,
  };
}

function ack(port:'SMT'|'SMM',clientId:string,appliedSeq:number,overrides:Partial<MfkSyncAppliedAck>={}):MfkSyncAppliedAck{
  return {
    schema:'MFK_SYNC_APPLIED_ACK_V1',protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,storeId:'MF01',port,clientId,
    appliedSeq,projectionHash:'projection-'+port,appliedAt:'2026-10-01T14:59:30.000Z',checkpointSeq:8,...overrides,
  };
}

function input(overrides:Partial<MfkAdminDistributionDiagnosticsInput>={}):MfkAdminDistributionDiagnosticsInput{
  const heads=Object.fromEntries(PORTS.map(port=>[port,head(port)])) as Record<MfkSyncPort,MfkSyncHead>;
  const checkpoints=Object.fromEntries(PORTS.map(port=>[port,{
    pointer:{
      schema:'MFK_SYNC_CHECKPOINT_POINTER_V1' as const,
      current:{
        schema:'MFK_SYNC_CHECKPOINT_OBJECT_V1' as const,schemaVersion:MFK_SYNC_SCHEMA_VERSION,storeId:'MF01',port,
        checkpointSeq:8,sourceCommitSeq:781,projectionHash:'projection-'+port,checkpointHash:'checkpoint-'+port,
        objectKey:'checkpoints/'+port,compression:'gzip' as const,compressedBytes:100,uncompressedBytes:200,
        objectSha256:'a'.repeat(64),createdAt:PUBLISHED_AT,
      },
      updatedAt:PUBLISHED_AT,
    },
    meta:{state:'READY',createdAt:PUBLISHED_AT},error:null,
    r2Readback:{verified:true,observedAt:NOW,error:null},
  }])) as MfkAdminDistributionDiagnosticsInput['checkpoints'];
  return {
    canonical:{storeId:'MF01',canonicalRevision:2201,commitId:'MFK-COMMIT-781',sourceCommitSeq:781,
      canonicalFingerprint:'canonical-fingerprint',publishedAt:PUBLISHED_AT},
    heads,applied:[ack('SMT','SMT-01',10),ack('SMM','SMM-01',10)],
    provider:{status:{headSeq:10,providerAppliedSeq:10,state:'APPLIED',observedAt:'2026-10-01T14:59:30.000Z',
      lastOperation:{operationId:'op-10',kind:'SPU_UPSERT',state:'APPLIED'},taskId:null,error:null},error:null},
    checkpoints,projectionErrors:[],commercialProof:{state:'HEALTHY',observedAt:NOW,error:null},
    observedAt:NOW,staleAfterMs:FRESHNESS_MS,checkpointMaxAgeMs:24*60*60*1000,...overrides,
  };
}

describe('Admin distribution diagnostics contract',()=>{
  it('does not confuse Canonical Published with an SMT client that is behind',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({applied:[ack('SMT','SMT-02',8),ack('SMM','SMM-01',10)]}));
    expect(diagnostics.canonical.state).toBe('PUBLISHED');
    expect(diagnostics.ports.SMT.clients[0]).toMatchObject({clientId:'SMT-02',headSeq:10,appliedSeq:8,behind:2,state:'BEHIND'});
    expect(diagnostics.ports.SMT.state).toBe('BEHIND');
    expect(diagnostics.globalState).toBe('PARTIAL');
  });

  it('marks SMT CURRENT only from a fresh exact AppliedSeq and matching projection hash',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input());
    expect(diagnostics.ports.SMT.clients[0]).toMatchObject({headSeq:10,appliedSeq:10,behind:0,projectionHashMatch:true,state:'CURRENT'});
    expect(diagnostics.ports.SMT.state).toBe('CURRENT');
  });

  it('reports the exact SMM behind distance for tracked clients only',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({applied:[ack('SMT','SMT-01',10),ack('SMM','SMM-02',8)]}));
    expect(diagnostics.ports.SMM).toMatchObject({state:'BEHIND',coverage:'TRACKED_CLIENTS_ONLY',behind:2});
    expect(diagnostics.ports.SMM.clients[0]).toMatchObject({clientId:'SMM-02',behind:2,state:'BEHIND'});
  });

  it('shows Customer distribution without inventing browser AppliedSeq coverage',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input());
    expect(diagnostics.ports.CUSTOMER).toMatchObject({state:'AVAILABLE',browserCoverage:'NOT_GLOBALLY_TRACKED'});
    expect(JSON.stringify(diagnostics.ports.CUSTOMER)).not.toContain('appliedSeq');
  });

  it('keeps Customer distribution available but raises issuer failure as global attention',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({commercialProof:{state:'ERROR',observedAt:NOW,error:'CUSTOMER_COMMERCIAL_PROOF_UNAVAILABLE'}}));
    expect(diagnostics.ports.CUSTOMER).toMatchObject({state:'AVAILABLE',commercialProofIssuer:'ERROR'});
    expect(diagnostics.globalState).toBe('ATTENTION');
  });

  it('keeps Keeta PENDING and behind one when ProviderAppliedSeq trails HeadSeq',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({
      heads:{...input().heads,KEETA:head('KEETA',332)},
      provider:{status:{headSeq:332,providerAppliedSeq:331,state:'PENDING',observedAt:'2026-10-01T14:59:30.000Z',
        lastOperation:{operationId:'op-332',kind:'SPU_UPSERT',state:'PENDING'},taskId:884912,error:null},error:null},
    }));
    expect(diagnostics.ports.KEETA).toMatchObject({headSeq:332,providerAppliedSeq:331,behind:1,state:'PENDING',lastOperationId:'op-332',lastMutationKind:'SPU_UPSERT',lastTaskId:884912});
    expect(diagnostics.globalState).toBe('PARTIAL');
  });

  it('never treats provider HTTP acceptance or PENDING as CURRENT',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({
      provider:{status:{headSeq:10,providerAppliedSeq:9,state:'PENDING',observedAt:'2026-10-01T14:59:30.000Z',
        lastOperation:{operationId:'accepted-only',kind:'CATEGORY_UPSERT',state:'PENDING'},taskId:99,error:null},error:null},
    }));
    expect(diagnostics.ports.KEETA.state).toBe('PENDING');
    expect(diagnostics.ports.KEETA.state).not.toBe('CURRENT');
  });

  it('preserves provider UNKNOWN',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({
      provider:{status:{headSeq:10,providerAppliedSeq:9,state:'UNKNOWN',observedAt:'2026-10-01T14:59:30.000Z',lastOperation:null,taskId:null,error:'NETWORK_UNCERTAIN'},error:null},
    }));
    expect(diagnostics.ports.KEETA.state).toBe('UNKNOWN');
  });

  it('treats ProviderAppliedSeq ahead of the Keeta Head as an error',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({
      provider:{status:{headSeq:10,providerAppliedSeq:11,state:'APPLIED',observedAt:'2026-10-01T14:59:30.000Z',lastOperation:null,taskId:null,error:null},error:null},
    }));
    expect(diagnostics.ports.KEETA.state).toBe('ERROR');
    expect(diagnostics.globalState).toBe('ATTENTION');
  });

  it('does not call an APPLIED provider status CURRENT without a Keeta Head',()=>{
    const base=input();
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({heads:{...base.heads,KEETA:undefined}}));
    expect(diagnostics.ports.KEETA.state).toBe('UNKNOWN');
    expect(diagnostics.globalState).toBe('UNKNOWN');
  });

  it('surfaces provider REJECTED as global ATTENTION',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({
      provider:{status:{headSeq:10,providerAppliedSeq:9,state:'REJECTED',observedAt:'2026-10-01T14:59:30.000Z',
        lastOperation:{operationId:'op-rejected',kind:'SPU_DELETE',state:'REJECTED'},taskId:null,error:'KEETA_PROVIDER_PARTIAL_REJECTED'},error:null},
    }));
    expect(diagnostics.ports.KEETA.state).toBe('REJECTED');
    expect(diagnostics.globalState).toBe('ATTENTION');
  });

  it('surfaces a provider delivery error without hiding it behind PENDING',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({
      provider:{status:{headSeq:10,providerAppliedSeq:9,state:'PENDING',observedAt:'2026-10-01T14:59:30.000Z',lastOperation:null,taskId:null,error:null},
        error:{code:'KEETA_PROVIDER_DELIVERY_FAILED',headSeq:10,observedAt:NOW}},
    }));
    expect(diagnostics.ports.KEETA.state).toBe('ERROR');
    expect(diagnostics.errors).toContainEqual(expect.objectContaining({domain:'PROVIDER',port:'KEETA',code:'KEETA_PROVIDER_DELIVERY_FAILED'}));
  });

  it('keeps port apply health separate from a failed checkpoint build',()=>{
    const base=input();
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({checkpoints:{...base.checkpoints,SMT:{...base.checkpoints.SMT,error:{code:'CHECKPOINT_BUILD_FAILED',reason:'R2 unavailable',observedAt:NOW}}}}));
    expect(diagnostics.ports.SMT.state).toBe('CURRENT');
    expect(diagnostics.checkpoints.SMT.state).toBe('FAILED');
    expect(diagnostics.globalState).toBe('ATTENTION');
  });

  it('keeps Canonical Published while making one Port projection error the first break',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({projectionErrors:[{port:'SMM',code:'SYNC_PORT_PROJECTION_FAILED',sourceCommitSeq:781,observedAt:NOW}]}));
    expect(diagnostics.canonical.state).toBe('PUBLISHED');
    expect(diagnostics.ports.SMM.state).toBe('ERROR');
    expect(diagnostics.globalState).toBe('ATTENTION');
  });

  it('does not change Applied state from a Doorbell without an ACK',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({applied:[ack('SMM','SMM-01',10)],doorbells:[{port:'SMT',headSeq:10}]} as Partial<MfkAdminDistributionDiagnosticsInput>));
    expect(diagnostics.ports.SMT.state).toBe('UNKNOWN');
    expect(diagnostics.ports.SMT.clients).toHaveLength(0);
  });

  it('does not call an old exact-sequence ACK CURRENT after the locked freshness window',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({applied:[
      ack('SMT','SMT-01',10,{appliedAt:'2026-09-30T14:00:00.000Z'}),ack('SMM','SMM-01',10),
    ]}));
    expect(diagnostics.ports.SMT.clients[0]).toMatchObject({state:'STALE',freshness:{state:'STALE'}});
    expect(diagnostics.ports.SMT.state).toBe('STALE');
  });

  it('classifies an exact-sequence projectionHash mismatch as ERROR',()=>{
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({applied:[ack('SMT','SMT-01',10,{projectionHash:'wrong'}),ack('SMM','SMM-01',10)]}));
    expect(diagnostics.ports.SMT.clients[0]).toMatchObject({projectionHashMatch:false,state:'ERROR'});
    expect(diagnostics.globalState).toBe('ATTENTION');
  });

  it('surfaces corrupt R2 readback without falsely marking Canonical broken',()=>{
    const base=input();
    const diagnostics=buildMfkAdminDistributionDiagnostics(input({checkpoints:{...base.checkpoints,CUSTOMER:{...base.checkpoints.CUSTOMER,r2Readback:{verified:false,observedAt:NOW,error:'SYNC_CHECKPOINT_OBJECT_SHA256_MISMATCH'}}}}));
    expect(diagnostics.checkpoints.CUSTOMER).toMatchObject({state:'CORRUPT',r2ReadbackVerified:false});
    expect(diagnostics.canonical.state).toBe('PUBLISHED');
    expect(diagnostics.globalState).toBe('ATTENTION');
  });

  it('redacts secrets and PIN/hash material by allowlisting response fields',()=>{
    const raw=input({provider:{status:{headSeq:10,providerAppliedSeq:10,state:'APPLIED',observedAt:NOW,lastOperation:null,taskId:null,error:'TOKEN_LEAK:SUPERSECRET',
      accessToken:'provider-secret',hmacSecret:'hmac-secret'},error:{code:'TOKEN_LEAK:SUPERSECRET'}}} as Partial<MfkAdminDistributionDiagnosticsInput>);
    (raw as unknown as Record<string,unknown>).staff={pin:'1234',hashHex:'pin-hash'};
    const encoded=JSON.stringify(buildMfkAdminDistributionDiagnostics(raw));
    expect(encoded).not.toContain('provider-secret');
    expect(encoded).not.toContain('hmac-secret');
    expect(encoded).not.toContain('1234');
    expect(encoded).not.toContain('pin-hash');
    expect(encoded).not.toContain('SUPERSECRET');
  });
});

describe('Admin distribution diagnostics security and bounded UI',()=>{
  it.each([
    ['unauthenticated',{}],
    ['Customer origin',{'origin':'https://order.morefunos.com'}],
    ['SMM origin',{'origin':'https://smm.morefunos.com'}],
  ])('rejects %s access to /sync/readback',async(_label,headers)=>{
    const store=new AdminSyncStore({storage:{get:async()=>null}},{});
    const response=await store.fetch(new Request('https://internal/sync/readback',{headers}));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({code:'SYNC_READBACK_UNAUTHORIZED'});
  });

  it('wires the existing diagnostics page to page-open/manual readback without interval polling',()=>{
    const source=readFileSync(new URL('./WorkflowUpgradeWorkspaces.tsx',import.meta.url),'utf8');
    expect(source).toContain('readAdminDistributionDiagnostics');
    expect(source).toContain('browserCoverage');
    expect(source).toContain('ProviderAppliedSeq');
    expect(source).toContain('Checkpoint');
    expect(source).not.toMatch(/DiagnosticsWorkspace[\s\S]{0,5000}setInterval/);
  });
});
