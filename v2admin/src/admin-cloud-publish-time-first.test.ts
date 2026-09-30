import {describe,expect,it} from 'vitest';
import {createMfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {validateAdminPublishConfirmation} from './admin-sync-client.ts';

function expected(){
  return createMfkAdminConfigEnvelope({
    storeId:'MF01',
    revision:22,
    publishedAt:'2026-09-30T00:30:00.000Z',
    adminFingerprint:'admin-new',
    snapshot:{catalog:{products:[{id:'new'}]}},
  });
}

describe('Admin canonical Cloud publish confirmation — time first',()=>{
  it.each(['PUBLISHED','IDEMPOTENT'] as const)('accepts exact canonical %s evidence with Cloud publish time',state=>{
    const active=expected();
    expect(validateAdminPublishConfirmation({
      state,
      active,
      cloudPublishedAt:'2026-09-30T01:01:00.000Z',
    },active)).toMatchObject({
      state,
      active:{fingerprint:active.fingerprint,publishedAt:active.publishedAt},
      cloudPublishedAt:'2026-09-30T01:01:00.000Z',
    });
  });

  it('rejects a 2xx response without Cloud publish time',()=>{
    const active=expected();
    expect(()=>validateAdminPublishConfirmation({state:'PUBLISHED',active},active))
      .toThrow('ADMIN_SYNC_CLOUD_PUBLISHED_AT_INVALID');
  });

  it('rejects mismatched canonical fingerprint even when a revision number looks plausible',()=>{
    const active=expected();
    const other=createMfkAdminConfigEnvelope({
      storeId:'MF01',
      revision:22,
      publishedAt:'2026-09-30T00:31:00.000Z',
      adminFingerprint:'admin-other',
      snapshot:{catalog:{products:[{id:'other'}]}},
    });
    expect(()=>validateAdminPublishConfirmation({
      state:'PUBLISHED',
      active:other,
      cloudPublishedAt:'2026-09-30T01:02:00.000Z',
    },active)).toThrow('ADMIN_SYNC_PUBLISH_CONFIRMATION_MISMATCH');
  });
});
