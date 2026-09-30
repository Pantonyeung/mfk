import {describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {validateAdminPublishConfirmation} from './admin-sync-client.ts';

function requestEnvelope(){
  return createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:6,
    publishedAt:'2010-01-01T00:00:00.000Z',
    adminFingerprint:'content-r6',
    snapshot:{catalog:{products:[{id:'r6'}]}},
  });
}
function cloudEnvelope(source:ReturnType<typeof requestEnvelope>,publishedAt:string){
  return createMfkAdminConfigEnvelope({
    storeId:source.storeId,
    revision:source.revision,
    publishedAt,
    adminFingerprint:source.adminFingerprint,
    snapshot:source.snapshot,
  });
}

describe('Admin canonical Cloud publish confirmation — HK time first',()=>{
  it.each(['PUBLISHED','IDEMPOTENT'] as const)('accepts matching %s publish request with Cloud HK time',state=>{
    const request=requestEnvelope();
    const cloudPublishedAt='2026-09-30T09:01:00.000+08:00';
    const active=cloudEnvelope(request,cloudPublishedAt);
    expect(validateAdminPublishConfirmation({
      state,
      active,
      cloudPublishedAt,
      publishRequestFingerprint:request.fingerprint,
    },request)).toMatchObject({
      state,
      active:{revision:6,adminFingerprint:'content-r6',publishedAt:cloudPublishedAt},
      cloudPublishedAt,
    });
  });

  it('rejects a 2xx body without Cloud publish time',()=>{
    const request=requestEnvelope();
    const active=cloudEnvelope(request,'2026-09-30T09:01:00.000+08:00');
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',
      active,
      publishRequestFingerprint:request.fingerprint,
    },request)).toThrow('ADMIN_SYNC_CLOUD_PUBLISHED_AT_INVALID');
  });

  it('rejects another publish request even when its diagnostic R number is the same',()=>{
    const request=requestEnvelope();
    const active=cloudEnvelope(request,'2026-09-30T09:01:00.000+08:00');
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',
      active,
      cloudPublishedAt:active.publishedAt,
      publishRequestFingerprint:'different-request',
    },request)).toThrow('ADMIN_SYNC_PUBLISH_CONFIRMATION_MISMATCH');
  });

  it('never uses R size as publish freshness',()=>{
    const request=requestEnvelope();
    const active=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:999,
      publishedAt:'2026-09-30T09:01:00.000+08:00',
      adminFingerprint:'different-content',
      snapshot:{catalog:{products:[{id:'other'}]}},
    });
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',
      active,
      cloudPublishedAt:active.publishedAt,
      publishRequestFingerprint:request.fingerprint,
    },request)).toThrow('ADMIN_SYNC_PUBLISH_CONFIRMATION_MISMATCH');
  });
});
