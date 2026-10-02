import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';

import {MfpPrintHardwareWorkspace} from './print-hardware-workspace.tsx';
import type {MfpPrintHardwareReadback,MfpPrintHardwareSession,MfpPrintTransportState} from './print-hardware-domain.ts';

const binding={bindingId:'KITCHEN-01',logicalDestinationId:'kitchen',displayName:'Kitchen',model:'EPSON',transport:'tcp' as const,host:'10.0.0.12',port:9100,capability:'receipt-80mm/kitchen' as const,encoding:'gb18030',enabled:true};
const session={} as MfpPrintHardwareSession;

function readback(state:MfpPrintTransportState,lastCode?:string):MfpPrintHardwareReadback{return{
  canonical:{schema:'mfp.print-hardware.read.v1',storeId:'MF01',revision:1,readAt:'2026-10-02T09:01:00.000Z',jobs:[]},
  gateway:{serviceReady:true,queueDepth:state==='PERSISTED'?1:0,lastJob:null},bindings:[binding],
  jobs:[{
    canonicalPrintJobId:'J1',orderId:'O1',jobType:'PRODUCTION',purpose:'INITIAL',logicalDestinationId:'kitchen',
    templateId:'production-v3',templateRevision:1,payloadIdentity:'P1',payloadDigest:'D1',createdAt:'2026-10-02T09:00:00.000Z',
    canonicalState:'READY',transportState:state,dispatchAttemptId:'A1',kickDrawer:false,lastCode,
    attention:state==='AMBIGUOUS_AFTER_SEND'?{kind:'HUMAN_CHECK',safeAction:'人工檢查；如有需要，建立新重印'}:
      state==='FAILED_BEFORE_SEND'?{kind:'SAFE_RETRY',safeAction:'只可經正式 Print authority 安全重試'}:{kind:'ACKNOWLEDGED',safeAction:'通訊已確認；未證明實體已出紙'},
  }],
};}

describe('MFP V3 A7 Print / Hardware workspace',()=>{
  it('shows UNKNOWN as human attention with no ordinary retry control',()=>{
    const html=renderToStaticMarkup(<MfpPrintHardwareWorkspace surface="MFP_PAD" session={session} readback={readback('AMBIGUOUS_AFTER_SEND','PRINT_GATEWAY_PROCESS_RESTART_OUTCOME_UNKNOWN')} onRefresh={vi.fn()}/>);
    expect(html).toContain('結果未能確認');expect(html).toContain('人工檢查');expect(html).toContain('無普通 Retry');
    expect(html).not.toContain('正式安全重試</button>');
  });

  it('shows formal safe retry only for FAILED_BEFORE_SEND',()=>{
    const html=renderToStaticMarkup(<MfpPrintHardwareWorkspace surface="MFP_PAD" session={session} readback={readback('FAILED_BEFORE_SEND','PRINT_CONNECT_FAILED')} onRefresh={vi.fn()}/>);
    expect(html).toContain('送出前失敗');expect(html).toContain('正式安全重試');expect(html).toContain('PRINT_CONNECT_FAILED');
  });

  it('keeps local printer config, gateway evidence and physical-paper disclaimer visible',()=>{
    const html=renderToStaticMarkup(<MfpPrintHardwareWorkspace surface="MFP_PAD" session={session} readback={readback('ACKNOWLEDGED')} onRefresh={vi.fn()}/>);
    for(const value of ['Physical Printers','Printer IP / Host','Port','Product → Logical Destination 仍由 Admin 發佈','Gateway','Queue','Bindings','Transport Evidence ≠ Physical Paper Proof'])expect(html).toContain(value);
  });

  it('shares one Pad/Mobile contract and exposes Order/Dining reprint under the existing blue UI',()=>{
    const mobile=renderToStaticMarkup(<MfpPrintHardwareWorkspace surface="MFP_MOBILE" session={session} readback={readback('ACKNOWLEDGED')} onRefresh={vi.fn()}/>);
    const workspace=readFileSync(new URL('./print-hardware-workspace.tsx',import.meta.url),'utf8');
    const operations=readFileSync(new URL('./order-operations-workspace.tsx',import.meta.url),'utf8');
    const css=readFileSync(new URL('./styles.css',import.meta.url),'utf8');
    expect(mobile).toContain('data-print-hardware-contract="SHARED_PAD_MOBILE"');expect(mobile).toContain('mfp-print-hardware mobile');
    expect(operations).toContain('Order Detail → Reprint');expect(operations).toContain('堂食打印 / 重印');expect(operations).toContain('不會自動補印更正單');
    expect(workspace).toContain('Label Route');expect(workspace).toContain('All Select');expect(workspace).toContain('重印已選');
    expect(css).toContain('.mfp-print-hardware');expect(css).toContain('background:#087ee9');expect(css).toContain('overflow-x:hidden');expect(css).toContain('min-height:50px');
  });
});
