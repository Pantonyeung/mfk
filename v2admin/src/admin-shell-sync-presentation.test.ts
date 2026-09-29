import {describe,expect,it} from 'vitest';
import {deriveAdminSyncPresentation} from './AdminShell.tsx';

describe('Admin sync presentation without revision matching',()=>{
  it('treats successful Admin publish as the authoritative user-facing state',()=>{
    const view=deriveAdminSyncPresentation({
      activeRelease:{version:22,createdAt:'2026-09-29T10:00:00.000Z',fingerprint:'local22'},
      status:{state:'PUBLISHED',revision:20,fingerprint:'cloud20',updatedAt:'2026-09-29T10:01:00.000Z'},
      acks:[{revision:19,fingerprint:'cloud19',deviceId:'SMT-1',appliedAt:'2026-09-29T10:02:00.000Z'}],
      online:true,
    });
    expect(view.tone).toBe('success');
    expect(view.title).toBe('已正式發佈');
    expect(view.detail).toContain('SMT 最近回讀');
    expect(view.title).not.toContain('R');
    expect(view.detail).not.toContain('R19');
    expect(view.detail).not.toContain('R20');
    expect(view.detail).not.toContain('R22');
    expect(view.detail).not.toContain('matching');
  });

  it('shows publish failure directly without revision comparison',()=>{
    const view=deriveAdminSyncPresentation({
      activeRelease:null,
      status:{state:'ERROR',updatedAt:'2026-09-29T10:01:00.000Z',revision:22,fingerprint:'x',error:'ADMIN_SYNC_PUBLISH_HTTP_500'},
      acks:[],
      online:true,
    });
    expect(view.tone).toBe('danger');
    expect(view.title).toBe('發佈失敗');
    expect(view.detail).toContain('ADMIN_SYNC_PUBLISH_HTTP_500');
  });
});
