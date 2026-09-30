import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {adminShellResponse} from '../worker.ts';

describe('Admin shell freshness',()=>{
  it('forces navigation HTML to bypass persistent browser cache',()=>{
    const response=adminShellResponse(
      new Response('<!doctype html>',{headers:{'content-type':'text/html; charset=utf-8'}}),
      new Request('https://admin.morefunos.com/admin/catalog/products',{headers:{accept:'text/html,application/xhtml+xml'}}),
      'source-sha-r2',
    );
    expect(response.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate, max-age=0');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('expires')).toBe('0');
    expect(response.headers.get('x-mfk-source-sha')).toBe('source-sha-r2');
  });

  it('routes Admin navigation through Worker but leaves hashed assets direct',()=>{
    const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
    expect(wrangler.assets.run_worker_first).toEqual(['/*','!/assets/*']);
  });

  it('reloads only a Safari-style bfcache restore',()=>{
    const main=readFileSync(new URL('./main.tsx',import.meta.url),'utf8');
    expect(main).toContain("window.addEventListener('pageshow'");
    expect(main).toContain('if(event.persisted)window.location.reload()');
  });
});
