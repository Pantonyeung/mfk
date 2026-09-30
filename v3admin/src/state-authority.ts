import {QueryClient} from '@tanstack/react-query';
import {create} from 'zustand';

export const V3_ADMIN_STATE_AUTHORITY=Object.freeze({
  server:'TANSTACK_QUERY',
  outbox:'CONDITIONAL_DEXIE_ONLY_IF_OFFLINE_COMMAND_IS_PRODUCT_APPROVED',
  localDraft:'REACT_OR_ZUSTAND_NON_AUTHORITATIVE',
  authPersistence:'MEMORY_ONLY',
  canonicalValidation:'SHARED_ADMIN_CONFIG_CONTRACT',
  derivedServerStatusPersisted:false,
  v2StateModulesImported:false,
  v2LocalStorageRead:false,
} as const);

export const v3AdminQueryClient=new QueryClient({
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

interface V3AdminUiState{
  diagnosticsOpen:boolean;
  setDiagnosticsOpen:(open:boolean)=>void;
}

export const useV3AdminUi=create<V3AdminUiState>(set=>({
  diagnosticsOpen:false,
  setDiagnosticsOpen:diagnosticsOpen=>set({diagnosticsOpen}),
}));
