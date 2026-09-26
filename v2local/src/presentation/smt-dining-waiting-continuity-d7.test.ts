import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('D7 waiting Dining operator continuity',()=>{
  it('opens ordered waiting detail while keeping the row available for table assignment',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');

    expect(dining).toContain('if(row.formalOrderId)void loadDetail(row.id)');
    expect(dining).toContain("row.itemCount+' 件 · 未收 '+money(row.remainingMinor??0)");
    expect(dining).toContain("!row.formalOrderId&&!(row.itemCount??0)?<button");
    expect(dining).toContain(":'輪候中'");
  });

  it('allows add-order and Checkout for an ordered waiting check without inventing a table',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');

    expect(dining).toContain("tableLabel:detail.assignedTable?(view?.tables.find(table=>table.id===detail.assignedTable)?.label??detail.assignedTable):'輪候'");
    expect(dining).toContain('>＋ 加單</button>');
    expect(dining).toContain('前往 Checkout · {selectedUnits} 件');
    expect(dining).toContain('disabled={!detail.assignedTable||detail.remainingMinor===0}');
  });
});
