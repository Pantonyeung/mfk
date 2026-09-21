import {readdirSync,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe,expect,it} from 'vitest';

const root=dirname(fileURLToPath(import.meta.url));

function sourceFiles(dir:string):string[]{
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const path=join(dir,entry.name);
    if(entry.isDirectory())return sourceFiles(path);
    if(!/\.(ts|tsx)$/.test(entry.name)||/\.test\.(ts|tsx)$/.test(entry.name))return [];
    return [path];
  });
}

describe('MFK Admin migration firewall',()=>{
  it('contains no live network transport in migrated Admin source',()=>{
    const forbidden=[
      /\bfetch\s*\(/,
      /\bnew\s+WebSocket\s*\(/,
      /\bXMLHttpRequest\b/,
      /\baxios\s*\./,
      /https?:\/\//,
    ];
    for(const path of sourceFiles(root)){
      const source=readFileSync(path,'utf8');
      for(const pattern of forbidden){
        expect(pattern.test(source),path+' matched '+String(pattern)).toBe(false);
      }
    }
  });

  it('does not import SMT runtime or transaction modules',()=>{
    const forbidden=[
      /v2local\//,
      /StoreKernel/,
      /store-kernel/i,
      /CheckoutWorkspace/,
      /NativePrint/,
    ];
    for(const path of sourceFiles(root)){
      const source=readFileSync(path,'utf8');
      for(const pattern of forbidden){
        expect(pattern.test(source),path+' matched '+String(pattern)).toBe(false);
      }
    }
  });
});
