import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

// Source-contract guard only. The companion native test executes the SQLite DTO.
const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const store=read('../../carrier/android/app/src/main/java/com/morefunos/smt/print/gateway/PrintGatewayStore.java');
const service=read('../../carrier/android/app/src/main/java/com/morefunos/smt/print/gateway/NativePrintGatewayService.java');
describe('native durable print evidence DTO source contract',()=>{
  it('projects the stored payload digest into snapshot readback',()=>{
    const snapshot=store.slice(store.indexOf('public synchronized JSONObject latestSnapshot()'),store.indexOf('public synchronized int queueDepth()'));
    expect(snapshot).toContain('payload_digest');
    expect(snapshot).toMatch(/job\.put\("payloadDigest", cursor\.getString\(8\)\)/);
  });
  it('fresh enqueue evidence is read from its existing durable attempt',()=>{
    const accepted=service.slice(service.indexOf('JSONObject gatewayAccepted('),service.indexOf('private static JSONObject accepted('));
    expect(accepted).toContain('store.findByDispatchAttemptId(dispatchAttemptId)');
    for(const key of ['payloadDigest','lastStage','createdAt','updatedAt']){
      expect(accepted).toContain(`response.put("${key}", stored.getString("${key}"))`);
    }
  });
});

it('replay outcome uses fresh durable DTO instead of the captured enqueue lookup',()=>{
  const replay=service.slice(service.indexOf('private JSONObject replayAttempt('),service.indexOf('private static JSONObject unknown('));
  const success=replay.slice(replay.indexOf("final JSONObject response = gatewayAccepted("));
  expect(success).not.toContain('existing.optString("state")');
  expect(success).toContain('final String state = response.getString("state")');
});
