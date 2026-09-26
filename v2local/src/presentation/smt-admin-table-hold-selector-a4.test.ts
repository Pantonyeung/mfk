// A4 latest-main proof.
import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const admin=fs.readFileSync(path.join(root,'runtime/admin-operational-config.ts'),'utf8');

describe('SMT A4 Admin table registry in hold selector',()=>{
  it('uses Admin-published dining tables before the legacy 1-9 fallback',()=>{
    expect(app).toContain('const diningTableDefinitions=storeSettings.diningTables.length');
    expect(app).toContain('?storeSettings.diningTables');
    expect(app).toContain("id:'T'+String(index+1).padStart(2,'0')");
    expect(app).toContain("name:String(index+1)+' 號枱'");
  });

  it('uses Admin table id and display name while preserving occupied hold readback',()=>{
    expect(app).toContain("hold.assignedTable===table.id");
    expect(app).toContain('id:table.id,label:table.name');
    expect(app).toContain('codeLabel:occupied?.codeLabel');
  });

  it('keeps Admin registry as the existing authority rather than adding a second table registry',()=>{
    expect(admin).toContain('export function readSmtDiningTableRegistry()');
    expect(admin).toContain('diningTables:Object.freeze(readSmtDiningTableRegistry().filter(table=>table.active))');
    expect(app).not.toContain('createDiningTableRegistry');
  });
});
