import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,'local-runtime.ts'),'utf8');

describe('SMT consolidation A2 — Dining mutation serialization source contract',()=>{
  it('uses one keyed hold lock for all critical SAME-Hold mutation seams',()=>{
    for(const method of [
      'updateDiningPartySize',
      'admitDiningHold',
      'assignDiningTable',
      'joinDiningTable',
      'unjoinDiningTable',
      'unassignDiningTable',
      'appendDiningItems',
      'correctDiningLine',
      'overrideDiningLinePrice',
      'settleDiningHold',
      'clearDiningHold',
    ]){
      const start=source.indexOf('async '+method+'(');
      expect(start,method+' missing').toBeGreaterThan(-1);
      const window=source.slice(start,start+420);
      expect(window,method+' must use unified hold lock').toContain("withDiningMutationLock('hold:'+holdId");
    }
  });

  it('serializes first-print, receipt, addition-print and manual reprint against the same hold',()=>{
    for(const method of [
      'ensureDiningInitialPrint',
      'ensureDiningPaymentReceipt',
      'ensureDiningAdditionPrint',
      'reprintDiningJobs',
    ]){
      const start=source.indexOf('async '+method+'(');
      expect(start,method+' missing').toBeGreaterThan(-1);
      const window=source.slice(start,start+520);
      expect(window,method+' must use unified hold lock').toContain("withDiningMutationLock('hold:'+holdId");
    }
  });

  it('retains separate wait-list serialization for queue identity mutations',()=>{
    for(const method of ['createDiningWait','removeDiningWait']){
      const start=source.indexOf('async '+method+'(');
      expect(start).toBeGreaterThan(-1);
      expect(source.slice(start,start+360)).toContain("withDiningMutationLock('wait-list'");
    }
  });
});