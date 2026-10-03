import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';

import {MfpSyncHarness} from './sync-harness.tsx';
import type {MfpSyncCoordinator} from './sync-port.ts';

const sync:MfpSyncCoordinator={
  getSnapshot:()=>({
    connection:'OFFLINE',state:'OFFLINE',headSeq:12,appliedSeq:10,lkgAvailable:true,
    lastDoorbellAt:'2026-10-02T06:00:00.000Z',lastHeadReadAt:'2026-10-02T06:00:01.000Z',
    lastAppliedAt:'2026-10-02T05:59:59.000Z',lastAckAt:null,lastError:'WAN_DOWN',
  }),
  subscribe:()=>()=>undefined,
  restore:async()=>undefined,
  startup:async()=>undefined,
  webSocketOpened:async()=>undefined,
  doorbellReceived:async()=>undefined,
  networkOnline:async()=>undefined,
  resumed:async()=>undefined,
  manualCatchUp:async()=>undefined,
  networkOffline:()=>undefined,
  connectDoorbell:()=>()=>undefined,
};

describe('MFP V3 A3 visible sync harness',()=>{
  it('shows canonical freshness, LKG and honest offline state without ordering UI',()=>{
    const html=renderToStaticMarkup(<MfpSyncHarness sync={sync}/>);
    expect(html).toContain('A3 VERIFICATION HARNESS');
    expect(html).toContain('Connection');
    expect(html).toContain('OFFLINE');
    expect(html).toContain('HeadSeq');
    expect(html).toContain('12');
    expect(html).toContain('AppliedSeq');
    expect(html).toContain('10');
    expect(html).toContain('LKG available');
    expect(html).toContain('2026-10-02T05:59:59.000Z');
    expect(html).toContain('Manual Catch-up');
    expect(html).not.toContain('Ordering');
  });
});
