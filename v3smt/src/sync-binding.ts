import {mfpSecurityPort} from './security-runtime.ts';
import {mfpSyncProjectionStore} from './state-authority.ts';
import {
  createMfpSyncCoordinator,
  type MfpSyncAppliedAck,
  type MfpSyncDoorbell,
  type MfpSyncRequestContext,
  type MfpSyncTransport,
} from './sync-port.ts';

const bindingUnavailable=()=>Promise.reject(new Error('MFP_SYNC_BINDING_UNAVAILABLE'));

const unboundSyncTransport:MfpSyncTransport=Object.freeze({
  readHead:bindingUnavailable,
  readChanges:bindingUnavailable,
  readCheckpoint:bindingUnavailable,
  ackApplied:async(_ack:MfpSyncAppliedAck,_context:MfpSyncRequestContext)=>{await bindingUnavailable();},
  connectDoorbell(_listener:Readonly<{
    onOpen():void;
    onDoorbell(doorbell:MfpSyncDoorbell):void;
    onOffline():void;
  }>){return()=>undefined;},
});

async function readRequestContext():Promise<MfpSyncRequestContext>{
  const {device,session,sessionState}=mfpSecurityPort.getSnapshot();
  if(!device)throw new Error('MFP_DEVICE_IDENTITY_REQUIRED');
  if(device.status==='REVOKED')throw new Error('MFP_DEVICE_REVOKED');
  if(device.status!=='AUTHORIZED')throw new Error('MFP_DEVICE_UNKNOWN');
  if(sessionState==='REVOKED')throw new Error('MFP_STAFF_SESSION_REVOKED');
  if(sessionState==='EXPIRED')throw new Error('MFP_STAFF_SESSION_EXPIRED');
  return Object.freeze({
    storeId:device.storeId,clientId:device.installationId,deviceId:device.deviceId,
    ...(session?.staffSessionRef?{staffSessionRef:session.staffSessionRef}:{}),
  });
}

export const mfpSyncCoordinator=createMfpSyncCoordinator({
  store:mfpSyncProjectionStore,
  transport:unboundSyncTransport,
  readRequestContext,
});
