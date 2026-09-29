import {describe,expect,it} from 'vitest';
import {deriveAdminSyncPresentation} from './AdminShell.tsx';

describe('Admin sync presentation authority separation',()=>{
  it('shows Cloud canonical revision and matching SMT ACK even when Browser local revision differs',()=>{
    const view=deriveAdminSyncPresentation({
      activeRelease:{version:22,createdAt:'2026-09-29T10:00:00.000Z',fingerprint:'local22'},
      status:{state:'PUBLISHED',revision:20,fingerprint:'cloud20',updatedAt:'2026-09-29T10:01:00.000Z'},
      acks:[{revision:20,fingerprint:'cloud20',deviceId:'SMT-1',appliedAt:'2026-09-29T10:02:00.000Z'}],
      online:true,
    });
    expect(view.tone).toBe('success');
    expect(view.title).toBe('Cloud R20');
    expect(view.detail).toContain('SMT 已套用');
    expect(view.detail).toContain('Browser local R22');
  });

  it('does not call a browser-local revision a matching SMT revision',()=>{
    const view=deriveAdminSyncPresentation({
      activeRelease:{version:22,createdAt:'2026-09-29T10:00:00.000Z',fingerprint:'local22'},
      status:{state:'PUBLISHED',revision:20,fingerprint:'cloud20',updatedAt:'2026-09-29T10:01:00.000Z'},
      acks:[{revision:19,fingerprint:'cloud19',deviceId:'SMT-1',appliedAt:'2026-09-29T10:02:00.000Z'}],
      online:true,
    });
    expect(view.tone).toBe('warning');
    expect(view.title).toBe('Cloud R20');
    expect(view.detail).toContain('最近 SMT 回讀 R19');
    expect(view.detail).toContain('Browser local R22');
  });
});
