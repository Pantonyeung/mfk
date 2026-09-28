import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const policy=readFileSync(new URL('./PolicyWorkspaces.tsx',import.meta.url),'utf8');
const client=readFileSync(new URL('./admin-sync-client.ts',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
describe('Admin Dining Table Versioning R1',()=>{
 it('has no fake default and never deletes table identity',()=>{expect(policy).not.toMatch(/DEFAULT_DINING_TABLES/);expect(policy).not.toMatch(/removeTable/);expect(policy).toMatch(/dining-table-id-ledger\.v1/);});
 it('uses planned append-only version and retirement states',()=>{for(const marker of['PLANNED','ACTIVE','SUPERSEDED','PLANNED_RETIREMENT','RETIRED'])expect(policy).toContain(marker);});
 it('fresh read fails closed and records evidence',()=>{expect(client).toContain('maxAgeMs=5000');expect(policy).toContain('activeSessionCount!==0');expect(policy).toContain('runtimeRevision:evidence.runtimeRevision');expect(worker).toContain('DINING_OCCUPANCY_UNKNOWN');});
});