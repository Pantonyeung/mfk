import {describe,expect,it} from 'vitest';
import {
  createMfkRuntimeReadyOnce,
  readMfkRuntimeReleaseIdentity,
  signalMfkRuntimeReady,
} from './runtime-carrier-boundary.ts';

const runtimeUrl=(channel:'candidate'|'stable'='candidate')=>new URL(
  'https://appassets.androidplatform.net/runtime/index.html?releaseId=runtime-candidate-mfk-814043c809bb&runtimeVersion=runtime-candidate-mfk-814043c809bb&runtimeChannel='+channel,
);

describe('MFK SMT runtime.ready carrier compatibility',()=>{
  it('reads the exact Android candidate runtime identity',()=>{
    expect(readMfkRuntimeReleaseIdentity(runtimeUrl())).toEqual({
      releaseId:'runtime-candidate-mfk-814043c809bb',
      runtimeVersion:'runtime-candidate-mfk-814043c809bb',
      runtimeChannel:'candidate',
    });
  });

  it('sends exact runtime.ready required to persist candidate promotion',()=>{
    const messages:string[]=[];
    expect(signalMfkRuntimeReady(runtimeUrl(),{postMessage:message=>messages.push(message)})).toBe(true);
    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0]!)).toEqual({
      type:'runtime.ready',
      bridgeVersion:1,
      releaseId:'runtime-candidate-mfk-814043c809bb',
    });
  });

  it('signals at most once even when React StrictMode remounts an effect',()=>{
    const messages:string[]=[];
    const ready=createMfkRuntimeReadyOnce();
    const bridge={postMessage:(message:string)=>messages.push(message)};
    expect(ready(runtimeUrl(),bridge)).toBe(true);
    expect(ready(runtimeUrl(),bridge)).toBe(false);
    expect(messages).toHaveLength(1);
  });

  it('fails closed for noncanonical or mismatched runtime identity',()=>{
    const bridge={postMessage:()=>{throw new Error('MUST_NOT_SEND')}};
    expect(signalMfkRuntimeReady(new URL('https://example.com/runtime/index.html?releaseId=x&runtimeVersion=x&runtimeChannel=candidate'),bridge)).toBe(false);
    expect(signalMfkRuntimeReady(new URL('https://appassets.androidplatform.net/runtime/index.html?releaseId=a&runtimeVersion=b&runtimeChannel=candidate'),bridge)).toBe(false);
  });

  it('allows packaged baseline identity without inventing a release id',()=>{
    const messages:string[]=[];
    const url=new URL('https://appassets.androidplatform.net/baseline/index.html?runtimeVersion=packaged-baseline&runtimeChannel=stable');
    expect(signalMfkRuntimeReady(url,{postMessage:message=>messages.push(message)})).toBe(true);
    expect(JSON.parse(messages[0]!)).toEqual({type:'runtime.ready',bridgeVersion:1});
  });
});
