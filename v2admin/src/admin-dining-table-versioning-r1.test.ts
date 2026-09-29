import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const policy=readFileSync(new URL('./PolicyWorkspaces.tsx',import.meta.url),'utf8');
const client=readFileSync(new URL('./admin-sync-client.ts',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');

describe('Admin Dining Table Versioning R1',()=>{
 it('has no fake default and never deletes table identity',()=>{expect(policy).not.toMatch(/DEFAULT_DINING_TABLES/);expect(policy).not.toMatch(/removeTable/);expect(policy).toMatch(/dining-table-id-ledger\.v1/);});
 it('makes Admin rename authoritative without occupancy approval',()=>{
   const rename=policy.slice(policy.indexOf('const requestRename='),policy.indexOf('const requestRetirement='));
   expect(rename).toContain("status:'ACTIVE'");
   expect(rename).toContain('name:label');
   expect(rename).toContain("status:'SUPERSEDED'");
   expect(rename).not.toContain('readFreshDiningOccupancy');
   expect(policy).toContain('更新名稱');
 });
 it('keeps fresh occupancy gating only on permanent retirement',()=>{
   const retirement=policy.slice(policy.indexOf('const activatePending=async'),policy.indexOf('const validationInput='));
   expect(retirement).toContain('readFreshDiningOccupancy');
   expect(retirement).toContain('activeSessionCount!==0');
   expect(retirement).toContain("retirementStatus!=='PLANNED_RETIREMENT'");
   expect(client).toContain('maxAgeMs=5000');
   expect(worker).toContain('DINING_OCCUPANCY_UNKNOWN');
 });
 it('supports reversible temporary availability and retirement cancellation',()=>{
   expect(policy).toContain('setTemporaryAvailability');
   expect(policy).toContain('取消退休');
   expect(policy).toContain("retirementStatus:'PLANNED_RETIREMENT'");
   expect(policy).toContain("retirementStatus:'RETIRED'");
 });
 it('keeps retired identity reserved and does not authorize retired reactivation',()=>{
   expect(policy).toContain("writeAdminStored('dining-table-id-ledger.v1'");
   expect(policy).toContain("row.retirementStatus==='RETIRED'");
   expect(policy).not.toContain('reactivateRetired');
 });
 it('keeps publish authority separate',()=>{expect(policy).toContain('正式保存並發佈');expect(policy).toContain('saveAdminConfig(draft)');});
});
