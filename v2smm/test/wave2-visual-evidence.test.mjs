import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const RUN=process.env.GITHUB_ACTIONS==='true';
const BASE='http://127.0.0.1:4182/test/wave2-visual-harness.html';
const OUT=path.resolve('evidence/source-fidelity-wave2-ci');

async function waitForServer(){
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
    try{
      const r=await fetch(BASE+'?stage=7');
      if(r.ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('WAVE2_VITE_SERVER_TIMEOUT');
}

function pngSize(buffer){
  assert.equal(buffer.subarray(1,4).toString('ascii'),'PNG');
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}

function emitBase64(name,buffer){
  const base64=buffer.toString('base64');
  const size=32000;
  const total=Math.ceil(base64.length/size);
  for(let i=0;i<total;i++){
    console.log('MFK_WAVE2_EVIDENCE_B64|'+name+'|'+(i+1)+'/'+total+'|'+base64.slice(i*size,(i+1)*size));
  }
}

test('Wave2 renders Stage7 Stage8 Stage9 StageX at 440x956 and 360x780', {skip:!RUN,timeout:240000}, async()=>{
  await rm(OUT,{recursive:true,force:true});
  await mkdir(OUT,{recursive:true});
  const npx=process.platform==='win32'?'npx.cmd':'npx';
  const server=spawn(npx,['vite','--host','127.0.0.1','--port','4182','--strictPort'],{stdio:'ignore'});
  try{
    await waitForServer();
    const captures=[];
    for(const [width,height] of [[440,956],[360,780]]){
      for(const stage of ['7','8','9','x']){
        const name='stage'+stage+'-'+width+'x'+height;
        const file=path.join(OUT,name+'.png');
        const result=spawnSync(npx,[
          '--yes','playwright@1.55.0','screenshot',
          '--channel','chrome',
          '--viewport-size',width+','+height,
          '--full-page',
          '--wait-for-timeout','350',
          BASE+'?stage='+stage,
          file,
        ],{encoding:'utf8',timeout:90000});
        assert.equal(result.status,0,'playwright '+name+' failed: '+String(result.stderr||result.stdout));
        const buffer=await readFile(file);
        const size=pngSize(buffer);
        assert.equal(size.width,width,name+' width');
        assert.ok(size.height>=height,name+' height');
        const sha=createHash('sha256').update(buffer).digest('hex');
        captures.push({name,width:size.width,height:size.height,sha,bytes:buffer.length});
        emitBase64(name,buffer);
      }
    }
    console.log('MFK_WAVE2_VISUAL_EVIDENCE='+JSON.stringify(captures));
  }finally{
    server.kill('SIGTERM');
  }
});
