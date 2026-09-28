import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('D13 Dining seated-time presentation',()=>{
  it('uses Admin timeout against seated time and keeps waiting elapsed separate',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');

    expect(runtime).toContain('startedAt:seated.seatedAt??seated.createdAt');
    expect(runtime).toContain('const seatedAt=hold.seatedAt??(hold.assignedTable?hold.createdAt:at)');
    expect(dining).toContain("detail.assignedTable?'用餐時間':'輪候時間'");
    expect(dining).toContain('detail.seatedAt??detail.createdAt');
    expect(dining).toContain('未入座唔會計堂食超時');
  });

  it('does not reset seating time during table transfer',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const runtime=fs.readFileSync(path.join(root,'runtime/local-runtime.ts'),'utf8');
    const assignStart=runtime.indexOf('  async assignDiningTable(holdId,tableId){');
    const assignEnd=runtime.indexOf('  async unassignDiningTable(holdId){',assignStart);
    const block=runtime.slice(assignStart,assignEnd);

    expect(block).toContain('hold.seatedAt??');
    expect(block).not.toContain('seatedAt:at,assignedTable');
  });
});
