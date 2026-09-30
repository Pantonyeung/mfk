import {QueryClient} from '@tanstack/react-query';
import Dexie,{type Table} from 'dexie';
import {create} from 'zustand';

export const V3_ADMIN_STATE_AUTHORITY=Object.freeze({
  server:'TANSTACK_QUERY',
  outbox:'DEXIE_INDEXEDDB',
  localDraft:'ZUSTAND_OR_REACT',
  authPersistence:'MEMORY_ONLY',
  canonicalValidation:'SHARED_ADMIN_CONFIG_CONTRACT',
  derivedServerStatusPersisted:false,
  v2StateModulesImported:false,
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

export interface V3PendingCommand{
  id:string;
  kind:string;
  createdAt:string;
  payload:unknown;
}

export class V3AdminOutboxDb extends Dexie{
  pending!:Table<V3PendingCommand,string>;

  constructor(){
    super('mfk-admin-v3');
    this.version(1).stores({
      pending:'id,kind,createdAt',
    });
  }
}

export const v3AdminOutboxDb=new V3AdminOutboxDb();

interface V3AdminUiState{
  panel:'OVERVIEW'|'AUTHORITY';
  setPanel:(panel:V3AdminUiState['panel'])=>void;
}

export const useV3AdminUi=create<V3AdminUiState>(set=>({
  panel:'OVERVIEW',
  setPanel:panel=>set({panel}),
}));
