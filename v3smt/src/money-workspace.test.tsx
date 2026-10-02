import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';

import {MfpMoneyWorkspace} from './money-workspace.tsx';
import {createMfpBusinessDayOpening,createMfpDailyReport} from './money-domain.ts';

const actor={staffId:'S1',displayName:'店員'};
const opening=createMfpBusinessDayOpening({businessDayId:'BD1',businessDate:'2026-10-02',amountMinor:30000,actor,occurredAt:'2026-10-02T05:00:00.000Z'});
const report=createMfpDailyReport({
  reportId:'R1',businessDate:'2026-10-02',opening,
  orders:[{orderRef:'O1',channelId:'WALK_IN',recognizedAmountMinor:5000,effectiveTenderId:'CASH',tenderAudit:['CASH']}],
  movements:[],cashRefundAdjustmentMinor:0,countedCashMinor:35000,cashRemovedMinor:5000,closedAt:'2026-10-02T14:00:00.000Z',
});
const actions={onBack:()=>undefined,onOpening:()=>undefined,onMovement:()=>undefined,onDayClose:()=>undefined};

describe('MFP V3 A5 money workspace',()=>{
  it('renders opening, Cash In/Out, both count modes and immutable close facts',()=>{
    const html=renderToStaticMarkup(<MfpMoneyWorkspace surface="MFP_PAD" businessDayId="BD1" businessDate="2026-10-02" actor={actor} opening={opening} suggestion={null} movements={[]} report={report} actions={actions}/>);
    for(const text of ['Opening Cash','Cash In','Cash Out','Denomination','Direct Total','Expected Cash','Actual Count','Variance','Cash Removed','Retained Cash','Next Opening','IMMUTABLE'])expect(html).toContain(text);
  });

  it('keeps Channel Summary and Tender Summary as separate UI dimensions',()=>{
    const html=renderToStaticMarkup(<MfpMoneyWorkspace surface="MFP_MOBILE" businessDayId="BD1" businessDate="2026-10-02" actor={actor} opening={opening} suggestion={null} movements={[]} report={report} actions={actions}/>);
    expect(html).toContain('Channel Summary');
    expect(html).toContain('Tender Summary');
    expect(html).toContain('data-money-surface="MFP_MOBILE"');
  });
});
