import {QueryClient} from '@tanstack/react-query';
import Dexie,{type Table} from 'dexie';
import {create} from 'zustand';

export const V3_SMT_STATE_AUTHORITY=Object.freeze({
  formalTransaction:'STORE_KERNEL',
  serverReadState:'TANSTACK_QUERY_MEMORY',
  durableTransportMetadata:'DEXIE_ONLY_WHEN_REQUIRED',
  localUi:'ZUSTAND_UI_ONLY',
  periodicBusinessPolling:false,
  v2ClientStateImported:false,
});

export const v3SmtQueryClient=new QueryClient({
  defaultOptions:{
    queries:{
      staleTime:30_000,
      refetchOnWindowFocus:false,
      refetchInterval:false,
      retry:1,
    },
  },
});

export interface V3SmtOutboxRow{
  id:string;
  kind:string;
  createdAt:string;
  payload:unknown;
}

class V3SmtDb extends Dexie{
  outbox!:Table<V3SmtOutboxRow,string>;
  constructor(){
    super('mfk-smt-v3');
    this.version(1).stores({outbox:'id,kind,createdAt'});
  }
}

export const v3SmtDb=new V3SmtDb();

type Surface='DESKTOP'|'HANDHELD';
interface UiState{surface:Surface;setSurface:(surface:Surface)=>void}
export const useV3SmtUi=create<UiState>(set=>({
  surface:'DESKTOP',
  setSurface:surface=>set({surface}),
}));
