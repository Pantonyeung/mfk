import {describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {validateAdminPublishConfirmation} from './admin-sync-client.ts';

function expected(){
  return createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:22,
    publishedAt:'2026-09-30T08:59:50.000+08:00',
    adminFingerprint:'admin-new',
    snapshot:{catalog:{products:[{id:'new'}]}},
  });
}
function canonical(source:ReturnType<typeof expected>,publishedAt:string){
  return createMfkAdminConfigEnvelope({
    storeId:source.storeId,
    revision:source.revision,
    publishedAt,
    adminFingerprint:source.adminFingerprint,
    snapshot:source.snapshot,
  });
}

describe('Admin canonical Cloud publish confirmation — Hong Kong time first',()=>{
  it.each(['PUBLISHED','IDEMPOTENT'] as const)('accepts exact %s evidence from the same publish request',state=>{
    const source=expected();
    const cloudPublishedAt='2026-09-30T09:01:00.000+08:00';
    const active=canonical(source,cloudPublishedAt);
    expect(validateAdminPublishConfirmation({
      state,
      active,
      cloudPublishedAt,
      publishRequestFingerprint:source.fingerprint,
    },source)).toMatchObject({
      state,
      active:{adminFingerprint:source.adminFingerprint,publishedAt:cloudPublishedAt},
      cloudPublishedAt,
    });
  });

  it('rejects a 2xx response without Cloud publish time',()=>{
    const source=expected();
    const active=canonical(source,'2026-09-30T09:01:00.000+08:00');
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',
      active,
      publishRequestFingerprint:source.fingerprint,
    },source)).toThrow('ADMIN_SYNC_CLOUD_PUBLISHED_AT_INVALID');
  });

  it('rejects a response from another publish request even if R number is identical',()=>{
    const source=expected();
    const active=canonical(source,'2026-09-30T09:02:00.000+08:00');
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',
      active,
      cloudPublishedAt:active.publishedAt,
      publishRequestFingerprint:'another-request',
    },source)).toThrow('ADMIN_SYNC_PUBLISH_CONFIRMATION_MISMATCH');
  });

  it('rejects different Admin content without using revision ordering',()=>{
    const source=expected();
    const other=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:6,
      publishedAt:'2026-09-30T09:03:00.000+08:00',
      adminFingerprint:'admin-other',
      snapshot:{catalog:{products:[{id:'other'}]}},
    });
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',
      active:other,
      cloudPublishedAt:other.publishedAt,
      publishRequestFingerprint:source.fingerprint,
    },source)).toThrow('ADMIN_SYNC_PUBLISH_CONFIRMATION_MISMATCH');
  });
});
