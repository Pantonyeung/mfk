import {QueryClient} from '@tanstack/react-query';
import Dexie,{type Table} from 'dexie';
import {create} from 'zustand';
import type {MfpCommandOutbox,MfpOutboxRecord} from './store-kernel-port.ts';
import type {MfpDeviceClass,MfpDeviceIdentity,MfpDeviceMetadataStore} from './security-port.ts';
import type {MfpSyncActiveProjection,MfpSyncProjectionStore} from './sync-port.ts';

export const MFP_STATE_AUTHORITY=Object.freeze({
  formalTransaction:'STORE_KERNEL',
  pricing:'STORE_KERNEL',
  paymentTender:'STORE_KERNEL',
  businessDayMoney:'STORE_KERNEL_CANONICAL_READBACK',
  dailyReport:'IMMUTABLE_CANONICAL_READBACK_PLUS_APPEND_ONLY_ADJUSTMENTS',
  serverReadState:'TANSTACK_QUERY_MEMORY',
  durableTransportMetadata:'DEXIE_BOUNDED_OUTBOX_ONLY',
  durableDeviceMetadata:'DEXIE_INSTALLATION_DEVICE_METADATA_ONLY',
  durableProjection:'DEXIE_ATOMIC_LKG_BUNDLE_ONLY',
  durablePresentation:'LOCAL_STORAGE_DISPLAY_SETTINGS_ONLY',
  localUi:'ZUSTAND_UI_ONLY',
  periodicBusinessPolling:false,
  periodicAuthPolling:false,
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

interface MfpSyncBundleRow extends MfpSyncActiveProjection{readonly key:'active'}

class MfpDb extends Dexie{
  outbox!:Table<MfpOutboxRecord,string>;
  devices!:Table<MfpDeviceIdentity,[string,MfpDeviceClass]>;
  syncBundles!:Table<MfpSyncBundleRow,string>;
  constructor(){
    super('mfk-mfp-v3');
    this.version(1).stores({outbox:'&submissionId,status,updatedAt'});
    this.version(2).stores({
      outbox:'&submissionId,status,updatedAt',
      devices:'[storeId+deviceClass],&deviceId,&installationId,lastSeenAt,status',
    });
    this.version(3).stores({
      outbox:'&submissionId,status,updatedAt',
      devices:'[storeId+deviceClass],&deviceId,&installationId,lastSeenAt,status',
      syncBundles:'&key,appliedSeq,appliedAt',
    });
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

export const mfpDeviceMetadataStore:MfpDeviceMetadataStore=Object.freeze({
  async read(storeId:string,deviceClass:MfpDeviceClass){return mfpDb.devices.get([storeId,deviceClass]);},
  async write(device:MfpDeviceIdentity){await mfpDb.devices.put(device);},
});

export const mfpSyncProjectionStore:MfpSyncProjectionStore=Object.freeze({
  async readActive(){
    const row=await mfpDb.syncBundles.get('active');
    if(!row)return null;
    const {key:_,...projection}=row;
    return Object.freeze(projection);
  },
  async commitAtomically(candidate:MfpSyncActiveProjection){
    await mfpDb.transaction('rw',mfpDb.syncBundles,async()=>{
      await mfpDb.syncBundles.put({...candidate,key:'active'});
    });
  },
});

type Surface='MFP_PAD'|'MFP_MOBILE';
interface UiState{surface:Surface;setSurface:(surface:Surface)=>void}
export const useMfpUi=create<UiState>(set=>({
  surface:'MFP_PAD',
  setSurface:surface=>set({surface}),
}));
