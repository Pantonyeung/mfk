import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const git=(args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_NO_LAZY_FETCH:'1'}}).trim();
const sourceCommit=git(['rev-parse','HEAD']);
if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw new Error('Customer build requires an exact source commit');
const sourceDirty=git(['status','--porcelain','--untracked-files=all','--','.'])!=='';
const sourceHash=createHash('sha256');
const addSource=(path:string)=>{
  if(!existsSync(path))return;
  if(statSync(path).isDirectory()){
    for(const name of readdirSync(path).sort())addSource(join(path,name));
  }else{
    const content=readFileSync(path);
    sourceHash.update(`${relative(root,path)}\0${content.length}\0`).update(content).update('\0');
  }
};
// Runtime source/config and bundled public bytes, not fixture test results.
for(const path of ['src','public','index.html','package.json','tsconfig.json','vite.config.ts'])addSource(join(root,path));
const sourceDigest=sourceHash.digest('hex');
const builtAt=new Date().toISOString();
const buildId=createHash('sha256').update(JSON.stringify({sourceCommit,sourceDirty,sourceDigest,builtAt})).digest('hex');
const identity=Object.freeze({surface:'MFP_CUSTOMER_V3',sourceCommit,sourceDirty,sourceDigest,builtAt,buildId});

export default defineConfig({
  define:{__CUSTOMER_BUILD_IDENTITY__:JSON.stringify(identity)},
  plugins:[react(),{
    name:'customer-acceptance-build-identity',
    generateBundle(){this.emitFile({type:'asset',fileName:'customer-build-identity.json',source:JSON.stringify(identity,null,2)+'\n'});}
  }],
  server:{port:4175}
});
