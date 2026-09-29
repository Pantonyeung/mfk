import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const policy=readFileSync(new URL('./PolicyWorkspaces.tsx',import.meta.url),'utf8');
const client=readFileSync(new URL('./admin-sync-client.ts',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
describe('Admin Dining Table Versioning R1',()=>{
 it('has no fake default and never deletes table identity',()=>{expect(policy).not.toMatch(/DEFAULT_DINING_TABLES/);expect(policy).not.toMatch(/removeTable/);expect(policy).toMatch(/dining-table-id-ledger\.v1/);});
 it('keeps append-only active rename versions and retirement states',()=>{for(const marker of['ACTIVE','SUPERSEDED','PLANNED_RETIREMENT','RETIRED'])expect(policy).toContain(marker);});
 it('fresh read fails closed and records evidence',()=>{expect(client).toContain('maxAgeMs=5000');expect(policy).toContain('activeSessionCount!==0');expect(policy).toContain('runtimeRevision:evidence.runtimeRevision');expect(worker).toContain('DINING_OCCUPANCY_UNKNOWN');});
 it('keeps rename as an explicit Admin action and activates it immediately',()=>{expect(policy).toContain('renameDrafts');expect(policy).toContain('即時改名');expect(policy).toContain("status:'ACTIVE'");expect(policy).toContain('堂食枱即時改名');expect(policy).not.toMatch(/onBlur=\{event=>\{requestRename/);});
 it('does not require a planned rename activation gate',()=>{expect(policy).not.toContain('待生效名稱：{planned?.label}');expect(policy).toContain("name:label");});
 it('treats Admin publish as the authority boundary for active table names',()=>{expect(policy).toContain('堂食枱即時改名');expect(policy).toContain('正式保存並發佈');expect(policy).not.toContain('待生效名稱：{planned?.label}');});
});