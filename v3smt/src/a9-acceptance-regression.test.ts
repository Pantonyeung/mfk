import {describe,expect,it} from 'vitest';
import {
  MFP_A9_PHYSICAL_GATES,evaluateMfpA9Cutover,evaluateMfpA9PhysicalAcceptance,
  type MfpA9PhysicalEvidence,
} from './a9-acceptance.ts';

// Synthetic validator fixtures only: these tests are not physical device evidence.
const sourceSha='a'.repeat(40);
const releaseId='runtime-candidate-mfk-aaaaaaaaaaaa';
const records=():MfpA9PhysicalEvidence[]=>MFP_A9_PHYSICAL_GATES.map(gateId=>({
  gateId,device:'SYNTHETIC-TEST-DEVICE',sourceSha,releaseId,timestamp:'2026-10-03T00:00:00.000Z',result:'PASS',
}));
const input=()=>({expectedSourceSha:sourceSha,expectedReleaseId:releaseId,records:records()});
const evaluate=(value:unknown)=>evaluateMfpA9PhysicalAcceptance(value as Parameters<typeof evaluateMfpA9PhysicalAcceptance>[0]);
const allCutover=()=>({ownerAuthorized:true,sourceVerified:true,builderVerified:true,productionBindingsAccepted:true,
  physicalVerified:true,publicReady:true,customerKeetaGreen:true,offlinePrintAuthGreen:true,smmRuntimeDependencyAbsent:true});
const cutover=(value:unknown)=>evaluateMfpA9Cutover(value as Parameters<typeof evaluateMfpA9Cutover>[0]);
const invalidResults:unknown[]=[undefined,null,'UNKNOWN','REJECTED','COMMITTED','PASS ','pass','',true,false,1,0,{},[],['PASS']];

describe('A9 physical evidence fail-closed runtime validation',()=>{
  it('blocks all 89 UNKNOWN records from the source audit',()=>{
    const value=input();
    const result=evaluate({...value,records:value.records.map(row=>({...row,result:'UNKNOWN'}))});
    expect(result.status).toBe('BLOCKED');
    expect(result.codes).toContain(`MFP_PHYSICAL_RESULT_INVALID:${MFP_A9_PHYSICAL_GATES[0]}`);
  });

  it.each(MFP_A9_PHYSICAL_GATES)('requires the exact PASS result for %s',gate=>{
    for(const result of invalidResults){
      const value=input();
      const i=value.records.findIndex(row=>row.gateId===gate);
      const actual=evaluate({...value,records:value.records.map((row,index)=>index===i?{...row,result}:row)});
      expect(actual.status,`${gate}, ${String(result)}`).toBe('BLOCKED');
      expect(actual.codes).toContain(`MFP_PHYSICAL_RESULT_INVALID:${gate}`);
    }
  });

  it.each(MFP_A9_PHYSICAL_GATES)('cannot omit required gate %s',gate=>{
    const value=input();
    const actual=evaluate({...value,records:value.records.filter(row=>row.gateId!==gate)});
    expect(actual.status).toBe('BLOCKED');
    expect(actual.codes).toContain(`MFP_PHYSICAL_GATE_MISSING:${gate}`);
  });

  it.each(MFP_A9_PHYSICAL_GATES)('preserves FAIL for %s',gate=>{
    const value=input();
    const actual=evaluate({...value,records:value.records.map(row=>row.gateId===gate?{...row,result:'FAIL'}:row)});
    expect(actual.status).toBe('FAILED');
    expect(actual.codes).toContain(`MFP_PHYSICAL_GATE_FAILED:${gate}`);
  });

  it.each(MFP_A9_PHYSICAL_GATES)('preserves BLOCKED for %s',gate=>{
    const value=input();
    const actual=evaluate({...value,records:value.records.map(row=>row.gateId===gate?{...row,result:'BLOCKED'}:row)});
    expect(actual.status).toBe('BLOCKED');
    expect(actual.codes).toContain(`MFP_PHYSICAL_GATE_BLOCKED:${gate}`);
  });

  it.each(MFP_A9_PHYSICAL_GATES)('rejects duplicate %s, even if both pass',gate=>{
    const value=input();
    expect(evaluate({...value,records:[...value.records,value.records.find(row=>row.gateId===gate)!]}).codes)
      .toContain('MFP_PHYSICAL_DUPLICATE_GATE');
    expect(evaluate({...value,records:[...value.records,value.records.find(row=>row.gateId===gate)!]}).status).toBe('BLOCKED');
  });

  it('keeps a rejected duplicate from hiding a real failure in either order',()=>{
    const value=input();
    const failed={...value.records[0]!,result:'FAIL'};
    for(const rows of [[...value.records,failed],[failed,...value.records]]){
      const actual=evaluate({...value,records:rows});
      expect(actual.status).toBe('FAILED');
      expect(actual.codes).toContain('MFP_PHYSICAL_DUPLICATE_GATE');
    }
  });

  it.each([undefined,null,{},[],true,42,'bad'])('blocks malformed top-level input: %j',value=>{
    const actual=evaluate(value);
    expect(actual.status).toBe('BLOCKED');
    expect(actual.codes.length).toBeGreaterThan(0);
  });

  it.each([undefined,null,{},true,42,'bad'])('blocks non-array records: %j',value=>{
    const actual=evaluate({...input(),records:value});
    expect(actual.status).toBe('BLOCKED');
    expect(actual.codes).toContain('MFP_PHYSICAL_RECORDS_INVALID');
  });

  it.each([undefined,null,{},[],true,42,'bad'])('rejects malformed extra record: %j',value=>{
    const packet=input();
    expect(evaluate({...packet,records:[...packet.records,value]}).status).toBe('BLOCKED');
  });

  it('blocks sparse evidence arrays rather than throwing',()=>{
    const packet=input();
    delete packet.records[12];
    expect(evaluate(packet).status).toBe('BLOCKED');
  });

  it.each([undefined,null,'UNKNOWN_GATE','',1,{},[],['IDENTITY_CARRIER_VERSION']])('rejects unknown gateId: %j',gateId=>{
    const packet=input();
    const actual=evaluate({...packet,records:[...packet.records,{...packet.records[0],gateId}]});
    expect(actual.status).toBe('BLOCKED');
    expect(actual.codes).toContain('MFP_PHYSICAL_GATE_INVALID');
  });

  it('does not let an unknown gate substitute for a missing gate',()=>{
    const packet=input();
    const actual=evaluate({...packet,records:packet.records.map((row,index)=>index===0?{...row,gateId:'UNKNOWN_GATE'}:row)});
    expect(actual.status).toBe('BLOCKED');
    expect(actual.codes).toContain(`MFP_PHYSICAL_GATE_MISSING:${MFP_A9_PHYSICAL_GATES[0]}`);
  });

  it.each(['device','sourceSha','releaseId','timestamp'] as const)('validates %s presence and runtime type',field=>{
    const bad:unknown[]=[undefined,null,'',' ',1,true,{},[],['fixture']];
    if(field==='sourceSha')bad.push('b'.repeat(40));
    if(field==='releaseId')bad.push('wrong-release');
    if(field==='timestamp')bad.push('invalid-date',0,new Date('2026-10-03T00:00:00Z'));
    for(const value of bad){
      const packet=input();
      expect(evaluate({...packet,records:packet.records.map((row,index)=>index===0?{...row,[field]:value}:row)}).status,
        `${field}: ${String(value)}`).toBe('BLOCKED');
    }
    const packet=input();
    const missing={...packet.records[0]} as Record<string,unknown>;
    delete missing[field];
    expect(evaluate({...packet,records:[missing,...packet.records.slice(1)]}).status).toBe('BLOCKED');
  });

  it.each(['expectedSourceSha','expectedReleaseId'] as const)('rejects malformed expected identity %s without coercion',field=>{
    const valid=field==='expectedSourceSha'?sourceSha:releaseId;
    for(const value of [undefined,null,'','bad value',1,true,{},[],[valid],{toString:()=>valid}]){
      expect(evaluate({...input(),[field]:value}).status).toBe('BLOCKED');
    }
  });

  it('allows only a complete valid exact-identity PASS set, including arbitrary gate order',()=>{
    for(const rows of [records(),records().reverse()]){
      const actual=evaluate({...input(),records:rows});
      expect(actual).toEqual({status:'PHYSICAL_VERIFIED',codes:[]});
      expect(Object.isFrozen(actual)).toBe(true);
      expect(Object.isFrozen(actual.codes)).toBe(true);
    }
  });

  it('does not rewrite input evidence or manufacture missing physical proof',()=>{
    const packet=input();
    const original=JSON.stringify(packet);
    evaluate(packet);
    expect(JSON.stringify(packet)).toBe(original);
    const empty=evaluate({...packet,records:[]});
    expect(empty.status).toBe('BLOCKED');
    expect(empty.codes).toHaveLength(89);
  });
});

describe('A9 cutover requires literal boolean approval for each prerequisite',()=>{
  it.each(Object.keys(allCutover()))('never treats truthy non-booleans as approval for %s',field=>{
    for(const value of [undefined,null,false,'true','false','PASS',1,0,{},[],[true],new Boolean(true)]){
      const actual=cutover({...allCutover(),[field]:value});
      expect(actual.status,`${field}: ${String(value)}`).toBe('BLOCKED');
      expect(actual.codes).toHaveLength(1);
    }
  });

  it.each([undefined,null,{},[],true,42,'bad'])('blocks malformed cutover input: %j',value=>{
    expect(cutover(value).status).toBe('BLOCKED');
  });

  it('retains existing positive-control semantics only when all nine booleans are true',()=>{
    expect(cutover(allCutover())).toEqual({status:'PHYSICAL_VERIFIED',codes:[]});
  });
});

describe('A9 runbook ISO timestamp contract',()=>{
  it.each([
    '0','1','2026','03/10/2026','2026-10-03','2026-10-03T00:00:00',
    '2026-02-30T00:00:00.000Z','2026-02-29T00:00:00Z','1900-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z','2026-06-31T00:00:00Z','2026-09-31T00:00:00Z','2026-11-31T00:00:00Z',
    '2026-00-01T00:00:00Z','2026-13-01T00:00:00Z','2026-01-00T00:00:00Z','2026-01-32T00:00:00Z',
    '2026-10-03T25:00:00Z','2026-10-03T24:00:01Z','2026-10-03T24:00:00.001Z','2026-10-03T24:01:00Z','2026-10-03T00:60:00Z','2026-10-03T00:00:60Z',
    '2026-10-03T00:00:00+24:00','2026-10-03T00:00:00+08:60',
    '2026-10-03T00:00:00.Z',' 2026-10-03T00:00:00Z','2026-10-03T00:00:00Z ',
  ])('rejects invalid physical ISO timestamp %s',timestamp=>{
    const packet=input();
    const actual=evaluate({...packet,records:packet.records.map(row=>({...row,timestamp}))});
    expect(actual.status).toBe('BLOCKED');
    expect(actual.codes).toContain('MFP_PHYSICAL_TIMESTAMP_INVALID');
  });

  it.each([
    '2026-10-03T00:00:00Z','2026-10-03T00:00:00.0Z','2026-10-03T00:00:00.123456Z',
    '2026-10-03T08:00:00+08:00','2026-10-02T19:00:00-05:00','2026-10-03T05:30:00.123+05:30',
    '2026-10-03T14:00:00+14:00','2026-10-02T12:00:00-12:00',
    '2024-02-29T23:59:59.999Z','2000-02-29T00:00:00Z','0000-02-29T00:00:00Z','0096-02-29T00:00:00Z',
    '2026-04-30T00:00:00Z','2026-12-31T23:59:59Z',
    '2026-10-03T08:00:00+0800','2026-10-02T19:00:00-0500','2026-10-03T00:00:00+0000',
    '2026-10-03T24:00:00Z','2026-10-03T24:00:00.000Z','2024-02-29T24:00:00+0800',
    '2026-10-03t00:00:00z',
  ])('retains valid physical ISO timestamp %s',timestamp=>{
    const packet=input();
    expect(evaluate({...packet,records:packet.records.map(row=>({...row,timestamp}))})).toEqual({status:'PHYSICAL_VERIFIED',codes:[]});
  });
});
