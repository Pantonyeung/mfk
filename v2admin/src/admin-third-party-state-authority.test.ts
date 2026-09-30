import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {MFK_WEB_STATE_AUTHORITY} from '../../contracts/web-state-authority-v1.ts';
import {adminQueryKeys} from './admin-query-client.ts';

describe('MFK web state sovereignty TQ1',()=>{
  it('locks the shared cross-port authority standards',()=>{
    expect(MFK_WEB_STATE_AUTHORITY.serverState.standard).toBe('TANSTACK_QUERY');
    expect(MFK_WEB_STATE_AUTHORITY.serverState.durableBrowserAuthority).toBe(false);
    expect(MFK_WEB_STATE_AUTHORITY.durableCommand.standard).toBe('DEXIE_INDEXEDDB');
    expect(MFK_WEB_STATE_AUTHORITY.durableCommand.requiredEvidenceForQueuedState).toBe('REAL_PENDING_COMMAND');
    expect(MFK_WEB_STATE_AUTHORITY.localDraft.formalAuthority).toBe(false);
  });

  it('uses one canonical query identity independent of browser auth path',()=>{
    expect(adminQueryKeys.canonicalActive('MF01')).toEqual(['mfk','admin','canonical','active','MF01']);
  });

  it('routes Admin canonical bootstrap reads through TanStack Query',()=>{
    const main=readFileSync(new URL('./main.tsx',import.meta.url),'utf8');
    const bootstrap=readFileSync(new URL('./AdminCanonicalBootstrap.tsx',import.meta.url),'utf8');
    const queryClient=readFileSync(new URL('./admin-query-client.ts',import.meta.url),'utf8');
    const pkg=readFileSync(new URL('../package.json',import.meta.url),'utf8');

    expect(pkg).toContain('"@tanstack/react-query": "5.90.3"');
    expect(main).toContain('QueryClientProvider');
    expect(main).toContain('client={adminQueryClient}');
    expect(bootstrap).toContain('adminQueryClient.fetchQuery(adminCanonicalSessionQueryOptions())');
    expect(bootstrap).toContain('adminQueryClient.fetchQuery(adminCanonicalPublisherQueryOptions())');
    expect(bootstrap).not.toContain('readCanonicalAdminActive()');
    expect(bootstrap).not.toContain('readCanonicalAdminActiveWithPublisherKey()');
    expect(queryClient).toContain("refetchOnMount:'always'");
    expect(queryClient).toContain('refetchOnWindowFocus:true');
    expect(queryClient).toContain('refetchOnReconnect:true');
  });
});
