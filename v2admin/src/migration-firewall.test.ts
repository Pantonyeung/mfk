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
  it('allows network only through the explicit Admin sync/projection transports',()=>{
    const forbidden=[
      /\bXMLHttpRequest\b/,
      /\baxios\s*\./,
      /https?:\/\//,
    ];
    for(const path of sourceFiles(root)){
      const source=readFileSync(path,'utf8');
      const isSyncClient=path.endsWith('admin-sync-client.ts');
      const isProjectionClient=path.endsWith('admin-projection-client.ts');
      const isKeetaClient=path.endsWith('keeta-live-client.ts');
      const isNetworkClient=isSyncClient||isProjectionClient||isKeetaClient;
      if(!isNetworkClient)expect(/\bfetch\s*\(/.test(source),path+' used fetch outside approved network seam').toBe(false);
      if(!isProjectionClient)expect(/\bnew\s+WebSocket\s*\(/.test(source),path+' used WebSocket outside projection doorbell seam').toBe(false);
      for(const pattern of forbidden){
        expect(pattern.test(source),path+' matched '+String(pattern)).toBe(false);
      }
      if(isSyncClient){
        expect(source).toContain('/api/admin-sync/publish');
        expect(source).toContain('/api/admin-sync/acks');
      }
      if(isProjectionClient){
        expect(source).toContain('/api/projection/orders');
        expect(source).toContain('/api/projection/reports');
        expect(source).toContain('/api/admin-sync/events');
      }
      if(isKeetaClient){
        expect(source).toContain('/api/keeta/admin/status');
        expect(source).toContain('/api/keeta/admin/oauth/begin');
        expect(source).toContain('/api/keeta/admin/token/readiness');
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
