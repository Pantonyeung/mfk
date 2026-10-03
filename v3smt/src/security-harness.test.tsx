import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';

import {MfpSecurityHarness} from './security-harness.tsx';
import type {MfpSecurityPort,MfpStaffSessionState} from './security-port.ts';

const device={
  deviceId:'MFP-PAD-01',
  storeId:'MF01',
  deviceClass:'PAD' as const,
  installationId:'MFP-INSTALLATION-01',
  createdAt:'2026-10-02T04:00:00.000Z',
  lastSeenAt:'2026-10-02T06:00:00.000Z',
  status:'REVOKED' as const,
};

function renderHarness(state:MfpStaffSessionState,authenticated=false){
  const staffSession=authenticated?{
    state:'AUTHENTICATED' as const,
    staffSessionRef:'SESSION-MUST-NOT-RENDER',
    staffId:'STAFF-01',
    displayName:'店員甲',
    role:'STAFF' as const,
    scope:'STORE' as const,
    permissions:['ORDER_CREATE'],
    issuedAt:'2026-10-02T04:00:00.000Z',
    expiresAt:'2026-10-02T10:00:00.000Z',
    deviceId:device.deviceId,
    storeId:device.storeId,
  }:null;
  const security:MfpSecurityPort={
    getSnapshot:()=>({device,session:staffSession,sessionState:state}),
    loadDevice:async()=>device,
    refreshDeviceAuthorization:async()=>device,
    loginStaff:async()=>({state:'UNAUTHORIZED'}),
    refreshStaffSession:async()=>state,
    logoutStaff:async()=>undefined,
    precheckAction:()=>undefined,
    precheckFrontlineAction:()=>undefined,
    submitFormalCommand:async()=>({
      schema:'mfp.store-kernel.submission.result.v1',
      submissionId:'SUB-01',
      state:'REJECTED',
      rejectionCode:'UNAUTHORIZED',
    }),
    submitFrontlineFormalCommand:async()=>({
      schema:'mfp.store-kernel.submission.result.v1',
      submissionId:'SUB-01',
      state:'REJECTED',
      rejectionCode:'UNAUTHORIZED',
    }),
  };
  const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
  return renderToStaticMarkup(<QueryClientProvider client={queryClient}>
    <MfpSecurityHarness security={security}/>
  </QueryClientProvider>);
}

describe('MFP V3 A2 visible security harness',()=>{
  it.each(['EXPIRED','REVOKED'] as const)('shows the %s fail-closed session state',state=>{
    const html=renderHarness(state);
    expect(html).toContain('Device Identity / Status');
    expect(html).toContain('MFP-PAD-01');
    expect(html).toContain('MFP-INSTALLATION-01');
    expect(html).toContain('Staff Login');
    expect(html).toContain(`Session · ${state}`);
    expect(html).toContain('type="password"');
    expect(html).toContain('Permission Check');
    expect(html).not.toContain('MFP_SECURITY_ACTION_FAILED');
  });

  it('shows current staff and expiry without rendering the opaque session ref',()=>{
    const html=renderHarness('AUTHENTICATED',true);
    expect(html).toContain('店員甲');
    expect(html).toContain('2026-10-02T10:00:00.000Z');
    expect(html).toContain('Logout');
    expect(html).not.toContain('SESSION-MUST-NOT-RENDER');
  });
});
