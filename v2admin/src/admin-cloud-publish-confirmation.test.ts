import {describe,expect,it} from 'vitest';
import {validateAdminPublishConfirmation} from './admin-sync-client.ts';

const expected={revision:12,fingerprint:'fnv1a32:confirmed'};

describe('Admin canonical Cloud publish confirmation',()=>{
  it.each(['PUBLISHED','IDEMPOTENT'] as const)('accepts matching %s evidence',state=>{
    expect(validateAdminPublishConfirmation({state,active:expected},expected)).toEqual({state,...expected});
  });

  it('rejects a 2xx body without canonical active evidence',()=>{
    expect(()=>validateAdminPublishConfirmation({state:'PUBLISHED'},expected)).toThrow('ADMIN_SYNC_PUBLISH_CONFIRMATION_INVALID');
  });

  it('rejects revision or fingerprint mismatch',()=>{
    expect(()=>validateAdminPublishConfirmation({state:'PUBLISHED',active:{revision:11,fingerprint:expected.fingerprint}},expected)).toThrow('ADMIN_SYNC_PUBLISH_CONFIRMATION_MISMATCH');
    expect(()=>validateAdminPublishConfirmation({state:'PUBLISHED',active:{revision:12,fingerprint:'wrong'}},expected)).toThrow('ADMIN_SYNC_PUBLISH_CONFIRMATION_MISMATCH');
  });
});
