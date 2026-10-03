import {describe,expect,it} from 'vitest';

import {MFP_A9_PHYSICAL_GATES,evaluateMfpA9Cutover,evaluateMfpA9PhysicalAcceptance,type MfpA9PhysicalEvidence} from './a9-acceptance.ts';

const sourceSha='a'.repeat(40);
const releaseId='runtime-candidate-mfk-aaaaaaaaaaaa';

describe('MFP V3 A9 physical acceptance model',()=>{
  it('contains all 89 required real-device gates without prefilled results',()=>{
    expect(MFP_A9_PHYSICAL_GATES).toHaveLength(89);
    expect(evaluateMfpA9PhysicalAcceptance({expectedSourceSha:sourceSha,expectedReleaseId:releaseId,records:[]}).status).toBe('BLOCKED');
  });

  it('requires device, exact source, release and timestamp on every result',()=>{
    const record:MfpA9PhysicalEvidence={gateId:MFP_A9_PHYSICAL_GATES[0],device:'',sourceSha:'b'.repeat(40),releaseId:'wrong',timestamp:'invalid',result:'PASS'};
    const result=evaluateMfpA9PhysicalAcceptance({expectedSourceSha:sourceSha,expectedReleaseId:releaseId,records:[record]});
    expect(result.codes).toEqual(expect.arrayContaining(['MFP_PHYSICAL_DEVICE_REQUIRED','MFP_PHYSICAL_SOURCE_MISMATCH','MFP_PHYSICAL_RELEASE_MISMATCH','MFP_PHYSICAL_TIMESTAMP_INVALID']));
  });

  it('marks a real failed gate FAILED and blocks promotion',()=>{
    const records:MfpA9PhysicalEvidence[]=MFP_A9_PHYSICAL_GATES.map(gateId=>({gateId,device:'MFP-PAD-01',sourceSha,releaseId,timestamp:'2026-10-02T13:00:00.000Z',result:'PASS'}));
    records[30]={...records[30]!,result:'FAIL'};
    expect(evaluateMfpA9PhysicalAcceptance({expectedSourceSha:sourceSha,expectedReleaseId:releaseId,records}).status).toBe('FAILED');
  });

  it('allows PHYSICAL_VERIFIED only when every exact-identity record passes',()=>{
    const records=MFP_A9_PHYSICAL_GATES.map(gateId=>({gateId,device:'MFP-PAD-01',sourceSha,releaseId,timestamp:'2026-10-02T13:00:00.000Z',result:'PASS' as const}));
    expect(evaluateMfpA9PhysicalAcceptance({expectedSourceSha:sourceSha,expectedReleaseId:releaseId,records}).status).toBe('PHYSICAL_VERIFIED');
  });

  it('keeps cutover and SMM decommission blocked without every gate and Owner authorization',()=>{
    const result=evaluateMfpA9Cutover({ownerAuthorized:false,sourceVerified:true,builderVerified:true,productionBindingsAccepted:false,physicalVerified:false,publicReady:false,customerKeetaGreen:false,offlinePrintAuthGreen:false,smmRuntimeDependencyAbsent:false});
    expect(result.status).toBe('BLOCKED');
    expect(result.codes).toEqual(expect.arrayContaining(['MFP_OWNER_CUTOVER_AUTHORIZATION_REQUIRED','MFP_PRODUCTION_BINDINGS_NOT_ACCEPTED','MFP_PHYSICAL_ACCEPTANCE_REQUIRED','MFP_SMM_RUNTIME_DEPENDENCY_PRESENT']));
  });
});
