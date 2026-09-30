import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {adminAssetResponse} from '../worker.ts';

describe('Admin browser cache policy',()=>{
  it('forces HTML shell to revalidate instead of staying stale in normal Safari',async()=>{
    const response=adminAssetResponse(
      new Response('<!doctype html>',{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=14400'}}),
      new Request('https://admin.morefunos.com/admin/store/settings',{headers:{accept:'text/html,application/xhtml+xml'}}),
      '/admin/store/settings',
      'source-sha-1',
    );
    expect(response.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate, max-age=0');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('expires')).toBe('0');
    expect(response.headers.get('x-mfk-source-sha')).toBe('source-sha-1');
  });

  it('keeps Vite hashed assets immutable',()=>{
    const response=adminAssetResponse(
      new Response('x',{headers:{'content-type':'application/javascript'}}),
      new Request('https://admin.morefunos.com/assets/index-abc123.js'),
      '/assets/index-abc123.js',
      'source-sha-1',
    );
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('reloads only when Safari restores the page from back-forward cache',()=>{
    const source=readFileSync(new URL('./main.tsx',import.meta.url),'utf8');
    expect(source).toContain("window.addEventListener('pageshow'");
    expect(source).toContain('if(event.persisted)window.location.reload()');
  });
});
