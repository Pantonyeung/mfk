import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'App.tsx'),'utf8');
const admin=fs.readFileSync(path.join(root,'runtime/admin-operational-config.ts'),'utf8');

describe('SMT A4 Admin table selector alignment',()=>{
  it('uses the Admin-published active/sorted dining table registry in the hold selector',()=>{
    expect(app).toContain('const diningTableDefinitions=storeSettings.diningTables.length');
    expect(app).toContain('?storeSettings.diningTables');
    expect(app).toContain('return {id:table.id,label:table.name,occupied:Boolean(occupied),codeLabel:occupied?.codeLabel}');
    expect(admin).toContain('diningTables:Object.freeze(readSmtDiningTableRegistry().filter(table=>table.active))');
    expect(admin).toContain('}).sort((a,b)=>a.sortOrder-b.sortOrder)');
  });

  it('keeps T01-T09 only as the no-registry fallback',()=>{
    expect(app).toContain("id:'T'+String(index+1).padStart(2,'0')");
    expect(app).toContain("name:String(index+1)+' 號枱'");
  });

  it('derives occupied state from the existing dining hold without changing runtime authority',()=>{
    expect(app).toContain("heldCarts.find(hold=>hold.kind==='dining'&&hold.assignedTable===table.id)");
    expect(app).not.toContain('createDiningTableRegistry');
  });
});
