import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

describe('D8 Dining table transfer UI',()=>{
  it('uses existing assignDiningTable authority to move the SAME Hold directly to an available table',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');

    const start=dining.indexOf('  const transfer=async(tableId:string)=>{');
    const end=dining.indexOf('  const assign=async(tableId:string)=>{',start);
    const block=dining.slice(start,end);

    expect(block).toContain('await runtime.assignDiningTable(transferHoldId,tableId)');
    expect(block).toContain('訂單編號保持不變');
    expect(block).not.toContain('ensureDiningInitialPrint');
    expect(block).not.toContain('settleDiningHold');
    expect(block).not.toContain('appendDiningItems');
  });

  it('requires an available target and exposes a cancellable transfer mode without touching money',()=>{
    const here=path.dirname(fileURLToPath(import.meta.url));
    const root=path.resolve(here,'..');
    const dining=fs.readFileSync(path.join(root,'presentation/RuntimeDiningWorkspace.tsx'),'utf8');

    expect(dining).toContain("if(transferHoldId){void transfer(table.id);return;}");
    expect(dining).toContain("transferHoldId?'撳此轉枱':selectedWait?'撳此安排':'空枱'");
    expect(dining).toContain("setMessage('轉枱模式：請撳一張空枱。')");
    expect(dining).toContain("transferHoldId===detail.holdId?'取消轉枱':'轉枱'");
  });
});
