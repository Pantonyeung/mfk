import {QueryClient} from '@tanstack/react-query';
import type {MfkAdminConfigEnvelope} from '../../contracts/admin-config-sync-v1.ts';
import {readCanonicalAdminActive,readStoredAdminBrowserSession} from './admin-browser-session.ts';
import {readCanonicalAdminActiveWithPublisherKey} from './admin-sync-client.ts';

export const adminQueryKeys=Object.freeze({
  canonicalActive:(storeId='MF01')=>['mfk','admin','canonical','active',storeId] as const,
});

export const adminQueryClient=new QueryClient({
  defaultOptions:{
    queries:{
      staleTime:0,
      gcTime:5*60*1000,
      refetchOnMount:'always',
      refetchOnWindowFocus:true,
      refetchOnReconnect:true,
      retry:1,
    },
  },
});

export function adminCanonicalSessionQueryOptions(storeId='MF01'){
  return {
    queryKey:adminQueryKeys.canonicalActive(storeId),
    queryFn:async():Promise<MfkAdminConfigEnvelope>=>{
      if(!readStoredAdminBrowserSession())throw new Error('ADMIN_BROWSER_SESSION_REQUIRED');
      return readCanonicalAdminActive();
    },
    staleTime:0,
  } as const;
}

export function adminCanonicalPublisherQueryOptions(storeId='MF01'){
  return {
    queryKey:adminQueryKeys.canonicalActive(storeId),
    queryFn:async():Promise<MfkAdminConfigEnvelope>=>{
      const active=await readCanonicalAdminActiveWithPublisherKey(storeId);
      if(!active)throw new Error('ADMIN_CANONICAL_ACTIVE_UNAVAILABLE');
      return active;
    },
    staleTime:0,
  } as const;
}
