import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const policy=readFileSync(new URL('./PolicyWorkspaces.tsx',import.meta.url),'utf8');
const client=readFileSync(new URL('./admin-sync-client.ts',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker.ts',import.meta.url),'utf8');
describe('Admin Dining Table Versioning R1',()=>{
 it('has no fake default and never deletes table identity',()=>{expect(policy).not.toMatch(/DEFAULT_DINING_TABLES/);expect(policy).not.toMatch(/removeTable/);expect(policy).toMatch(/dining-table-id-ledger\.v1/);});
 it('keeps append-only active rename versions and retirement states',()=>{for(const marker of['ACTIVE','SUPERSEDED','PLANNED_RETIREMENT','RETIRED'])expect(policy).toContain(marker);});
 it('fresh read fails closed and records evidence',()=>{expect(client).toContain('maxAgeMs=5000');expect(policy).toContain('activeSessionCount!==0');expect(policy).toContain('runtimeRevision:evidence.runtimeRevision');expect(worker).toContain('DINING_OCCUPANCY_UNKNOWN');});
 it('keeps rename as a controlled draft until the explicit planning action',()=>{expect(policy).toContain('renameDrafts');expect(policy).toContain('建立改名計劃');expect(policy).not.toMatch(/onBlur=\{event=>\{requestRename/);expect(policy).not.toContain("event.target.value=''");});
 it('does not require a planned rename activation gate',()=>{expect(policy).not.toContain('待生效名稱：{planned?.label}');expect(policy).toContain("name:label");});
 it('keeps activation separate from canonical publish',()=>{const activation=policy.indexOf('const activatePending=async');const publish=policy.indexOf('const saveStoreSettings=()=>');expect(activation).toBeGreaterThan(0);expect(publish).toBeGreaterThan(activation);expect(policy.slice(activation,publish)).not.toContain('saveAdminConfig(');expect(policy).toContain('正式保存並發佈');});
});