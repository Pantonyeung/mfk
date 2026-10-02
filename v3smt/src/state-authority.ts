import {QueryClient} from '@tanstack/react-query';
import Dexie,{type Table} from 'dexie';
import {create} from 'zustand';
import type {MfpCommandOutbox,MfpOutboxRecord} from './store-kernel-port.ts';

export const MFP_STATE_AUTHORITY=Object.freeze({
  formalTransaction:'STORE_KERNEL',
  pricing:'STORE_KERNEL',
  serverReadState:'TANSTACK_QUERY_MEMORY',
  durableTransportMetadata:'DEXIE_BOUNDED_OUTBOX_ONLY',
  localUi:'ZUSTAND_UI_ONLY',
  periodicBusinessPolling:false,
  v2ClientStateImported:false,
});

export const mfpQueryClient=new QueryClient({
  defaultOptions:{
    queries:{
      staleTime:30_000,
      refetchOnWindowFocus:false,
      refetchInterval:false,
      retry:1,
    },
  },
});

export const MFP_OUTBOX_MAX_ROWS=1000;

class MfpDb extends Dexie{
  outbox!:Table<MfpOutboxRecord,string>;
  constructor(){
    super('mfk-mfp-v3');
    this.version(1).stores({outbox:'&submissionId,status,updatedAt'});
  }
}

const mfpDb=new MfpDb();

export const mfpCommandOutbox:MfpCommandOutbox=Object.freeze({
  async read(submissionId:string){return mfpDb.outbox.get(submissionId);},
  async write(record:MfpOutboxRecord){
    await mfpDb.transaction('rw',mfpDb.outbox,async()=>{
      const existing=await mfpDb.outbox.get(record.submissionId);
      const excess=existing?0:Math.max(0,await mfpDb.outbox.count()-MFP_OUTBOX_MAX_ROWS+1);
      if(excess>0){
        const terminal=await mfpDb.outbox.where('status').equals('TERMINAL_OBSERVED').sortBy('updatedAt');
        if(terminal.length<excess)throw new Error('MFP_OUTBOX_CAPACITY_EXCEEDED');
        await mfpDb.outbox.bulkDelete(terminal.slice(0,excess).map(row=>row.submissionId));
      }
      await mfpDb.outbox.put(record);
    });
  },
});

type Surface='MFP_PAD'|'MFP_MOBILE';
interface UiState{surface:Surface;setSurface:(surface:Surface)=>void}
export const useMfpUi=create<UiState>(set=>({
  surface:'MFP_PAD',
  setSurface:surface=>set({surface}),
}));
