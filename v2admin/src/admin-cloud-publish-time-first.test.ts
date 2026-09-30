import {describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {validateAdminPublishConfirmation} from './admin-sync-client.ts';

function requestEnvelope(){
  return createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:22,
    publishedAt:'2026-09-30T00:30:00.000Z',
    adminFingerprint:'admin-new',
    snapshot:{catalog:{products:[{id:'new'}]}},
  });
}
function cloudEnvelope(request:ReturnType<typeof requestEnvelope>,publishedAt='2026-09-30T01:01:00.000Z'){
  return createMfkAdminConfigEnvelope({
    storeId:request.storeId,
    revision:request.revision,
    publishedAt,
    adminFingerprint:request.adminFingerprint,
    snapshot:request.snapshot,
  });
}

describe('Admin canonical Cloud publish confirmation',()=>{
  it.each(['PUBLISHED','IDEMPOTENT'] as const)('accepts %s by formal publish identity + Cloud time',state=>{
    const request=requestEnvelope();
    const active=cloudEnvelope(request);
    expect(validateAdminPublishConfirmation({
      state,
      active,
      publishRequestFingerprint:request.fingerprint,
      cloudPublishedAt:active.publishedAt,
    },request)).toMatchObject({
      state,
      active:{fingerprint:active.fingerprint,publishedAt:active.publishedAt,adminFingerprint:request.adminFingerprint},
      cloudPublishedAt:active.publishedAt,
    });
  });

  it('rejects the wrong formal publish identity',()=>{
    const request=requestEnvelope();
    const active=cloudEnvelope(request);
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',
      active,
      publishRequestFingerprint:'wrong',
      cloudPublishedAt:active.publishedAt,
    },request)).toThrow('ADMIN_SYNC_PUBLISH_CONFIRMATION_MISMATCH');
  });

  it('rejects missing or mismatched Cloud publish time',()=>{
    const request=requestEnvelope();
    const active=cloudEnvelope(request);
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',active,publishRequestFingerprint:request.fingerprint,
    },request)).toThrow('ADMIN_SYNC_CLOUD_PUBLISHED_AT_INVALID');
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',active,publishRequestFingerprint:request.fingerprint,
      cloudPublishedAt:'2026-09-30T01:02:00.000Z',
    },request)).toThrow('ADMIN_SYNC_CLOUD_PUBLISHED_AT_INVALID');
  });
});
